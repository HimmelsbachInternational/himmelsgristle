// Himmelsgristle: het scherm en de rollen.

(function (HG) {
  'use strict';

  var $ = HG.$;
  var VERSIE = '0.3';
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
  var openStem = null;

  var basPatroon = HG.haal('basPatroon', true) || HG.bas.standaardPatroon();
  var basParams = HG.haal('basParams', true) || HG.bas.standaardParams();
  var basGrond = parseInt(HG.haal('basGrond'), 10) || HG.bas.standaardGrond;

  // Nieuwe knoppen uit latere versies aanvullen in oude opgeslagen instellingen.
  (function () {
    var std = HG.drums.standaardParams(), stdP = HG.drums.standaardPatroon();
    for (var id in std) {
      if (!params[id]) params[id] = std[id];
      for (var k in std[id]) if (params[id][k] === undefined) params[id][k] = std[id][k];
      if (!patroon[id] || patroon[id].length !== 16) patroon[id] = stdP[id];
    }
    var stdB = HG.bas.standaardParams();
    for (var b in stdB) if (basParams[b] === undefined) basParams[b] = stdB[b];
    if (!basPatroon || basPatroon.length !== 16) basPatroon = HG.bas.standaardPatroon();
  })();

  var bewaarTimer = null;
  function bewaarAlles() {
    clearTimeout(bewaarTimer);
    bewaarTimer = setTimeout(function () {
      HG.bewaar('patroon', patroon); HG.bewaar('params', params); HG.bewaar('stil', stil);
      HG.bewaar('basPatroon', basPatroon); HG.bewaar('basParams', basParams); HG.bewaar('basGrond', String(basGrond));
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
          flitsNaam(id, wanneer);
        }
      }
    }
    if (rol === 'bas') {
      var bpm = HG.klok.st ? HG.klok.st.bpm : 120;
      HG.bas.speel(stap, wanneer, basPatroon, basGrond, basParams, 15 / bpm);
    }
    HG.audio.opHetGeluid(wanneer, function () { toonLoper(stap); });
  };

  // ---------- tellen en loper in beeld, gelijk met het geluid ----------

  var telTimer = null;
  function toonTel(pos) {
    for (var i = 0; i < 4; i++) HG.klasse($('t' + i), 'aan', i === pos);
    clearTimeout(telTimer);
    telTimer = setTimeout(function () { for (var j = 0; j < 4; j++) HG.klasse($('t' + j), 'aan', false); }, 110);
  }

  var lopers = []; // per matrix een rij loper-vakjes
  var nuStap = -1;
  function toonLoper(stap) {
    for (var m = 0; m < lopers.length; m++) {
      if (nuStap >= 0) HG.klasse(lopers[m][nuStap], 'nu', false);
      if (stap >= 0) HG.klasse(lopers[m][stap], 'nu', true);
    }
    nuStap = stap;
  }

  var naamKnoppen = {};
  function flitsNaam(id, wanneer) {
    HG.audio.opHetGeluid(wanneer, function () {
      var el = naamKnoppen[id]; if (!el) return;
      HG.klasse(el, 'flits', true);
      setTimeout(function () { HG.klasse(el, 'flits', false); }, 90);
    });
  }

  // ---------- een matrix: rijen naast elkaar, 16 stappen breed ----------

  function cellenRij(houder, naamEl, klasse) {
    var rij = document.createElement('div');
    rij.className = 'mrij' + (klasse ? ' ' + klasse : '');
    rij.appendChild(naamEl);
    var cellen = [];
    for (var n = 0; n < 16; n++) {
      var c = document.createElement('div');
      c.className = 'mcel' + (n % 4 === 0 ? ' tel' : '') + (n > 0 && n % 4 === 0 ? ' vier' : '');
      rij.appendChild(c);
      cellen.push(c);
    }
    houder.appendChild(rij);
    return cellen;
  }

  function loperRij(houder) {
    var leeg = document.createElement('div');
    leeg.className = 'mnaam';
    var r = cellenRij(houder, leeg, 'loper');
    for (var i = 0; i < r.length; i++) r[i].className = r[i].className.replace(' tel', '');
    lopers.push(r);
  }

  // ---------- klankschuiven ----------

  function bouwSchuiven(vak, knoppen, waarden, bijWijziging) {
    vak.innerHTML = '';
    for (var k = 0; k < knoppen.length; k++) {
      (function (kn) {
        var sleutel = kn[0];
        var w = document.createElement('div');
        w.className = 'schuif';
        w.innerHTML = '<label><span>' + kn[1] + '</span><span></span></label>' +
          '<input type="range" min="0" max="100" step="1">';
        var inp = w.getElementsByTagName('input')[0];
        var getal = w.getElementsByTagName('span')[1];
        inp.value = Math.round(waarden[sleutel] * 100);
        getal.innerHTML = inp.value;
        function bij() {
          waarden[sleutel] = inp.value / 100;
          getal.innerHTML = inp.value;
          if (bijWijziging) bijWijziging();
          bewaarAlles();
        }
        inp.addEventListener('input', bij, false);
        inp.addEventListener('change', bij, false);
        vak.appendChild(w);
      })(knoppen[k]);
    }
  }

  // ---------- drums ----------

  var drumCellen = {};

  function bouwDrums() {
    var m = $('drumMatrix');
    m.innerHTML = '';
    loperRij(m);
    var stemmen = HG.drums.stemmen;
    for (var i = 0; i < stemmen.length; i++) {
      (function (s) {
        var b = document.createElement('button');
        b.className = 'mnaam';
        b.innerHTML = s.naam;
        naamKnoppen[s.id] = b;
        HG.knop(b, function () {
          openStem = openStem === s.id ? null : s.id;
          tekenDrumPaneel();
        });
        var cellen = cellenRij(m, b);
        drumCellen[s.id] = cellen;
        for (var n = 0; n < 16; n++) {
          (function (n) {
            HG.knop(cellen[n], function () {
              var r = patroon[s.id];
              r[n] = (r[n] + 1) % 3;
              bewaarAlles();
              tekenDrumRij(s.id);
            });
          })(n);
        }
        tekenDrumRij(s.id);
      })(stemmen[i]);
    }
    HG.knop('drumStil', function () {
      if (!openStem) return;
      stil[openStem] = !stil[openStem];
      bewaarAlles();
      tekenDrumPaneel();
    });
    HG.knop('drumDicht', function () { openStem = null; tekenDrumPaneel(); });
    tekenDrumPaneel();
  }

  function tekenDrumRij(id) {
    var r = patroon[id], c = drumCellen[id];
    for (var n = 0; n < 16; n++) {
      HG.klasse(c[n], 'aan', r[n] === 1);
      HG.klasse(c[n], 'accent', r[n] === 2);
    }
  }

  function tekenDrumPaneel() {
    var stemmen = HG.drums.stemmen, s = null;
    for (var i = 0; i < stemmen.length; i++) {
      var id = stemmen[i].id;
      HG.klasse(naamKnoppen[id], 'open', id === openStem);
      HG.klasse(naamKnoppen[id], 'stil', !!stil[id]);
      if (id === openStem) s = stemmen[i];
    }
    HG.klasse($('drumPaneel'), 'verborgen', !s);
    if (!s) return;
    $('drumTitel').innerHTML = s.naam;
    $('drumStil').innerHTML = stil[s.id] ? 'STIL' : 'AAN';
    HG.klasse($('drumStil'), 'aan', !!stil[s.id]);
    bouwSchuiven($('drumKnoppen'), s.knoppen, params[s.id]);
  }

  // ---------- bas ----------

  var basCellen = []; // [rij][stap], rij 0 = bovenste (hoogste) noot
  var basNamen = [];

  function bouwBas() {
    var m = $('basMatrix');
    m.innerHTML = '';
    loperRij(m);
    basCellen = []; basNamen = [];
    for (var r = 0; r < HG.bas.rijen; r++) {
      (function (r) {
        var toon = HG.bas.rijen - 1 - r; // halve tonen boven de grondtoon
        var naam = document.createElement('button');
        naam.className = 'mnaam' + (toon % 12 === 0 ? ' grond' : '');
        basNamen.push(naam);
        var cellen = cellenRij(m, naam, toon % 12 === 0 ? 'grondrij' : '');
        basCellen.push(cellen);
        for (var n = 0; n < 16; n++) {
          (function (n) {
            HG.knop(cellen[n], function () {
              var v = basPatroon[n], hier = v >= 0 && v % 100 === toon;
              if (!hier) basPatroon[n] = toon;
              else if (v < 100) basPatroon[n] = toon + 100;
              else basPatroon[n] = -1;
              bewaarAlles();
              tekenBas();
            });
          })(n);
        }
      })(r);
    }
    function grond(d) {
      basGrond = Math.max(24, Math.min(60, basGrond + d));
      bewaarAlles();
      tekenBas();
    }
    HG.knop('basMin', function () { grond(-1); });
    HG.knop('basPlus', function () { grond(1); });
    HG.knop('basOctMin', function () { grond(-12); });
    HG.knop('basOctPlus', function () { grond(12); });
    HG.knop('basKlankKnop', function () { HG.klasse($('basPaneel'), 'verborgen', $('basPaneel').className.indexOf('verborgen') < 0); });
    HG.knop('basDicht', function () { HG.klasse($('basPaneel'), 'verborgen', true); });
    bouwSchuiven($('basKnoppen'), HG.bas.knoppen, basParams);
    tekenBas();
  }

  function tekenBas() {
    for (var r = 0; r < basCellen.length; r++) {
      var toon = HG.bas.rijen - 1 - r;
      basNamen[r].innerHTML = HG.notenNaam(basGrond + toon).replace(/-?\d+$/, '');
      for (var n = 0; n < 16; n++) {
        var v = basPatroon[n], hier = v >= 0 && v % 100 === toon;
        HG.klasse(basCellen[r][n], 'aan', hier && v < 100);
        HG.klasse(basCellen[r][n], 'accent', hier && v >= 100);
      }
    }
    $('basGrond').innerHTML = HG.notenNaam(basGrond);
  }

  // ---------- Masterblaster: adres en QR-code ----------

  var masterDicht = false, masterAutoDicht = false;

  function tekenMaster() {
    HG.klasse($('masterInhoud'), 'verborgen', masterDicht);
    HG.klasse($('master'), 'dicht', masterDicht);
  }
  HG.knop('masterKop', function () { masterDicht = !masterDicht; masterAutoDicht = true; tekenMaster(); });

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
    var regels = [], anderen = 0;
    for (var i = 0; i < s.players.length; i++) {
      var p = s.players[i];
      if (p.id !== mijnId) anderen++;
      regels.push('<b>' + HG.escape(p.name) + '</b> ' + HG.escape(p.role || '') +
        (p.id === mijnId ? ' (dit toestel)' : ' &middot; ' + p.rtt + ' ms'));
    }
    $('spelers').innerHTML = 'Aangehaakt (' + regels.length + '):<br>' + regels.join('<br>');
    $('masterTeller').innerHTML = s.players.length + (masterDicht ? ' &#9662;' : ' &#9652;');
    // Zodra er een andere speler binnen is, klapt het paneel vanzelf in (eenmalig).
    if (anderen > 0 && !masterAutoDicht) { masterAutoDicht = true; masterDicht = true; tekenMaster(); }
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

  HG.klok.opToestand(function (s, oud) {
    $('bpm').innerHTML = s.bpm;
    $('startstop').innerHTML = s.running ? 'STOP' : 'START';
    toonStatus(s);
    toonSpelers(s);
    if (!s.running) {
      toonLoper(-1);
      if (oud && oud.running && rol === 'bas') HG.bas.stop();
    }
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

  var gestart = false, gebouwd = {};
  var rolNamen = { drums: 'drums', bas: 'bas', klik: 'kliktest' };

  function kies(nieuweRol) {
    if (!HG.audio.ctx && !HG.audio.maak()) {
      $('poortinfo').innerHTML = 'Deze browser kan geen geluid maken. Hij kan later een andere rol krijgen.';
      return;
    }
    if (HG.audio.ctx.resume) HG.audio.ctx.resume();
    if (rol === 'bas' && nieuweRol !== 'bas') HG.bas.stop();
    rol = nieuweRol;
    HG.bewaar('rol', rol);
    HG.klasse($('poort'), 'verborgen', true);
    $('rolNaam').innerHTML = rolNamen[rol];
    HG.klasse($('drumsDeel'), 'verborgen', rol !== 'drums');
    HG.klasse($('basDeel'), 'verborgen', rol !== 'bas');
    HG.klasse($('tellen'), 'groot', rol === 'klik');
    if (rol === 'drums' && !gebouwd.drums) { bouwDrums(); gebouwd.drums = true; }
    if (rol === 'bas' && !gebouwd.bas) { bouwBas(); gebouwd.bas = true; }
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
      tekenMaster();
      haalInfo();
      setInterval(haalInfo, 3000);
    }
  }

  HG.knop('kiesDrums', function () { kies('drums'); });
  HG.knop('kiesBas', function () { kies('bas'); });
  HG.knop('kiesKlik', function () { kies('klik'); });
  HG.knop('kiesLater', function () { $('poortinfo').innerHTML = 'Lead en pad komen in een volgende versie.'; });

})(window.HG);
