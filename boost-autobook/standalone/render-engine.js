/* Boost Auto-Book — History dashboard (past events analytics + "Wrapped" story) */

function pad(n) { return String(n).padStart(2, "0"); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

const RTL_LANGS = ["he", "ar"];
const WDSHORT = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  he: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת"],
  ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
  uk: ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
  ar: ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
};
const WDFULL = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  he: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
  ru: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
  uk: ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"],
  ar: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
};
const MONTHNAME = {
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  he: ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"],
  ru: ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"],
  uk: ["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"],
  ar: ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"]
};

const I18N = {
  en: {
    title: "Past Events", refresh: "↻ Refresh", refreshing: "↻ Refreshing…",
    resync: "Resync all history", resyncing: "Resyncing…",
    loading: "Loading your class history…",
    empty: "No class history found yet.", emptyHint: "Open BoostApp Home once to sync, then refresh this page.",
    emptyAuth: "Couldn't confirm you're signed in while syncing.", emptyAuthHint: "Keep a BoostApp tab open and signed in, then click Resync all history.",
    emptyNetwork: "Syncing kept timing out.", emptyNetworkHint: "Check your connection, keep a BoostApp tab open, then click Resync all history.",
    viewDashboard: "Dashboard", viewStory: "Story", viewCompare: "Compare",
    shareImg: "🖼️ Share image", exportCsv: "⬇️ Export CSV",
    stat_total: "Classes attended", stat_thisMonth: "This month",
    stats_thisSelection: "Showing", stats_allTime: "All-time records",
    stat_currentStreak: "Current streak", stat_longestStreak: "Longest streak",
    stat_lateCancelRate: "Late-cancel rate", stat_months: "Months of history",
    stat_avgWeek: "Avg. classes / week", stat_bestMonth: "Best month ever",
    stat_avgGap: "Avg. days between classes", stat_variety: "Class types tried",
    stat_hours: "Est. hours trained", weeks: "{n} wk", days: "{n}d",
    section_weekday: "Most active day of week", section_type: "By class type",
    section_teacher: "By teacher", section_trend: "Classes per month", section_heatmap: "Attendance calendar",
    section_punchcard: "By hour & day", section_growth: "Your journey (cumulative)",
    section_consistency: "Consistency", section_consistency_hint: "Share of weeks with at least one class since your first",
    section_breakdown: "Your training breakdown", growth_caption: "{n} classes since {since} — averaging {avg} a week.",
    shareTpl_wrapped: "Summary card", shareTpl_streak: "Streak card", shareTpl_badges: "Badges card", shareTpl_weekday: "Weekday card",
    section_badges: "Achievements", section_insights: "For you", section_filters: "Filter",
    noTeacher: "(no teacher listed)", backfillNote: "Still gathering older months in the background — refresh in a bit for the full picture.",
    memberSince: "Training with us since {m}",
    filter_all: "All time", filter_year: "This year", filter_3m: "Last 3 months", filter_month: "This month",
    filter_rangeLabel: "Range", filter_typeLabel: "Class type", filter_teacherLabel: "Teacher",
    badge_tapDetails: "Tap for details", badge_status_earned: "🎉 Unlocked!", badge_status_progress: "{pct}% of the way there",
    insight_addSuggest: "You've attended <b>{cls}</b> with {teacher} on {day}s at {time} {n} times, but it isn't on your watchlist.",
    insight_addBtn: "+ Add to watchlist", insight_added: "✓ Added",
    insight_balance: "You still have <b>{r}</b> session(s) left on {name} this month — don't let them go to waste.",
    insight_lateCancel: "You've late-cancelled <b>{cls}</b> {day}s at {time} {n} times ({p}% of the time).",
    insight_pauseBtn: "Pause this slot", insight_paused: "✓ Paused",
    insight_none: "You're all caught up — nothing needs your attention right now. 🎉",
    highlight_signature: "<b>{cls}</b> {day}s at {time} with {teacher} is basically your signature session — {n} times and counting.",
    highlight_momentumUp: "You're on a roll — averaging <b>{pct}%</b> more classes than usual lately. 🔥",
    highlight_momentumDown: "Pace has eased off a bit lately — about {pct}% below your usual average. No worries, life happens.",
    highlight_momentumSteady: "Right on pace — you're keeping your usual rhythm of about <b>{avg}</b> classes a week.",
    highlight_milestone: "Just <b>{n}</b> more class(es) to unlock \"{badge}\".",
    highlight_milestoneRatio: "You're <b>{pct}%</b> of the way to unlocking \"{badge}\".",
    highlight_allBadges: "You've unlocked every achievement so far — incredible consistency! 🏆",
    highlight_planUsage: "You've got <b>{r}</b> session(s) left on {name} this month.",
    highlight_streak: "You're on a <b>{n}</b>-week streak right now — your best ever is {best}.",
    highlight_bestStreak: "Your personal best is a <b>{best}</b>-week streak — time to beat it?",
    highlight_getStarted: "Your training story is just getting started — keep showing up and the stats will follow. 👋",
    badge_streak4_t: "4-Week Streak", badge_streak4_d: "Attend at least once a week for 4 weeks straight",
    badge_streak8_t: "8-Week Streak", badge_streak8_d: "Keep it up for 8 weeks straight",
    badge_streak16_t: "16-Week Streak", badge_streak16_d: "Four months, every single week",
    badge_c25_t: "25 Classes", badge_c25_d: "Attend 25 classes",
    badge_c50_t: "50 Classes", badge_c50_d: "Attend 50 classes",
    badge_c100_t: "Century Club", badge_c100_d: "Attend 100 classes",
    badge_early_t: "Early Bird", badge_early_d: "10 classes before 8:00",
    badge_night_t: "Night Owl", badge_night_d: "10 classes at 19:00 or later",
    badge_variety_t: "Variety Seeker", badge_variety_d: "Try 3 different class types",
    badge_consistency_t: "Consistency Champion", badge_consistency_d: "Attend in 75% of weeks since your first class",
    persona_regular: "The {day} Regular", persona_devotee: "The {day} {type} Devotee",
    persona_tier0: "Just getting started", persona_tier1: "Building momentum",
    persona_tier2: "Seriously consistent", persona_tier3: "Absolute machine",
    compare_period: "Period", compare_thisMonth: "This month", compare_lastMonth: "Last month",
    compare_thisYear: "This year", compare_lastYear: "Last year",
    compare_classes: "Classes attended", compare_lateCancelRate: "Late-cancel rate",
    compare_avgWeek: "Avg / week", compare_topType: "Top class type", compare_topTeacher: "Top teacher",
    story_welcome: "Hey {name} 👋", story_welcome_sub: "Let's look back at your training journey.",
    story_total: "{n} classes attended", story_total_sub: "That's about {h} hours on the floor (estimated).",
    story_day: "{day} is your day", story_day_sub: "{n} classes — more than any other day of the week.",
    story_teacher_eyebrow: "You trained the most with", story_teacher_sub: "{n} sessions together.",
    story_streak: "{n}-week streak", story_streak_sub: "Your longest run without missing a week.",
    story_persona_eyebrow: "Your training persona", story_badges: "{n}/{total} achievements unlocked",
    story_share_title: "Thanks for training with us!", story_share_sub: "Download a card to remember this by.",
    story_next: "Next →", story_prev: "← Back", story_done: "Done", story_close: "✕",
    noData: "Not enough data yet for this view."
  },
  he: {
    title: "שיעורים קודמים", refresh: "↻ רענן", refreshing: "↻ מרענן…",
    resync: "סנכרן מחדש היסטוריה", resyncing: "מסנכרן…",
    loading: "טוען היסטוריית שיעורים…",
    empty: "לא נמצאה היסטוריית שיעורים.", emptyHint: "פתח את דף הבית של BoostApp לסנכרון, ואז רענן דף זה.",
    emptyAuth: "לא הצלחנו לוודא שאתם מחוברים במהלך הסנכרון.", emptyAuthHint: "השאירו כרטיסייה של BoostApp פתוחה כשאתם מחוברים, ואז לחצו על סנכרון מלא מחדש.",
    emptyNetwork: "הסנכרון נתקל שוב ושוב בזמן המתנה שפג.", emptyNetworkHint: "בדקו את החיבור לאינטרנט, השאירו כרטיסייה של BoostApp פתוחה, ואז לחצו על סנכרון מלא מחדש.",
    viewDashboard: "לוח בקרה", viewStory: "סיפור", viewCompare: "השוואה",
    shareImg: "🖼️ שתף תמונה", exportCsv: "⬇️ ייצוא CSV",
    stat_total: "שיעורים שהגעת אליהם", stat_thisMonth: "החודש",
    stats_thisSelection: "מציג נתונים עבור", stats_allTime: "שיאים כלליים",
    stat_currentStreak: "רצף נוכחי", stat_longestStreak: "הרצף הארוך ביותר",
    stat_lateCancelRate: "אחוז ביטולים מאוחרים", stat_months: "חודשי היסטוריה",
    stat_avgWeek: "ממוצע שיעורים לשבוע", stat_bestMonth: "החודש הכי פעיל",
    stat_avgGap: "ממוצע ימים בין שיעורים", stat_variety: "סוגי שיעורים שניסית",
    stat_hours: "שעות אימון משוערות", weeks: "{n} שב'", days: "{n} ימ'",
    section_weekday: "היום הפעיל ביותר בשבוע", section_type: "לפי סוג שיעור",
    section_teacher: "לפי מדריך/ה", section_trend: "שיעורים לחודש", section_heatmap: "לוח נוכחות",
    section_punchcard: "לפי שעה ויום", section_growth: "המסע שלך (מצטבר)",
    section_consistency: "עקביות", section_consistency_hint: "אחוז השבועות עם לפחות שיעור אחד מאז השיעור הראשון",
    section_breakdown: "פירוט האימונים שלך", growth_caption: "{n} שיעורים מאז {since} — בממוצע {avg} בשבוע.",
    shareTpl_wrapped: "כרטיס סיכום", shareTpl_streak: "כרטיס רצף", shareTpl_badges: "כרטיס הישגים", shareTpl_weekday: "כרטיס יום בשבוע",
    section_badges: "הישגים", section_insights: "בשבילך", section_filters: "סינון",
    noTeacher: "(לא צוין מדריך)", backfillNote: "עדיין אוסף חודשים ישנים יותר ברקע — רענן בעוד רגע לתמונה מלאה.",
    memberSince: "מתאמן/ת איתנו מאז {m}",
    filter_all: "כל הזמן", filter_year: "השנה", filter_3m: "3 חודשים אחרונים", filter_month: "החודש",
    filter_rangeLabel: "טווח", filter_typeLabel: "סוג שיעור", filter_teacherLabel: "מדריך/ה",
    badge_tapDetails: "הקש/י לפרטים", badge_status_earned: "🎉 נפתח!", badge_status_progress: "{pct}% בדרך להשגה",
    insight_addSuggest: "הגעת ל-<b>{cls}</b> עם {teacher} בימי {day} בשעה {time} {n} פעמים, אך זה לא ברשימת המעקב שלך.",
    insight_addBtn: "+ הוסף למעקב", insight_added: "✓ נוסף",
    insight_balance: "נשארו לך <b>{r}</b> שיעור/ים במנוי {name} החודש — כדאי לנצל.",
    insight_lateCancel: "ביטלת באיחור את <b>{cls}</b> בימי {day} בשעה {time} {n} פעמים ({p}% מהפעמים).",
    insight_pauseBtn: "השהה משבצת זו", insight_paused: "✓ הושהה",
    insight_none: "הכל מסודר — אין כרגע דבר שדורש תשומת לב. 🎉",
    highlight_signature: "<b>{cls}</b> בימי {day} בשעה {time} עם {teacher} הפך כמעט למפגש קבוע שלך — {n} פעמים עד כה.",
    highlight_momentumUp: "אתם בתנופה — בממוצע <b>{pct}%</b> יותר שיעורים מהרגיל לאחרונה. 🔥",
    highlight_momentumDown: "הקצב ירד קצת לאחרונה — בערך {pct}% מתחת לממוצע הרגיל שלכם. לא נורא, קורה.",
    highlight_momentumSteady: "בדיוק בקצב — אתם שומרים על השגרה הרגילה של כ-<b>{avg}</b> שיעורים בשבוע.",
    highlight_milestone: "עוד <b>{n}</b> שיעור/ים ותפתחו את \"{badge}\".",
    highlight_milestoneRatio: "עברתם <b>{pct}%</b> מהדרך לפתיחת \"{badge}\".",
    highlight_allBadges: "פתחתם את כל ההישגים עד כה — עקביות מדהימה! 🏆",
    highlight_planUsage: "נשארו לכם <b>{r}</b> שיעור/ים במנוי {name} החודש.",
    highlight_streak: "אתם ברצף של <b>{n}</b> שבועות כרגע — השיא שלכם הוא {best}.",
    highlight_bestStreak: "השיא האישי שלכם הוא רצף של <b>{best}</b> שבועות — הזמן לשבור אותו?",
    highlight_getStarted: "המסע שלכם רק מתחיל — המשיכו להגיע והנתונים יבואו. 👋",
    badge_streak4_t: "רצף 4 שבועות", badge_streak4_d: "הגעה לפחות פעם בשבוע במשך 4 שבועות רצופים",
    badge_streak8_t: "רצף 8 שבועות", badge_streak8_d: "המשך כך במשך 8 שבועות רצופים",
    badge_streak16_t: "רצף 16 שבועות", badge_streak16_d: "ארבעה חודשים, כל שבוע",
    badge_c25_t: "25 שיעורים", badge_c25_d: "הגעה ל-25 שיעורים",
    badge_c50_t: "50 שיעורים", badge_c50_d: "הגעה ל-50 שיעורים",
    badge_c100_t: "מועדון המאה", badge_c100_d: "הגעה ל-100 שיעורים",
    badge_early_t: "ציפור מוקדמת", badge_early_d: "10 שיעורים לפני השעה 8:00",
    badge_night_t: "ינשוף לילה", badge_night_d: "10 שיעורים בשעה 19:00 או אחריה",
    badge_variety_t: "מחפש/ת גיוון", badge_variety_d: "נסה/י 3 סוגי שיעורים שונים",
    badge_consistency_t: "אלוף/ת עקביות", badge_consistency_d: "הגעה ב-75% מהשבועות מאז השיעור הראשון",
    persona_regular: "הקבוע/ה של יום {day}", persona_devotee: "חסיד/ת {type} של יום {day}",
    persona_tier0: "רק מתחיל/ה", persona_tier1: "בונה תאוצה",
    persona_tier2: "עקבי/ת ברצינות", persona_tier3: "מכונה של ממש",
    compare_period: "תקופה", compare_thisMonth: "החודש", compare_lastMonth: "החודש שעבר",
    compare_thisYear: "השנה", compare_lastYear: "השנה שעברה",
    compare_classes: "שיעורים שנוצלו", compare_lateCancelRate: "אחוז ביטולים מאוחרים",
    compare_avgWeek: "ממוצע לשבוע", compare_topType: "סוג השיעור המוביל", compare_topTeacher: "המדריך/ה המוביל/ה",
    story_welcome: "היי {name} 👋", story_welcome_sub: "בואו נסתכל אחורה על מסע האימונים שלך.",
    story_total: "{n} שיעורים הושלמו", story_total_sub: "זה בערך {h} שעות אימון (משוער).",
    story_day: "יום {day} הוא היום שלך", story_day_sub: "{n} שיעורים — יותר מכל יום אחר בשבוע.",
    story_teacher_eyebrow: "התאמנת הכי הרבה עם", story_teacher_sub: "{n} מפגשים משותפים.",
    story_streak: "רצף של {n} שבועות", story_streak_sub: "הרצף הארוך ביותר שלך ללא החמצת שבוע.",
    story_persona_eyebrow: "פרופיל האימונים שלך", story_badges: "{n}/{total} הישגים נפתחו",
    story_share_title: "תודה שהתאמנת איתנו!", story_share_sub: "הורד/י כרטיס לזיכרון.",
    story_next: "הבא ←", story_prev: "→ הקודם", story_done: "סיום", story_close: "✕",
    noData: "אין עדיין מספיק נתונים לתצוגה זו."
  },
  ru: {
    title: "Прошедшие занятия", refresh: "↻ Обновить", refreshing: "↻ Обновление…",
    resync: "Пересинхронизировать историю", resyncing: "Синхронизация…",
    loading: "Загрузка истории занятий…",
    empty: "История занятий пока не найдена.", emptyHint: "Откройте главную страницу BoostApp для синхронизации, затем обновите страницу.",
    emptyAuth: "Не удалось подтвердить вход в аккаунт во время синхронизации.", emptyAuthHint: "Оставьте вкладку BoostApp открытой и войдите в аккаунт, затем нажмите «Пересинхронизировать историю».",
    emptyNetwork: "Синхронизация постоянно превышала время ожидания.", emptyNetworkHint: "Проверьте соединение, оставьте вкладку BoostApp открытой, затем нажмите «Пересинхронизировать историю».",
    viewDashboard: "Дашборд", viewStory: "История", viewCompare: "Сравнение",
    shareImg: "🖼️ Поделиться", exportCsv: "⬇️ Экспорт CSV",
    stat_total: "Посещено занятий", stat_thisMonth: "В этом месяце",
    stats_thisSelection: "Показано за", stats_allTime: "Общие показатели",
    stat_currentStreak: "Текущая серия", stat_longestStreak: "Самая длинная серия",
    stat_lateCancelRate: "Доля поздних отмен", stat_months: "Месяцев истории",
    stat_avgWeek: "Среднее в неделю", stat_bestMonth: "Лучший месяц",
    stat_avgGap: "Средний интервал (дней)", stat_variety: "Испробовано типов занятий",
    stat_hours: "Оценка часов тренировок", weeks: "{n} нед.", days: "{n} дн.",
    section_weekday: "Самый активный день недели", section_type: "По типу занятия",
    section_teacher: "По тренеру", section_trend: "Занятий в месяц", section_heatmap: "Календарь посещений",
    section_punchcard: "По часу и дню", section_growth: "Ваш путь (накопительно)",
    section_consistency: "Постоянство", section_consistency_hint: "Доля недель хотя бы с одним занятием с первого раза",
    section_breakdown: "Разбивка тренировок", growth_caption: "{n} занятий с {since} — в среднем {avg} в неделю.",
    shareTpl_wrapped: "Карточка сводки", shareTpl_streak: "Карточка серии", shareTpl_badges: "Карточка достижений", shareTpl_weekday: "Карточка дня недели",
    section_badges: "Достижения", section_insights: "Для вас", section_filters: "Фильтр",
    noTeacher: "(тренер не указан)", backfillNote: "Всё ещё собираем более старые месяцы в фоне — обновите позже.",
    memberSince: "С нами с {m}",
    filter_all: "Всё время", filter_year: "Этот год", filter_3m: "Последние 3 месяца", filter_month: "Этот месяц",
    filter_rangeLabel: "Период", filter_typeLabel: "Тип занятия", filter_teacherLabel: "Тренер",
    badge_tapDetails: "Нажмите для деталей", badge_status_earned: "🎉 Открыто!", badge_status_progress: "Пройдено {pct}%",
    insight_addSuggest: "Вы посещали <b>{cls}</b> с {teacher} по {day}м в {time} {n} раз, но этого нет в списке отслеживания.",
    insight_addBtn: "+ Добавить", insight_added: "✓ Добавлено",
    insight_balance: "У вас осталось <b>{r}</b> занятий по абонементу {name} в этом месяце.",
    insight_lateCancel: "Вы поздно отменяли <b>{cls}</b> по {day}м в {time} {n} раз ({p}%).",
    insight_pauseBtn: "Приостановить", insight_paused: "✓ Приостановлено",
    insight_none: "Всё в порядке — сейчас ничего не требует внимания. 🎉",
    highlight_signature: "<b>{cls}</b> по {day}м в {time} с {teacher} стало вашим коронным занятием — уже {n} раз.",
    highlight_momentumUp: "Вы набираете обороты — в среднем на <b>{pct}%</b> больше занятий, чем обычно. 🔥",
    highlight_momentumDown: "Темп немного снизился — примерно на {pct}% ниже обычного среднего. Ничего страшного.",
    highlight_momentumSteady: "Ровный темп — вы держите свой обычный ритм примерно <b>{avg}</b> занятий в неделю.",
    highlight_milestone: "Ещё <b>{n}</b> занятие(й) до открытия \"{badge}\".",
    highlight_milestoneRatio: "Вы прошли <b>{pct}%</b> пути к открытию \"{badge}\".",
    highlight_allBadges: "Вы открыли все достижения — невероятная стабильность! 🏆",
    highlight_planUsage: "У вас осталось <b>{r}</b> занятий по абонементу {name} в этом месяце.",
    highlight_streak: "Сейчас у вас серия <b>{n}</b> недель — ваш рекорд {best}.",
    highlight_bestStreak: "Ваш личный рекорд — серия из <b>{best}</b> недель — пора его побить?",
    highlight_getStarted: "Ваша история тренировок только начинается — продолжайте, и статистика появится. 👋",
    badge_streak4_t: "Серия 4 недели", badge_streak4_d: "Посещайте минимум раз в неделю 4 недели подряд",
    badge_streak8_t: "Серия 8 недель", badge_streak8_d: "Продолжайте 8 недель подряд",
    badge_streak16_t: "Серия 16 недель", badge_streak16_d: "Четыре месяца, каждую неделю",
    badge_c25_t: "25 занятий", badge_c25_d: "Посетите 25 занятий",
    badge_c50_t: "50 занятий", badge_c50_d: "Посетите 50 занятий",
    badge_c100_t: "Клуб сотни", badge_c100_d: "Посетите 100 занятий",
    badge_early_t: "Ранняя пташка", badge_early_d: "10 занятий до 8:00",
    badge_night_t: "Полуночник", badge_night_d: "10 занятий в 19:00 или позже",
    badge_variety_t: "Искатель разнообразия", badge_variety_d: "Попробуйте 3 разных типа занятий",
    badge_consistency_t: "Чемпион постоянства", badge_consistency_d: "Посещайте 75% недель с первого занятия",
    persona_regular: "Завсегдатай {day}", persona_devotee: "Преданный поклонник {type} по {day}м",
    persona_tier0: "Только начало", persona_tier1: "Набираете обороты",
    persona_tier2: "Серьёзно стабильны", persona_tier3: "Настоящая машина",
    compare_period: "Период", compare_thisMonth: "Этот месяц", compare_lastMonth: "Прошлый месяц",
    compare_thisYear: "Этот год", compare_lastYear: "Прошлый год",
    compare_classes: "Посещено занятий", compare_lateCancelRate: "Доля поздних отмен",
    compare_avgWeek: "Среднее в неделю", compare_topType: "Топ тип занятия", compare_topTeacher: "Топ тренер",
    story_welcome: "Привет, {name} 👋", story_welcome_sub: "Давайте оглянемся на ваш путь тренировок.",
    story_total: "{n} занятий посещено", story_total_sub: "Это около {h} часов тренировок (оценочно).",
    story_day: "{day} — ваш день", story_day_sub: "{n} занятий — больше, чем в любой другой день.",
    story_teacher_eyebrow: "Больше всего вы тренировались с", story_teacher_sub: "{n} совместных занятий.",
    story_streak: "Серия {n} недель", story_streak_sub: "Ваша самая длинная серия без пропуска недели.",
    story_persona_eyebrow: "Ваш тип тренирующегося", story_badges: "{n}/{total} достижений открыто",
    story_share_title: "Спасибо, что тренируетесь с нами!", story_share_sub: "Скачайте карточку на память.",
    story_next: "Далее →", story_prev: "← Назад", story_done: "Готово", story_close: "✕",
    noData: "Пока недостаточно данных для этого вида."
  },
  uk: {
    title: "Минулі заняття", refresh: "↻ Оновити", refreshing: "↻ Оновлення…",
    resync: "Пересинхронізувати історію", resyncing: "Синхронізація…",
    loading: "Завантаження історії занять…",
    empty: "Історію занять поки не знайдено.", emptyHint: "Відкрийте головну сторінку BoostApp для синхронізації, потім оновіть сторінку.",
    emptyAuth: "Не вдалося підтвердити вхід в акаунт під час синхронізації.", emptyAuthHint: "Залиште вкладку BoostApp відкритою та увійдіть в акаунт, потім натисніть «Пересинхронізувати історію».",
    emptyNetwork: "Синхронізація постійно перевищувала час очікування.", emptyNetworkHint: "Перевірте з'єднання, залиште вкладку BoostApp відкритою, потім натисніть «Пересинхронізувати історію».",
    viewDashboard: "Дашборд", viewStory: "Історія", viewCompare: "Порівняння",
    shareImg: "🖼️ Поділитися", exportCsv: "⬇️ Експорт CSV",
    stat_total: "Відвідано занять", stat_thisMonth: "Цього місяця",
    stats_thisSelection: "Показано за", stats_allTime: "Загальні показники",
    stat_currentStreak: "Поточна серія", stat_longestStreak: "Найдовша серія",
    stat_lateCancelRate: "Частка пізніх скасувань", stat_months: "Місяців історії",
    stat_avgWeek: "Середнє на тиждень", stat_bestMonth: "Найкращий місяць",
    stat_avgGap: "Середній інтервал (днів)", stat_variety: "Випробувано типів занять",
    stat_hours: "Оцінка годин тренувань", weeks: "{n} тиж.", days: "{n} дн.",
    section_weekday: "Найактивніший день тижня", section_type: "За типом заняття",
    section_teacher: "За тренером", section_trend: "Занять на місяць", section_heatmap: "Календар відвідувань",
    section_punchcard: "За годиною і днем", section_growth: "Ваша подорож (накопичувально)",
    section_consistency: "Сталість", section_consistency_hint: "Частка тижнів з хоча б одним заняттям від першого разу",
    section_breakdown: "Розбивка тренувань", growth_caption: "{n} занять з {since} — у середньому {avg} на тиждень.",
    shareTpl_wrapped: "Картка підсумку", shareTpl_streak: "Картка серії", shareTpl_badges: "Картка досягнень", shareTpl_weekday: "Картка дня тижня",
    section_badges: "Досягнення", section_insights: "Для вас", section_filters: "Фільтр",
    noTeacher: "(тренера не вказано)", backfillNote: "Ще збираємо старіші місяці у фоні — оновіть трохи пізніше.",
    memberSince: "З нами з {m}",
    filter_all: "Весь час", filter_year: "Цей рік", filter_3m: "Останні 3 місяці", filter_month: "Цей місяць",
    filter_rangeLabel: "Період", filter_typeLabel: "Тип заняття", filter_teacherLabel: "Тренер",
    badge_tapDetails: "Натисніть для деталей", badge_status_earned: "🎉 Відкрито!", badge_status_progress: "Пройдено {pct}%",
    insight_addSuggest: "Ви відвідували <b>{cls}</b> з {teacher} по {day}ах о {time} {n} разів, але цього немає у списку відстеження.",
    insight_addBtn: "+ Додати", insight_added: "✓ Додано",
    insight_balance: "У вас залишилось <b>{r}</b> занять за абонементом {name} цього місяця.",
    insight_lateCancel: "Ви пізно скасовували <b>{cls}</b> по {day}ах о {time} {n} разів ({p}%).",
    insight_pauseBtn: "Призупинити", insight_paused: "✓ Призупинено",
    insight_none: "Все гаразд — зараз нічого не потребує уваги. 🎉",
    highlight_signature: "<b>{cls}</b> по {day}ах о {time} з {teacher} стало вашим фірмовим заняттям — вже {n} разів.",
    highlight_momentumUp: "Ви набираєте обертів — у середньому на <b>{pct}%</b> більше занять, ніж зазвичай. 🔥",
    highlight_momentumDown: "Темп трохи знизився останнім часом — приблизно на {pct}% нижче звичайного. Нічого страшного.",
    highlight_momentumSteady: "Рівний темп — ви тримаєте свій звичний ритм приблизно <b>{avg}</b> занять на тиждень.",
    highlight_milestone: "Ще <b>{n}</b> занять(тя) до відкриття \"{badge}\".",
    highlight_milestoneRatio: "Ви пройшли <b>{pct}%</b> шляху до відкриття \"{badge}\".",
    highlight_allBadges: "Ви відкрили всі досягнення — неймовірна стабільність! 🏆",
    highlight_planUsage: "У вас залишилось <b>{r}</b> занять за абонементом {name} цього місяця.",
    highlight_streak: "Зараз у вас серія <b>{n}</b> тижнів — ваш рекорд {best}.",
    highlight_bestStreak: "Ваш особистий рекорд — серія з <b>{best}</b> тижнів — час його побити?",
    highlight_getStarted: "Ваша тренувальна історія тільки починається — продовжуйте, і статистика з'явиться. 👋",
    badge_streak4_t: "Серія 4 тижні", badge_streak4_d: "Відвідуйте мінімум раз на тиждень 4 тижні поспіль",
    badge_streak8_t: "Серія 8 тижнів", badge_streak8_d: "Продовжуйте 8 тижнів поспіль",
    badge_streak16_t: "Серія 16 тижнів", badge_streak16_d: "Чотири місяці, кожен тиждень",
    badge_c25_t: "25 занять", badge_c25_d: "Відвідайте 25 занять",
    badge_c50_t: "50 занять", badge_c50_d: "Відвідайте 50 занять",
    badge_c100_t: "Клуб сотні", badge_c100_d: "Відвідайте 100 занять",
    badge_early_t: "Рання пташка", badge_early_d: "10 занять до 8:00",
    badge_night_t: "Нічна сова", badge_night_d: "10 занять о 19:00 або пізніше",
    badge_variety_t: "Шукач різноманіття", badge_variety_d: "Спробуйте 3 різних типи занять",
    badge_consistency_t: "Чемпіон сталості", badge_consistency_d: "Відвідуйте 75% тижнів з першого заняття",
    persona_regular: "Завсідник {day}", persona_devotee: "Відданий шанувальник {type} по {day}ах",
    persona_tier0: "Тільки початок", persona_tier1: "Набираєте оберти",
    persona_tier2: "Серйозно стабільні", persona_tier3: "Справжня машина",
    compare_period: "Період", compare_thisMonth: "Цей місяць", compare_lastMonth: "Минулий місяць",
    compare_thisYear: "Цей рік", compare_lastYear: "Минулий рік",
    compare_classes: "Відвідано занять", compare_lateCancelRate: "Частка пізніх скасувань",
    compare_avgWeek: "Середнє на тиждень", compare_topType: "Топ тип заняття", compare_topTeacher: "Топ тренер",
    story_welcome: "Привіт, {name} 👋", story_welcome_sub: "Погляньмо на вашу тренувальну подорож.",
    story_total: "{n} занять відвідано", story_total_sub: "Це приблизно {h} годин тренувань (орієнтовно).",
    story_day: "{day} — ваш день", story_day_sub: "{n} занять — більше, ніж будь-якого іншого дня.",
    story_teacher_eyebrow: "Найбільше ви тренувались з", story_teacher_sub: "{n} спільних занять.",
    story_streak: "Серія {n} тижнів", story_streak_sub: "Ваша найдовша серія без пропуску тижня.",
    story_persona_eyebrow: "Ваш тип тренувань", story_badges: "{n}/{total} досягнень відкрито",
    story_share_title: "Дякуємо, що тренуєтесь з нами!", story_share_sub: "Завантажте картку на пам'ять.",
    story_next: "Далі →", story_prev: "← Назад", story_done: "Готово", story_close: "✕",
    noData: "Поки що недостатньо даних для цього вигляду."
  },
  ar: {
    title: "الحصص السابقة", refresh: "↻ تحديث", refreshing: "↻ جارٍ التحديث…",
    resync: "إعادة مزامنة السجل بالكامل", resyncing: "جارٍ المزامنة…",
    loading: "جارٍ تحميل سجل الحصص…",
    empty: "لم يتم العثور على سجل حصص بعد.", emptyHint: "افتح الصفحة الرئيسية لـ BoostApp للمزامنة، ثم أعد تحميل هذه الصفحة.",
    emptyAuth: "تعذّر التأكد من تسجيل دخولك أثناء المزامنة.", emptyAuthHint: "أبقِ تبويب BoostApp مفتوحًا ومسجّلاً للدخول، ثم اضغط على إعادة مزامنة السجل بالكامل.",
    emptyNetwork: "استمرت المزامنة في تجاوز مهلة الانتظار.", emptyNetworkHint: "تحقق من اتصالك بالإنترنت، أبقِ تبويب BoostApp مفتوحًا، ثم اضغط على إعادة مزامنة السجل بالكامل.",
    viewDashboard: "لوحة التحكم", viewStory: "القصة", viewCompare: "مقارنة",
    shareImg: "🖼️ مشاركة صورة", exportCsv: "⬇️ تصدير CSV",
    stat_total: "الحصص التي حضرتها", stat_thisMonth: "هذا الشهر",
    stats_thisSelection: "يعرض", stats_allTime: "أرقام قياسية شاملة",
    stat_currentStreak: "التتابع الحالي", stat_longestStreak: "أطول تتابع",
    stat_lateCancelRate: "نسبة الإلغاء المتأخر", stat_months: "أشهر السجل",
    stat_avgWeek: "متوسط الحصص أسبوعيًا", stat_bestMonth: "أفضل شهر",
    stat_avgGap: "متوسط الأيام بين الحصص", stat_variety: "أنواع الحصص المجرّبة",
    stat_hours: "ساعات تدريب مقدّرة", weeks: "{n} أسبوع", days: "{n} يوم",
    section_weekday: "أكثر يوم نشاطًا بالأسبوع", section_type: "حسب نوع الحصة",
    section_teacher: "حسب المدرب", section_trend: "الحصص شهريًا", section_heatmap: "تقويم الحضور",
    section_punchcard: "حسب الساعة واليوم", section_growth: "رحلتك (تراكمي)",
    section_consistency: "الثبات", section_consistency_hint: "نسبة الأسابيع التي بها حصة واحدة على الأقل منذ أول حصة",
    section_breakdown: "تفصيل تدريباتك", growth_caption: "{n} حصة منذ {since} — بمعدل {avg} أسبوعيًا.",
    shareTpl_wrapped: "بطاقة الملخص", shareTpl_streak: "بطاقة التتابع", shareTpl_badges: "بطاقة الإنجازات", shareTpl_weekday: "بطاقة اليوم",
    section_badges: "الإنجازات", section_insights: "لك", section_filters: "تصفية",
    noTeacher: "(لم يُذكر مدرب)", backfillNote: "لا يزال يجمع أشهرًا أقدم في الخلفية — أعد التحديث بعد قليل.",
    memberSince: "تتدرب معنا منذ {m}",
    filter_all: "كل الوقت", filter_year: "هذا العام", filter_3m: "آخر 3 أشهر", filter_month: "هذا الشهر",
    filter_rangeLabel: "النطاق", filter_typeLabel: "نوع الحصة", filter_teacherLabel: "المدرب",
    badge_tapDetails: "اضغط للتفاصيل", badge_status_earned: "🎉 تم الفتح!", badge_status_progress: "{pct}% في الطريق",
    insight_addSuggest: "حضرت <b>{cls}</b> مع {teacher} أيام {day} الساعة {time} {n} مرات، لكنها ليست في قائمة المتابعة.",
    insight_addBtn: "+ إضافة للمتابعة", insight_added: "✓ تمت الإضافة",
    insight_balance: "لا يزال لديك <b>{r}</b> حصة/حصص في اشتراك {name} هذا الشهر.",
    insight_lateCancel: "ألغيت <b>{cls}</b> متأخرًا أيام {day} الساعة {time} {n} مرات ({p}%).",
    insight_pauseBtn: "إيقاف هذه الحصة مؤقتًا", insight_paused: "✓ متوقف",
    insight_none: "كل شيء تمام — لا يوجد ما يحتاج انتباهك الآن. 🎉",
    highlight_signature: "أصبحت <b>{cls}</b> أيام {day} الساعة {time} مع {teacher} حصتك المميزة — {n} مرة حتى الآن.",
    highlight_momentumUp: "أنت في تقدم — بمعدل <b>{pct}%</b> حصص أكثر من المعتاد مؤخرًا. 🔥",
    highlight_momentumDown: "تباطأت الوتيرة قليلًا مؤخرًا — أقل بحوالي {pct}% من متوسطك المعتاد. لا بأس بذلك.",
    highlight_momentumSteady: "بنفس الوتيرة — تحافظ على إيقاعك المعتاد بحوالي <b>{avg}</b> حصص أسبوعيًا.",
    highlight_milestone: "بقي <b>{n}</b> حصة/حصص لفتح \"{badge}\".",
    highlight_milestoneRatio: "أنجزت <b>{pct}%</b> من الطريق لفتح \"{badge}\".",
    highlight_allBadges: "لقد فتحت جميع الإنجازات حتى الآن — ثبات مذهل! 🏆",
    highlight_planUsage: "لا يزال لديك <b>{r}</b> حصة/حصص في اشتراك {name} هذا الشهر.",
    highlight_streak: "أنت في تتابع <b>{n}</b> أسبوعًا الآن — رقمك القياسي هو {best}.",
    highlight_bestStreak: "رقمك القياسي هو تتابع <b>{best}</b> أسبوعًا — حان وقت كسره؟",
    highlight_getStarted: "قصتك التدريبية بدأت للتو — استمر في الحضور وستظهر الإحصائيات. 👋",
    badge_streak4_t: "تتابع 4 أسابيع", badge_streak4_d: "احضر مرة أسبوعيًا على الأقل لمدة 4 أسابيع",
    badge_streak8_t: "تتابع 8 أسابيع", badge_streak8_d: "استمر 8 أسابيع متتالية",
    badge_streak16_t: "تتابع 16 أسبوعًا", badge_streak16_d: "أربعة أشهر، كل أسبوع",
    badge_c25_t: "25 حصة", badge_c25_d: "احضر 25 حصة",
    badge_c50_t: "50 حصة", badge_c50_d: "احضر 50 حصة",
    badge_c100_t: "نادي المئة", badge_c100_d: "احضر 100 حصة",
    badge_early_t: "الطائر المبكر", badge_early_d: "10 حصص قبل الساعة 8:00",
    badge_night_t: "بومة الليل", badge_night_d: "10 حصص الساعة 19:00 أو بعدها",
    badge_variety_t: "الباحث عن التنوع", badge_variety_d: "جرّب 3 أنواع مختلفة من الحصص",
    badge_consistency_t: "بطل الثبات", badge_consistency_d: "احضر في 75% من الأسابيع منذ أول حصة",
    persona_regular: "مواظب يوم {day}", persona_devotee: "عاشق {type} يوم {day}",
    persona_tier0: "بداية الطريق", persona_tier1: "يكتسب الزخم",
    persona_tier2: "ثابت بجدية", persona_tier3: "آلة حقيقية",
    compare_period: "الفترة", compare_thisMonth: "هذا الشهر", compare_lastMonth: "الشهر الماضي",
    compare_thisYear: "هذا العام", compare_lastYear: "العام الماضي",
    compare_classes: "الحصص المحضورة", compare_lateCancelRate: "نسبة الإلغاء المتأخر",
    compare_avgWeek: "المتوسط أسبوعيًا", compare_topType: "أكثر نوع حصة", compare_topTeacher: "أكثر مدرب",
    story_welcome: "أهلًا {name} 👋", story_welcome_sub: "لنُلقِ نظرة على رحلتك التدريبية.",
    story_total: "{n} حصة تم حضورها", story_total_sub: "هذا حوالي {h} ساعة تدريب (تقديرًا).",
    story_day: "{day} هو يومك", story_day_sub: "{n} حصة — أكثر من أي يوم آخر بالأسبوع.",
    story_teacher_eyebrow: "تدربت أكثر مع", story_teacher_sub: "{n} حصة مشتركة.",
    story_streak: "تتابع {n} أسبوعًا", story_streak_sub: "أطول تتابع لك دون تفويت أسبوع.",
    story_persona_eyebrow: "شخصيتك التدريبية", story_badges: "{n}/{total} إنجاز مفتوح",
    story_share_title: "شكرًا لتدربك معنا!", story_share_sub: "نزّل بطاقة لتتذكر بها هذا.",
    story_next: "التالي ←", story_prev: "→ السابق", story_done: "تم", story_close: "✕",
    noData: "لا توجد بيانات كافية بعد لهذا العرض."
  }
};

// Shared plot height so the month-trend bars and the growth curve line up
// visually when placed side-by-side in the breakdown row.
const CHART_HEIGHT = 110;

let LANG = "en", CFG = (window.__BOOST_STANDALONE_CFG__ || { lang: "en", theme: "system" });
let ALL_RECORDS = (window.__BOOST_STANDALONE_RECORDS__ || []), META = (window.__BOOST_STANDALONE_META__ || {}), STATE = (window.__BOOST_STANDALONE_STATE__ || {});
let FILTERS = { range: "all", types: new Set(), teachers: new Set() };
let CURRENT_VIEW = "dashboard";
let storySlides = [], storyIndex = 0;

function t(key, params) {
  let s = (I18N[LANG] && I18N[LANG][key]) || I18N.en[key] || key;
  if (params) Object.keys(params).forEach(k => { s = s.replace(`{${k}}`, params[k]); });
  return s;
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
  document.querySelectorAll("[data-i18n]").forEach(el => { el.innerHTML = t(el.getAttribute("data-i18n")); });
  updateStickyOffsets();
}

// Keeps the sticky filter bar pinned directly below the header, whatever the
// header's actual rendered height is (it wraps to more than one line on
// narrow windows or long translated button labels).
function updateStickyOffsets() {
  const header = document.querySelector("header");
  if (header) document.documentElement.style.setProperty("--sticky-top", header.offsetHeight + "px");
}
window.addEventListener("resize", updateStickyOffsets);

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function weekStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function daysBetween(a, b) { return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function estimateDurationMin(className) { return /stretch/i.test(className || "") ? 45 : 55; }

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------
function rangeStart(range) {
  const now = new Date();
  if (range === "year") return `${now.getFullYear()}-01-01`;
  if (range === "3m") { const d = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  if (range === "month") return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  return null; // "all"
}
function filterRangeLabel(range) {
  return t("filter_" + (range || "all"));
}
function filterRecords(records, filters) {
  const start = rangeStart(filters.range);
  return records.filter(r => {
    if (start && r.date < start) return false;
    if (filters.types.size && !filters.types.has(r.className)) return false;
    if (filters.teachers.size && !filters.teachers.has(r.teacher)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------
function aggregate(records) {
  const attended = records.filter(r => r.status === "attended");
  const lateCancel = records.filter(r => r.status === "lateCancel");
  const cancelled = records.filter(r => r.status === "cancelled");
  const noShow = records.filter(r => r.status === "noShow");
  const totalCountable = attended.length + lateCancel.length + cancelled.length + noShow.length;

  const now = new Date();
  const curYm = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const thisMonth = attended.filter(r => r.month === curYm).length;

  const byType = {}, byTeacher = {}, byMonth = {}, byDate = {};
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  const hourGrid = Array.from({ length: 7 }, () => ({})); // hourGrid[weekday][hour] = count
  let earlyBird = 0, nightOwl = 0, minutesTotal = 0;
  attended.forEach(r => {
    byType[r.className] = (byType[r.className] || 0) + 1;
    if (r.teacher) byTeacher[r.teacher] = (byTeacher[r.teacher] || 0) + 1;
    byWeekday[r.weekday]++;
    byMonth[r.month] = (byMonth[r.month] || 0) + 1;
    byDate[r.date] = (byDate[r.date] || 0) + 1;
    if (r.time && r.time < "08:00") earlyBird++;
    if (r.time && r.time >= "19:00") nightOwl++;
    minutesTotal += estimateDurationMin(r.className);
    if (r.time) {
      const hour = Number(r.time.slice(0, 2));
      if (!isNaN(hour)) hourGrid[r.weekday][hour] = (hourGrid[r.weekday][hour] || 0) + 1;
    }
  });

  // Streaks, in Sunday-start weeks.
  const weeksWithClass = new Set(attended.map(r => weekStart(r.date)));
  let longestStreak = 0, currentStreak = 0;
  if (weeksWithClass.size) {
    const sortedWeeks = Array.from(weeksWithClass).sort();
    const start = new Date(sortedWeeks[0] + "T00:00:00");
    const end = new Date(sortedWeeks[sortedWeeks.length - 1] + "T00:00:00");
    let run = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (weeksWithClass.has(key)) { run++; longestStreak = Math.max(longestStreak, run); }
      else run = 0;
    }
    let d = new Date(end);
    while (weeksWithClass.has(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)) {
      currentStreak++; d.setDate(d.getDate() - 7);
    }
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  const lateCancelRate = totalCountable ? lateCancel.length / totalCountable : 0;
  const sortedDates = attended.map(r => r.date).sort();
  const minDate = sortedDates[0] || null, maxDate = sortedDates[sortedDates.length - 1] || null;

  // Weeks span from first class to today, for averages + consistency ratio.
  let weeksSpan = 1;
  if (minDate) weeksSpan = Math.max(1, Math.ceil((daysBetween(minDate, todayStr()) + 1) / 7));
  const avgPerWeek = attended.length / weeksSpan;

  const last28Cutoff = new Date(); last28Cutoff.setDate(last28Cutoff.getDate() - 28);
  const last28Str = `${last28Cutoff.getFullYear()}-${pad(last28Cutoff.getMonth() + 1)}-${pad(last28Cutoff.getDate())}`;
  const last4WeeksCount = attended.filter(r => r.date >= last28Str).length;
  const avgPerWeekRecent = last4WeeksCount / 4;

  let avgGapDays = null;
  if (sortedDates.length > 1) {
    let sum = 0;
    for (let i = 1; i < sortedDates.length; i++) sum += daysBetween(sortedDates[i - 1], sortedDates[i]);
    avgGapDays = sum / (sortedDates.length - 1);
  }

  const monthKeys = Object.keys(byMonth);
  let bestMonth = null, bestMonthCount = 0;
  monthKeys.forEach(m => { if (byMonth[m] > bestMonthCount) { bestMonthCount = byMonth[m]; bestMonth = m; } });

  const weeksActiveRatio = weeksWithClass.size / weeksSpan;

  // Cumulative "growth curve": running total of classes attended, one point per
  // week from the first class through the current week.
  const weeklySeries = [];
  if (minDate) {
    const perWeek = {};
    attended.forEach(r => { const wk = weekStart(r.date); perWeek[wk] = (perWeek[wk] || 0) + 1; });
    let cumulative = 0;
    const cursor = new Date(weekStart(minDate) + "T00:00:00");
    const end = new Date(weekStart(todayStr()) + "T00:00:00");
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
      cumulative += (perWeek[key] || 0);
      weeklySeries.push({ week: key, cumulative });
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  return {
    attendedCount: attended.length, thisMonth, byType, byTeacher, byWeekday, byMonth, byDate, hourGrid,
    longestStreak, currentStreak, lateCancelRate, lateCancelCount: lateCancel.length,
    minDate, maxDate, avgPerWeek, avgPerWeekRecent, avgGapDays, bestMonth, bestMonthCount,
    variety: Object.keys(byType).length, earlyBird, nightOwl, estHours: Math.round(minutesTotal / 60),
    weeksActiveRatio: Math.min(1, weeksActiveRatio), weeksSpan, weeklySeries
  };
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
const BADGE_DEFS = [
  { id: "streak4", icon: "🔥", target: 4, get: a => Math.max(a.currentStreak, a.longestStreak) },
  { id: "streak8", icon: "🔥", target: 8, get: a => Math.max(a.currentStreak, a.longestStreak) },
  { id: "streak16", icon: "🔥", target: 16, get: a => Math.max(a.currentStreak, a.longestStreak) },
  { id: "c25", icon: "🏋️", target: 25, get: a => a.attendedCount },
  { id: "c50", icon: "🥈", target: 50, get: a => a.attendedCount },
  { id: "c100", icon: "🏆", target: 100, get: a => a.attendedCount },
  { id: "early", icon: "🌅", target: 10, get: a => a.earlyBird },
  { id: "night", icon: "🦉", target: 10, get: a => a.nightOwl },
  { id: "variety", icon: "🌈", target: 3, get: a => a.variety },
  { id: "consistency", icon: "📅", target: 0.75, get: a => a.weeksActiveRatio, isRatio: true }
];
function computeBadges(agg) {
  return BADGE_DEFS.map(b => {
    const cur = b.get(agg);
    const earned = cur >= b.target;
    const progressPct = Math.max(0, Math.min(100, Math.round((cur / b.target) * 100)));
    return Object.assign({}, b, { cur, earned, progressPct });
  });
}

// ---------------------------------------------------------------------------
// Persona
// ---------------------------------------------------------------------------
function computePersona(agg) {
  const labels = WDFULL[LANG] || WDFULL.en;
  let topWd = 0, topWdN = -1;
  agg.byWeekday.forEach((n, i) => { if (n > topWdN) { topWdN = n; topWd = i; } });
  const typeEntries = Object.entries(agg.byType).sort((a, b) => b[1] - a[1]);
  let title;
  if (typeEntries.length && agg.attendedCount && (typeEntries[0][1] / agg.attendedCount) >= 0.45) {
    title = t("persona_devotee", { day: labels[topWd], type: typeEntries[0][0] });
  } else {
    title = t("persona_regular", { day: labels[topWd] });
  }
  const streak = Math.max(agg.currentStreak, agg.longestStreak);
  const tier = streak >= 16 ? 3 : streak >= 8 ? 2 : streak >= 4 ? 1 : 0;
  return { title, subtitle: t("persona_tier" + tier), topWeekday: labels[topWd] };
}

// ---------------------------------------------------------------------------
// "For you" highlights — purely informational, celebratory facts about the
// person's own habits (no automation nudges, no action buttons). Pulls from
// the same aggregate/badge data already computed for the rest of the page.
// ---------------------------------------------------------------------------
function slotKey(weekday, time, className) { return `${weekday}|${time}|${className}`; }

function computeHighlights(records, agg, badges) {
  const attended = records.filter(r => r.status === "attended");
  const wdLabels = WDFULL[LANG] || WDFULL.en;
  const highlights = [];

  // 1) Signature session — the recurring weekday+time+class combo attended most.
  const combos = {};
  attended.forEach(r => {
    const k = slotKey(r.weekday, r.time, r.className);
    if (!combos[k]) combos[k] = { weekday: r.weekday, time: r.time, className: r.className, count: 0, teachers: {} };
    combos[k].count++;
    if (r.teacher) combos[k].teachers[r.teacher] = (combos[k].teachers[r.teacher] || 0) + 1;
  });
  const topCombo = Object.values(combos).sort((a, b) => b.count - a.count)[0];
  if (topCombo && topCombo.count >= 3) {
    const teacher = Object.entries(topCombo.teachers).sort((a, b) => b[1] - a[1])[0];
    highlights.push({
      icon: "📌",
      text: t("highlight_signature", { cls: esc(topCombo.className), teacher: esc(teacher ? teacher[0] : ""), day: wdLabels[topCombo.weekday], time: topCombo.time, n: topCombo.count })
    });
  }

  // 2) Momentum — recent 4-week pace vs. your all-time average.
  if (agg.avgPerWeek > 0) {
    const diffPct = Math.round(((agg.avgPerWeekRecent - agg.avgPerWeek) / agg.avgPerWeek) * 100);
    if (diffPct >= 15) highlights.push({ icon: "🔥", text: t("highlight_momentumUp", { pct: diffPct }) });
    else if (diffPct <= -15) highlights.push({ icon: "🌤️", text: t("highlight_momentumDown", { pct: Math.abs(diffPct) }) });
    else highlights.push({ icon: "⚖️", text: t("highlight_momentumSteady", { avg: agg.avgPerWeek.toFixed(1) }) });
  }

  // 3) Next milestone — the closest achievement not yet unlocked.
  const unearned = (badges || []).filter(b => !b.earned).sort((a, b) => b.progressPct - a.progressPct);
  if (unearned.length) {
    const b = unearned[0];
    const badgeTitle = esc(t("badge_" + b.id + "_t"));
    highlights.push({
      icon: "🎯",
      text: b.isRatio
        ? t("highlight_milestoneRatio", { pct: b.progressPct, badge: badgeTitle })
        : t("highlight_milestone", { n: Math.max(0, b.target - b.cur), badge: badgeTitle })
    });
  } else if (badges && badges.length) {
    highlights.push({ icon: "🏆", text: t("highlight_allBadges") });
  }

  // 4) Plan usage this month, or — if there's no subscription data — a
  // streak-encouragement fact instead.
  const subs = (STATE.subscription && STATE.subscription.items) || [];
  const activeSub = subs.find(s => s.monthly && typeof s.monthly.remaining === "number" && !s.isExpired && !s.isFrozen);
  if (activeSub) {
    highlights.push({ icon: "🎟️", text: t("highlight_planUsage", { r: activeSub.monthly.remaining, name: esc(activeSub.name || activeSub.shortName || "") }) });
  } else if (agg.currentStreak > 0) {
    highlights.push({ icon: "📅", text: t("highlight_streak", { n: agg.currentStreak, best: agg.longestStreak }) });
  } else if (agg.longestStreak > 0) {
    highlights.push({ icon: "📅", text: t("highlight_bestStreak", { best: agg.longestStreak }) });
  } else {
    highlights.push({ icon: "👋", text: t("highlight_getStarted") });
  }

  return highlights.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Rendering — shared bits
// ---------------------------------------------------------------------------
function renderBarList(entries, max) {
  if (!entries.length) return `<div class="subnote">—</div>`;
  return entries.map(([label, count]) => `
    <div class="bar-row">
      <div class="bl" title="${esc(label)}">${esc(label)}</div>
      <div class="bt"><div class="bf" style="width:${Math.max(3, Math.round(count / max * 100))}%"></div></div>
      <div class="bn">${count}</div>
    </div>`).join("");
}
function renderWeekdayChart(byWeekday) {
  const max = Math.max(1, ...byWeekday);
  const labels = WDSHORT[LANG] || WDSHORT.en;
  return `<div class="weekday-chart">${byWeekday.map((n, i) => `
    <div class="wd-col">
      <div class="wd-n">${n || ""}</div>
      <div class="wd-bar" style="height:${Math.max(2, Math.round(n / max * 100))}%"></div>
      <div class="wd-lbl">${labels[i]}</div>
    </div>`).join("")}</div>`;
}
function renderMonthTrend(byMonth) {
  const months = Object.keys(byMonth).sort();
  if (!months.length) return `<div class="subnote">—</div>`;
  const max = Math.max(1, ...months.map(m => byMonth[m]));
  const names = MONTHNAME[LANG] || MONTHNAME.en;
  return `<div class="month-trend">${months.map(m => {
    const n = byMonth[m];
    const mi = Number(m.split("-")[1]) - 1;
    return `<div class="mt-col" title="${esc(names[mi])} ${m.split("-")[0]}: ${n}">
      <div class="wd-n">${n}</div>
      <div class="mt-bar" style="height:${Math.max(2, Math.round(n / max * 100))}%"></div>
      <div class="mt-lbl">${names[mi].slice(0, 3)}</div>
    </div>`;
  }).join("")}</div>`;
}
function heatClass(n) { if (!n) return ""; if (n === 1) return "h1"; if (n === 2) return "h2"; if (n === 3) return "h3"; return "h4"; }
function renderHeatmapMonth(year, month, byDate) {
  const names = MONTHNAME[LANG] || MONTHNAME.en;
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadEmpty = first.getDay();
  const labels = WDSHORT[LANG] || WDSHORT.en;
  let cells = "";
  for (let i = 0; i < leadEmpty; i++) cells += `<div class="hm-cell empty-cell"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${year}-${pad(month + 1)}-${pad(day)}`;
    const n = byDate[ds] || 0;
    cells += `<div class="hm-cell ${heatClass(n)}" title="${ds}: ${n}">
      <span class="hm-num">${day}</span>${n ? `<span class="hm-mark">✓</span>` : ""}
    </div>`;
  }
  return `<div class="heatmonth"><div class="hm-title">${esc(names[month])} ${year}</div>
    <div class="hm-wd">${labels.map(l => `<span>${l}</span>`).join("")}</div>
    <div class="hm-days">${cells}</div></div>`;
}
function renderHeatmap(minDate, maxDate, byDate) {
  if (!minDate || !maxDate) return `<div class="subnote">—</div>`;
  const start = new Date(minDate + "T00:00:00"), end = new Date(maxDate + "T00:00:00");
  const months = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) { months.push({ y: cursor.getFullYear(), m: cursor.getMonth() }); cursor.setMonth(cursor.getMonth() + 1); }
  return `<div class="heatgrid">${months.map(({ y, m }) => renderHeatmapMonth(y, m, byDate)).join("")}</div>`;
}

// Hour × weekday punch-card: continuous saturation (opacity), not banded —
// the single most popular hour/day cell ends up fully saturated.
function renderPunchCard(hourGrid) {
  const wdLabels = WDSHORT[LANG] || WDSHORT.en;
  let maxCount = 0, minHour = 23, maxHour = 0, any = false;
  hourGrid.forEach(row => Object.entries(row).forEach(([h, n]) => {
    any = true; h = Number(h);
    if (n > maxCount) maxCount = n;
    if (h < minHour) minHour = h;
    if (h > maxHour) maxHour = h;
  }));
  if (!any) return `<div class="subnote">—</div>`;
  const hours = []; for (let h = minHour; h <= maxHour; h++) hours.push(h);
  const cols = `48px repeat(${hours.length}, 1fr)`;
  let html = `<div class="punchcard"><div class="punch-grid" style="grid-template-columns:${cols}">`;
  html += `<div></div>` + hours.map(h => `<div class="punch-hlabel">${h}</div>`).join("");
  for (let wd = 0; wd < 7; wd++) {
    html += `<div class="punch-wlabel">${wdLabels[wd]}</div>`;
    hours.forEach(h => {
      const n = hourGrid[wd][h] || 0;
      const alpha = n ? (0.18 + 0.82 * (n / maxCount)) : 0;
      html += n
        ? `<div class="punch-cell" style="opacity:${alpha.toFixed(2)}" title="${wdLabels[wd]} ${h}:00 — ${n}"></div>`
        : `<div class="punch-cell z" title="${wdLabels[wd]} ${h}:00 — 0"></div>`;
    });
  }
  html += `</div></div>`;
  return html;
}

// Cumulative "growth curve" — total classes attended over time, Duolingo/XP-style.
// `responsive: true` renders the SVG at a fixed viewBox that scales to fill its
// container width (used inside the compact quad-grid card), instead of a fixed
// pixel width tied to the number of data points — the latter forced its grid
// track to blow out past the other three cards in that row.
function renderGrowthCurve(weeklySeries, opts) {
  if (!weeklySeries.length) return `<div class="subnote">—</div>`;
  const responsive = !!(opts && opts.responsive);
  const h = CHART_HEIGHT, pad2 = 10;
  const w = responsive ? 320 : Math.max(320, weeklySeries.length * 14);
  const max = weeklySeries[weeklySeries.length - 1].cumulative || 1;
  const stepX = (w - pad2 * 2) / Math.max(1, weeklySeries.length - 1);
  const pts = weeklySeries.map((p, i) => {
    const x = pad2 + i * stepX;
    const y = h - pad2 - (p.cumulative / max) * (h - pad2 * 2);
    return [x, y];
  });
  const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = line + ` L${pts[pts.length - 1][0].toFixed(1)},${h - pad2} L${pts[0][0].toFixed(1)},${h - pad2} Z`;
  const sizeAttrs = responsive
    ? `viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;"`
    : `width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"`;
  return `<div class="growth-wrap"><svg class="growth-svg" ${sizeAttrs}>
    <path d="${area}" fill="var(--green-deep)" opacity="0.15"></path>
    <path d="${line}" fill="none" stroke="var(--green-deep)" stroke-width="2.5"></path>
  </svg></div>`;
}

// Apple-Watch-style progress ring for "% of weeks active since your first class".
function renderConsistencyRing(ratio) {
  const size = 90, stroke = 10, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, ratio));
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ghost)" stroke-width="${stroke}"></circle>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--green-deep)" stroke-width="${stroke}"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" stroke-linecap="round"
      transform="rotate(-90 ${size / 2} ${size / 2})"></circle>
    <text x="50%" y="53%" text-anchor="middle" font-size="18" font-weight="800" fill="var(--text)">${Math.round(ratio * 100)}%</text>
  </svg>`;
}
function pct(n) { return Math.round(n * 1000) / 10; }
function fmtMonth(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  return `${(MONTHNAME[LANG] || MONTHNAME.en)[m - 1]} ${y}`;
}

function renderUserCard(agg, persona) {
  const name = (STATE.client && STATE.client.name) || "";
  const photo = (STATE.client && STATE.client.photo) || "";
  // Prefer the earliest ATTENDED class (same value the heatmap/trend charts
  // use) so this line can never disagree with what's drawn below it. Only
  // fall back to the backend's oldestMonth (e.g. a cancellation with no
  // attended classes yet) when there's truly no attended history at all.
  const sinceYm = (agg.minDate && agg.minDate.slice(0, 7)) || META.oldestMonth;
  const since = sinceYm ? t("memberSince", { m: fmtMonth(sinceYm) }) : "";
  const initial = name ? esc(name.trim()[0] || "") : "🏋";
  return `
    <div class="usercard">
      <div class="uc-avatar">${photo ? `<img src="${esc(photo)}" alt="">` : initial}</div>
      <div class="uc-main">
        <div class="uc-name">${esc(name || "")}</div>
        <div class="uc-since">${esc(since)}</div>
      </div>
      <div class="uc-persona">
        <div class="pt">${esc(persona.title)}</div>
        <div class="ps">${esc(persona.subtitle)}</div>
      </div>
    </div>`;
}
function renderBadges(badges) {
  return `<div class="badges">${badges.map((b, i) => {
    const title = esc(t("badge_" + b.id + "_t"));
    const desc = esc(t("badge_" + b.id + "_d"));
    const fraction = `${b.isRatio ? pct(b.cur) + "%" : Math.min(b.cur, b.target)}/${b.isRatio ? "75%" : b.target}`;
    const status = b.earned ? t("badge_status_earned") : t("badge_status_progress", { pct: b.progressPct });
    return `
    <div class="badge ${b.earned ? "earned" : ""}" data-i="${i}">
      <div class="badge-inner">
        <div class="badge-face badge-front">
          <div class="bi">${b.icon}</div>
          <div class="bt">${title}</div>
          <div class="bp">${fraction}</div>
          ${!b.earned ? `<div class="bbar"><i style="width:${b.progressPct}%"></i></div>` : ""}
          <div class="bexp">${esc(t("badge_tapDetails"))}</div>
        </div>
        <div class="badge-face badge-back">
          <div class="bb-icon">${b.icon}</div>
          <div class="bb-title">${title}</div>
          <div class="bb-desc">${desc}</div>
          <div class="bb-status ${b.earned ? "on" : "off"}">${esc(status)}</div>
        </div>
      </div>
    </div>`;
  }).join("")}</div>`;
}
function wireBadgeFlip() {
  document.querySelectorAll(".badge").forEach(el => {
    el.addEventListener("click", () => el.classList.toggle("flipped"));
  });
}

// ---------------------------------------------------------------------------
// Highlights rendering — plain informational cards, no buttons.
// ---------------------------------------------------------------------------
function renderHighlights(highlights) {
  if (!highlights.length) return `<div class="insight ok"><div class="ii">✅</div><div class="it">${esc(t("insight_none"))}</div></div>`;
  return highlights.map(h => `<div class="insight"><div class="ii">${h.icon}</div><div class="it">${h.text}</div></div>`).join("");
}

// ---------------------------------------------------------------------------
// Dashboard view
// ---------------------------------------------------------------------------
function trendDelta(recent, allTime) {
  if (!allTime) return "";
  const diff = ((recent - allTime) / allTime) * 100;
  if (Math.abs(diff) < 8) return "";
  const cls = diff > 0 ? "up" : "down";
  const arrow = diff > 0 ? "▲" : "▼";
  return `<div class="delta ${cls}">${arrow} ${Math.abs(Math.round(diff))}%</div>`;
}

function renderFilterBar(allRecords) {
  const types = Array.from(new Set(allRecords.filter(r => r.status === "attended").map(r => r.className))).sort();
  const teachers = Array.from(new Set(allRecords.filter(r => r.status === "attended" && r.teacher).map(r => r.teacher))).sort();
  const rangeChip = (key, label) => `<button class="chip range-chip ${FILTERS.range === key ? "active" : ""}" data-range="${key}">${esc(label)}</button>`;
  const typeChip = (v) => `<button class="chip type-chip ${FILTERS.types.has(v) ? "active" : ""}" data-type="${esc(v)}">${esc(v)}</button>`;
  const teacherChip = (v) => `<button class="chip teacher-chip ${FILTERS.teachers.has(v) ? "active" : ""}" data-teacher="${esc(v)}">${esc(v)}</button>`;
  return `
    <div class="filterbar">
      <div class="filter-row">
        <div class="filter-label">${esc(t("filter_rangeLabel"))}</div>
        <div class="chipgroup">${rangeChip("all", t("filter_all"))}${rangeChip("year", t("filter_year"))}${rangeChip("3m", t("filter_3m"))}${rangeChip("month", t("filter_month"))}</div>
      </div>
      ${types.length ? `<div class="filter-row">
        <div class="filter-label">${esc(t("filter_typeLabel"))}</div>
        <div class="chipgroup">${types.map(typeChip).join("")}</div>
      </div>` : ""}
      ${teachers.length ? `<div class="filter-row">
        <div class="filter-label">${esc(t("filter_teacherLabel"))}</div>
        <div class="chipgroup">${teachers.map(teacherChip).join("")}</div>
      </div>` : ""}
    </div>`;
}

function renderDashboard() {
  const app = document.getElementById("app");
  if (!ALL_RECORDS.length) {
    // A sync that couldn't verify sign-in (e.g. session not carried into the
    // background tab) — or that failed to run at all — looks identical to
    // "genuinely 0 classes" unless we say so explicitly. Don't leave the
    // person staring at a generic empty state with no idea it actually failed.
    const authFailed = META.lastError === "auth";
    const networkFailed = META.lastError === "network";
    const otherError = META.lastError && !authFailed && !networkFailed;
    const msgKey = authFailed ? "emptyAuth" : networkFailed ? "emptyNetwork" : "empty";
    const hintKey = authFailed ? "emptyAuthHint" : networkFailed ? "emptyNetworkHint" : "emptyHint";
    app.innerHTML = `<div class="empty">${esc(t(msgKey))}<br><span style="font-size:12.5px;">${esc(t(hintKey))}</span>${otherError ? `<br><span style="font-size:11px;opacity:.7;">(${esc(META.lastError)})</span>` : ""}</div>`;
    return;
  }
  const fullAgg = aggregate(ALL_RECORDS);
  const badges = computeBadges(fullAgg);
  const persona = computePersona(fullAgg);
  const highlights = computeHighlights(ALL_RECORDS, fullAgg, badges);

  const filtered = filterRecords(ALL_RECORDS, FILTERS);
  const agg = aggregate(filtered);
  const topType = Object.entries(agg.byType).sort((a, b) => b[1] - a[1]);
  const topTeacher = Object.entries(agg.byTeacher).sort((a, b) => b[1] - a[1]);
  const maxType = Math.max(1, ...topType.map(e => e[1]));
  const maxTeacher = Math.max(1, ...topTeacher.map(e => e[1]));

  app.innerHTML = `
    ${!META.backfillComplete ? `<div class="subnote">⏳ ${esc(t("backfillNote"))}</div>` : ""}
    ${renderUserCard(fullAgg, persona)}

    <h2>${esc(t("section_badges"))}</h2>
    ${renderBadges(badges)}

    <h2>${esc(t("section_insights"))}</h2>
    <div id="insightsBox" class="insightgrid ${highlights.length <= 1 ? "single" : ""}">${renderHighlights(highlights)}</div>

    <h2>${esc(t("section_filters"))}</h2>
    ${renderFilterBar(ALL_RECORDS)}

    <div class="stats-groupline">${esc(t("stats_thisSelection"))}: <b>${esc(filterRangeLabel(FILTERS.range))}</b></div>
    <div class="stats">
      <div class="stat"><div class="num">${agg.attendedCount}</div><div class="lbl">${esc(t("stat_total"))}</div></div>
      <div class="stat"><div class="num">${pct(agg.lateCancelRate)}%</div><div class="lbl">${esc(t("stat_lateCancelRate"))}</div></div>
      <div class="stat"><div class="num">${agg.avgPerWeek.toFixed(1)}</div>${trendDelta(fullAgg.avgPerWeekRecent, fullAgg.avgPerWeek)}<div class="lbl">${esc(t("stat_avgWeek"))}</div></div>
    </div>

    <div class="stats-groupline">${esc(t("stats_allTime"))}</div>
    <div class="stats">
      <div class="stat"><div class="num">${fullAgg.thisMonth}</div><div class="lbl">${esc(t("stat_thisMonth"))}</div></div>
      <div class="stat"><div class="num">${t("weeks", { n: fullAgg.currentStreak })}</div><div class="lbl">${esc(t("stat_currentStreak"))}</div></div>
      <div class="stat"><div class="num">${t("weeks", { n: fullAgg.longestStreak })}</div><div class="lbl">${esc(t("stat_longestStreak"))}</div></div>
      <div class="stat"><div class="num">${META.monthsCached || 0}</div><div class="lbl">${esc(t("stat_months"))}</div></div>
      <div class="stat"><div class="num">${fullAgg.bestMonth ? fullAgg.bestMonthCount : "—"}</div><div class="lbl">${esc(t("stat_bestMonth"))}${fullAgg.bestMonth ? " · " + esc(fmtMonth(fullAgg.bestMonth)) : ""}</div></div>
      <div class="stat"><div class="num">${fullAgg.avgGapDays != null ? fullAgg.avgGapDays.toFixed(1) : "—"}</div><div class="lbl">${esc(t("stat_avgGap"))}</div></div>
      <div class="stat"><div class="num">${fullAgg.variety}</div><div class="lbl">${esc(t("stat_variety"))}</div></div>
      <div class="stat"><div class="num">≈${fullAgg.estHours}</div><div class="lbl">${esc(t("stat_hours"))}</div></div>
    </div>

    <div class="grid2">
      <div>
        <h2>${esc(t("section_weekday"))}</h2>
        <div class="card">${renderWeekdayChart(agg.byWeekday)}</div>
      </div>
      <div>
        <h2>${esc(t("section_consistency"))}</h2>
        <div class="card ringrow">
          ${renderConsistencyRing(fullAgg.weeksActiveRatio)}
          <div class="ring-lbl">${esc(t("section_consistency_hint"))}</div>
        </div>
      </div>
    </div>

    <h2>${esc(t("section_punchcard"))}</h2>
    <div class="card">${renderPunchCard(agg.hourGrid)}</div>

    <h2>${esc(t("section_breakdown"))}</h2>
    <div class="quadgrid">
      <div class="card">
        <div class="subcard-title">${esc(t("section_type"))}</div>
        <div class="card-body">${renderBarList(topType, maxType)}</div>
      </div>
      <div class="card">
        <div class="subcard-title">${esc(t("section_teacher"))}</div>
        <div class="card-body">${renderBarList(topTeacher.map(([k, v]) => [k || t("noTeacher"), v]), maxTeacher)}</div>
      </div>
      <div class="card">
        <div class="subcard-title">${esc(t("section_trend"))}</div>
        <div class="card-body">${renderMonthTrend(agg.byMonth)}</div>
      </div>
      <div class="card">
        <div class="subcard-title">${esc(t("section_growth"))}</div>
        <div class="card-body">
          ${renderGrowthCurve(fullAgg.weeklySeries, { responsive: true })}
          ${fullAgg.minDate ? `<div class="growth-caption">${esc(t("growth_caption", {
            n: fullAgg.attendedCount,
            since: fmtMonth(fullAgg.minDate.slice(0, 7)),
            avg: fullAgg.avgPerWeek.toFixed(1)
          }))}</div>` : ""}
        </div>
      </div>
    </div>

    <h2>${esc(t("section_heatmap"))}</h2>
    ${renderHeatmap(agg.minDate, agg.maxDate, agg.byDate)}
  `;

  document.querySelectorAll(".range-chip").forEach(el => el.addEventListener("click", () => { FILTERS.range = el.dataset.range; renderDashboard(); }));
  document.querySelectorAll(".type-chip").forEach(el => el.addEventListener("click", () => {
    const v = el.dataset.type;
    FILTERS.types.has(v) ? FILTERS.types.delete(v) : FILTERS.types.add(v);
    renderDashboard();
  }));
  document.querySelectorAll(".teacher-chip").forEach(el => el.addEventListener("click", () => {
    const v = el.dataset.teacher;
    FILTERS.teachers.has(v) ? FILTERS.teachers.delete(v) : FILTERS.teachers.add(v);
    renderDashboard();
  }));
  wireBadgeFlip();
  updateStickyOffsets();
}

// ---------------------------------------------------------------------------
// Compare view
// ---------------------------------------------------------------------------
function periodRange(key) {
  const now = new Date();
  if (key === "thisMonth") return [`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, todayStr()];
  if (key === "lastMonth") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return [`${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`, `${e.getFullYear()}-${pad(e.getMonth() + 1)}-${pad(e.getDate())}`];
  }
  if (key === "thisYear") return [`${now.getFullYear()}-01-01`, todayStr()];
  if (key === "lastYear") return [`${now.getFullYear() - 1}-01-01`, `${now.getFullYear() - 1}-12-31`];
  return [null, null];
}
function recordsInRange(records, from, to) { return records.filter(r => (!from || r.date >= from) && (!to || r.date <= to)); }
function compareStatBlock(records) {
  const agg = aggregate(records);
  const topType = Object.entries(agg.byType).sort((a, b) => b[1] - a[1])[0];
  const topTeacher = Object.entries(agg.byTeacher).sort((a, b) => b[1] - a[1])[0];
  return { attended: agg.attendedCount, lateCancelRate: agg.lateCancelRate, avgPerWeek: agg.avgPerWeek, topType: topType ? topType[0] : "—", topTeacher: topTeacher ? topTeacher[0] : "—" };
}
function renderCompareRow(label, value, deltaHtml) {
  return `<div class="comparerow"><span>${esc(label)}</span><b>${esc(value)}${deltaHtml || ""}</b></div>`;
}
// Small inline delta badge comparing `value` against `baseline` (B relative to A).
function deltaBadge(value, baseline, higherIsBetter) {
  if (!baseline) return "";
  const diff = ((value - baseline) / baseline) * 100;
  if (Math.abs(diff) < 5) return "";
  const good = higherIsBetter ? diff > 0 : diff < 0;
  return ` <span class="delta ${good ? "up" : "down"}" style="display:inline;margin:0 0 0 6px;">${diff > 0 ? "▲" : "▼"}${Math.abs(Math.round(diff))}%</span>`;
}
let compareSel = { a: "thisMonth", b: "lastMonth" };
function renderCompare() {
  const app = document.getElementById("app");
  const opts = ["thisMonth", "lastMonth", "thisYear", "lastYear"];
  const optLabel = k => t("compare_" + k);
  const [fa, ta] = periodRange(compareSel.a), [fb, tb] = periodRange(compareSel.b);
  const countable = r => ["attended", "lateCancel", "cancelled", "noShow"].includes(r.status);
  const A = compareStatBlock(recordsInRange(ALL_RECORDS.filter(countable), fa, ta));
  const B = compareStatBlock(recordsInRange(ALL_RECORDS.filter(countable), fb, tb));
  app.innerHTML = `
    <div class="comparebar">
      <label>${esc(t("compare_period"))} A: <select id="cmpA">${opts.map(o => `<option value="${o}" ${compareSel.a === o ? "selected" : ""}>${esc(optLabel(o))}</option>`).join("")}</select></label>
      <label>${esc(t("compare_period"))} B: <select id="cmpB">${opts.map(o => `<option value="${o}" ${compareSel.b === o ? "selected" : ""}>${esc(optLabel(o))}</option>`).join("")}</select></label>
    </div>
    <div class="comparegrid">
      <div class="compareside"><h3>${esc(optLabel(compareSel.a))}</h3>
        ${renderCompareRow(t("compare_classes"), A.attended)}
        ${renderCompareRow(t("compare_avgWeek"), A.avgPerWeek.toFixed(1))}
        ${renderCompareRow(t("compare_lateCancelRate"), pct(A.lateCancelRate) + "%")}
        ${renderCompareRow(t("compare_topType"), A.topType)}
        ${renderCompareRow(t("compare_topTeacher"), A.topTeacher)}
      </div>
      <div class="comparevs">VS</div>
      <div class="compareside"><h3>${esc(optLabel(compareSel.b))}</h3>
        ${renderCompareRow(t("compare_classes"), B.attended, deltaBadge(B.attended, A.attended, true))}
        ${renderCompareRow(t("compare_avgWeek"), B.avgPerWeek.toFixed(1), deltaBadge(B.avgPerWeek, A.avgPerWeek, true))}
        ${renderCompareRow(t("compare_lateCancelRate"), pct(B.lateCancelRate) + "%", deltaBadge(B.lateCancelRate, A.lateCancelRate, false))}
        ${renderCompareRow(t("compare_topType"), B.topType)}
        ${renderCompareRow(t("compare_topTeacher"), B.topTeacher)}
      </div>
    </div>`;
  document.getElementById("cmpA").addEventListener("change", e => { compareSel.a = e.target.value; renderCompare(); });
  document.getElementById("cmpB").addEventListener("change", e => { compareSel.b = e.target.value; renderCompare(); });
}

// ---------------------------------------------------------------------------
// Confetti
// ---------------------------------------------------------------------------
function burstConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  canvas.classList.remove("hidden");
  const ctx = canvas.getContext("2d");
  const colors = ["#00e0a0", "#00a87a", "#e6b800", "#ffffff", "#7fe0bf"];
  const particles = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width, y: -20 - Math.random() * 100,
    vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3,
    size: 5 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360, vr: (Math.random() - 0.5) * 10
  }));
  const start = Date.now();
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = Date.now() - start;
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    if (elapsed < 2200) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.classList.add("hidden"); }
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Story mode
// ---------------------------------------------------------------------------
function buildStorySlides() {
  const agg = aggregate(ALL_RECORDS);
  const badges = computeBadges(agg);
  const persona = computePersona(agg);
  const name = (STATE.client && STATE.client.name) || "";
  const photo = (STATE.client && STATE.client.photo) || "";
  const avatar = photo ? `<img src="${esc(photo)}" alt="">` : (name ? esc(name.trim()[0]) : "🏋");
  const slides = [];

  slides.push({
    confetti: false,
    html: `<div class="story-avatar">${avatar}</div>
      <div class="story-title">${esc(t("story_welcome", { name: esc(name) }))}</div>
      <div class="story-sub">${esc(t("story_welcome_sub"))}</div>`
  });

  if (agg.attendedCount) {
    slides.push({
      confetti: agg.attendedCount >= 25,
      html: `<div class="story-eyebrow">${esc(t("title"))}</div>
        <div class="story-big">${agg.attendedCount}</div>
        <div class="story-sub">${esc(t("story_total_sub", { h: agg.estHours }))}</div>`
    });
  }
  const topWdIdx = agg.byWeekday.indexOf(Math.max(...agg.byWeekday));
  if (agg.byWeekday[topWdIdx] > 0) {
    slides.push({
      html: `<div class="story-title">${esc(t("story_day", { day: (WDFULL[LANG] || WDFULL.en)[topWdIdx] }))}</div>
        <div class="story-sub">${esc(t("story_day_sub", { n: agg.byWeekday[topWdIdx] }))}</div>`
    });
  }
  const topTeacher = Object.entries(agg.byTeacher).sort((a, b) => b[1] - a[1])[0];
  if (topTeacher) {
    slides.push({
      html: `<div class="story-eyebrow">${esc(t("story_teacher_eyebrow"))}</div>
        <div class="story-title">${esc(topTeacher[0])}</div>
        <div class="story-sub">${esc(t("story_teacher_sub", { n: topTeacher[1] }))}</div>`
    });
  }
  const streak = Math.max(agg.currentStreak, agg.longestStreak);
  if (streak > 0) {
    slides.push({
      confetti: streak >= 8,
      html: `<div class="story-big">${streak}</div>
        <div class="story-title">${esc(t("story_streak", { n: streak }))}</div>
        <div class="story-sub">${esc(t("story_streak_sub"))}</div>`
    });
  }
  slides.push({
    confetti: true,
    html: `<div class="story-eyebrow">${esc(t("story_persona_eyebrow"))}</div>
      <div class="story-title">${esc(persona.title)}</div>
      <div class="story-sub">${esc(persona.subtitle)}</div>`
  });
  const earnedCount = badges.filter(b => b.earned).length;
  slides.push({
    html: `<div class="story-title">${esc(t("story_badges", { n: earnedCount, total: badges.length }))}</div>
      <div class="story-badgegrid">${badges.map(b => `<div class="sbi ${b.earned ? "on" : ""}" title="${esc(t("badge_" + b.id + "_t"))}">${b.icon}</div>`).join("")}</div>`
  });
  slides.push({
    html: `<div class="story-title">${esc(t("story_share_title"))}</div>
      <div class="story-sub">${esc(t("story_share_sub"))}</div>
      <div style="margin-top:18px;"><button class="primary" id="storyShareBtn">${esc(t("shareImg"))}</button></div>`
  });
  return slides;
}

function renderStorySlide() {
  const overlay = document.getElementById("storyOverlay");
  if (!overlay) return;
  const dots = overlay.querySelectorAll(".story-dots i");
  dots.forEach((d, i) => d.classList.toggle("done", i <= storyIndex));
  const body = overlay.querySelector(".story-body");
  body.innerHTML = `<div class="story-slide">${storySlides[storyIndex].html}</div>`;
  const prevBtn = overlay.querySelector(".story-prev"), nextBtn = overlay.querySelector(".story-next");
  prevBtn.style.visibility = storyIndex === 0 ? "hidden" : "visible";
  nextBtn.textContent = storyIndex === storySlides.length - 1 ? t("story_done") : t("story_next");
  if (storySlides[storyIndex].confetti) setTimeout(burstConfetti, 150);
  const shareBtn = document.getElementById("storyShareBtn");
  if (shareBtn) shareBtn.addEventListener("click", exportShareImage);
}

function openStory() {
  storySlides = buildStorySlides();
  storyIndex = 0;
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="story-overlay" id="storyOverlay">
      <button class="story-close" id="storyCloseBtn">${t("story_close")}</button>
      <div class="story-dots">${storySlides.map(() => `<i><b></b></i>`).join("")}</div>
      <div class="story-body"></div>
      <div class="story-nav"><button class="story-prev">${t("story_prev")}</button><button class="story-next">${t("story_next")}</button></div>
    </div>`;
  renderStorySlide();
  document.getElementById("storyCloseBtn").addEventListener("click", () => setView("dashboard"));
  document.querySelector(".story-prev").addEventListener("click", () => { if (storyIndex > 0) { storyIndex--; renderStorySlide(); } });
  document.querySelector(".story-next").addEventListener("click", () => {
    if (storyIndex < storySlides.length - 1) { storyIndex++; renderStorySlide(); } else setView("dashboard");
  });
}

// ---------------------------------------------------------------------------
// Share / export
// ---------------------------------------------------------------------------
// Shared card scaffold: dark gradient background + brand header + footer.
// Returns the canvas + ctx with the "safe" content area (below header, above
// footer) so each template only needs to draw its own middle section.
function shareCardBase(name) {
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1350;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, "#04241b"); grad.addColorStop(1, "#0c2b24");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, c.width, c.height);
  ctx.textAlign = "center";

  ctx.fillStyle = "#00e0a0";
  ctx.font = "700 40px Rubik, sans-serif";
  ctx.fillText("Boost Auto-Book", c.width / 2, 100);
  ctx.font = "400 30px Rubik, sans-serif";
  ctx.fillStyle = "#eafff5";
  ctx.fillText(name || "", c.width / 2, 148);

  ctx.font = "400 26px Rubik, sans-serif";
  ctx.fillStyle = "#7fe0bf";
  ctx.fillText("boostapp.co.il", c.width / 2, c.height - 60);
  return { c, ctx };
}
function downloadCanvas(c, filename) {
  c.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
}

function drawShareWrapped(ctx, c, agg, persona) {
  ctx.font = "800 220px Rubik, sans-serif";
  ctx.fillStyle = "#00e0a0";
  ctx.fillText(String(agg.attendedCount), c.width / 2, 480);
  ctx.font = "500 40px Rubik, sans-serif";
  ctx.fillStyle = "#eafff5";
  ctx.fillText("classes attended", c.width / 2, 540);

  ctx.font = "700 44px Rubik, sans-serif";
  ctx.fillStyle = "#fff";
  wrapCanvasText(ctx, persona.title, c.width / 2, 660, 900, 52);

  const stats = ["🔥 " + Math.max(agg.currentStreak, agg.longestStreak) + " wk streak", "≈" + agg.estHours + " hours trained", agg.variety + " class types tried"];
  ctx.font = "500 38px Rubik, sans-serif";
  ctx.fillStyle = "#cdf3e4";
  stats.forEach((s, i) => ctx.fillText(s, c.width / 2, 880 + i * 60));
}

function drawShareStreak(ctx, c, agg) {
  const streak = Math.max(agg.currentStreak, agg.longestStreak);
  ctx.font = "800 180px Rubik, sans-serif";
  ctx.fillStyle = "#00e0a0";
  ctx.fillText("🔥", c.width / 2, 480);
  ctx.font = "800 260px Rubik, sans-serif";
  ctx.fillText(String(streak), c.width / 2, 760);
  ctx.font = "500 44px Rubik, sans-serif";
  ctx.fillStyle = "#eafff5";
  ctx.fillText("week streak", c.width / 2, 830);
  ctx.font = "400 34px Rubik, sans-serif";
  ctx.fillStyle = "#cdf3e4";
  ctx.fillText(agg.currentStreak >= agg.longestStreak ? "…and still going" : "personal best so far", c.width / 2, 900);
}

function drawShareBadges(ctx, c, agg) {
  const badges = computeBadges(agg);
  const earned = badges.filter(b => b.earned);
  ctx.font = "800 130px Rubik, sans-serif";
  ctx.fillStyle = "#00e0a0";
  ctx.fillText(`${earned.length}/${badges.length}`, c.width / 2, 420);
  ctx.font = "500 40px Rubik, sans-serif";
  ctx.fillStyle = "#eafff5";
  ctx.fillText("achievements unlocked", c.width / 2, 480);

  const cols = 5, size = 130, gap = 24;
  const gridW = cols * size + (cols - 1) * gap;
  const startX = (c.width - gridW) / 2;
  badges.forEach((b, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = startX + col * (size + gap), y = 600 + row * (size + gap);
    ctx.fillStyle = b.earned ? "rgba(0,224,160,0.16)" : "rgba(255,255,255,0.06)";
    roundRect(ctx, x, y, size, size, 18); ctx.fill();
    ctx.font = "60px sans-serif";
    ctx.globalAlpha = b.earned ? 1 : 0.35;
    ctx.fillText(b.icon, x + size / 2, y + size / 2 + 22);
    ctx.globalAlpha = 1;
  });
}

function drawShareWeekday(ctx, c, agg) {
  const labels = WDFULL[LANG] || WDFULL.en;
  const max = Math.max(1, ...agg.byWeekday);
  const topIdx = agg.byWeekday.indexOf(max);
  ctx.font = "700 52px Rubik, sans-serif";
  ctx.fillStyle = "#eafff5";
  ctx.fillText(labels[topIdx] + " is your day", c.width / 2, 420);
  ctx.font = "800 120px Rubik, sans-serif";
  ctx.fillStyle = "#00e0a0";
  ctx.fillText(String(max) + " classes", c.width / 2, 560);

  const barW = 100, gap = 26, totalW = 7 * barW + 6 * gap, startX = (c.width - totalW) / 2, base = 950, maxH = 260;
  agg.byWeekday.forEach((n, i) => {
    const h = Math.max(6, (n / max) * maxH);
    ctx.fillStyle = i === topIdx ? "#00e0a0" : "rgba(255,255,255,0.18)";
    roundRect(ctx, startX + i * (barW + gap), base - h, barW, h, 10); ctx.fill();
    ctx.font = "400 26px Rubik, sans-serif";
    ctx.fillStyle = "#cdf3e4";
    ctx.fillText((WDSHORT[LANG] || WDSHORT.en)[i], startX + i * (barW + gap) + barW / 2, base + 40);
  });
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function exportShareImage(template) {
  const agg = aggregate(ALL_RECORDS);
  const persona = computePersona(agg);
  const name = (STATE.client && STATE.client.name) || "";
  const { c, ctx } = shareCardBase(name);
  const draw = { wrapped: drawShareWrapped, streak: drawShareStreak, badges: drawShareBadges, weekday: drawShareWeekday }[template] || drawShareWrapped;
  draw(ctx, c, agg, persona);
  downloadCanvas(c, `boost-${template || "wrapped"}-card.png`);
}
function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "", lines = [];
  words.forEach(w => {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  });
  lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

function exportCsvFile() {
  const header = ["date", "weekday", "time", "className", "teacher", "status"];
  const rows = ALL_RECORDS.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map(r => [r.date, r.weekday, r.time, r.className, r.teacher, r.status]);
  const csv = [header].concat(rows).map(row => row.map(v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "boost-class-history.csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------------------------------------------------------------------------
// View switching + boot
// ---------------------------------------------------------------------------
function setView(view) {
  CURRENT_VIEW = view;
  document.querySelectorAll("#viewTabs button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  if (view === "dashboard") renderDashboard();
  else if (view === "story") openStory();
  else if (view === "compare") renderCompare();
}

async function loadAndRender() {
  setView(CURRENT_VIEW);
}

async function boot() {
  applyLang(CFG.lang || "en");
  applyTheme(CFG.theme || "system");

  document.querySelectorAll("#viewTabs button").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));

  const refreshBtn = document.getElementById("refreshBtn");
  const resyncBtn = document.getElementById("resyncBtn");
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true; refreshBtn.textContent = t("refreshing");
    await loadAndRender();
    refreshBtn.disabled = false; refreshBtn.textContent = t("refresh");
  });
  resyncBtn.addEventListener("click", () => {
    alert(LANG === "he" ? "כדי לרענן: סגרו כרטיסייה זו, חזרו לאתר הסטודיו ולחצו שוב על הסימנייה." : "To refresh: close this tab, go back to the studio site, and click the bookmark again.");
  });

  populateShareTemplates();
  document.getElementById("shareImgBtn").addEventListener("click", () => exportShareImage(document.getElementById("shareTemplate").value));
  document.getElementById("exportCsvBtn").addEventListener("click", exportCsvFile);

  const langSelect = document.getElementById("langSelect");
  langSelect.value = LANG;
  langSelect.addEventListener("change", (e) => {
    const lang = e.target.value;
    CFG.lang = lang;
    applyLang(lang);
    populateShareTemplates();
    setView(CURRENT_VIEW);
  });

  await loadAndRender();
}

// Re-localizes the share-template <select> options (rebuilt on language change).
function populateShareTemplates() {
  const sel = document.getElementById("shareTemplate");
  const cur = sel.value || "wrapped";
  sel.innerHTML = ["wrapped", "streak", "badges", "weekday"]
    .map(v => `<option value="${v}">${esc(t("shareTpl_" + v))}</option>`).join("");
  sel.value = cur;
}

document.addEventListener("DOMContentLoaded", boot);
