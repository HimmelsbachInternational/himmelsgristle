// Himmelsgristle: het scherm en de rollen.

(function (HG) {
  'use strict';

  var $ = HG.$;
  var VERSIE = '0.7';
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

  var MONO = { bas: HG.bas, lead: HG.lead };          // monofone motoren
  var NOTEN = { bas: HG.bas, lead: HG.lead, pad: HG.pad }; // alles met een notenmatrix

  function mod(a, n) { return ((a % n) + n) % n; }

  // ---------- arpeggiator ----------
  // Elke noot in de matrix wordt een loopje over een akkoord.

  var ARP_MODI = ['ARP OFF', 'ARP UP', 'ARP DOWN', 'ARP UP/DN', 'ARP RND'];
  var ARP_AKKOORDEN = [
    ['OCT', [0]], ['5TH', [0, 7]], ['MIN', [0, 3, 7]], ['MAJ', [0, 4, 7]],
    ['DIM', [0, 3, 6]], ['SUS', [0, 5, 7]], ['MIN7', [0, 3, 7, 10]]
  ];
  var arpTeller = 0;

  function arpNoten(grondtoon, a) {
    var akk = ARP_AKKOORDEN[a.akkoord][1], uit = [];
    for (var o = 0; o < a.bereik; o++) {
      for (var i = 0; i < akk.length; i++) uit.push(Math.min(108, grondtoon + akk[i] + 12 * o));
    }
    if (akk.length === 1 && a.bereik === 1) uit.push(Math.min(108, grondtoon + 12));
    return uit;
  }

  function arpKies(noten, modus, n) {
    var L = noten.length;
    if (modus === 1) return noten[n % L];
    if (modus === 2) return noten[L - 1 - (n % L)];
    if (modus === 3) {
      if (L < 2) return noten[0];
      var rond = 2 * L - 2, k = n % rond;
      return noten[k < L ? k : rond - k];
    }
    return noten[Math.floor(Math.random() * L)];
  }

  function speelMono(idx, wanneer, d, stapDuur) {
    var m = MONO[rol], p = d.patronen[d.actief], v = p[idx], a = d.arp;
    var volgendeAan = p[(idx + 1) % d.lengte] >= 0;
    if (v < 0) { m.rust(wanneer); arpTeller = 0; return; }
    if (!a || !a.modus) { m.noot(wanneer, d.grond + v % 100, v >= 100, stapDuur, volgendeAan, d.params); return; }
    var noten = arpNoten(d.grond + v % 100, a);
    var subDuur = stapDuur / a.snel;
    for (var sub = 0; sub < a.snel; sub++) {
      var laatste = sub === a.snel - 1;
      m.noot(wanneer + sub * subDuur, arpKies(noten, a.modus, arpTeller++), v >= 100 && sub === 0, subDuur, !laatste || volgendeAan, d.params);
    }
  }
  var data = {};          // per rol
  var volgend = null;     // patroon dat op de volgende maat ingaat
  var bekendeLaadVersie = null;

  function kopie(x) { return JSON.parse(JSON.stringify(x)); }

  function standaard(r) {
    if (r === 'drums') {
      var p = HG.drums.standaardPatroon();
      var lengte = {};
      for (var id in p) lengte[id] = 16;
      return { patronen: [p, kopie(p), kopie(p), kopie(p)], params: HG.drums.standaardParams(), stil: {}, actief: 0, lengte: lengte };
    }
    if (r === 'pad') {
      var rij = HG.pad.standaardPatroon();
      return { patronen: [rij, kopie(rij), kopie(rij), kopie(rij)], params: HG.pad.standaardParams(), grond: HG.pad.standaardGrond, actief: 0, lengte: 16 };
    }
    var m = MONO[r];
    var q = m.standaardPatroon();
    return { patronen: [q, q.slice(), q.slice(), q.slice()], params: m.standaardParams(), grond: m.standaardGrond, actief: 0,
      arp: { modus: 0, akkoord: 0, bereik: 1, snel: 1 }, lengte: 16 };
  }

  // Maakt data heel en veilig: ontbrekende stukken worden aangevuld en alle waarden worden
  // gewone getallen binnen de grenzen. Zo blijven oude en geïmporteerde bestanden werken.
  function getal(x, std, min, max) {
    x = Number(x);
    if (!isFinite(x)) return std;
    return Math.max(min, Math.min(max, x));
  }

  function heleParams(std, p) {
    var uit = {};
    for (var k in std) uit[k] = getal(p && p[k], std[k], 0, 1);
    return uit;
  }

  function heel(r, d) {
    var s = standaard(r);
    if (!d || typeof d !== 'object') return s;
    var uit = { actief: Math.round(getal(d.actief, 0, 0, 3)) };
    var pat = (d.patronen && d.patronen.length === 4) ? d.patronen : s.patronen;
    if (r === 'drums') {
      uit.params = {}; uit.stil = {}; uit.patronen = []; uit.lengte = {};
      for (var id in s.params) {
        uit.params[id] = heleParams(s.params[id], d.params && d.params[id]);
        uit.stil[id] = !!(d.stil && d.stil[id]);
        uit.lengte[id] = Math.round(getal(d.lengte && d.lengte[id], 16, 1, 16));
      }
      for (var i = 0; i < 4; i++) {
        var p = {};
        for (var sid in s.params) {
          var rij = pat[i] && pat[i][sid];
          p[sid] = [];
          for (var n = 0; n < 16; n++) p[sid].push(rij && rij.length === 16 ? Math.round(getal(rij[n], 0, 0, 2)) : s.patronen[0][sid][n]);
        }
        uit.patronen.push(p);
      }
    } else if (r === 'pad') {
      uit.params = heleParams(s.params, d.params);
      uit.grond = Math.round(getal(d.grond, s.grond, 24, 84));
      uit.lengte = Math.round(getal(d.lengte, 16, 1, 16));
      uit.patronen = [];
      for (var pi = 0; pi < 4; pi++) {
        var rijen = [];
        for (var pr = 0; pr < 13; pr++) {
          var bron = pat[pi] && pat[pi][pr], rij2 = [];
          for (var pn = 0; pn < 16; pn++) rij2.push(bron && bron.length === 16 ? Math.round(getal(bron[pn], 0, 0, 2)) : 0);
          rijen.push(rij2);
        }
        uit.patronen.push(rijen);
      }
    } else {
      uit.params = heleParams(s.params, d.params);
      uit.grond = Math.round(getal(d.grond, s.grond, 24, 84));
      uit.lengte = Math.round(getal(d.lengte, 16, 1, 16));
      var a = d.arp || {};
      uit.arp = {
        modus: Math.round(getal(a.modus, 0, 0, ARP_MODI.length - 1)),
        akkoord: Math.round(getal(a.akkoord, 0, 0, ARP_AKKOORDEN.length - 1)),
        bereik: Math.round(getal(a.bereik, 1, 1, 3)),
        snel: Math.round(getal(a.snel, 1, 1, 2))
      };
      uit.patronen = [];
      for (var j = 0; j < 4; j++) {
        var q = [];
        for (var m = 0; m < 16; m++) {
          var v = pat[j] && pat[j].length === 16 ? Math.round(getal(pat[j][m], -1, -1, 112)) : s.patronen[0][m];
          if (v >= 13 && v < 100) v = 12;
          q.push(v);
        }
        uit.patronen.push(q);
      }
    }
    return uit;
  }

  // Wat er van versie 0.3 nog in dit toestel staat.
  function oudeLokaleData(r) {
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

  // ---------- plek: welk instrument in de sessie dit toestel speelt ----------

  var plek = null, plekNaam = '';

  var stuurTimer = null;
  function bewaar() {
    if (!rol || !data[rol] || !plek) return;
    var p = plek, d = data[rol];
    HG.bewaar('plekdata_' + p, d);
    clearTimeout(stuurTimer);
    stuurTimer = setTimeout(function () { HG.vraag('POST', '/api/plek/data', { plek: p, data: d }, function () {}); }, 400);
  }

  function stuurNu(klaar) {
    clearTimeout(stuurTimer);
    if (!rol || !data[rol] || !plek) { if (klaar) klaar(); return; }
    HG.vraag('POST', '/api/plek/data', { plek: plek, data: data[rol] }, function () { if (klaar) klaar(); }, function () { if (klaar) klaar(); });
  }

  // Vraagt de Masterblaster om een plek voor deze rol, met klank en patronen.
  // opties: { aanhaken: bij het kiezen van de rol, gewenst: een bepaalde plek, nieuw: altijd een nieuwe plek }
  function laadPlek(r, opties, klaar) {
    var gewenst = opties.gewenst || HG.haal('plek_' + r);
    HG.vraag('POST', '/api/plek', { apparaat: mijnId, rol: r, plek: gewenst, nieuw: !!opties.nieuw }, function (t) {
      var antw = {}; try { antw = JSON.parse(t); } catch (e) {}
      if (!antw.plek) { data[r] = heel(r, null); klaar(); return; }
      plek = antw.plek; plekNaam = antw.naam;
      HG.bewaar('plek_' + r, plek);
      if (antw.data) {
        data[r] = heel(r, antw.data);
        if (opties.aanhaken) melding('PERSISTENCE IS ALL', plekNaam + ': sound and patterns are back');
      } else {
        // Een lege plek. Bij de eerste keer na een oude versie nemen we mee wat er nog op dit toestel stond.
        var oud = (opties.aanhaken && !HG.haal('gemigreerd_' + r)) ? oudeLokaleData(r) : null;
        HG.bewaar('gemigreerd_' + r, '1');
        data[r] = heel(r, oud);
        HG.vraag('POST', '/api/plek/data', { plek: plek, data: data[r] }, function () {});
      }
      tekenPlekNaam();
      meld();
      klaar();
    }, function () {
      data[r] = heel(r, plek ? HG.haal('plekdata_' + plek, true) : null);
      klaar();
    });
  }

  function tekenPlekNaam() {
    $('rolNaam').innerHTML = rol === 'klik' ? 'click test' : HG.escape(plekNaam || rol);
    $('plekNaam').innerHTML = HG.escape(plekNaam || '');
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

  var volgtSong = true;   // dit toestel volgt de songketen van de Masterblaster
  var songPositie = -1;

  HG.planner.opStap = function (stap, wanneer, absoluut) {
    var d = data[rol];
    var st = HG.klok.st;

    if (stap === 0 && d) {
      // Songmodus: de Masterblaster bepaalt welk patroon er deze maat speelt.
      var song = st && st.song;
      if (song && song.aan && song.keten.length && volgtSong) {
        var maat = Math.floor(absoluut / 16);
        if (maat >= song.startMaat) {
          songPositie = mod(maat - song.startMaat, song.keten.length);
          var nieuw = song.keten[songPositie];
          volgend = null;
          if (d.actief !== nieuw) d.actief = nieuw;
          HG.audio.opHetGeluid(wanneer, function () { tekenPatronen(); tekenRol(); tekenSongStand(); });
        }
      } else if (volgend !== null) {
        // Eigen patroonwissel op de eerste tel van de maat.
        d.actief = volgend;
        volgend = null;
        bewaar();
        HG.audio.opHetGeluid(wanneer, function () { tekenPatronen(); tekenRol(); });
      }
    }

    if (stap % 4 === 0) {
      var tel = stap / 4;
      if (rol === 'klik' || metronoom) klik(wanneer, tel === 0);
      HG.audio.opHetGeluid(wanneer, function () { toonTel(tel); });
    }

    var stapDuur = 15 / (st ? st.bpm : 120);

    if (rol === 'drums' && d) {
      var p = d.patronen[d.actief], stemmen = HG.drums.stemmen, posities = {};
      for (var i = 0; i < stemmen.length; i++) {
        var id = stemmen[i].id, idx = mod(absoluut, d.lengte[id]), v = p[id][idx];
        posities[id] = idx;
        if (v && !d.stil[id]) {
          HG.drums.speel(id, wanneer, v === 2, d.params[id]);
          flitsNaam(id, wanneer);
        }
      }
      HG.audio.opHetGeluid(wanneer, function () { toonLoper('drums', stap); toonDrumPosities(posities); });
    }
    if (NOTEN[rol] && d) {
      var nIdx = mod(absoluut, d.lengte);
      if (rol === 'pad') HG.pad.speel(nIdx, wanneer, d.patronen[d.actief], d.grond, d.params, stapDuur, d.lengte);
      else speelMono(nIdx, wanneer, d, stapDuur);
      HG.audio.opHetGeluid(wanneer, function () { toonLoper('noten', nIdx); });
    }
  };

  // ---------- tellen en loper in beeld, gelijk met het geluid ----------

  var telTimer = null;
  function toonTel(pos) {
    for (var i = 0; i < 4; i++) HG.klasse($('t' + i), 'aan', i === pos);
    clearTimeout(telTimer);
    telTimer = setTimeout(function () { for (var j = 0; j < 4; j++) HG.klasse($('t' + j), 'aan', false); }, 110);
  }

  var lopers = {}, nuStap = {};
  function toonLoper(naam, stap) {
    var l = lopers[naam]; if (!l) return;
    if (nuStap[naam] >= 0) HG.klasse(l[nuStap[naam]], 'nu', false);
    if (stap >= 0) HG.klasse(l[stap], 'nu', true);
    nuStap[naam] = stap;
  }
  function stopLopers() {
    toonLoper('drums', -1); toonLoper('noten', -1); toonDrumPosities(null);
  }

  // Bij polymetrie loopt elke drumstem op zijn eigen plek: een kader per rij.
  var drumPos = {};
  function toonDrumPosities(posities) {
    for (var id in drumCellen) {
      if (drumPos[id] >= 0) HG.klasse(drumCellen[id][drumPos[id]], 'speelt', false);
      drumPos[id] = posities ? posities[id] : -1;
      if (drumPos[id] >= 0) HG.klasse(drumCellen[id][drumPos[id]], 'speelt', true);
    }
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

  function loperRij(houder, naam) {
    var leeg = document.createElement('div');
    leeg.className = 'mnaam';
    var r = cellenRij(houder, leeg, 'loper');
    for (var i = 0; i < r.length; i++) r[i].className = r[i].className.replace(' tel', '');
    lopers[naam] = r;
    nuStap[naam] = -1;
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
    if (rol === 'pad') {
      for (var r = 0; r < p.length; r++) for (var k = 0; k < 16; k++) if (p[r][k]) return false;
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
    $('patWis').innerHTML = wisZeker ? 'SURE?' : 'CLEAR';
  }

  for (var pk = 0; pk < 4; pk++) {
    (function (i) {
      HG.knop(patKnoppen[i], function () {
        var d = data[rol]; if (!d) return;
        var loopt = HG.klok.st && HG.klok.st.running;
        var song = HG.klok.st && HG.klok.st.song;
        if (volgtSong && song && song.aan) {
          volgtSong = false;
          melding('LEFT THE SONG', 'this device plays its own patterns now');
          tekenSongStand();
        }
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
    else if (rol === 'pad') { for (var r = 0; r < p.length; r++) for (var k = 0; k < 16; k++) p[r][k] = 0; }
    else { for (var m = 0; m < 16; m++) p[m] = -1; }
    bewaar(); tekenRol(); tekenPatronen();
  });

  // ---------- drums ----------

  var drumCellen = {};
  var openStem = null;

  function bouwDrums() {
    var m = $('drumMatrix');
    m.innerHTML = '';
    loperRij(m, 'drums');
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
    function lengte(dlt) {
      if (!openStem) return;
      var l = data.drums.lengte;
      l[openStem] = Math.max(1, Math.min(16, l[openStem] + dlt));
      bewaar();
      tekenDrumRij(openStem);
      $('drumLengte').innerHTML = l[openStem];
    }
    HG.knop('drumLengteMin', function () { lengte(-1); });
    HG.knop('drumLengtePlus', function () { lengte(1); });
  }

  function tekenDrumRij(id) {
    var d = data.drums, r = d.patronen[d.actief][id], c = drumCellen[id], L = d.lengte[id];
    for (var n = 0; n < 16; n++) {
      HG.klasse(c[n], 'aan', r[n] === 1);
      HG.klasse(c[n], 'accent', r[n] === 2);
      HG.klasse(c[n], 'buiten', n >= L);
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
    $('drumStil').innerHTML = d.stil[s.id] ? 'MUTED' : 'ON';
    HG.klasse($('drumStil'), 'aan', !!d.stil[s.id]);
    $('drumLengte').innerHTML = d.lengte[s.id];
    bouwSchuiven($('drumKnoppen'), s.knoppen, d.params[s.id]);
  }

  // ---------- bas en lead: notenmatrix ----------

  var notenCellen = [], notenNamen = [], notenRijen = 13;

  function bouwNoten() {
    var m = $('notenMatrix');
    m.innerHTML = '';
    loperRij(m, 'noten');
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
              if (rol === 'pad') {
                // Pad: meerdere noten per stap, elk vakje los aan, accent, uit.
                p[toon][n] = (p[toon][n] + 1) % 3;
              } else {
                var v = p[n], hier = v >= 0 && v % 100 === toon;
                if (!hier) p[n] = toon;
                else if (v < 100) p[n] = toon + 100;
                else p[n] = -1;
              }
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
    function arp(veld, max, min) {
      var a = data[rol].arp;
      a[veld] = a[veld] + 1 > max ? min : a[veld] + 1;
      if (veld === 'modus') arpTeller = 0;
      bewaar();
      tekenArp();
    }
    HG.knop('arpModus', function () { arp('modus', ARP_MODI.length - 1, 0); });
    HG.knop('arpAkkoord', function () { arp('akkoord', ARP_AKKOORDEN.length - 1, 0); });
    HG.knop('arpBereik', function () { arp('bereik', 3, 1); });
    HG.knop('arpSnel', function () { arp('snel', 2, 1); });
    function lengte(dlt) {
      var d = data[rol];
      d.lengte = Math.max(1, Math.min(16, d.lengte + dlt));
      bewaar();
      tekenNoten();
    }
    HG.knop('notenLengteMin', function () { lengte(-1); });
    HG.knop('notenLengtePlus', function () { lengte(1); });
    HG.knop('notenKlankKnop', function () { HG.klasse($('notenPaneel'), 'verborgen', $('notenPaneel').className.indexOf('verborgen') < 0); });
    HG.knop('notenDicht', function () { HG.klasse($('notenPaneel'), 'verborgen', true); });
  }

  function tekenArp() {
    var a = data[rol] && data[rol].arp; if (!a) return;
    $('arpModus').innerHTML = ARP_MODI[a.modus];
    HG.klasse($('arpModus'), 'aan', a.modus > 0);
    $('arpAkkoord').innerHTML = ARP_AKKOORDEN[a.akkoord][0];
    $('arpBereik').innerHTML = a.bereik + ' OCT';
    $('arpSnel').innerHTML = a.snel === 2 ? '1/32' : '1/16';
  }

  function tekenNoten() {
    var d = data[rol], p = d.patronen[d.actief];
    for (var r = 0; r < notenCellen.length; r++) {
      var toon = notenRijen - 1 - r;
      notenNamen[r].innerHTML = HG.notenNaam(d.grond + toon).replace(/-?\d+$/, '');
      for (var n = 0; n < 16; n++) {
        var aan, acc;
        if (rol === 'pad') { aan = p[toon][n] === 1; acc = p[toon][n] === 2; }
        else { var v = p[n], hier = v >= 0 && v % 100 === toon; aan = hier && v < 100; acc = hier && v >= 100; }
        HG.klasse(notenCellen[r][n], 'aan', aan);
        HG.klasse(notenCellen[r][n], 'accent', acc);
        HG.klasse(notenCellen[r][n], 'buiten', n >= d.lengte);
      }
    }
    $('notenGrond').innerHTML = HG.notenNaam(d.grond);
    $('notenLengte').innerHTML = d.lengte;
  }

  // ---------- de rol in beeld ----------

  function tekenRol() {
    if (!data[rol]) return;
    if (rol === 'drums') tekenDrums();
    if (NOTEN[rol]) {
      tekenNoten();
      if (MONO[rol]) tekenArp();
      HG.klasse($('arpRij'), 'verborgen', !MONO[rol]);
      $('notenTitel').innerHTML = { bas: 'BASS', lead: 'LEAD', pad: 'PAD' }[rol];
      $('notenUitleg').innerHTML = rol === 'pad'
        ? 'Several notes per step. Cells next to each other become one long note.'
        : 'One note per step. Tap again: accent. Again: off. With the arp on, repeat a note over several steps to let it run.';
      bouwSchuiven($('notenKnoppen'), NOTEN[rol].knoppen, data[rol].params);
    }
    tekenPatronen();
  }

  // ---------- sessies ----------

  function tekenSessies(inf) {
    $('sessieNaam').innerHTML = inf.naam ? HG.escape(inf.naam) : 'not saved yet';
    var lijst = $('sessieLijst');
    lijst.innerHTML = '';
    for (var i = 0; i < inf.lijst.length; i++) {
      (function (naam) {
        var rij = document.createElement('div');
        rij.className = 'rij';
        var laad = document.createElement('button');
        laad.innerHTML = 'LOAD: ' + HG.escape(naam);
        var wis = document.createElement('button');
        wis.className = 'klein';
        wis.innerHTML = 'DEL';
        rij.appendChild(laad); rij.appendChild(wis);
        lijst.appendChild(rij);
        HG.knop(laad, function () {
          if (window.confirm('Load session "' + naam + '"? What is playing now gets replaced, on every device.')) sessieActie({ actie: 'laad', naam: naam });
        });
        HG.knop(wis, function () {
          if (window.confirm('Throw away session "' + naam + '"?')) sessieActie({ actie: 'wis', naam: naam });
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
      if (body.actie === 'bewaar') melding('SAVED', body.naam);
    });
  }

  HG.knop('sessieBewaar', function () {
    // Eerst eigen wijzigingen meteen doorsturen, dan bewaren.
    var huidig = (HG.klok.st && HG.klok.st.sessieNaam) || '';
    var naam = window.prompt('Name of the session', huidig);
    if (naam) stuurNu(function () { sessieActie({ actie: 'bewaar', naam: naam }); });
  });
  HG.knop('sessieNieuw', function () {
    if (window.confirm('Start a new, empty session? What is playing now gets replaced on every device. Save first if you want to keep it.')) sessieActie({ actie: 'nieuw' });
  });

  // ---------- songmodus ----------
  // De keten staat op de Masterblaster; elk toestel rekent zelf uit waar het in de keten is.

  var LETTERS = ['A', 'B', 'C', 'D'];

  function huidigeSong() {
    var s = HG.klok.st && HG.klok.st.song;
    return s ? { aan: !!s.aan, keten: s.keten.slice() } : { aan: false, keten: [] };
  }

  function stuurSong(keten, aan, herstart) {
    HG.klok.stuur({ action: 'song', keten: keten, aan: aan, herstart: !!herstart });
  }

  function tekenSongStand() {
    var song = huidigeSong();
    var el = $('songKeten');
    if (!song.keten.length) {
      el.innerHTML = 'no song yet';
    } else {
      var delen = [];
      for (var i = 0; i < song.keten.length; i++) {
        var nu = song.aan && volgtSong && i === songPositie && HG.klok.st && HG.klok.st.running;
        delen.push(nu ? '<span class="nu">' + LETTERS[song.keten[i]] + '</span>' : LETTERS[song.keten[i]]);
      }
      el.innerHTML = delen.join(' ');
    }
    HG.klasse(el, 'uit', !song.aan);
    $('songAan').innerHTML = song.aan ? 'STOP SONG' : 'PLAY SONG';
    HG.klasse($('songAan'), 'aan', song.aan);
    $('songVolg').innerHTML = volgtSong ? 'THIS DEVICE FOLLOWS THE SONG' : 'LET THIS DEVICE FOLLOW AGAIN';
    HG.klasse($('songVolg'), 'aan', volgtSong);
  }

  for (var sl = 0; sl < 4; sl++) {
    (function (i) {
      HG.knop('song' + LETTERS[i], function () {
        var song = huidigeSong();
        if (song.keten.length >= 64) return;
        song.keten.push(i);
        stuurSong(song.keten, song.aan, false);
      });
      HG.knop('alle' + LETTERS[i], function () {
        volgtSong = true;
        stuurSong([i], true, true);
        melding('ALL DEVICES TO ' + LETTERS[i], 'on the next bar');
      });
    })(sl);
  }
  HG.knop('songTerug', function () {
    var song = huidigeSong();
    song.keten.pop();
    stuurSong(song.keten, song.aan && song.keten.length > 0, false);
  });
  HG.knop('songWis', function () { stuurSong([], false, false); });
  HG.knop('songAan', function () {
    var song = huidigeSong();
    if (!song.keten.length) { melding('EMPTY SONG', 'add some letters first'); return; }
    if (!song.aan) volgtSong = true;
    stuurSong(song.keten, !song.aan, true);
  });
  HG.knop('songVolg', function () {
    volgtSong = !volgtSong;
    volgend = null;
    tekenSongStand();
    tekenPatronen();
  });

  // ---------- plekken: wisselen, hernoemen, nieuw ----------

  function lijstRij(houder, tekst, klasse, actie, klein, kleinActie, uit) {
    var rij = document.createElement('div');
    rij.className = 'rij';
    var b = document.createElement('button');
    b.innerHTML = tekst;
    if (klasse) b.className = klasse;
    if (uit) b.disabled = true;
    rij.appendChild(b);
    if (!uit) HG.knop(b, actie);
    if (klein) {
      var k = document.createElement('button');
      k.className = 'klein';
      k.innerHTML = klein;
      rij.appendChild(k);
      HG.knop(k, kleinActie);
    }
    houder.appendChild(rij);
  }

  function wisselPlek(opties) {
    if (!rol || rol === 'klik') return;
    var r = rol;
    stuurNu(function () {
      if (NOTEN[r]) NOTEN[r].stop();
      laadPlek(r, opties, function () { if (rol === r) { volgend = null; tekenRol(); haalPlekken(); } });
    });
  }

  function haalPlekken() {
    var houder = $('plekLijst');
    if (!rol || rol === 'klik') { houder.innerHTML = ''; return; }
    HG.vraag('GET', '/api/plekken?' + Math.random(), null, function (t) {
      var lijst = []; try { lijst = JSON.parse(t).plekken; } catch (e) {}
      houder.innerHTML = '';
      for (var i = 0; i < lijst.length; i++) {
        (function (p) {
          if (p.rol !== rol) return;
          if (p.id === plek) lijstRij(houder, HG.escape(p.naam) + ' (this device)', 'huidig', function () {});
          else if (p.bezet) lijstRij(houder, HG.escape(p.naam) + ' (in use)', '', null, null, null, true);
          else lijstRij(houder, 'SWITCH TO ' + HG.escape(p.naam), '', function () { wisselPlek({ gewenst: p.id }); });
        })(lijst[i]);
      }
    });
  }

  HG.knop('plekHernoem', function () {
    if (!plek) return;
    var naam = window.prompt('Name of this instrument', plekNaam);
    if (!naam) return;
    HG.vraag('POST', '/api/plek/naam', { plek: plek, naam: naam }, function () {
      plekNaam = naam.replace(/[^A-Za-z0-9 _\-]/g, '').trim().slice(0, 40) || plekNaam;
      tekenPlekNaam(); meld(); haalPlekken();
    });
  });

  HG.knop('plekNieuw', function () {
    if (window.confirm('A new, empty slot for this instrument? Your current slot stays saved.')) wisselPlek({ nieuw: true });
  });

  // ---------- klankbibliotheek ----------

  function pasKlankToe(klank) {
    if (!klank || !klank.params || !data[rol]) return;
    var d = data[rol];
    var nieuw = heel(rol, { patronen: d.patronen, params: klank.params, grond: d.grond, stil: d.stil, actief: d.actief });
    d.params = nieuw.params;
    bewaar();
    tekenRol();
  }

  function haalKlanken() {
    var houder = $('klankLijst');
    if (!rol || rol === 'klik') { houder.innerHTML = ''; return; }
    var r = rol;
    HG.vraag('GET', '/api/klanken?rol=' + r + '&' + Math.random(), null, function (t) {
      var lijst = []; try { lijst = JSON.parse(t).lijst; } catch (e) {}
      houder.innerHTML = '';
      for (var i = 0; i < lijst.length; i++) {
        (function (naam) {
          lijstRij(houder, 'LOAD: ' + HG.escape(naam), '', function () {
            HG.vraag('GET', '/api/klanken?rol=' + r + '&naam=' + encodeURIComponent(naam) + '&' + Math.random(), null, function (t2) {
              var k = null; try { k = JSON.parse(t2).klank; } catch (e) {}
              if (k && rol === r) { pasKlankToe(k); melding('SOUND LOADED', naam); }
            });
          }, 'DEL', function () {
            if (window.confirm('Throw away sound "' + naam + '"?')) {
              HG.vraag('POST', '/api/klanken', { actie: 'wis', rol: r, naam: naam }, function () { haalKlanken(); });
            }
          });
        })(lijst[i]);
      }
    });
  }

  HG.knop('klankBewaar', function () {
    if (!rol || rol === 'klik' || !data[rol]) return;
    var naam = window.prompt('Name of this sound', '');
    if (!naam) return;
    HG.vraag('POST', '/api/klanken', { actie: 'bewaar', rol: rol, naam: naam, klank: { params: data[rol].params } }, function () {
      haalKlanken(); melding('SOUND SAVED', naam);
    });
  });

  // ---------- exporteren en importeren ----------

  function download(url) {
    var a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); }, 1000);
  }

  function exporteer(soort) {
    if (soort !== 'sessie' && (!plek || rol === 'klik')) { melding('CHOOSE A ROLE FIRST'); return; }
    stuurNu(function () { download('/api/export?soort=' + soort + '&plek=' + encodeURIComponent(plek || '') + '&' + Math.random()); });
  }

  HG.knop('exportKlank', function () { exporteer('klank'); });
  HG.knop('exportInstrument', function () { exporteer('instrument'); });
  HG.knop('exportSessie', function () { exporteer('sessie'); });
  HG.knop('importKnop', function () { $('importBestand').value = ''; $('importBestand').click(); });

  $('importBestand').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    if (f.size > 190000) { melding('IMPORT FAILED', 'the file is too big'); return; }
    var lezer = new FileReader();
    lezer.onload = function () {
      var b = null;
      try { b = JSON.parse(lezer.result); } catch (e) {}
      if (!b || !b.himmelsgristle) { melding('IMPORT FAILED', 'this is not a Himmelsgristle file'); return; }
      if (b.soort === 'sessie' && !window.confirm('Import session "' + (b.naam || '') + '"? What is playing now gets replaced, on every device.')) return;
      if (b.soort === 'instrument' && !window.confirm('Import instrument "' + (b.naam || '') + '"? Sound and patterns on this device get replaced.')) return;
      clearTimeout(stuurTimer);
      HG.vraag('POST', '/api/import', { bestand: b, plek: plek }, function (t) {
        var u = {}; try { u = JSON.parse(t); } catch (e) {}
        if (u.fout) { melding('IMPORT FAILED', u.fout); return; }
        if (u.soort === 'klank') {
          haalKlanken();
          if (u.rol === rol) { pasKlankToe(u.klank); melding('SOUND IMPORTED', u.naam); }
          else melding('SOUND SAVED', u.naam + ' is now in the ' + u.rol + ' sounds');
        } else if (u.soort === 'instrument') {
          clearTimeout(stuurTimer);
          var r = rol;
          laadPlek(r, { gewenst: plek }, function () { if (rol === r) { tekenRol(); haalPlekken(); } });
          melding('INSTRUMENT IMPORTED', u.naam);
        } else if (u.soort === 'sessie') {
          melding('SESSION IMPORTED', u.naam);
        }
      }, function () { melding('IMPORT FAILED', 'no connection to the Masterblaster'); });
    };
    lezer.readAsText(f);
  }, false);

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
        $('adres').innerHTML = 'No network found';
        $('adresUitleg').innerHTML = 'Switch on the hotspot. The address shows up here by itself.';
        $('qr').innerHTML = '';
        laatsteAdres = null;
      } else if (inf.bevestigd) {
        $('adresUitleg').innerHTML = 'Confirmed: a player already joined through this address.';
      } else {
        $('adresUitleg').innerHTML = 'Other phone on the hotspot, mobile data off, then open this address or scan the code.';
      }
      var andere = [];
      for (var i = 0; i < inf.alle.length; i++) if (inf.alle[i] !== adres) andere.push(inf.alle[i]);
      $('andereAdressen').innerHTML = (!inf.bevestigd && andere.length) ? 'Not working? Try: ' + HG.escape(andere.join('  ')) : '';
    });
  }

  function toonSpelers(s) {
    if (!isMaster || !s || !s.players) return;
    var regels = [], anderen = 0;
    for (var i = 0; i < s.players.length; i++) {
      var p = s.players[i];
      if (p.id !== mijnId) anderen++;
      regels.push('<b>' + HG.escape(p.plekNaam || p.role || '') + '</b> ' + HG.escape(p.name) +
        (p.id === mijnId ? ' (this device)' : ' &middot; ' + p.rtt + ' ms'));
    }
    $('spelers').innerHTML = 'Joined (' + regels.length + '):<br>' + regels.join('<br>');
    $('masterTeller').innerHTML = s.players.length + (masterDicht ? ' &#9662;' : ' &#9652;');
    if (anderen > 0 && !masterAutoDicht) { masterAutoDicht = true; masterDicht = true; tekenMaster(); }
  }

  // ---------- status ----------

  function toonStatus(s) {
    var k = HG.klok, regels = [];
    regels.push(k.verbonden
      ? 'connected &middot; round trip <b>' + k.rondreis.toFixed(1) + ' ms</b>'
      : '<span class="slecht">no connection to the Masterblaster</span>');
    if (k.verbonden && k.rondreis > 30) regels.push('<span class="slecht">slow wifi, sync may wobble</span>');
    if (!navigator.wakeLock) regels.push('keep-awake not available: set a long screen timeout');
    if (s && s.sessieNaam) regels.push('session: <b>' + HG.escape(s.sessieNaam) + '</b>');
    if (s && s.song && s.song.aan) regels.push(volgtSong ? 'song: <b>playing</b>' : 'song: playing, <b>this device left it</b>');
    if (s && s.players && !isMaster) regels.push('players: ' + s.players.length);
    $('status').innerHTML = regels.join('<br>');
  }

  HG.klok.opToestand(function (s, oud) {
    $('bpm').innerHTML = s.bpm;
    if (!oud || JSON.stringify(oud.song) !== JSON.stringify(s.song)) tekenSongStand();
    $('swing').innerHTML = Math.round((s.swing || 0) * 100);
    $('startstop').innerHTML = s.running ? 'STOP' : 'START';
    toonStatus(s);
    toonSpelers(s);
    if (!s.running) {
      stopLopers();
      if (volgend !== null && data[rol]) { data[rol].actief = volgend; volgend = null; bewaar(); tekenRol(); }
      if (oud && oud.running && NOTEN[rol]) NOTEN[rol].stop();
    }
    // Een andere sessie geladen of een nieuwe begonnen: klank en patronen opnieuw ophalen.
    if (bekendeLaadVersie !== null && s.laadVersie !== bekendeLaadVersie && rol && data[rol]) {
      var r = rol;
      laadPlek(r, {}, function () { if (rol === r) tekenRol(); melding('SESSION LOADED', s.sessieNaam || 'new session'); });
      $('sessieNaam').innerHTML = s.sessieNaam ? HG.escape(s.sessieNaam) : 'not saved yet';
    }
    bekendeLaadVersie = s.laadVersie;
  });

  // ---------- melden bij de Masterblaster ----------

  function meld() {
    HG.vraag('POST', '/api/hello', {
      id: mijnId, name: mijnNaam, role: rol || '', plek: rol === 'klik' ? '' : (plek || ''), plekNaam: plekNaam,
      latency: HG.planner.compensatie, rtt: HG.klok.rondreis
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
  function swing(dlt) {
    if (!HG.klok.st) return;
    HG.klok.stuur({ action: 'swing', swing: Math.round(((HG.klok.st.swing || 0) + dlt) * 100) / 100 });
  }
  HG.knop('swingMin', function () { swing(-0.05); });
  HG.knop('swingPlus', function () { swing(0.05); });
  HG.knop('tmin10', function () { tempo(-10); });
  HG.knop('tplus10', function () { tempo(10); });

  function zetLat(v) { HG.planner.zetCompensatie(v); $('lat').innerHTML = HG.planner.compensatie; }
  HG.knop('lmin10', function () { zetLat(HG.planner.compensatie - 10); });
  HG.knop('lmin1', function () { zetLat(HG.planner.compensatie - 1); });
  HG.knop('lplus1', function () { zetLat(HG.planner.compensatie + 1); });
  HG.knop('lplus10', function () { zetLat(HG.planner.compensatie + 10); });
  zetLat(HG.planner.compensatie);

  function tekenMetronoom() { $('klikAan').innerHTML = metronoom ? 'CLICK ON' : 'CLICK OFF'; }
  HG.knop('klikAan', function () { metronoom = !metronoom; HG.bewaar('klik', metronoom ? '1' : '0'); tekenMetronoom(); });
  tekenMetronoom();

  HG.knop('toonInstellingen', function () {
    var el = $('instellingen');
    var open = el.className.indexOf('verborgen') >= 0;
    HG.klasse(el, 'verborgen', !open);
    if (open) { haalSessies(); haalPlekken(); haalKlanken(); }
  });

  // Elk onderdeel van SETTINGS klapt los open en dicht, en dat wordt per toestel onthouden.
  (function () {
    var secties = document.querySelectorAll('#instellingen .sectie');
    for (var i = 0; i < secties.length; i++) {
      (function (sec) {
        var naam = sec.getAttribute('data-sectie');
        var kop = sec.querySelector('.skop'), inhoud = sec.querySelector('.sinhoud');
        var pijl = kop.getElementsByTagName('span')[1];
        function teken(open) {
          HG.klasse(inhoud, 'verborgen', !open);
          pijl.innerHTML = open ? '&#9662;' : '&#9656;';
        }
        teken(HG.haal('sectie_' + naam) === '1');
        HG.knop(kop, function () {
          var open = inhoud.className.indexOf('verborgen') >= 0;
          HG.bewaar('sectie_' + naam, open ? '1' : '0');
          teken(open);
        });
      })(secties[i]);
    }
  })();

  $('naam').value = mijnNaam;
  $('naam').addEventListener('change', function () {
    mijnNaam = $('naam').value || mijnNaam; HG.bewaar('naam', mijnNaam); meld();
  });

  HG.knop('wisselRol', function () { HG.klasse($('poort'), 'verborgen', false); });

  $('voet').innerHTML = 'Himmelsgristle ' + VERSIE + (isMaster ? ' &middot; Masterblaster' : '');

  // ---------- rol kiezen en aanhaken ----------

  var gestart = false, gebouwd = {};
  var rolNamen = { drums: 'drums', bas: 'bass', lead: 'lead', pad: 'pad', klik: 'click test' };

  function toonRolDelen() {
    HG.klasse($('drumsDeel'), 'verborgen', rol !== 'drums');
    HG.klasse($('notenDeel'), 'verborgen', !NOTEN[rol]);
    HG.klasse($('patronen'), 'verborgen', rol === 'klik');
    HG.klasse($('tellen'), 'groot', rol === 'klik');
    $('rolNaam').innerHTML = rol === 'klik' ? 'click test' : HG.escape(plekNaam || rolNamen[rol]);
  }

  function kies(nieuweRol) {
    if (!HG.audio.ctx && !HG.audio.maak()) {
      $('poortinfo').innerHTML = 'This browser cannot make sound. It can get another role later.';
      return;
    }
    if (HG.audio.ctx.resume) HG.audio.ctx.resume();
    if (NOTEN[rol] && rol !== nieuweRol) NOTEN[rol].stop();
    if (rol !== nieuweRol) { plek = null; plekNaam = ''; }
    rol = nieuweRol;
    volgend = null;
    HG.bewaar('rol', rol);
    HG.klasse($('poort'), 'verborgen', true);
    toonRolDelen();

    var klaar = function () {
      if (rol !== nieuweRol) return;
      if (rol === 'drums' && !gebouwd.drums) { bouwDrums(); gebouwd.drums = true; }
      if (NOTEN[rol] && !gebouwd.noten) { bouwNoten(); gebouwd.noten = true; }
      tekenRol();
    };
    if (rol === 'klik') klaar();
    else laadPlek(rol, { aanhaken: true }, klaar);

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
  HG.knop('kiesPad', function () { kies('pad'); });

})(window.HG);
