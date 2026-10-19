// Himmelsgristle: het scherm en de rollen.

(function (HG) {
  'use strict';

  var $ = HG.$;
  var VERSIE = '0.2';
  var isMaster = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  // ---------- opgeslagen voorkeuren ----------

  var mijnId = HG.haal('id');
  if (!mijnId) { mijnId = 'x' + Math.random().toString(36).slice(2, 8); HG.bewaar('id', mijnId); }
  var mijnNaam = HG.haal('naam') || (isMaster ? 'masterblaster' : 'speler-' + mijnId.slice(1, 5));
  var rol = null;
  var metronoom = HG.haal('klik') === '1';

  var patroon = HG.haal('patroon', true) || HG.drums.standaardPatroon();
  var params = HG.haal('params', true) || HG.drums.standaardParams();
  var stil = HG.haal('stil', true) || {};
  var gekozen = HG.haal('stem') || 'kick';

  // Nieuwe knoppen uit latere versies aanvullen in oude opgeslagen instellingen.
  (function () {
    var std = HG.drums.standaardParams(), stdP = HG.drums.standaardPatroon();
    for (var id in std) {
      if (!params[id]) params[id] = std[id];
      for (var k in std[id]) if (params[id][k] === undefined) params[id][k] = std[id][k];
      if (!patroon[id] || patroon[id].length !== 16) patroon[id] = stdP[id];
    }
  })();

  var bewaarTimer = null;
  function bewaarDrums() {
    clearTimeout(bewaarTimer);
    bewaarTimer = setTimeout(function () {
      HG.bewaar('patroon', patroon); HG.bewaar('params', params); HG.bewaar('stil', stil); HG.bewaar('stem', gekozen);
    }, 300);
  }

  // ---------- klik voor de metronoom en de kliktest ----------

  function klik(wanneer, eerste) {
    var ctx = HG.audio.ctx;
    var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'square';
    o.frequency.value = eerste ? 1568 : 784;
    f.type = 'lowpass'; f.frequency.value = 3000;
    o.connect(f); f.connect(g); g.connect(HG.audio.uit);
    g.gain.setValueAtTime(0.0001, wanneer);
    g.gain.exponentialRampToValueAtTime(eerste ? 0.6 : 0.4, wanneer + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, wanneer + 0.045);
    if (o.start) { o.start(wanneer); o.stop(wanneer + 0.06); } else { o.noteOn(wanneer); o.noteOff(wanneer + 0.06); }
  }

  // ---------- wat er op elke zestiende gebeurt ----------

  HG.planner.opStap = function (stap, wanneer) {
    if (stap % 4 === 0) {
      var tel = stap / 4;
      if (rol === 'klik' || metronoom) klik(wanneer, tel === 0);
      HG.audio.opHetGeluid(wanneer, function () { toonTel(tel); });
    }
    if (rol === 'drums') {
      var stemmen = HG.drums.stemmen;
      for (var i = 0; i < stemmen.length; i++) {
        var id = stemmen[i].id, v = patroon[id][stap];
        if (v && !stil[id]) {
          HG.drums.speel(id, wanneer, v === 2, params[id]);
          flitsStem(id, wanneer);
        }
      }
      HG.audio.opHetGeluid(wanneer, function () { toonStap(stap); });
    }
  };

  // ---------- tellen en stappen in beeld, gelijk met het geluid ----------

  var telTimer = null;
  function toonTel(pos) {
    for (var i = 0; i < 4; i++) HG.klasse($('t' + i), 'aan', i === pos);
    clearTimeout(telTimer);
    telTimer = setTimeout(function () { for (var j = 0; j < 4; j++) HG.klasse($('t' + j), 'aan', false); }, 110);
  }

  var stapEls = [];
  var nuStap = -1;
  function toonStap(stap) {
    if (nuStap >= 0 && stapEls[nuStap]) HG.klasse(stapEls[nuStap], 'nu', false);
    nuStap = stap;
    if (stapEls[stap]) HG.klasse(stapEls[stap], 'nu', true);
  }

  var stemKnoppen = {};
  function flitsStem(id, wanneer) {
    HG.audio.opHetGeluid(wanneer, function () {
      var el = stemKnoppen[id]; if (!el) return;
      HG.klasse(el, 'flits', true);
      setTimeout(function () { HG.klasse(el, 'flits', false); }, 90);
    });
  }

  // ---------- drums op het scherm ----------

  function bouwDrums() {
    var keuze = $('stemKeuze');
    keuze.innerHTML = '';
    var stemmen = HG.drums.stemmen;
    for (var i = 0; i < stemmen.length; i++) {
      (function (s) {
        var b = document.createElement('button');
        b.innerHTML = s.naam;
        keuze.appendChild(b);
        stemKnoppen[s.id] = b;
        var laatste = 0;
        HG.knop(b, function () {
          var t = HG.nu();
          if (t - laatste < 350 && gekozen === s.id) {
            stil[s.id] = !stil[s.id];
            laatste = 0;
          } else {
            laatste = t;
          }
          gekozen = s.id;
          bewaarDrums();
          tekenDrums();
        });
      })(stemmen[i]);
    }

    stapEls = [];
    var rijen = [$('stappenA'), $('stappenB')];
    rijen[0].innerHTML = ''; rijen[1].innerHTML = '';
    for (var n = 0; n < 16; n++) {
      (function (n) {
        var d = document.createElement('div');
        d.className = 'stap' + (n % 4 === 0 ? ' tel' : '');
        rijen[n < 8 ? 0 : 1].appendChild(d);
        stapEls.push(d);
        HG.knop(d, function () {
          var r = patroon[gekozen];
          r[n] = (r[n] + 1) % 3;
          bewaarDrums();
          tekenStappen();
        });
      })(n);
    }
    tekenDrums();
  }

  function tekenStappen() {
    var r = patroon[gekozen];
    for (var n = 0; n < 16; n++) {
      HG.klasse(stapEls[n], 'aan', r[n] === 1);
      HG.klasse(stapEls[n], 'accent', r[n] === 2);
    }
  }

  function tekenDrums() {
    var stemmen = HG.drums.stemmen, s = null;
    for (var i = 0; i < stemmen.length; i++) {
      HG.klasse(stemKnoppen[stemmen[i].id], 'gekozen', stemmen[i].id === gekozen);
      HG.klasse(stemKnoppen[stemmen[i].id], 'stil', !!stil[stemmen[i].id]);
      if (stemmen[i].id === gekozen) s = stemmen[i];
    }
    tekenStappen();

    var vak = $('knoppen');
    vak.innerHTML = '';
    for (var k = 0; k < s.knoppen.length; k++) {
      (function (kn) {
        var sleutel = kn[0];
        var w = document.createElement('div');
        w.className = 'schuif';
        w.innerHTML = '<label><span>' + kn[1] + '</span><span></span></label>' +
          '<input type="range" min="0" max="100" step="1">';
        var inp = w.getElementsByTagName('input')[0];
        var getal = w.getElementsByTagName('span')[1];
        inp.value = Math.round(params[gekozen][sleutel] * 100);
        getal.innerHTML = inp.value;
        function bij() {
          params[gekozen][sleutel] = inp.value / 100;
          getal.innerHTML = inp.value;
          bewaarDrums();
        }
        inp.addEventListener('input', bij, false);
        inp.addEventListener('change', bij, false);
        vak.appendChild(w);
      })(s.knoppen[k]);
    }
  }

  // ---------- Masterblaster: adres en QR-code ----------

  var laatsteAdres = null;
  function haalInfo() {
    HG.vraag('GET', '/api/info?' + Math.random(), null, function (t) {
      var inf; try { inf = JSON.parse(t); } catch (e) { return; }
      var adres = inf.beste;
      if (adres && adres !== laatsteAdres) {
        laatsteAdres = adres;
        $('adres').innerHTML = HG.escape(adres);
        try {
          var q = qrcode(0, 'M');
          q.addData(adres);
          q.make();
          $('qr').innerHTML = '<img alt="QR-code" src="' + q.createDataURL(4, 0) + '">';
        } catch (e) { $('qr').innerHTML = ''; }
      }
      if (!adres) {
        $('adres').innerHTML = 'Geen netwerk gevonden';
        $('adresUitleg').innerHTML = 'Zet de hotspot aan. Het adres verschijnt hier vanzelf.';
        $('qr').innerHTML = '';
        laatsteAdres = null;
      } else if (inf.bevestigd) {
        $('adresUitleg').innerHTML = 'Bevestigd: er is al een speler via dit adres binnen.';
      } else {
        $('adresUitleg').innerHTML = 'Andere telefoon op de hotspot, mobiele data uit, en dit adres openen of de code scannen.';
      }
      var andere = [];
      for (var i = 0; i < inf.alle.length; i++) if (inf.alle[i] !== adres) andere.push(inf.alle[i]);
      $('andereAdressen').innerHTML = (!inf.bevestigd && andere.length) ? 'Werkt het niet, probeer: ' + HG.escape(andere.join('  ')) : '';
    });
  }

  function toonSpelers(s) {
    if (!isMaster || !s || !s.players) return;
    var regels = [];
    for (var i = 0; i < s.players.length; i++) {
      var p = s.players[i];
      regels.push('<b>' + HG.escape(p.name) + '</b> ' + HG.escape(p.role || '') +
        (p.id === mijnId ? ' (dit toestel)' : ' &middot; ' + p.rtt + ' ms'));
    }
    $('spelers').innerHTML = 'Aangehaakt (' + regels.length + '):<br>' + regels.join('<br>');
  }

  // ---------- status ----------

  function toonStatus(s) {
    var k = HG.klok, regels = [];
    regels.push(k.verbonden
      ? 'verbonden &middot; rondreis <b>' + k.rondreis.toFixed(1) + ' ms</b>'
      : '<span class="slecht">geen verbinding met de Masterblaster</span>');
    if (k.verbonden && k.rondreis > 30) regels.push('<span class="slecht">trage wifi, de sync kan wiebelen</span>');
    if (!navigator.wakeLock) regels.push('scherm-aan niet beschikbaar: zet de schermtime-out lang');
    if (s && s.players && !isMaster) regels.push('spelers: ' + s.players.length);
    $('status').innerHTML = regels.join('<br>');
  }

  HG.klok.opToestand(function (s) {
    $('bpm').innerHTML = s.bpm;
    $('startstop').innerHTML = s.running ? 'STOP' : 'START';
    toonStatus(s);
    toonSpelers(s);
    if (!s.running) toonStap(-1);
  });

  // ---------- melden bij de Masterblaster ----------

  function meld() {
    HG.vraag('POST', '/api/hello', {
      id: mijnId, name: mijnNaam, role: rol || '', latency: HG.planner.compensatie, rtt: HG.klok.rondreis
    }, function () {});
  }

  // ---------- scherm wakker houden waar de browser het toestaat ----------

  function houdWakker() {
    if (!navigator.wakeLock || !navigator.wakeLock.request) return;
    navigator.wakeLock.request('screen').then(function () {}, function () {});
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      houdWakker();
      if (HG.audio.ctx && HG.audio.ctx.resume) HG.audio.ctx.resume();
    }
  });

  window.addEventListener('beforeunload', function (e) {
    if (HG.klok.st && HG.klok.st.running) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------- knoppen ----------

  function tempo(d) { if (HG.klok.st) HG.klok.stuur({ action: 'tempo', bpm: HG.klok.st.bpm + d }); }
  HG.knop('startstop', function () { HG.klok.stuur({ action: HG.klok.st && HG.klok.st.running ? 'stop' : 'start' }); });
  HG.knop('tmin', function () { tempo(-1); });
  HG.knop('tplus', function () { tempo(1); });
  HG.knop('tmin10', function () { tempo(-10); });
  HG.knop('tplus10', function () { tempo(10); });

  function zetLat(v) { HG.planner.zetCompensatie(v); $('lat').innerHTML = HG.planner.compensatie; }
  HG.knop('lmin10', function () { zetLat(HG.planner.compensatie - 10); });
  HG.knop('lmin1', function () { zetLat(HG.planner.compensatie - 1); });
  HG.knop('lplus1', function () { zetLat(HG.planner.compensatie + 1); });
  HG.knop('lplus10', function () { zetLat(HG.planner.compensatie + 10); });
  zetLat(HG.planner.compensatie);

  function tekenMetronoom() { $('klikAan').innerHTML = metronoom ? 'KLIK AAN' : 'KLIK UIT'; }
  HG.knop('klikAan', function () { metronoom = !metronoom; HG.bewaar('klik', metronoom ? '1' : '0'); tekenMetronoom(); });
  tekenMetronoom();

  HG.knop('toonInstellingen', function () {
    var el = $('instellingen');
    HG.klasse(el, 'verborgen', el.className.indexOf('verborgen') < 0);
  });

  $('naam').value = mijnNaam;
  $('naam').addEventListener('change', function () {
    mijnNaam = $('naam').value || mijnNaam; HG.bewaar('naam', mijnNaam); meld();
  });

  HG.knop('wisselRol', function () { HG.klasse($('poort'), 'verborgen', false); });

  $('voet').innerHTML = 'Himmelsgristle ' + VERSIE + (isMaster ? ' &middot; Masterblaster' : '');

  // ---------- rol kiezen en aanhaken ----------

  var gestart = false;

  function kies(nieuweRol) {
    if (!HG.audio.ctx && !HG.audio.maak()) {
      $('poortinfo').innerHTML = 'Deze browser kan geen geluid maken. Hij kan later een andere rol krijgen.';
      return;
    }
    if (HG.audio.ctx.resume) HG.audio.ctx.resume();
    rol = nieuweRol;
    HG.bewaar('rol', rol);
    HG.klasse($('poort'), 'verborgen', true);
    $('rolNaam').innerHTML = rol === 'drums' ? 'drums' : 'kliktest';
    HG.klasse($('drumsDeel'), 'verborgen', rol !== 'drums');
    HG.klasse($('tellen'), 'groot', rol === 'klik');
    if (rol === 'drums' && !stapEls.length) bouwDrums();
    houdWakker();
    meld();

    if (gestart) return;
    gestart = true;
    if (document.documentElement.requestFullscreen) {
      try { document.documentElement.requestFullscreen().then(function () {}, function () {}); } catch (e) {}
    }
    HG.klok.start();
    HG.planner.start();
    setInterval(meld, 2000);
    if (isMaster) {
      HG.klasse($('master'), 'verborgen', false);
      haalInfo();
      setInterval(haalInfo, 3000);
    }
  }

  HG.knop('kiesDrums', function () { kies('drums'); });
  HG.knop('kiesKlik', function () { kies('klik'); });
  HG.knop('kiesLater', function () { $('poortinfo').innerHTML = 'Bas, lead en pad komen in een volgende versie.'; });

})(window.HG);
