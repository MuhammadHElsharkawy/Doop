import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { LocalizationService } from '../../../core/localization/localization.service';
import { FocusTimerService } from '../application/focus-timer.service';

const messages = {
  en: {
    mode: 'Pomodoro Timer',
    start: 'Start',
    pause: 'Pause',
    resume: 'Resume',
    again: 'Start another session',
    running: 'Focus session running',
    paused: 'Focus session paused',
    completed: 'Focus session complete',
    idle: 'Ready to focus',
    loading: 'Loading timer…',
    unavailable: 'Another focus mode is already active.',
    retry: 'Retry timer action',
    error: 'The timer change could not be saved. Retry to continue.',
    invalid:
      'The saved timer contains inconsistent timing data and cannot be recovered. Its data has been preserved.',
    conflict:
      'The timer changed in another tab. Review its current state and try again.',
  },
  ar: {
    mode: 'مؤقت بومودورو',
    start: 'ابدأ',
    pause: 'إيقاف مؤقت',
    resume: 'استئناف',
    again: 'ابدأ جلسة أخرى',
    running: 'جلسة التركيز جارية',
    paused: 'جلسة التركيز متوقفة مؤقتًا',
    completed: 'اكتملت جلسة التركيز',
    idle: 'جاهز للتركيز',
    loading: 'جارٍ تحميل المؤقت…',
    unavailable: 'يوجد وضع تركيز آخر نشط بالفعل.',
    retry: 'إعادة محاولة إجراء المؤقت',
    error: 'تعذّر حفظ التغيير في المؤقت. أعد المحاولة للمتابعة.',
    invalid:
      'تتضمن بيانات المؤقت المحفوظة أوقاتًا غير متسقة، لذا تعذّرت استعادته. تم الاحتفاظ بالبيانات.',
    conflict:
      'تغيّر المؤقت في علامة تبويب أخرى. راجع حالته الحالية وحاول مجددًا.',
  },
} as const;

@Component({
  selector: 'app-focus-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="page-title">{{ locale.text().focus }}</h1>
    <section
      class="task-list mt-8 max-w-lg px-5 py-7 text-center"
      aria-labelledby="focus-mode"
    >
      <h2 id="focus-mode" class="text-lg font-semibold">{{ text().mode }}</h2>
      @if (timer.phase() === 'invalid') {
        <p class="mt-4 task-error" role="alert">{{ text().invalid }}</p>
      } @else if (timer.phase() === 'loading') {
        @if (!timer.hasError()) {
          <p class="mt-4" role="status">{{ text().loading }}</p>
        }
      } @else if (timer.phase() === 'unavailable') {
        <p class="mt-4">{{ text().unavailable }}</p>
      } @else {
        <p
          class="my-4 text-5xl font-semibold tabular-nums sm:text-6xl"
          role="timer"
          dir="ltr"
        >
          {{ display() }}
        </p>
        <p class="mb-4 text-muted" role="status">{{ text()[timer.phase()] }}</p>
        <button
          #primary
          class="task-button task-primary"
          type="button"
          [attr.aria-disabled]="timer.busy() || timer.hasError()"
          (click)="timer.activate()"
        >
          {{ action() }}
        </button>
        @if (timer.changedElsewhere()) {
          <p class="mt-4 text-muted" role="status">{{ text().conflict }}</p>
        }
        @if (timer.hasError()) {
          <p class="mt-4 task-error">{{ text().error }}</p>
          <button
            class="task-button mt-3"
            type="button"
            [attr.aria-disabled]="timer.busy()"
            (click)="retry($event)"
          >
            {{ text().retry }}
          </button>
        }
      }
    </section>
  `,
})
export class FocusPageComponent {
  protected readonly timer = inject(FocusTimerService);
  protected readonly locale = inject(LocalizationService);
  private readonly title = inject(Title);
  private readonly injector = inject(Injector);
  private readonly primary =
    viewChild<ElementRef<HTMLButtonElement>>('primary');
  protected readonly text = computed(() => messages[this.locale.language()]);
  private readonly digits = computed(
    () =>
      new Intl.NumberFormat(this.locale.language(), {
        minimumIntegerDigits: 2,
        useGrouping: false,
      }),
  );
  protected readonly display = computed(() => {
    const seconds = this.timer.seconds();
    return (
      this.digits().format(Math.floor(seconds / 60)) +
      ':' +
      this.digits().format(seconds % 60)
    );
  });
  protected readonly action = computed(() => {
    const phase = this.timer.phase();
    if (phase === 'running') return this.text().pause;
    if (phase === 'paused') return this.text().resume;
    if (phase === 'completed') return this.text().again;
    return this.text().start;
  });

  constructor() {
    effect(() => this.title.setTitle(this.locale.text().focus + ' · Doop'));
  }

  protected async retry(event: MouseEvent): Promise<void> {
    const trigger = event.currentTarget;
    await this.timer.retry();
    if (this.timer.hasError()) return;
    afterNextRender(
      () => {
        const primary = this.primary()?.nativeElement;
        const focused = primary?.ownerDocument.activeElement;
        if (
          primary &&
          (focused === trigger || focused === primary.ownerDocument.body)
        )
          primary.focus();
      },
      { injector: this.injector },
    );
  }
}
