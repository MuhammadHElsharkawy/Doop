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
import { LocalCalendarService } from '../clock/local-calendar.service';
import { dailyFocus, defaultDailyFocusGoal } from '../domain/focus-metrics';
import type { FocusSession } from '../domain/workspace-records';
import { PersistenceService } from './persistence.service';

@Injectable({ providedIn: 'root' })
export class FocusHistoryService {
  private readonly document = inject(DOCUMENT);
  private readonly persistence = inject(PersistenceService);
  private readonly repository = this.persistence.repositories.sessions;
  private readonly rows = signal<FocusSession[] | null>(null);
  private readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly calendar = inject(LocalCalendarService);
  private readonly target = signal<number | 'loading' | 'error'>('loading');
  private request = 0;
  private goalRequest = 0;
  private retrying = false;
  private readonly channel =
    typeof BroadcastChannel === 'undefined'
      ? undefined
      : new BroadcastChannel('doop-focus-history');

  readonly sessions = this.rows.asReadonly();
  readonly status = this.state.asReadonly();
  readonly goal = this.target.asReadonly();
  readonly today = computed(() => {
    const rows = this.sessions();
    return rows === null ? null : dailyFocus(rows, this.calendar.today());
  });

  constructor() {
    effect(() => {
      if (!this.persistence.replacementRevision()) return;
      untracked(() => {
        this.rows.set(null);
        this.state.set('loading');
        this.target.set('loading');
        void this.refresh();
        void this.refreshGoal();
      });
    });
    effect(() => {
      if (this.persistence.status() !== 'ready' || this.retrying) return;
      untracked(() => {
        if (this.status() === 'error') void this.refresh();
        if (this.goal() === 'error') void this.refreshGoal();
      });
    });
    const resume = () => {
      if (this.document.visibilityState !== 'visible') return;
      void this.refresh();
      void this.refreshGoal();
    };
    if (this.channel)
      this.channel.onmessage = (event: MessageEvent<unknown>) => {
        if (event.data === 'goal') void this.refreshGoal();
        if (event.data === 'changed') void this.refresh();
      };
    this.document.addEventListener('visibilitychange', resume);
    this.document.defaultView?.addEventListener('focus', resume);
    this.document.defaultView?.addEventListener('pageshow', resume);
    inject(DestroyRef).onDestroy(() => {
      this.channel?.close();
      this.document.removeEventListener('visibilitychange', resume);
      this.document.defaultView?.removeEventListener('focus', resume);
      this.document.defaultView?.removeEventListener('pageshow', resume);
    });
    void this.refresh();
    void this.refreshGoal();
  }

  async refresh(): Promise<void> {
    const request = ++this.request;
    try {
      const rows = await this.repository.list();
      if (request !== this.request) return;
      this.rows.set(rows);
      this.state.set('ready');
    } catch {
      if (request !== this.request) return;
      this.rows.set(null);
      this.state.set('error');
    }
  }

  async retry(): Promise<void> {
    this.retrying = true;
    try {
      await this.persistence.retry();
      await Promise.all([this.refresh(), this.refreshGoal()]);
    } finally {
      this.retrying = false;
    }
  }

  goalChanged(): void {
    this.channel?.postMessage('goal');
    void this.refreshGoal();
  }

  private async refreshGoal(): Promise<void> {
    const request = ++this.goalRequest;
    try {
      const settings = await this.persistence.repositories.readFocusSettings();
      if (request === this.goalRequest)
        this.target.set(settings?.dailyGoal ?? defaultDailyFocusGoal);
    } catch {
      if (request === this.goalRequest) this.target.set('error');
    }
  }

  async changed(): Promise<void> {
    this.channel?.postMessage('changed');
    await this.refresh();
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
    await this.changed();
  }
}
