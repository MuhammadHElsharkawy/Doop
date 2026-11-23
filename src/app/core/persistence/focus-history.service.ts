import {
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { toLocalDate } from '../clock/local-date';
import { dailyFocus } from '../domain/focus-metrics';
import type { FocusSession } from '../domain/workspace-records';
import { PersistenceService } from './persistence.service';

@Injectable({ providedIn: 'root' })
export class FocusHistoryService {
  private readonly document = inject(DOCUMENT);
  private readonly persistence = inject(PersistenceService);
  private readonly repository = this.persistence.repositories.sessions;
  private readonly rows = signal<FocusSession[] | null>(null);
  private readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly date = signal(toLocalDate(new Date()));
  private request = 0;
  private readonly channel =
    typeof BroadcastChannel === 'undefined'
      ? undefined
      : new BroadcastChannel('doop-focus-history');

  readonly sessions = this.rows.asReadonly();
  readonly status = this.state.asReadonly();
  readonly today = computed(() => {
    const rows = this.sessions();
    return rows === null ? null : dailyFocus(rows, this.date());
  });

  constructor() {
    const resume = () => {
      if (this.document.visibilityState !== 'visible') return;
      updateDate();
      void this.refresh();
    };
    const updateDate = () => this.date.set(toLocalDate(new Date()));
    const ticker = setInterval(updateDate, 1000);
    if (this.channel) this.channel.onmessage = () => void this.refresh();
    this.document.addEventListener('visibilitychange', resume);
    this.document.defaultView?.addEventListener('focus', resume);
    this.document.defaultView?.addEventListener('pageshow', resume);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(ticker);
      this.channel?.close();
      this.document.removeEventListener('visibilitychange', resume);
      this.document.defaultView?.removeEventListener('focus', resume);
      this.document.defaultView?.removeEventListener('pageshow', resume);
    });
    void this.refresh();
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
    await this.persistence.retry();
    await this.refresh();
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
