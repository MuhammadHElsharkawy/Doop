# Doop ambient audio

Rain, Coffee Shop, Ocean Waves, and Forest are original procedural stereo loops rendered by Doop in the browser. The [synthesis source](../src/app/features/focus/domain/ambient-audio.ts) uses seeded noise, filtering, modulation, and synthesized tones. There are no third-party recordings, samples, or network audio requests.

The player keeps one sound source per document. Selecting a different sound stops the current source. An explicit Play action starts or resumes playback. Route navigation keeps the in-memory player, and a reload restores only sound and volume preferences. Browsers can suspend audio in the background or interrupt output when the device changes audio routes. Native WebView interruption and lock-screen playback remain unverified.
