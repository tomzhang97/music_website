# INTERVAL / 01

A complete browser-local interval ear training studio. Open **[index.html](index.html)** directly, or serve the repository with any static web server. No build, installation, backend, API keys, CDN, sound samples, or internet connection are needed to use the app.

[Open the live studio](https://tomzhang97.github.io/music_website/)

## Practice

- **Passive Listening:** infinite or single-cycle playback; locked intervals or pool rotation; ascending, descending, harmonic and alternate directions; 2-note intervals and configurable 3-note cells; five cadence styles; 40–200 BPM; adjustable breath; root transposition and repeats; optional spoken announcements. Add a self-configured sequence of 1–4 intervals, with individual ascending/descending directions. Choose Continuous (`do–re–mi`), Disjoint (`do–re`, pause, `re–mi`), or separate pairs from the same root. Three-note cells also offer Continuous / Disjoint. The saved pause between intervals (0.2–6 seconds) is separate from the breath between complete cycles.
- **Ear Quiz:** 2-note and chained 3-note questions; selectable directions and interval pools; close distractors or all enabled choices; hidden answer notes; replay and harmonic audition; same-root answer comparisons; live score, streaks and per-interval accuracy; direct handoff into a listening loop.
- **Live instruments:** clickable 3-octave piano (C3–C6) and standard-tuned 6-string guitar (frets 0–15), compact fingering solver, step badges, unison ghosts and automatic horizontal centering.
- **Eleven procedural voices:** Concert Grand, Felt Upright, Honky-Tonk, Rhodes, Wurlitzer, DX FM, steel-string, nylon-string, hollowbody jazz guitar, analog string pad and sine tuning fork. Additive/FM/physical modeling synthesis runs through procedural room convolution, compression and master gain.

Use **Space** to prepare, play or pause the main passive loop. In the quiz, **R / Space** replays, **1–9** answers the first unfinished step, and **Enter** starts the next question. **Escape** stops playback. Shortcuts leave focused form controls alone.

For **iPhone lock-screen / background listening**, set the sound, volume and drill, then tap **Prepare infinite loop → Play infinite loop** in the main transport. Wait for preparation to finish and tap Play before locking the screen or switching apps. The lock-screen card also offers the same track and native media controls. The real audio element repeats the rendered music independently of page animation callbacks; supported Media Session controls provide play/pause/stop/seek from system media controls. A fixed drill repeats one complete group. Random, rotating and transposing drills prepare about one minute of complete groups (up to 96), then repeat that playlist; prepare again for fresh random choices. The cycle readout shows position within the prepared playlist. Musical or volume edits clear the track, while instrument-layout changes preserve it. **Start live loop** remains available for fresh random choices every cycle and spoken announcements while the page stays open.

On iPhone/Safari, tap **Enable sound**, then use a play control. The sound test plays A4 (440 Hz). Supported browsers use the playback audio-session type so the iPhone Silent switch does not mute the music. Suspended/interrupted contexts can resume on a fresh tap, and a failed unlock offers a retry instead of hanging. On older iOS versions without AudioSession support, turn off Silent mode if needed and check media volume/Bluetooth output. Settings and scores are saved locally when storage is available. Blocked storage, including opaque-origin `sandbox="allow-scripts"` frames, does not prevent operation. The application makes no network requests for assets, scripts or audio.

## Static hosting / GitHub Pages

The repository root is ready for static hosting. For GitHub Pages, select **Settings → Pages → Deploy from a branch → main → / (root)**. No workflow or asset paths need configuring. GitHub Pages is already enabled from `main` at the URL above.

## Source and building

`index.html` is the distributable and contains everything inline. Readable sources are in `src/`:

| File | Responsibility |
| --- | --- |
| `shell.html` | Accessible controls and document structure |
| `styles.css` | Responsive graphite/amber/teal studio interface |
| `theory.js` | Interval data, cell math, root traversal, fingering, timing and scoring |
| `synth.js` | Audio synthesis, effect routing and voice lifecycle |
| `track.js` | Complete-group playlists, offline rendering and self-contained native-media WAV tracks |
| `app.js` | Instrument visualizers, transport, settings and quiz workflows |

After editing a source file, rebuild with Python 3:

```sh
python3 scripts/build.py
```

## Verification

Domain checks use only Node's built-in test runner:

```sh
node --test tests/*.test.cjs
```

Browser/audio tests are development-only. Install the pinned Playwright dependency and Chromium, then start the local server in one terminal:

```sh
npm install
npx playwright install chromium webkit
npm run serve
```

In another terminal:

```sh
npm test
npm run test:audio
npm run test:browser
npm run test:mobile
npm run test:connections
npm run test:background
```

For an already installed Google Chrome, set `BROWSER_CHANNEL=chrome`. `TEST_URL` overrides the preview URL, `QA_DIR` sets the screenshot directory, and `PLAYWRIGHT_PATH` optionally selects an existing Playwright installation. Development dependencies are never bundled into the app.

The checks cover signed/chained/root interval math, octave-preserving root placement, playable fingerings, all cadence styles, distractors and one-time scoring; real OfflineAudioContext output from all 11 voices, completed voice cleanup and cancellation; desktop and 360px workflows, quiz concealment and comparisons, cell answers and persistence, exact clicked guitar positions, touch sizing, direct `file://` opening, and a strict null-origin sandbox without storage. Connection tests check shared-note repetition, audible release allowances, configurable rests, whole-group transposition, Stop, persistence and continuous quiz handoff in Chrome and WebKit.

## Musical and browser notes

Audio uses **12-tone equal temperament, A4 = 440 Hz**. The LCD reports exact equal-tempered multipliers; familiar just-intonation ratios are labelled as references, not tuning claims. Song titles are memory cues; no song recordings or lyrics are bundled. The voices are synthesized interpretations of instrument families, rather than sampled commercial instruments.

Automatic root modes relocate pitches by octaves to favor the visualizers while preserving pitch classes. A fixed root is kept exactly. Extreme compound 3-note cells can exceed a physical instrument's display range; those pitches still sound correctly and the interface reports unavailable positions instead of changing the interval.

Use the prepared player for iPhone lock-screen listening. The regular loop advances on the audio clock when the browser stops rendering animation frames. Browser tests cover native-media progression and disabled animation callbacks. Physical iPhone lock-screen output still needs confirmation on the device. Calls, other media apps, closing Safari or system memory pressure can interrupt playback. Web Speech voices and availability depend on the browser/OS and may require a locally installed voice for offline speech. The music engine itself is entirely offline.
