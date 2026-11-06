# Interval / 01 implementation plan

Goal: implement the supplied brief as a self-contained offline studio ear trainer and upload it to tomzhang97/music_website.

Architecture: maintain readable CSS and classic JavaScript source, then assemble them into a single index.html using Python's standard library. Musical logic, synthesis, and application orchestration are separate source files. No runtime dependencies, requests, modules, accounts, or backend.

Design: graphite hardware panels, ivory piano keys, amber sounding notes, teal interval context. Header includes voice selection and volume; prominent piano/fretboard deck precedes Passive / Quiz tabs. Passive mode has LCD, transport, drill presets and grouped controls. Quiz has score, replay, choices, feedback, and pool/rules controls. All controls stay usable at 360px.

1. Musical domain: write and run failing Node tests for signed/chained/root cells, note range, all transposition modes/repetitions, ergonomic fret positions, cadence schedules, close distractors and one-time quiz scoring. Implement theory.js and rerun.
2. Audio: implement 11 distinct synthesis models, procedural room impulse, compressor/master, voice disposal and cancellation. Verify every voice creates non-silent bounded output using real OfflineAudioContext in Chromium.
3. Instrument UI: implement accessible keyboard and fretboard, realtime timed highlights, note inspection, blind mode, unison ghosts and mobile centering. Preserve scroll gestures.
4. Listening and quiz: connect transport, all options/presets, speech, pool validation, 2/3-note answers, comparisons on original root, live stats and handoff. Guard storage and unavailable browser APIs.
5. Package and verify: generate index.html, run domain tests and browser workflows under HTTP, file:// and sandboxed null origin with storage denied; test 360px and desktop layouts, keyboard shortcuts, stopping/restarting, all sound models and quiz handoff. Inspect rendered screenshots. Document limits and usage, upload validated files via GitHub connector and verify commit contents.

Review focus: cancellation must silence scheduled future notes; quiz privacy must cover text and both instruments; root changes must retain signed distances at range boundaries; malformed/blocked persistence must never break startup; scrolling/touch and focused form controls must not accidentally trigger notes or shortcuts.

Decisions: supplied prompt is the design authority. GitHub upload is explicitly authorized. Implementation proceeds in this session. Equal temperament is used for audio; familiar just-intonation ratios are labelled separately. If an extreme 3-note compound cell exceeds a visualizer's physical range, preserve pitches and explicitly report unavailable positions rather than silently changing the interval.
