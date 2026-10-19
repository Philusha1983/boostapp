/* Boost Auto-Book — onboarding walkthrough + "What's new" intro
 *
 * Loaded AFTER popup.js (relies on its globals: I18N, t(), applyLang-compatible
 * keys, $(), showTab()). Self-contained otherwise: injects its own styles and
 * DOM, and keeps its own storage keys.
 *
 * ── How it works ────────────────────────────────────────────────────────────
 * First open ever            → full spotlight tour, then bsab_tour_done = version.
 * First open while signed out→ short tour (welcome → sign-in CTA);
 *                              bsab_tour_done = "pending-signin", so the FULL
 *                              tour runs once more after the user signs in.
 * After an update            → versions in WHATS_NEW newer than
 *                              bsab_seen_version are shown once as a
 *                              "What's new" card; "Show me" spotlights any tour
 *                              steps tagged addedIn one of those versions.
 * Footer "Tour" link         → replays the full tour anytime.
 *
 * ── RELEASE CHECKLIST (keep the walkthrough alive!) ─────────────────────────
 * Whenever you ship a user-visible feature:
 *   1. Add a WHATS_NEW["x.y.z"] entry below (translated in all 5 languages).
 *   2. If the feature has UI worth pointing at, add a TOUR step with
 *      addedIn: "x.y.z" — "Show me" after the update will spotlight it, and
 *      new users get it as part of the full tour automatically.
 *   3. Keep CHANGELOG.md in sync as usual.
 */

/* eslint-disable no-undef */
(() => {
  "use strict";

  // ── i18n (merged into popup.js's I18N so t()/applyLang pick them up) ──────
  const WT_I18N = {
    en: {
      tour_replay: "🎓 Tour",
      tour_skip: "Skip", tour_back: "Back", tour_next: "Next", tour_done: "Done",
      tour_of: "{i}/{n}",
      tour_welcome_t: "Welcome to Boost Auto-Book! 👋",
      tour_welcome_b: "A 30-second tour of what the extension can do. You can replay it anytime with the 🎓 Tour link in the footer.",
      tour_signin_t: "First: sign in",
      tour_signin_b: "The extension works with your BoostApp account. Click here to open BoostApp and sign in — then open this popup again for the full tour.",
      tour_auto_t: "The master switch",
      tour_auto_b: "When Auto-book is ON, your chosen weekly slots are booked automatically the instant the 72-hour registration window opens.",
      tour_status_t: "Your status",
      tour_status_b: "Who's signed in and how fresh the data is. ↻ Refresh re-syncs everything from BoostApp.",
      tour_tabs_t: "Everything lives in four tabs",
      tour_tabs_b: "Upcoming lessons · your weekly slots · your subscription · settings.",
      tour_upcoming_t: "Upcoming",
      tour_upcoming_b: "Lessons you're registered for. Expand one to see participants and lesson info — or cancel it from here.",
      tour_slots_t: "Pick your weekly slots",
      tour_slots_b: "Open the scheduler and tick the classes you want every week. The extension registers them for you the moment booking opens.",
      tour_views_t: "Three ways to look at it",
      tour_views_b: "List, week grid, or a full calendar of your subscription period — including a preview of the next period.",
      tour_sub_t: "Subscription at a glance",
      tour_sub_b: "Entries left, daily cap, validity — synced from BoostApp.",
      tour_history_t: "History dashboard",
      tour_history_b: "Opens a full-page dashboard of your past classes with month-by-month stats.",
      tour_settings_t: "Settings & backup",
      tour_settings_b: "Language, theme, polling — and Export/Import to move your slots to another browser.",
      tour_fullpage_t: "Need more room?",
      tour_fullpage_b: "This opens the whole dashboard as a full browser page — same features, roomier layout with multi-column lists and a bigger calendar.",
      wn_130_1: "⛶ Full-page mode — open the dashboard as a browser tab with a wide, multi-column layout (button in the header)",
      wn_181_1: "🏷️ The extension now follows your own studio. It works out which BoostApp studio you're signed in to and switches to it by itself — schedule, bookings and history — instead of staying on the one it was packaged with. Until your studio is known, Sign in opens BoostApp's main login page.",
      wn_180_1: "\ud83d\udcaa Past Events \u2192 Health now works without a fitness tracker: every lesson you attended, with the muscles its workout plan worked \u2014 per class and lesson by lesson. Connect a tracker to add heart rate, zones and steps on top. A lesson with a plan but no heart rate opens now too.",
      wn_171_1: "\u2699\ufe0f The studio renamed its classes \u2014 Training Harmony is now FUNCTIONAL and Calisapiens is now CALISTHENICS, alongside the new STRENGTH and FLEXIBILITY. Your booking rules were updated to the new names, and lesson plans, the muscle map and your history now follow a class across the rename instead of splitting it in two.",
      wn_170_1: "💪 Muscle map — see which muscles each lesson works, part by part, on a body figure: in Upcoming (open Lesson info) and under each lesson's heart-rate chart in Past Events → Health, plus a This-week view. The figure follows your BoostApp profile, or pick Male / Female / Not specified in Settings.",
      wn_160_1: "🧩 Experimental: your workout plan on the heart-rate chart — the lesson's parts (warm-up, A, B, C) are shaded on the curve, hovering shows the exact exercise for timed parts, and the plan is listed below. Placement is estimated from your heart rate; drag an edge to fix it.",
      wn_150_1: "📈 New Health tab in Past Events — heart rate, highest heart rate, time in the zone and steps for every lesson, averages per lesson type, and a click-to-open heart-rate curve coloured by zone. Zones are matched to your Fitbit zones; everything stays in this browser.",
      wn_141_1: "❤️ Fitbit sync fix — heart rate and heart-rate zones show on synced lessons again (a Google change had been dropping them since Sept 11). Recent lessons are repaired automatically.",
      wn_140_1: "⌚ Fitbit sync — attended lessons are auto-logged to Fitbit as workouts (with heart rate & calories) minutes after class, and flow on to Health Connect. Set it up in Settings.",
      tour_finish_t: "You're all set! ✅",
      tour_finish_b: "Questions or ideas? Use the Feedback link in the footer. Replay this tour anytime with 🎓 Tour.",
      wn_title: "✨ What's new",
      wn_ver: "Version {v}",
      wn_gotit: "Got it", wn_showme: "Show me",
      wn_120_1: "🎓 Guided tour for new users — replay it anytime from the footer",
      wn_120_2: "✨ This \"What's new\" card — after each update you'll see the highlights, once"
    },
    he: {
      tour_replay: "🎓 סיור",
      tour_skip: "דלג", tour_back: "חזרה", tour_next: "הבא", tour_done: "סיום",
      tour_of: "{i}/{n}",
      tour_welcome_t: "ברוכים הבאים ל‑Boost Auto-Book!‏ 👋",
      tour_welcome_b: "סיור של 30 שניות על מה שהתוסף יודע לעשות. אפשר להפעיל אותו שוב בכל רגע דרך קישור 🎓 סיור בתחתית.",
      tour_signin_t: "קודם כול: התחברות",
      tour_signin_b: "התוסף עובד עם חשבון BoostApp שלך. לחצו כאן כדי לפתוח את BoostApp ולהתחבר — ואז פתחו שוב את החלון לסיור המלא.",
      tour_auto_t: "המתג הראשי",
      tour_auto_b: "כשההזמנה האוטומטית פעילה, המשבצות השבועיות שבחרתם נרשמות אוטומטית ברגע שחלון ההרשמה של 72 השעות נפתח.",
      tour_status_t: "הסטטוס שלך",
      tour_status_b: "מי מחובר ומתי הנתונים סונכרנו. ↻ רענון מסנכרן הכול מחדש מ‑BoostApp.",
      tour_tabs_t: "הכול בארבע לשוניות",
      tour_tabs_b: "שיעורים קרובים · המשבצות השבועיות · המנוי · הגדרות.",
      tour_upcoming_t: "שיעורים קרובים",
      tour_upcoming_b: "השיעורים שנרשמתם אליהם. הרחיבו כדי לראות משתתפים ותוכן — או בטלו מכאן.",
      tour_slots_t: "בחרו משבצות שבועיות",
      tour_slots_b: "פתחו את המתזמן וסמנו את השיעורים הרצויים בכל שבוע. התוסף ירשום אתכם ברגע שההרשמה נפתחת.",
      tour_views_t: "שלוש תצוגות",
      tour_views_b: "רשימה, רשת שבועית, או לוח שנה מלא של תקופת המנוי — כולל תצוגה מקדימה של התקופה הבאה.",
      tour_sub_t: "המנוי במבט אחד",
      tour_sub_b: "כניסות שנותרו, מגבלה יומית, תוקף — מסונכרן מ‑BoostApp.",
      tour_history_t: "לוח היסטוריה",
      tour_history_b: "פותח דשבורד במסך מלא של השיעורים שעברו, עם סטטיסטיקות לפי חודשים.",
      tour_settings_t: "הגדרות וגיבוי",
      tour_settings_b: "שפה, ערכת נושא, תדירות בדיקה — וייצוא/ייבוא להעברת המשבצות לדפדפן אחר.",
      tour_fullpage_t: "צריך יותר מקום?",
      tour_fullpage_b: "פותח את כל הדשבורד כעמוד דפדפן מלא — אותן יכולות, פריסה מרווחת עם רשימות במספר עמודות ולוח שנה גדול יותר.",
      wn_130_1: "⛶ מצב מסך מלא — פתחו את הדשבורד כלשונית דפדפן עם פריסה רחבה במספר עמודות (כפתור בכותרת)",
      wn_181_1: "🏷️ התוסף עוקב עכשיו אחרי הסטודיו שלכם. הוא מזהה לאיזה סטודיו ב‎BoostApp אתם מחוברים ועובר אליו לבד — לוח השיעורים, ההרשמות וההיסטוריה — במקום להישאר על זה שהגיע עם ההתקנה. עד שהסטודיו מזוהה, כפתור ההתחברות פותח את דף הכניסה הראשי של BoostApp.",
      wn_180_1: "\ud83d\udcaa \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd \u05e7\u05d5\u05d3\u05de\u05d9\u05dd \u2190 \u05d1\u05e8\u05d9\u05d0\u05d5\u05ea \u05e2\u05d5\u05d1\u05d3 \u05e2\u05db\u05e9\u05d9\u05d5 \u05d2\u05dd \u05d1\u05dc\u05d9 \u05de\u05d3 \u05db\u05d5\u05e9\u05e8: \u05db\u05dc \u05d4\u05e9\u05d9\u05e2\u05d5\u05e8\u05d9\u05dd \u05e9\u05d4\u05d9\u05d9\u05ea\u05dd \u05d1\u05d4\u05dd, \u05e2\u05dd \u05d4\u05e9\u05e8\u05d9\u05e8\u05d9\u05dd \u05e9\u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05d4\u05d0\u05d9\u05de\u05d5\u05df \u05d4\u05e4\u05e2\u05d9\u05dc\u05d4 \u2014 \u05dc\u05e4\u05d9 \u05e1\u05d5\u05d2 \u05d0\u05d9\u05de\u05d5\u05df \u05d5\u05dc\u05e4\u05d9 \u05e9\u05d9\u05e2\u05d5\u05e8. \u05d7\u05d9\u05d1\u05d5\u05e8 \u05de\u05d3 \u05db\u05d5\u05e9\u05e8 \u05de\u05d5\u05e1\u05d9\u05e3 \u05dc\u05d6\u05d4 \u05d3\u05d5\u05e4\u05e7, \u05d0\u05d6\u05d5\u05e8\u05d9\u05dd \u05d5\u05e6\u05e2\u05d3\u05d9\u05dd. \u05d2\u05dd \u05e9\u05d9\u05e2\u05d5\u05e8 \u05e2\u05dd \u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05d5\u05d1\u05dc\u05d9 \u05d3\u05d5\u05e4\u05e7 \u05e0\u05e4\u05ea\u05d7 \u05e2\u05db\u05e9\u05d9\u05d5.",
      wn_171_1: "\u2699\ufe0f \u05d4\u05e1\u05d8\u05d5\u05d3\u05d9\u05d5 \u05e9\u05d9\u05e0\u05d4 \u05d0\u05ea \u05e9\u05de\u05d5\u05ea \u05d4\u05d0\u05d9\u05de\u05d5\u05e0\u05d9\u05dd \u2014 Training Harmony \u05d4\u05e4\u05da \u05dc\u200eFUNCTIONAL \u05d5\u200eCalisapiens \u05dc\u200eCALISTHENICS, \u05dc\u05e6\u05d3 STRENGTH \u05d5\u200eFLEXIBILITY \u05d4\u05d7\u05d3\u05e9\u05d9\u05dd. \u05db\u05dc\u05dc\u05d9 \u05d4\u05d4\u05e8\u05e9\u05de\u05d4 \u05e9\u05dc\u05da \u05e2\u05d5\u05d3\u05db\u05e0\u05d5 \u05dc\u05e9\u05de\u05d5\u05ea \u05d4\u05d7\u05d3\u05e9\u05d9\u05dd, \u05d5\u05ea\u05d5\u05db\u05e0\u05d9\u05d5\u05ea \u05d4\u05d0\u05d9\u05de\u05d5\u05df, \u05de\u05e4\u05ea \u05d4\u05e9\u05e8\u05d9\u05e8\u05d9\u05dd \u05d5\u05d4\u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9\u05d4 \u05e2\u05d5\u05e7\u05d1\u05d9\u05dd \u05d0\u05d7\u05e8\u05d9 \u05d0\u05d9\u05de\u05d5\u05df \u05d2\u05dd \u05d0\u05d7\u05e8\u05d9 \u05e9\u05d9\u05e0\u05d5\u05d9 \u05d4\u05e9\u05dd, \u05d1\u05de\u05e7\u05d5\u05dd \u05dc\u05e4\u05e6\u05dc \u05d0\u05d5\u05ea\u05d5 \u05dc\u05e9\u05e0\u05d9\u05d9\u05dd.",
      wn_170_1: "💪 מפת שרירים — רואים אילו שרירים כל שיעור מפעיל, חלק אחר חלק, על דמות גוף: בשיעורים הקרובים (פתחו את פרטי השיעור) ומתחת לגרף הדופק של כל שיעור באירועים קודמים ← בריאות, וגם תצוגת השבוע. הדמות לפי הפרופיל שלך ב‑BoostApp, או בחרו גבר / אישה / לא צוין בהגדרות.",
      wn_160_1: "🧩 ניסיוני: תוכנית האימון על גרף הדופק — חלקי השיעור (חימום, A, B, C) מוצללים על הגרף, ריחוף מציג את התרגיל המדויק בחלקים מתוזמנים, והתוכנית מופיעה מתחת. המיקום מוערך לפי הדופק; גררו קצה כדי לתקן.",
      wn_150_1: "📈 לשונית בריאות חדשה באירועים קודמים — דופק, דופק שיא, זמן באזור המאמץ וצעדים לכל שיעור, ממוצעים לפי סוג שיעור, וגרף דופק צבוע לפי אזורים בלחיצה. האזורים מותאמים לאזורי ה‑Fitbit שלך; הכול נשמר רק בדפדפן הזה.",
      wn_141_1: "❤️ תיקון סנכרון Fitbit — הדופק ואזורי הדופק מוצגים שוב בשיעורים המסונכרנים (שינוי של Google השמיט אותם מאז 11 בספטמבר). שיעורים אחרונים מתוקנים אוטומטית.",
      wn_140_1: "⌚ סנכרון Fitbit — שיעורים שהשתתפתם בהם נרשמים אוטומטית כאימונים ב‑Fitbit (כולל דופק וקלוריות) דקות אחרי השיעור, וממשיכים ל‑Health Connect. ההגדרה בלשונית ההגדרות.",
      tour_finish_t: "הכול מוכן! ✅",
      tour_finish_b: "שאלות או רעיונות? קישור המשוב בתחתית. אפשר להפעיל את הסיור שוב בכל רגע עם 🎓 סיור.",
      wn_title: "✨ מה חדש",
      wn_ver: "גרסה {v}",
      wn_gotit: "הבנתי", wn_showme: "הראו לי",
      wn_120_1: "🎓 סיור מודרך למשתמשים חדשים — ניתן להפעיל שוב מהתחתית",
      wn_120_2: "✨ כרטיס \"מה חדש\" — אחרי כל עדכון תראו את החידושים, פעם אחת"
    },
    ru: {
      tour_replay: "🎓 Тур",
      tour_skip: "Пропустить", tour_back: "Назад", tour_next: "Далее", tour_done: "Готово",
      tour_of: "{i}/{n}",
      tour_welcome_t: "Добро пожаловать в Boost Auto-Book! 👋",
      tour_welcome_b: "30-секундный тур по возможностям расширения. Его можно запустить снова в любой момент — ссылка 🎓 Тур внизу.",
      tour_signin_t: "Сначала войдите",
      tour_signin_b: "Расширение работает с вашим аккаунтом BoostApp. Нажмите здесь, чтобы открыть BoostApp и войти, — затем откройте окно снова для полного тура.",
      tour_auto_t: "Главный переключатель",
      tour_auto_b: "Когда автозапись включена, выбранные слоты бронируются автоматически в момент открытия 72-часового окна регистрации.",
      tour_status_t: "Ваш статус",
      tour_status_b: "Кто вошёл и насколько свежи данные. ↻ Обновить — синхронизация с BoostApp.",
      tour_tabs_t: "Всё в четырёх вкладках",
      tour_tabs_b: "Ближайшие занятия · еженедельные слоты · абонемент · настройки.",
      tour_upcoming_t: "Ближайшие",
      tour_upcoming_b: "Занятия, на которые вы записаны. Раскройте, чтобы увидеть участников и описание, — или отмените отсюда.",
      tour_slots_t: "Выберите еженедельные слоты",
      tour_slots_b: "Откройте планировщик и отметьте нужные занятия. Расширение запишет вас, как только откроется регистрация.",
      tour_views_t: "Три вида",
      tour_views_b: "Список, недельная сетка или календарь всего периода абонемента — включая превью следующего периода.",
      tour_sub_t: "Абонемент одним взглядом",
      tour_sub_b: "Остаток занятий, дневной лимит, срок действия — синхронизировано с BoostApp.",
      tour_history_t: "История",
      tour_history_b: "Открывает полноэкранную панель прошедших занятий со статистикой по месяцам.",
      tour_settings_t: "Настройки и резервная копия",
      tour_settings_b: "Язык, тема, частота проверки — и экспорт/импорт для переноса слотов в другой браузер.",
      tour_fullpage_t: "Нужно больше места?",
      tour_fullpage_b: "Открывает весь дашборд как полноценную страницу браузера — те же функции, просторная раскладка с многоколоночными списками и большим календарём.",
      wn_130_1: "⛶ Полноэкранный режим — откройте дашборд как вкладку браузера с широкой многоколоночной раскладкой (кнопка в шапке)",
      wn_181_1: "🏷️ Расширение теперь следует за вашей студией. Оно определяет, в какую студию BoostApp вы вошли, и переключается на неё само — расписание, записи и история — вместо той, что была в сборке. Пока студия не определена, вход открывает главную страницу входа BoostApp.",
      wn_180_1: "\ud83d\udcaa \u041f\u0440\u043e\u0448\u0435\u0434\u0448\u0438\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u044f \u2192 \u0417\u0434\u043e\u0440\u043e\u0432\u044c\u0435 \u0442\u0435\u043f\u0435\u0440\u044c \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0438 \u0431\u0435\u0437 \u0442\u0440\u0435\u043a\u0435\u0440\u0430: \u0432\u0441\u0435 \u043f\u043e\u0441\u0435\u0449\u0451\u043d\u043d\u044b\u0435 \u0437\u0430\u043d\u044f\u0442\u0438\u044f \u0441 \u043c\u044b\u0448\u0446\u0430\u043c\u0438, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u043d\u0430\u0433\u0440\u0443\u0437\u0438\u043b \u043f\u043b\u0430\u043d \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438 \u2014 \u043f\u043e \u0442\u0438\u043f\u0443 \u0438 \u043f\u043e \u043a\u0430\u0436\u0434\u043e\u043c\u0443 \u0437\u0430\u043d\u044f\u0442\u0438\u044e. \u0422\u0440\u0435\u043a\u0435\u0440 \u0434\u043e\u0431\u0430\u0432\u043b\u044f\u0435\u0442 \u043f\u0443\u043b\u044c\u0441, \u0437\u043e\u043d\u044b \u0438 \u0448\u0430\u0433\u0438.",
      wn_171_1: "\u2699\ufe0f \u0421\u0442\u0443\u0434\u0438\u044f \u043f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043b\u0430 \u0437\u0430\u043d\u044f\u0442\u0438\u044f \u2014 Training Harmony \u0442\u0435\u043f\u0435\u0440\u044c FUNCTIONAL, Calisapiens \u2014 CALISTHENICS, \u043f\u043b\u044e\u0441 \u043d\u043e\u0432\u044b\u0435 STRENGTH \u0438 FLEXIBILITY. \u041f\u0440\u0430\u0432\u0438\u043b\u0430 \u0437\u0430\u043f\u0438\u0441\u0438 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b, \u0430 \u043f\u043b\u0430\u043d\u044b \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043e\u043a, \u043a\u0430\u0440\u0442\u0430 \u043c\u044b\u0448\u0446 \u0438 \u0438\u0441\u0442\u043e\u0440\u0438\u044f \u0442\u0435\u043f\u0435\u0440\u044c \u0441\u043b\u0435\u0434\u0443\u044e\u0442 \u0437\u0430 \u0437\u0430\u043d\u044f\u0442\u0438\u0435\u043c \u0447\u0435\u0440\u0435\u0437 \u043f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435, \u0430 \u043d\u0435 \u0434\u0435\u043b\u044f\u0442 \u0435\u0433\u043e \u043d\u0430\u0434\u0432\u043e\u0435.",
      wn_170_1: "💪 Карта мышц — какие мышцы работают на каждом занятии, по частям, на фигуре тела: в предстоящих (откройте информацию о занятии) и под графиком пульса каждого занятия в прошедших событиях → Здоровье, плюс обзор недели. Фигура берётся из профиля BoostApp, или выберите мужская / женская / не указано в настройках.",
      wn_160_1: "🧩 Эксперимент: план тренировки на графике пульса — части занятия (разминка, A, B, C) затенены на кривой, при наведении видно точное упражнение в частях по таймеру, а план показан ниже. Положение оценено по пульсу; перетащите край, чтобы поправить.",
      wn_150_1: "📈 Новая вкладка «Здоровье» в прошедших событиях — пульс, максимальный пульс, время в зоне и шаги для каждого занятия, средние по типам занятий и график пульса по зонам по клику. Зоны подогнаны под ваши зоны Fitbit; всё хранится только в этом браузере.",
      wn_141_1: "❤️ Исправление синхронизации Fitbit — пульс и пульсовые зоны снова отображаются в синхронизированных занятиях (изменение Google убирало их с 11 сентября). Недавние занятия исправляются автоматически.",
      wn_140_1: "⌚ Синхронизация с Fitbit — посещённые занятия автоматически записываются в Fitbit как тренировки (с пульсом и калориями) через несколько минут после занятия и попадают в Health Connect. Настройка — во вкладке настроек.",
      tour_finish_t: "Всё готово! ✅",
      tour_finish_b: "Вопросы или идеи? Ссылка «Feedback» внизу. Повторить тур — 🎓 Тур.",
      wn_title: "✨ Что нового",
      wn_ver: "Версия {v}",
      wn_gotit: "Понятно", wn_showme: "Показать",
      wn_120_1: "🎓 Обучающий тур для новых пользователей — можно повторить из футера",
      wn_120_2: "✨ Эта карточка «Что нового» — после каждого обновления вы один раз увидите главное"
    },
    uk: {
      tour_replay: "🎓 Тур",
      tour_skip: "Пропустити", tour_back: "Назад", tour_next: "Далі", tour_done: "Готово",
      tour_of: "{i}/{n}",
      tour_welcome_t: "Вітаємо в Boost Auto-Book! 👋",
      tour_welcome_b: "30-секундний тур можливостями розширення. Його можна запустити знову будь-коли — посилання 🎓 Тур унизу.",
      tour_signin_t: "Спершу ввійдіть",
      tour_signin_b: "Розширення працює з вашим акаунтом BoostApp. Натисніть тут, щоб відкрити BoostApp і ввійти, — потім відкрийте вікно знову для повного туру.",
      tour_auto_t: "Головний перемикач",
      tour_auto_b: "Коли автозапис увімкнено, вибрані слоти бронюються автоматично в момент відкриття 72-годинного вікна реєстрації.",
      tour_status_t: "Ваш статус",
      tour_status_b: "Хто ввійшов і наскільки свіжі дані. ↻ Оновити — синхронізація з BoostApp.",
      tour_tabs_t: "Усе в чотирьох вкладках",
      tour_tabs_b: "Найближчі заняття · щотижневі слоти · абонемент · налаштування.",
      tour_upcoming_t: "Найближчі",
      tour_upcoming_b: "Заняття, на які ви записані. Розгорніть, щоб побачити учасників і опис, — або скасуйте звідси.",
      tour_slots_t: "Оберіть щотижневі слоти",
      tour_slots_b: "Відкрийте планувальник і позначте потрібні заняття. Розширення запише вас, щойно відкриється реєстрація.",
      tour_views_t: "Три подання",
      tour_views_b: "Список, тижнева сітка або календар усього періоду абонемента — з переглядом наступного періоду.",
      tour_sub_t: "Абонемент одним поглядом",
      tour_sub_b: "Залишок занять, денний ліміт, термін дії — синхронізовано з BoostApp.",
      tour_history_t: "Історія",
      tour_history_b: "Відкриває повноекранну панель минулих занять зі статистикою за місяцями.",
      tour_settings_t: "Налаштування та резервна копія",
      tour_settings_b: "Мова, тема, частота перевірки — та експорт/імпорт для перенесення слотів в інший браузер.",
      tour_fullpage_t: "Потрібно більше місця?",
      tour_fullpage_b: "Відкриває весь дашборд як повноцінну сторінку браузера — ті самі функції, просторе компонування з багатоколонковими списками та більшим календарем.",
      wn_130_1: "⛶ Повноекранний режим — відкрийте дашборд як вкладку браузера з широким багатоколонковим компонуванням (кнопка в шапці)",
      wn_181_1: "🏷️ Розширення тепер слідує за вашою студією. Воно визначає, у яку студію BoostApp ви увійшли, і перемикається на неї саме — розклад, записи та історія — замість тієї, що була у збірці. Доки студію не визначено, вхід відкриває головну сторінку входу BoostApp.",
      wn_180_1: "\ud83d\udcaa \u041c\u0438\u043d\u0443\u043b\u0456 \u043f\u043e\u0434\u0456\u0457 \u2192 \u0417\u0434\u043e\u0440\u043e\u0432\u02bc\u044f \u0442\u0435\u043f\u0435\u0440 \u043f\u0440\u0430\u0446\u044e\u0454 \u0439 \u0431\u0435\u0437 \u0442\u0440\u0435\u043a\u0435\u0440\u0430: \u0443\u0441\u0456 \u0432\u0456\u0434\u0432\u0456\u0434\u0430\u043d\u0456 \u0437\u0430\u043d\u044f\u0442\u0442\u044f \u0437 \u043c\u02bc\u044f\u0437\u0430\u043c\u0438, \u044f\u043a\u0456 \u043d\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0438\u0432 \u043f\u043b\u0430\u043d \u2014 \u0437\u0430 \u0442\u0438\u043f\u043e\u043c \u0456 \u0437\u0430 \u043a\u043e\u0436\u043d\u0438\u043c \u0437\u0430\u043d\u044f\u0442\u0442\u044f\u043c. \u0422\u0440\u0435\u043a\u0435\u0440 \u0434\u043e\u0434\u0430\u0454 \u043f\u0443\u043b\u044c\u0441, \u0437\u043e\u043d\u0438 \u0442\u0430 \u043a\u0440\u043e\u043a\u0438.",
      wn_171_1: "\u2699\ufe0f \u0421\u0442\u0443\u0434\u0456\u044f \u043f\u0435\u0440\u0435\u0439\u043c\u0435\u043d\u0443\u0432\u0430\u043b\u0430 \u0437\u0430\u043d\u044f\u0442\u0442\u044f \u2014 Training Harmony \u0442\u0435\u043f\u0435\u0440 FUNCTIONAL, Calisapiens \u2014 CALISTHENICS, \u043f\u043b\u044e\u0441 \u043d\u043e\u0432\u0456 STRENGTH \u0456 FLEXIBILITY. \u041f\u0440\u0430\u0432\u0438\u043b\u0430 \u0437\u0430\u043f\u0438\u0441\u0443 \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u043e, \u0430 \u043f\u043b\u0430\u043d\u0438 \u0442\u0440\u0435\u043d\u0443\u0432\u0430\u043d\u044c, \u043a\u0430\u0440\u0442\u0430 \u043c\u02bc\u044f\u0437\u0456\u0432 \u0456 \u0456\u0441\u0442\u043e\u0440\u0456\u044f \u0442\u0435\u043f\u0435\u0440 \u0441\u0442\u0435\u0436\u0430\u0442\u044c \u0437\u0430 \u0437\u0430\u043d\u044f\u0442\u0442\u044f\u043c \u0447\u0435\u0440\u0435\u0437 \u043f\u0435\u0440\u0435\u0439\u043c\u0435\u043d\u0443\u0432\u0430\u043d\u043d\u044f, \u0430 \u043d\u0435 \u0434\u0456\u043b\u044f\u0442\u044c \u0439\u043e\u0433\u043e \u043d\u0430\u0434\u0432\u043e\u0454.",
      wn_170_1: "💪 Карта м'язів — які м'язи працюють на кожному занятті, по частинах, на фігурі тіла: у майбутніх (відкрийте інформацію про заняття) і під графіком пульсу кожного заняття в минулих подіях → Здоров'я, а також огляд тижня. Фігура береться з профілю BoostApp, або оберіть чоловіча / жіноча / не вказано в налаштуваннях.",
      wn_160_1: "🧩 Експеримент: план тренування на графіку пульсу — частини заняття (розминка, A, B, C) затінено на кривій, при наведенні видно точну вправу в частинах за таймером, а план показано нижче. Положення оцінено за пульсом; перетягніть край, щоб виправити.",
      wn_150_1: "📈 Нова вкладка «Здоров'я» в минулих подіях — пульс, максимальний пульс, час у зоні та кроки для кожного заняття, середні за типами занять і графік пульсу за зонами по кліку. Зони підлаштовано під ваші зони Fitbit; усе зберігається лише в цьому браузері.",
      wn_141_1: "❤️ Виправлення синхронізації Fitbit — пульс і пульсові зони знову відображаються в синхронізованих заняттях (зміна Google прибирала їх з 11 вересня). Нещодавні заняття виправляються автоматично.",
      wn_140_1: "⌚ Синхронізація з Fitbit — відвідані заняття автоматично записуються у Fitbit як тренування (з пульсом і калоріями) за кілька хвилин після заняття та потрапляють у Health Connect. Налаштування — у вкладці налаштувань.",
      tour_finish_t: "Усе готово! ✅",
      tour_finish_b: "Питання чи ідеї? Посилання «Feedback» унизу. Повторити тур — 🎓 Тур.",
      wn_title: "✨ Що нового",
      wn_ver: "Версія {v}",
      wn_gotit: "Зрозуміло", wn_showme: "Показати",
      wn_120_1: "🎓 Навчальний тур для нових користувачів — можна повторити з футера",
      wn_120_2: "✨ Ця картка «Що нового» — після кожного оновлення ви один раз побачите головне"
    },
    ar: {
      tour_replay: "🎓 جولة",
      tour_skip: "تخطٍّ", tour_back: "رجوع", tour_next: "التالي", tour_done: "تم",
      tour_of: "{i}/{n}",
      tour_welcome_t: "مرحبًا بك في Boost Auto-Book!‏ 👋",
      tour_welcome_b: "جولة مدتها 30 ثانية على إمكانيات الإضافة. يمكنك إعادتها في أي وقت عبر رابط 🎓 جولة في الأسفل.",
      tour_signin_t: "أولًا: تسجيل الدخول",
      tour_signin_b: "تعمل الإضافة مع حسابك في BoostApp. انقر هنا لفتح BoostApp وتسجيل الدخول — ثم افتح النافذة مجددًا للجولة الكاملة.",
      tour_auto_t: "المفتاح الرئيسي",
      tour_auto_b: "عند تفعيل الحجز التلقائي، تُحجز مواعيدك الأسبوعية تلقائيًا لحظة فتح نافذة التسجيل (72 ساعة).",
      tour_status_t: "حالتك",
      tour_status_b: "مَن سجّل الدخول ومدى حداثة البيانات. ↻ تحديث يعيد المزامنة من BoostApp.",
      tour_tabs_t: "كل شيء في أربع تبويبات",
      tour_tabs_b: "الحصص القادمة · مواعيدك الأسبوعية · الاشتراك · الإعدادات.",
      tour_upcoming_t: "القادمة",
      tour_upcoming_b: "الحصص المسجَّل بها. وسّع أي حصة لرؤية المشاركين والمحتوى — أو ألغِها من هنا.",
      tour_slots_t: "اختر مواعيدك الأسبوعية",
      tour_slots_b: "افتح المجدوِل وحدّد الحصص التي تريدها كل أسبوع. ستسجّلك الإضافة فور فتح باب الحجز.",
      tour_views_t: "ثلاث طرق للعرض",
      tour_views_b: "قائمة، أو شبكة أسبوعية، أو تقويم كامل لفترة الاشتراك — مع معاينة للفترة القادمة.",
      tour_sub_t: "اشتراكك في لمحة",
      tour_sub_b: "الحصص المتبقية، الحد اليومي، الصلاحية — مُزامَنة من BoostApp.",
      tour_history_t: "لوحة السجلّ",
      tour_history_b: "تفتح لوحة بملء الصفحة لحصصك السابقة مع إحصاءات شهرية.",
      tour_settings_t: "الإعدادات والنسخ الاحتياطي",
      tour_settings_b: "اللغة، السمة، وتيرة الفحص — والتصدير/الاستيراد لنقل مواعيدك إلى متصفح آخر.",
      tour_fullpage_t: "تحتاج مساحة أكبر؟",
      tour_fullpage_b: "يفتح لوحة التحكم كاملة كصفحة متصفح — الميزات نفسها بتخطيط أرحب مع قوائم متعددة الأعمدة وتقويم أكبر.",
      wn_130_1: "⛶ وضع الصفحة الكاملة — افتح لوحة التحكم كتبويب متصفح بتخطيط عريض متعدد الأعمدة (الزر في الأعلى)",
      wn_181_1: "🏷️ أصبحت الإضافة تتبع الاستوديو الخاص بك. فهي تتعرّف على الاستوديو الذي سجّلت الدخول إليه في BoostApp وتنتقل إليه تلقائيًا — الجدول والحجوزات والسجل — بدل البقاء على الاستوديو المضمّن. وإلى أن يُعرف استوديوك، يفتح تسجيل الدخول صفحة الدخول الرئيسية في BoostApp.",
      wn_180_1: "\ud83d\udcaa \u0627\u0644\u0623\u062d\u062f\u0627\u062b \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u2190 \u0627\u0644\u0635\u062d\u0629 \u062a\u0639\u0645\u0644 \u0627\u0644\u0622\u0646 \u062f\u0648\u0646 \u062c\u0647\u0627\u0632 \u062a\u062a\u0628\u0639: \u0643\u0644 \u0627\u0644\u062f\u0631\u0648\u0633 \u0627\u0644\u062a\u064a \u062d\u0636\u0631\u062a\u0647\u0627 \u0645\u0639 \u0627\u0644\u0639\u0636\u0644\u0627\u062a \u0627\u0644\u062a\u064a \u0639\u0645\u0644\u062a \u0639\u0644\u064a\u0647\u0627 \u062e\u0637\u0629 \u0627\u0644\u062a\u0645\u0631\u064a\u0646 \u2014 \u062d\u0633\u0628 \u0646\u0648\u0639 \u0627\u0644\u062f\u0631\u0633 \u0648\u062f\u0631\u0633\u064b\u0627 \u062f\u0631\u0633\u064b\u0627. \u0631\u0628\u0637 \u062c\u0647\u0627\u0632 \u064a\u0636\u064a\u0641 \u0627\u0644\u0646\u0628\u0636 \u0648\u0627\u0644\u0645\u0646\u0627\u0637\u0642 \u0648\u0627\u0644\u062e\u0637\u0648\u0627\u062a.",
      wn_171_1: "\u2699\ufe0f \u063a\u064a\u0651\u0631 \u0627\u0644\u0646\u0627\u062f\u064a \u0623\u0633\u0645\u0627\u0621 \u0627\u0644\u062f\u0631\u0648\u0633 \u2014 \u0623\u0635\u0628\u062d Training Harmony \u0647\u0648 FUNCTIONAL \u0648\u200fCalisapiens \u0647\u0648 CALISTHENICS\u060c \u0625\u0644\u0649 \u062c\u0627\u0646\u0628 STRENGTH \u0648\u200fFLEXIBILITY \u0627\u0644\u062c\u062f\u064a\u062f\u064a\u0646. \u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0642\u0648\u0627\u0639\u062f \u0627\u0644\u062d\u062c\u0632\u060c \u0648\u0623\u0635\u0628\u062d\u062a \u062e\u0637\u0637 \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646 \u0648\u062e\u0631\u064a\u0637\u0629 \u0627\u0644\u0639\u0636\u0644\u0627\u062a \u0648\u0627\u0644\u0633\u062c\u0644 \u062a\u062a\u0627\u0628\u0639 \u0627\u0644\u062f\u0631\u0633 \u0631\u063a\u0645 \u062a\u063a\u064a\u0631 \u0627\u0633\u0645\u0647 \u0628\u062f\u0644 \u062a\u0642\u0633\u064a\u0645\u0647 \u0625\u0644\u0649 \u0627\u062b\u0646\u064a\u0646.",
      wn_170_1: "💪 خريطة العضلات — شاهد العضلات التي يعمل عليها كل درس، جزءًا جزءًا، على شكل جسم: في الدروس القادمة (افتح معلومات الدرس) وتحت منحنى النبض لكل درس في الأحداث السابقة ← الصحة، مع عرض لهذا الأسبوع. يتبع الشكل ملفك في BoostApp، أو اختر ذكر / أنثى / غير محدد من الإعدادات.",
      wn_160_1: "🧩 تجريبي: خطة التمرين على منحنى النبض — أجزاء الدرس (إحماء، A، B، C) مظللة على المنحنى، والتمرير يُظهر التمرين الدقيق في الأجزاء المؤقتة، والخطة معروضة أسفله. الموضع مُقدّر من النبض؛ اسحب الحافة لتصحيحه.",
      wn_150_1: "📈 تبويب صحة جديد في الأحداث السابقة — النبض وأعلى نبض والوقت في المنطقة والخطوات لكل درس، ومتوسطات حسب نوع الدرس، ومنحنى نبض ملوّن حسب المناطق عند النقر. المناطق مطابقة لمناطق Fitbit لديك؛ كل شيء يبقى في هذا المتصفح.",
      wn_141_1: "❤️ إصلاح مزامنة Fitbit — يظهر نبض القلب ومناطق النبض مجددًا في الدروس المُزامَنة (كان تغيير من Google يحذفها منذ 11 سبتمبر). تُصلَح الدروس الأخيرة تلقائيًا.",
      wn_140_1: "⌚ مزامنة Fitbit — تُسجَّل الدروس التي حضرتها تلقائيًا كتمارين في Fitbit (مع نبض القلب والسعرات) بعد دقائق من الدرس، وتصل إلى Health Connect. الإعداد في تبويب الإعدادات.",
      tour_finish_t: "كل شيء جاهز! ✅",
      tour_finish_b: "أسئلة أو أفكار؟ رابط Feedback في الأسفل. أعد الجولة في أي وقت عبر 🎓 جولة.",
      wn_title: "✨ ما الجديد",
      wn_ver: "الإصدار {v}",
      wn_gotit: "فهمت", wn_showme: "أرني",
      wn_120_1: "🎓 جولة إرشادية للمستخدمين الجدد — يمكن إعادتها من الأسفل",
      wn_120_2: "✨ بطاقة \"ما الجديد\" — بعد كل تحديث سترى أبرز المستجدات مرة واحدة"
    }
  };
  for (const lang of Object.keys(WT_I18N)) {
    I18N[lang] = Object.assign(I18N[lang] || {}, WT_I18N[lang]);
  }

  // ── Tour steps ─────────────────────────────────────────────────────────────
  // { key: i18n prefix (key_t / key_b), target: selector | null (centered),
  //   tab: tab to activate first, addedIn: version that introduced the feature }
  // Steps whose target is missing/hidden (e.g. signed out) are skipped.
  const TOUR = [
    { key: "tour_welcome",  target: null },
    { key: "tour_signin",   target: "#soBtn" },                                   // visible only when signed out
    { key: "tour_auto",     target: "header .sw" },
    { key: "tour_status",   target: ".hdr-status" },
    { key: "tour_tabs",     target: ".tabs" },
    { key: "tour_upcoming", target: '[data-panel="upcoming"]', tab: "upcoming" },
    { key: "tour_slots",    target: "#toggleScheduler",        tab: "slots" },
    { key: "tour_views",    target: '.viewtoggle[data-view-for="slots"]', tab: "slots" },
    { key: "tour_sub",      target: '[data-panel="subscription"]', tab: "subscription" },
    { key: "tour_history",  target: "#historyBtn" },
    { key: "tour_fullpage", target: "#fullPageBtn", addedIn: "1.3.0" },
    { key: "tour_settings", target: '[data-panel="settings"]', tab: "settings" },
    { key: "tour_finish",   target: null }
  ];

  // ── What's new, newest first. One entry per released version. ─────────────
  // items: i18n keys listed on the update card.
  // tourKeys: keys of TOUR steps to spotlight via the "Show me" button.
  const WHATS_NEW = {
    "1.8.1": { items: ["wn_181_1"], tourKeys: [] },
    "1.8.0": { items: ["wn_180_1"], tourKeys: [] },
    "1.7.1": { items: ["wn_171_1"], tourKeys: [] },
    "1.7.0": { items: ["wn_170_1"], tourKeys: [] },
    "1.6.0": { items: ["wn_160_1"], tourKeys: [] },
    "1.5.0": { items: ["wn_150_1"], tourKeys: [] },
    "1.4.1": { items: ["wn_141_1"], tourKeys: [] },
    "1.4.0": { items: ["wn_140_1"], tourKeys: [] },
    "1.3.0": { items: ["wn_130_1"], tourKeys: ["tour_fullpage"] },
    "1.2.0": { items: ["wn_120_1", "wn_120_2"], tourKeys: [] }
  };

  const K_TOUR = "bsab_tour_done";     // version string | "pending-signin"
  const K_SEEN = "bsab_seen_version";  // last version whose what's-new was shown

  // ── styles (injected; overlay lives on <html>, OUTSIDE the zoomed <body>,
  //    so getBoundingClientRect coordinates match 1:1) ────────────────────────
  const css = `
  #wtOverlay { position:fixed; inset:0; z-index:9999; font-family:var(--font);
    -webkit-font-smoothing:antialiased; }
  #wtOverlay * { box-sizing:border-box; font-family:var(--font); }
  #wtBackdrop { position:fixed; inset:0; background:transparent; }
  #wtHole { position:fixed; border-radius:10px; pointer-events:none;
    box-shadow:0 0 0 9999px rgba(0,0,0,.55); border:2px solid var(--green,#00e0a0);
    transition:top .22s ease, left .22s ease, width .22s ease, height .22s ease; }
  #wtHole.wt-none { border:none; }
  #wtTip { position:fixed; width:290px; max-width:calc(100vw - 24px);
    background:var(--card,#fff); color:var(--text,#1f2a17);
    border:1px solid var(--line,#e3e6e0); border-radius:12px;
    box-shadow:0 12px 40px rgba(0,0,0,.35); padding:13px 14px 11px;
    transition:top .22s ease, left .22s ease; }
  #wtTip .wt-count { font-size:11px; color:var(--muted,#6b7280); margin-bottom:4px; }
  #wtTip .wt-title { font-size:14.5px; font-weight:700; margin-bottom:5px; }
  #wtTip .wt-body { font-size:12.5px; line-height:1.55; color:var(--text,#1f2a17); }
  #wtTip .wt-btns { display:flex; align-items:center; gap:7px; margin-top:11px; }
  #wtTip button { cursor:pointer; border:none; border-radius:7px; padding:6px 12px;
    font-size:12.5px; font-weight:600; }
  #wtTip .wt-next { background:var(--green,#00e0a0); color:var(--ink,#063a2b); }
  #wtTip .wt-next:hover { background:var(--green-deep,#00a87a); color:#fff; }
  #wtTip .wt-back, #wtTip .wt-skip { background:var(--ghost,#eef0ec); color:var(--text,#1f2a17); font-weight:500; }
  #wtTip .wt-skip { margin-inline-start:auto; }
  #wtTip .wt-back:hover, #wtTip .wt-skip:hover { background:var(--ghost-hover,#e0e4dc); }
  #wtTip .wt-dots { display:flex; gap:4px; margin-top:10px; }
  #wtTip .wt-dot { width:6px; height:6px; border-radius:50%; background:var(--line,#e3e6e0); }
  #wtTip .wt-dot.on { background:var(--green-deep,#00a87a); }
  /* What's new card */
  #wnWrap { position:fixed; inset:0; z-index:9998; display:flex; align-items:center;
    justify-content:center; background:rgba(0,0,0,.55); font-family:var(--font); padding:18px; }
  #wnCard { width:100%; max-width:360px; background:var(--card,#fff); color:var(--text,#1f2a17);
    border:1px solid var(--line,#e3e6e0); border-radius:14px; box-shadow:0 14px 48px rgba(0,0,0,.4);
    padding:16px 17px 14px; }
  #wnCard * { box-sizing:border-box; font-family:var(--font); }
  #wnCard h3 { margin:0 0 2px; font-size:16px; }
  #wnCard .wn-ver { font-size:11.5px; color:var(--muted,#6b7280); margin-bottom:10px; }
  #wnCard ul { margin:0 0 4px; padding-inline-start:2px; list-style:none; }
  #wnCard li { font-size:12.5px; line-height:1.55; margin-bottom:7px; }
  #wnCard .wn-btns { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
  #wnCard button { cursor:pointer; border:none; border-radius:8px; padding:7px 14px;
    font-size:13px; font-weight:600; }
  #wnCard .wn-gotit { background:var(--green,#00e0a0); color:var(--ink,#063a2b); }
  #wnCard .wn-gotit:hover { background:var(--green-deep,#00a87a); color:#fff; }
  #wnCard .wn-showme { background:var(--ghost,#eef0ec); color:var(--text,#1f2a17); }
  #wnCard .wn-showme:hover { background:var(--ghost-hover,#e0e4dc); }
  `;
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── helpers ────────────────────────────────────────────────────────────────
  const VERSION = chrome.runtime.getManifest().version;
  const store = {
    get: (keys) => chrome.storage.local.get(keys),
    set: (obj) => chrome.storage.local.set(obj)
  };
  function cmpVer(a, b) {           // semver-ish numeric compare: 1 if a>b
    const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }
  function isVisible(sel) {
    const el = sel && document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function signedOut() {
    const b = document.querySelector(".body");
    return !!(b && b.classList.contains("signedout"));
  }

  // ── spotlight tour engine ─────────────────────────────────────────────────
  let tourState = null;   // { steps, i, onEnd, prevTab }

  function startTour(steps, onEnd) {
    endTour();                                   // safety: only one at a time
    // Keep no-target steps, steps that switch to a tab, and currently visible
    // targets. (#soBtn drops out when signed in; per-step visibility is
    // re-checked when shown, so tab-hidden panels still work.)
    steps = steps.filter(s => !s.target || s.tab || isVisible(s.target));
    if (!steps.length) { if (onEnd) onEnd(); return; }
    const activeTab = document.querySelector(".tab.active");
    tourState = { steps, i: 0, onEnd: onEnd || null,
      prevTab: activeTab ? activeTab.dataset.tab : "upcoming" };

    const ov = document.createElement("div"); ov.id = "wtOverlay";
    ov.innerHTML = `<div id="wtBackdrop"></div><div id="wtHole" class="wt-none"></div>
      <div id="wtTip"><div class="wt-count"></div><div class="wt-title"></div>
      <div class="wt-body"></div><div class="wt-dots"></div>
      <div class="wt-btns"><button class="wt-back"></button><button class="wt-next"></button>
      <button class="wt-skip"></button></div></div>`;
    // Append to <html>, not <body>: body is zoomed (1.1) on desktop, which would
    // skew fixed-position coordinates relative to getBoundingClientRect values.
    document.documentElement.appendChild(ov);

    ov.querySelector("#wtBackdrop").addEventListener("click", next);
    ov.querySelector(".wt-next").addEventListener("click", next);
    ov.querySelector(".wt-back").addEventListener("click", back);
    ov.querySelector(".wt-skip").addEventListener("click", endTour);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", position);
    show(0);
  }

  function onKey(e) {
    if (!tourState) return;
    const rtl = document.documentElement.dir === "rtl";
    if (e.key === "Escape") { endTour(); }
    else if (e.key === "Enter" || e.key === (rtl ? "ArrowLeft" : "ArrowRight")) { next(); }
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) { back(); }
    else return;
    e.preventDefault(); e.stopPropagation();
  }

  function stepVisibleNow(s) {
    if (!s.target) return true;
    if (s.tab) showTab(s.tab);
    return isVisible(s.target);
  }
  function next() { move(1); }
  function back() { move(-1); }
  function move(dir) {
    if (!tourState) return;
    let i = tourState.i;
    do { i += dir; } while (
      tourState.steps[i] && !stepVisibleNow(tourState.steps[i])
    );
    if (i < 0) return;
    if (i >= tourState.steps.length) { endTour(); return; }
    show(i);
  }

  function show(i) {
    const st = tourState; if (!st) return;
    // find the first visible step at or after i (forward scan on entry)
    while (st.steps[i] && !stepVisibleNow(st.steps[i])) i++;
    if (!st.steps[i]) { endTour(); return; }
    st.i = i;
    const s = st.steps[i];
    if (s.tab) showTab(s.tab);
    const tip = document.querySelector("#wtTip");
    tip.querySelector(".wt-count").textContent = t("tour_of", { i: i + 1, n: st.steps.length });
    tip.querySelector(".wt-title").textContent = t(s.key + "_t");
    tip.querySelector(".wt-body").textContent = t(s.key + "_b");
    tip.querySelector(".wt-back").textContent = t("tour_back");
    tip.querySelector(".wt-back").style.visibility = i === 0 ? "hidden" : "visible";
    tip.querySelector(".wt-next").textContent = t(i === st.steps.length - 1 ? "tour_done" : "tour_next");
    tip.querySelector(".wt-skip").textContent = t("tour_skip");
    tip.querySelector(".wt-skip").style.display = i === st.steps.length - 1 ? "none" : "";
    const dots = tip.querySelector(".wt-dots");
    dots.innerHTML = "";
    st.steps.forEach((_, d) => {
      const el = document.createElement("span");
      el.className = "wt-dot" + (d === i ? " on" : "");
      dots.appendChild(el);
    });
    if (s.target) {
      const el = document.querySelector(s.target);
      try { el.scrollIntoView({ block: "center", behavior: "instant" }); } catch (e) { el.scrollIntoView(); }
    }
    requestAnimationFrame(position);
  }

  function position() {
    const st = tourState; if (!st) return;
    const s = st.steps[st.i];
    const hole = document.querySelector("#wtHole");
    const tip = document.querySelector("#wtTip");
    const vw = window.innerWidth, vh = window.innerHeight;
    const tipH = tip.offsetHeight || 170, tipW = Math.min(290, vw - 24);
    if (!s.target || !isVisible(s.target)) {
      // centered card, full dim
      hole.className = "wt-none";
      Object.assign(hole.style, { top: "50%", left: "50%", width: "0px", height: "0px" });
      Object.assign(tip.style, {
        top: Math.max(12, (vh - tipH) / 2) + "px",
        left: Math.max(12, (vw - tipW) / 2) + "px"
      });
      return;
    }
    const r = document.querySelector(s.target).getBoundingClientRect();
    const pad = 6;
    hole.className = "";
    Object.assign(hole.style, {
      top: (r.top - pad) + "px", left: (r.left - pad) + "px",
      width: (r.width + pad * 2) + "px", height: (r.height + pad * 2) + "px"
    });
    // tooltip below the target if it fits, else above, clamped horizontally
    let top = r.bottom + pad + 10;
    if (top + tipH > vh - 10) top = Math.max(10, r.top - pad - tipH - 10);
    let left = r.left + r.width / 2 - tipW / 2;
    left = Math.min(Math.max(10, left), vw - tipW - 10);
    Object.assign(tip.style, { top: top + "px", left: left + "px" });
  }

  function endTour() {
    const ov = document.querySelector("#wtOverlay");
    if (ov) ov.remove();
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", position);
    const onEnd = tourState && tourState.onEnd;
    const prevTab = tourState && tourState.prevTab;
    tourState = null;
    if (prevTab && !signedOut()) showTab(prevTab);   // put the user back where they were
    if (onEnd) onEnd();
  }

  // ── What's new card ────────────────────────────────────────────────────────
  function showWhatsNew(versions) {   // versions: newest-first array of keys into WHATS_NEW
    const wrap = document.createElement("div"); wrap.id = "wnWrap";
    const items = [];
    const tourKeys = [];
    for (const v of versions) {
      for (const k of WHATS_NEW[v].items) items.push(k);
      for (const k of (WHATS_NEW[v].tourKeys || [])) tourKeys.push(k);
    }
    const verLabel = versions.length === 1
      ? t("wn_ver", { v: versions[0] })
      : t("wn_ver", { v: versions[versions.length - 1] + " → " + versions[0] });
    const card = document.createElement("div"); card.id = "wnCard";
    card.innerHTML = `<h3></h3><div class="wn-ver"></div><ul></ul>
      <div class="wn-btns"><button class="wn-showme"></button><button class="wn-gotit"></button></div>`;
    card.querySelector("h3").textContent = t("wn_title");
    card.querySelector(".wn-ver").textContent = verLabel;
    const ul = card.querySelector("ul");
    for (const k of items) {
      const li = document.createElement("li"); li.textContent = t(k); ul.appendChild(li);
    }
    const showme = card.querySelector(".wn-showme");
    const steps = TOUR.filter(s => tourKeys.includes(s.key));
    if (steps.length) {
      showme.textContent = t("wn_showme");
      showme.onclick = () => { wrap.remove(); startTour(steps); };
    } else { showme.style.display = "none"; }
    const gotit = card.querySelector(".wn-gotit");
    gotit.textContent = t("wn_gotit");
    gotit.onclick = () => wrap.remove();
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
    wrap.appendChild(card);
    document.documentElement.appendChild(wrap);
  }

  // ── footer replay link ─────────────────────────────────────────────────────
  const replay = document.getElementById("tourReplay");
  if (replay) replay.addEventListener("click", (e) => {
    e.preventDefault();
    startTour(TOUR.slice());
  });

  // ── startup decision ───────────────────────────────────────────────────────
  async function maybeStart() {
    // Let popup.js finish its first getState round-trip (auth state → signedout
    // class, language) before we decide what to show and in which language.
    await new Promise(r => setTimeout(r, 900));
    let st = {};
    try { st = await store.get([K_TOUR, K_SEEN]); } catch (e) { return; }
    const out = signedOut();

    // First run — or a first run that happened signed out, now signed in.
    if (!st[K_TOUR] || (st[K_TOUR] === "pending-signin" && !out)) {
      startTour(TOUR.slice(), async () => {
        await store.set({ [K_TOUR]: out ? "pending-signin" : VERSION, [K_SEEN]: VERSION });
      });
      return;
    }

    // Updated since last seen → show what's-new once.
    const seen = st[K_SEEN];
    if (!seen) { await store.set({ [K_SEEN]: VERSION }); return; }
    if (cmpVer(VERSION, seen) > 0) {
      const versions = Object.keys(WHATS_NEW)
        .filter(v => cmpVer(v, seen) > 0 && cmpVer(v, VERSION) <= 0)
        .sort((a, b) => cmpVer(b, a));
      if (versions.length) showWhatsNew(versions);
      await store.set({ [K_SEEN]: VERSION });
    }
  }
  maybeStart();
})();
