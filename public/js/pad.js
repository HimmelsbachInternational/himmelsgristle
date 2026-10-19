// Himmelsgristle: pad.
// Polyphonic. Every note in the matrix gets its own voice: two detuned oscillators,
// a filter and a slow envelope. Cells that are on in consecutive steps form one long note.

(function (HG) {
  'use strict';

  var knoppen = [
    ['golf', 'Saw / square', 0.1],
    ['detune', 'Detune', 0.45],
    ['cutoff', 'Cutoff', 0.45],
    ['reso', 'Resonance', 0.2],
    ['attack', 'Attack', 0.45],
    ['release', 'Release', 0.5],
    ['beweging', 'Movement', 0.3],
    ['vuil', 'Filth', 0.15],
    ['vol', 'Volume', 0.5]
  ];

  var actief = []; // klinkende stemmen, om bij stop los te laten

  function stem(ctx, uit, t, f, duur, accent, p) {
    var aanzet = 0.01 + p.attack * p.attack * 2.5;
    var los = 0.05 + p.release * p.release * 3;
    var piek = p.vol * (accent ? 0.42 : 0.3);
    var einde = t + Math.max(duur, aanzet);

    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(piek, t + aanzet);
    g.gain.setValueAtTime(piek, einde);
    g.gain.setTargetAtTime(0, einde, los / 3);

    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    var basis = 120 * Math.pow(2, p.cutoff * 6.5);
    filt.frequency.setValueAtTime(basis * 0.6, t);
    filt.frequency.linearRampToValueAtTime(basis, t + aanzet);
    filt.Q.value = 0.5 + p.reso * 12;

    var stop = einde + los * 1.2 + 0.05;
    var oscs = [];
    for (var i = 0; i < 2; i++) {
      var o = ctx.createOscillator();
      o.type = p.golf < 0.5 ? 'sawtooth' : 'square';
      o.frequency.value = f;
      if (o.detune) o.detune.value = (i === 0 ? -1 : 1) * (2 + p.detune * 18);
      o.connect(filt);
      if (o.start) o.start(t); else o.noteOn(t);
      if (o.stop) o.stop(stop); else o.noteOff(stop);
      oscs.push(o);
    }

    // Movement: a slow sweep of the filter, so the chord breathes.
    if (p.beweging > 0.03) {
      var lfo = ctx.createOscillator();
      lfo.frequency.value = 0.15 + p.beweging * 0.6;
      var diepte = ctx.createGain();
      diepte.gain.value = basis * p.beweging * 0.8;
      lfo.connect(diepte); diepte.connect(filt.frequency);
      if (lfo.start) { lfo.start(t); lfo.stop(stop); } else { lfo.noteOn(t); lfo.noteOff(stop); }
    }

    filt.connect(g);
    g.connect(uit);
    var v = { g: g, eind: stop };
    actief.push(v);
    return v;
  }

  HG.pad = {
    knoppen: knoppen,
    rijen: 13,
    standaardGrond: 48,

    standaardParams: function () {
      var p = {};
      for (var i = 0; i < knoppen.length; i++) p[knoppen[i][0]] = knoppen[i][2];
      return p;
    },

    // 13 rows (semitones above the root) x 16 steps, 0 = off, 1 = on, 2 = accent. Starts empty.
    standaardPatroon: function () {
      var rijen = [];
      for (var r = 0; r < 13; r++) { var rij = []; for (var n = 0; n < 16; n++) rij.push(0); rijen.push(rij); }
      return rijen;
    },

    // Plays the notes that start on this step. idx = position in the pattern, lengte = pattern length.
    speel: function (idx, t, rijen, grond, p, stapDuur, lengte) {
      var ctx = HG.audio.ctx;
      var uit = HG.vuil(p.vuil, HG.audio.uit);
      for (var r = 0; r < 13; r++) {
        var rij = rijen[r];
        if (!rij[idx]) continue;
        var vorige = (idx - 1 + lengte) % lengte;
        // Part of a note that already started: nothing new to do.
        if (rij[vorige] && lengte > 1 && !(idx === 0 && vorige === lengte - 1 && allesAan(rij, lengte))) continue;
        var stappen = 1;
        while (stappen < lengte && rij[(idx + stappen) % lengte]) stappen++;
        stem(ctx, uit, t, HG.freq(grond + r), stappen * stapDuur * 0.98, rij[idx] === 2, p);
      }
      var nu = ctx.currentTime;
      actief = actief.filter(function (v) { return v.eind > nu; });
    },

    stop: function () {
      var t = HG.audio.ctx.currentTime;
      for (var i = 0; i < actief.length; i++) {
        actief[i].g.gain.cancelScheduledValues(t);
        actief[i].g.gain.setTargetAtTime(0, t, 0.08);
      }
      actief = [];
    }
  };

  function allesAan(rij, lengte) {
    for (var i = 0; i < lengte; i++) if (!rij[i]) return false;
    return true;
  }

})(window.HG);
