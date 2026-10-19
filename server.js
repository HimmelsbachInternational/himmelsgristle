// Himmelsgristle: de Masterblaster
// Een klein servertje zonder extra pakketten. Draait in Termux met: node server.js
// Het serveert de pagina, geeft de tijd door en houdt tempo en start/stop bij.

var http = require('http');
var fs = require('fs');
var path = require('path');
var os = require('os');
var perf = require('perf_hooks').performance;

var VERSIE = '0.7';
var PORT = parseInt(process.env.PORT, 10) || 8080;
var PUBLIC = path.join(__dirname, 'public');

// Eén gedeelde klok in milliseconden. Monotoon, dus niet gevoelig voor het verzetten van de systeemklok.
function now() { return perf.now(); }

// De toestand van de sessie. Tel op tijd t = anchorBeat + (t - anchorTime) / beatMs
var state = {
  version: 1,
  running: false,
  bpm: 120,
  anchorTime: 0,
  anchorBeat: 0,
  beatsPerBar: 4,
  swing: 0,
  song: { aan: false, keten: [], startMaat: 0 },
  prev: null
};

var players = {}; // id -> { name, role, latency, seen }

function beatMs(bpm) { return 60000 / bpm; }

function beatAt(t) {
  return state.anchorBeat + (t - state.anchorTime) / beatMs(state.bpm);
}

// Een wijziging gaat in op de eerste maatgrens die minstens LEAD ms in de toekomst ligt,
// zodat alle spelers hem op tijd binnen hebben.
var LEAD = 1200;

function nextBarAfter(t) {
  var b = beatAt(t);
  var bar = Math.ceil(b / state.beatsPerBar) * state.beatsPerBar;
  var time = state.anchorTime + (bar - state.anchorBeat) * beatMs(state.bpm);
  return { beat: bar, time: time };
}

function applyChange(body) {
  var t = now();
  if (body.action === 'start' && !state.running) {
    state.running = true;
    state.anchorTime = t + LEAD;
    state.anchorBeat = 0;
    state.prev = null;
    state.song.startMaat = 0;
  } else if (body.action === 'stop') {
    state.running = false;
  } else if (body.action === 'tempo') {
    var bpm = Math.max(40, Math.min(240, Math.round(Number(body.bpm) * 10) / 10));
    if (!bpm || bpm === state.bpm) return;
    if (state.running && state.anchorTime > t + LEAD) {
      // Er staat al een wijziging klaar die nog moet ingaan: alleen het nieuwe tempo aanpassen.
    } else if (state.running) {
      // Het oude stuk blijft geldig tot de maatgrens, zodat spelers niet terugrekenen met het nieuwe tempo.
      var nb = nextBarAfter(t + LEAD);
      state.prev = { anchorTime: state.anchorTime, anchorBeat: state.anchorBeat, bpm: state.bpm };
      state.anchorBeat = nb.beat;
      state.anchorTime = nb.time;
    }
    state.bpm = bpm;
  } else if (body.action === 'song') {
    // Een keten van patronen (0 = A ... 3 = D), elke schakel duurt een maat.
    var keten = [];
    if (body.keten && body.keten.length) {
      for (var k = 0; k < body.keten.length && k < 64; k++) {
        var w = Math.round(Number(body.keten[k]));
        if (w >= 0 && w <= 3) keten.push(w);
      }
    }
    var wasAan = state.song.aan;
    state.song.keten = keten;
    state.song.aan = !!body.aan && keten.length > 0;
    // Aanzetten (of opnieuw beginnen) gaat in op de eerstvolgende maat waar alle spelers het nog op tijd horen.
    // Een keten aanpassen terwijl hij loopt laat de telling doorlopen.
    if (state.song.aan && (!wasAan || body.herstart)) {
      state.song.startMaat = state.running ? nextBarAfter(t + LEAD).beat / state.beatsPerBar : 0;
    }
  } else if (body.action === 'swing') {
    var sw = Math.round(Math.max(0, Math.min(0.6, Number(body.swing) || 0)) * 100) / 100;
    if (sw === state.swing) return;
    state.swing = sw;
  } else {
    return;
  }
  state.version++;
}

function publicState() {
  var list = [];
  var t = now();
  for (var id in players) {
    if (t - players[id].seen < 5000) list.push(players[id]);
    else delete players[id];
  }
  return {
    version: state.version,
    running: state.running,
    bpm: state.bpm,
    anchorTime: state.anchorTime,
    anchorBeat: state.anchorBeat,
    beatsPerBar: state.beatsPerBar,
    swing: state.swing,
    song: state.song,
    prev: state.prev,
    laadVersie: opslag.laadVersie(),
    sessieNaam: opslag.sessieNaam(),
    serverTime: t,
    players: list
  };
}

// ---------- adressen voor de spelers ----------

// Het adres waarop een speler ons echt bereikte. Dat is altijd het goede.
var bevestigd = null;

function isLokaal(a) { return !a || a === '127.0.0.1' || a === '::1' || a.indexOf('127.') === 0; }
function schoon(a) { return a ? String(a).replace(/^::ffff:/, '') : a; }

// Privé-adressen eerst, en dan de bekende hotspot-namen.
function adressen() {
  var lijst = [];
  var nets = {};
  try { nets = os.networkInterfaces(); } catch (e) { nets = {}; }
  Object.keys(nets).forEach(function (naam) {
    (nets[naam] || []).forEach(function (n) {
      if (n.family !== 'IPv4' && n.family !== 4) return;
      if (n.internal) return;
      var score = 0;
      if (/^192\.168\./.test(n.address)) score += 3;
      else if (/^10\./.test(n.address)) score += 2;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(n.address)) score += 2;
      if (/ap|swlan|wlan1|softap|tether/i.test(naam)) score += 2;
      if (/rmnet|ccmni|dummy|tun/i.test(naam)) score -= 5;
      lijst.push({ adres: n.address, naam: naam, score: score });
    });
  });
  lijst.sort(function (a, b) { return b.score - a.score; });
  return lijst;
}

function info() {
  var lijst = adressen();
  var beste = bevestigd || (lijst.length ? lijst[0].adres : null);
  return {
    versie: VERSIE,
    port: PORT,
    bevestigd: bevestigd,
    beste: beste ? 'http://' + beste + ':' + PORT : null,
    alle: lijst.map(function (a) { return 'http://' + a.adres + ':' + PORT; })
  };
}

// ---------- opslag ----------

var opslag = require('./lib/opslag')(__dirname);

// Welke plek een ander toestel nu gebruikt (toestellen die de laatste 5 seconden iets lieten horen).
function bezet(plekId, apparaat) {
  var t = now();
  for (var id in players) {
    if (id !== apparaat && players[id].plek === plekId && t - players[id].seen < 5000) return true;
  }
  return false;
}

function zetSong(song) {
  if (song && song.keten) applyChange({ action: 'song', keten: song.keten, aan: song.aan });
}

function zetSwing(sw) {
  if (typeof sw === 'number') applyChange({ action: 'swing', swing: sw });
}

function zetTempo(bpm) {
  if (typeof bpm !== 'number' || !bpm) return;
  if (state.running) applyChange({ action: 'tempo', bpm: bpm });
  else { state.bpm = Math.max(40, Math.min(240, bpm)); state.version++; }
}

// ---------- http ----------

var TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function send(res, code, type, body) {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function sendJSON(res, obj) { send(res, 200, 'application/json', JSON.stringify(obj)); }

function readBody(req, cb) {
  var data = '';
  req.on('data', function (c) { data += c; if (data.length > 200000) req.destroy(); });
  req.on('end', function () {
    try { cb(JSON.parse(data || '{}')); } catch (e) { cb({}); }
  });
}

var server = http.createServer(function (req, res) {
  var url = req.url.split('?')[0];

  // Komt iemand van buitenaf binnen, dan weten we zeker welk adres werkt.
  var lokaal = schoon(req.socket.localAddress);
  if (!isLokaal(lokaal) && !isLokaal(schoon(req.socket.remoteAddress))) bevestigd = lokaal;

  if (url === '/api/time') {
    // Zo snel mogelijk antwoorden: hoe korter, hoe nauwkeuriger de klokschatting.
    return send(res, 200, 'text/plain', String(now()));
  }

  if (url === '/api/state' && req.method === 'GET') {
    return sendJSON(res, publicState());
  }

  if (url === '/api/state' && req.method === 'POST') {
    return readBody(req, function (body) { applyChange(body); sendJSON(res, publicState()); });
  }

  var vraag = {};
  (req.url.split('?')[1] || '').split('&').forEach(function (kv) {
    var d = kv.split('=');
    if (d[0]) { try { vraag[d[0]] = decodeURIComponent((d[1] || '').replace(/\+/g, ' ')); } catch (e) {} }
  });

  if (url === '/api/plek' && req.method === 'POST') {
    return readBody(req, function (body) {
      var apparaat = String(body.apparaat || '').slice(0, 40);
      var uit = opslag.kiesPlek(String(body.rol || ''), apparaat, String(body.plek || ''), !!body.nieuw, bezet);
      if (uit && apparaat) {
        if (!players[apparaat]) players[apparaat] = { id: apparaat, name: '', role: uit.rol, latency: 0, rtt: 0 };
        players[apparaat].plek = uit.plek;
        players[apparaat].seen = now();
      }
      sendJSON(res, uit || { fout: 'unknown role' });
    });
  }

  if (url === '/api/plek/data' && req.method === 'POST') {
    return readBody(req, function (body) { sendJSON(res, { ok: opslag.plekData(String(body.plek || ''), body.data) }); });
  }

  if (url === '/api/plek/naam' && req.method === 'POST') {
    return readBody(req, function (body) { sendJSON(res, { ok: opslag.plekNaam(String(body.plek || ''), body.naam) }); });
  }

  if (url === '/api/plekken') {
    return sendJSON(res, { plekken: opslag.plekLijst(bezet) });
  }

  if (url === '/api/sessies') {
    if (req.method === 'POST') {
      return readBody(req, function (body) {
        var g = opslag.sessieActie(body, { bpm: state.bpm, swing: state.swing, song: state.song });
        if (g.tempo) zetTempo(g.tempo);
        zetSwing(g.swing);
        zetSong(g.song);
        sendJSON(res, g.antwoord);
      });
    }
    return sendJSON(res, opslag.sessieOverzicht());
  }

  if (url === '/api/klanken') {
    if (req.method === 'POST') {
      return readBody(req, function (body) {
        var rol = String(body.rol || '');
        if (body.actie === 'bewaar') opslag.klankBewaar(rol, body.naam, body.klank);
        if (body.actie === 'wis') opslag.klankWis(rol, body.naam);
        sendJSON(res, { lijst: opslag.klankLijst(rol) });
      });
    }
    if (vraag.naam) return sendJSON(res, { klank: opslag.klankLees(vraag.rol, vraag.naam) });
    return sendJSON(res, { lijst: opslag.klankLijst(vraag.rol) });
  }

  if (url === '/api/export') {
    var ex = opslag.exporteer(vraag.soort, vraag.plek, { bpm: state.bpm, swing: state.swing, song: state.song });
    if (!ex) return send(res, 404, 'text/plain', 'nothing to export');
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="' + ex.bestandsnaam + '"',
      'Cache-Control': 'no-store'
    });
    return res.end(ex.inhoud);
  }

  if (url === '/api/import' && req.method === 'POST') {
    return readBody(req, function (body) {
      var uit = opslag.importeer(body.bestand, String(body.plek || ''));
      if (uit.tempo) zetTempo(uit.tempo);
      zetSwing(uit.swing);
      zetSong(uit.song);
      sendJSON(res, uit);
    });
  }

  if (url === '/api/info') {
    return sendJSON(res, info());
  }

  if (url === '/api/hello' && req.method === 'POST') {
    return readBody(req, function (body) {
      var id = String(body.id || '').slice(0, 40);
      if (id) {
        players[id] = {
          id: id,
          name: String(body.name || 'speler').slice(0, 30),
          role: String(body.role || '').slice(0, 20),
          plek: String(body.plek || '').slice(0, 20),
          plekNaam: String(body.plekNaam || '').slice(0, 40),
          latency: Number(body.latency) || 0,
          rtt: Math.round((Number(body.rtt) || 0) * 10) / 10,
          seen: now()
        };
      }
      sendJSON(res, { ok: true });
    });
  }

  // Statische bestanden uit public/
  var file = url === '/' ? '/index.html' : url;
  var full = path.normalize(path.join(PUBLIC, file));
  if (full.indexOf(PUBLIC) !== 0) return send(res, 403, 'text/plain', 'no');
  fs.readFile(full, function (err, buf) {
    if (err) return send(res, 404, 'text/plain', 'not found');
    send(res, 200, TYPES[path.extname(full)] || 'application/octet-stream', buf);
  });
});

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.log('');
    console.log('  The server is already running (port ' + PORT + ' is taken).');
    console.log('  Just open http://localhost:' + PORT + ' in Chrome.');
    console.log('');
    process.exit(0);
  }
  throw e;
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('');
  console.log('  HIMMELSGRISTLE ' + VERSIE + '  Masterblaster running');
  console.log('');
  console.log('  Open on this phone in Chrome:   http://localhost:' + PORT);
  console.log('  The player address and QR code are there.');
  var a = info();
  if (a.alle.length) {
    console.log('');
    console.log('  For the players, probably:      ' + a.beste);
    if (a.alle.length > 1) console.log('  Other addresses: ' + a.alle.slice(1).join('  '));
  }
  console.log('');
  console.log('  Stop: volume down + C');
  console.log('');
});
