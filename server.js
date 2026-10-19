// Himmelsgristle: de Masterblaster
// Een klein servertje zonder extra pakketten. Draait in Termux met: node server.js
// Het serveert de pagina, geeft de tijd door en houdt tempo en start/stop bij.

var http = require('http');
var fs = require('fs');
var path = require('path');
var os = require('os');
var perf = require('perf_hooks').performance;

var VERSIE = '0.3';
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
    prev: state.prev,
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
  req.on('data', function (c) { data += c; if (data.length > 10000) req.destroy(); });
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
  if (full.indexOf(PUBLIC) !== 0) return send(res, 403, 'text/plain', 'nee');
  fs.readFile(full, function (err, buf) {
    if (err) return send(res, 404, 'text/plain', 'niet gevonden');
    send(res, 200, TYPES[path.extname(full)] || 'application/octet-stream', buf);
  });
});

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.log('');
    console.log('  De server draait al (poort ' + PORT + ' is bezet).');
    console.log('  Open gewoon http://localhost:' + PORT + ' in Chrome.');
    console.log('');
    process.exit(0);
  }
  throw e;
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('');
  console.log('  HIMMELSGRISTLE ' + VERSIE + '  Masterblaster draait');
  console.log('');
  console.log('  Open op deze telefoon in Chrome:   http://localhost:' + PORT);
  console.log('  Daar staan het spelersadres en de QR-code.');
  var a = info();
  if (a.alle.length) {
    console.log('');
    console.log('  Voor de spelers, waarschijnlijk:  ' + a.beste);
    if (a.alle.length > 1) console.log('  Andere adressen: ' + a.alle.slice(1).join('  '));
  }
  console.log('');
  console.log('  Stoppen: volume-omlaag + C');
  console.log('');
});
