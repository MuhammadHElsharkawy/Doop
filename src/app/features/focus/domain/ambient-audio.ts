import type { WorkspaceSettings } from '../../../core/domain/workspace-records';

export type AmbientSound = NonNullable<WorkspaceSettings['ambientSound']>;

export const ambientSounds: readonly AmbientSound[] = [
  'rain',
  'coffee-shop',
  'ocean-waves',
  'forest',
];

// Original procedural soundscapes. The fixed seed makes each rendering reproducible.
export function renderAmbient(
  context: AudioContext,
  sound: AmbientSound,
): AudioBuffer {
  const rate = 22_050;
  const seconds = 12;
  const buffer = context.createBuffer(2, seconds * rate, rate);
  const tau = 2 * Math.PI;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    let seed = 137 + 607 * channel;
    let soft = 0;
    let deep = 0;
    for (let index = 0; index < samples.length; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = seed / 0x80000000 - 1;
      soft += (white - soft) * 0.16;
      deep += (white - deep) * 0.009;
      const time = index / rate;
      const cycle = (tau * time) / seconds;
      let sample: number;
      switch (sound) {
        case 'rain':
          sample =
            soft * 0.32 + white * 0.035 + (seed % 163 < 3 ? white * 0.16 : 0);
          break;
        case 'ocean-waves':
          sample =
            (soft * 0.32 + deep * 1.2) *
            (0.18 +
              0.75 * ((1 + Math.sin(cycle * 2 + 0.3 * channel)) / 2) ** 2);
          break;
        case 'coffee-shop': {
          const murmur = (1 + Math.sin(tau * 1.9 * time + channel)) * 0.5;
          const clinkAge = (time + channel * 0.27 + 0.8) % 3;
          sample =
            deep * (0.7 + 0.5 * murmur) +
            soft * 0.045 +
            0.04 * Math.exp(-20 * clinkAge) * Math.sin(tau * 1280 * clinkAge);
          break;
        }
        case 'forest': {
          const chirpAge = (time + channel * 0.33 + 0.25) % 4;
          const chirp =
            chirpAge < 0.26 ? Math.sin((Math.PI * chirpAge) / 0.26) : 0;
          sample =
            soft * (0.14 + 0.08 * Math.sin(cycle)) +
            deep * 0.45 +
            0.05 * chirp * Math.sin(tau * (1800 + 1100 * chirpAge) * chirpAge);
          break;
        }
      }
      // Smooth the buffer seam, including when it loops on a different sample rate.
      const envelope = Math.min(1, time / 0.04, (seconds - time) / 0.04);
      samples[index] = Math.max(-1, Math.min(1, sample * envelope));
    }
  }
  return buffer;
}
