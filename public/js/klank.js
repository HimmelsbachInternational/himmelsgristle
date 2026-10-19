// Himmelsgristle: gedeelde klankbouwstenen.

(function (HG) {
  'use strict';

  // Vuil: overstuuring, en vanaf de helft ook minder bits (bitcrush). Alles in één vervormingscurve.
  var curves = {};

  HG.vuilCurve = function (a) {
    var stap = Math.round(Math.max(0, Math.min(1, a)) * 20);
    if (curves[stap]) return curves[stap];
    a = stap / 20;
    var n = 2048, c = new Float32Array(n);
    var k = 1 + a * 5;
    var norm = Math.tanh ? Math.tanh(k) : 1;
    var niveaus = a > 0.45 ? Math.pow(2, Math.max(3, Math.round(11 - (a - 0.45) * 15))) : 0;
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      var y = Math.tanh ? Math.tanh(x * k) / norm : Math.max(-1, Math.min(1, x * k));
      if (niveaus) y = Math.round(y * niveaus) / niveaus;
      c[i] = y;
    }
    curves[stap] = c;
    return c;
  };

  // Geeft het knooppunt terug waar de klank in moet; het vuil zit daarachter tot aan 'doel'.
  HG.vuil = function (a, doel) {
    var ctx = HG.audio.ctx;
    if (!a || a < 0.03 || !ctx.createWaveShaper) return doel;
    var voor = ctx.createGain();
    voor.gain.value = 1 + a * 6;
    var vorm = ctx.createWaveShaper();
    vorm.curve = HG.vuilCurve(a);
    var na = ctx.createGain();
    na.gain.value = 1 / (1 + a * 2.2);
    voor.connect(vorm); vorm.connect(na); na.connect(doel);
    return voor;
  };

  HG.noten = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  HG.notenNaam = function (midi) { return HG.noten[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1); };
  HG.freq = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };

})(window.HG);
