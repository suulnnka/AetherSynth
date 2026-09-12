# AetherSynth · Grid Modular Subtractive Synthesizer

中文 | **English**

A pure front-end Web Audio modular synthesizer: place modules (oscillators,
filters, sequencers, drums, effects…) on a grid canvas the way you'd build a
real machine, patch them together with 3.5mm cables and make it speak — plus a
「Component Workshop」 for designing your own custom modules.

**Try it online: <https://suulnnka.github.io/AetherSynth/>**

## Running

```bash
npm start        # dev server → http://127.0.0.1:8642
npm test         # unit tests (Node's built-in test runner, zero dependencies)
```

> ES Modules must be served over http(s) — double-clicking index.html will be
> blocked by CORS (file://).

## How to play

1. Drag modules from the palette onto the canvas (clock, VCO, VCF, VCA,
   envelope, sequencer, drums, speaker…)
2. Drag from an output jack to an input jack to patch — drag again to unplug,
   click a cable to delete it
3. The **Songs** menu ships several built-in pieces: a pop trio, Minimoog /
   Model D showcase tones, FM bells, the 8-bit long form "Pixel Expedition",
   and "NSF Transcription · 4-track full song" — a NES sound-format file
   transcribed offline and rebuilt as 4 tracks × 16-bar piano rolls × 4
   movements, auto-advanced by a selector patch
4. Right-click a module's jacks / controls to send them into the workshop
   (right-click a custom module to re-edit it); Del deletes, Ctrl+D duplicates,
   Shift multi-select then "Encapsulate as composite"
5. The canvas autosaves (localStorage); the menu can export / import JSON

## Layout

```
├── index.html            page skeleton (menu bar / palette / canvas / workshop / help)
├── styles/               styles, split by UI region
│   ├── base.css          variables / menu bar / status bar / overlays
│   ├── palette.css       left module palette
│   ├── canvas.css        canvas / module shells / jacks / screws / cables
│   ├── widgets.css       in-module widgets (knobs / faders / keys / screens…)
│   └── studio.css        workshop panel and custom-module content grid
├── scripts/serve.js      zero-dependency static server (npm start)
├── src/
│   ├── main.js           entry: wires the layers + window.SYNTH debug API
│   ├── core/             module-agnostic kernel
│   │   ├── state.js      global mutable state (mods / cables / view / cursors)
│   │   ├── audio.js      AudioContext singleton (rebuildable per sample rate) / Mon / noise buffer
│   │   ├── ports.js      shell layout constants & jack positioning (pure functions)
│   │   ├── registry.js   module definition registry + signal type table
│   │   ├── flow.js       activity computation (pure) + DOM application
│   │   ├── save.js       debounced localStorage saving (serializer registered in reverse)
│   │   ├── view.js       pan / zoom / grid metrics
│   │   ├── selection.js  single select / Shift multi-select
│   │   ├── cables.js     cable create / delete / SVG drawing
│   │   ├── module.js     Mod base class & lifecycle
│   │   ├── composite.js  composite modules (encapsulate / dissolve)
│   │   ├── serialize.js  patch serialization / deserialization / import & export
│   │   ├── loop.js       dual-driven main loop (rAF + audio-thread pump)
│   │   ├── engine.js     sample-rate switching (serialize → rebuild → restore)
│   │   └── i18n.js       UI language (zh / en): detection, persistence, t() helpers
│   ├── kit/              in-module widget kit (knobs / faders / switches / pads / keys / screens)
│   ├── modules/          built-in module definitions, one file per category:
│   │   ├── controls.js   knobs / faders / touchpad / switches …
│   │   ├── keyboard.js   MIDI keyboard
│   │   ├── sequencer.js  MIDI sequencer (1024 steps) + piano roll (C2~C6, 1~16 bars)
│   │   ├── sources.js    VCO / FM / LFO (SYNC hard sync, duty) / noise / microphone
│   │   ├── clock.js      clock (BPM / duty / RST reset)
│   │   ├── drums.js      kick / snare / hi-hat
│   │   ├── processors.js VCF / VCA / ADSR / delay / quantizer / S&H / amplifier / multiples …
│   │   ├── effects.js    compressor / bit crusher / sample-rate reducer
│   │   ├── math.js       numeric module factory (add / sub / mul / div / selector…)
│   │   ├── outputs.js    stereo speaker / spectrum / scope / XY / recorders
│   │   └── index.js      assembly: registration + palette order
│   ├── workshop/         component workshop: UI layout editor (grid drag & drop)
│   │   ├── panel.js        CompactPanel cell rendering (reusable standalone)
│   │   ├── panel-styles.js cell styles (independently injected)
│   │   ├── layout.js       layout model (cells / snapping / sizes, pure & unit-tested)
│   │   ├── custom-def.js   layout spec → real module definition (port binding injection)
│   │   ├── studio.js       workshop panel: add / drag layout / inspector / save & place
│   │   └── designs.js      design list (MINE) / place / delete
│   ├── palette/          left module palette rendering
│   ├── songs/            example song data / patches / demo tones
│   ├── interactions/     canvas pointer / global keyboard / context menu
│   └── ui/               toolbar / status bar / toast / tooltip / window component
│                         (window.js: AppWindow + confirmDialog/alertDialog)
└── tests/                node:test unit tests (pure logic layer)
```

## Architecture notes

- **Layered one-way dependencies**: `utils/state → ports/registry/flow → audio →
  cables → module → composite`; upper layers (module defs, workshop,
  interactions, UI) only depend downward. A few reverse needs are decoupled via
  callbacks (e.g. `save.js`'s serializer, `view.js`'s grid-metrics listener).
- **Testability**: jack layout, activity BFS, workshop spec → port/size math,
  song data validation and other pure logic are fully separated from DOM /
  audio and run directly in Node (`npm test`).
- **Live-bound audio context**: `audio.js` exports the engine as
  `export let ctx`; switching sample rates rebuilds the instance and every
  consumer sees the new engine automatically; the patch is serialized and
  restored verbatim.
- **Adding a module**: add a def in the matching `src/modules/` category file
  (or create a new category file and register it in `modules/index.js`);
  declare port types in `registry.js`'s `PORT_TYPES` and signal origins in
  `flow.js`'s `FLOW` (source modules are exempt).
- **Extending workshop widgets**: add a widget kind in `panel.js`'s `mkCell`
  and map its port direction in `custom-def.js`'s `customLayout`.
