// Himmelsgristle: monofone synths (bas en lead).
// Eén stem die blijft draaien: oscillator(s), resonant filter, vuil en een versterker.
// Noten worden ingepland door toonhoogte, filter en volume op het juiste moment te veranderen,
// zodat glijden tussen noten vanzelf gaat.

(function (HG) {
  'use strict';

  // Patroonwaarde per stap: -1 = stil, anders halve tonen boven de grondtoon; +100 = accent.

  function maakMono(def) {
    var stem = null;
    var vorigeAan = false;

    function maakStem() {
      var ctx = HG.audio.ctx;
      var s = { oscs: [], laatsteVuil: -1, laatsteGolf: -1 };
      var menger = ctx.createGain();
      menger.gain.value = def.twee ? 0.6 : 1;
      var aantal = def.twee ? 2 : 1;
      for (var i = 0; i < aantal; i++) {
        var o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = HG.freq(def.grond);
        o.connect(menger);
        if (o.start) o.start(0); else o.noteOn(0);
        s.oscs.push(o);
      }
      if (def.vibrato && s.oscs[0].detune) {
        var lfo = ctx.createOscillator();
        lfo.frequency.value = 5.6;
        var diepte = ctx.createGain();
        diepte.gain.value = 0;
        lfo.connect(diepte);
        for (var j = 0; j < s.oscs.length; j++) diepte.connect(s.oscs[j].detune);
        if (lfo.start) lfo.start(0); else lfo.noteOn(0);
        s.vibDiepte = diepte;
      }
      s.filt = ctx.createBiquadFilter();
      s.filt.type = 'lowpass';
      s.filt.frequency.value = 400;
      s.voor = ctx.createGain();
      s.vorm = ctx.createWaveShaper ? ctx.createWaveShaper() : null;
      s.amp = ctx.createGain();
      s.amp.gain.value = 0;
      menger.connect(s.filt);
      s.filt.connect(s.voor);
      if (s.vorm) { s.voor.connect(s.vorm); s.vorm.connect(s.amp); } else { s.voor.connect(s.amp); }
      s.amp.connect(HG.audio.uit);
      stem = s;
    }

    // Klankinstellingen die direct mogen veranderen (niet op een bepaald moment).
    function stelIn(p) {
      if (p.golf !== stem.laatsteGolf) {
        for (var i = 0; i < stem.oscs.length; i++) stem.oscs[i].type = p.golf < 0.5 ? 'sawtooth' : 'square';
        stem.laatsteGolf = p.golf;
      }
      if (p.vuil !== stem.laatsteVuil && stem.vorm) {
        stem.vorm.curve = HG.vuilCurve(p.vuil);
        stem.voor.gain.value = 1 + p.vuil * 6;
        stem.laatsteVuil = p.vuil;
      }
      stem.filt.Q.value = 0.7 + p.reso * 22;
      if (stem.oscs.length > 1 && stem.oscs[1].detune) stem.oscs[1].detune.value = 3 + (p.detune || 0) * 30;
      if (stem.vibDiepte) stem.vibDiepte.gain.value = (p.vibrato || 0) * 45;
    }

    return {
      knoppen: def.knoppen,
      rijen: 13,
      standaardGrond: def.grond,

      standaardParams: function () {
        var p = {};
        for (var i = 0; i < def.knoppen.length; i++) p[def.knoppen[i][0]] = def.knoppen[i][2];
        return p;
      },

      standaardPatroon: function () { return def.patroon.slice(); },

      stop: function () {
        if (!stem) return;
        var t = HG.audio.ctx.currentTime;
        stem.amp.gain.cancelScheduledValues(t);
        stem.amp.gain.setTargetAtTime(0, t, 0.01);
        vorigeAan = false;
      },

      // Plant één noot. legato: de volgende noot sluit aan, dus niet loslaten.
      noot: function (t, midi, accent, duur, legato, p) {
        if (!stem) maakStem();
        stelIn(p);
        var amp = stem.amp.gain, ff = stem.filt.frequency;
        var f = HG.freq(midi);
        var glijden = p.glide > 0.03;
        for (var i = 0; i < stem.oscs.length; i++) {
          var fq = stem.oscs[i].frequency;
          if (glijden && vorigeAan) fq.setTargetAtTime(f, t, 0.005 + p.glide * 0.09);
          else fq.setValueAtTime(f, t);
        }
        var basis = def.cutoffBasis * Math.pow(2, p.cutoff * 7.2);
        var top = Math.min(16000, basis * (1 + p.env * (accent ? 10 : 6)));
        ff.setValueAtTime(top, t);
        ff.setTargetAtTime(basis, t + 0.002, 0.02 + p.decay * 0.35);
        amp.setTargetAtTime(p.vol * (accent ? 0.95 : 0.65), t, 0.002);
        var vast = legato && glijden;
        if (!vast) amp.setTargetAtTime(0, t + duur * def.gate, 0.012 + (p.release || 0) * 0.15);
        vorigeAan = vast;
      },

      rust: function (t) {
        if (!stem) return;
        if (vorigeAan) stem.amp.gain.setTargetAtTime(0, t, 0.008);
        vorigeAan = false;
      },

      speel: function (stap, t, patroon, grond, p, stapDuur) {
        var v = patroon[stap];
        if (v < 0) { this.rust(t); return; }
        this.noot(t, grond + v % 100, v >= 100, stapDuur, patroon[(stap + 1) % 16] >= 0, p);
      }
    };
  }

  HG.bas = maakMono({
    grond: 36,
    cutoffBasis: 50,
    gate: 0.72,
    knoppen: [
      ['golf', 'Saw / square', 0],
      ['cutoff', 'Cutoff', 0.3],
      ['reso', 'Resonance', 0.6],
      ['env', 'Envelope', 0.55],
      ['decay', 'Decay', 0.3],
      ['glide', 'Glide', 0.2],
      ['vuil', 'Filth', 0.35],
      ['vol', 'Volume', 0.8]
    ],
    // Starts empty.
    patroon: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]
  });

  HG.lead = maakMono({
    grond: 60,
    cutoffBasis: 120,
    gate: 0.85,
    twee: true,
    vibrato: true,
    knoppen: [
      ['golf', 'Saw / square', 0.6],
      ['detune', 'Detune', 0.35],
      ['cutoff', 'Cutoff', 0.45],
      ['reso', 'Resonance', 0.35],
      ['env', 'Envelope', 0.4],
      ['decay', 'Decay', 0.4],
      ['glide', 'Glide', 0.25],
      ['vibrato', 'Vibrato', 0.2],
      ['release', 'Release', 0.3],
      ['vuil', 'Filth', 0.2],
      ['vol', 'Volume', 0.55]
    ],
    // B-A-C-H: B flat, A, C, B natural. The signature Bach hid in his own music. Himmelsbach, after all.
    patroon: [110, -1, -1, -1, 9, -1, -1, -1, 112, -1, -1, -1, 11, -1, -1, -1]
  });

})(window.HG);
