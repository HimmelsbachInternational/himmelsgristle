// Himmelsgristle: de bas.
// Eén monofone stem die blijft draaien: oscillator, resonant filter, vuil en een versterker.
// Noten worden ingepland door toonhoogte, filter en volume op het juiste moment te veranderen,
// zodat glijden tussen noten vanzelf gaat.

(function (HG) {
  'use strict';

  var knoppen = [
    ['golf', 'Zaag / blok', 0],
    ['cutoff', 'Cutoff', 0.3],
    ['reso', 'Resonantie', 0.6],
    ['env', 'Envelope', 0.55],
    ['decay', 'Decay', 0.3],
    ['glide', 'Glide', 0.2],
    ['vuil', 'Vuil', 0.35],
    ['vol', 'Volume', 0.8]
  ];

  var stem = null; // { osc, filt, vorm, amp, laatsteVuil, laatsteGolf }

  function maakStem() {
    var ctx = HG.audio.ctx;
    var osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = HG.freq(36);
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 400;
    var voor = ctx.createGain();
    var vorm = ctx.createWaveShaper ? ctx.createWaveShaper() : null;
    var amp = ctx.createGain();
    amp.gain.value = 0;
    osc.connect(filt);
    filt.connect(voor);
    if (vorm) { voor.connect(vorm); vorm.connect(amp); } else { voor.connect(amp); }
    amp.connect(HG.audio.uit);
    if (osc.start) osc.start(0); else osc.noteOn(0);
    stem = { osc: osc, filt: filt, voor: voor, vorm: vorm, amp: amp, laatsteVuil: -1, laatsteGolf: -1 };
  }

  // Klankinstellingen die direct mogen veranderen (niet op een bepaald moment).
  function stelIn(p) {
    if (p.golf !== stem.laatsteGolf) {
      stem.osc.type = p.golf < 0.5 ? 'sawtooth' : 'square';
      stem.laatsteGolf = p.golf;
    }
    if (p.vuil !== stem.laatsteVuil && stem.vorm) {
      stem.vorm.curve = HG.vuilCurve(p.vuil);
      stem.voor.gain.value = 1 + p.vuil * 6;
      stem.laatsteVuil = p.vuil;
    }
    stem.filt.Q.value = 0.7 + p.reso * 22;
  }

  var vorigeAan = false;

  HG.bas = {
    knoppen: knoppen,
    rijen: 13, // een octaaf plus de bovenste grondtoon

    standaardParams: function () {
      var p = {};
      for (var i = 0; i < knoppen.length; i++) p[knoppen[i][0]] = knoppen[i][2];
      return p;
    },

    // Een stuwende electroclash-baslijn. Waarde: -1 = stil, anders halve tonen boven de grondtoon; +100 = accent.
    standaardPatroon: function () {
      return [0, -1, 0, 12, -1, 0, 3, -1, 0, -1, 107, -1, 5, -1, 3, 102];
    },

    standaardGrond: 36,

    stop: function () {
      if (!stem) return;
      var t = HG.audio.ctx.currentTime;
      stem.amp.gain.cancelScheduledValues(t);
      stem.amp.gain.setTargetAtTime(0, t, 0.01);
      vorigeAan = false;
    },

    // Plan de noot van deze stap in.
    speel: function (stap, t, patroon, grond, p, stapDuur) {
      if (!stem) maakStem();
      stelIn(p);
      var v = patroon[stap];
      var volgende = patroon[(stap + 1) % 16];
      var amp = stem.amp.gain, fq = stem.osc.frequency, ff = stem.filt.frequency;
      if (v < 0) {
        if (vorigeAan) amp.setTargetAtTime(0, t, 0.008);
        vorigeAan = false;
        return;
      }
      var accent = v >= 100, n = v % 100;
      var f = HG.freq(grond + n);
      var glijden = p.glide > 0.03;

      if (glijden && vorigeAan) fq.setTargetAtTime(f, t, 0.005 + p.glide * 0.09);
      else fq.setValueAtTime(f, t);

      var basis = 50 * Math.pow(2, p.cutoff * 7.2);
      var top = Math.min(16000, basis * (1 + p.env * (accent ? 10 : 6)));
      ff.setValueAtTime(top, t);
      ff.setTargetAtTime(basis, t + 0.002, 0.02 + p.decay * 0.35);

      var piek = p.vol * (accent ? 0.95 : 0.65);
      amp.setTargetAtTime(piek, t, 0.002);

      // Bij glijden naar een volgende noot blijft hij klinken; anders even los laten.
      var legato = glijden && volgende >= 0;
      if (!legato) amp.setTargetAtTime(0, t + stapDuur * 0.72, 0.012);
      vorigeAan = legato;
    }
  };

})(window.HG);
