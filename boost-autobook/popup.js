/* Boost Auto-Book — popup UI controller (with EN/HE i18n + RTL) */

// Mobile layout: apply full-width styling only on phones (reliable UA check).
// A CSS media query is unreliable here because an extension popup's viewport width
// is inconsistent across desktop/mobile — so we flag it in JS instead.
(function detectMobile() {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "")) {
    document.documentElement.classList.add("mobile");
    if (!document.querySelector('meta[name="viewport"]')) {
      const m = document.createElement("meta");
      m.name = "viewport"; m.content = "width=device-width, initial-scale=1";
      document.head.appendChild(m);
    }
  }
})();

// Full-page mode: the same popup document opened as a browser tab via the ⛶
// header button (popup.html?page=1). All logic is shared; only CSS changes.
(function detectFullPage() {
  if (new URLSearchParams(location.search).get("page") === "1") {
    document.documentElement.classList.add("fullpage");
  }
})();

const $ = (id) => document.getElementById(id);
function send(msg) { return new Promise(res => chrome.runtime.sendMessage(msg, res)); }

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------
let LANG = "en";
const RTL_LANGS = ["he", "ar"];
const WDFULL = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  he: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
  ru: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
  uk: ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"],
  ar: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
};
const WDSHORT = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  he: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת"],
  ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
  uk: ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
  ar: ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
};
const I18N = {
  en: {
    tab_upcoming: "Upcoming", tab_schedule: "Weekly schedule", tab_slots: "My weekly slots",
    tab_subscription: "Subscription", tab_settings: "Settings",
    fb_title: "Fitbit sync",
    fb_hint: "Logs attended lessons to Fitbit as workouts — automatically, a few minutes after each lesson ends. Fitbit pairs them with your tracker's heart-rate data and syncs them to Health Connect. The date below only limits how far back to backfill.",
    fb_client: "Google OAuth Client ID", fb_secret: "Client Secret",
    fb_connect: "Connect Fitbit", fb_disconnect: "Disconnect",
    fb_duration: "Lesson length (minutes)", fb_since: "Sync lessons from (date)",
    fb_auto: "Sync automatically", fb_sync_now: "Sync now", fb_syncing: "Syncing…",
    fb_connected: "✅ Connected (Google Health API)", fb_not_connected: "Not connected",
    fb_reconnect: "⚠️ Access expired — reconnect below (Google Testing-mode tokens last 7 days)",
    fb_setup_hint: "In console.cloud.google.com: enable the Google Health API, create an OAuth client (Web application) with redirect URI {url}, add yourself as a test user with the activity_and_fitness.writeonly scope, then paste the Client ID + Secret here.",
    fb_last_sync: "Last sync: {when} — {added} added", fb_synced_total: "{n} lessons synced so far",
    fb_sync_error: "⚠️ Last sync error: {err}",
    hint_upcoming: "Your booked lessons. Expand for participants and lesson content.",
    hint_upcoming_week: "Your booked lessons, laid out by weekday.",
    hint_schedule: "Tick the slots you want — the extension books them every week when registration opens.",
    autobook: "Auto-book", autobookOn: "On", autobookOff: "Off",
    autobookOnMsg: "✅ Auto-book ON — slots are booked automatically the moment they open.",
    autobookOffMsg: "⏸️ Auto-book OFF — nothing is booked automatically. Use “Book now” per slot.",
    slotsAutoOff: "⏸️ Auto-book is off — these slots won't be booked automatically.", turnOn: "Turn on",
    disabledHint: "Turn on auto-book to use this",
    refresh: "↻ Refresh", refreshing: "↻ Refreshing…", openHistory: "📊 History",
    viewList: "List view", viewWeek: "Week view", viewPeriod: "Period view", openFullPage: "Open as full page",
    period_range: "{start} – {end}", period_bank: "{rem}/{max} left in plan",
    period_last: "Last lesson locked in: {date}", period_last_none: "No lessons locked in yet",
    period_leftover_warn: "⚠️ {n} left unscheduled — book before {date}",
    period_attended: "{n} attended so far",
    period_external: "Booked on BoostApp",
    dp_none: "No classes found for this day.", dp_add: "Add", dp_scheduled: "Added", dp_addHint: "Add a lesson",
    hist_attended: "Attended", hist_lateCancel: "Late cancel", hist_cancelled: "Cancelled", hist_noShow: "No-show", hist_other: "Other",
    checkNow: "Check now", checking: "Checking…", saveSettings: "Save settings", settingsSaved: "Settings saved",
    scheduleLessons: "Schedule lessons +", closeScheduler: "Close scheduler ✕",
    lbl_lang: "Language", lbl_theme: "Theme", theme_system: "System", theme_light: "Light", theme_dark: "Dark",
    lbl_backup: "Backup / transfer slots", backup_hint: "Export your slots & settings to move them to another browser, or paste/upload a backup to import.",
    export: "Export", import: "Import", download: "Download file",
    exportedToast: "Exported — copied to clipboard", importedToast: "Imported {n} slots", importFail: "Couldn't read that backup",
    lbl_company: "Company #", lbl_token: "Studio token (GetUrl)",
    lbl_poll: "Poll every (minutes)", lbl_snipe: "Snipe lead (minutes)", lbl_daily: "Daily limit (0 = auto from plan)",
    settings_note: "Daily limit only controls the local warning — the studio's server still enforces your real per-day allowance. You must be signed in to BoostApp in this Chrome profile. The extension cannot register before the studio's 72h window opens — it fires the instant it does.",
    status_open: "OPEN", status_waiting: "Scheduled", status_full: "FULL", status_passed: "Past",
    "status_not-found": "Not found", status_done: "Done", status_none: "No upcoming",
    every: "Every {day}", once: "Once {day}", anyClass: "Any class",
    bookNow: "Book now", booking: "Booking…", makeWeekly: "↻ Make weekly", onceOnly: "1× Make one-time",
    skip: "Skip {date}", pause: "Pause", resume: "Resume", remove: "Remove",
    participants: "👥 Participants", lessonInfo: "📋 Lesson info",
    cancelLesson: "Cancel lesson", cancelling: "Cancelling…", cancelOnSite: "cancel on BoostApp",
    noSlots: "No slots yet. Tick the ones you want in the weekly schedule.",
    checkingDots: "checking…", bookingNow: "booking now…", fullAtOpen: "full at open time",
    bookedOn: "✅ booked {date}", alreadyReg: "ℹ️ already registered ({date})",
    status_booked: "Booked", bookedFor: "✅ booked for {date}", notPublished: "🗓️ next: {date} (not published yet)",
    planTitle: "Plan this month", planSkip: "Skip", planUnskip: "Unskip", planCancel: "Cancel",
    plan_scheduled: "Scheduled", plan_skipped: "Skipped", plan_limit: "⛔ limit reached", plan_daily: "⛔ 2nd/day",
    planNote: "Projection — may change with cancellations", planEmpty: "No occurrences this period",
    period_next_note: "🔮 {start}–{end} shown as a preview — assumes your plan renews", period_preview_tag: "next period preview",
    roll_booked: "{n} booked", roll_scheduled: "{n} scheduled",
    limitSkipped: "⚠️ limit hit — skipped {date}", paused: "paused",
    opensAt: "⏰ {date} · opens {clock} ({rel})",
    noSubscription: "No subscription synced yet. Open BoostApp once to sync.",
    monthlyLeft: "Monthly: {r}/{m} left", dailyCap: "Daily cap: {n}", validUntil: "Valid until {d}",
    frozen: "❄️ frozen", balanceUsed: "Monthly balance used up", subDefault: "Subscription",
    sub_balance: "Balance", sub_bonusTag: "🎁 Bonus", sub_bonusN: "+{n} bonus", sub_entriesLeft: "{n} left",
    syncedAgo: "synced {t}", live: " (live)", fromPage: "synced {t} · from BoostApp page",
    registeredCount: "Registered {r}/{m}", noNames: "no names available", waitlist: "Waitlist ({n})",
    loading: "loading…", couldNotLoad: "could not load", noDetails: "no lesson details provided",
    noUpcoming: "No upcoming registrations.", openHomeSync: "Open BoostApp Home once to sync your registrations.",
    couldNotSchedule: "Could not load schedule.",
    noClasses: "No classes found. Check Settings (company/token) and that you can reach BoostApp.",
    selectedClasses: "{sel} selected · {n} classes", nClasses: "{n} classes",
    adding: "Adding…", bookedToast: "✅ Booked! {cls} · {date}",
    alreadyToast: "ℹ️ You're already registered for this class",
    limitToast: "⚠️ Subscription limit — you likely already have a lesson that day",
    openNeedAuto: "Open now — turn on Auto-book or use “Book now”", openBooking: "Open — booking now…",
    fullToast: "⚠️ Class is full at open time", scheduledToast: "Scheduled — opens {clock}",
    addedToast: "Added to My slots", dayNote: "  ·  note: your plan allows {n}/day",
    signedIn: "✅ Signed in to BoostApp", checkingSignin: "Checking sign-in…",
    hdrSignedIn: "Signed in", hdrNotSignedIn: "Not signed in", hdrNotSynced: "Open Home to sync",
    soTitle: "Not signed in to BoostApp", soText: "Open BoostApp and sign in to load your lessons, weekly slots and subscription.", soCta: "Open BoostApp to sign in",
    notSynced: "⚠️ Not synced yet — open BoostApp Home", notSignedIn: "⚠️ Not signed in — auto-booking is paused",
    recheck: "Re-check", openHome: "Open Home", done: "Done ✅", failed: "Failed",
    never: "never", justNow: "just now", minAgo: "{m}m ago", hourAgo: "{h}h ago", dayAgo: "{d}d ago",
    relNow: "now", relDays: "in {d}d {h}h", relHours: "in {h}h {m}m", relMin: "in {m}m"
  },
  he: {
    tab_upcoming: "שיעורים קרובים", tab_schedule: "מערכת שבועית", tab_slots: "השיעורים השבועיים שלי",
    tab_subscription: "המנוי שלי", tab_settings: "הגדרות",
    hint_upcoming: "השיעורים שהזמנת. הרחב לרשימת משתתפים ותוכן השיעור.",
    hint_upcoming_week: "השיעורים שהזמנת, מסודרים לפי ימי השבוע.",
    hint_schedule: "סמן את המשבצות הרצויות — התוסף יזמין אותן בכל שבוע כשההרשמה נפתחת.",
    autobook: "הזמנה אוטומטית", autobookOn: "פעיל", autobookOff: "כבוי",
    autobookOnMsg: "✅ הזמנה אוטומטית פעילה — שיעורים יוזמנו אוטומטית ברגע שנפתחים.",
    autobookOffMsg: "⏸️ הזמנה אוטומטית כבויה — דבר לא יוזמן אוטומטית. השתמש ב“הזמן עכשיו”.",
    slotsAutoOff: "⏸️ הזמנה אוטומטית כבויה — המשבצות לא יוזמנו אוטומטית.", turnOn: "הפעל",
    disabledHint: "הפעל הזמנה אוטומטית כדי להשתמש",
    refresh: "↻ רענן", refreshing: "↻ מרענן…", openHistory: "📊 היסטוריה",
    viewList: "תצוגת רשימה", viewWeek: "תצוגת שבוע", viewPeriod: "תצוגת תקופה", openFullPage: "פתיחה במסך מלא",
    period_range: "{start} – {end}", period_bank: "{rem}/{max} נותרו במנוי",
    period_last: "השיעור האחרון שנקבע: {date}", period_last_none: "טרם נקבע שיעור",
    period_leftover_warn: "⚠️ נותרו {n} שלא תוזמנו — הזמן/י לפני {date}",
    period_attended: "{n} נוצלו עד כה",
    period_external: "הוזמן ב-BoostApp",
    dp_none: "לא נמצאו שיעורים ליום זה.", dp_add: "הוסף", dp_scheduled: "נוסף", dp_addHint: "הוסף שיעור",
    hist_attended: "נכחת", hist_lateCancel: "ביטול מאוחר", hist_cancelled: "בוטל", hist_noShow: "לא הגעת", hist_other: "אחר",
    checkNow: "בדוק עכשיו", checking: "בודק…", saveSettings: "שמור הגדרות", settingsSaved: "ההגדרות נשמרו",
    scheduleLessons: "תזמון שיעורים +", closeScheduler: "סגור מתזמן ✕",
    lbl_lang: "שפה", lbl_theme: "ערכת נושא", theme_system: "מערכת", theme_light: "בהיר", theme_dark: "כהה",
    lbl_backup: "גיבוי / העברת משבצות", backup_hint: "ייצא את המשבצות וההגדרות כדי להעביר לדפדפן אחר, או הדבק/העלה גיבוי לייבוא.",
    export: "ייצוא", import: "ייבוא", download: "הורדת קובץ",
    exportedToast: "יוצא — הועתק ללוח", importedToast: "יובאו {n} משבצות", importFail: "לא ניתן לקרוא את הגיבוי",
    lbl_company: "מספר חברה", lbl_token: "מזהה סטודיו (GetUrl)",
    lbl_poll: "תדירות בדיקה (דקות)", lbl_snipe: "מרווח לפני פתיחה (דקות)", lbl_daily: "מגבלה יומית (0 = אוטומטי מהמנוי)",
    settings_note: "המגבלה היומית משפיעה רק על ההתראה המקומית — שרת הסטודיו עדיין אוכף את המכסה היומית האמיתית שלך. יש להיות מחובר ל-BoostApp בפרופיל Chrome הזה. התוסף אינו יכול להירשם לפני פתיחת חלון 72 השעות — הוא פועל ברגע שהוא נפתח.",
    status_open: "פתוח", status_waiting: "מתוזמן", status_full: "מלא", status_passed: "עבר",
    "status_not-found": "לא נמצא", status_done: "הושלם", status_none: "אין קרוב",
    every: "כל יום {day}", once: "פעם אחת — {day}", anyClass: "כל שיעור",
    bookNow: "הזמן עכשיו", booking: "מזמין…", makeWeekly: "↻ הפוך לשבועי", onceOnly: "1× הפוך לחד-פעמי",
    skip: "דלג {date}", pause: "השהה", resume: "המשך", remove: "הסר",
    participants: "👥 משתתפים", lessonInfo: "📋 פרטי השיעור",
    cancelLesson: "בטל הרשמה", cancelling: "מבטל…", cancelOnSite: "ביטול באתר",
    noSlots: "אין משבצות עדיין. סמן את הרצויות במערכת השבועית.",
    checkingDots: "בודק…", bookingNow: "מזמין עכשיו…", fullAtOpen: "מלא בזמן הפתיחה",
    bookedOn: "✅ הוזמן {date}", alreadyReg: "ℹ️ כבר רשום ({date})",
    status_booked: "הוזמן", bookedFor: "✅ הוזמן ל-{date}", notPublished: "🗓️ הבא: {date} (טרם פורסם)",
    planTitle: "תכנון החודש", planSkip: "דלג", planUnskip: "בטל דילוג", planCancel: "בטל",
    plan_scheduled: "מתוזמן", plan_skipped: "דולג", plan_limit: "⛔ הגעת למכסה", plan_daily: "⛔ שני ביום",
    planNote: "תחזית — עשוי להשתנות עקב ביטולים", planEmpty: "אין מופעים בתקופה זו",
    period_next_note: "🔮 {start}–{end} מוצג כתצוגה מקדימה — בהנחה שהמנוי יתחדש", period_preview_tag: "תצוגה מקדימה לתקופה הבאה",
    roll_booked: "{n} הוזמנו", roll_scheduled: "{n} מתוזמנים",
    limitSkipped: "⚠️ מגבלה — דולג {date}", paused: "מושהה",
    opensAt: "⏰ {date} · נפתח {clock} ({rel})",
    noSubscription: "אין מנוי מסונכרן. פתח את BoostApp לסנכרון.",
    monthlyLeft: "חודשי: נותרו {r}/{m}", dailyCap: "מגבלה יומית: {n}", validUntil: "בתוקף עד {d}",
    frozen: "❄️ מוקפא", balanceUsed: "המכסה החודשית נוצלה", subDefault: "מנוי",
    sub_balance: "יתרה", sub_bonusTag: "🎁 בונוס", sub_bonusN: "+{n} בונוס", sub_entriesLeft: "נותרו {n}",
    syncedAgo: "סונכרן {t}", live: " (חי)", fromPage: "סונכרן {t} · מדף BoostApp",
    registeredCount: "רשומים {r}/{m}", noNames: "אין שמות זמינים", waitlist: "רשימת המתנה ({n})",
    loading: "טוען…", couldNotLoad: "טעינה נכשלה", noDetails: "אין פרטי שיעור",
    noUpcoming: "אין הרשמות קרובות.", openHomeSync: "פתח את דף הבית של BoostApp לסנכרון ההרשמות.",
    couldNotSchedule: "טעינת המערכת נכשלה.",
    noClasses: "לא נמצאו שיעורים. בדוק הגדרות (חברה/מזהה) וחיבור ל-BoostApp.",
    selectedClasses: "{sel} נבחרו · {n} שיעורים", nClasses: "{n} שיעורים",
    adding: "מוסיף…", bookedToast: "✅ הוזמן! {cls} · {date}",
    alreadyToast: "ℹ️ אתה כבר רשום לשיעור הזה",
    limitToast: "⚠️ מגבלת מנוי — כנראה כבר יש לך שיעור באותו יום",
    openNeedAuto: "פתוח עכשיו — הפעל הזמנה אוטומטית או \"הזמן עכשיו\"", openBooking: "פתוח — מזמין עכשיו…",
    fullToast: "⚠️ השיעור מלא בזמן הפתיחה", scheduledToast: "מתוזמן — נפתח {clock}",
    addedToast: "נוסף למשבצות שלי", dayNote: "  ·  הערה: המנוי שלך מאפשר {n} ביום",
    signedIn: "✅ מחובר ל-BoostApp", checkingSignin: "בודק התחברות…",
    hdrSignedIn: "מחובר", hdrNotSignedIn: "לא מחובר", hdrNotSynced: "פתח דף בית לסנכרון",
    soTitle: "לא מחובר ל-BoostApp", soText: "פתח את BoostApp והתחבר כדי לטעון את השיעורים, המשבצות השבועיות והמנוי שלך.", soCta: "פתח את BoostApp להתחברות",
    notSynced: "⚠️ לא סונכרן — פתח את דף הבית של BoostApp", notSignedIn: "⚠️ לא מחובר — ההזמנה האוטומטית מושהית",
    recheck: "בדוק שוב", openHome: "פתח דף בית", done: "בוצע ✅", failed: "נכשל",
    never: "אף פעם", justNow: "כעת", minAgo: "לפני {m} ד׳", hourAgo: "לפני {h} ש׳", dayAgo: "לפני {d} ימים",
    relNow: "עכשיו", relDays: "בעוד {d} ימים {h} ש׳", relHours: "בעוד {h} ש׳ {m} ד׳", relMin: "בעוד {m} ד׳"
  },
  ru: {
    tab_upcoming: "Ближайшие", tab_schedule: "Расписание", tab_slots: "Мои недельные слоты",
    tab_subscription: "Абонемент", tab_settings: "Настройки",
    hint_upcoming: "Ваши записи на занятия. Разверните для списка участников и описания.",
    hint_upcoming_week: "Ваши записи, разложенные по дням недели.",
    hint_schedule: "Отметьте нужные слоты — расширение бронирует их каждую неделю при открытии записи.",
    autobook: "Авто-запись", autobookOn: "Вкл", autobookOff: "Выкл",
    autobookOnMsg: "✅ Авто-запись включена — места бронируются автоматически при открытии.",
    autobookOffMsg: "⏸️ Авто-запись выключена — ничего не бронируется автоматически. Жмите «Записаться».",
    slotsAutoOff: "⏸️ Авто-запись выключена — эти слоты не бронируются автоматически.", turnOn: "Включить",
    disabledHint: "Включите авто-запись, чтобы использовать",
    refresh: "↻ Обновить", refreshing: "↻ Обновление…", openHistory: "📊 История",
    viewList: "Список", viewWeek: "Неделя", viewPeriod: "Период", openFullPage: "Открыть на весь экран",
    period_range: "{start} – {end}", period_bank: "{rem}/{max} осталось в абонементе",
    period_last: "Последнее запланированное занятие: {date}", period_last_none: "Пока ничего не запланировано",
    period_leftover_warn: "⚠️ Осталось {n} незапланированных — забронируйте до {date}",
    period_attended: "Посещено {n}",
    period_external: "Забронировано в BoostApp",
    dp_none: "На этот день занятий не найдено.", dp_add: "Добавить", dp_scheduled: "Добавлено", dp_addHint: "Добавить занятие",
    hist_attended: "Посетили", hist_lateCancel: "Позднее отмен.", hist_cancelled: "Отменено", hist_noShow: "Неявка", hist_other: "Другое",
    checkNow: "Проверить", checking: "Проверка…", saveSettings: "Сохранить", settingsSaved: "Настройки сохранены",
    scheduleLessons: "Запланировать +", closeScheduler: "Закрыть планировщик ✕",
    lbl_lang: "Язык", lbl_theme: "Тема", theme_system: "Системная", theme_light: "Светлая", theme_dark: "Тёмная",
    lbl_backup: "Резервная копия / перенос", backup_hint: "Экспортируйте слоты и настройки для переноса в другой браузер или вставьте/загрузите резервную копию для импорта.",
    export: "Экспорт", import: "Импорт", download: "Скачать файл",
    exportedToast: "Экспортировано — скопировано в буфер", importedToast: "Импортировано слотов: {n}", importFail: "Не удалось прочитать резервную копию",
    lbl_company: "Номер компании", lbl_token: "Токен студии (GetUrl)",
    lbl_poll: "Проверять каждые (мин)", lbl_snipe: "Запас перед открытием (мин)", lbl_daily: "Дневной лимит (0 = из абонемента)",
    settings_note: "Дневной лимит влияет только на локальное предупреждение — сервер студии всё равно применяет ваш реальный дневной лимит. Нужно войти в BoostApp в этом профиле Chrome. Расширение не может записать до открытия окна 72 ч — оно срабатывает в момент открытия.",
    status_open: "ОТКРЫТО", status_waiting: "Запланировано", status_full: "ПОЛНО", status_passed: "Прошло",
    "status_not-found": "Не найдено", status_done: "Готово", status_none: "Нет ближайших",
    every: "Каждый {day}", once: "Один раз — {day}", anyClass: "Любое занятие",
    bookNow: "Записаться", booking: "Запись…", makeWeekly: "↻ Сделать еженедельным", onceOnly: "1× Сделать разовым",
    skip: "Пропустить {date}", pause: "Пауза", resume: "Возобновить", remove: "Удалить",
    participants: "👥 Участники", lessonInfo: "📋 Описание",
    cancelLesson: "Отменить запись", cancelling: "Отмена…", cancelOnSite: "отмена в BoostApp",
    noSlots: "Пока нет слотов. Отметьте нужные в расписании.",
    checkingDots: "проверка…", bookingNow: "запись…", fullAtOpen: "полно при открытии",
    bookedOn: "✅ записано {date}", alreadyReg: "ℹ️ уже записаны ({date})",
    status_booked: "Забронировано", bookedFor: "✅ забронировано на {date}", notPublished: "🗓️ след.: {date} (ещё не опубликовано)",
    planTitle: "План на месяц", planSkip: "Пропустить", planUnskip: "Вернуть", planCancel: "Отменить",
    plan_scheduled: "Запланировано", plan_skipped: "Пропущено", plan_limit: "⛔ лимит исчерпан", plan_daily: "⛔ 2-е за день",
    planNote: "Прогноз — может измениться из-за отмен", planEmpty: "Нет занятий в этом периоде",
    period_next_note: "🔮 {start}–{end} показано как предпросмотр — предполагается продление абонемента", period_preview_tag: "предпросмотр следующего периода",
    roll_booked: "{n} забронир.", roll_scheduled: "{n} заплан.",
    limitSkipped: "⚠️ лимит — пропущено {date}", paused: "пауза",
    opensAt: "⏰ {date} · открытие {clock} ({rel})",
    noSubscription: "Абонемент не синхронизирован. Откройте BoostApp.",
    monthlyLeft: "В месяц: осталось {r}/{m}", dailyCap: "Лимит в день: {n}", validUntil: "Действует до {d}",
    frozen: "❄️ заморожен", balanceUsed: "Месячный лимит исчерпан", subDefault: "Абонемент",
    sub_balance: "Баланс", sub_bonusTag: "🎁 Бонус", sub_bonusN: "+{n} бонус", sub_entriesLeft: "осталось {n}",
    syncedAgo: "синхр. {t}", live: " (вживую)", fromPage: "синхр. {t} · со страницы BoostApp",
    registeredCount: "Записано {r}/{m}", noNames: "имена недоступны", waitlist: "Лист ожидания ({n})",
    loading: "загрузка…", couldNotLoad: "не удалось загрузить", noDetails: "нет описания занятия",
    noUpcoming: "Нет ближайших записей.", openHomeSync: "Откройте главную BoostApp для синхронизации.",
    couldNotSchedule: "Не удалось загрузить расписание.",
    noClasses: "Занятия не найдены. Проверьте настройки и подключение к BoostApp.",
    selectedClasses: "{sel} выбрано · {n} занятий", nClasses: "{n} занятий",
    adding: "Добавление…", bookedToast: "✅ Записано! {cls} · {date}",
    alreadyToast: "ℹ️ Вы уже записаны на это занятие",
    limitToast: "⚠️ Лимит абонемента — вероятно, у вас уже есть занятие в этот день",
    openNeedAuto: "Открыто — включите Авто-запись или нажмите «Записаться»", openBooking: "Открыто — выполняется запись…",
    fullToast: "⚠️ Занятие заполнено при открытии", scheduledToast: "Запланировано — открытие {clock}",
    addedToast: "Добавлено в Мои занятия", dayNote: "  ·  примечание: ваш план разрешает {n}/день",
    signedIn: "✅ Вход в BoostApp выполнен", checkingSignin: "Проверка входа…",
    hdrSignedIn: "Вы вошли", hdrNotSignedIn: "Не вошли", hdrNotSynced: "Откройте Home",
    soTitle: "Вы не вошли в BoostApp", soText: "Откройте BoostApp и войдите, чтобы загрузить занятия, слоты и абонемент.", soCta: "Открыть BoostApp для входа",
    notSynced: "⚠️ Не синхронизировано — откройте главную BoostApp", notSignedIn: "⚠️ Вход не выполнен — авто-запись приостановлена",
    recheck: "Проверить", openHome: "Открыть главную", done: "Готово ✅", failed: "Ошибка",
    never: "никогда", justNow: "только что", minAgo: "{m} мин назад", hourAgo: "{h} ч назад", dayAgo: "{d} дн назад",
    relNow: "сейчас", relDays: "через {d}д {h}ч", relHours: "через {h}ч {m}м", relMin: "через {m}м"
  },
  uk: {
    tab_upcoming: "Найближчі", tab_schedule: "Розклад", tab_slots: "Мої тижневі слоти",
    tab_subscription: "Абонемент", tab_settings: "Налаштування",
    hint_upcoming: "Ваші записи на заняття. Розгорніть для списку учасників та опису.",
    hint_upcoming_week: "Ваші записи, розкладені за днями тижня.",
    hint_schedule: "Позначте потрібні слоти — розширення бронює їх щотижня, коли відкривається запис.",
    autobook: "Авто-запис", autobookOn: "Увімк", autobookOff: "Вимк",
    autobookOnMsg: "✅ Авто-запис увімкнено — місця бронюються автоматично при відкритті.",
    autobookOffMsg: "⏸️ Авто-запис вимкнено — нічого не бронюється автоматично. Тисніть «Записатися».",
    slotsAutoOff: "⏸️ Авто-запис вимкнено — ці слоти не бронюються автоматично.", turnOn: "Увімкнути",
    disabledHint: "Увімкніть авто-запис, щоб використовувати",
    refresh: "↻ Оновити", refreshing: "↻ Оновлення…", openHistory: "📊 Історія",
    viewList: "Список", viewWeek: "Тиждень", viewPeriod: "Період", openFullPage: "Відкрити на весь екран",
    period_range: "{start} – {end}", period_bank: "{rem}/{max} залишилось в абонементі",
    period_last: "Останнє заплановане заняття: {date}", period_last_none: "Поки нічого не заплановано",
    period_leftover_warn: "⚠️ Залишилось {n} незапланованих — забронюйте до {date}",
    period_attended: "Відвідано {n}",
    period_external: "Заброньовано в BoostApp",
    dp_none: "На цей день занять не знайдено.", dp_add: "Додати", dp_scheduled: "Додано", dp_addHint: "Додати заняття",
    hist_attended: "Відвідано", hist_lateCancel: "Пізнє скасув.", hist_cancelled: "Скасовано", hist_noShow: "Неявка", hist_other: "Інше",
    checkNow: "Перевірити", checking: "Перевірка…", saveSettings: "Зберегти", settingsSaved: "Налаштування збережено",
    scheduleLessons: "Запланувати +", closeScheduler: "Закрити планувальник ✕",
    lbl_lang: "Мова", lbl_theme: "Тема", theme_system: "Системна", theme_light: "Світла", theme_dark: "Темна",
    lbl_backup: "Резервна копія / перенесення", backup_hint: "Експортуйте слоти та налаштування для перенесення в інший браузер або вставте/завантажте резервну копію для імпорту.",
    export: "Експорт", import: "Імпорт", download: "Завантажити файл",
    exportedToast: "Експортовано — скопійовано в буфер", importedToast: "Імпортовано слотів: {n}", importFail: "Не вдалося прочитати резервну копію",
    lbl_company: "Номер компанії", lbl_token: "Токен студії (GetUrl)",
    lbl_poll: "Перевіряти кожні (хв)", lbl_snipe: "Запас перед відкриттям (хв)", lbl_daily: "Денний ліміт (0 = з абонемента)",
    settings_note: "Денний ліміт впливає лише на локальне попередження — сервер студії все одно застосовує ваш реальний денний ліміт. Потрібно увійти в BoostApp у цьому профілі Chrome. Розширення не може записати до відкриття вікна 72 год — воно спрацьовує в момент відкриття.",
    status_open: "ВІДКРИТО", status_waiting: "Заплановано", status_full: "ПОВНО", status_passed: "Минуло",
    "status_not-found": "Не знайдено", status_done: "Готово", status_none: "Немає найближчих",
    every: "Щотижня — {day}", once: "Один раз — {day}", anyClass: "Будь-яке заняття",
    bookNow: "Записатися", booking: "Запис…", makeWeekly: "↻ Зробити щотижневим", onceOnly: "1× Зробити одноразовим",
    skip: "Пропустити {date}", pause: "Пауза", resume: "Відновити", remove: "Видалити",
    participants: "👥 Учасники", lessonInfo: "📋 Опис",
    cancelLesson: "Скасувати запис", cancelling: "Скасування…", cancelOnSite: "скасування в BoostApp",
    noSlots: "Поки немає слотів. Позначте потрібні в розкладі.",
    checkingDots: "перевірка…", bookingNow: "запис…", fullAtOpen: "повно при відкритті",
    bookedOn: "✅ записано {date}", alreadyReg: "ℹ️ вже записані ({date})",
    status_booked: "Заброньовано", bookedFor: "✅ заброньовано на {date}", notPublished: "🗓️ наст.: {date} (ще не опубліковано)",
    planTitle: "План на місяць", planSkip: "Пропустити", planUnskip: "Повернути", planCancel: "Скасувати",
    plan_scheduled: "Заплановано", plan_skipped: "Пропущено", plan_limit: "⛔ ліміт вичерпано", plan_daily: "⛔ 2-е за день",
    planNote: "Прогноз — може змінитися через скасування", planEmpty: "Немає занять у цьому періоді",
    period_next_note: "🔮 {start}–{end} показано як попередній перегляд — за умови продовження абонементу", period_preview_tag: "попередній перегляд наступного періоду",
    roll_booked: "{n} заброньов.", roll_scheduled: "{n} заплан.",
    limitSkipped: "⚠️ ліміт — пропущено {date}", paused: "пауза",
    opensAt: "⏰ {date} · відкриття {clock} ({rel})",
    noSubscription: "Абонемент не синхронізовано. Відкрийте BoostApp.",
    monthlyLeft: "На місяць: залишилось {r}/{m}", dailyCap: "Ліміт на день: {n}", validUntil: "Дійсний до {d}",
    frozen: "❄️ заморожено", balanceUsed: "Місячний ліміт вичерпано", subDefault: "Абонемент",
    sub_balance: "Баланс", sub_bonusTag: "🎁 Бонус", sub_bonusN: "+{n} бонус", sub_entriesLeft: "залишилось {n}",
    syncedAgo: "синхр. {t}", live: " (наживо)", fromPage: "синхр. {t} · зі сторінки BoostApp",
    registeredCount: "Записано {r}/{m}", noNames: "імена недоступні", waitlist: "Список очікування ({n})",
    loading: "завантаження…", couldNotLoad: "не вдалося завантажити", noDetails: "немає опису заняття",
    noUpcoming: "Немає найближчих записів.", openHomeSync: "Відкрийте головну BoostApp для синхронізації.",
    couldNotSchedule: "Не вдалося завантажити розклад.",
    noClasses: "Занять не знайдено. Перевірте налаштування та підключення до BoostApp.",
    selectedClasses: "{sel} вибрано · {n} занять", nClasses: "{n} занять",
    adding: "Додавання…", bookedToast: "✅ Записано! {cls} · {date}",
    alreadyToast: "ℹ️ Ви вже записані на це заняття",
    limitToast: "⚠️ Ліміт абонемента — ймовірно, у вас вже є заняття цього дня",
    openNeedAuto: "Відкрито — увімкніть Авто-запис або натисніть «Записатися»", openBooking: "Відкрито — виконується запис…",
    fullToast: "⚠️ Заняття заповнене при відкритті", scheduledToast: "Заплановано — відкриття {clock}",
    addedToast: "Додано до Моїх занять", dayNote: "  ·  примітка: ваш план дозволяє {n}/день",
    signedIn: "✅ Вхід у BoostApp виконано", checkingSignin: "Перевірка входу…",
    hdrSignedIn: "Ви увійшли", hdrNotSignedIn: "Не увійшли", hdrNotSynced: "Відкрийте Home",
    soTitle: "Ви не увійшли в BoostApp", soText: "Відкрийте BoostApp та увійдіть, щоб завантажити заняття, слоти й абонемент.", soCta: "Відкрити BoostApp для входу",
    notSynced: "⚠️ Не синхронізовано — відкрийте головну BoostApp", notSignedIn: "⚠️ Вхід не виконано — авто-запис призупинено",
    recheck: "Перевірити", openHome: "Відкрити головну", done: "Готово ✅", failed: "Помилка",
    never: "ніколи", justNow: "щойно", minAgo: "{m} хв тому", hourAgo: "{h} год тому", dayAgo: "{d} дн тому",
    relNow: "зараз", relDays: "за {d}д {h}год", relHours: "за {h}год {m}хв", relMin: "за {m}хв"
  },
  ar: {
    tab_upcoming: "القادمة", tab_schedule: "الجدول الأسبوعي", tab_slots: "مواعيدي الأسبوعية",
    tab_subscription: "اشتراكي", tab_settings: "الإعدادات",
    hint_upcoming: "حصصك المحجوزة. وسّع لعرض المشاركين ومحتوى الحصة.",
    hint_upcoming_week: "حصصك المحجوزة، مرتّبة حسب أيام الأسبوع.",
    hint_schedule: "حدّد الأوقات التي تريدها — تحجزها الإضافة كل أسبوع عند فتح التسجيل.",
    autobook: "حجز تلقائي", autobookOn: "مُفعّل", autobookOff: "مُطفأ",
    autobookOnMsg: "✅ الحجز التلقائي مُفعّل — تُحجز الحصص تلقائيًا لحظة فتحها.",
    autobookOffMsg: "⏸️ الحجز التلقائي مُطفأ — لن يُحجز شيء تلقائيًا. استخدم ”احجز الآن“.",
    slotsAutoOff: "⏸️ الحجز التلقائي مُطفأ — لن تُحجز هذه المواعيد تلقائيًا.", turnOn: "تشغيل",
    disabledHint: "شغّل الحجز التلقائي لاستخدام هذا",
    refresh: "↻ تحديث", refreshing: "↻ جارٍ التحديث…", openHistory: "📊 السجل",
    viewList: "قائمة", viewWeek: "أسبوع", viewPeriod: "عرض الفترة", openFullPage: "فتح في صفحة كاملة",
    period_range: "{start} – {end}", period_bank: "{rem}/{max} متبقٍ في الاشتراك",
    period_last: "آخر حصة محجوزة: {date}", period_last_none: "لم تُحجز أي حصة بعد",
    period_leftover_warn: "⚠️ تبقّى {n} غير مجدولة — احجز قبل {date}",
    period_attended: "{n} تم حضورها",
    period_external: "محجوز في BoostApp",
    dp_none: "لا توجد حصص لهذا اليوم.", dp_add: "أضف", dp_scheduled: "مضاف", dp_addHint: "أضف حصة",
    hist_attended: "حضرت", hist_lateCancel: "إلغاء متأخر", hist_cancelled: "أُلغي", hist_noShow: "لم تحضر", hist_other: "أخرى",
    checkNow: "تحقّق الآن", checking: "جارٍ التحقّق…", saveSettings: "حفظ الإعدادات", settingsSaved: "تم حفظ الإعدادات",
    scheduleLessons: "جدولة دروس +", closeScheduler: "إغلاق المجدول ✕",
    lbl_lang: "اللغة", lbl_theme: "السمة", theme_system: "النظام", theme_light: "فاتح", theme_dark: "داكن",
    lbl_backup: "نسخ احتياطي / نقل", backup_hint: "صدّر مواعيدك وإعداداتك لنقلها إلى متصفح آخر، أو الصق/ارفع نسخة احتياطية للاستيراد.",
    export: "تصدير", import: "استيراد", download: "تنزيل ملف",
    exportedToast: "تم التصدير — نُسخ إلى الحافظة", importedToast: "تم استيراد {n} مواعيد", importFail: "تعذّرت قراءة النسخة الاحتياطية",
    lbl_company: "رقم الشركة", lbl_token: "رمز الاستوديو (GetUrl)",
    lbl_poll: "التحقّق كل (دقائق)", lbl_snipe: "الفارق قبل الفتح (دقائق)", lbl_daily: "الحد اليومي (0 = تلقائي من الاشتراك)",
    settings_note: "الحد اليومي يتحكّم فقط في التنبيه المحلي — خادم الاستوديو لا يزال يفرض الحد اليومي الفعلي. يجب تسجيل الدخول إلى BoostApp في ملف Chrome هذا. لا يمكن للإضافة التسجيل قبل فتح نافذة 72 ساعة — تعمل لحظة فتحها.",
    status_open: "مفتوح", status_waiting: "مجدول", status_full: "ممتلئ", status_passed: "انتهى",
    "status_not-found": "غير موجود", status_done: "تم", status_none: "لا حصص قادمة",
    every: "كل {day}", once: "مرة واحدة — {day}", anyClass: "أي حصة",
    bookNow: "احجز الآن", booking: "جارٍ الحجز…", makeWeekly: "↻ اجعلها أسبوعية", onceOnly: "1× اجعلها لمرة واحدة",
    skip: "تخطّ {date}", pause: "إيقاف مؤقت", resume: "استئناف", remove: "إزالة",
    participants: "👥 المشاركون", lessonInfo: "📋 تفاصيل الحصة",
    cancelLesson: "إلغاء الحجز", cancelling: "جارٍ الإلغاء…", cancelOnSite: "الإلغاء في BoostApp",
    noSlots: "لا أوقات بعد. حدّد ما تريد في الجدول الأسبوعي.",
    checkingDots: "جارٍ التحقّق…", bookingNow: "جارٍ الحجز…", fullAtOpen: "ممتلئ عند الفتح",
    bookedOn: "✅ تم الحجز {date}", alreadyReg: "ℹ️ مسجّل بالفعل ({date})",
    status_booked: "محجوز", bookedFor: "✅ محجوز ليوم {date}", notPublished: "🗓️ التالي: {date} (لم يُنشر بعد)",
    planTitle: "خطة هذا الشهر", planSkip: "تخطّ", planUnskip: "تراجع", planCancel: "إلغاء",
    plan_scheduled: "مجدول", plan_skipped: "متخطّى", plan_limit: "⛔ بلغت الحد", plan_daily: "⛔ الثاني في اليوم",
    planNote: "توقّع — قد يتغيّر بسبب الإلغاءات", planEmpty: "لا مواعيد في هذه الفترة",
    period_next_note: "🔮 {start}–{end} معروض كمعاينة — بافتراض تجديد الاشتراك", period_preview_tag: "معاينة الفترة القادمة",
    roll_booked: "{n} محجوز", roll_scheduled: "{n} مجدول",
    limitSkipped: "⚠️ تجاوز الحد — تم التخطّي {date}", paused: "متوقف",
    opensAt: "⏰ {date} · يفتح {clock} ({rel})",
    noSubscription: "لم تتم مزامنة الاشتراك. افتح BoostApp.",
    monthlyLeft: "شهريًا: متبقٍ {r}/{m}", dailyCap: "الحد اليومي: {n}", validUntil: "صالح حتى {d}",
    frozen: "❄️ مجمّد", balanceUsed: "تم استنفاد الرصيد الشهري", subDefault: "اشتراك",
    sub_balance: "الرصيد", sub_bonusTag: "🎁 مكافأة", sub_bonusN: "+{n} مكافأة", sub_entriesLeft: "متبقٍ {n}",
    syncedAgo: "تمت المزامنة {t}", live: " (مباشر)", fromPage: "تمت المزامنة {t} · من صفحة BoostApp",
    registeredCount: "مسجّلون {r}/{m}", noNames: "الأسماء غير متاحة", waitlist: "قائمة الانتظار ({n})",
    loading: "جارٍ التحميل…", couldNotLoad: "تعذّر التحميل", noDetails: "لا توجد تفاصيل للحصة",
    noUpcoming: "لا حجوزات قادمة.", openHomeSync: "افتح الصفحة الرئيسية لـ BoostApp للمزامنة.",
    couldNotSchedule: "تعذّر تحميل الجدول.",
    noClasses: "لم يتم العثور على حصص. تحقّق من الإعدادات والاتصال بـ BoostApp.",
    selectedClasses: "{sel} محدّدة · {n} حصص", nClasses: "{n} حصص",
    adding: "جارٍ الإضافة…", bookedToast: "✅ تم الحجز! {cls} · {date}",
    alreadyToast: "ℹ️ أنت مسجّل بالفعل في هذه الحصة",
    limitToast: "⚠️ تجاوزت حد الاشتراك — غالبًا لديك حصة في اليوم نفسه",
    openNeedAuto: "مفتوح الآن — فعّل الحجز التلقائي أو اضغط «احجز الآن»", openBooking: "مفتوح — جارٍ الحجز…",
    fullToast: "⚠️ الحصة ممتلئة عند الفتح", scheduledToast: "مجدول — يفتح {clock}",
    addedToast: "أُضيف إلى حصصي", dayNote: "  ·  ملاحظة: خطتك تسمح بـ {n}/يوم",
    signedIn: "✅ تم تسجيل الدخول إلى BoostApp", checkingSignin: "جارٍ التحقّق من تسجيل الدخول…",
    hdrSignedIn: "مسجّل الدخول", hdrNotSignedIn: "غير مسجّل", hdrNotSynced: "افتح الرئيسية للمزامنة",
    soTitle: "لست مسجّلاً في BoostApp", soText: "افتح BoostApp وسجّل الدخول لتحميل دروسك ومواعيدك الأسبوعية واشتراكك.", soCta: "افتح BoostApp لتسجيل الدخول",
    notSynced: "⚠️ لم تتم المزامنة — افتح الصفحة الرئيسية لـ BoostApp", notSignedIn: "⚠️ لم تسجّل الدخول — الحجز التلقائي متوقف",
    recheck: "إعادة التحقّق", openHome: "افتح الرئيسية", done: "تم ✅", failed: "فشل",
    never: "أبدًا", justNow: "الآن", minAgo: "قبل {m} د", hourAgo: "قبل {h} س", dayAgo: "قبل {d} يوم",
    relNow: "الآن", relDays: "خلال {d}ي {h}س", relHours: "خلال {h}س {m}د", relMin: "خلال {m}د"
  }
};
function t(key, params) {
  let s = (I18N[LANG] && I18N[LANG][key] != null) ? I18N[LANG][key] : (I18N.en[key] != null ? I18N.en[key] : key);
  if (params) for (const k in params) s = s.split("{" + k + "}").join(params[k]);
  return s;
}
function dayName(wd) { return (WDFULL[LANG] || WDFULL.en)[wd]; }
function dayShort(wd) { return (WDSHORT[LANG] || WDSHORT.en)[wd]; }
// "2026-07-03" / free text → "03/07" (day/month), best-effort.
function shortDate(s) {
  if (!s) return "";
  let m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[3]}/${m[2]}`;
  m = String(s).match(/(\d{1,2})\/(\d{1,2})/); return m ? `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}` : String(s);
}
// Weekday (0=Sun … 6=Sat) for any rule: explicit for weekly, derived from the date for date-rules.
function targetWeekday(tg) {
  if (tg.mode === "weekly") return Number(tg.weekday);
  if (tg.date) { const d = new Date(tg.date + "T00:00:00"); if (!isNaN(d)) return d.getDay(); }
  return 7; // unknown → sorts last
}

function applyTheme(theme) {
  let eff = theme || "system";
  if (eff === "system") eff = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  document.documentElement.dataset.theme = eff;
}

function applyLang(lang) {
  LANG = I18N[lang] ? lang : "en";
  document.documentElement.lang = LANG;
  document.documentElement.dir = RTL_LANGS.includes(LANG) ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.getAttribute("data-i18n")); });
  document.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.getAttribute("data-i18n-title")); });
  applyViewToggleUI("upcoming"); applyViewToggleUI("slots");
  if ($("checkNow")) $("checkNow").textContent = t("checkNow");
  if ($("refreshBtn")) $("refreshBtn").textContent = t("refresh");
  if ($("autoBook")) setAutoBookState($("autoBook").checked);
  if ($("lang")) $("lang").value = LANG;
  syncSchedulerBtn();
}

// ---------------------------------------------------------------------------
// formatting helpers
// ---------------------------------------------------------------------------
function fmtClock(ms) {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function relTime(ms) {
  if (!ms) return "";
  const diff = ms - Date.now();
  if (diff <= 0) return t("relNow");
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return t("relDays", { d: Math.floor(h / 24), h: h % 24 });
  if (h > 0) return t("relHours", { h, m });
  return t("relMin", { m });
}
function fmtSync(ms) {
  if (!ms) return t("never");
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("justNow");
  if (m < 60) return t("minAgo", { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("hourAgo", { h });
  return t("dayAgo", { d: Math.floor(h / 24) });
}

function statusClass(s) {
  if (s === "not-found" || s === "none") return "notfound";
  if (s === "done") return "booked";
  return s;
}
function statusLabel(s) { return t("status_" + s) || s; }

function btn(text, cls) { const b = document.createElement("button"); b.textContent = text; if (cls) b.className = cls; return b; }
// Grey out scheduling controls while auto-book is off (they have no effect then).
function autoBookOff() { return $("autoBook") && !$("autoBook").checked; }
function disableIfAutoOff(b) { if (autoBookOff()) { b.disabled = true; b.title = t("disabledHint"); } return b; }
function flash(r) {
  if (!r) return;
  if (r.ok) toast(r.msg || t("done"));
  else toast("⚠️ " + (r.msg || r.error || t("failed")));
}
function toast(text) {
  const w = $("warn"); w.style.display = "block"; w.textContent = text;
  setTimeout(() => { w.style.display = "none"; }, 4000);
}
// Reflect the Auto-book toggle state as a coloured On/Off word next to the switch.
function setAutoBookState(on) {
  const el = $("autoBookState"); if (!el) return;
  el.textContent = t(on ? "autobookOn" : "autobookOff");
  el.className = "sw-state " + (on ? "on" : "off");
}

// ---------------------------------------------------------------------------
// My slots (rules)
// ---------------------------------------------------------------------------
// Rollup chip {cls,text} for a recurring rule from the month plan, or null.
function computeChipParts(tg, plan) {
  if (!(tg.mode === "weekly" && tg.recurrence !== "once" && plan && plan.byRule)) return null;
  const occ = plan.byRule[tg.id] || [];
  const b = occ.filter(o => o.status === "booked").length;
  const s = occ.filter(o => o.status === "scheduled").length;
  const x = occ.filter(o => o.status === "limit" || o.status === "daily").length;
  const parts = [];
  if (b) parts.push(t("roll_booked", { n: b }));
  if (s) parts.push(t("roll_scheduled", { n: s }));
  if (x) parts.push(`${x} ⛔`);
  if (!parts.length) return null;
  return { text: parts.join(" · "), cls: b ? "booked" : (s ? "waiting" : "full") };
}

// --- List / Week / Period view switch (per tab, remembered across sessions) ---
function getView(which) {
  try {
    const v = localStorage.getItem("bsab_view_" + which);
    return (v === "week" || v === "period") ? v : "list";
  } catch (e) { return "list"; }
}
function setView(which, v) { try { localStorage.setItem("bsab_view_" + which, v); } catch (e) {} }
function applyViewToggleUI(which) {
  const box = document.querySelector(`.viewtoggle[data-view-for="${which}"]`);
  if (!box) return;
  const v = getView(which);
  box.querySelectorAll(".vt-btn").forEach(b => b.classList.toggle("active", b.dataset.view === v));
}
// Staggered entrance when switching List⇄Week — the cards/columns scale and
// slide into their new positions. Skipped when the user prefers reduced motion.
function playSwitchAnim(el) {
  if (!el || !el.animate) return;
  try { if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch (e) {}
  const weekGrid = el.querySelector(".weekgrid");
  const periodGrid = el.querySelector(".periodgrid");
  const items = weekGrid ? weekGrid.querySelectorAll(".weekcol")
    : periodGrid ? periodGrid.querySelectorAll(".periodweek")
    : el.querySelectorAll(":scope > .card");
  items.forEach((node, i) => {
    node.animate(
      [{ opacity: 0, transform: "scale(.94) translateY(10px)" }, { opacity: 1, transform: "none" }],
      { duration: 300, delay: Math.min(i * 35, 220), easing: "cubic-bezier(.2,.75,.3,1)", fill: "backwards" }
    );
  });
}

// Render a 7-column week grid (Sun→Sat). RTL is handled by the document dir,
// so columns flow right-to-left for Hebrew/Arabic automatically.
function renderWeekGrid(el, entries) {
  el.innerHTML = "";
  const today = new Date().getDay();
  const byDay = [[], [], [], [], [], [], []];
  entries.forEach(e => { if (e.wd >= 0 && e.wd <= 6) byDay[e.wd].push(e); });
  const grid = document.createElement("div");
  grid.className = "weekgrid";
  for (let d = 0; d < 7; d++) {
    const day = byDay[d].sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
    const col = document.createElement("div");
    col.className = "weekcol" + (d === today ? " today" : "") + (day.length ? " filled" : " empty");
    const head = document.createElement("div");
    head.className = "weekcol-head"; head.textContent = dayShort(d);
    col.appendChild(head);
    if (!day.length) {
      const empty = document.createElement("div"); empty.className = "weekcol-empty"; empty.textContent = "·";
      col.appendChild(empty);
    } else {
      day.forEach(e => {
        const it = document.createElement("div");
        it.className = "weekitem " + (e.cls || "") + (e.dim ? " dim" : "");
        const lines = (e.lines || []).filter(Boolean);
        it.title = (e.time ? e.time + " · " : "") + (e.title || "") + (lines.length ? " — " + lines.join(" · ") : "");
        it.innerHTML =
          `<span class="wi-time">${escapeHtml(e.time || "")}</span>` +
          `<span class="wi-name">${escapeHtml(e.title || "")}</span>` +
          lines.map(l => `<span class="wi-sub">${escapeHtml(l)}</span>`).join("");
        // Actions are shown directly inside the item — no extra click needed.
        if (e.actions) e.actions(it);
        col.appendChild(it);
      });
    }
    grid.appendChild(col);
  }
  el.appendChild(grid);
}

// --- Period view: calendar grid spanning the whole subscription period ---
function ymdLocal(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function parseYmd(s) { const p = String(s).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function planStatusLabel(s) {
  if (s === "booked") return t("status_booked");
  if (s === "skipped") return t("plan_skipped");
  if (s === "limit") return t("plan_limit");
  if (s === "daily") return t("plan_daily");
  return t("plan_scheduled");
}
// Past-day (history) status vocabulary — separate from the forward-looking
// booked/scheduled/limit/daily/skipped set, since "attended weeks ago" is a
// different kind of fact than "will be booked next Tuesday".
function histStatusClass(s) {
  if (s === "attended") return "hist-attended";
  if (s === "lateCancel") return "hist-latecancel";
  if (s === "cancelled") return "hist-cancelled";
  if (s === "noShow") return "hist-noshow";
  return "hist-other";
}
function histStatusIcon(s) {
  if (s === "attended") return "💪";   // you showed up & did it (distinct from a future booking ✅)
  if (s === "lateCancel") return "⚠️";
  if (s === "cancelled") return "↩️";
  if (s === "noShow") return "❌";      // booked but didn't attend (distinct from a chosen skip ⏭️)
  return "▪️";
}
function histStatusLabel(s) {
  if (s === "attended") return t("hist_attended");
  if (s === "lateCancel") return t("hist_lateCancel");
  if (s === "cancelled") return t("hist_cancelled");
  if (s === "noShow") return t("hist_noShow");
  return t("hist_other");
}

// Cached history records ({date,time,className,status,...}, from getHistory) —
// lazy-loaded the first time Period view renders, NOT on every refresh() (that
// would fire a live ClassHistory fetch on every action). Cleared on manual Refresh.
let historyCache = null;
let historyPromise = null;
let lastRegistrations = null;   // latest upcoming registrations from getState (incl. lessons booked outside the extension)

// Weekly schedule (classes by weekday) for the day-picker. Cached; invalidated
// after adding a slot since the targets list changes.
let scheduleData = null;
async function getScheduleData(force) {
  if (scheduleData && !force) return scheduleData;
  scheduleData = (await send({ cmd: "getSchedule" })) || { slots: [], targets: [] };
  return scheduleData;
}
// Shared toast wording for a freshly-added slot (used by scheduler + day picker).
function slotAddedToast(a, s) {
  if (!a) { toast(t("addedToast")); return; }
  let m;
  if (a.booked) m = t("bookedToast", { cls: a.className || (s && s.className) || "", date: a.resolvedDate || "" });
  else if (a.kind === "already") m = t("alreadyToast");
  else if (a.kind === "limit") m = t("limitToast");
  else if (a.status === "open" && a.needsAutoBook) m = t("openNeedAuto");
  else if (a.status === "open") m = t("openBooking");
  else if (a.status === "full") m = t("fullToast");
  else if (a.status === "waiting" && a.openAt) m = t("scheduledToast", { clock: fmtClock(a.openAt) });
  else m = t("addedToast");
  if (a.sameDayWarning) m += t("dayNote", { n: a.dailyLimit || 1 });
  toast(m);
}

// Click a future day → pick a class from that weekday's schedule to book/schedule
// for that exact date (creates a one-time "date" slot).
async function openDayPicker(ds) {
  const d = parseYmd(ds); const wd = d.getDay();
  const data = await getScheduleData();
  const slots = (data.slots || []).filter(s => Number(s.weekday) === wd);
  const targets = data.targets || [];
  const regs = (lastRegistrations && lastRegistrations.items) || [];
  const already = (time, className) => {
    const tgt = targets.some(tt => (tt.classFilter || "") === (className || "") && tt.time === time &&
      (tt.mode === "weekly" ? Number(tt.weekday) === wd : tt.date === ds));
    const reg = regs.some(r => {
      if (r.startAt == null) return false;
      const rd = new Date(r.startAt);
      const rt = String(rd.getHours()).padStart(2, "0") + ":" + String(rd.getMinutes()).padStart(2, "0");
      return ymdLocal(rd) === ds && rt === time;
    });
    return tgt || reg;
  };

  const backdrop = document.createElement("div"); backdrop.className = "daypicker-backdrop";
  const panel = document.createElement("div"); panel.className = "daypicker";
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });

  const head = document.createElement("div"); head.className = "dp-head";
  const title = document.createElement("span"); title.textContent = `${dayName(wd)} · ${shortDate(ds)}`;
  const x = document.createElement("button"); x.className = "dp-close"; x.textContent = "✕"; x.setAttribute("aria-label", "close"); x.onclick = close;
  head.appendChild(title); head.appendChild(x); panel.appendChild(head);

  const listEl = document.createElement("div"); listEl.className = "dp-list";
  if (!slots.length) {
    listEl.innerHTML = `<div class="empty">${t("dp_none")}</div>`;
  } else {
    slots.forEach(s => {
      const row = document.createElement("div"); row.className = "dp-row";
      row.innerHTML = `<span class="dp-time">${escapeHtml(s.time)}</span>` +
        `<span class="dp-name">${escapeHtml(s.className || t("anyClass"))}${s.teacher ? ` <span class="dp-teacher">· ${escapeHtml(s.teacher)}</span>` : ""}</span>`;
      const act = document.createElement("span"); act.className = "dp-act";
      if (already(s.time, s.className)) {
        act.innerHTML = `<span class="muted">✅ ${t("dp_scheduled")}</span>`;
      } else {
        const b = btn(t("dp_add"), "small");
        b.onclick = async () => {
          b.disabled = true; b.textContent = t("adding");
          const r = await send({ cmd: "addSlot", slot: { weekday: wd, time: s.time, className: s.className, date: ds } });
          slotAddedToast(r && r.added, s);
          scheduleData = null;      // targets changed → refetch next open
          close();
          await refresh();          // re-renders the Period grid with the new slot
        };
        act.appendChild(b);
      }
      row.appendChild(act); listEl.appendChild(row);
    });
  }
  panel.appendChild(listEl);
  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);
}

function getHistoryRecords() {
  if (historyCache !== null) return Promise.resolve(historyCache);
  if (!historyPromise) {
    historyPromise = send({ cmd: "getHistory" }).then(res => {
      historyCache = (res && res.records) || [];
      historyPromise = null;
      return historyCache;
    }).catch(() => { historyPromise = null; return []; });
  }
  return historyPromise;
}

// Renders a full-weeks calendar (Sun→Sat rows) from plan.periodStart through
// plan.periodEnd. Today onward stacks projected occurrences from computePlan
// (booked/scheduled/limit/daily/skipped). Days before today are filled from the
// cached History backfill (attended/late-cancel/cancelled/no-show) once it loads
// — lazily fetched on first render, so the grid paints immediately and refines
// in place a moment later rather than blocking on a possibly-slow first sync.
function renderPeriodGrid(list, plan, rules) {
  list.innerHTML = "";
  if (!plan || !plan.periodEnd) { list.innerHTML = `<div class="empty">${t("planEmpty")}</div>`; return; }

  // Re-fetch just the plan and repaint the grid in place — used after a
  // skip/unskip toggle so the rest of the period's monthly/daily limits
  // (which shift once an occurrence frees up or consumes a credit) are
  // reflected immediately, without a full popup refresh().
  const reloadGrid = async () => {
    planCache = null;
    const freshPlan = await getPlan(true);
    renderPeriodGrid(list, freshPlan, rules);
  };

  const todayStr = ymdLocal(new Date());
  const periodStartD = parseYmd(plan.periodStart || todayStr);
  const periodEndD = parseYmd(plan.periodEnd);
  // nextPeriodEnd extends the grid one cycle further so recurring slots that
  // fall just past periodEnd (e.g. the 1st of next month) still show up —
  // see the computePlan() comment in background.js for why this is safe.
  const previewEndD = plan.nextPeriodEnd ? parseYmd(plan.nextPeriodEnd) : periodEndD;

  // Flatten every rule's future occurrences into a date → [occurrence] map.
  const byDate = {};
  let hasPreview = false;
  rules.forEach(tg => {
    const occ = (plan.byRule && plan.byRule[tg.id]) || [];
    const ruleName = tg.classFilter || (tg.info && tg.info.className) || t("anyClass");
    occ.forEach(o => {
      if (o.period === "next") hasPreview = true;
      (byDate[o.date] = byDate[o.date] || []).push(Object.assign({ ruleName }, o));
    });
  });

  // Merge in past attendance from History, within the period, skipping any date+time
  // already covered by a plan occurrence (avoids double-showing "today").
  (historyCache || []).forEach(r => {
    if (!r.date || r.date < plan.periodStart || r.date > plan.periodEnd) return;
    const dup = (byDate[r.date] || []).some(o => !o.isHistory && o.time === r.time);
    if (dup) return;
    (byDate[r.date] = byDate[r.date] || []).push({ isHistory: true, date: r.date, time: r.time, ruleName: r.className, status: r.status });
  });

  // Overlay lessons booked directly on BoostApp (outside the extension). They
  // consume the same monthly balance (already reflected in monthlyRemaining), so
  // showing them keeps the calendar honest about what's actually locked in.
  // Skip any date+time already drawn by a rule occurrence to avoid duplicates.
  const regItems = (lastRegistrations && lastRegistrations.items) || [];
  regItems.forEach(r => {
    if (r.startAt == null) return;
    const d = new Date(r.startAt);
    const ds = ymdLocal(d);
    if (ds < todayStr) return;                                   // past → handled by History
    if (ds < plan.periodStart || ds > (plan.nextPeriodEnd || plan.periodEnd)) return;  // outside grid
    const time = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    const dup = (byDate[ds] || []).some(o => !o.isHistory && o.time === time);
    if (dup) return;                                             // already shown as a rule occurrence
    (byDate[ds] = byDate[ds] || []).push({ external: true, date: ds, time, ruleName: r.className || t("anyClass"), status: "booked" });
  });

  // Last date with a lesson actually locked in (booked or still-scheduled).
  let lastDate = null;
  Object.keys(byDate).forEach(ds => {
    byDate[ds].forEach(o => { if ((o.status === "booked" || o.status === "scheduled") && (!lastDate || ds > lastDate)) lastDate = ds; });
  });

  // Summary chips: period range, remaining bank, attended-so-far, last locked-in lesson.
  const stats = document.createElement("div"); stats.className = "period-stats chips";
  const rangeChip = document.createElement("span"); rangeChip.className = "chip";
  rangeChip.textContent = "📅 " + t("period_range", { start: shortDate(plan.periodStart), end: shortDate(plan.periodEnd) });
  stats.appendChild(rangeChip);
  if (plan.monthlyMax != null) {
    const bankChip = document.createElement("span"); bankChip.className = "chip";
    bankChip.innerHTML = "🎟️ " + t("period_bank", { rem: plan.monthlyRemaining, max: plan.monthlyMax })
      + (plan.bonusEntries ? " " + t("sub_bonusN", { n: plan.bonusEntries }) + " 🎁" : "");
    stats.appendChild(bankChip);
  }
  if (historyCache !== null) {
    const attendedCount = historyCache.filter(r => r.date >= plan.periodStart && r.date <= plan.periodEnd && r.status === "attended").length;
    const attChip = document.createElement("span"); attChip.className = "chip";
    attChip.textContent = "💪 " + t("period_attended", { n: attendedCount });
    stats.appendChild(attChip);
  }
  const lastChip = document.createElement("span"); lastChip.className = "chip";
  lastChip.textContent = "🏁 " + (lastDate ? t("period_last", { date: shortDate(lastDate) }) : t("period_last_none"));
  stats.appendChild(lastChip);
  list.appendChild(stats);

  // Icon legend so the calendar marks are self-explanatory. Past-day marks only
  // appear once history has loaded; future marks are always relevant.
  const legend = document.createElement("div"); legend.className = "period-legend";
  const legendItems = [
    ["✅", t("status_booked")], ["🌐", t("period_external")], ["🗓", t("plan_scheduled")], ["⏭️", t("plan_skipped")], ["⛔", t("plan_limit")]
  ];
  if (historyCache !== null) {
    legendItems.push(["💪", t("hist_attended")], ["❌", t("hist_noShow")], ["⚠️", t("hist_lateCancel")], ["↩️", t("hist_cancelled")]);
  }
  legend.innerHTML = legendItems.map(([ic, lab]) => `<span class="pl-item"><span class="pl-ic">${ic}</span> ${escapeHtml(lab)}</span>`).join("");
  list.appendChild(legend);

  // Warn when some monthly credits have no rule occurrence that will use them
  // before the period closes — the "will I actually spend this" signal.
  if (plan.leftover > 0) {
    const warn = document.createElement("div"); warn.className = "autowarn";
    const span = document.createElement("span");
    span.textContent = t("period_leftover_warn", { n: plan.leftover, date: shortDate(plan.periodEnd) });
    warn.appendChild(span);
    list.appendChild(warn);
  }

  // Note that the grid below extends past this period — those occurrences
  // are a preview, not a locked-in booking, until the next period syncs.
  if (hasPreview) {
    const note = document.createElement("div"); note.className = "autowarn preview-note";
    const span = document.createElement("span");
    span.textContent = t("period_next_note", { start: shortDate(plan.nextPeriodStart), end: shortDate(plan.nextPeriodEnd) });
    note.appendChild(span);
    list.appendChild(note);
  }

  // Calendar grid: full weeks from periodStart's week through the preview
  // window's week (periodEnd when there's nothing to preview yet).
  const gridStart = new Date(periodStartD); gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(previewEndD); gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const grid = document.createElement("div"); grid.className = "periodgrid";
  const head = document.createElement("div"); head.className = "periodweek-head";
  for (let d = 0; d < 7; d++) { const s = document.createElement("span"); s.textContent = dayShort(d); head.appendChild(s); }
  grid.appendChild(head);

  for (let wkStart = new Date(gridStart); wkStart <= gridEnd; wkStart.setDate(wkStart.getDate() + 7)) {
    const row = document.createElement("div"); row.className = "periodweek";
    for (let i = 0; i < 7; i++) {
      const d = new Date(wkStart); d.setDate(d.getDate() + i);
      const ds = ymdLocal(d);
      const inCurrent = ds >= plan.periodStart && ds <= plan.periodEnd;
      const inPreview = !inCurrent && plan.nextPeriodStart && ds >= plan.nextPeriodStart && ds <= plan.nextPeriodEnd;
      const inRange = inCurrent || inPreview;
      const isPast = ds < todayStr;
      const dayEntries = byDate[ds] || [];
      const cell = document.createElement("div");
      const canAdd = inRange && ds >= todayStr;   // today or future → can schedule a lesson here
      cell.className = "periodcell" + (inRange ? "" : " out") + (inPreview ? " next-period" : "") + (inCurrent && isPast && !dayEntries.length ? " past" : "") + (ds === todayStr ? " today" : "") + (canAdd ? " addable" : "");
      if (inRange) {
        const dateEl = document.createElement("div"); dateEl.className = "pc-date"; dateEl.textContent = String(d.getDate());
        cell.appendChild(dateEl);
        if (canAdd) {
          const add = document.createElement("span"); add.className = "pc-add"; add.textContent = "+"; add.title = t("dp_addHint");
          cell.appendChild(add);
          cell.addEventListener("click", (ev) => {
            if (ev.target.closest(".pe-toggle")) return;   // don't hijack the skip/unskip control
            openDayPicker(ds);
          });
        }
        dayEntries.slice().sort((a, b) => String(a.time || "").localeCompare(String(b.time || ""))).forEach(o => {
          const e = document.createElement("div");
          if (o.isHistory) {
            e.className = "pe-entry " + histStatusClass(o.status);
            e.innerHTML = `<span class="pe-time">${escapeHtml(o.time || "")}</span> ${histStatusIcon(o.status)} ${escapeHtml((o.ruleName || "").slice(0, 12))}`;
            e.title = `${o.time || ""} ${o.ruleName || ""} — ${histStatusLabel(o.status)}`.trim();
          } else {
            const cls = (o.status === "daily") ? "limit" : o.status;
            e.className = "pe-entry " + cls + (o.period === "next" ? " preview" : "") + (o.external ? " external" : "");
            // External bookings (made on BoostApp, not by a watched slot) carry a globe mark.
            const icon = o.external ? "🌐" : o.status === "booked" ? "✅" : o.status === "skipped" ? "⏭️" : (o.status === "limit" || o.status === "daily") ? "⛔" : (o.period === "next" ? "🔮" : "🗓");
            e.innerHTML = `<span class="pe-time">${escapeHtml(o.time || "")}</span> ${icon} ${escapeHtml((o.ruleName || "").slice(0, 12))}`;
            e.title = `${o.time || ""} ${o.ruleName || ""} — ${o.external ? t("period_external") : planStatusLabel(o.status)}${o.period === "next" ? " (" + t("period_preview_tag") + ")" : ""}`.trim();

            // Hover-revealed skip/unskip toggle — only for occurrences that are
            // actually skippable (scheduled → skip, skipped → unskip). Booked
            // occurrences use "Cancel" elsewhere; limit/daily aren't actionable
            // here since they're already blocked by a cap, not a choice.
            if (o.status === "scheduled" || o.status === "skipped") {
              const toggle = document.createElement("button");
              toggle.type = "button";
              toggle.className = "pe-toggle";
              const willSkip = o.status === "scheduled";
              toggle.textContent = willSkip ? "⏭️" : "↩";
              toggle.title = willSkip ? t("planSkip") : t("planUnskip");
              toggle.setAttribute("aria-label", toggle.title);
              toggle.onclick = async (ev) => {
                ev.stopPropagation();
                toggle.disabled = true;
                await send(willSkip
                  ? { cmd: "skipDate", id: o.ruleId, date: o.date }
                  : { cmd: "unskipDate", id: o.ruleId, date: o.date });
                await reloadGrid();
              };
              e.appendChild(toggle);
            }
          }
          cell.appendChild(e);
        });
      }
      row.appendChild(cell);
    }
    grid.appendChild(row);
  }
  list.appendChild(grid);

  // History hasn't loaded yet — kick off a lazy fetch and repaint once it lands
  // (only if the user is still looking at Period view by then).
  if (historyCache === null) {
    getHistoryRecords().then(() => { if (getView("slots") === "period") renderPeriodGrid(list, plan, rules); });
  }
}

// Inline stacked actions for a weekly-slot item in week view (mirrors the list card).
function buildSlotWeekActions(inner, tg, plan) {
  const info = tg.info || {}; const st = info.status || "waiting"; const once = tg.recurrence === "once";
  const wrap = document.createElement("div"); wrap.className = "wi-actbtns"; inner.appendChild(wrap);
  if (st === "open" && tg.enabled) {
    const bk = btn(t("bookNow"), "small");
    bk.onclick = async () => { bk.disabled = true; bk.textContent = t("booking"); const r = await send({ cmd: "bookNow", id: tg.id }); flash(r); refresh(); };
    wrap.appendChild(bk);
  }
  const recBtn = btn(once ? t("makeWeekly") : t("onceOnly"), "ghost small");
  recBtn.onclick = async () => { await send({ cmd: "setRecurrence", id: tg.id, recurrence: once ? "weekly" : "once" }); refresh(); };
  wrap.appendChild(disableIfAutoOff(recBtn));
  const hasPlan = tg.mode === "weekly" && tg.recurrence !== "once";
  if (hasPlan) {
    const pb = btn(t("planTitle"), "ghost small"); wrap.appendChild(disableIfAutoOff(pb));
    const pbody = makeExpand(); inner.appendChild(pbody);
    pb.onclick = () => toggleExpand(pbody, () => renderPlanBody(tg, pbody, null));
  } else if (info.resolvedDate && tg.enabled) {
    const sk = btn(t("skip", { date: info.resolvedDate.slice(5) }), "ghost small");
    sk.onclick = async () => { await send({ cmd: "skipNext", id: tg.id }); refresh(); };
    wrap.appendChild(disableIfAutoOff(sk));
  }
  const pz = btn(tg.enabled ? t("pause") : t("resume"), "ghost small");
  pz.onclick = async () => { await send({ cmd: "toggleTarget", id: tg.id, enabled: !tg.enabled }); refresh(); };
  wrap.appendChild(disableIfAutoOff(pz));
  const rm = btn(t("remove"), "ghost small");
  rm.onclick = async () => { await send({ cmd: "removeTarget", id: tg.id }); await renderSchedule(); refresh(); };
  wrap.appendChild(rm);
}
// Inline stacked actions for a booked lesson in week view (Cancel / Participants / Lesson info).
function buildRegWeekActions(inner, e) {
  const wrap = document.createElement("div"); wrap.className = "wi-actbtns"; inner.appendChild(wrap);
  if (e.bookingActId) {
    const c = btn(t("cancelLesson"), "danger small");
    c.onclick = async () => { c.disabled = true; c.textContent = t("cancelling"); const r = await send({ cmd: "cancelRegistration", actId: e.bookingActId }); flash(r); refresh(); };
    wrap.appendChild(c);
  }
  if (e.classId) {
    const pBtn = btn(t("participants"), "ghost small"); const iBtn = btn(t("lessonInfo"), "ghost small");
    wrap.appendChild(pBtn); wrap.appendChild(iBtn);
    const pBody = makeExpand(); const iBody = makeExpand(); inner.appendChild(pBody); inner.appendChild(iBody);
    pBtn.onclick = () => toggleInfo(e.classId, pBody, "participants");
    iBtn.onclick = () => toggleInfo(e.classId, iBody, "info");
  }
}

// Expand-body with an inner wrapper (needed for the 0fr→1fr height animation).
function makeExpand() {
  const b = document.createElement("div"); b.className = "expand-body";
  const i = document.createElement("div"); i.className = "expand-inner";
  b.appendChild(i); return b;
}
function toggleExpand(body, onOpen) {
  if (body.classList.contains("open")) { body.classList.remove("open"); }
  else { body.classList.add("open"); if (onOpen) onOpen(body.querySelector(".expand-inner")); }
}

// Update everything EXCEPT the slots list (so an open month-plan stays open).
async function softRefresh() {
  const state = await send({ cmd: "getState" });
  if (!state) return;
  const { subscription, registrations, auth, client } = state;
  renderAuth(auth, client); renderSubscription(subscription); renderRegistrations(registrations);
  $("badge-upcoming").textContent = registrations && registrations.items ? registrations.items.length : 0;
  $("badge-sub").textContent = subBadgeText(subscription);
}

function renderTargets(targets, plan) {
  const list = $("list");
  list.innerHTML = "";
  // Warn when auto-book is off — these slots won't be booked automatically.
  const warn = $("slotsAutoWarn");
  if (warn) warn.style.display = ($("autoBook") && !$("autoBook").checked) ? "flex" : "none";
  const rules = (targets || []).filter(t2 => t2.mode === "weekly" || t2.mode === "date");
  // Order by weekday (Sun-first), then time of day.
  rules.sort((a, b) => (targetWeekday(a) - targetWeekday(b)) || String(a.time || "").localeCompare(String(b.time || "")));
  if (!rules.length) { list.innerHTML = `<div class="empty">${t("noSlots")}</div>`; return; }

  // Period view: calendar grid spanning the subscription period.
  if (getView("slots") === "period") {
    renderPeriodGrid(list, plan, rules);
    return;
  }

  // Week view (7 day-columns) instead of the card list.
  if (getView("slots") === "week") {
    const entries = rules.map(tg => {
      const info = tg.info || {};
      const st = info.status || "waiting";
      const rc = computeChipParts(tg, plan);
      const lines = [];
      if (info.teacher) lines.push("👤 " + info.teacher);
      if (st === "booked") lines.push("✅ " + shortDate(info.bookedFor || info.resolvedDate));
      else if (st === "open") lines.push("🟢 " + statusLabel("open"));
      else if (st === "full") lines.push("⛔ " + statusLabel("full"));
      else if (st === "waiting" && info.resolvedDate) lines.push("⏰ " + shortDate(info.resolvedDate));
      if ((st === "open" || st === "full") && info.registered != null && info.capacity != null) lines.push(`👥 ${info.registered}/${info.capacity}`);
      if (rc) lines.push(rc.text);                 // month-plan rollup (e.g. "1 booked · 3 scheduled")
      if (!tg.enabled) lines.push("⏸ " + t("paused"));
      return { wd: targetWeekday(tg), time: tg.time, title: tg.classFilter || info.className || t("anyClass"),
        cls: rc ? rc.cls : statusClass(st), dim: !tg.enabled, lines,
        actions: (inner) => buildSlotWeekActions(inner, tg, plan) };
    });
    renderWeekGrid(list, entries);
    return;
  }
  for (const tg of rules) {
    const info = tg.info || {};
    const st = info.status || "waiting";
    const once = tg.recurrence === "once";
    const card = document.createElement("div");
    card.className = `card target ${statusClass(st)}`;

    const when = tg.mode === "weekly"
      ? t(once ? "once" : "every", { day: dayName(tg.weekday) }) + ` · ${tg.time}`
      : `${tg.date} · ${tg.time}`;
    const title = tg.classFilter || info.className || t("anyClass");

    // Build meta as separate lines (stacked), not one dense joined string.
    const meta = [];
    if (info.teacher) meta.push(`👤 ${info.teacher}`);
    // participant count only when it's live/meaningful (registration open)
    if ((st === "open" || st === "full") && info.registered != null && info.capacity != null) meta.push(`👥 ${info.registered}/${info.capacity}`);
    // primary state line
    if (st === "booked") meta.push(t("bookedFor", { date: info.bookedFor || info.resolvedDate }));
    else if (st === "waiting" && info.notPublished) meta.push(t("notPublished", { date: info.resolvedDate }));
    else if (st === "waiting" && info.resolvedDate && info.openAt) meta.push(t("opensAt", { date: info.resolvedDate, clock: fmtClock(info.openAt), rel: relTime(info.openAt) }));
    else if (st === "open") meta.push(t("bookingNow"));
    else if (st === "full") meta.push(t("fullAtOpen"));
    // last-attempt note only if it pertains to the CURRENT occurrence (drops stale skip/limit notes)
    if (st !== "booked" && tg.lastResult && tg.lastResult.date === info.resolvedDate) {
      const lr = tg.lastResult;
      if (lr.kind === "already") meta.push(t("alreadyReg", { date: lr.date }));
      else if (lr.kind === "limit") meta.push(t("limitSkipped", { date: lr.date }));
      else if (lr.kind !== "booked") meta.push(`⚠️ ${(lr.msg || t("failed")).slice(0, 40)}`);
    }
    if (!tg.enabled && st !== "done") meta.push(t("paused"));

    // Chip: for recurring slots it's a month-plan rollup (not a repeat of the meta);
    // one-time / date slots keep the simple state chip.
    let chipCls = statusClass(st), chipText = statusLabel(st);
    const rc = computeChipParts(tg, plan);
    if (rc) { chipText = rc.text; chipCls = rc.cls; }

    const metaLines = meta.length ? meta.map(m => `<div class="t-meta">${m}</div>`).join("") : `<div class="t-meta">${t("checkingDots")}</div>`;
    card.innerHTML = `
      <div class="t-head">
        <div style="min-width:0;">
          <div class="t-title">${title}</div>
          <div class="t-meta">${when}</div>
          ${metaLines}
        </div>
        <span class="pill ${chipCls}">${chipText}</span>
      </div>
      <div class="t-actions"></div>`;
    const actions = card.querySelector(".t-actions");

    if (st === "open" && tg.enabled) {
      const bk = btn(t("bookNow"), "small");
      bk.onclick = async () => { bk.disabled = true; bk.textContent = t("booking"); const r = await send({ cmd: "bookNow", id: tg.id }); flash(r); refresh(); };
      actions.appendChild(bk);
    }
    const recBtn = btn(once ? t("makeWeekly") : t("onceOnly"), "ghost small");
    recBtn.onclick = async () => { await send({ cmd: "setRecurrence", id: tg.id, recurrence: once ? "weekly" : "once" }); refresh(); };
    actions.appendChild(disableIfAutoOff(recBtn));
    // Quick "Skip next" only when there's no month plan (i.e. one-time / date rules);
    // recurring weekly rules skip per-date inside "Plan this month" to avoid duplicate buttons.
    const hasPlan = tg.mode === "weekly" && tg.recurrence !== "once";
    if (info.resolvedDate && tg.enabled && !hasPlan) {
      const sk = btn(t("skip", { date: info.resolvedDate.slice(5) }), "ghost small");
      sk.onclick = async () => { await send({ cmd: "skipNext", id: tg.id }); refresh(); };
      actions.appendChild(disableIfAutoOff(sk));
    }
    // --- Scheduling group: "Make one-time" / "Plan this month" belong together ---
    // Expandable month plan (recurring weekly rules only — not "once").
    // Kept in the same action row (not a separate row) to keep the card compact.
    let pbody = null;
    if (tg.mode === "weekly" && tg.recurrence !== "once") {
      const pb = btn(t("planTitle"), "ghost small");
      actions.appendChild(disableIfAutoOff(pb));
      pbody = makeExpand();
      pb.onclick = () => toggleExpand(pbody, () => renderPlanBody(tg, pbody, card));
    }

    // --- Lifecycle group: Pause / Remove (separated from the scheduling actions) ---
    const sep = document.createElement("span"); sep.className = "act-sep";
    actions.appendChild(sep);
    const pz = btn(tg.enabled ? t("pause") : t("resume"), "ghost small");
    pz.onclick = async () => { await send({ cmd: "toggleTarget", id: tg.id, enabled: !tg.enabled }); refresh(); };
    actions.appendChild(disableIfAutoOff(pz));
    const rm = btn(t("remove"), "ghost small");
    rm.onclick = async () => { await send({ cmd: "removeTarget", id: tg.id }); await renderSchedule(); refresh(); };
    actions.appendChild(rm);

    if (pbody) card.appendChild(pbody);

    list.appendChild(card);
  }
}

// --- month plan (per weekly rule) ---
let planCache = null;
async function getPlan(force) { if (planCache && !force) return planCache; planCache = await send({ cmd: "getPlan" }); return planCache; }
async function renderPlanBody(tg, body, card) {
  const inner = body.querySelector(".expand-inner") || body;
  inner.innerHTML = `<span class="muted">${t("loading")}</span>`;
  let plan = await getPlan();
  const paint = (plan) => {
    const occ = (plan && plan.byRule && plan.byRule[tg.id]) || [];
    if (!occ.length) { inner.innerHTML = `<span class="muted">${t("planEmpty")}</span>`; return; }
    inner.innerHTML = "";
    // Repaint the plan + this card's chip in place — NEVER re-render the whole
    // list (that would collapse the open planner). Cancel also soft-refreshes.
    const reload = async (alsoSoft) => {
      planCache = null;
      const p = await getPlan();
      paint(p);
      const rc = computeChipParts(tg, p);
      const pill = card && card.querySelector(".pill");
      if (pill && rc) { pill.className = "pill " + rc.cls; pill.textContent = rc.text; }
      if (alsoSoft) softRefresh();
    };
    occ.forEach(o => {
      const row = document.createElement("div"); row.className = "plan-row";
      const dd = o.date.slice(8) + "/" + o.date.slice(5, 7);
      let cls = "plan-status", label;
      const acts = [];
      if (o.status === "booked") {
        cls += " booked"; label = t("status_booked");
        if (o.cancelActId) { const c = btn(t("planCancel"), "danger small"); c.onclick = async () => { c.disabled = true; await send({ cmd: "cancelRegistration", actId: o.cancelActId }); reload(true); }; acts.push(c); }
      } else if (o.status === "skipped") {
        cls += " skipped"; label = t("plan_skipped");
        const u = btn(t("planUnskip"), "ghost small"); u.onclick = async () => { await send({ cmd: "unskipDate", id: tg.id, date: o.date }); reload(); }; acts.push(u);
      } else if (o.status === "limit") {
        cls += " limit"; label = t("plan_limit");
      } else if (o.status === "daily") {
        cls += " limit"; label = t("plan_daily");
      } else {
        label = t("plan_scheduled");
        const s = btn(t("planSkip"), "ghost small"); s.onclick = async () => { await send({ cmd: "skipDate", id: tg.id, date: o.date }); reload(); }; acts.push(s);
      }
      row.innerHTML = `<span class="plan-date">${dd}</span><span class="${cls}">${label}</span>`;
      const act = document.createElement("span"); act.className = "plan-act"; acts.forEach(a => act.appendChild(a)); row.appendChild(act);
      inner.appendChild(row);
    });
    const note = document.createElement("div"); note.className = "muted"; note.style.marginTop = "6px"; note.textContent = t("planNote");
    inner.appendChild(note);
  };
  paint(plan);
}

// ---------------------------------------------------------------------------
// Weekly schedule grid
// ---------------------------------------------------------------------------
async function renderSchedule() {
  const el = $("scheduleSection");
  const res = await send({ cmd: "getSchedule" });
  if (!res) { el.innerHTML = `<div class="empty">${t("couldNotSchedule")}</div>`; return; }
  const slots = res.slots || [];
  const targets = res.targets || [];
  const bsch = $("badge-schedule"); if (bsch) bsch.textContent = slots.length || "–";
  if (!slots.length) { el.innerHTML = `<div class="empty">${t("noClasses")}</div>`; return; }
  const isChecked = (s) => targets.some(t2 => t2.mode === "weekly" && Number(t2.weekday) === Number(s.weekday) && t2.time === s.time && (t2.classFilter || "") === (s.className || ""));
  const byDay = {};
  slots.forEach(s => { (byDay[s.weekday] = byDay[s.weekday] || []).push(s); });
  el.innerHTML = "";
  const todayWd = new Date().getDay();
  for (let wd = 0; wd < 7; wd++) {
    const daySlots = byDay[wd];
    if (!daySlots || !daySlots.length) continue;
    const selected = daySlots.filter(isChecked).length;
    const group = document.createElement("div"); group.className = "day-group";
    const hdr = document.createElement("div"); hdr.className = "day-hdr";
    const countTxt = selected ? t("selectedClasses", { sel: selected, n: daySlots.length }) : t("nClasses", { n: daySlots.length });
    hdr.innerHTML = `<span>${dayName(wd)}</span><span class="count">${countTxt} ▾</span>`;
    const body = document.createElement("div"); body.className = "day-slots" + (wd === todayWd ? " open" : "");
    daySlots.forEach(s => {
      const row = document.createElement("label"); row.className = "slot-row" + (isChecked(s) ? " checked" : "");
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = isChecked(s);
      cb.onchange = async () => {
        if (cb.checked) {
          toast(t("adding"));
          const r = await send({ cmd: "addSlot", slot: s });
          const a = r && r.added;
          if (a) {
            let m;
            if (a.booked) m = t("bookedToast", { cls: a.className || s.className, date: a.resolvedDate || "" });
            else if (a.kind === "already") m = t("alreadyToast");
            else if (a.kind === "limit") m = t("limitToast");
            else if (a.status === "open" && a.needsAutoBook) m = t("openNeedAuto");
            else if (a.status === "open") m = t("openBooking");
            else if (a.status === "full") m = t("fullToast");
            else if (a.status === "waiting" && a.openAt) m = t("scheduledToast", { clock: fmtClock(a.openAt) });
            else m = t("addedToast");
            if (a.sameDayWarning) m += t("dayNote", { n: a.dailyLimit || 1 });
            toast(m);
          } else toast(t("addedToast"));
        } else {
          await send({ cmd: "removeSlot", slot: s });
        }
        await renderSchedule(); refresh();
      };
      const time = document.createElement("span"); time.className = "slot-time"; time.textContent = s.time;
      const cls = document.createElement("span"); cls.className = "slot-class"; cls.textContent = s.className || "Class";
      const tch = document.createElement("span"); tch.className = "slot-teacher"; tch.textContent = s.teacher ? ("· " + s.teacher) : "";
      row.appendChild(cb); row.appendChild(time); row.appendChild(cls); row.appendChild(tch);
      body.appendChild(row);
    });
    hdr.onclick = () => body.classList.toggle("open");
    group.appendChild(hdr); group.appendChild(body);
    el.appendChild(group);
  }
}

// ---------------------------------------------------------------------------
// Auth banner
// ---------------------------------------------------------------------------
function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map(p => p[0]).join("");
}
// Unified header status row: avatar + name + connection dot + state + action.
function renderAuth(auth, client) {
  const name = client && client.name;
  const photo = client && client.photo;
  const av = $("hdrAvatar");
  av.textContent = "";
  if (photo) {
    const im = document.createElement("img");
    im.alt = ""; im.referrerPolicy = "no-referrer";
    im.onerror = () => { av.textContent = name ? initials(name) : ""; };  // fall back to initials
    im.src = photo;
    av.appendChild(im);
  } else if (name) {
    av.textContent = initials(name);
  }
  $("hdrName").textContent = name || "";

  const dot = $("hdrDot"), state = $("hdrState");
  const signedOut = !!auth && auth.loggedIn === false;  // definitely not signed in
  if (!auth || auth.loggedIn === null) {
    dot.className = "status-dot amber"; state.textContent = t("checkingSignin");
  } else if (auth.loggedIn) {
    dot.className = "status-dot green"; state.textContent = t("hdrSignedIn");
  } else {
    // Refresh (in this row) opens Home when signed out — no separate button needed.
    dot.className = "status-dot red";
    state.textContent = (auth.reason && /sync/i.test(auth.reason)) ? t("hdrNotSynced") : t("hdrNotSignedIn");
  }
  // Show the big call-to-action (and hide the tabs/panels) only when confirmed signed out.
  const body = document.querySelector(".body");
  if (body) body.classList.toggle("signedout", signedOut);
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------
// The subscription with a real monthly quota (the plan that drives auto-booking).
// May not be items[0] once bonus/single-entry products are added to the account.
function subMonthlyItem(subscription) {
  const items = (subscription && subscription.items) || [];
  return items.find(s => s.monthly) || null;
}
// Extra entries: active products WITHOUT a monthly quota (single-entry / bonus / trial).
function subBonusItems(subscription) {
  const items = (subscription && subscription.items) || [];
  return items.filter(s => !s.monthly && !s.isFrozen);
}
// Badge text — always show the monthly balance even when it isn't the first
// item, and append "+N" for bonus entries so they're never hidden.
function subBadgeText(subscription) {
  const m = subMonthlyItem(subscription), b = subBonusItems(subscription).length;
  if (m) return `${m.monthly.remaining}/${m.monthly.max}${b ? "+" + b : ""}`;
  return b ? "+" + b : "–";
}

function renderSubscription(subscription) {
  const el = $("subSection");
  const items = subscription && subscription.items ? subscription.items : [];
  if (!items.length) { el.innerHTML = `<div class="empty">${t("noSubscription")}</div>`; return; }
  const monthlyItem = subMonthlyItem(subscription);
  const bonusCount = subBonusItems(subscription).length;

  // Top balance summary so the number is always visible at a glance, even if the
  // monthly plan isn't the first card and even when there are only bonus entries.
  let html = "";
  if (monthlyItem || bonusCount) {
    const parts = [];
    if (monthlyItem) parts.push(`🎟️ ${t("monthlyLeft", { r: monthlyItem.monthly.remaining, m: monthlyItem.monthly.max })}`);
    if (bonusCount) parts.push(`🎁 ${t("sub_bonusN", { n: bonusCount })}`);
    html += `<div class="card sub-summary"><div class="t-title">${t("sub_balance")}</div><div class="t-meta">${parts.join(" &nbsp;·&nbsp; ")}</div></div>`;
  }

  html += items.map(s => {
    const isBonus = !s.monthly && !s.isFrozen;
    const meta = [];
    if (s.renewText) meta.push(s.renewText);
    if (s.monthly) meta.push(t("monthlyLeft", { r: s.monthly.remaining, m: s.monthly.max }));
    if (s.daily && s.daily.max != null) meta.push(t("dailyCap", { n: s.daily.max }));
    if (s.endDate) meta.push(t("validUntil", { d: s.endDate }));
    if (s.isFrozen) meta.push(t("frozen"));
    const low = s.monthly && s.monthly.remaining === 0;
    return `<div class="card" style="${low ? 'border-color:var(--err-bd);' : ''}">
      <div class="t-head">
        <div class="t-title">${s.name || s.title || t("subDefault")}</div>
        ${isBonus ? `<span class="pill bonus">${t("sub_bonusTag")}</span>` : ''}
      </div>
      ${meta.length ? `<div class="t-meta">${meta.join(" &nbsp;·&nbsp; ")}</div>` : ''}
      ${low ? `<div class="t-meta" style="color:var(--red);">${t("balanceUsed")}</div>` : ''}
    </div>`;
  }).join("") + `<div class="muted" style="margin:-2px 0 4px;">${t("syncedAgo", { t: fmtSync(subscription.syncedAt) })}${subscription.source === 'api' ? t("live") : ''}</div>`;
  el.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Participants / lesson info
// ---------------------------------------------------------------------------
const infoCache = {};
async function getInfo(classId) {
  if (infoCache[classId]) return infoCache[classId];
  const r = await send({ cmd: "classInfo", classId });
  if (r && r.ok) infoCache[classId] = r.info;
  return r && r.ok ? r.info : null;
}
function sanitizeHtml(html) {
  const doc = document.implementation.createHTMLDocument("");
  doc.body.innerHTML = html || "";
  doc.querySelectorAll("script, style, iframe").forEach(n => n.remove());
  const STRIP = ["color", "background", "background-color", "font-family", "font-size"];
  doc.querySelectorAll("*").forEach(n => {
    [...n.attributes].forEach(a => { if (/^on/i.test(a.name)) n.removeAttribute(a.name); });
    // Drop the studio's hard-coded colors/fonts so content inherits our theme
    // (fixes dark-on-dark unreadable lesson text in dark mode).
    if (n.style) { STRIP.forEach(p => { try { n.style.removeProperty(p); } catch (e) {} }); if (!n.getAttribute("style")) n.removeAttribute("style"); }
  });
  doc.querySelectorAll("a").forEach(a => { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); });
  return doc.body.innerHTML;
}
function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
async function toggleInfo(classId, body, kind) {
  if (body.classList.contains("open")) { body.classList.remove("open"); return; }
  body.classList.add("open");
  const inner = body.querySelector(".expand-inner") || body;
  if (!body.dataset.loaded) {
    inner.innerHTML = `<span class="muted">${t("loading")}</span>`;
    const info = await getInfo(classId);
    if (!info) { inner.innerHTML = `<span class="muted">${t("couldNotLoad")}</span>`; return; }
    if (kind === "participants") {
      const parts = info.participants || [];
      let h = `<div class="subhdr">${t("registeredCount", { r: info.registered ?? parts.length, m: info.registered_max ?? "?" })}</div>`;
      h += parts.length ? `<div class="chips">${parts.map(p => `<span class="chip">${escapeHtml(p.name)}</span>`).join("")}</div>` : `<span class="muted">${t("noNames")}</span>`;
      if (info.waitings && info.waitings.length) {
        h += `<div class="subhdr">${t("waitlist", { n: info.waitings.length })}</div><div class="chips">${info.waitings.map(p => `<span class="chip wait">${escapeHtml(p.name)}</span>`).join("")}</div>`;
      }
      inner.innerHTML = h;
    } else {
      inner.innerHTML = info.description ? `<div class="lesson-desc">${sanitizeHtml(info.description)}</div>` : `<span class="muted">${t("noDetails")}</span>`;
    }
    body.dataset.loaded = "1";
  }
}

// ---------------------------------------------------------------------------
// Upcoming registrations
// ---------------------------------------------------------------------------
function renderRegistrations(registrations) {
  const el = $("regSection");
  // Hint depends on view: the "expand for participants" text only applies to the card list.
  const hintEl = document.querySelector('.panel[data-panel="upcoming"] .panel-hint');
  if (hintEl) hintEl.textContent = t(getView("upcoming") === "week" ? "hint_upcoming_week" : "hint_upcoming");
  if (!registrations) { el.innerHTML = `<div class="empty">${t("openHomeSync")}</div>`; return; }
  const items = (registrations.items || []).slice();
  if (registrations.empty || !items.length) {
    el.innerHTML = `<div class="empty">${t("noUpcoming")}<div class="muted">${t("syncedAgo", { t: fmtSync(registrations.syncedAt) })}</div></div>`;
    return;
  }
  // Order by soonest first (missing timestamps sort last).
  items.sort((a, b) => (a.startAt || Infinity) - (b.startAt || Infinity));

  // Week view (7 day-columns) instead of the card list.
  if (getView("upcoming") === "week") {
    const entries = items.map(e => {
      const lines = [];
      if (e.teacher) lines.push("👤 " + e.teacher);
      const d = e.startAt != null ? new Date(e.startAt) : null;
      const md = d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : shortDate(e.date);
      if (md) lines.push("📅 " + md);
      if (e.cancellation) lines.push(e.cancellation);
      return {
        wd: e.startAt != null ? new Date(e.startAt).getDay() : 7,
        time: e.time, title: e.className || e.text || t("subDefault"), cls: "booked", lines,
        actions: (inner) => buildRegWeekActions(inner, e)
      };
    });
    el.innerHTML = "";
    renderWeekGrid(el, entries);
    const note = document.createElement("div");
    note.className = "muted"; note.style.margin = "6px 0 0";
    note.textContent = t("fromPage", { t: fmtSync(registrations.syncedAt) });
    el.appendChild(note);
    return;
  }

  el.innerHTML = "";
  items.forEach(e => {
    const meta = [];
    if (e.teacher) meta.push(e.teacher);
    if (e.date) meta.push(e.date);
    const title = e.className || e.text || t("subDefault");
    const card = document.createElement("div");
    card.className = "card target booked";
    card.innerHTML = `
      <div class="t-head">
        <div class="t-title">${title}</div>
        <div class="t-head-act"></div>
      </div>
      ${meta.length ? `<div class="t-meta">${meta.join(" &nbsp;·&nbsp; ")}</div>` : ""}
      ${e.cancellation ? `<div class="t-meta">${e.cancellation}</div>` : ""}`;
    const headAct = card.querySelector(".t-head-act");
    if (e.bookingActId) {
      const c = btn(t("cancelLesson"), "danger small");
      c.onclick = async () => { c.disabled = true; c.textContent = t("cancelling"); const r = await send({ cmd: "cancelRegistration", actId: e.bookingActId }); flash(r); refresh(); };
      headAct.appendChild(c);
    } else {
      headAct.innerHTML = `<span class="muted">${t("cancelOnSite")}</span>`;
    }
    if (e.classId) {
      const row = document.createElement("div"); row.className = "expand-row";
      const pBtn = btn(t("participants"), ""); const iBtn = btn(t("lessonInfo"), "");
      row.appendChild(pBtn); row.appendChild(iBtn);
      const pBody = makeExpand();
      const iBody = makeExpand();
      pBtn.onclick = () => toggleInfo(e.classId, pBody, "participants");
      iBtn.onclick = () => toggleInfo(e.classId, iBody, "info");
      card.appendChild(row); card.appendChild(pBody); card.appendChild(iBody);
    }
    el.appendChild(card);
  });
  const note = document.createElement("div");
  note.className = "muted"; note.style.margin = "-2px 0 4px";
  note.textContent = t("fromPage", { t: fmtSync(registrations.syncedAt) });
  el.appendChild(note);
}

// ---------------------------------------------------------------------------
// refresh + wiring
// ---------------------------------------------------------------------------
// Expose the sticky tab-bar height so the Period weekday header can pin just
// below it (top: var(--tabs-h)) instead of hiding under the tabs.
function setTabsHeightVar() {
  const tabs = document.querySelector(".tabs");
  if (tabs) document.documentElement.style.setProperty("--tabs-h", tabs.offsetHeight + "px");
}
window.addEventListener("resize", setTabsHeightVar);

async function refresh() {
  planCache = null;   // month plan re-fetches on next expand
  setTabsHeightVar();
  const state = await send({ cmd: "getState" });
  if (!state) return;
  const { config, targets, auth, subscription, registrations, client } = state;
  lastRegistrations = registrations || null;   // used by the Period grid to overlay external bookings
  if (config && config.lang && config.lang !== LANG) applyLang(config.lang);
  renderAuth(auth, client);
  renderSubscription(subscription);
  renderRegistrations(registrations);

  const regCount = registrations && registrations.items ? registrations.items.length : 0;
  const ruleCount = (targets || []).filter(x => x.mode === "weekly" || x.mode === "date").length;
  $("badge-upcoming").textContent = regCount;
  $("badge-slots").textContent = ruleCount;
  $("badge-sub").textContent = subBadgeText(subscription);

  $("autoBook").checked = !!config.autoBook;
  setAutoBookState(!!config.autoBook);
  $("companyNum").value = config.companyNum || "";
  $("getUrl").value = config.getUrl || "";
  $("pollMinutes").value = config.pollMinutes || 1;
  $("snipeWindowMin").value = config.snipeWindowMin || 5;
  $("dailyLimitOverride").value = config.dailyLimitOverride || 0;
  if ($("lang")) $("lang").value = config.lang || "en";
  if ($("theme")) $("theme").value = config.theme || "system";
  applyTheme(config.theme || "system");
  const plan = await getPlan();   // month-plan rollup for the chips (storage-only, cheap)
  renderTargets(targets || [], plan);
  renderFitbit();                 // fire-and-forget — settings card only
}

$("checkNow").onclick = async () => { $("checkNow").textContent = t("checking"); await send({ cmd: "checkNow" }); $("checkNow").textContent = t("checkNow"); refresh(); };

// List / Week view switch buttons
document.querySelectorAll(".viewtoggle .vt-btn").forEach(b => {
  b.onclick = async () => {
    const which = b.closest(".viewtoggle").dataset.viewFor;
    if (getView(which) === b.dataset.view) return;      // already in this view
    setView(which, b.dataset.view);
    applyViewToggleUI(which);
    await refresh();                                    // re-render into the new view
    playSwitchAnim(which === "upcoming" ? $("regSection") : $("list"));
  };
});

// Inline weekly-schedule picker (moved out of its own tab into "My weekly slots")
function syncSchedulerBtn() {
  const open = $("schedulerWrap") && $("schedulerWrap").classList.contains("open");
  if ($("toggleScheduler")) $("toggleScheduler").textContent = t(open ? "closeScheduler" : "scheduleLessons");
}
$("toggleScheduler").onclick = () => {
  const w = $("schedulerWrap");
  const opening = !w.classList.contains("open");
  w.classList.toggle("open");
  syncSchedulerBtn();
  if (opening) renderSchedule();
};
$("autoBook").onchange = async () => {
  const on = $("autoBook").checked;
  setAutoBookState(on);                                  // instant On/Off label
  toast(t(on ? "autobookOnMsg" : "autobookOffMsg"));     // clear explanation of what it does now
  if ($("slotsAutoWarn")) $("slotsAutoWarn").style.display = on ? "none" : "flex";
  await send({ cmd: "updateConfig", config: { autoBook: on } });
  refresh();   // re-render slots so scheduling buttons enable/disable to match
};
// "Turn on" shortcut inside the weekly-slots warning banner
if ($("slotsAutoOn")) $("slotsAutoOn").onclick = async () => {
  $("autoBook").checked = true;
  setAutoBookState(true);
  if ($("slotsAutoWarn")) $("slotsAutoWarn").style.display = "none";
  toast(t("autobookOnMsg"));
  await send({ cmd: "updateConfig", config: { autoBook: true } });
  refresh();
};
$("lang").onchange = async () => {
  applyLang($("lang").value);
  await send({ cmd: "updateConfig", config: { lang: $("lang").value } });
  await renderSchedule(); refresh();
};
$("theme").onchange = async () => {
  applyTheme($("theme").value);
  await send({ cmd: "updateConfig", config: { theme: $("theme").value } });
};
if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", async () => {
    const st = await send({ cmd: "getState" });
    if (st && st.config && (st.config.theme || "system") === "system") applyTheme("system");
  });
}
$("saveCfg").onclick = async () => {
  await send({ cmd: "updateConfig", config: {
    companyNum: $("companyNum").value.trim(),
    getUrl: $("getUrl").value.trim(),
    pollMinutes: Number($("pollMinutes").value) || 1,
    snipeWindowMin: Number($("snipeWindowMin").value) || 5,
    dailyLimitOverride: Math.max(0, Number($("dailyLimitOverride").value) || 0)
  }});
  toast(t("settingsSaved"));
  renderSchedule();
};
// ---------------------------------------------------------------------------
// Fitbit sync card (settings panel)
// ---------------------------------------------------------------------------
function fbStatusLine(s) {
  if (!s.connected) return s.needsReconnect ? t("fb_reconnect") : t("fb_not_connected");
  const parts = [t("fb_connected")];
  if (s.syncedCount) parts.push(t("fb_synced_total", { n: s.syncedCount }));
  if (s.lastSync && s.lastSync.at) {
    parts.push(t("fb_last_sync", { when: fmtClock(s.lastSync.at), added: s.lastSync.added || 0 }));
    if (s.lastSync.error) parts.push(t("fb_sync_error", { err: s.lastSync.error }));
  }
  return parts.join(" · ");
}
async function renderFitbit(status) {
  if (!$("fitbitCard")) return;
  const s = status || await send({ cmd: "fitbitStatus" });
  if (!s) return;
  $("fbStatus").textContent = fbStatusLine(s);
  $("fbSetup").style.display = s.connected ? "none" : "";
  $("fbControls").style.display = s.connected ? "" : "none";
  if (!s.connected) {
    if (!$("fbClientId").value) $("fbClientId").value = s.clientId || "";
    $("fbSetupHint").textContent = t("fb_setup_hint", { url: s.redirectUrl || "" });
  } else {
    $("fbDuration").value = s.durationMin || 60;
    $("fbSince").value = s.sinceDate || "";
    $("fbAutoSync").checked = s.autoSync !== false;
  }
}
if ($("fitbitCard")) {
  $("fbConnect").onclick = async () => {
    const clientId = $("fbClientId").value.trim();
    const clientSecret = $("fbClientSecret").value.trim();
    if (!clientId || !clientSecret) return toast("⚠️ " + t("fb_client") + " + " + t("fb_secret"));
    const r = await send({ cmd: "fitbitConnect", clientId, clientSecret });
    if (r && r.ok) toast(t("fb_connected")); else toast("⚠️ " + ((r && r.error) || "failed"));
    renderFitbit(r && r.status);
  };
  $("fbDisconnect").onclick = async () => {
    const r = await send({ cmd: "fitbitDisconnect" });
    renderFitbit(r && r.status);
  };
  $("fbSyncNow").onclick = async () => {
    $("fbSyncNow").textContent = t("fb_syncing");
    const r = await send({ cmd: "fitbitSyncNow" });
    $("fbSyncNow").textContent = t("fb_sync_now");
    if (r && r.error) toast("⚠️ " + r.error);
    else toast(t("fb_last_sync", { when: fmtClock(Date.now()), added: (r && r.added) || 0 }));
    renderFitbit(r && r.status);
  };
  const fbSaveOpts = async () => {
    // sinceDate always sent as a string: "" clears the boundary (= sync all fetched history)
    const r = await send({ cmd: "fitbitSetOpts", durationMin: Number($("fbDuration").value) || 60, autoSync: $("fbAutoSync").checked, sinceDate: $("fbSince").value });
    renderFitbit(r && r.status);
  };
  $("fbDuration").onchange = fbSaveOpts;
  $("fbSince").onchange = fbSaveOpts;
  $("fbAutoSync").onchange = fbSaveOpts;
}

// backup / transfer
$("btnExport").onclick = async () => {
  const r = await send({ cmd: "exportState" });
  const json = JSON.stringify(r.data, null, 2);
  $("ioBox").value = json;
  try { await navigator.clipboard.writeText(json); } catch (e) {}
  toast(t("exportedToast"));
};
$("btnDownload").onclick = async () => {
  let json = $("ioBox").value.trim();
  if (!json) { const r = await send({ cmd: "exportState" }); json = JSON.stringify(r.data, null, 2); $("ioBox").value = json; }
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "boost-autobook-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$("btnImport").onclick = async () => {
  let data;
  try { data = JSON.parse($("ioBox").value.trim()); } catch (e) { return toast("⚠️ " + t("importFail")); }
  const r = await send({ cmd: "importState", data });
  if (r && r.ok) { toast(t("importedToast", { n: r.count })); await renderSchedule(); refresh(); }
  else toast("⚠️ " + t("importFail"));
};
$("importFile").onchange = (ev) => {
  const f = ev.target.files && ev.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { $("ioBox").value = rd.result; };
  rd.readAsText(f);
};

$("refreshBtn").onclick = async () => {
  // Signed out → open Home (visible) so the user can sign in. Signed in → sync.
  const st = await send({ cmd: "getState" });
  if (!(st && st.auth && st.auth.loggedIn)) { await send({ cmd: "openLogin" }); return; }
  $("refreshBtn").textContent = t("refreshing"); $("refreshBtn").disabled = true;
  await send({ cmd: "syncHome" });
  historyCache = null;   // Period view re-pulls History on next render
  await refresh();
  $("refreshBtn").textContent = t("refresh"); $("refreshBtn").disabled = false;
};

// Signed-out call-to-action → open BoostApp so the user can sign in.
if ($("soBtn")) $("soBtn").onclick = () => send({ cmd: "openLogin" });

// Opens the full-tab History dashboard (past events analytics).
if ($("historyBtn")) $("historyBtn").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("history.html") });

// Opens this same popup as a full browser tab (wide layout via ?page=1).
if ($("fullPageBtn")) $("fullPageBtn").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?page=1") });

// tabs
function showTab(name) {
  document.querySelectorAll(".tab").forEach(t2 => t2.classList.toggle("active", t2.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("hidden", p.dataset.panel !== name));
  try { localStorage.setItem("bsab_tab", name); } catch (e) {}
}
document.querySelectorAll(".tab").forEach(t2 => { t2.onclick = () => showTab(t2.dataset.tab); });
let startTab = "upcoming";
try { startTab = localStorage.getItem("bsab_tab") || "upcoming"; } catch (e) {}
if (startTab === "schedule") startTab = "slots";   // legacy tab removed → its content lives in "My weekly slots"
showTab(startTab);

// initial language from storage (fast paint), then full refresh
(async () => {
  try {
    const st = await send({ cmd: "getState" });
    applyLang((st && st.config && st.config.lang) || "en");
    applyTheme((st && st.config && st.config.theme) || "system");
  } catch (e) { applyLang("en"); applyTheme("system"); }
  refresh();
  renderSchedule();
  send({ cmd: "verifyAuth" }).then(refresh);
  send({ cmd: "reenrich" }).then(refresh);   // recompute slot chips so they're never stale
})();

// ---------------------------------------------------------------------------
// Version footer, update banner, feedback link
// Zip installs never auto-update, so the background checks GitHub Releases
// daily and we surface a banner here when a newer version exists.
// ---------------------------------------------------------------------------
(async () => {
  const version = chrome.runtime.getManifest().version;
  if ($("verLabel")) $("verLabel").textContent = "v" + version;
  let u = null;
  try { u = await send({ cmd: "getUpdateInfo" }); } catch (e) {}
  const fb = $("feedbackLink"), sep = $("feedbackSep");
  // Feedback goes to the landing-page form (no GitHub account needed) —
  // the ?v= param is picked up by the form as the extension version.
  if (fb) fb.href = "https://philusha1983.github.io/boostapp/?v=" + version + "#feedback";
  if (u && u.repo) {
    if (u.updateAvailable && $("updateBanner")) {
      const b = $("updateBanner");
      b.innerHTML = "";
      const a = document.createElement("a");
      a.href = u.url || `https://github.com/${u.repo}/releases/latest`;
      a.target = "_blank"; a.rel = "noopener";
      a.style.cssText = "color:#fff; font-weight:600;";
      a.textContent = `⬆ Update available: v${u.latest} (you have v${version}) — download`;
      b.appendChild(a);
      b.style.display = "block";
    }
  }
  // (feedback link no longer depends on the repo config — it points at the
  // landing-page form, which works without a GitHub account)
})();
