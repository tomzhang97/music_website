# Lock-screen listening design and plan

Goal: keep the user's configured passive drill playing in iPhone Safari when the screen locks or another app is foregrounded. The current transport starts every new cycle inside requestAnimationFrame, so suspended visual callbacks prevent further cycles. AudioSession playback routing alone does not remove that dependency.

Approach: retain the interactive foreground player and add an explicit Prepare lock-screen track action. Render a bounded, complete-group playlist using the existing synth and exact continuous/disjoint/cadence timing, then give a WAV Blob to a real audio element with native looping. A fresh Play tap after preparation preserves Safari's user-gesture requirement. Native media controls and guarded Media Session handlers provide play/pause/stop/seek. Visual callbacks only follow media time; they never schedule its next note or loop.

A fixed, deterministic drill needs one complete group. Rotating/random/transposing drills prepare about one minute (maximum 96 complete groups), then repeat that prepared playlist. Prepare again for fresh random choices. Spoken announcements stay in the foreground player because Web Speech cannot be baked into the offline render. Volume and musical edits invalidate the prepared track; visual-only changes do not. Stop, quiz switches and manual auditions cancel rendering/playback and release Blob URLs. Page hiding must not tear down a prepared player. The cycle readout shows the current group within the prepared playlist, so suspended callbacks do not lead to guessed elapsed cycle totals. No microphone, server, external assets, installation or screen wake lock is needed.

Alternatives considered: replacing animation frames with timers still depends on JavaScript that iOS can suspend; keeping silent audio alive does not make the drill scheduler reliable. Native playback of the actual rendered drill removes those dependencies. Physical iPhone lock-screen output remains a device verification boundary; browser tests must not claim it.

Implementation steps:

- [x] Add failing pure timeline/WAV tests and a browser regression that blocks animation scheduling while native media time advances; characterize the old transport's dependency.
- [x] Add src/track.js for bounded complete-group scheduling, offline synth rendering and finite PCM16 WAV encoding. Reuse a shared passivePlan helper in app.js.
- [x] Add accessible preparation/player controls, cancellation, media session lifecycle, saved-setting invalidation, and media-time visual sync. Preserve interactive audio recovery and quizzes.
- [x] Run domain, native-media Chrome/WebKit, existing connection/mobile/browser/audio checks; inspect 360px and desktop layouts; request code review.
- [ ] Rebuild, publish through the GitHub connector, verify Pages serves the tested build, and run native playback checks on the live URL. Refresh offline deliverables.

Review focus: cancellation during render, stale Blob URLs/media handlers, stopped visual timers, same-root group boundaries, and settings/quiz transitions must each have an explicit check.

References: https://html.spec.whatwg.org/multipage/media.html#attr-media-loop ; https://www.w3.org/TR/mediasession/ ; https://bugs.webkit.org/show_bug.cgi?id=261554 .

Review/verification ledger: 20 domain/WAV cases, Chrome/WebKit native flows and full playlists, Chrome frozen-page playback, 9 browser/portability scenarios, all eleven instruments, and established mobile/connection regressions passed. Native stale-play cancellation and immediate-pause bugs were reproduced with real media promises before fixes and passed afterwards. Counter preparation was also verified RED → GREEN. Physical iPhone output has not been claimed.
