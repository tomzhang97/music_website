Build a complete, studio-grade **Interval Ear Training Web Application** with real-time synthesized audio, interactive Piano Keyboard & Guitar Fretboard visualizers, an infinite Passive Listening loop engine, and a configurable Multiple-Choice Quiz.

## 1. Architecture & Portability Requirements
- **Zero Backend & Self-Contained Delivery**: Build the app using pure HTML5, Vanilla CSS, and Vanilla JavaScript (Web Audio API + optional Web Speech API) with **zero external runtime dependencies or external CDN links**, bundled so `index.html` works identically whether served over HTTP, hosted inside a strict `Origin: null` static sandbox (avoid `<script type="module" src="...">` CORS pitfalls or unguarded `localStorage` calls), or opened directly via `file://`.
- **Tactile Studio Hardware Aesthetic**: Design a refined dark studio instrument UI (inspired by classic hardware synthesizers and studio monitors: brushed graphite/slate surfaces, subtle inset LCD readouts, tactile keycap buttons, warm signal amber for active sounding notes, studio teal for interval context, emerald/coral for quiz feedback, and monospace readouts for BPM/Hz/ratios). Avoid generic dashboard templates, purple-on-dark gradients, or decorative clutter.
- **Mobile-First Touch & Responsive UX**:
  - Zero horizontal page overflow on viewports down to `360px` width (`overflow-x: hidden`).
  - Touch-friendly controls (`min-height: 44px`, `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`) and automatic Web Audio context unlock/resume on the first touch or click.
  - On narrow mobile screens where the Piano Keyboard and Guitar Fretboard scroll horizontally, smoothly auto-scroll/center both instrument containers onto the currently active notes as they play, while using `click` handlers so horizontal touch-dragging scrolls cleanly without triggering stray notes.

---

## 2. Multi-Timbre Web Audio Synthesizer
Implement a polyphonic Web Audio API engine routed through subtle studio room convolution reverb, a dynamics compressor, and a master gain slider, with instant note auditioning when switching timbres. Organize **11 synthesized instruments** into three groups:
1. **Pianos (Acoustic & Electric)**:
   - *Concert Grand Piano*: Multi-partial harmonic series with slight string inharmonicity, unison detuning, dynamic lowpass filter decay, and a short percussive hammer-strike noise transient.
   - *Warm Felt Upright Piano*: Soft wool-felt attack, warm fundamental/low-mid body, and gently rolled-off upper partials suited for long passive listening sessions.
   - *Bright Honky-Tonk Piano*: Detuned 3-string unison choir with bright percussive tack attack.
   - *Rhodes MkI Electric Piano*: Warm fundamental tonebar + asymmetric bell tine overtone.
   - *Wurlitzer 200A Reed Piano*: Vibrating steel-reed harmonic blend with characteristic attack filter "bark".
   - *DX Crystal FM Piano*: True FM synthesis (`1:1` warm body modulator + `14:1` crystalline tine bell modulator).
2. **Guitar Strings (Karplus-Strong Physical Modeling)**:
   - Generate real-time Karplus-Strong plucked-string `AudioBuffer`s with configurable pick-position comb filtering, string damping, and body resonance:
   - *Acoustic Steel-String Guitar*: Crisp bridge-side pick transient, bright bronze string overtones, and acoustic soundboard resonance (~195 Hz).
   - *Classical Nylon-String Guitar*: Warm finger-plucked nylon damping with mellow cedar body sustain.
   - *Clean Hollowbody Jazz Guitar*: Flatwound thumb-plucked string paired with a warm neck-pickup lowpass roll-off.
3. **Synths & Reference**:
   - *Analog Warm String Pad* (detuned sawtooth/triangle ensemble) and *Pure Sine Tuning Fork*.

---

## 3. Real-Time Piano Keyboard & 6-String Guitar Fretboard Visualizer
Place a prominent dual-instrument visualizer deck at the top of the workspace so notes light up in real time as they sound:
- **Layout Controls**: Toggle between `Both (Keyboard + Fretboard)` (default), `Keyboard Only`, and `Fretboard Only`.
- **3-Octave Interactive Piano Keyboard (`C3`–`C6`, MIDI 48–84)**:
  - Accurately scaled white and black keys; clicking/tapping any key plays that pitch and displays its note name, MIDI number, and frequency in Hz.
  - Highlights the **currently sounding note(s)** in glowing Amber and the **other note(s) of the active interval** in Studio Teal, displaying step badges (`①`, `②`, `③`) and note names directly on the active keys.
- **6-String Interactive Guitar Fretboard (Standard Tuning `E2–A2–D3–G3–B3–E4`, Frets `OPEN`–`15`)**:
  - Realistic graduated string gauges, brass nut (`OPEN` / Fret `0`), fret number header, and pearl fret inlays (`3, 5, 7, 9, 12, 15`). Clicking/tapping any fret plucks that note and shows string, fret, note name, and Hz.
  - **Ergonomic 1-Hand Fingering Solver**: Given a 2-note or 3-note interval sequence, automatically compute a natural playable fretboard box shape (minimizing fret stretch across strings), light up the active vibrating string and sounding fret marker in Amber (`①`, `②`, `③`), keep the companion interval notes illuminated in Teal, and display the fingering path text (e.g., `① Str 3G Fret 7 (D4) → ② Str 3G Fret 5 (C4)`).
  - **Unison Fret Toggle**: Option to show subtle ghost markers on equivalent unison pitches across other strings.
  - **Quiz Spoiler Blind Toggle**: In Quiz Mode, hide non-root visual note markers on both the keyboard and fretboard until the user submits an answer.

---

## 4. Feature 1 — Passive Listening (Infinite Loop Mode)
Build a continuous, hands-free interval immersion loop with live LCD readout (cycle count, interval title, note chips with signed semitone arrows, frequency ratio, and classic ascending/descending song mnemonics):
- **Transport & Instant Presets**: `Start / Stop Infinite Loop` (`Space`), `Play Cycle Once`, plus 1-click spotlight drill presets (e.g., `Maj 2 Descending ↓`, `Min 7 Ascending ↑`, `Perf 4 Ascending ↑`, `Perf 5 Descending ↓`, `Tritone Ascending ↑`, and 3-note cell presets like `Maj 2 ↓ + Min 7 ↑`).
- **2-Note vs. 3-Note Interval Modes**:
  - *2-Note Mode*: Toggle between **Single Interval Lock** (loop one specific interval forever) and **Multi-Interval Rotation** (cycle through a user-selected subset of intervals), with directions `Ascending ↑`, `Descending ↓`, `Harmonic ⇅`, and `Alternate ↑/↓`.
  - *3-Note Interval Cell Builder (`Note 1 → Note 2 → Note 3`)*: Configure **Step 1** (Interval + Asc/Desc) and **Step 2** with selectable rules (*Custom Fixed Interval*, *Repeat Step 1*, *Mirror Step 1 Direction*, or *Randomize from Active Pool*), plus a reference toggle between **Chained (`1→2, then 2→3`)** and **From Root (`1→2, then 1→3`)**.
- **Speed & Cadence Controls**:
  - *Speed (BPM)*: Slider from `40` to `200 BPM` with live `ms/beat` readout and tempo preset chips (*Lento 56*, *Andante 76*, *Moderato 100*, *Allegro 132*, *Presto 168*).
  - *Cadence Breath Gap*: Pause between loop iterations (`0.3s`–`6.0s`) with a smooth animated progress bar.
  - *Cadence Phrasing Style*:
    1. `Pure Melodic` (`Note 1 → Note 2 [→ Note 3]`)
    2. `Melodic + Harmonic Lock` (plays melodically, then stacks all notes together as a chord)
    3. `Harmonic Cluster First → Unpack Melodically`
    4. `Call & Soft Echo` (full velocity followed by a gentle echo repeat)
    5. `Dotted Swing Cadence` (long–short rhythmic phrasing)
- **Root Transposition & Eyes-Free Voice**:
  - Transposition modes: *Random Roving Root* (prevents memorizing absolute pitch), *Circle of Fourths (+5 st)*, *Chromatic Up/Down*, or *Fixed Root Note*, with `1×`–`4×` repetitions on the same root before shifting.
  - Optional Web Speech synthesis (`Off`, `Speak After Notes` for mental self-testing, `Speak Before Notes`).

---

## 5. Feature 2 — Configurable Multiple-Choice Quiz
Build an interactive multiple-choice ear test with live score, accuracy %, current/best streak, and per-interval accuracy progress bars:
- **Configurable Interval Pool**: Toggleable pad matrix for `m2` through `P8` plus optional compound intervals (`m9`, `M9`, `m10`, `M10`), paired with 1-click preset pools (*All Within Octave*, *Major Scale*, *Core Pillars*, *Step & Small Leaps*, *Wide Intervals*, *Consonances*, *Dissonances*).
- **Quiz Rules & 3-Note Quiz Support**:
  - Multi-select allowed directions (`Ascending ↑`, `Descending ↓`, `Harmonic ⇅`), configurable choice count (`Show All Enabled`, `4`, `6`, or `8` musically close distractors), and optional `Auto-Advance` on correct answers.
  - Support both **2-Note Quiz** (single multiple-choice grid, keyboard shortcuts `1`–`9`, `R`/`Space` to replay, `Hear Harmonic` button, `Enter` for next) and **3-Note Cell Quiz** (two side-by-side multiple-choice columns to identify both `Step 1: Note 1 → 2` and `Step 2: Note 2 → 3`).
- **Post-Answer Ear Comparison & Loop Handoff**:
  - After answering, reveal the exact notes played, semitone distance, ratio, and song reference, and illuminate the full interval on both the Piano Keyboard and Guitar Fretboard.
  - **Comparative Audition**: Clicking any choice button *after* answering plays that interval starting from the **exact same root note** so the user can directly compare their guess against the target interval.
  - **Practice Handoff**: Provide a `∞ Loop This Interval in Passive Mode` button on the feedback card that immediately loads the missed/tested 2-note or 3-note interval into Passive Listening Mode and starts looping it.