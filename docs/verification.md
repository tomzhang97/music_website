# Verification record

Initial environment: local macOS, Node 24.22.1 runtime, Python 3, Playwright with installed Google Chrome. The initial checks below cover Chromium; later WebKit coverage is recorded by release. Real physical touch devices were not exercised.

- Domain: 10 passing tests for tuning, cells, range fitting, direction rules, root traversal/repetitions, compact fingering, all five cadences, choices, scoring and octave-preserving placement.
- Audio: all eleven instruments rendered real finite, audible samples below full scale through OfflineAudioContext; completed voice sets emptied; cancelling scheduled future notes produced silence.
- Browser: nine passing end-to-end scenarios under HTTP, file:// and an opaque sandbox with storage denied, at 1440px desktop and 360px mobile emulation.
- Rendered desktop and mobile screenshots inspected for overflow, visible controls and instrument geometry.
- Regression checks exposed and verified fixes for naturally ended voice cleanup, exact guitar-fret audition positions, octave-only root placement 44px control heights, and keyboard audition after dragging.

The application uses no external resources or runtime requests. Browser tests are development-only and screenshots are ignored from source control.

## v1.1 mobile audio and configurable sequences

The user reported silent iPhone/Safari output despite passing earlier Chromium emulation. This exposed an important verification limit: normal PCM and a running context do not prove physical iPhone output. The prior version left AudioSession on auto/ambient routing and skipped interrupted-state recovery.

Changes request `navigator.audioSession.type = "playback"` where supported, call resume/warm-up synchronously on touch/click/key gestures, handle interrupted contexts, bound stalled resume promises, and provide Enable sound / Test sound with explicit retry. The app remains self-contained and requests no microphone access.

New tests include real AudioContexts with controlled AudioSession/interruption boundary conditions, plus Chrome and WebKit iPhone-profile touch flows for output, pause/resume, stuck-resume recovery, 1–4 sequence editing, five-note phrases, ordered same-root pairs, full-group once/loop, transposition, Stop cancellation, persistence and quiz handoff. Physical iPhone hardware output still requires confirmation on the user's device.

Final v1.1 verification: 13 musical-domain tests, 3 mobile audio boundary regressions, 9 established browser/portability scenarios, all 11 instrument renders, and Chrome + WebKit mobile audio/sequence flows passed. A reviewed delayed-resume race was reproduced before correction; Stop now cancels pending sound-test, piano and timbre auditions before they can sound. The reviewed sequence transport had no remaining substantive findings. Desktop and 360px sequence-editor screenshots were inspected for readable controls and horizontal overflow.

## v1.2 continuous / disjoint connections

Three-note cells and configurable interval lists offer continuous notes or disjoint adjacent pairs. Disjoint repeats each shared endpoint (C–D, pause, D–E), includes the synth release allowance before each saved 0.2–6 second pause, and keeps cycle counts and root shifts at the whole-group boundary. The older same-root pairs remain a distinct choice. Interval pauses and complete-cycle breaths have separate controls; older same-root pair settings migrate their gap to the new pause control.

Verified 16 domain tests, the new Chrome + WebKit connection flows, all 9 established browser/portability scenarios, all 11 instrument renders, 3 audio boundary regressions, and both engines' mobile audio/sequence flows. Connection tests trace real synth calls to check shared-note order, configurable rest timing, four-interval groups, fixed and moving roots, Stop cancellation and quiet output, saved controls, and continuous quiz handoff. Desktop and 360px screenshots of the disjoint editor were inspected. Code review found no remaining substantive issues. WebKit iPhone profiles do not establish physical iPhone speaker output.

## v1.3 prepared lock-screen player

Root cause: the interactive player's requestAnimationFrame callback starts each subsequent cycle. Hidden-page animation suspension therefore stops cycle progression, even when the audio session requests playback routing. The prepared player renders the actual configured drill to a local WAV Blob and uses a connected, looping audio element; JavaScript callbacks only update its visuals. A new Play tap after preparation preserves Safari activation. System Media Session controls are guarded for unavailable actions. Fixed drills render one complete group; variable drills prepare about one minute, then loop that playlist. Re-preparation generates fresh random choices. Speech remains a foreground feature.

Local verification: all 20 pure domain/WAV tests, Chrome + WebKit native-media flows, both full-playlist cases, and two native loading race regressions passed. Native checks covered real audible PCM, shared-note pairs and rest timing, looping with animation scheduling disabled, pagehide preservation, pause/resume, settings invalidation, URL/media-handler cleanup, quiz transitions and cancelled rendering. A real Chromium frozen page lifecycle continued native playback. Full default-variable tracks were approximately 60 seconds and 5.3 MB; local preparation took approximately 9 seconds in Chrome and 4 seconds in WebKit. Both physical iPhone speed and hardware lock-screen output remain unverified.

The established 9 browser/portability scenarios, Chrome + WebKit interactive connection and mobile audio/sequence checks, 3 audio boundary regressions, and all 11 instrument renders passed. Desktop and iPhone-profile player screenshots were inspected. Review found a stale native play rejection that could cancel newer foreground playback; its unmocked reproduction failed before the generation/identity guard and passed after. A second unmocked quick-pause regression failed before AbortError handling and passed after. Preparation no longer advances listening counters; native counters show playlist position rather than guessing hidden-page wraps.
