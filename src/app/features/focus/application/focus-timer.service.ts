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
import type {
  ActiveSession,
  WorkspaceSettings,
} from '../../../core/domain/workspace-records';
import { createRecordId } from '../../../core/domain/record-id';
import { FocusHistoryService } from '../../../core/persistence/focus-history.service';
import { PersistenceService } from '../../../core/persistence/persistence.service';
import { InvalidActiveSessionError } from '../../../core/persistence/record-validation';
import {
  sameFocusRevision,
  UnavailableFocusTaskError,
} from '../../../core/persistence/workspace.repository';
import {
  clockDisagrees,
  elapsedSinceResume,
  elapsedActiveMs,
  focusDurationMs,
  localZone,
  recoveryAnchor,
  remainingMs,
  transitionTimer,
  type ClockSample,
  type RunningAnchor,
  type TimerCommand,
  type TimerInput,
} from '../domain/focus-timer';
import { defaultFocusSettings } from '../domain/focus-settings';

@Injectable({ providedIn: 'root' })
export class FocusTimerService {
  private readonly persistence = inject(PersistenceService);
  private readonly repository = this.persistence.repositories;
  private readonly history = inject(FocusHistoryService);
  private readonly document = inject(DOCUMENT);
  private readonly snapshot = signal<Awaited<
    ReturnType<typeof this.repository.focusSnapshot>
  > | null>(null);
  private readonly remaining = signal(focusDurationMs);
  private readonly working = signal(false);
  private readonly failure = signal<(() => Promise<void>) | null>(null);
  private readonly invalid = signal(false);
  private readonly conflict = signal(false);
  private readonly replacementConflict = signal(false);
  private readonly unavailableTask = signal(false);
  private readonly failedAction = signal<TimerCommand['type'] | null>(null);
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
  readonly resumeFailed = computed(
    () => this.hasError() && this.failedAction() === 'resume',
  );
  readonly changedElsewhere = this.conflict.asReadonly();
  readonly workspaceChanged = this.replacementConflict.asReadonly();
  readonly taskUnavailable = this.unavailableTask.asReadonly();
  readonly active = computed(() => this.snapshot()?.active);
  readonly settings = computed(
    () => this.snapshot()?.settings ?? defaultFocusSettings,
  );
  readonly pendingBreak = computed(() =>
    this.active() ? null : (this.snapshot()?.cycle?.pendingBreak ?? null),
  );
  readonly onBreak = computed(() => {
    const type = this.active()?.type;
    return type === 'short-break' || type === 'long-break';
  });
  readonly phase = computed(() => {
    if (this.invalid()) return 'invalid';
    const state = this.snapshot();
    if (!state) return 'loading';
    return (
      state.active?.status ?? (state.cycle?.pendingBreak ? 'completed' : 'idle')
    );
  });
  readonly seconds = computed(() =>
    this.active()?.type === 'stopwatch'
      ? Math.floor(this.remaining() / 1000)
      : Math.ceil(this.remaining() / 1000),
  );

  constructor() {
    effect(() => {
      const revision = this.persistence.replacementRevision();
      if (!revision) return;
      untracked(() => {
        if (this.snapshot()?.metadata.generation !== revision)
          this.resetForReplacement();
        void this.sync();
      });
    });
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

  activate(mode: 'timer' | 'stopwatch', taskId = ''): void {
    if (
      this.busy() ||
      this.hasError() ||
      this.invalid() ||
      this.confirmRecoveryAfter !== undefined
    )
      return;
    const active = this.snapshot()?.active;
    if (this.phase() === 'idle' || this.phase() === 'completed')
      this.command(
        {
          type: this.pendingBreak()
            ? 'start-break'
            : mode === 'timer'
              ? 'start'
              : 'start-stopwatch',
          sessionId: createRecordId(),
          taskId: this.pendingBreak() ? undefined : taskId || undefined,
        },
        this.sample(),
      );
    else if (active)
      this.command(
        {
          type: active.status === 'running' ? 'pause' : 'resume',
          sessionId: active.sessionId,
        },
        this.sample(),
      );
  }

  act(type: 'extend' | 'skip-break'): void {
    if (
      this.busy() ||
      this.hasError() ||
      this.confirmRecoveryAfter !== undefined
    )
      return;
    const active = this.active();
    void this.command(
      { type, sessionId: active?.sessionId ?? createRecordId() },
      this.sample(),
    );
  }

  async prepareStop() {
    const active = this.active();
    if (
      !active ||
      this.onBreak() ||
      this.busy() ||
      this.hasError() ||
      this.confirmRecoveryAfter !== undefined
    )
      return;
    if (active.status === 'paused') return { active, resume: false };
    const result = await this.command(
      { type: 'pause', sessionId: active.sessionId },
      this.sample(),
    );
    const paused = this.active();
    if (
      result === 'committed' &&
      paused?.sessionId === active.sessionId &&
      paused.status === 'paused'
    )
      return { active: paused, resume: true };
    return undefined;
  }

  stopDecision(expected: ActiveSession, type: 'save' | 'discard' | 'resume') {
    const state = this.snapshot();
    if (!state || this.busy() || this.hasError()) return;
    return this.run(
      { ...state, active: expected },
      { type, sessionId: expected.sessionId },
      this.input(this.sample()),
    );
  }

  async configure(
    patch: Partial<Omit<WorkspaceSettings, 'id'>>,
  ): Promise<void> {
    const expected = this.snapshot();
    if (this.busy() || !expected)
      throw new Error('Focus settings are not ready');
    const generation = ++this.writeGeneration;
    this.working.set(true);
    try {
      const settings = await this.repository.updateFocusSettings(
        (current) => ({
          ...(current ?? defaultFocusSettings),
          ...patch,
        }),
        expected.metadata.generation,
      );
      if (generation !== this.writeGeneration)
        throw new Error('The workspace was replaced');
      const state = this.snapshot();
      if (state) this.adopt({ ...state, settings });
      if ('dailyGoal' in patch) this.history.goalChanged();
      this.channel?.postMessage('changed');
    } finally {
      this.working.set(false);
      this.drainSync();
    }
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
    const previous = this.snapshot();
    if (previous && previous.metadata.generation !== state.metadata.generation)
      this.resetForReplacement();
    this.persistence.observeMetadata(state.metadata);
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
        active?.plannedDurationMs != null &&
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
    if (active) this.updateDisplay(active, now);
    else
      this.remaining.set(
        state.cycle?.pendingBreak
          ? 0
          : this.settings().focusDurationMinutes * 60_000,
      );
  }

  private updateDisplay(active: ActiveSession, now: ClockSample): void {
    const elapsed = this.anchor
      ? elapsedSinceResume(this.anchor, now.monotonic)
      : 0;
    this.remaining.set(
      active.type === 'stopwatch'
        ? elapsedActiveMs(active, elapsed)
        : remainingMs(active, elapsed),
    );
  }

  private tick(now: ClockSample, checkClock = false): void {
    const active = this.snapshot()?.active;
    if (active?.status !== 'running' || !this.anchor || this.invalid()) return;
    this.updateDisplay(active, now);
    const expired = active.plannedDurationMs !== null && this.remaining() === 0;
    if (!this.busy() && !this.hasError()) {
      if (expired) {
        if (
          this.confirmRecoveryAfter === undefined ||
          now.monotonic >= this.confirmRecoveryAfter
        )
          this.command({ type: 'recover', sessionId: active.sessionId }, now);
      } else if (
        clockDisagrees(this.anchor, now) ||
        (checkClock &&
          active.plannedDurationMs !== null &&
          remainingMs(active, recoveryAnchor(active, now).elapsedMs) === 0)
      )
        this.command({ type: 'checkpoint', sessionId: active.sessionId }, now);
    }
    if (!expired && this.document.visibilityState === 'visible')
      this.observedAt = now.monotonic;
  }

  private async sync(): Promise<void> {
    if (this.loadFailed && this.persistence.status() !== 'ready') return;
    if (this.busy() || this.reading) {
      this.syncQueued = true;
      return;
    }
    this.lastRead = performance.now();
    this.reading = true;
    const generation = this.writeGeneration;
    try {
      if (this.invalid()) {
        await this.persistence.refreshMetadata();
      } else {
        const state = await this.repository.focusSnapshot();
        if (generation === this.writeGeneration) {
          this.adopt(state);
          this.loadFailed = false;
        }
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

  private resetForReplacement(): void {
    if (this.failure() || this.busy()) this.replacementConflict.set(true);
    this.writeGeneration++;
    this.anchor = undefined;
    this.observedAt = undefined;
    this.confirmRecoveryAfter = undefined;
    this.loadFailed = false;
    this.invalid.set(false);
    this.failure.set(null);
    this.failedAction.set(null);
    this.conflict.set(false);
    this.unavailableTask.set(false);
    this.snapshot.set(null);
  }

  private drainSync(): void {
    if (!this.syncQueued || this.busy() || this.reading) return;
    this.syncQueued = false;
    void this.sync();
  }

  private command(command: TimerCommand, now: ClockSample) {
    const expected = this.snapshot();
    return expected
      ? this.run(expected, command, this.input(now), now)
      : undefined;
  }

  private input(now: ClockSample): TimerInput {
    const elapsedMs = this.anchor
      ? elapsedSinceResume(this.anchor, now.monotonic)
      : 0;
    const observedCompletion =
      this.document.visibilityState === 'visible' &&
      this.observedAt !== undefined &&
      now.monotonic - this.observedAt < 2000;
    return {
      wall: now.wall,
      elapsedMs,
      observedCompletion,
      zone: localZone(now.wall),
      revision: createRecordId(),
    };
  }

  private async run(
    expected: NonNullable<ReturnType<typeof this.snapshot>>,
    command: TimerCommand,
    input: TimerInput,
    at = this.sample(),
  ): Promise<'committed' | 'conflict' | 'unchanged' | undefined> {
    if (this.busy()) return;
    const action = command.type;
    const generation = ++this.writeGeneration;
    this.working.set(true);
    this.conflict.set(false);
    this.replacementConflict.set(false);
    if (action === 'start' || action === 'start-stopwatch')
      this.unavailableTask.set(false);
    try {
      const state = await this.repository.updateFocus(
        expected,
        (snapshot, task) =>
          transitionTimer(snapshot.active, command, input, {
            ...snapshot,
            task,
          }),
        action,
        command.taskId,
      );
      if (generation !== this.writeGeneration) return 'conflict';
      const committed = state.result === 'committed';
      this.adopt(state, committed ? at : undefined);
      this.failure.set(null);
      this.failedAction.set(null);
      this.conflict.set(
        state.result === 'conflict' &&
          action !== 'recover' &&
          action !== 'checkpoint',
      );
      if (committed) this.channel?.postMessage('changed');
      if ('historyChanged' in state && state.historyChanged)
        void this.history.changed();
      return state.result;
    } catch (error) {
      if (generation !== this.writeGeneration) return 'conflict';
      if (error instanceof InvalidActiveSessionError) this.rejectSnapshot();
      else if (error instanceof UnavailableFocusTaskError)
        this.unavailableTask.set(true);
      else {
        this.failedAction.set(action);
        this.failure.set(() => {
          // User transitions use the retry instant. Completion keeps its
          // original deadline and attribution.
          if (
            action !== 'checkpoint' &&
            action !== 'recover' &&
            sameFocusRevision(expected.active, this.snapshot()?.active)
          ) {
            const now = this.sample();
            return this.run(expected, command, this.input(now), now).then(
              () => undefined,
            );
          }
          return this.run(expected, command, input, at).then(() => undefined);
        });
      }
    } finally {
      this.working.set(false);
      this.drainSync();
    }
    return undefined;
  }
}
