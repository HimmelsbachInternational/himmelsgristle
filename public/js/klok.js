// Himmelsgristle: de klok.
// Zet onze klok gelijk met de Masterblaster, haalt tempo en start/stop op,
// en plant elke zestiende noot precies op tijd in op de audioklok van dit toestel.

(function (HG) {
  'use strict';

  var klok = {
    verschil: null,   // servertijd min onze tijd, in ms
    rondreis: 0,
    verbonden: false,
    st: null,         // laatste toestand van de Masterblaster
    luisteraars: []
  };
  HG.klok = klok;

  // ---------- klok gelijkzetten ----------
  // Elke ping geeft een schatting van het verschil. De ping met de kortste rondreis is het betrouwbaarst.

  var monsters = [];

  function ping(daarna) {
    var t0 = HG.nu();
    HG.vraag('GET', '/api/time?' + Math.random(), null, function (tekst) {
      var t1 = HG.nu();
      monsters.push({ verschil: parseFloat(tekst) - (t0 + t1) / 2, rtt: t1 - t0 });
      if (monsters.length > 24) monsters.shift();
      var beste = monsters[0];
      for (var i = 1; i < monsters.length; i++) if (monsters[i].rtt < beste.rtt) beste = monsters[i];
      klok.verschil = beste.verschil;
      klok.rondreis = beste.rtt;
      klok.verbonden = true;
      if (daarna) daarna();
    }, function () {
      klok.verbonden = false;
      if (daarna) daarna();
    });
  }

  klok.serverNu = function () { return HG.nu() + klok.verschil; };

  // ---------- tijd en tel ----------

  klok.beatTijd = function (n) {
    var s = klok.st;
    if (s.prev && n < s.anchorBeat) return s.prev.anchorTime + (n - s.prev.anchorBeat) * 60000 / s.prev.bpm;
    return s.anchorTime + (n - s.anchorBeat) * 60000 / s.bpm;
  };

  klok.beatOp = function (t) {
    var s = klok.st;
    if (s.prev && t < s.anchorTime) return s.prev.anchorBeat + (t - s.prev.anchorTime) / (60000 / s.prev.bpm);
    return s.anchorBeat + (t - s.anchorTime) / (60000 / s.bpm);
  };

  // ---------- toestand ----------

  function nieuweToestand(s) {
    var oud = klok.st;
    klok.st = s;
    if (oud && s.running && oud.running && oud.version !== s.version) planner.herijk();
    if (!s.running) planner.reset();
    for (var i = 0; i < klok.luisteraars.length; i++) klok.luisteraars[i](s, oud);
  }

  function haalToestand() {
    HG.vraag('GET', '/api/state?' + Math.random(), null, function (t) {
      try { nieuweToestand(JSON.parse(t)); } catch (e) {}
    });
  }

  klok.stuur = function (actie) {
    HG.vraag('POST', '/api/state', actie, function (t) {
      try { nieuweToestand(JSON.parse(t)); } catch (e) {}
    });
  };

  klok.opToestand = function (fn) { klok.luisteraars.push(fn); };

  klok.start = function () {
    var n = 0;
    (function reeks() {
      n++;
      ping(function () { if (n < 10) setTimeout(reeks, 60); });
    })();
    setInterval(function () { ping(); }, 1000);
    haalToestand();
    setInterval(haalToestand, 400);
  };

  // ---------- geluid ----------

  var audio = { ctx: null, uit: null, perfBijNul: null, metUitvoer: false };
  HG.audio = audio;

  audio.maak = function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    var ctx = new AC();
    audio.ctx = ctx;
    if (!ctx.createGain && ctx.createGainNode) ctx.createGain = ctx.createGainNode;
    if (!ctx.createDelay && ctx.createDelayNode) ctx.createDelay = ctx.createDelayNode;

    // Een lichte compressor maakt telefoonspeakers en koptelefoonuitgang wat steviger.
    var hoofd = ctx.createGain();
    hoofd.gain.value = 0.8;
    if (ctx.createDynamicsCompressor) {
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.12;
      hoofd.connect(comp);
      comp.connect(ctx.destination);
    } else {
      hoofd.connect(ctx.destination);
    }
    audio.uit = hoofd;

    // Een stille noot ontgrendelt het geluid op telefoons die dat na een tik vereisen.
    var b = ctx.createBuffer(1, 1, 22050);
    var s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination);
    if (s.start) s.start(0); else s.noteOn(0);
    if (ctx.resume) ctx.resume();
    return true;
  };

  // Koppelt de audioklok aan onze gewone klok. Waar de browser het kan, inclusief de vertraging naar de luidspreker.
  audio.ijk = function () {
    var ctx = audio.ctx, schatting, metUitvoer = false;
    if (ctx.getOutputTimestamp) {
      var ts = ctx.getOutputTimestamp();
      if (ts && ts.performanceTime > 0) { schatting = ts.performanceTime - ts.contextTime * 1000; metUitvoer = true; }
    }
    if (schatting === undefined) schatting = HG.nu() - ctx.currentTime * 1000;
    audio.metUitvoer = metUitvoer;
    if (audio.perfBijNul === null || Math.abs(schatting - audio.perfBijNul) > 40) audio.perfBijNul = schatting;
    else audio.perfBijNul = audio.perfBijNul * 0.9 + schatting * 0.1;
  };

  // Op welk moment (in onze klok, ms) is een klank die op audiotijd w staat echt te horen?
  audio.hoorMoment = function (w) {
    var extra = 0;
    if (!audio.metUitvoer) extra = ((audio.ctx.outputLatency || audio.ctx.baseLatency || 0) * 1000);
    return audio.perfBijNul + w * 1000 + extra;
  };

  // Voer iets uit in beeld op het moment dat het geluid te horen is.
  audio.opHetGeluid = function (w, fn) {
    setTimeout(fn, Math.max(0, audio.hoorMoment(w) - HG.nu()));
  };

  // ---------- de planner: kijkt steeds vooruit en zet zestienden klaar ----------

  var VOORUIT = 0.15;
  var planner = { volgende: null, laatsteServer: null, compensatie: parseFloat(HG.haal('lat')) || 0, opStap: null };
  HG.planner = planner;

  planner.reset = function () { planner.volgende = null; planner.laatsteServer = null; };

  // Na een tempowissel: verder bij de eerste zestiende na wat al is ingepland.
  planner.herijk = function () {
    if (planner.laatsteServer === null) return;
    planner.volgende = Math.floor(klok.beatOp(planner.laatsteServer) * 4 + 0.001) + 1;
  };

  function stapTijd(n) { return klok.beatTijd(n / 4); }

  planner.tik = function () {
    var ctx = audio.ctx, s = klok.st;
    if (!ctx || !s || klok.verschil === null) return;
    audio.ijk();
    if (!s.running) { planner.reset(); return; }

    if (planner.volgende === null) planner.volgende = Math.ceil(klok.beatOp(klok.serverNu()) * 4);
    if (!s.prev && planner.volgende < s.anchorBeat * 4) planner.volgende = s.anchorBeat * 4;

    var grens = ctx.currentTime + VOORUIT;
    for (var veilig = 0; veilig < 32; veilig++) {
      var sTijd = stapTijd(planner.volgende);
      var wanneer = (sTijd - klok.verschil - audio.perfBijNul - planner.compensatie) / 1000;
      if (!audio.metUitvoer) wanneer -= (ctx.outputLatency || ctx.baseLatency || 0);
      // Swing: elke tweede zestiende schuift een stukje op.
      if (s.swing && planner.volgende % 2 !== 0) wanneer += s.swing * 0.5 * (15 / s.bpm);
      if (wanneer > grens) break;
      if (wanneer > ctx.currentTime && planner.opStap) {
        var stap = ((planner.volgende % 16) + 16) % 16;
        planner.opStap(stap, wanneer, planner.volgende);
      }
      planner.laatsteServer = sTijd;
      planner.volgende++;
    }
  };

  planner.zetCompensatie = function (v) {
    planner.compensatie = Math.max(-300, Math.min(500, v));
    HG.bewaar('lat', String(planner.compensatie));
  };

  planner.start = function () { setInterval(planner.tik, 25); };

})(window.HG);
