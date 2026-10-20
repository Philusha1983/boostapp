// Demo data for marketing screenshots. Every shape here is taken verbatim from
// a real `exportState` dump; every value is invented. No real person, class or
// account appears, by construction.
//
// Times are absolute and in Asia/Jerusalem, and render.js pins the page clock to
// DEMO_NOW, so a given view renders byte-identical on every run. They are also
// internally consistent: each slot's openAt is exactly its studio's 72h window
// before the class starts, so the countdown agrees with the dates beside it.
(() => {
  const T = s => new Date(s).getTime();
  const iso = ms => {
    const d = new Date(ms + 3 * 3600000);           // +03:00, the studio's zone
    return d.toISOString().slice(0, 10);
  };

  const DEMO_NOW = T("2026-10-20T10:49:00+03:00");  // a Tuesday morning
  const WINDOW = 72 * 3600000;

  const target = (o) => Object.assign({
    bookedDates: [], classFilter: "", enabled: true, id: "t_demo",
    lastBookedActId: null, lastBookedDate: null, lastResult: null,
    mode: "weekly", recurrence: "weekly", skipDates: [], teacherFilter: "",
  }, o);

  const info = (o) => Object.assign({
    capacity: 16, classId: 10000000, className: "", found: true,
    lastBookedDate: null, lastChecked: DEMO_NOW, movedTo: null, openAt: null,
    recurrence: "weekly", registered: 0, resolvedDate: null, startAt: null,
    status: "waiting", teacher: "",
  }, o);

  // One slot already booked, one 11 minutes from its window opening, one a day
  // out — the three states a rule can be in.
  const tue = T("2026-10-20T19:00:00+03:00");
  const fri = T("2026-10-23T11:00:00+03:00");
  const sat = T("2026-10-24T11:00:00+03:00");

  const targets = [
    target({
      id: "t_demo_1", classFilter: "FLEXIBILITY", time: "19:00", weekday: 2,
      bookedDates: ["2026-09-29", "2026-10-06", "2026-10-13", "2026-10-20"],
      lastBookedDate: "2026-10-20",
      info: info({
        className: "FLEXIBILITY", bookedFor: "2026-10-20", lastBookedDate: "2026-10-20",
        resolvedDate: "2026-10-20", startAt: tue, registered: 11, status: "booked",
      }),
    }),
    target({
      id: "t_demo_2", classFilter: "FUNCTIONAL", time: "11:00", weekday: 5,
      bookedDates: ["2026-10-02", "2026-10-09", "2026-10-16"],
      lastBookedDate: "2026-10-16",
      info: info({
        className: "FUNCTIONAL", resolvedDate: "2026-10-23",
        openAt: fri - WINDOW, startAt: fri, registered: 9, teacher: "Noa",
      }),
    }),
    target({
      id: "t_demo_3", classFilter: "STRENGTH", time: "11:00", weekday: 6,
      bookedDates: ["2026-10-10", "2026-10-17"],
      lastBookedDate: "2026-10-17",
      info: info({
        className: "STRENGTH", resolvedDate: "2026-10-24",
        openAt: sat - WINDOW, startAt: sat, registered: 4, teacher: "Dana",
      }),
    }),
  ];

  window.__BSAB_DEMO_NOW__ = DEMO_NOW;
  window.__BSAB_FIXTURES__ = {
    targets,
    config: {
      lang: "en", theme: "dark", companyNum: "256826", getUrl: "demo",
      autoBook: true, pollMinutes: 1, snipeWindowMin: 5, dailyLimitOverride: 0,
    },
    auth: { loggedIn: true, checkedAt: DEMO_NOW, reason: "demo" },
    client: { clientId: "demo", companyNum: "256826", name: "Member", photo: null, syncedAt: DEMO_NOW },
    // items[] with a `monthly` quota — subBadgeText() reads remaining/max off it
    subscription: {
      items: [{ name: "Monthly", monthly: { remaining: 5, max: 13 }, isFrozen: false, validUntil: "2026-11-09" }],
      syncedAt: DEMO_NOW, source: "page",
    },
    registrations: {
      items: [{
        className: "FLEXIBILITY", date: "2026-10-20", time: "19:00", startAt: tue,
        bookingActId: 129103430,
        teacher: "Dana",
        // `cancellation` arrives pre-formatted from the studio page, so it is a
        // string here rather than a value the popup formats.
        cancellation: "Can be cancelled until 20/10 at 18:00",
      }],
      syncedAt: DEMO_NOW,
    },
    // Month projection behind the "N booked · M scheduled" chip on each card.
    plan: { byRule: {
      t_demo_1: [{ status: "booked" }, ...Array(6).fill({ status: "scheduled" })],
      t_demo_2: Array(6).fill({ status: "scheduled" }),
      t_demo_3: Array(6).fill({ status: "scheduled" }),
    } },
    studioWindow: { hours: 72, source: "schedule" },
  };
})();
