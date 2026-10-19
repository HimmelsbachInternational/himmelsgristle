# Himmelsgristle

A modular synth network of old phones playing in sync. Industrial, electroclash, e-waste reborn.

One phone is the **Masterblaster**: it runs a hotspot, a tiny server and the clock. Other phones, tablets or laptops just open a web page and play along. No internet, no app store, no account.

## What's in it (version 0.6)

- A shared clock across all devices: late joiners fall in on the beat, tempo changes land on the next bar, plus shared **swing**
- **Drums:** five synthesized voices (kick, snare, hihat, clap, metal) in a 16-step matrix with accents. Tap a voice name for its knobs, including **Filth** (overdrive and bitcrush)
- **Bass:** a mono bass with resonant filter, glide and filth, and a one-octave note matrix over 16 steps
- **Lead:** two detuned oscillators with vibrato, filter, glide and filth
- **Arpeggiator** on bass and lead: up, down, up/down or random, over an octave, fifth, minor, major, diminished, sus or minor 7 chord, across 1 to 3 octaves, in 1/16 or 1/32
- **Patterns A to D** per device; switching while playing lands on the next bar
- **Slots:** every instrument gets its own slot in the session (BASS 1, BASS 2, DRUMS 1...) with its own sound and patterns, and a name you choose. A device that comes back gets its slot back (*Persistence is all*)
- **Saving and sharing:** sessions saved and loaded on the Masterblaster, a sound library per role, and export and import of sounds, instruments and whole sessions as files
- **Click test** for setting the latency offset per device
- On the Masterblaster: the player address and a QR code, which folds away once a player has joined

## Setting up the Masterblaster (once)

On an Android phone with [Termux](https://f-droid.org/packages/com.termux/) from F-Droid. Make sure the phone has internet for a moment and type in Termux:

```
curl -sL https://raw.githubusercontent.com/HimmelsbachInternational/himmelsgristle/main/termux/eerste-keer.sh | bash
```

From then on Termux opens with a menu: **1** to start, **2** to update. If your launcher supports widgets, the same buttons are available through [Termux:Widget](https://f-droid.org/packages/com.termux.widget/). Switch off battery optimisation for Termux.

## Playing

1. Switch on the **hotspot** on the Masterblaster.
2. Open Termux and press **1**.
3. On the Masterblaster, open `http://localhost:8080` in Chrome. The player address and QR code are there.
4. Connect the other devices to the hotspot, switch their **mobile data off**, and scan the code or type the address.
5. Choose a role on each device and press START.

If a device sounds late or early, adjust its latency offset under SETTINGS, TIMING. Each device remembers its own value.

## Updating

Only the Masterblaster needs updating; the players load everything from it. Saved sessions live in the `opslag/` folder and survive updates. Switch the hotspot off and wifi on (or keep mobile data on), open Termux, press **2**, then switch the hotspot back on.

## Sharing files

Under SETTINGS, SHARE you can export and import three kinds of file:

| Kind | Contains |
| --- | --- |
| Sound | the knob positions of one instrument |
| Instrument | sound plus patterns A to D and the arpeggiator |
| Session | all slots, with tempo and swing |

They are plain JSON files with a header like `{ "himmelsgristle": 1, "soort": "klank", "rol": "bas", ... }`. Import works out the kind by itself.

## How it works

The players keep asking the Masterblaster what time it is and work out the difference with their own clock. Every note is scheduled a fraction of a second ahead on the device's own audio clock, so a stuttering wifi connection does not affect the timing. Everything is plain old JavaScript, so old phones and tablets can join.

The QR code is made with [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase (MIT licence).
