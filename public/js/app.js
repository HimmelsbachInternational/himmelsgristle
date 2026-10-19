// Himmelsgristle: het scherm en de rollen.

(function (HG) {
  'use strict';

  var $ = HG.$;
  var VERSIE = '0.4';
  var isMaster = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  // ---------- toestel ----------

  var mijnId = HG.haal('id');
  if (!mijnId) { mijnId = 'x' + Math.random().toString(36).slice(2, 8); HG.bewaar('id', mijnId); }
  var mijnNaam = HG.haal('naam') || (isMaster ? 'masterblaster' : 'speler-' + mijnId.slice(1, 5));
  var rol = null;
  var metronoom = HG.haal('klik') === '1';

  // ---------- klank en patronen per rol ----------
  // drums: { patronen: [4 x { kick: [16], ... }], params: { kick: {...} }, stil: {}, actief: 0 }
  // bas/lead: { patronen: [4 x [16]], params: {...}, grond: 36, actief: 0 }

  var MONO = { bas: HG.bas, lead: HG.lead };
  var data = {};          // per rol
  var volgend = null;     // patroon dat op de volgende maat ingaat
  var bekendeLaadVersie = null;

  function kopie(x) { return JSON.parse(JSON.stringify(x)); }

  function standaard(r) {
    if (r === 'drums') {
      var p = HG.drums.standaardPatroon();
      return { patronen: [p, kopie(p), kopie(p), kopie(p)], params: HG.drums.standaardParams(), stil: {}, actief: 0 };
    }
    var m = MONO[r];
    var q = m.standaardPatroon();
    return { patronen: [q, q.slice(), q.slice(), q.slice()], params: m.standaardParams(), grond: m.standaardGrond, actief: 0 };
  }

  // Vult ontbrekende stukken aan, zodat oude opgeslagen data met nieuwe versies blijft werken.
  function heel(r, d) {
    var s = standaard(r);
    if (!d || typeof d !== 'object') return s;
    if (!d.patronen || d.patronen.length !== 4) d.patronen = s.patronen;
    if (!d.params) d.params = s.params;
    if (typeof d.actief !== 'number' || d.actief < 0 || d.actief > 3) d.actief = 0;
    if (r === 'drums') {
      if (!d.stil) d.stil = {};
      for (var id in s.params) {
        if (!d.params[id]) d.params[id] = s.params[id];
        for (var k in s.params[id]) if (d.params[id][k] === undefined) d.params[id][k] = s.params[id][k];
        for (var i = 0; i < 4; i++) if (!d.patronen[i][id] || d.patronen[i][id].length !== 16) d.patronen[i][id] = s.patronen[0][id].slice();
      }
    } else {
      for (var b in s.params) if (d.params[b] === undefined) d.params[b] = s.params[b];
      if (typeof d.grond !== 'number') d.grond = s.grond;
      for (var j = 0; j < 4; j++) if (!d.patronen[j] || d.patronen[j].length !== 16) d.patronen[j] = s.patronen[0].slice();
    }
    return d;
  }

  // Wat er van versie 0.3 nog in dit toestel staat.
  function oudeLokaleData(r) {
    var eigen = HG.haal('rol_' + r, true);
    if (eigen) return eigen;
    if (r === 'drums' && HG.haal('patroon', true)) {
      var p = HG.haal('patroon', true);
      return { patronen: [p, kopie(p), kopie(p), kopie(p)], params: HG.haal('params', true), stil: HG.haal('stil', true) || {}, actief: 0 };
    }
    if (r === 'bas' && HG.haal('basPatroon', true)) {
      var q = HG.haal('basPatroon', true);
      return { patronen: [q, q.slice(), q.slice(), q.slice()], params: HG.haal('basParams', true), grond: parseInt(HG.haal('basGrond'), 10) || 36, actief: 0 };
    }
    return null;
  }

  var stuurTimer = null;
  function bewaar() {
    if (!rol || !data[rol]) return;
    var r = rol, d = data[r];
    HG.bewaar('rol_' + r, d);
    clearTimeout(stuurTimer);
    stuurTimer = setTimeout(function () { HG.vraag('POST', '/api/opslag', { rol: r, data: d }, function () {}); }, 400);
  }

  // Haalt klank en patronen voor deze rol op bij de Masterblaster.
  function laadRol(r, bijAanhaken, klaar) {
    HG.vraag('GET', '/api/opslag?rol=' + r + '&' + Math.random(), null, function (t) {
      var antw = {}; try { antw = JSON.parse(t); } catch (e) {}
      if (antw.data) {
        data[r] = heel(r, antw.data);
        HG.bewaar('rol_' + r, data[r]);
        if (bijAanhaken) melding('PERSISTENCE IS ALL', 'klank en patronen zijn terug');
      } else {
        data[r] = heel(r, bijAanhaken ? oudeLokaleData(r) : null);
        HG.vraag('POST', '/api/opslag', { rol: r, data: data[r] }, function () {});
      }
      klaar();
    }, function () {
      data[r] = heel(r, oudeLokaleData(r));
      klaar();
    });
  }

  // ---------- melding ----------

  var meldTimer = null;
  function melding(titel, sub) {
    var el = $('melding');
    el.innerHTML = HG.escape(titel) + (sub ? '<small>' + HG.escape(sub) + '</small>' : '');
    HG.klasse(el, 'verborgen', false);
    clearTimeout(meldTimer);
    meldTimer = setTimeout(function () { HG.klasse(el, 'verborgen', true); }, 3200);
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
    var d = data[rol];

    // Patroonwissel op de eerste tel van de maat.
    if (stap === 0 && volgend !== null && d) {
      d.actief = volgend;
      volgend = null;
      bewaar();
      HG.audio.opHetGeluid(wanneer, function () { tekenPatronen(); tekenRol(); });
    }

    if (stap % 4 === 0) {
      var tel = stap / 4;
      if (rol === 'klik' || metronoom) klik(wanneer, tel === 0);
      HG.audio.opHetGeluid(wanneer, function () { toonTel(tel); });
    }

    if (rol === 'drums' && d) {
      var p = d.patronen[d.actief], stemmen = HG.drums.stemmen;
      for (var i = 0; i < stemmen.length; i++) {
        var id = stemmen[i].id, v = p[id][stap];
        if (v && !d.stil[id]) {
          HG.drums.speel(id, wanneer, v === 2, d.params[id]);
          flitsNaam(id, wanneer);
        }
      }
    }
    if (MONO[rol] && d) {
      var bpm = HG.klok.st ? HG.klok.st.bpm : 120;
      MONO[rol].speel(stap, wanneer, d.patronen[d.actief], d.grond, d.params, 15 / bpm);
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

  var lopers = [];
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

  // ---------- een matrix: rijen onder elkaar, 16 stappen breed ----------

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

  function bouwSchuiven(vak, knoppen, waarden) {
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
          bewaar();
        }
        inp.addEventListener('input', bij, false);
        inp.addEventListener('change', bij, false);
        vak.appendChild(w);
      })(knoppen[k]);
    }
  }

  // ---------- patronen A tot D ----------

  var patKnoppen = [$('patA'), $('patB'), $('patC'), $('patD')];
  var wisZeker = false, wisTimer = null;

  function patroonLeeg(d, i) {
    var p = d.patronen[i];
    if (rol === 'drums') {
      for (var id in p) for (var n = 0; n < 16; n++) if (p[id][n]) return false;
      return true;
    }
    for (var m = 0; m < 16; m++) if (p[m] >= 0) return false;
    return true;
  }

  function tekenPatronen() {
    var d = data[rol]; if (!d) return;
    for (var i = 0; i < 4; i++) {
      HG.klasse(patKnoppen[i], 'actief', d.actief === i);
      HG.klasse(patKnoppen[i], 'volgend', volgend === i);
      HG.klasse(patKnoppen[i], 'leeg', patroonLeeg(d, i));
    }
    $('patWis').innerHTML = wisZeker ? 'ZEKER?' : 'WIS';
  }

  for (var pk = 0; pk < 4; pk++) {
    (function (i) {
      HG.knop(patKnoppen[i], function () {
        var d = data[rol]; if (!d) return;
        var loopt = HG.klok.st && HG.klok.st.running;
        if (!loopt) { d.actief = i; volgend = null; bewaar(); tekenRol(); }
        else volgend = (i === d.actief) ? null : i;
        tekenPatronen();
      });
    })(pk);
  }

  HG.knop('patWis', function () {
    var d = data[rol]; if (!d) return;
    if (!wisZeker) {
      wisZeker = true; tekenPatronen();
      clearTimeout(wisTimer);
      wisTimer = setTimeout(function () { wisZeker = false; tekenPatronen(); }, 2500);
      return;
    }
    wisZeker = false;
    var p = d.patronen[d.actief];
    if (rol === 'drums') { for (var id in p) for (var n = 0; n < 16; n++) p[id][n] = 0; }
    else { for (var m = 0; m < 16; m++) p[m] = -1; }
    bewaar(); tekenRol(); tekenPatronen();
  });

  // ---------- drums ----------

  var drumCellen = {};
  var openStem = null;

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
              var d = data.drums, r = d.patronen[d.actief][s.id];
              r[n] = (r[n] + 1) % 3;
              bewaar();
              tekenDrumRij(s.id);
              tekenPatronen();
            });
          })(n);
        }
      })(stemmen[i]);
    }
    HG.knop('drumStil', function () {
      if (!openStem) return;
      data.drums.stil[openStem] = !data.drums.stil[openStem];
      bewaar();
      tekenDrumPaneel();
    });
    HG.knop('drumDicht', function () { openStem = null; tekenDrumPaneel(); });
  }

  function tekenDrumRij(id) {
    var d = data.drums, r = d.patronen[d.actief][id], c = drumCellen[id];
    for (var n = 0; n < 16; n++) {
      HG.klasse(c[n], 'aan', r[n] === 1);
      HG.klasse(c[n], 'accent', r[n] === 2);
    }
  }

  function tekenDrums() {
    var stemmen = HG.drums.stemmen;
    for (var i = 0; i < stemmen.length; i++) tekenDrumRij(stemmen[i].id);
    tekenDrumPaneel();
  }

  function tekenDrumPaneel() {
    var d = data.drums, stemmen = HG.drums.stemmen, s = null;
    for (var i = 0; i < stemmen.length; i++) {
      var id = stemmen[i].id;
      HG.klasse(naamKnoppen[id], 'open', id === openStem);
      HG.klasse(naamKnoppen[id], 'stil', !!d.stil[id]);
      if (id === openStem) s = stemmen[i];
    }
    HG.klasse($('drumPaneel'), 'verborgen', !s);
    if (!s) return;
    $('drumTitel').innerHTML = s.naam;
    $('drumStil').innerHTML = d.stil[s.id] ? 'STIL' : 'AAN';
    HG.klasse($('drumStil'), 'aan', !!d.stil[s.id]);
    bouwSchuiven($('drumKnoppen'), s.knoppen, d.params[s.id]);
  }

  // ---------- bas en lead: notenmatrix ----------

  var notenCellen = [], notenNamen = [], notenRijen = 13;

  function bouwNoten() {
    var m = $('notenMatrix');
    m.innerHTML = '';
    loperRij(m);
    notenCellen = []; notenNamen = [];
    for (var r = 0; r < notenRijen; r++) {
      (function (r) {
        var toon = notenRijen - 1 - r; // halve tonen boven de grondtoon
        var naam = document.createElement('button');
        naam.className = 'mnaam' + (toon % 12 === 0 ? ' grond' : '');
        notenNamen.push(naam);
        var cellen = cellenRij(m, naam, toon % 12 === 0 ? 'grondrij' : '');
        notenCellen.push(cellen);
        for (var n = 0; n < 16; n++) {
          (function (n) {
            HG.knop(cellen[n], function () {
              var d = data[rol], p = d.patronen[d.actief];
              var v = p[n], hier = v >= 0 && v % 100 === toon;
              if (!hier) p[n] = toon;
              else if (v < 100) p[n] = toon + 100;
              else p[n] = -1;
              bewaar();
              tekenNoten();
              tekenPatronen();
            });
          })(n);
        }
      })(r);
    }
    function grond(dlt) {
      var d = data[rol];
      d.grond = Math.max(24, Math.min(84, d.grond + dlt));
      bewaar();
      tekenNoten();
    }
    HG.knop('notenMin', function () { grond(-1); });
    HG.knop('notenPlus', function () { grond(1); });
    HG.knop('notenOctMin', function () { grond(-12); });
    HG.knop('notenOctPlus', function () { grond(12); });
    HG.knop('notenKlankKnop', function () { HG.klasse($('notenPaneel'), 'verborgen', $('notenPaneel').className.indexOf('verborgen') < 0); });
    HG.knop('notenDicht', function () { HG.klasse($('notenPaneel'), 'verborgen', true); });
  }

  function tekenNoten() {
    var d = data[rol], p = d.patronen[d.actief];
    for (var r = 0; r < notenCellen.length; r++) {
      var toon = notenRijen - 1 - r;
      notenNamen[r].innerHTML = HG.notenNaam(d.grond + toon).replace(/-?\d+$/, '');
      for (var n = 0; n < 16; n++) {
        var v = p[n], hier = v >= 0 && v % 100 === toon;
        HG.klasse(notenCellen[r][n], 'aan', hier && v < 100);
        HG.klasse(notenCellen[r][n], 'accent', hier && v >= 100);
      }
    }
    $('notenGrond').innerHTML = HG.notenNaam(d.grond);
  }

  // ---------- de rol in beeld ----------

  function tekenRol() {
    if (!data[rol]) return;
    if (rol === 'drums') tekenDrums();
    if (MONO[rol]) {
      tekenNoten();
      $('notenTitel').innerHTML = rol === 'bas' ? 'BAS' : 'LEAD';
      bouwSchuiven($('notenKnoppen'), MONO[rol].knoppen, data[rol].params);
    }
    tekenPatronen();
  }

  // ---------- sessies ----------

  function tekenSessies(inf) {
    $('sessieNaam').innerHTML = inf.naam ? HG.escape(inf.naam) : 'nog niet bewaard';
    var lijst = $('sessieLijst');
    lijst.innerHTML = '';
    for (var i = 0; i < inf.lijst.length; i++) {
      (function (naam) {
        var rij = document.createElement('div');
        rij.className = 'rij';
        var laad = document.createElement('button');
        laad.innerHTML = 'LADEN: ' + HG.escape(naam);
        var wis = document.createElement('button');
        wis.className = 'klein';
        wis.innerHTML = 'WIS';
        rij.appendChild(laad); rij.appendChild(wis);
        lijst.appendChild(rij);
        HG.knop(laad, function () {
          if (window.confirm('Sessie "' + naam + '" laden? Wat nu speelt wordt vervangen, op alle toestellen.')) sessieActie({ actie: 'laad', naam: naam });
        });
        HG.knop(wis, function () {
          if (window.confirm('Sessie "' + naam + '" weggooien?')) sessieActie({ actie: 'wis', naam: naam });
        });
      })(inf.lijst[i]);
    }
  }

  function haalSessies() {
    HG.vraag('GET', '/api/sessies?' + Math.random(), null, function (t) {
      try { tekenSessies(JSON.parse(t)); } catch (e) {}
    });
  }

  function sessieActie(body) {
    HG.vraag('POST', '/api/sessies', body, function (t) {
      try { tekenSessies(JSON.parse(t)); } catch (e) {}
      if (body.actie === 'bewaar') melding('OPGESLAGEN', body.naam);
    });
  }

  HG.knop('sessieBewaar', function () {
    // Eerst eigen wijzigingen meteen doorsturen, dan bewaren.
    if (rol && data[rol]) HG.vraag('POST', '/api/opslag', { rol: rol, data: data[rol] }, function () {});
    var huidig = (HG.klok.st && HG.klok.st.sessieNaam) || '';
    var naam = window.prompt('Naam van de sessie', huidig);
    if (naam) setTimeout(function () { sessieActie({ actie: 'bewaar', naam: naam }); }, 300);
  });
  HG.knop('sessieNieuw', function () {
    if (window.confirm('Nieuwe, lege sessie beginnen? Wat nu speelt wordt vervangen door de beginpatronen, op alle toestellen. Bewaar eerst als je het wilt houden.')) sessieActie({ actie: 'nieuw' });
  });

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
    if (s && s.sessieNaam) regels.push('sessie: <b>' + HG.escape(s.sessieNaam) + '</b>');
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
      if (volgend !== null && data[rol]) { data[rol].actief = volgend; volgend = null; bewaar(); tekenRol(); }
      if (oud && oud.running && MONO[rol]) MONO[rol].stop();
    }
    // Een andere sessie geladen of een nieuwe begonnen: klank en patronen opnieuw ophalen.
    if (bekendeLaadVersie !== null && s.laadVersie !== bekendeLaadVersie && rol && data[rol]) {
      var r = rol;
      laadRol(r, false, function () { if (rol === r) tekenRol(); melding('SESSIE GELADEN', s.sessieNaam || 'nieuwe sessie'); });
      $('sessieNaam').innerHTML = s.sessieNaam ? HG.escape(s.sessieNaam) : 'nog niet bewaard';
    }
    bekendeLaadVersie = s.laadVersie;
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
    var open = el.className.indexOf('verborgen') >= 0;
    HG.klasse(el, 'verborgen', !open);
    if (open) haalSessies();
  });

  $('naam').value = mijnNaam;
  $('naam').addEventListener('change', function () {
    mijnNaam = $('naam').value || mijnNaam; HG.bewaar('naam', mijnNaam); meld();
  });

  HG.knop('wisselRol', function () { HG.klasse($('poort'), 'verborgen', false); });

  $('voet').innerHTML = 'Himmelsgristle ' + VERSIE + (isMaster ? ' &middot; Masterblaster' : '');

  // ---------- rol kiezen en aanhaken ----------

  var gestart = false, gebouwd = {};
  var rolNamen = { drums: 'drums', bas: 'bas', lead: 'lead', klik: 'kliktest' };

  function toonRolDelen() {
    HG.klasse($('drumsDeel'), 'verborgen', rol !== 'drums');
    HG.klasse($('notenDeel'), 'verborgen', !MONO[rol]);
    HG.klasse($('patronen'), 'verborgen', rol === 'klik');
    HG.klasse($('tellen'), 'groot', rol === 'klik');
    $('rolNaam').innerHTML = rolNamen[rol];
  }

  function kies(nieuweRol) {
    if (!HG.audio.ctx && !HG.audio.maak()) {
      $('poortinfo').innerHTML = 'Deze browser kan geen geluid maken. Hij kan later een andere rol krijgen.';
      return;
    }
    if (HG.audio.ctx.resume) HG.audio.ctx.resume();
    if (MONO[rol] && rol !== nieuweRol) MONO[rol].stop();
    rol = nieuweRol;
    volgend = null;
    HG.bewaar('rol', rol);
    HG.klasse($('poort'), 'verborgen', true);
    toonRolDelen();

    var klaar = function () {
      if (rol !== nieuweRol) return;
      if (rol === 'drums' && !gebouwd.drums) { bouwDrums(); gebouwd.drums = true; }
      if (MONO[rol] && !gebouwd.noten) { bouwNoten(); gebouwd.noten = true; }
      tekenRol();
    };
    if (rol === 'klik') klaar();
    else laadRol(rol, true, klaar);

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
  HG.knop('kiesLead', function () { kies('lead'); });
  HG.knop('kiesKlik', function () { kies('klik'); });
  HG.knop('kiesLater', function () { $('poortinfo').innerHTML = 'De pad komt in een volgende versie.'; });

})(window.HG);
