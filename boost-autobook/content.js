/* Boost Auto-Book — content script (runs on the BoostApp Home page)
 *
 * This is the source of truth for sign-in + your data. While you're on the
 * Home page (where you're definitely authenticated), it:
 *   1. reads your client id from #clientHeaderId  -> proves you're signed in
 *   2. fetches your active subscription + balance via the API (in-page, with
 *      your session cookie)  -> reliable, no background guessing
 *   3. reads your upcoming registrations from the rendered widget
 * then sends everything to the background to cache for the popup.
 */
(() => {
  const API = "/controllerAction/OrderClasses.php";
  const ACT_API = "/controllerAction/ClientActivity.php";
  const TEXT = (el) => (el ? el.innerText.replace(/\s+/g, " ").trim() : "");

  function readClient() {
    const h = document.getElementById("clientHeaderId");
    if (!h || !h.dataset.id) return null;
    const nameEl = h.querySelector("span") || document.querySelector(".userNameBox span");
    const photoEl = document.querySelector('.imgBox img[alt="user"]') || document.querySelector(".iconsCon .imgBox img");
    return {
      clientId: h.dataset.id,
      companyNum: h.dataset.companynum || h.dataset.companyNum || null,
      name: nameEl ? nameEl.textContent.trim() : null,
      photo: photoEl ? photoEl.src : null
    };
  }

  async function fetchSubscriptions(client) {
    try {
      const r = await fetch(ACT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "getClientActivitiesForHomePage",
          companyNum: Number(client.companyNum),
          clientId: Number(client.clientId),
          getAllSubscriptions: true
        })
      }).then(r => r.json());
      const data = (r && r.data) || [];
      return data.map(s => ({
        id: s.id, itemId: s.itemId, name: s.name, shortName: s.shortName,
        startDate: s.startDate, endDate: s.endDate, isFrozen: s.isFrozen,
        renewText: s.hokRenewDateText, renewDate: s.hokRenewDate,
        monthly: (s.limits && s.limits.monthly) ? {
          max: s.limits.monthly.max, use: s.limits.monthly.use,
          remaining: s.limits.monthly.remaining, text: s.limits.monthly.text
        } : null,
        daily: (s.limits && s.limits.daily) ? { max: s.limits.daily.max, text: s.limits.daily.text } : null
      }));
    } catch (e) { return null; }
  }

  function readEvents() {
    const c = document.querySelector(".client-booked__events__container");
    if (!c) return { empty: true, items: [] };
    if (c.classList.contains("client-booked__events__empty-container")) return { empty: true, items: [] };
    const items = [...document.querySelectorAll(".client-booked__event__item")].map(el => {
      const cancelBtn = el.querySelector(".js--class-cancel-with-new-model, .event__item--buttons-content button, .event__item--buttons-content .theme--btn");
      const dateText = TEXT(el.querySelector(".item--date"));
      // parse "...DD/MM ... HH:MM" into a sortable timestamp (for the icon tooltip)
      let startAt = null, time = null;
      const m = dateText.match(/(\d{1,2})\/(\d{1,2}).*?(\d{1,2}):(\d{2})/);
      if (m) {
        const dd = +m[1], mm = +m[2], HH = +m[3], MM = +m[4];
        time = String(HH).padStart(2, "0") + ":" + String(MM).padStart(2, "0");
        const now = new Date();
        let dt = new Date(now.getFullYear(), mm - 1, dd, HH, MM);
        if (dt.getTime() < now.getTime() - 60 * 864e5) dt = new Date(now.getFullYear() + 1, mm - 1, dd, HH, MM); // year rollover
        startAt = dt.getTime();
      }
      return {
        className: TEXT(el.querySelector(".item--title")) || null,
        teacher: TEXT(el.querySelector(".item--guide")) || null,
        date: dateText || null,
        time, startAt,
        cancellation: TEXT(el.querySelector(".item-note")) || null,
        classId: el.dataset.classid || el.dataset.classId || null,
        bookingActId: cancelBtn ? (cancelBtn.dataset.classid || cancelBtn.dataset.classId || null) : null,
        text: TEXT(el).slice(0, 200)
      };
    });
    return { empty: items.length === 0, items };
  }

  // The events widget renders only AFTER its XHR returns, so its container is
  // absent until then. We only trust an events read once the container exists.
  function eventsRendered() { return !!document.querySelector(".client-booked__events__container"); }

  async function syncNow(eventsReady) {
    const client = readClient();
    const loggedIn = !!client;                 // #clientHeaderId only renders when signed in
    let subscriptions = null;
    if (client) subscriptions = await fetchSubscriptions(client);
    const payload = {
      loggedIn,
      client,
      subscriptions,
      // Only include events when the widget has rendered — otherwise the
      // background must NOT overwrite the cached list with a premature empty.
      events: eventsReady ? readEvents() : null,
      eventsReady: !!eventsReady,
      syncedAt: Date.now()
    };
    try { chrome.runtime.sendMessage({ cmd: "syncFromPage", payload }); } catch (e) {}
  }

  // Wait until the events widget has actually rendered (container present),
  // then a short settle for its items to populate, before syncing. Generous
  // timeout because background/hidden tabs are throttled — and because after
  // a long idle period the site's own JS may need extra time to restore the
  // session before #clientHeaderId renders. Giving up too early made this
  // report "signed out" while auto-login was still in progress, which fed
  // the background a false negative (the "short ping" problem).
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (eventsRendered()) {
      clearInterval(timer);
      setTimeout(() => syncNow(true), 700);   // let items inside the container render
    } else if (tries > 60) {                  // ~30s: give up waiting for events
      clearInterval(timer);
      syncNow(false);                          // still sync client+subscription, but not events
    }
  }, 500);
})();
