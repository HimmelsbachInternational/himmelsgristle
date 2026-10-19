// Himmelsgristle: kleine hulpjes.
// Bewust in oude JavaScript (ES5), zodat ook oude telefoons en tablets meedoen.

var HG = window.HG || {};
window.HG = HG;

HG.$ = function (id) { return document.getElementById(id); };

HG.nu = function () {
  return (window.performance && performance.now) ? performance.now() : Date.now();
};

HG.bewaar = function (k, v) {
  try { localStorage.setItem('hg_' + k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {}
};

HG.haal = function (k, json) {
  try {
    var v = localStorage.getItem('hg_' + k);
    if (v === null) return null;
    return json ? JSON.parse(v) : v;
  } catch (e) { return null; }
};

HG.vraag = function (methode, url, body, klaar, fout) {
  var x = new XMLHttpRequest();
  x.open(methode, url, true);
  x.timeout = 3000;
  x.onload = function () { if (x.status === 200) klaar(x.responseText); else if (fout) fout(); };
  x.onerror = x.ontimeout = function () { if (fout) fout(); };
  if (body) {
    x.setRequestHeader('Content-Type', 'application/json');
    x.send(JSON.stringify(body));
  } else {
    x.send();
  }
};

HG.escape = function (t) {
  return String(t).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
};

// Een knop die op telefoons direct reageert, maar niet afgaat als je eigenlijk aan het scrollen was.
// Reageert op het loslaten: iOS geeft het geluid alleen vrij bij touchend.
HG.knop = function (el, actie) {
  if (typeof el === 'string') el = HG.$(el);
  if (!el) return;
  var sx = 0, sy = 0, bewogen = false, viaTouch = false;
  el.addEventListener('touchstart', function (e) {
    var t = e.touches[0]; sx = t.clientX; sy = t.clientY; bewogen = false;
  }, false);
  el.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (Math.abs(t.clientX - sx) > 12 || Math.abs(t.clientY - sy) > 12) bewogen = true;
  }, false);
  el.addEventListener('touchend', function (e) {
    viaTouch = true;
    if (bewogen) return;
    e.preventDefault();
    actie(e);
  }, false);
  el.addEventListener('click', function (e) {
    if (viaTouch) { viaTouch = false; return; }
    actie(e);
  }, false);
};

HG.klasse = function (el, naam, aan) {
  var c = ' ' + el.className + ' ';
  var heeft = c.indexOf(' ' + naam + ' ') >= 0;
  if (aan && !heeft) el.className = (el.className + ' ' + naam).replace(/^\s+/, '');
  if (!aan && heeft) el.className = c.replace(' ' + naam + ' ', ' ').replace(/^\s+|\s+$/g, '');
};
