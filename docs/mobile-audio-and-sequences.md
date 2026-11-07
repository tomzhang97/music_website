# Mobile audio and configurable four-interval loops

User request: fix silent iPhone/Safari playback and let the user configure up to four intervals that repeat together.

## Design

Audio: request the supported playback audio-session type so Web Audio uses media playback rather than iPhone ringer/ambient routing. Resume suspended AND interrupted contexts, synchronously inside genuine touch/click/key gestures. Start a one-sample silent buffer during unlock for WebKit. Keep all controls usable when audio is blocked and expose Enable sound / Test sound. Bound pending resume requests; provide a retry instead of a permanently spinning transport. Recreate closed or failed contexts only on an explicit retry. No microphone, downloads, background media hack or external assets.

Passive listening: preserve existing two-note and three-note modes and add an optional 1–4 interval sequence. Each ordered row chooses an interval and ascending/descending direction. Add/remove controls enforce 1–4 rows. Connected phrase mode builds up to five notes; separate-pairs mode plays each interval from the same group root in order. Existing tempo, cadence, breath, root modes and repeats apply. Roots shift after a complete group in pair mode. Play once runs the full group; Stop cancels all remaining pairs. Preserve sequence settings across reloads and tolerate malformed storage. Quiz and quiz-to-loop handoff retain their established behavior.

## Implementation plan

1. Reproduce missing playback-session routing and interrupted-state resume using real AudioContexts with controlled platform-boundary states; record failing tests.
2. Fix synchronous activation, playback routing, warm-up, error/retry state and add the sound-test button. Test Chrome and WebKit with touch input, including pause/resume and bounded blocked state.
3. Add tested sequence normalization, signed cumulative offsets and ordered pair indexing. Test 1–4 rows and invalid persistence.
4. Add the sequence editor, persistence and transport integration. Extend note badges and readouts for five-note phrases. Test add/remove, both playback layouts, entire-group once/loop, root repetition and cancellation.
5. Run existing domain/audio/browser regressions and targeted Chrome/WebKit mobile checks; inspect desktop/360px views. Review the changes, rebuild the single-file HTML, update GitHub main and verify the resulting Pages deployment and served bytes.

## Review focus

Preserve transient activation at the actual handler boundary. Never claim rendered PCM proves physical iPhone speaker output. Never leave the loop active while a resume promise is indefinitely pending. A four-row list must not permit a fifth row or an empty list. Pair sequencing must not transpose midway through a group or continue after Stop. Classic modes and quiz handoff must disable the new sequence mode explicitly.

## Source references

- WebKit ringer mute and playback session: https://bugs.webkit.org/show_bug.cgi?id=237322
- AudioSession types: https://developer.mozilla.org/en-US/docs/Web/API/AudioSession/type
- Interruption state: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state
