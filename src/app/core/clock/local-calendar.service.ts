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

  constructor() {
    const refresh = () => this.refresh();
    const tick = setInterval(refresh, 1000);
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
    this.date.set(toLocalDate(now));
    this.localHour.set(now.getHours());
  }
}
