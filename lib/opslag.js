// Himmelsgristle: opslag op de Masterblaster.
//
// Drie lagen:
//   plek        één instrument in de sessie (BAS 1, BAS 2, DRUMS 1...), met klank en patronen
//   sessie      alle plekken samen, plus het tempo
//   klank       alleen de knoppen van één instrument, in een bibliotheek per rol
//
// Alles staat in de map opslag/ naast de server. Die map valt buiten git, dus bijwerken laat hem staan.
// Uitwisselbestanden zijn gewone JSON met een kop: { "himmelsgristle": 1, "soort": "...", ... }

var fs = require('fs');
var path = require('path');

var FORMAAT = 1;
var ROLLEN = { drums: 'DRUMS', bas: 'BASS', lead: 'LEAD', pad: 'PAD' };

module.exports = function (basis) {
  var OPSLAG = path.join(basis, 'opslag');
  var SESSIES = path.join(OPSLAG, 'sessies');
  var KLANKEN = path.join(OPSLAG, 'klanken');
  var HUIDIG = path.join(OPSLAG, 'huidig.json');
  try { fs.mkdirSync(SESSIES, { recursive: true }); } catch (e) {}
  try { fs.mkdirSync(KLANKEN, { recursive: true }); } catch (e) {}

  var sessie = leegSessie();
  var laadVersie = 1;

  function leegSessie() { return { naam: '', bpm: null, swing: null, song: null, plekken: {} }; }

  // Maakt een sessie heel, en zet het oude formaat (per rol, versie 0.4) om naar plekken.
  function heleSessie(s) {
    var uit = leegSessie();
    if (!s || typeof s !== 'object') return uit;
    uit.naam = schoneNaam(s.naam);
    if (typeof s.bpm === 'number') uit.bpm = s.bpm;
    if (typeof s.swing === 'number') uit.swing = Math.max(0, Math.min(0.6, s.swing));
    if (s.song && s.song.keten && s.song.keten.length) {
      uit.song = { aan: !!s.song.aan, keten: [] };
      for (var k = 0; k < s.song.keten.length && k < 64; k++) {
        var w = Math.round(Number(s.song.keten[k]));
        if (w >= 0 && w <= 3) uit.song.keten.push(w);
      }
    }
    if (s.plekken && typeof s.plekken === 'object') {
      for (var id in s.plekken) {
        var p = s.plekken[id];
        if (p && ROLLEN[p.rol] && /^[a-z]+-\d+$/.test(id)) {
          uit.plekken[id] = { rol: p.rol, naam: schoneNaam(p.naam) || standaardNaam(id), data: p.data || null };
        }
      }
    }
    if (s.rollen && typeof s.rollen === 'object') {
      for (var r in s.rollen) {
        if (ROLLEN[r] && !uit.plekken[r + '-1']) uit.plekken[r + '-1'] = { rol: r, naam: ROLLEN[r] + ' 1', data: s.rollen[r] };
      }
    }
    return uit;
  }

  try { sessie = heleSessie(JSON.parse(fs.readFileSync(HUIDIG, 'utf8'))); } catch (e) {}

  var schrijfTimer = null;
  function bewaarHuidig() {
    clearTimeout(schrijfTimer);
    schrijfTimer = setTimeout(function () {
      fs.writeFile(HUIDIG + '.tmp', JSON.stringify(sessie), function (err) {
        if (!err) fs.rename(HUIDIG + '.tmp', HUIDIG, function () {});
      });
    }, 500);
  }

  function schoneNaam(n) {
    return String(n || '').replace(/[^A-Za-z0-9 _\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  }

  function standaardNaam(id) {
    // Wendy Carlos, Switched-On Bach (1968): de eerste lead speelt B-A-C-H.
    if (id === 'lead-1') return 'SWITCHED-ON';
    var d = id.split('-');
    return (ROLLEN[d[0]] || d[0].toUpperCase()) + ' ' + d[1];
  }

  function lijstVan(map) {
    try {
      return fs.readdirSync(map).filter(function (f) { return /\.json$/.test(f); })
        .map(function (f) { return f.replace(/\.json$/, ''); }).sort();
    } catch (e) { return []; }
  }

  // ---------- plekken ----------

  function plekNummer(id) { return parseInt(id.split('-')[1], 10) || 0; }

  function plekkenVan(rol) {
    return Object.keys(sessie.plekken).filter(function (id) { return sessie.plekken[id].rol === rol; })
      .sort(function (a, b) { return plekNummer(a) - plekNummer(b); });
  }

  // bezet: functie(plekId, apparaat) -> true als een ander toestel die plek nu gebruikt
  function kiesPlek(rol, apparaat, gewenst, nieuw, bezet) {
    if (!ROLLEN[rol]) return null;
    var id = null;
    if (!nieuw && gewenst && sessie.plekken[gewenst] && sessie.plekken[gewenst].rol === rol && !bezet(gewenst, apparaat)) id = gewenst;
    // Bestaat de vertrouwde plek van dit toestel niet in deze sessie, maak hem dan aan onder hetzelfde nummer.
    if (!id && !nieuw && gewenst && !sessie.plekken[gewenst] && new RegExp('^' + rol + '-\\d{1,3}$').test(gewenst)) {
      sessie.plekken[gewenst] = { rol: rol, naam: standaardNaam(gewenst), data: null };
      bewaarHuidig();
      id = gewenst;
    }
    if (!id && !nieuw) {
      var lijst = plekkenVan(rol);
      for (var i = 0; i < lijst.length; i++) if (!bezet(lijst[i], apparaat)) { id = lijst[i]; break; }
    }
    if (!id) {
      var hoogste = 0;
      plekkenVan(rol).forEach(function (p) { hoogste = Math.max(hoogste, plekNummer(p)); });
      id = rol + '-' + (hoogste + 1);
      sessie.plekken[id] = { rol: rol, naam: standaardNaam(id), data: null };
      bewaarHuidig();
    }
    var p = sessie.plekken[id];
    return { plek: id, naam: p.naam, rol: rol, data: p.data };
  }

  function plekData(id, data) {
    var p = sessie.plekken[id];
    if (!p || !data || typeof data !== 'object') return false;
    p.data = data;
    bewaarHuidig();
    return true;
  }

  function plekNaam(id, naam) {
    var p = sessie.plekken[id], n = schoneNaam(naam);
    if (!p || !n) return false;
    p.naam = n;
    bewaarHuidig();
    return true;
  }

  function plekInfo(id) { return sessie.plekken[id] || null; }

  function plekLijst(bezet) {
    return Object.keys(sessie.plekken).map(function (id) {
      var p = sessie.plekken[id];
      return { id: id, rol: p.rol, naam: p.naam, bezet: bezet(id, null) };
    }).sort(function (a, b) { return a.id < b.id ? -1 : 1; });
  }

  // ---------- sessies ----------

  function sessieActie(body, nu) {
    var naam = schoneNaam(body.naam);
    var gevolg = { tempo: null, swing: null, song: null };
    if (body.actie === 'bewaar' && naam) {
      sessie.naam = naam;
      sessie.bpm = nu.bpm;
      sessie.swing = nu.swing;
      sessie.song = nu.song ? { aan: nu.song.aan, keten: nu.song.keten } : null;
      fs.writeFileSync(path.join(SESSIES, naam + '.json'), JSON.stringify(sessie));
      bewaarHuidig();
    } else if (body.actie === 'laad' && naam) {
      try {
        sessie = heleSessie(JSON.parse(fs.readFileSync(path.join(SESSIES, naam + '.json'), 'utf8')));
        sessie.naam = naam;
        laadVersie++;
        gevolg.tempo = sessie.bpm;
        gevolg.swing = sessie.swing;
        gevolg.song = sessie.song || { aan: false, keten: [] };
        bewaarHuidig();
      } catch (e) {}
    } else if (body.actie === 'nieuw') {
      sessie = leegSessie();
      gevolg.song = { aan: false, keten: [] };
      laadVersie++;
      bewaarHuidig();
    } else if (body.actie === 'wis' && naam) {
      try { fs.unlinkSync(path.join(SESSIES, naam + '.json')); } catch (e) {}
    }
    gevolg.antwoord = sessieOverzicht();
    return gevolg;
  }

  function sessieOverzicht() {
    return { naam: sessie.naam, lijst: lijstVan(SESSIES), laadVersie: laadVersie };
  }

  // ---------- klankbibliotheek ----------

  function klankMap(rol) {
    var m = path.join(KLANKEN, rol);
    try { fs.mkdirSync(m, { recursive: true }); } catch (e) {}
    return m;
  }

  function klankLijst(rol) { return ROLLEN[rol] ? lijstVan(klankMap(rol)) : []; }

  function klankLees(rol, naam) {
    naam = schoneNaam(naam);
    if (!ROLLEN[rol] || !naam) return null;
    try { return JSON.parse(fs.readFileSync(path.join(klankMap(rol), naam + '.json'), 'utf8')); } catch (e) { return null; }
  }

  function klankBewaar(rol, naam, klank) {
    naam = schoneNaam(naam);
    if (!ROLLEN[rol] || !naam || !klank || typeof klank !== 'object') return false;
    fs.writeFileSync(path.join(klankMap(rol), naam + '.json'), JSON.stringify(klank));
    return true;
  }

  function klankWis(rol, naam) {
    naam = schoneNaam(naam);
    if (!ROLLEN[rol] || !naam) return;
    try { fs.unlinkSync(path.join(klankMap(rol), naam + '.json')); } catch (e) {}
  }

  // ---------- uitwisselen ----------

  function klankVan(data) { return data && data.params ? { params: data.params } : null; }

  // Geeft { bestandsnaam, inhoud } of null.
  function exporteer(soort, plek, nu) {
    var kop = { himmelsgristle: FORMAAT, soort: soort };
    if (soort === 'sessie') {
      kop.naam = sessie.naam || 'sessie';
      kop.bpm = nu.bpm;
      kop.swing = nu.swing;
      kop.song = nu.song ? { aan: nu.song.aan, keten: nu.song.keten } : null;
      kop.plekken = {};
      for (var id in sessie.plekken) kop.plekken[id] = sessie.plekken[id];
    } else {
      var p = sessie.plekken[plek];
      if (!p || !p.data) return null;
      kop.rol = p.rol;
      kop.naam = p.naam;
      if (soort === 'instrument') kop.data = p.data;
      else if (soort === 'klank') kop.klank = klankVan(p.data);
      else return null;
    }
    var engels = { sessie: 'session', instrument: 'instrument', klank: 'sound' };
    var bestand = 'himmelsgristle-' + engels[soort] + '-' + (schoneNaam(kop.naam) || soort).replace(/ /g, '-').toLowerCase() + '.json';
    return { bestandsnaam: bestand, inhoud: JSON.stringify(kop, null, 1) };
  }

  // Leest een uitwisselbestand. plek = de plek van het toestel dat importeert.
  function importeer(b, plek) {
    if (!b || typeof b !== 'object' || !b.himmelsgristle) return { fout: 'This is not a Himmelsgristle file.' };
    if (b.himmelsgristle > FORMAAT) return { fout: 'This file comes from a newer version. Update first.' };
    if (b.soort === 'sessie') {
      var naam = schoneNaam(b.naam) || 'import';
      sessie = heleSessie(b);
      sessie.naam = naam;
      fs.writeFileSync(path.join(SESSIES, naam + '.json'), JSON.stringify(sessie));
      laadVersie++;
      bewaarHuidig();
      return { soort: 'sessie', naam: naam, tempo: sessie.bpm, swing: sessie.swing, song: sessie.song || { aan: false, keten: [] } };
    }
    if (!ROLLEN[b.rol]) return { fout: 'Unknown role in this file.' };
    if (b.soort === 'klank') {
      if (!b.klank) return { fout: 'There is no sound in this file.' };
      var kn = schoneNaam(b.naam) || 'import';
      klankBewaar(b.rol, kn, b.klank);
      return { soort: 'klank', rol: b.rol, naam: kn, klank: b.klank };
    }
    if (b.soort === 'instrument') {
      var p = sessie.plekken[plek];
      if (!p) return { fout: 'Choose a role on this device first.' };
      if (p.rol !== b.rol) return { fout: 'This is a ' + ROLLEN[b.rol] + ' file, but this device plays ' + ROLLEN[p.rol] + '.' };
      p.data = b.data;
      // Alleen een standaardnaam (zoals BAS 1) maakt plaats voor de naam uit het bestand.
      if (b.naam && p.naam === standaardNaam(plek)) p.naam = schoneNaam(b.naam) || p.naam;
      bewaarHuidig();
      return { soort: 'instrument', rol: b.rol, naam: p.naam };
    }
    return { fout: 'Unknown kind of file.' };
  }

  return {
    kiesPlek: kiesPlek,
    plekData: plekData,
    plekNaam: plekNaam,
    plekInfo: plekInfo,
    plekLijst: plekLijst,
    sessieActie: sessieActie,
    sessieOverzicht: sessieOverzicht,
    klankLijst: klankLijst,
    klankLees: klankLees,
    klankBewaar: klankBewaar,
    klankWis: klankWis,
    exporteer: exporteer,
    importeer: importeer,
    laadVersie: function () { return laadVersie; },
    sessieNaam: function () { return sessie.naam; }
  };
};
