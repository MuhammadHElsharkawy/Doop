import {
  DestroyRef,
  DOCUMENT,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { toLocalDate } from './local-date';

@Injectable({ providedIn: 'root' })
export class LocalCalendarService {
  private readonly document = inject(DOCUMENT);
  private readonly date = signal(toLocalDate(new Date()));
  private readonly localHour = signal(new Date().getHours());
  readonly today = this.date.asReadonly();
  readonly hour = this.localHour.asReadonly();
  private readonly zone = signal(this.zoneKey(new Date()));
  readonly timeZone = this.zone.asReadonly();

  constructor() {
    const refresh = () => this.refresh();
    let tickCount = 0;
    const tick = setInterval(() => {
      const now = new Date();
      this.refreshDate(now);
      if (++tickCount % 2 === 0 && this.document.visibilityState === 'visible')
        this.zone.set(this.zoneKey(now));
    }, 1000);
    const window = this.document.defaultView;
    this.document.addEventListener('visibilitychange', refresh);
    window?.addEventListener('focus', refresh);
    window?.addEventListener('pageshow', refresh);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(tick);
      this.document.removeEventListener('visibilitychange', refresh);
      window?.removeEventListener('focus', refresh);
      window?.removeEventListener('pageshow', refresh);
    });
  }

  refresh(now = new Date()): void {
    this.refreshDate(now);
    this.zone.set(this.zoneKey(now));
  }

  private refreshDate(now: Date): void {
    this.date.set(toLocalDate(now));
    this.localHour.set(now.getHours());
  }

  private zoneKey(now: Date): string {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone +
      '/' +
      now.getTimezoneOffset()
    );
  }
}
