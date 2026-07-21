/* ============================================================================
 * Boost Auto-Book — Fitbit bridge
 * ----------------------------------------------------------------------------
 * Logs attended lessons (from the ClassHistory cache) into Fitbit via the
 * Web API's Create Activity Log endpoint. Fitbit then pairs the wearable's
 * continuously-recorded heart rate with the logged time window (zones,
 * calories, active minutes) and syncs the exercise onward to Health Connect
 * through its own integration — which is the whole point of this bridge.
 *
 * Loaded into the service worker with importScripts("fitbit.js") — shares the
 * global scope with background.js (getHistoryStore etc. are used at runtime).
 *
 * Auth: OAuth 2.0 Authorization Code + PKCE via chrome.identity
 * .launchWebAuthFlow. The user creates a free "Personal" app on
 * https://dev.fitbit.com/apps and pastes its Client ID into the popup; the
 * app's Redirect URL must be set to chrome.identity.getRedirectURL()
 * (https://<extension-id>.chromiumapp.org/). PKCE means no client secret is
 * ever stored in the extension.
 *
 * Times: lesson date/time strings are studio wall-clock (Asia/Jerusalem), and
 * Fitbit interprets Create Activity Log's date/startTime in the *profile's*
 * timezone — correct as long as the Fitbit profile timezone is Israel too.
 * ==========================================================================*/

const FITBIT_AUTH_URL = "https://www.fitbit.com/oauth2/authorize";
const FITBIT_TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const FITBIT_API = "https://api.fitbit.com";
const FITBIT_SCOPE = "activity";
// Stay well under Fitbit's 150 req/hour user quota, leaving headroom for the
// catalog fetch, token refreshes and a retry or two.
const FITBIT_MAX_LOGS_PER_RUN = 100;

// Class name → Fitbit activity type. First matching rule wins; the label is
// looked up in Fitbit's public activity catalog (GET /1/activities.json) so
// no numeric activity ids are hardcoded. "Workout" is the fallback and exists
// in every Fitbit catalog.
const FITBIT_CLASS_RULES = [
  { re: /pilates|פילאטיס/i, label: "Pilates" },
  { re: /yoga|יוגה/i, label: "Yoga" },
  { re: /spin|cycle|ספינינג|אופניים/i, label: "Spinning" },
  { re: /run|ריצה/i, label: "Treadmill" },
  { re: /strength|weight|כוח|משקולות|התנגדות/i, label: "Weights" },
  { re: /stretch|מתיחות/i, label: "Stretching" },
  { re: /dance|ריקוד|זומבה|zumba/i, label: "Dancing" },
];
const FITBIT_FALLBACK_LABEL = "Workout";

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
async function getFitbitState() {
  const { bsab_fitbit } = await chrome.storage.local.get("bsab_fitbit");
  return bsab_fitbit || {
    clientId: null, accessToken: null, refreshToken: null, expiresAt: 0,
    userId: null, connectedAt: null,
    sinceDate: null,      // only lessons on/after this ISO date are synced
    durationMin: 60,      // lesson length (history rows carry start time only)
    autoSync: true,       // sync on the periodic alarm + after history refresh
    lastSync: null        // { at, added, skipped, error }
  };
}
async function setFitbitState(patch) {
  const st = await getFitbitState();
  const next = Object.assign(st, patch);
  await chrome.storage.local.set({ bsab_fitbit: next });
  return next;
}
async function getFitbitSynced() {
  const { bsab_fitbit_synced } = await chrome.storage.local.get("bsab_fitbit_synced");
  return bsab_fitbit_synced || {};
}
async function setFitbitSynced(map) {
  await chrome.storage.local.set({ bsab_fitbit_synced: map });
}

function fitbitConnected(st) { return !!(st.refreshToken && st.clientId); }

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------
function b64url(bytes) {
  let s = "";
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function makeCodeVerifier() {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}
async function makeCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

// ---------------------------------------------------------------------------
// OAuth: connect / refresh / disconnect
// ---------------------------------------------------------------------------
async function fitbitTokenRequest(params) {
  const res = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const why = (data.errors && data.errors[0] && data.errors[0].errorType) || res.status;
    throw new Error("Fitbit token request failed: " + why);
  }
  return data;
}

async function fitbitConnect(clientId) {
  clientId = String(clientId || "").trim();
  if (!clientId) throw new Error("Missing Fitbit Client ID");
  const redirectUri = chrome.identity.getRedirectURL();
  const verifier = makeCodeVerifier();
  const challenge = await makeCodeChallenge(verifier);
  const authUrl = FITBIT_AUTH_URL +
    "?response_type=code" +
    "&client_id=" + encodeURIComponent(clientId) +
    "&scope=" + encodeURIComponent(FITBIT_SCOPE) +
    "&code_challenge=" + challenge +
    "&code_challenge_method=S256" +
    "&redirect_uri=" + encodeURIComponent(redirectUri);

  const finalUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
  const code = new URL(finalUrl).searchParams.get("code");
  if (!code) throw new Error("Fitbit authorization was cancelled");

  const tok = await fitbitTokenRequest({
    client_id: clientId, grant_type: "authorization_code",
    redirect_uri: redirectUri, code, code_verifier: verifier
  });

  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const st = await getFitbitState();
  return setFitbitState({
    clientId,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: Date.now() + (tok.expires_in || 28800) * 1000,
    userId: tok.user_id || null,
    connectedAt: Date.now(),
    // Keep an existing sinceDate on reconnect so a token hiccup doesn't
    // silently move the sync boundary forward past unsynced lessons.
    sinceDate: st.sinceDate || iso
  });
}

async function fitbitDisconnect() {
  // Best effort server-side revoke; local wipe matters more.
  try {
    const st = await getFitbitState();
    if (st.accessToken) {
      await fetch(FITBIT_API + "/oauth2/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: st.accessToken, client_id: st.clientId }).toString()
      });
    }
  } catch (e) { /* ignore */ }
  await setFitbitState({ accessToken: null, refreshToken: null, expiresAt: 0, userId: null, connectedAt: null });
}

// Single-flight refresh: concurrent callers await the same promise instead of
// racing two refresh requests (Fitbit rotates the refresh token on every use,
// so a race would invalidate whichever response lands second).
let _fitbitRefreshing = null;
async function fitbitAccessToken() {
  const st = await getFitbitState();
  if (!fitbitConnected(st)) throw new Error("Fitbit not connected");
  if (st.accessToken && Date.now() < st.expiresAt - 5 * 60 * 1000) return st.accessToken;
  if (!_fitbitRefreshing) {
    _fitbitRefreshing = (async () => {
      try {
        const tok = await fitbitTokenRequest({
          client_id: st.clientId, grant_type: "refresh_token", refresh_token: st.refreshToken
        });
        const next = await setFitbitState({
          accessToken: tok.access_token,
          refreshToken: tok.refresh_token || st.refreshToken,
          expiresAt: Date.now() + (tok.expires_in || 28800) * 1000
        });
        return next.accessToken;
      } catch (e) {
        // An invalid refresh token can't recover on its own — flag it so the
        // popup shows "reconnect" instead of silently failing forever.
        if (/invalid_grant/i.test(String(e))) {
          await setFitbitState({ accessToken: null, refreshToken: null, expiresAt: 0 });
        }
        throw e;
      } finally {
        _fitbitRefreshing = null;
      }
    })();
  }
  return _fitbitRefreshing;
}

async function fitbitApi(path, opts) {
  const token = await fitbitAccessToken();
  const res = await fetch(FITBIT_API + path, Object.assign({}, opts, {
    headers: Object.assign({ Authorization: "Bearer " + token }, (opts && opts.headers) || {})
  }));
  return res;
}

// ---------------------------------------------------------------------------
// Activity type resolution (no hardcoded numeric ids)
// ---------------------------------------------------------------------------
// Fitbit's activity catalog barely changes; cache it for 30 days.
async function fitbitActivityId(label) {
  const { bsab_fitbit_catalog } = await chrome.storage.local.get("bsab_fitbit_catalog");
  let cat = bsab_fitbit_catalog;
  if (!cat || Date.now() - cat.fetchedAt > 30 * 24 * 3600 * 1000) {
    const res = await fitbitApi("/1/activities.json");
    if (!res.ok) throw new Error("Fitbit activity catalog fetch failed: " + res.status);
    const data = await res.json();
    const byName = {};
    (function walk(cats) {
      (cats || []).forEach(c => {
        (c.activities || []).forEach(a => { byName[String(a.name).toLowerCase()] = a.id; });
        walk(c.subCategories);
      });
    })(data.categories);
    cat = { byName, fetchedAt: Date.now() };
    await chrome.storage.local.set({ bsab_fitbit_catalog: cat });
  }
  return cat.byName[String(label).toLowerCase()] || null;
}

function fitbitLabelForClass(className) {
  for (const rule of FITBIT_CLASS_RULES) {
    if (rule.re.test(className || "")) return rule.label;
  }
  return FITBIT_FALLBACK_LABEL;
}

// ---------------------------------------------------------------------------
// Lesson sync
// ---------------------------------------------------------------------------
function fitbitLessonKey(rec) { return `${rec.date} ${rec.time} ${rec.className}`; }

// Logs one lesson. startTime must be HH:mm — Fitbit documents that seconds
// are not supported and give wrong results if included.
async function fitbitLogLesson(rec, durationMin) {
  const label = fitbitLabelForClass(rec.className);
  let activityId = null;
  try { activityId = await fitbitActivityId(label); } catch (e) { /* fall through to name-based log */ }
  if (!activityId && label !== FITBIT_FALLBACK_LABEL) {
    try { activityId = await fitbitActivityId(FITBIT_FALLBACK_LABEL); } catch (e) { /* ignore */ }
  }
  const time = String(rec.time || "").slice(0, 5);
  const params = {
    date: rec.date,
    startTime: time,
    durationMillis: String(durationMin * 60 * 1000)
  };
  if (activityId) {
    params.activityId = String(activityId);
  } else {
    // Last resort: custom activity by name. Fitbit requires manualCalories
    // here (a rough ~7 kcal/min estimate); with a proper activityId above,
    // Fitbit derives calories from the wearable's own heart-rate data, which
    // is why the catalog path is strongly preferred.
    params.activityName = rec.className || FITBIT_FALLBACK_LABEL;
    params.manualCalories = String(Math.max(1, Math.round(durationMin * 7)));
  }
  const res = await fitbitApi("/1/user/-/activities.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString()
  });
  if (res.status === 429) throw Object.assign(new Error("Fitbit rate limit hit"), { rateLimited: true });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fitbit log failed (${res.status}) for ${fitbitLessonKey(rec)}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// Syncs every attended lesson that (a) starts on/after sinceDate, (b) has
// already ended, and (c) hasn't been logged before. History store shape is
// background.js's { months: { "YYYY-MM": { rows: [...] } } }.
async function fitbitSyncLessons(historyStore) {
  const st = await getFitbitState();
  if (!fitbitConnected(st)) return { ok: false, error: "not connected" };

  const store = historyStore || await getHistoryStore();
  const synced = await getFitbitSynced();
  const durationMin = Math.max(5, Number(st.durationMin) || 60);
  const now = Date.now();

  const pending = [];
  Object.values(store.months || {}).forEach(m => (m.rows || []).forEach(rec => {
    if (rec.status !== "attended") return;
    if (!rec.date || !rec.time) return;
    if (st.sinceDate && rec.date < st.sinceDate) return;
    const key = fitbitLessonKey(rec);
    if (synced[key]) return;
    // Only lessons that have finished — logging a live/future window would
    // attribute a partial (or empty) heart-rate stream to it.
    const endMs = studioTimeMs(rec.date, rec.time) + durationMin * 60 * 1000;
    if (endMs > now) return;
    pending.push(rec);
  }));
  pending.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  let added = 0, skipped = 0;
  let error = null;
  for (const rec of pending.slice(0, FITBIT_MAX_LOGS_PER_RUN)) {
    try {
      await fitbitLogLesson(rec, durationMin);
      synced[fitbitLessonKey(rec)] = Date.now();
      added++;
    } catch (e) {
      error = String(e && e.message || e);
      if (e && e.rateLimited) break; // quota — the rest will go next run
      skipped++;                      // per-lesson failure — keep going
    }
  }

  // Prune dedup entries older than ~400 days so the map can't grow forever.
  const cutoff = Date.now() - 400 * 24 * 3600 * 1000;
  Object.keys(synced).forEach(k => { if (synced[k] < cutoff) delete synced[k]; });

  await setFitbitSynced(synced);
  await setFitbitState({ lastSync: { at: Date.now(), added, skipped, error } });
  if (added) {
    try { notify("Fitbit sync", `${added} lesson${added === 1 ? "" : "s"} logged to Fitbit.`); } catch (e) {}
  }
  return { ok: !error, added, skipped, pending: Math.max(0, pending.length - added - skipped), error };
}

// Status snapshot for the popup — never exposes tokens.
async function fitbitStatus() {
  const st = await getFitbitState();
  const synced = await getFitbitSynced();
  return {
    connected: fitbitConnected(st),
    clientId: st.clientId || "",
    userId: st.userId || null,
    connectedAt: st.connectedAt || null,
    sinceDate: st.sinceDate || null,
    durationMin: st.durationMin || 60,
    autoSync: st.autoSync !== false,
    lastSync: st.lastSync || null,
    syncedCount: Object.keys(synced).length,
    redirectUrl: chrome.identity.getRedirectURL()
  };
}
