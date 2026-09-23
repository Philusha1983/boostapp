/* ============================================================================
 * Boost Auto-Book — Fitbit bridge (via the Google Health API)
 * ----------------------------------------------------------------------------
 * Logs attended lessons (from the ClassHistory cache) as exercise sessions in
 * the user's Fitbit data, using the **Google Health API v4**
 * (health.googleapis.com). Fitbit pairs the wearable's continuously-recorded
 * heart rate with the logged time window and syncs the exercise onward to
 * Health Connect through its own integration — which is the whole point.
 *
 * WHY GOOGLE HEALTH API (not the legacy Fitbit Web API): dev.fitbit.com
 * discontinued new app registrations, and the legacy Web API is being
 * deprecated in September 2026. The replacement is the Google Health API:
 * a Google Cloud project + Google OAuth, endpoint
 *   POST /v4/users/me/dataTypes/exercise/dataPoints
 * with scope googlehealth.activity_and_fitness.writeonly.
 *
 * Loaded into the service worker with importScripts("fitbit.js") — shares the
 * global scope with background.js (getHistoryStore, studioTimeMs, tzOffsetMs,
 * STUDIO_TZ, notify are used at runtime).
 *
 * SETUP (one-time, by the user):
 *   1. console.cloud.google.com → create a project, enable "Google Health API".
 *   2. Create an OAuth client (type: Web application). Add
 *      chrome.identity.getRedirectURL() — https://<ext-id>.chromiumapp.org/ —
 *      as an Authorized redirect URI.
 *   3. OAuth consent screen: External + Testing, add yourself as a test user,
 *      add the activity_and_fitness.writeonly scope.
 *   4. Paste the Client ID and Client Secret into the popup's Fitbit card.
 *   NOTE: while the consent screen stays in "Testing" mode, Google expires
 *   refresh tokens after 7 days — the popup will ask to reconnect weekly.
 *   Publishing the app ("In production") makes refresh tokens long-lived.
 *
 * Times: lesson date/time strings are studio wall-clock (Asia/Jerusalem).
 * SessionTimeInterval wants RFC-3339 instants plus explicit UTC offsets, so
 * both are computed with background.js's studio-timezone helpers.
 * ==========================================================================*/

const GH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GH_API = "https://health.googleapis.com";
// writeonly: create the exercise sessions. The two readonly scopes: read the
// wearable's rollups (heart rate, calories, steps, AZM) for the lesson window
// so the logged workout carries real measured metrics instead of blanks.
const GH_SCOPE = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.writeonly",
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly"
].join(" ");
// Modest per-run cap: a full first backfill of years of lessons is throttled
// across several runs rather than firing hundreds of writes in one burst.
const GH_MAX_LOGS_PER_RUN = 100;

// Class name → Google Health ExerciseType enum. First matching rule wins.
// EXERCISE_CLASS is the fallback — it exists exactly for studio group lessons.
const GH_CLASS_RULES = [
  // Studio nicknames first (more specific than the generic keyword rules):
  // "Training Harmony" = the studio's general CrossFit class, "Calisapiens"
  // = its calisthenics class.
  { re: /training\s*harmony/i, type: "CROSSFIT" },
  { re: /calisapiens|calisthenic|קליסתניקה/i, type: "CALISTHENICS" },
  { re: /crossfit|קרוספיט/i, type: "CROSSFIT" },
  { re: /pilates|פילאטיס/i, type: "PILATES" },
  { re: /yoga|יוגה/i, type: "YOGA" },
  { re: /spin|cycle|ספינינג|אופניים/i, type: "SPINNING" },
  { re: /run|ריצה/i, type: "RUNNING" },
  { re: /strength|weight|כוח|משקולות|התנגדות/i, type: "STRENGTH_TRAINING" },
  { re: /trx/i, type: "TRX" },
  { re: /hiit/i, type: "HIIT" },
  { re: /stretch|מתיחות/i, type: "STRETCHING" },
  { re: /zumba|זומבה/i, type: "ZUMBA" },
  { re: /dance|ריקוד/i, type: "DANCING" },
];
const GH_FALLBACK_TYPE = "EXERCISE_CLASS";

// Studio nicknames → clear workout names for the title shown in health apps.
// First matching rule wins; unmatched class names pass through unchanged.
const GH_CLASS_DISPLAY_ALIASES = [
  { re: /^training\s*harmony$/i, name: "CrossFit" },
  { re: /^calisapiens$/i, name: "Calisthenics" },
];
function ghDisplayClassName(className) {
  for (const a of GH_CLASS_DISPLAY_ALIASES) {
    if (a.re.test((className || "").trim())) return a.name;
  }
  return className;
}

// ---------------------------------------------------------------------------
// Storage (keys keep the bsab_fitbit name — it's still the Fitbit bridge)
// ---------------------------------------------------------------------------
async function getFitbitState() {
  const { bsab_fitbit } = await chrome.storage.local.get("bsab_fitbit");
  return bsab_fitbit || {
    clientId: null, clientSecret: null,
    accessToken: null, refreshToken: null, expiresAt: 0,
    connectedAt: null,
    sinceDate: null,      // only lessons on/after this ISO date are synced
    durationMin: 60,      // lesson length (history rows carry start time only)
    autoSync: true,       // sync on the periodic alarm + after history refresh
    needsReconnect: false,// refresh token expired/revoked — user action needed
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

function fitbitConnected(st) { return !!(st.refreshToken && st.clientId && st.clientSecret); }

// ---------------------------------------------------------------------------
// PKCE helpers (Google supports PKCE in addition to the client secret)
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
async function ghTokenRequest(params) {
  const res = await fetch(GH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error("Google token request failed: " + (data.error || res.status) + (data.error_description ? " — " + data.error_description : ""));
  }
  return data;
}

async function fitbitConnect(clientId, clientSecret) {
  clientId = String(clientId || "").trim();
  clientSecret = String(clientSecret || "").trim();
  // Disconnect keeps clientId/clientSecret in storage (only tokens are
  // wiped), and the popup never re-displays the secret — so an empty field
  // means "reuse the stored one", not "missing".
  const stored = await getFitbitState();
  if (!clientId) clientId = stored.clientId || "";
  if (!clientSecret) clientSecret = stored.clientSecret || "";
  if (!clientId || !clientSecret) throw new Error("Missing Google OAuth Client ID / Client Secret");
  const redirectUri = chrome.identity.getRedirectURL();
  const verifier = makeCodeVerifier();
  const challenge = await makeCodeChallenge(verifier);
  const authUrl = GH_AUTH_URL +
    "?response_type=code" +
    "&client_id=" + encodeURIComponent(clientId) +
    "&scope=" + encodeURIComponent(GH_SCOPE) +
    "&redirect_uri=" + encodeURIComponent(redirectUri) +
    // offline + consent → Google actually issues a refresh token every time
    "&access_type=offline&prompt=consent" +
    "&code_challenge=" + challenge + "&code_challenge_method=S256";

  const finalUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
  const u = new URL(finalUrl);
  const err = u.searchParams.get("error");
  if (err) throw new Error("Google authorization failed: " + err);
  const code = u.searchParams.get("code");
  if (!code) throw new Error("Google authorization was cancelled");

  const tok = await ghTokenRequest({
    client_id: clientId, client_secret: clientSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri, code, code_verifier: verifier
  });
  if (!tok.refresh_token) throw new Error("Google did not return a refresh token — remove the app's access at myaccount.google.com/permissions and reconnect");

  const st = await getFitbitState();
  return setFitbitState({
    clientId, clientSecret,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: Date.now() + (tok.expires_in || 3600) * 1000,
    connectedAt: Date.now(),
    needsReconnect: false,
    // Default backfill boundary = the oldest attended lesson already fetched
    // into the history cache, i.e. "sync everything we know about". Kept on
    // reconnect so the weekly Testing-mode re-auth doesn't move the boundary.
    // null = no boundary (sync whatever history holds, now or later).
    sinceDate: st.sinceDate || await fitbitOldestAttendedDate()
  });
}

// Oldest attended lesson date in the history cache, or null when empty.
async function fitbitOldestAttendedDate() {
  try {
    const store = await getHistoryStore();
    let min = null;
    Object.values(store.months || {}).forEach(m => (m.rows || []).forEach(r => {
      if (r.status === "attended" && r.date && (!min || r.date < min)) min = r.date;
    }));
    return min;
  } catch (e) { return null; }
}

async function fitbitDisconnect() {
  // Best effort server-side revoke; local wipe matters more.
  try {
    const st = await getFitbitState();
    const tok = st.refreshToken || st.accessToken;
    if (tok) {
      await fetch(GH_REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: tok }).toString()
      });
    }
  } catch (e) { /* ignore */ }
  await setFitbitState({ accessToken: null, refreshToken: null, expiresAt: 0, connectedAt: null, needsReconnect: false });
}

// Single-flight refresh: concurrent callers await the same promise instead of
// racing two refresh requests.
let _ghRefreshing = null;
async function ghAccessToken() {
  const st = await getFitbitState();
  if (!fitbitConnected(st)) throw new Error("Not connected");
  if (st.accessToken && Date.now() < st.expiresAt - 5 * 60 * 1000) return st.accessToken;
  if (!_ghRefreshing) {
    _ghRefreshing = (async () => {
      try {
        const tok = await ghTokenRequest({
          client_id: st.clientId, client_secret: st.clientSecret,
          grant_type: "refresh_token", refresh_token: st.refreshToken
        });
        const next = await setFitbitState({
          accessToken: tok.access_token,
          expiresAt: Date.now() + (tok.expires_in || 3600) * 1000
        });
        return next.accessToken;
      } catch (e) {
        // invalid_grant = refresh token expired (7-day Testing-mode limit) or
        // revoked — can't recover without the user reconnecting, so flag it
        // for the popup instead of silently failing forever.
        if (/invalid_grant/i.test(String(e))) {
          await setFitbitState({ accessToken: null, refreshToken: null, expiresAt: 0, needsReconnect: true });
        }
        throw e;
      } finally {
        _ghRefreshing = null;
      }
    })();
  }
  return _ghRefreshing;
}

async function ghApi(path, opts) {
  const token = await ghAccessToken();
  return fetch(GH_API + path, Object.assign({}, opts, {
    headers: Object.assign({ Authorization: "Bearer " + token }, (opts && opts.headers) || {})
  }));
}

// ---------------------------------------------------------------------------
// Wearable metrics for a lesson window (rollUp endpoint)
// ---------------------------------------------------------------------------
// Rolls up one data type over [startMs, endMs) as a single window. Returns
// the rollup value object, or null when there's no data / no read scope.
async function ghRollupValue(dataType, startMs, endMs) {
  try {
    const res = await ghApi(`/v4/users/me/dataTypes/${dataType}/dataPoints:rollUp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        range: { startTime: new Date(startMs).toISOString(), endTime: new Date(endMs).toISOString() },
        windowSize: Math.max(1, Math.round((endMs - startMs) / 1000)) + "s"
      })
    });
    if (!res.ok) {
      if (res.status === 403) console.log("[Boost Auto-Book] rollUp 403 — readonly scopes not granted yet (reconnect after adding them)");
      return null;
    }
    const data = await res.json().catch(() => ({}));
    for (const p of (data.rollupDataPoints || [])) {
      for (const k of Object.keys(p)) {
        if (k !== "startTime" && k !== "endTime") return p[k];
      }
    }
    return null;
  } catch (e) { return null; }
}

// Field names inside {DataType}RollupValue follow {field}{AggFn} — prefer the
// documented names but fall back to the first numeric property so a naming
// drift degrades gracefully instead of dropping the metric.
function ghFirstNumber(obj, preferredKeys) {
  if (!obj) return null;
  for (const k of preferredKeys) {
    if (obj[k] != null && isFinite(Number(obj[k]))) return Number(obj[k]);
  }
  for (const k of Object.keys(obj)) {
    const v = Number(obj[k]);
    if (isFinite(v)) return v;
  }
  return null;
}

// Builds a MetricsSummary for the lesson window from the wearable's data.
// hasHeartRate tells the caller whether the watch's recording has arrived —
// used to defer logging a just-finished lesson until the tracker syncs.
async function fitbitFetchLessonMetrics(startMs, endMs) {
  const out = { metrics: {}, hasHeartRate: false };
  const [hr, cal, steps, azm] = await Promise.all([
    ghRollupValue("heart-rate", startMs, endMs),
    ghRollupValue("total-calories", startMs, endMs),
    ghRollupValue("steps", startMs, endMs),
    ghRollupValue("active-zone-minutes", startMs, endMs)
  ]);
  console.log("[Boost Auto-Book] lesson rollups:", JSON.stringify({ hr, cal, steps, azm }));
  const avg = ghFirstNumber(hr, ["beatsPerMinuteAvg"]);
  if (avg) { out.metrics.averageHeartRateBeatsPerMinute = String(Math.round(avg)); out.hasHeartRate = true; }
  const kcal = ghFirstNumber(cal, ["caloriesKcalSum", "caloriesKcal"]);
  if (kcal) out.metrics.caloriesKcal = Math.round(kcal);
  const st = ghFirstNumber(steps, ["countSum", "stepsSum"]);
  if (st != null) out.metrics.steps = String(Math.round(st));
  // AZM rolls up per zone ({sumInFatBurnHeartZone, sumInCardioHeartZone,
  // sumInPeakHeartZone}, string values) — the lesson total is their sum.
  // Older/other shapes fall back to a single documented total.
  let mins = null;
  if (azm) {
    const zoneKeys = Object.keys(azm).filter(k => /^sumIn.*Zone$/i.test(k));
    if (zoneKeys.length) mins = zoneKeys.reduce((a, k) => a + (Number(azm[k]) || 0), 0);
    else mins = ghFirstNumber(azm, ["minutesSum", "activeZoneMinutesSum"]);
  }
  if (mins != null) out.metrics.activeZoneMinutes = String(Math.round(mins));
  return out;
}

// ---------------------------------------------------------------------------
// Lesson sync
// ---------------------------------------------------------------------------
function fitbitLessonKey(rec) { return `${rec.date} ${rec.time} ${rec.className}`; }

function ghExerciseType(className) {
  for (const rule of GH_CLASS_RULES) {
    if (rule.re.test(className || "")) return rule.type;
  }
  return GH_FALLBACK_TYPE;
}

// Client-provided dataPoint id (4-63 chars, [a-z0-9-]) derived from the
// lesson's date+time — makes the create idempotent server-side: retrying the
// same lesson yields ALREADY_EXISTS instead of a duplicate session.
function ghDataPointId(rec) {
  return ("bsab-" + rec.date + "-" + String(rec.time || "").slice(0, 5).replace(":", "")).toLowerCase();
}

// Logs one lesson as an exercise session data point.
async function fitbitLogLesson(rec, durationMin, metricsSummary) {
  const startMs = studioTimeMs(rec.date, rec.time);
  const endMs = startMs + durationMin * 60 * 1000;
  const offSec = Math.round(tzOffsetMs(STUDIO_TZ, new Date(startMs)) / 1000);
  const offSecEnd = Math.round(tzOffsetMs(STUDIO_TZ, new Date(endMs)) / 1000);
  const body = {
    name: `users/me/dataTypes/exercise/dataPoints/${ghDataPointId(rec)}`,
    // MANUAL = "manually entered by the user" — without it the point lands
    // as recordingMethod UNKNOWN, which the Fitbit app appears not to show.
    dataSource: { recordingMethod: "MANUAL" },
    exercise: {
      interval: {
        startTime: new Date(startMs).toISOString(),
        startUtcOffset: offSec + "s",
        endTime: new Date(endMs).toISOString(),
        endUtcOffset: offSecEnd + "s"
      },
      exerciseType: ghExerciseType(rec.className),
      // Title shown in the Fitbit app — the schema has no structured venue
      // field, so the studio rides in the display name: "<Lesson> at <Studio>".
      // Nicknamed classes are translated to clear names first (see aliases).
      displayName: [ghDisplayClassName(rec.className) || "Studio lesson", rec.studio]
        .filter(Boolean).join(" at "),
      // Required by the schema. Filled with the wearable's rollups for the
      // window when available — Fitbit does NOT backfill these on its own
      // for API-written sessions (verified: empty details in the app).
      metricsSummary: metricsSummary || {},
      notes: [rec.teacher, rec.studio].filter(Boolean).join(" · ") || undefined
    }
  };
  const res = await ghApi("/v4/users/me/dataTypes/exercise/dataPoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (res.status === 409) {
    console.log("[Boost Auto-Book] Fitbit: ALREADY_EXISTS (server already has it):", fitbitLessonKey(rec));
    return { alreadyExists: true }; // idempotent retry
  }
  if (res.status === 429) throw Object.assign(new Error("Google Health API rate limit hit"), { rateLimited: true });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Exercise create failed (${res.status}) for ${fitbitLessonKey(rec)}: ${txt.slice(0, 200)}`);
  }
  // Create returns a long-running Operation — an HTTP 200 can still carry a
  // failure inside. Log the full payload (visible in the service-worker
  // console) and surface any embedded error instead of counting it as synced.
  const op = await res.json().catch(() => ({}));
  console.log("[Boost Auto-Book] Fitbit create response for", fitbitLessonKey(rec), JSON.stringify(op));
  if (op && op.error) {
    throw new Error(`Exercise create operation failed for ${fitbitLessonKey(rec)}: ${JSON.stringify(op.error).slice(0, 200)}`);
  }
  // Since ~11 Sep 2026 the server drops client metricsSummary on CREATE of a
  // MANUAL exercise (keeps only its own calorie estimate). A PATCH of the
  // same record afterwards keeps averageHeartRateBeatsPerMinute (verified
  // 2026-09-23: the app then shows avg HR + the zone chart). caloriesKcal and
  // displayName stay server-owned either way.
  const serverName = op && op.response && op.response.name;
  if (serverName && metricsSummary && metricsSummary.averageHeartRateBeatsPerMinute) {
    try {
      const ok = await ghPatchExerciseMetrics(serverName, body.exercise, metricsSummary);
      console.log("[Boost Auto-Book] metrics PATCH after create", fitbitLessonKey(rec), ok ? "kept HR" : "HR NOT kept — repair pass will retry");
    } catch (e) {
      console.log("[Boost Auto-Book] metrics PATCH after create failed (repair pass will retry):", String(e && e.message || e));
    }
  }
  return op;
}

// PATCHes an existing exercise record (full DataPoint body — the endpoint has
// no updateMask) with the given metrics, then reads it back. Returns true when
// the stored record carries the average heart rate.
async function ghPatchExerciseMetrics(name, exercise, metricsSummary) {
  const body = {
    name,
    dataSource: { recordingMethod: "MANUAL" },
    exercise: {
      interval: exercise.interval,
      exerciseType: exercise.exerciseType,
      displayName: exercise.displayName,
      metricsSummary,
      notes: exercise.notes
    }
  };
  const res = await ghApi("/v4/" + name, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (res.status === 429) throw Object.assign(new Error("Google Health API rate limit hit"), { rateLimited: true });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Exercise patch failed (${res.status}) for ${name}: ${txt.slice(0, 200)}`);
  }
  const op = await res.json().catch(() => ({}));
  if (op && op.error) throw new Error(`Exercise patch operation failed for ${name}: ${JSON.stringify(op.error).slice(0, 200)}`);
  const back = await ghApi("/v4/" + name).then(r => r.ok ? r.json() : null).catch(() => null);
  const ms = back && back.exercise && back.exercise.metricsSummary;
  return !!(ms && ms.averageHeartRateBeatsPerMinute);
}

// ---------------------------------------------------------------------------
// Metrics repair pass
// ---------------------------------------------------------------------------
// Backstop for the create→PATCH step: finds this extension's own MANUAL
// exercise records from the last GH_REPAIR_DAYS that lack an average heart
// rate and PATCHes the wearable's rollups onto them. Also heals lessons
// logged between the server change (~11 Sep 2026) and this fix.
// Only records written by our OAuth client are touched — workouts logged in
// the app itself (or by other apps) are left alone. Records whose window has
// no heart-rate data (tracker not worn) are retried at most GH_REPAIR_MAX_TRIES.
const GH_REPAIR_DAYS = 30;
const GH_REPAIR_MAX_TRIES = 5;

// "123-abc.apps.googleusercontent.com" and "123-abc" name the same client.
function ghClientKey(id) { return String(id || "").trim().replace(/\.apps\.googleusercontent\.com$/i, ""); }

async function fitbitRepairMetrics(st) {
  const cutoffMs = Date.now() - GH_REPAIR_DAYS * 24 * 3600 * 1000;
  const { bsab_fitbit_repair_tries: tries0 } = await chrome.storage.local.get("bsab_fitbit_repair_tries");
  const tries = tries0 || {};
  const candidates = [];
  let pageToken = null, pages = 0, reachedCutoff = false;
  do {
    const res = await ghApi("/v4/users/me/dataTypes/exercise/dataPoints?pageSize=100" + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""));
    if (!res.ok) { console.log("[Boost Auto-Book] repair: list failed", res.status); break; }
    const data = await res.json().catch(() => ({}));
    for (const p of (data.dataPoints || [])) {
      const ex = p.exercise || {};
      const startMs = Date.parse(ex.interval && ex.interval.startTime);
      if (!isFinite(startMs)) continue;
      if (startMs < cutoffMs) { reachedCutoff = true; continue; }
      const ds = p.dataSource || {};
      if (ds.recordingMethod !== "MANUAL") continue;
      if (!ds.application || ghClientKey(ds.application.googleWebClientId) !== ghClientKey(st.clientId)) continue;
      if (ex.metricsSummary && ex.metricsSummary.averageHeartRateBeatsPerMinute) continue;
      if ((tries[p.name] || 0) >= GH_REPAIR_MAX_TRIES) continue;
      candidates.push(p);
    }
    pageToken = data.nextPageToken;
    pages++;
  } while (pageToken && !reachedCutoff && pages < 10);

  let repaired = 0, failed = 0;
  for (const p of candidates) {
    const ex = p.exercise;
    const startMs = Date.parse(ex.interval.startTime);
    const endMs = Date.parse(ex.interval.endTime);
    if (!isFinite(endMs) || endMs > Date.now()) continue;
    try {
      const m = await fitbitFetchLessonMetrics(startMs, endMs);
      if (!m.hasHeartRate) { tries[p.name] = (tries[p.name] || 0) + 1; failed++; continue; }
      const ok = await ghPatchExerciseMetrics(p.name, ex, m.metrics);
      if (ok) { repaired++; delete tries[p.name]; }
      else { tries[p.name] = (tries[p.name] || 0) + 1; failed++; }
    } catch (e) {
      if (e && e.rateLimited) break;
      tries[p.name] = (tries[p.name] || 0) + 1; failed++;
    }
  }
  await chrome.storage.local.set({ bsab_fitbit_repair_tries: tries });
  console.log("[Boost Auto-Book] repair pass:", JSON.stringify({ candidates: candidates.length, repaired, failed }));
  return { repaired, failed };
}

// Syncs every attended lesson that (a) starts on/after sinceDate, (b) has
// already ended, and (c) hasn't been logged before. History store shape is
// background.js's { months: { "YYYY-MM": { rows: [...] } } }.
async function fitbitSyncLessons(historyStore) {
  const st = await getFitbitState();
  if (!fitbitConnected(st)) return { ok: false, error: st.needsReconnect ? "reconnect required" : "not connected" };

  const store = historyStore || await getHistoryStore();
  const synced = await getFitbitSynced();
  const durationMin = Math.max(5, Number(st.durationMin) || 60);
  const now = Date.now();

  const pending = [];
  Object.values(store.months || {}).forEach(m => (m.rows || []).forEach(rec => {
    if (rec.status !== "attended") return;
    if (!rec.date || !rec.time) return;
    if (st.sinceDate && rec.date < st.sinceDate) return;
    if (synced[fitbitLessonKey(rec)]) return;
    // Only lessons that have finished — logging a live/future window would
    // attribute a partial (or empty) heart-rate stream to it.
    if (studioTimeMs(rec.date, rec.time) + durationMin * 60 * 1000 > now) return;
    pending.push(rec);
  }));
  pending.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  let added = 0, skipped = 0, deferred = 0;
  let error = null;
  for (const rec of pending.slice(0, GH_MAX_LOGS_PER_RUN)) {
    try {
      const startMs = studioTimeMs(rec.date, rec.time);
      const endMs = startMs + durationMin * 60 * 1000;
      // Enrich with the wearable's measurements for the window. Only for
      // reasonably recent lessons — a deep backfill shouldn't burn 4 read
      // calls per ancient lesson.
      let m = { metrics: {}, hasHeartRate: false };
      const ageMs = now - endMs;
      if (ageMs < 30 * 24 * 3600 * 1000) m = await fitbitFetchLessonMetrics(startMs, endMs);
      // Just-ended lesson with no heart-rate data yet → the tracker probably
      // hasn't synced to the Fitbit app. Defer (don't mark synced); the
      // +50min retry alarm / 6h backstop will pick it up with metrics.
      if (!m.hasHeartRate && ageMs < 6 * 3600 * 1000) { deferred++; continue; }
      await fitbitLogLesson(rec, durationMin, m.metrics);
      synced[fitbitLessonKey(rec)] = Date.now();
      added++;
    } catch (e) {
      error = String(e && e.message || e);
      if (e && e.rateLimited) break;       // quota — the rest will go next run
      if (/invalid_grant|Not connected/i.test(error)) break; // auth is dead — stop hammering
      skipped++;                            // per-lesson failure — keep going
    }
  }

  // Prune dedup entries older than ~400 days so the map can't grow forever.
  const cutoff = Date.now() - 400 * 24 * 3600 * 1000;
  Object.keys(synced).forEach(k => { if (synced[k] < cutoff) delete synced[k]; });

  await setFitbitSynced(synced);

  // Heal records whose heart rate the server dropped (see ghPatchExerciseMetrics).
  let repaired = 0;
  try { repaired = (await fitbitRepairMetrics(st)).repaired; }
  catch (e) { console.log("[Boost Auto-Book] repair pass failed:", String(e && e.message || e)); }

  await setFitbitState({ lastSync: { at: Date.now(), added, skipped, deferred, repaired, error } });
  if (added) {
    try { notify("Fitbit sync", `${added} lesson${added === 1 ? "" : "s"} logged as workouts.`); } catch (e) {}
  }
  return { ok: !error, added, skipped, deferred, repaired, pending: Math.max(0, pending.length - added - skipped - deferred), error };
}

// Status snapshot for the popup — never exposes tokens or the client secret.
async function fitbitStatus() {
  const st = await getFitbitState();
  const synced = await getFitbitSynced();
  return {
    connected: fitbitConnected(st),
    needsReconnect: !!st.needsReconnect,
    clientId: st.clientId || "",
    hasClientSecret: !!st.clientSecret,
    connectedAt: st.connectedAt || null,
    sinceDate: st.sinceDate || null,
    durationMin: st.durationMin || 60,
    autoSync: st.autoSync !== false,
    lastSync: st.lastSync || null,
    syncedCount: Object.keys(synced).length,
    redirectUrl: chrome.identity.getRedirectURL()
  };
}
