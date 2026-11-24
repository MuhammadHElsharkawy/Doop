import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { LocalCalendarService } from '../../../core/clock/local-calendar.service';
import type { LocalDate } from '../../../core/clock/local-date';
import { focusDurationFormatter } from '../../../core/localization/focus-metric-labels';
import { LocalizationService } from '../../../core/localization/localization.service';
import { FocusHistoryService } from '../../../core/persistence/focus-history.service';
import { PersistenceService } from '../../../core/persistence/persistence.service';
import {
  buildProgress,
  periods,
  reportPeriod,
  trendPage,
  trendRows,
  type DateRange,
  type Period,
  type ReportRecords,
} from '../domain/progress-report';
import { progressMessages } from './progress-messages';

@Component({
  selector: 'app-progress-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress-page.component.html',
  styleUrl: './progress-page.component.css',
  host: {
    '(window:focus)': 'refresh()',
    '(document:visibilitychange)': 'foreground()',
  },
})
export class ProgressPageComponent {
  protected readonly locale = inject(LocalizationService);
  private readonly title = inject(Title);
  private readonly persistence = inject(PersistenceService);
  private readonly history = inject(FocusHistoryService);
  private readonly document = inject(DOCUMENT);
  private readonly calendar = inject(LocalCalendarService);
  protected readonly today = this.calendar.today;
  protected readonly text = computed(
    () => progressMessages[this.locale.language()],
  );
  protected readonly periods = periods;
  protected readonly period = signal<Period>('week');
  protected readonly custom = signal<DateRange | null>(null);
  protected readonly invalid = signal(false);
  protected readonly page = signal(0);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly records = signal<ReportRecords | null>(null);
  protected readonly workspaceUnavailable = computed(() => {
    const status = this.persistence.status();
    return (
      status === 'blocked' ||
      status === 'connection-error' ||
      status === 'migration-error'
    );
  });
  private request = 0;

  protected readonly range = computed(() =>
    reportPeriod(
      this.period(),
      this.today(),
      this.custom()?.from ?? '',
      this.custom()?.through ?? '',
    ),
  );
  protected readonly report = computed(() => {
    this.calendar.timeZone();
    const range = this.range();
    const records = this.records();
    return range && records
      ? buildProgress(records, range, this.today())
      : null;
  });
  protected readonly pageRange = computed(() => {
    const range = this.range();
    return range ? trendPage(range, this.page()) : null;
  });
  protected readonly daily = computed(() => {
    const report = this.report();
    const range = this.pageRange();
    return report && range ? trendRows(report, range) : [];
  });
  protected readonly peak = computed(() =>
    Math.max(1, ...this.daily().map((row) => row.focusSeconds)),
  );
  protected readonly duration = computed(() =>
    focusDurationFormatter(this.locale.language()),
  );
  private readonly numbers = computed(
    () => new Intl.NumberFormat(this.locale.language()),
  );
  private readonly rates = computed(
    () =>
      new Intl.NumberFormat(this.locale.language(), {
        style: 'percent',
        maximumFractionDigits: 1,
      }),
  );
  private readonly dates = computed(
    () =>
      new Intl.DateTimeFormat(this.locale.language(), {
        dateStyle: 'medium',
        calendar: 'gregory',
        timeZone: 'UTC',
      }),
  );

  constructor() {
    effect(() => this.title.setTitle(this.locale.text().progress + ' · Doop'));
    effect(() => {
      this.persistence.replacementRevision();
      this.history.sessions();
      untracked(() => void this.refresh());
    });
    effect(() => {
      if (
        this.persistence.status() === 'ready' &&
        untracked(this.state) === 'error'
      )
        untracked(() => void this.refresh());
    });
  }

  protected foreground(): void {
    if (this.document.visibilityState === 'visible') void this.refresh();
  }

  protected async refresh(): Promise<void> {
    const request = ++this.request;
    if (this.state() !== 'ready') this.state.set('loading');
    try {
      const rows = await this.persistence.repositories.readProgress();
      if (request !== this.request) return;
      this.records.set(rows);
      this.state.set('ready');
    } catch {
      if (request !== this.request) return;
      this.records.set(null);
      this.state.set('error');
    }
  }

  protected async retry(heading: HTMLElement): Promise<void> {
    heading.focus();
    await this.persistence.retry();
    await this.refresh();
  }

  protected choose(value: string): void {
    const period = this.periods.find((option) => option === value);
    if (!period) return;
    this.period.set(period);
    this.page.set(0);
    this.invalid.set(false);
  }

  protected apply(
    event: SubmitEvent,
    from: HTMLInputElement,
    through: HTMLInputElement,
  ): void {
    event.preventDefault();
    const range = reportPeriod(
      'custom',
      this.today(),
      from.value,
      through.value,
    );
    this.invalid.set(range === null);
    if (range) {
      this.custom.set(range);
      this.page.set(0);
    } else if (!from.value || (through.value && from.value > through.value)) {
      from.focus();
    } else {
      through.focus();
    }
  }

  protected number(value: number): string {
    return this.numbers().format(value);
  }
  protected date(value: LocalDate): string {
    return this.dates().format(new Date(value + 'T00:00:00Z'));
  }
  protected rate(done: number, total: number | null): string {
    return total ? this.rates().format(done / total) : this.text().noRate;
  }
  protected ratio(done: number, total: number): string {
    return this.text()
      .of.replace('{done}', this.number(done))
      .replace('{total}', this.number(total));
  }
}
