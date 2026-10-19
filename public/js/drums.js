// Himmelsgristle: drumstemmen.
// Alles wordt live gesynthetiseerd, zonder samples. Elke stem heeft een paar knoppen (0 tot 1).

(function (HG) {
  'use strict';

  var ruis = null;

  function ruisBuffer(ctx) {
    if (ruis) return ruis;
    var n = Math.floor(ctx.sampleRate * 1);
    ruis = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = ruis.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return ruis;
  }

  function begin(bron, t) { if (bron.start) bron.start(t); else bron.noteOn(t); }
  function einde(bron, t) { if (bron.stop) bron.stop(t); else bron.noteOff(t); }

  function ruisBron(ctx, t, duur) {
    var b = ctx.createBufferSource();
    b.buffer = ruisBuffer(ctx);
    b.loop = true;
    begin(b, t);
    einde(b, t + duur);
    return b;
  }

  function osc(ctx, type, f, t, duur) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    begin(o, t);
    einde(o, t + duur);
    return o;
  }

  function filter(ctx, type, f, q) {
    var b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    if (q !== undefined) b.Q.value = q;
    return b;
  }

  // Exponentiële envelope: snel op, dan uitsterven.
  function env(ctx, t, piek, aan, af) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, piek), t + aan);
    g.gain.exponentialRampToValueAtTime(0.0001, t + aan + af);
    return g;
  }

  var stemmen = [
    {
      id: 'kick', naam: 'KICK',
      knoppen: [['toon', 'Toon', 0.35], ['val', 'Val', 0.5], ['decay', 'Decay', 0.35], ['klik', 'Klik', 0.3], ['vuil', 'Vuil', 0.3], ['vol', 'Volume', 0.9]],
      speel: function (ctx, uit, t, a, p) {
        var f0 = 35 + p.toon * 90;
        var sweep = 0.025 + p.val * 0.12;
        var dec = 0.08 + p.decay * 1.3;
        var o = osc(ctx, 'sine', f0 * (1 + p.val * 7), t, dec + 0.05);
        o.frequency.exponentialRampToValueAtTime(f0, t + sweep);
        var g = env(ctx, t, a * p.vol, 0.002, dec);
        o.connect(g); g.connect(uit);
        if (p.klik > 0.02) {
          var r = ruisBron(ctx, t, 0.03);
          var hp = filter(ctx, 'highpass', 1500);
          var gk = env(ctx, t, a * p.vol * p.klik * 0.7, 0.001, 0.012);
          r.connect(hp); hp.connect(gk); gk.connect(uit);
        }
      }
    },
    {
      id: 'snare', naam: 'SNARE',
      knoppen: [['toon', 'Toon', 0.4], ['mix', 'Toon / ruis', 0.6], ['decay', 'Decay', 0.35], ['snap', 'Snap', 0.5], ['vuil', 'Vuil', 0.25], ['vol', 'Volume', 0.8]],
      speel: function (ctx, uit, t, a, p) {
        var f = 120 + p.toon * 280;
        var dec = 0.06 + p.decay * 0.5;
        var o = osc(ctx, 'triangle', f * 1.6, t, dec + 0.05);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
        var go = env(ctx, t, a * p.vol * (1 - p.mix) * 0.9 + 0.0002, 0.001, dec * 0.6);
        o.connect(go); go.connect(uit);
        var r = ruisBron(ctx, t, dec + 0.05);
        var hp = filter(ctx, 'highpass', 700 + p.snap * 4000);
        var gr = env(ctx, t, a * p.vol * p.mix + 0.0002, 0.001, dec);
        r.connect(hp); hp.connect(gr); gr.connect(uit);
      }
    },
    {
      id: 'hat', naam: 'HIHAT',
      knoppen: [['decay', 'Decay', 0.3], ['kleur', 'Kleur', 0.5], ['open', 'Open', 0], ['ruw', 'Ruw', 0.3], ['vuil', 'Vuil', 0.15], ['vol', 'Volume', 0.6]],
      speel: function (ctx, uit, t, a, p) {
        var dec = (0.02 + p.decay * 0.15) * (1 + p.open * 6);
        var hp = filter(ctx, 'highpass', 4000 + p.kleur * 6000);
        var g = env(ctx, t, a * p.vol * 0.7, 0.001, dec);
        hp.connect(g); g.connect(uit);
        var gr = ctx.createGain(); gr.gain.value = 1 - p.ruw;
        var r = ruisBron(ctx, t, dec + 0.05);
        r.connect(gr); gr.connect(hp);
        if (p.ruw > 0.02) {
          // Een cluster van blokgolven, zoals de metalige hats van oude drumcomputers.
          var gm = ctx.createGain(); gm.gain.value = p.ruw * 0.35;
          gm.connect(hp);
          var fs = [205.3, 304.4, 369.6, 522.7, 540, 800];
          var schaal = 1 + p.kleur * 1.5;
          for (var i = 0; i < fs.length; i++) osc(ctx, 'square', fs[i] * schaal, t, dec + 0.05).connect(gm);
        }
      }
    },
    {
      id: 'clap', naam: 'CLAP',
      knoppen: [['spreiding', 'Spreiding', 0.4], ['decay', 'Decay', 0.3], ['kleur', 'Kleur', 0.4], ['aantal', 'Klappen', 0.5], ['vuil', 'Vuil', 0.3], ['vol', 'Volume', 0.7]],
      speel: function (ctx, uit, t, a, p) {
        var n = 2 + Math.round(p.aantal * 3);
        var gat = 0.006 + p.spreiding * 0.02;
        var dec = 0.05 + p.decay * 0.5;
        var piek = a * p.vol;
        var r = ruisBron(ctx, t, n * gat + dec + 0.05);
        var bp = filter(ctx, 'bandpass', 800 + p.kleur * 2500, 1.4);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        for (var i = 0; i < n - 1; i++) {
          var ti = t + i * gat;
          g.gain.setValueAtTime(piek, ti);
          g.gain.exponentialRampToValueAtTime(piek * 0.05, ti + gat * 0.9);
        }
        var tl = t + (n - 1) * gat;
        g.gain.setValueAtTime(piek, tl);
        g.gain.exponentialRampToValueAtTime(0.0001, tl + dec);
        r.connect(bp); bp.connect(g); g.connect(uit);
      }
    },
    {
      id: 'metaal', naam: 'METAAL',
      knoppen: [['toon', 'Toon', 0.3], ['ring', 'Ringmod', 0.6], ['decay', 'Decay', 0.3], ['galm', 'Galm', 0.5], ['vuil', 'Vuil', 0.35], ['vol', 'Volume', 0.5]],
      speel: function (ctx, uit, t, a, p) {
        var f = 150 + p.toon * 1200;
        var dec = 0.05 + p.decay * 1.2;
        var duur = dec + 0.05;
        var g = env(ctx, t, a * p.vol * 0.45, 0.001, dec);
        var drager = osc(ctx, 'square', f, t, duur);
        var droog = ctx.createGain(); droog.gain.value = 1 - p.ring;
        drager.connect(droog); droog.connect(g);
        if (p.ring > 0.02) {
          // Ringmodulatie: de drager gaat door een versterker die door een tweede toon open en dicht gaat.
          var rm = ctx.createGain(); rm.gain.value = 0;
          var mod = osc(ctx, 'square', f * (1.41 + p.ring * 2.3), t, duur);
          mod.connect(rm.gain);
          drager.connect(rm);
          var natGain = ctx.createGain(); natGain.gain.value = p.ring;
          rm.connect(natGain); natGain.connect(g);
        }
        var bp = filter(ctx, 'bandpass', f * 2, 0.8);
        g.connect(bp); bp.connect(uit);
        if (p.galm > 0.02 && ctx.createDelay) {
          // Een korte, teruggekoppelde vertraging: de klank van een stalen buis.
          var d = ctx.createDelay(0.1);
          d.delayTime.value = 0.011 + (1 - p.toon) * 0.025;
          var fb = ctx.createGain(); fb.gain.value = p.galm * 0.85;
          var nat = ctx.createGain(); nat.gain.value = p.galm * 0.8;
          bp.connect(d); d.connect(fb); fb.connect(d); d.connect(nat); nat.connect(uit);
        }
      }
    }
  ];

  HG.drums = {
    stemmen: stemmen,
    standaardParams: function () {
      var p = {};
      for (var i = 0; i < stemmen.length; i++) {
        var s = stemmen[i], k = {};
        for (var j = 0; j < s.knoppen.length; j++) k[s.knoppen[j][0]] = s.knoppen[j][2];
        p[s.id] = k;
      }
      return p;
    },
    // Een electroclash-beginnetje: vier op de vloer, clap op twee en vier, hats ertussen.
    standaardPatroon: function () {
      function rij(stappen) {
        var r = []; for (var i = 0; i < 16; i++) r.push(0);
        for (var k in stappen) r[k] = stappen[k];
        return r;
      }
      return {
        kick: rij({ 0: 2, 4: 1, 8: 2, 12: 1 }),
        snare: rij({}),
        hat: rij({ 2: 1, 6: 1, 10: 1, 14: 2 }),
        clap: rij({ 4: 1, 12: 2 }),
        metaal: rij({ 7: 1, 15: 1 })
      };
    },
    speel: function (id, t, accent, params) {
      var ctx = HG.audio.ctx;
      var uit = HG.vuil(params.vuil, HG.audio.uit);
      for (var i = 0; i < stemmen.length; i++) {
        if (stemmen[i].id === id) { stemmen[i].speel(ctx, uit, t, accent ? 1 : 0.6, params); return; }
      }
    }
  };

})(window.HG);
