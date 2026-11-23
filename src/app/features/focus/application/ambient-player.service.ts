import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { type AmbientSound, renderAmbient } from '../domain/ambient-audio';

@Injectable({ providedIn: 'root' })
export class AmbientPlayerService {
  private context?: AudioContext;
  private gain?: GainNode;
  private source?: AudioBufferSourceNode;
  private buffer?: AudioBuffer;
  private offset = 0;
  private startedAt = 0;
  private request = 0;
  private readonly state = signal<'playing' | 'paused' | 'stopped'>('stopped');
  private readonly track = signal<AmbientSound | null>(null);
  readonly status = this.state.asReadonly();
  readonly sound = this.track.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      void this.context?.close().catch(() => undefined);
    });
  }

  async play(sound: AmbientSound, volume: number): Promise<void> {
    if (this.sound() !== sound) this.stop();
    if (this.status() === 'playing') return;
    const request = ++this.request;
    this.track.set(sound);
    try {
      if (!this.context) {
        const context = new AudioContext();
        context.onstatechange = () => {
          if (context.state !== 'running' && this.status() === 'playing')
            this.pause();
        };
        this.context = context;
      }
      const context = this.context;
      // Request playback before awaiting any workspace writes.
      await context.resume();
      if (request !== this.request) return;
      if (context.state !== 'running')
        throw new Error('Audio output is unavailable');
      if (!this.gain) {
        this.gain = context.createGain();
        this.gain.connect(context.destination);
      }
      const gain = this.gain;
      this.buffer ??= renderAmbient(context, sound);
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(volume / 100, context.currentTime);
      const source = context.createBufferSource();
      source.buffer = this.buffer;
      source.loop = true;
      source.connect(gain);
      source.start(0, this.offset);
      this.source = source;
      this.startedAt = context.currentTime;
      this.state.set('playing');
    } catch (error) {
      if (request !== this.request) return;
      this.stop();
      throw error;
    }
  }

  setVolume(volume: number): void {
    if (this.gain && this.context)
      this.gain.gain.setTargetAtTime(
        volume / 100,
        this.context.currentTime,
        0.02,
      );
  }

  pause(): void {
    if (!this.context || !this.buffer || !this.source) return;
    this.offset =
      (this.offset + this.context.currentTime - this.startedAt) %
      this.buffer.duration;
    this.releaseSource();
    this.state.set('paused');
  }

  stop(): void {
    this.request++;
    this.releaseSource();
    this.buffer = undefined;
    this.offset = 0;
    this.track.set(null);
    this.state.set('stopped');
  }

  private releaseSource(): void {
    const source = this.source;
    if (!source) return;
    source.stop();
    source.disconnect();
    this.source = undefined;
  }
}
