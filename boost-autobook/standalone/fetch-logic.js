(function () {
  'use strict';

  if (!/(^|\.)boostapp\.co\.il$/.test(location.hostname)) {
    alert("This bookmark only works on your studio's BoostApp website. Open your BoostApp page, make sure you're logged in, then click this bookmark again.");
    return;
  }

  var DEFAULT_GET_URL = '6284d298e4b18'; // Training Harmony's public booking token
  var getUrl = new URLSearchParams(location.search).get('GetUrl') || DEFAULT_GET_URL;

  function pad(n) { return String(n).padStart(2, '0'); }
  function monthKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function historyDateToISO(s) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || '');
    return m ? (m[3] + '-' + m[2] + '-' + m[1]) : null;
  }
  function classifyHistoryStatus(raw) {
    var s = String(raw || '');
    if (/ביטול מאוחר|late.?cancel/i.test(s)) return 'lateCancel';
    if (/לא הגיע|no.?show/i.test(s)) return 'noShow';
    if (/הגיע|מומש|attended/i.test(s)) return 'attended';
    if (/ביטול|cancel/i.test(s)) return 'cancelled';
    return 'other';
  }
  function normalizeHistoryRow(month, raw) {
    var date = historyDateToISO(raw.dateStr);
    if (!date) return null;
    return {
      date: date, weekday: new Date(date + 'T00:00:00').getDay(), time: raw.time || '',
      className: raw.className || '(unnamed)', teacher: raw.teacher || '',
      studio: raw.studio || '', status: classifyHistoryStatus(raw.statusRaw),
      statusRaw: raw.statusRaw || '', month: month
    };
  }

  // Grabs the signed-in person's name + photo the first time we see
  // #clientHeaderId in a fetched ClassHistory.php page (confirmed to render
  // there, not just on Home.php). Same selectors as content.js's readClient().
  var clientInfo = null;
  function extractClient(doc) {
    if (clientInfo) return;
    var h = doc.getElementById('clientHeaderId');
    if (!h || !h.dataset || !h.dataset.id) return;
    var nameEl = h.querySelector('span') || doc.querySelector('.userNameBox span');
    var photoEl = doc.querySelector('.imgBox img[alt="user"]') || doc.querySelector('.iconsCon .imgBox img');
    var photoSrc = photoEl ? photoEl.getAttribute('src') : null;
    clientInfo = {
      clientId: h.dataset.id,
      name: nameEl ? nameEl.textContent.trim() : null,
      photo: photoSrc ? new URL(photoSrc, location.href).href : null
    };
  }

  // Same walk-backward-one-month-at-a-time logic as background.js's
  // fetchHistoryBackwardInPage, minus the chrome.* bits — this already ran in
  // page context there too, so it ports over unchanged in spirit.
  async function fetchHistoryBackward(startYm, maxMonths, onProgress) {
    var out = {};
    var parts = startYm.split('-').map(Number), y = parts[0], m = parts[1];
    var emptyStreak = 0, errorStreak = 0, months = 0, authFailed = false, networkFailed = false;
    while (months < maxMonths) {
      var ym = y + '-' + pad(m);
      try {
        var url = '/ClassHistory.php?NextMonth=' + ym + '&GetDay=' + ym + '-01&GetUrl=' + getUrl;
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, 10000);
        var res;
        try { res = await fetch(url, { credentials: 'include', signal: ctrl.signal }); }
        finally { clearTimeout(timer); }
        if (res.redirected && !/ClassHistory\.php/i.test(res.url)) { authFailed = true; break; }
        var html = await res.text();
        var doc = new DOMParser().parseFromString(html, 'text/html');
        extractClient(doc);
        var rows = Array.prototype.slice.call(doc.querySelectorAll('.content-boxed')).map(function (box) {
          var spans = Array.prototype.slice.call(box.querySelectorAll('span'));
          var black = spans.filter(function (s) { return (s.className || '').indexOf('color-black') !== -1; }).map(function (s) { return s.textContent.trim(); });
          var grayDark = spans.filter(function (s) { return (s.className || '').indexOf('color-gray-dark') !== -1; }).map(function (s) { return s.textContent.trim(); }).filter(Boolean);
          var classNameSpan = spans.find(function (s) { return (s.className || '').indexOf('btn-light') !== -1; });
          var plain = spans.filter(function (s) { return (s.className || '').trim() === ''; }).map(function (s) { return s.textContent.trim(); }).filter(Boolean);
          return {
            dateStr: black[1] || '', time: black[2] || '',
            className: classNameSpan ? classNameSpan.textContent.trim() : '',
            studio: grayDark[0] || '', teacher: grayDark.length ? grayDark[grayDark.length - 1] : '',
            statusRaw: plain[0] || ''
          };
        });
        out[ym] = rows;
        emptyStreak = rows.length ? 0 : emptyStreak + 1;
        errorStreak = 0;
      } catch (e) {
        out[ym] = null; emptyStreak = 0; errorStreak++;
        if (errorStreak >= 3) { networkFailed = true; break; }
      }
      months++;
      if (onProgress) onProgress(months, maxMonths);
      if (emptyStreak >= 3 && months >= 2) break;
      m--; if (m < 1) { m = 12; y--; }
    }
    return { months: out, authFailed: authFailed, networkFailed: networkFailed };
  }

  // --- small on-page progress toast, so a 5-15s walk doesn't look frozen ---
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:16px;inset-inline-end:16px;z-index:2147483647;background:#063a2b;color:#00e0a0;font:600 13px system-ui,sans-serif;padding:12px 16px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.35);';
  toast.textContent = 'Loading your class history…';
  document.body.appendChild(toast);

  (async function run() {
    try {
      var result = await fetchHistoryBackward(monthKey(new Date()), 36, function (done, total) {
        toast.textContent = 'Loading your class history… (' + done + '/' + total + ' months checked)';
      });

      if (result.authFailed) {
        toast.remove();
        alert("You don't look signed in. Log in on this BoostApp page, then click the bookmark again.");
        return;
      }

      var records = [];
      Object.keys(result.months).forEach(function (ym) {
        var rows = result.months[ym];
        if (!rows) return;
        rows.forEach(function (r) { var n = normalizeHistoryRow(ym, r); if (n) records.push(n); });
      });
      records.sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
      var monthsWithData = Object.keys(result.months).filter(function (ym) { return result.months[ym] && result.months[ym].length; }).sort();

      toast.textContent = 'Opening your dashboard…';
      var win = window.open('', '_blank');
      if (!win) {
        toast.remove();
        alert('Please allow pop-ups for this site, then click the bookmark again.');
        return;
      }

      var pageLang = (document.documentElement.lang || '').slice(0, 2);
      var lang = ['he', 'ru', 'uk', 'ar', 'en'].indexOf(pageLang) !== -1 ? pageLang : 'en';

      var bootstrap =
        'window.__BOOST_STANDALONE_RECORDS__=' + JSON.stringify(records) + ';' +
        'window.__BOOST_STANDALONE_META__=' + JSON.stringify({
          backfillComplete: !result.networkFailed,
          monthsCached: monthsWithData.length,
          oldestMonth: monthsWithData[0] || null,
          lastError: result.networkFailed ? 'network' : null
        }) + ';' +
        'window.__BOOST_STANDALONE_STATE__=' + JSON.stringify({ client: clientInfo || {} }) + ';' +
        'window.__BOOST_STANDALONE_CFG__=' + JSON.stringify({ lang: lang, theme: 'system' }) + ';';

      var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
        '<title>Class History</title>' +
        '<link rel="preconnect" href="https://fonts.googleapis.com">' +
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
        '<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">' +
        '<style>' + __BOOST_STYLE_CSS__ + '</style></head><body>' + __BOOST_BODY_HTML__ +
        '<script>' + bootstrap + '</script>' +
        '<script>' + __BOOST_ENGINE_JS__ + '</script>' +
        '</body></html>';

      win.document.open();
      win.document.write(html);
      win.document.close();
      toast.remove();
    } catch (e) {
      toast.remove();
      alert('Something went wrong loading your history: ' + (e && e.message ? e.message : e));
    }
  })();
})();
