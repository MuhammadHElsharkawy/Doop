import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import type { ActiveSession } from '../../../core/domain/workspace-records';
import { createRecordId } from '../../../core/domain/record-id';
import { PersistenceService } from '../../../core/persistence/persistence.service';
import { InvalidActiveSessionError } from '../../../core/persistence/record-validation';
import { sameFocusRevision } from '../../../core/persistence/workspace.repository';
import {
  clockDisagrees,
  elapsedSinceResume,
  focusDurationMs,
  localZone,
  recoveryAnchor,
  remainingMs,
  transitionTimer,
  type ClockSample,
  type RunningAnchor,
  type TimerChange,
  type TimerCommand,
} from '../domain/focus-timer';

@Injectable({ providedIn: 'root' })
export class FocusTimerService {
  private readonly persistence = inject(PersistenceService);
  private readonly repository = this.persistence.repositories;
  private readonly document = inject(DOCUMENT);
  private readonly snapshot = signal<Awaited<
    ReturnType<typeof this.repository.focusSnapshot>
  > | null>(null);
  private readonly remaining = signal(focusDurationMs);
  private readonly working = signal(false);
  private readonly failure = signal<(() => Promise<void>) | null>(null);
  private readonly invalid = signal(false);
  private readonly conflict = signal(false);
  private anchor?: RunningAnchor;
  private observedAt?: number;
  private confirmRecoveryAfter?: number;
  private loadFailed = false;
  private reading = false;
  private writeGeneration = 0;
  private syncQueued = false;
  private lastRead = -Infinity;
  private readonly channel =
    typeof BroadcastChannel === 'undefined'
      ? undefined
      : new BroadcastChannel('doop-focus-commits');

  readonly busy = this.working.asReadonly();
  readonly hasError = computed(() => this.failure() !== null);
  readonly changedElsewhere = this.conflict.asReadonly();
  readonly phase = computed(() => {
    if (this.invalid()) return 'invalid';
    const state = this.snapshot();
    if (!state) return 'loading';
    if (state.active && state.active.type !== 'timer') return 'unavailable';
    return (
      state.active?.status ?? (state.cycle?.pendingBreak ? 'completed' : 'idle')
    );
  });
  readonly seconds = computed(() => Math.ceil(this.remaining() / 1000));

  constructor() {
    const visible = () => {
      this.observedAt = undefined;
      if (this.document.visibilityState === 'visible') void this.sync();
    };
    if (this.channel)
      this.channel.onmessage = (event: MessageEvent<unknown>) => {
        if (event.data === 'check-clock') this.tick(this.sample(), true);
        else if (event.data === 'changed') void this.sync();
      };
    this.document.addEventListener('visibilitychange', visible);
    this.document.defaultView?.addEventListener('pageshow', visible);
    this.document.defaultView?.addEventListener('focus', visible);
    const ticker = setInterval(() => {
      const now = this.sample();
      this.tick(now);
      if (
        !this.busy() &&
        now.monotonic - this.lastRead >= 2000 &&
        this.document.visibilityState === 'visible'
      )
        void this.sync();
    }, 250);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(ticker);
      this.channel?.close();
      this.document.removeEventListener('visibilitychange', visible);
      this.document.defaultView?.removeEventListener('pageshow', visible);
      this.document.defaultView?.removeEventListener('focus', visible);
    });
    effect(() => {
      if (this.persistence.status() === 'ready' && this.loadFailed)
        untracked(() => {
          void this.sync();
        });
    });
    void this.sync();
  }

  activate(): void {
    if (
      this.busy() ||
      this.hasError() ||
      this.invalid() ||
      (this.confirmRecoveryAfter !== undefined && this.remaining() === 0)
    )
      return;
    const active = this.snapshot()?.active;
    if (this.phase() === 'idle' || this.phase() === 'completed')
      this.command(
        { type: 'start', sessionId: createRecordId() },
        this.sample(),
      );
    else if (active?.type === 'timer')
      this.command(
        {
          type: active.status === 'running' ? 'pause' : 'resume',
          sessionId: active.sessionId,
        },
        this.sample(),
      );
  }

  async retry(): Promise<void> {
    if (!this.busy()) await this.failure()?.();
  }

  private sample(): ClockSample {
    return { wall: Date.now(), monotonic: performance.now() };
  }

  private adopt(
    state: NonNullable<ReturnType<typeof this.snapshot>>,
    committedAt?: ClockSample,
  ): void {
    const last = this.snapshot()?.active;
    const active = state.active;
    const now = this.sample();
    const sameRun =
      last?.status === 'running' &&
      active?.status === 'running' &&
      last.sessionId === active.sessionId &&
      last.resumedAt === active.resumedAt &&
      last.accumulatedActiveMs === active.accumulatedActiveMs;
    const reanchoredByPeer =
      sameRun && !!active.timing && !sameFocusRevision(last, active);
    if (!sameRun || committedAt || reanchoredByPeer) {
      this.anchor =
        active?.status === 'running'
          ? recoveryAnchor(active, committedAt ?? now)
          : undefined;
      this.observedAt = undefined;
      this.confirmRecoveryAfter = undefined;
      if (
        !committedAt &&
        active?.type === 'timer' &&
        this.anchor &&
        this.channel &&
        remainingMs(active, this.anchor.elapsedMs) === 0
      ) {
        // Give an open peer a chance to checkpoint contrary monotonic evidence
        // before this document commits based on its wall-clock-only estimate.
        this.confirmRecoveryAfter = now.monotonic + 750;
        this.channel.postMessage('check-clock');
      }
    }
    this.snapshot.set(state);
    this.remaining.set(
      active?.type === 'timer'
        ? remainingMs(
            active,
            this.anchor ? elapsedSinceResume(this.anchor, now.monotonic) : 0,
          )
        : state.cycle?.pendingBreak
          ? 0
          : focusDurationMs,
    );
  }

  private tick(now: ClockSample, checkClock = false): void {
    const active = this.snapshot()?.active;
    if (
      active?.type !== 'timer' ||
      active.status !== 'running' ||
      !this.anchor ||
      this.invalid()
    )
      return;
    this.remaining.set(
      remainingMs(active, elapsedSinceResume(this.anchor, now.monotonic)),
    );
    if (!this.busy() && !this.hasError()) {
      if (this.remaining() === 0) {
        if (
          this.confirmRecoveryAfter === undefined ||
          now.monotonic >= this.confirmRecoveryAfter
        )
          this.command({ type: 'recover', sessionId: active.sessionId }, now);
      } else if (
        clockDisagrees(this.anchor, now) ||
        (checkClock &&
          remainingMs(active, recoveryAnchor(active, now).elapsedMs) === 0)
      )
        this.command({ type: 'checkpoint', sessionId: active.sessionId }, now);
    }
    if (this.remaining() > 0 && this.document.visibilityState === 'visible')
      this.observedAt = now.monotonic;
  }

  private async sync(): Promise<void> {
    if (
      this.invalid() ||
      (this.loadFailed && this.persistence.status() !== 'ready')
    )
      return;
    if (this.busy() || this.reading) {
      this.syncQueued = true;
      return;
    }
    this.lastRead = performance.now();
    this.reading = true;
    const generation = this.writeGeneration;
    try {
      const state = await this.repository.focusSnapshot();
      if (generation === this.writeGeneration) {
        this.adopt(state);
        this.loadFailed = false;
      }
    } catch (error) {
      if (generation === this.writeGeneration) {
        if (error instanceof InvalidActiveSessionError) this.rejectSnapshot();
        else this.loadFailed = true;
      }
    } finally {
      this.reading = false;
    }
    this.tick(this.sample());
    this.drainSync();
  }

  private rejectSnapshot(): void {
    this.invalid.set(true);
    this.failure.set(null);
  }

  private drainSync(): void {
    if (!this.syncQueued || this.busy() || this.reading) return;
    this.syncQueued = false;
    void this.sync();
  }

  private command(command: TimerCommand, now: ClockSample): void {
    const expected = this.snapshot()?.active;
    const change = this.deriveChange(expected, command, now);
    if (change) void this.run(expected, command, change, now);
  }

  private deriveChange(
    expected: ActiveSession | undefined,
    command: TimerCommand,
    now: ClockSample,
  ) {
    const elapsedMs = this.anchor
      ? elapsedSinceResume(this.anchor, now.monotonic)
      : 0;
    const observedCompletion =
      this.document.visibilityState === 'visible' &&
      this.observedAt !== undefined &&
      now.monotonic - this.observedAt < 2000;
    return transitionTimer(expected, command, {
      wall: now.wall,
      elapsedMs,
      observedCompletion,
      zone: localZone(now.wall),
      revision: createRecordId(),
    });
  }

  private async run(
    expected: ActiveSession | undefined,
    command: TimerCommand,
    change: TimerChange,
    at: ClockSample,
  ): Promise<void> {
    if (this.busy()) return;
    const action = command.type;
    this.writeGeneration++;
    this.working.set(true);
    this.conflict.set(false);
    try {
      const state = await this.repository.updateFocus(
        expected,
        () => change,
        action,
      );
      const committed = state.result === 'committed';
      this.adopt(state, committed ? at : undefined);
      this.failure.set(null);
      this.conflict.set(
        state.result === 'conflict' &&
          action !== 'recover' &&
          action !== 'checkpoint',
      );
      if (committed) this.channel?.postMessage('changed');
    } catch (error) {
      if (error instanceof InvalidActiveSessionError) this.rejectSnapshot();
      else
        this.failure.set(() => {
          // User transitions use the retry instant. Completion keeps its
          // original deadline and attribution.
          if (
            action !== 'checkpoint' &&
            !change.completion &&
            sameFocusRevision(expected, this.snapshot()?.active)
          ) {
            const now = this.sample();
            const retried = this.deriveChange(expected, command, now);
            if (retried) return this.run(expected, command, retried, now);
          }
          return this.run(expected, command, change, at);
        });
    } finally {
      this.working.set(false);
      this.drainSync();
    }
  }
}
