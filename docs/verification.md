# Verification record

Environment: local macOS, Node 24.22.1 runtime, Python 3, Playwright with installed Google Chrome. This records actual Chromium coverage; Safari, Firefox and real physical touch devices were not exercised.

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
