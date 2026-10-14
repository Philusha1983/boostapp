// Muscle map UI (v1.7.0): which muscles a lesson / part works, on an
// interactive body figure. Shared by the popup (Upcoming) and Past Events
// (Health tab). Needs lessonplan-parse.js, muscles.js and body.js loaded first.
// Self-contained: injects its own CSS (built on the page's theme tokens) and
// carries its own strings in the extension's 5 languages.
(function (root) {
  "use strict";
  const LP = () => root.LessonPlanParser, MM = () => root.MuscleMap, BF = () => root.BodyFigure;

  // ---- strings ---------------------------------------------------------------
  const S = {
    en: { whole: "Whole lesson", main: "Main muscles", help: "Helping", less: "Less", more: "more work", front: "Front", back: "Back",
      unmapped: "not mapped yet", cond: "machine / conditioning", helping: "helping", notPart: "Not worked in this part", notLesson: "Not worked in this lesson",
      week: "This week", weekSub: "Lessons done and booked, Sunday to Saturday. Dark = done, light = still booked.", notWeek: "Not worked this week",
      lessons1: "1 lesson", lessonsN: "{n} lessons", note: "Muscles are matched from the exercise names.", noPlans: "No workout plans for this week's lessons yet.",
      body: "Body figure", bodyAuto: "From my BoostApp profile", male: "Male", female: "Female", neutral: "Not specified",
      found: "Found: {x}", notFound: "Not found in your profile — neutral figure", bodyHint: "Used for the muscle map. Stays in this browser." },
    he: { whole: "כל השיעור", main: "שרירים עיקריים", help: "עוזרים", less: "פחות", more: "יותר עבודה", front: "מלפנים", back: "מאחור",
      unmapped: "עדיין לא ממופה", cond: "מכשיר / כושר", helping: "עוזר", notPart: "לא עובד בחלק הזה", notLesson: "לא עובד בשיעור הזה",
      week: "השבוע", weekSub: "שיעורים שבוצעו ושהוזמנו, ראשון עד שבת. כהה = בוצע, בהיר = מוזמן.", notWeek: "לא עבדו השבוע",
      lessons1: "שיעור 1", lessonsN: "{n} שיעורים", note: "השרירים מותאמים לפי שמות התרגילים.", noPlans: "עדיין אין תוכניות אימון לשיעורי השבוע.",
      body: "דמות הגוף", bodyAuto: "מהפרופיל שלי ב‑BoostApp", male: "גבר", female: "אישה", neutral: "לא צוין",
      found: "נמצא: {x}", notFound: "לא נמצא בפרופיל — דמות ניטרלית", bodyHint: "משמש למפת השרירים. נשמר רק בדפדפן הזה." },
    ru: { whole: "Всё занятие", main: "Основные мышцы", help: "Вспомогательные", less: "Меньше", more: "больше работы", front: "Спереди", back: "Сзади",
      unmapped: "пока не сопоставлено", cond: "тренажёр / кардио", helping: "вспомогательно", notPart: "Не работает в этой части", notLesson: "Не работает на этом занятии",
      week: "Эта неделя", weekSub: "Пройденные и забронированные занятия, с воскресенья по субботу. Тёмное = пройдено, светлое = забронировано.", notWeek: "Не нагружались на этой неделе",
      lessons1: "1 занятие", lessonsN: "занятий: {n}", note: "Мышцы определены по названиям упражнений.", noPlans: "Планов тренировок на эту неделю пока нет.",
      body: "Фигура тела", bodyAuto: "Из моего профиля BoostApp", male: "Мужская", female: "Женская", neutral: "Не указано",
      found: "Найдено: {x}", notFound: "Не найдено в профиле — нейтральная фигура", bodyHint: "Для карты мышц. Хранится только в этом браузере." },
    uk: { whole: "Усе заняття", main: "Основні м'язи", help: "Допоміжні", less: "Менше", more: "більше роботи", front: "Спереду", back: "Ззаду",
      unmapped: "ще не зіставлено", cond: "тренажер / кардіо", helping: "допоміжно", notPart: "Не працює в цій частині", notLesson: "Не працює на цьому занятті",
      week: "Цей тиждень", weekSub: "Пройдені й заброньовані заняття, з неділі до суботи. Темне = пройдено, світле = заброньовано.", notWeek: "Не навантажувалися цього тижня",
      lessons1: "1 заняття", lessonsN: "занять: {n}", note: "М'язи визначено за назвами вправ.", noPlans: "Планів тренувань на цей тиждень поки немає.",
      body: "Фігура тіла", bodyAuto: "З мого профілю BoostApp", male: "Чоловіча", female: "Жіноча", neutral: "Не вказано",
      found: "Знайдено: {x}", notFound: "Не знайдено в профілі — нейтральна фігура", bodyHint: "Для карти м'язів. Зберігається лише в цьому браузері." },
    ar: { whole: "الدرس كله", main: "العضلات الرئيسية", help: "مساعدة", less: "أقل", more: "عمل أكثر", front: "أمام", back: "خلف",
      unmapped: "غير مُصنّف بعد", cond: "جهاز / لياقة", helping: "مساعدة", notPart: "لا تعمل في هذا الجزء", notLesson: "لا تعمل في هذا الدرس",
      week: "هذا الأسبوع", weekSub: "الدروس المنجزة والمحجوزة، من الأحد إلى السبت. الداكن = منجز، الفاتح = محجوز.", notWeek: "لم تعمل هذا الأسبوع",
      lessons1: "درس واحد", lessonsN: "دروس: {n}", note: "العضلات مستخرجة من أسماء التمارين.", noPlans: "لا توجد خطط تمرين لدروس هذا الأسبوع بعد.",
      body: "شكل الجسم", bodyAuto: "من ملفي في BoostApp", male: "ذكر", female: "أنثى", neutral: "غير محدد",
      found: "تم العثور: {x}", notFound: "غير موجود في الملف — شكل محايد", bodyHint: "يُستخدم لخريطة العضلات. يبقى في هذا المتصفح فقط." },
  };
  const NAMES = {
    en: { traps: "Traps", shoulders: "Shoulders", chest: "Chest", biceps: "Biceps", triceps: "Triceps", forearms: "Forearms & grip", abs: "Abs", obliques: "Obliques", lats: "Lats", upperBack: "Upper back", lowerBack: "Lower back", glutes: "Glutes", abductors: "Outer hip", adductors: "Inner thigh", quads: "Quads", hamstrings: "Hamstrings", calves: "Calves" },
    he: { traps: "טרפזים", shoulders: "כתפיים", chest: "חזה", biceps: "יד קדמית", triceps: "יד אחורית", forearms: "אמות ואחיזה", abs: "בטן", obliques: "אלכסוני בטן", lats: "רחב גבי", upperBack: "גב עליון", lowerBack: "גב תחתון", glutes: "ישבן", abductors: "ירך חיצונית", adductors: "ירך פנימית", quads: "ירך קדמית", hamstrings: "ירך אחורית", calves: "שוקיים" },
    ru: { traps: "Трапеции", shoulders: "Плечи", chest: "Грудь", biceps: "Бицепс", triceps: "Трицепс", forearms: "Предплечья и хват", abs: "Пресс", obliques: "Косые мышцы", lats: "Широчайшие", upperBack: "Верх спины", lowerBack: "Поясница", glutes: "Ягодицы", abductors: "Внешнее бедро", adductors: "Внутреннее бедро", quads: "Квадрицепсы", hamstrings: "Задняя поверхность бедра", calves: "Икры" },
    uk: { traps: "Трапеції", shoulders: "Плечі", chest: "Груди", biceps: "Біцепс", triceps: "Трицепс", forearms: "Передпліччя й хват", abs: "Прес", obliques: "Косі м'язи", lats: "Найширші", upperBack: "Верх спини", lowerBack: "Поперек", glutes: "Сідниці", abductors: "Зовнішнє стегно", adductors: "Внутрішнє стегно", quads: "Квадрицепси", hamstrings: "Задня поверхня стегна", calves: "Литки" },
    ar: { traps: "شبه المنحرفة", shoulders: "الأكتاف", chest: "الصدر", biceps: "البايسبس", triceps: "الترايسبس", forearms: "الساعدان والقبضة", abs: "البطن", obliques: "الجانبية", lats: "الظهرية العريضة", upperBack: "أعلى الظهر", lowerBack: "أسفل الظهر", glutes: "الألوية", abductors: "الورك الخارجي", adductors: "الفخذ الداخلي", quads: "الفخذ الأمامي", hamstrings: "الفخذ الخلفي", calves: "السمانة" },
  };
  let LANG = "en";
  const t = (k, p) => { let s = (S[LANG] || S.en)[k] ?? S.en[k] ?? k; if (p) for (const [a, b] of Object.entries(p)) s = s.replace("{" + a + "}", b); return s; };
  const nm = g => (NAMES[LANG] || NAMES.en)[g] || NAMES.en[g] || g;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const short = n => String(n || "").replace(/\s+—.*$/, "");

  // ---- CSS -------------------------------------------------------------------
  const CSS = `
  :root { --fig:#d5ddd9; --fig-m:#bcc8c3; --fig-hair:#9aa8a2; --mm-1:#a9e8d1; --mm-2:#62d6ae; --mm-3:#22b585; --mm-4:#00936a; --mm-p:#00936a; --mm-s:#7fe0bf; --mm-hl:#063a2b; }
  html[data-theme="dark"] { --fig:#2b3a3d; --fig-m:#3b4d51; --fig-hair:#4a5d61; --mm-1:#1f6b51; --mm-2:#1d8f66; --mm-3:#20ad7c; --mm-4:#2fd69b; --mm-p:#2fd69b; --mm-s:#1c9268; --mm-hl:#eafff5; }
  .mm-body { fill:var(--fig); } .mm-hair { fill:var(--fig-hair); }
  .mm-m { fill:var(--fig-m); stroke:var(--fig); stroke-width:1.2; transition:fill .15s, opacity .15s; }
  .mp-figs .mm-m { cursor:pointer; }
  .mm-ln { stroke:var(--fig); stroke-width:1.2; fill:none; pointer-events:none; }
  .mm-m.p { fill:var(--mm-p); } .mm-m.s { fill:var(--mm-s); }
  .mm-m.h1 { fill:var(--mm-1); } .mm-m.h2 { fill:var(--mm-2); } .mm-m.h3 { fill:var(--mm-3); } .mm-m.h4 { fill:var(--mm-4); }
  .mm-m.hov { stroke:var(--mm-hl); stroke-width:1.6; }
  .mp-dim .mm-m:not(.p):not(.s):not(.hov) { opacity:.55; }
  .mp-mini { display:inline-flex; gap:1px; flex:0 0 auto; } .mp-mini .mm-fig { width:22px; height:48px; }
  .mp { container-type:inline-size; position:relative; font-size:13px; color:var(--text); }
  .mp-chips { display:flex; gap:6px; flex-wrap:wrap; margin:0 0 10px; }
  .mp-chip { border:1px solid var(--line); background:var(--card); color:var(--text); border-radius:999px; padding:4px 11px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; }
  .mp-chip:hover { background:var(--hover); }
  .mp-chip.on { background:var(--ink, #063a2b); border-color:var(--ink, #063a2b); color:var(--green, #00e0a0); }
  html[data-theme="dark"] .mp-chip.on { background:var(--green-deep); border-color:var(--green-deep); color:#06140f; }
  .mp-grid { display:grid; grid-template-columns:minmax(200px, 280px) 1fr; gap:18px; align-items:start; }
  @container (max-width: 560px) { .mp-grid { grid-template-columns:1fr; } .mp-figs .mm-fig { max-width:96px; } .mp-li { flex-wrap:wrap; } .mp-li .ms { flex-basis:100%; text-align:start; padding-inline-start:28px; } }
  .mp-figwrap { position:relative; }
  .mp.compact .mp-grid { grid-template-columns:1fr; } .mp.compact .mp-figwrap { max-width:210px; margin:0 auto; width:100%; } .mp.compact .mp-figs .mm-fig { max-width:92px; }
  .mp.compact .mp-li { flex-wrap:wrap; } .mp.compact .mp-li .ms { flex-basis:100%; text-align:start; padding-inline-start:28px; }
  .mp-figs { display:flex; gap:4px; justify-content:center; direction:ltr; }
  .mp-figs .mm-fig { width:50%; max-width:140px; }
  .mp-cap { display:flex; justify-content:space-around; font-size:11px; color:var(--muted); margin-top:2px; }
  .mp-legend { display:flex; gap:12px; justify-content:center; font-size:11.5px; margin-top:8px; flex-wrap:wrap; }
  .mp-legend i { display:inline-block; width:10px; height:10px; border-radius:3px; margin-inline-end:5px; vertical-align:-1px; }
  .mp-scale { display:inline-flex; gap:2px; vertical-align:-1px; margin:0 5px; } .mp-scale i { margin:0; }
  .mp-tip { position:absolute; pointer-events:none; background:var(--card); border:1px solid var(--line); box-shadow:0 4px 14px rgba(0,0,0,.14); border-radius:8px; padding:6px 9px; font-size:12px; max-width:230px; z-index:5; }
  .mp-tip b { display:block; margin-bottom:2px; } .mp-tip .mu { color:var(--muted); }
  .mp-blk { margin:0 0 10px; border-radius:10px; padding:6px 8px; border:1px solid transparent; }
  .mp-blk.on { border-color:var(--line); background:var(--hover); } .mp-blk.off { opacity:.45; }
  .mp-bh { font-weight:700; font-size:12.5px; } .mp-bh span { font-weight:400; color:var(--muted); font-size:11.5px; }
  .mp-blk ol { list-style:none; margin:4px 0 0; padding:0; }
  .mp-li { display:flex; gap:8px; align-items:baseline; padding:3px 6px; border-radius:6px; font-size:12.5px; }
  .mp-li:hover, .mp-li.hit { background:var(--ghost); }
  .mp-li .k { font-weight:700; flex:0 0 20px; } .mp-li .n { flex:1 1 auto; min-width:0; }
  .mp-li .ms { font-size:11px; color:var(--muted); text-align:end; flex:0 1 auto; } .mp-li .ms em { font-style:normal; color:var(--text); font-weight:600; }
  .mp-note { font-size:11px; color:var(--muted); margin-top:6px; }
  .mp-top { font-size:12px; color:var(--muted); }
  .mp-wk-days { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:10px; }
  .mp-wk-day { font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px; background:var(--ghost); color:var(--muted); }
  .mp-wk-day.done { background:var(--mm-1); color:var(--text); }
  .mp-rank { display:flex; flex-direction:column; gap:2px; }
  .mp-rr { display:grid; grid-template-columns:minmax(90px, 140px) 1fr auto; gap:10px; align-items:center; font-size:12.5px; padding:3px 6px; border-radius:6px; }
  .mp-rr:hover, .mp-rr.hit { background:var(--ghost); }
  .mp-bar { height:8px; border-radius:4px; background:var(--ghost); overflow:hidden; display:flex; direction:ltr; }
  .mp-bar i { display:block; height:100%; } .mp-bar .d { background:var(--mm-4); } .mp-bar .b { background:var(--mm-1); }
  .mp-rr .n { color:var(--muted); font-size:11px; white-space:nowrap; }
  .mp-none { margin-top:10px; font-size:12px; } .mp-none b { display:block; margin-bottom:4px; }
  .mp-none span { display:inline-block; margin:0 4px 4px 0; padding:2px 8px; border-radius:999px; border:1px dashed var(--line); color:var(--muted); font-size:11px; }`;
  let cssDone = false;
  function ensureCss() { if (cssDone || typeof document === "undefined") return; const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); cssDone = true; }

  // ---- data --------------------------------------------------------------------
  function parse(text, date) {
    if (!text || !LP()) return null;
    try { const plan = LP().parsePlan(text, { date }); const parts = plan.blocks.filter(b => b.items && b.items.length); return parts.length ? { plan, parts, all: parts.flatMap(b => b.items) } : null; }
    catch (e) { return null; }
  }
  function levels(score) {
    const max = Math.max(0, ...Object.values(score)), out = {};
    for (const [m, v] of Object.entries(score)) { if (!v) continue; const r = v / max; out[m] = r > .75 ? 4 : r > .5 ? 3 : r > .25 ? 2 : 1; }
    return out;
  }
  function sets(items) {
    const p = new Set(), s = new Set();
    items.forEach(it => { const r = MM().musclesFor(it.name); r.primary.forEach(m => p.add(m)); r.secondary.forEach(m => s.add(m)); });
    p.forEach(m => s.delete(m)); return { p, s };
  }
  function paint(root, mode, dim) {
    root.querySelectorAll(".mm-m").forEach(el => {
      const m = el.dataset.m; el.classList.remove("p", "s", "h1", "h2", "h3", "h4");
      if (mode.heat) { if (mode.heat[m]) el.classList.add("h" + mode.heat[m]); }
      else if (mode.p.has(m)) el.classList.add("p"); else if (mode.s.has(m)) el.classList.add("s");
    });
    root.classList.toggle("mp-dim", !!dim);
  }
  function top(lesson, n) { return Object.entries(MM().score(lesson.all)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([m]) => nm(m)); }
  function figs(sex) { return BF().svg("front", sex) + BF().svg("back", sex); }

  // Mini front+back figure for a list row (whole-lesson heat).
  function mini(lesson, sex) {
    ensureCss();
    const el = document.createElement("span"); el.className = "mp-mini"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = figs(sex); paint(el, { heat: levels(MM().score(lesson.all)) });
    return el;
  }

  // Full lesson panel: chips, figures, plan list. Returns { setPart, preview }.
  function panel(container, lesson, opt = {}) {
    ensureCss();
    const sex = opt.sex || "neutral";
    let part = "all", prev = null;
    container.classList.add("mp"); container.classList.toggle("compact", !!opt.compact);
    container.innerHTML = `
      <div class="mp-chips">${[["all", t("whole")]].concat(lesson.parts.map(b => [b.key, b.key + " · " + b.label])).map(([k, l]) => `<button type="button" class="mp-chip" data-p="${esc(k)}">${esc(l)}</button>`).join("")}</div>
      <div class="mp-grid">
        <div class="mp-figwrap"><div class="mp-figs">${figs(sex)}</div><div class="mp-cap"><span>${esc(t("front"))}</span><span>${esc(t("back"))}</span></div><div class="mp-legend"></div><div class="mp-tip" hidden></div></div>
        <div class="mp-list"></div>
      </div>`;
    const F = container.querySelector(".mp-figs"), list = container.querySelector(".mp-list"), tip = container.querySelector(".mp-tip"), lg = container.querySelector(".mp-legend");
    const cur = () => (prev || part) === "all" ? lesson.all : (lesson.parts.find(b => b.key === (prev || part)) || { items: [] }).items;
    list.innerHTML = lesson.parts.map(b => `<div class="mp-blk" data-b="${esc(b.key)}"><div class="mp-bh">${esc(b.key + " · " + b.label)} <span>${esc(opt.modeText ? opt.modeText(b) : (b.focus || ""))}</span></div><ol>${b.items.map((it, i) => {
      const m = MM().musclesFor(it.name);
      const ms = m.unmapped ? esc(t("unmapped")) : m.tag ? esc(t("cond")) : `<em>${esc(m.primary.map(nm).join(", "))}</em>${m.secondary.length ? " · " + esc(m.secondary.map(nm).join(", ")) : ""}`;
      return `<li class="mp-li" data-b="${esc(b.key)}" data-i="${i}"><span class="k">${esc(it.key)}</span><span class="n">${esc(short(it.name))}</span><span class="ms">${ms}</span></li>`;
    }).join("")}</ol></div>`).join("") + `<div class="mp-note">${esc(t("note"))}</div>`;
    const itemOf = li => lesson.parts.find(b => b.key === li.dataset.b).items[+li.dataset.i];
    function draw(only) {
      const k = prev || part;
      if (only) paint(F, only, true);
      else if (k === "all") paint(F, { heat: levels(MM().score(lesson.all)) });
      else paint(F, sets(cur()));
      lg.innerHTML = (k === "all" && !only)
        ? `<span>${esc(t("less"))}<span class="mp-scale"><i style="background:var(--mm-1)"></i><i style="background:var(--mm-2)"></i><i style="background:var(--mm-3)"></i><i style="background:var(--mm-4)"></i></span>${esc(t("more"))}</span>`
        : `<span><i style="background:var(--mm-p)"></i>${esc(t("main"))}</span><span><i style="background:var(--mm-s)"></i>${esc(t("help"))}</span>`;
      container.querySelectorAll(".mp-chip").forEach(c => c.classList.toggle("on", c.dataset.p === k));
      container.querySelectorAll(".mp-blk").forEach(b => { b.classList.toggle("on", k !== "all" && b.dataset.b === k); b.classList.toggle("off", k !== "all" && b.dataset.b !== k); });
    }
    container.querySelectorAll(".mp-chip").forEach(c => c.addEventListener("click", e => { e.stopPropagation(); part = c.dataset.p; prev = null; draw(); }));
    list.querySelectorAll(".mp-li").forEach(li => { li.addEventListener("mouseenter", () => draw(sets([itemOf(li)]))); li.addEventListener("mouseleave", () => draw()); });
    F.querySelectorAll(".mm-m").forEach(el => {
      el.addEventListener("mouseenter", () => hover(el.dataset.m));
      el.addEventListener("mousemove", e => { const box = container.querySelector(".mp-figwrap").getBoundingClientRect(); let x = e.clientX - box.left + 12; if (x + tip.offsetWidth > box.width) x = e.clientX - box.left - tip.offsetWidth - 8; tip.style.left = Math.max(0, x) + "px"; tip.style.top = (e.clientY - box.top + 10) + "px"; });
      el.addEventListener("mouseleave", () => hover(null));
    });
    function hover(m) {
      F.querySelectorAll(".mm-m").forEach(el => el.classList.toggle("hov", el.dataset.m === m));
      list.querySelectorAll(".mp-li").forEach(li => { const r = MM().musclesFor(itemOf(li).name); li.classList.toggle("hit", !!m && (r.primary.includes(m) || r.secondary.includes(m))); });
      if (!m) { tip.hidden = true; return; }
      const hits = cur().map(it => ({ it, r: MM().musclesFor(it.name) })).filter(x => x.r.primary.includes(m) || x.r.secondary.includes(m));
      tip.innerHTML = `<b>${esc(nm(m))}</b>` + (hits.length ? hits.map(x => `${esc(x.it.key)} ${esc(short(x.it.name).replace(/,.*$/, ""))}${x.r.primary.includes(m) ? "" : ` <span class="mu">(${esc(t("helping"))})</span>`}`).join("<br>")
        : `<span class="mu">${esc(t((prev || part) === "all" ? "notLesson" : "notPart"))}</span>`);
      tip.hidden = false;
    }
    draw();
    return {
      setPart(k) { part = k || "all"; prev = null; draw(); },
      preview(k) { const nk = k && lesson.parts.some(b => b.key === k) ? k : null; if (nk === prev) return; prev = nk; draw(); },
    };
  }

  // Week coverage: lessons [{date, lesson, done}] for one Sun–Sat week.
  function week(container, items, opt = {}) {
    ensureCss();
    const sex = opt.sex || "neutral", done = {}, booked = {}, hitN = {};
    items.forEach(x => { const sc = MM().score(x.lesson.all), tgt = x.done ? done : booked; for (const [m, v] of Object.entries(sc)) { tgt[m] = (tgt[m] || 0) + v; hitN[m] = (hitN[m] || 0) + 1; } });
    const tot = {}; MM().GROUPS.forEach(m => { const v = (done[m] || 0) + (booked[m] || 0); if (v) tot[m] = v; });
    const max = Math.max(1, ...Object.values(tot));
    const rows = Object.entries(tot).sort((a, b) => b[1] - a[1]);
    const none = MM().GROUPS.filter(m => !tot[m]);
    container.classList.add("mp");
    container.innerHTML = `
      <div class="mp-wk-days">${items.map(x => `<span class="mp-wk-day${x.done ? " done" : ""}">${esc(x.label)}${x.done ? " ✓" : ""}</span>`).join("")}</div>
      <div class="mp-grid">
        <div><div class="mp-figs">${figs(sex)}</div><div class="mp-legend"><span>${esc(t("less"))}<span class="mp-scale"><i style="background:var(--mm-1)"></i><i style="background:var(--mm-2)"></i><i style="background:var(--mm-3)"></i><i style="background:var(--mm-4)"></i></span>${esc(t("more"))}</span></div></div>
        <div><div class="mp-rank">${rows.map(([m]) => `<div class="mp-rr" data-m="${m}"><span>${esc(nm(m))}</span>
            <span class="mp-bar"><i class="d" style="width:${(done[m] || 0) / max * 100}%"></i><i class="b" style="width:${(booked[m] || 0) / max * 100}%"></i></span>
            <span class="n">${esc(hitN[m] === 1 ? t("lessons1") : t("lessonsN", { n: hitN[m] }))}</span></div>`).join("")}</div>
          ${none.length ? `<div class="mp-none"><b>${esc(t("notWeek"))}</b>${none.map(m => `<span>${esc(nm(m))}</span>`).join("")}</div>` : ""}</div>
      </div>`;
    const F = container.querySelector(".mp-figs");
    paint(F, { heat: levels(tot) });
    const hl = m => { F.querySelectorAll(".mm-m").forEach(el => el.classList.toggle("hov", el.dataset.m === m)); container.querySelectorAll(".mp-rr").forEach(r => r.classList.toggle("hit", r.dataset.m === m)); };
    F.querySelectorAll(".mm-m").forEach(el => { el.addEventListener("mouseenter", () => hl(el.dataset.m)); el.addEventListener("mouseleave", () => hl(null)); });
    container.querySelectorAll(".mp-rr").forEach(r => { r.addEventListener("mouseenter", () => hl(r.dataset.m)); r.addEventListener("mouseleave", () => hl(null)); });
  }

  const api = { setLang(l) { LANG = S[l] ? l : "en"; }, t, name: nm, parse, top, mini, panel, week };
  root.MusclePanel = api;
})(typeof self !== "undefined" ? self : this);
