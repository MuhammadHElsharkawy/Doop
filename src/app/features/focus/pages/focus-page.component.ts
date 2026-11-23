import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { LocalizationService } from '../../../core/localization/localization.service';
import { DialogComponent } from '../../../shared/ui/dialog.component';
import { TasksService } from '../../tasks/application/tasks.service';
import { FocusHistoryComponent } from './focus-history.component';
import { AmbientSoundComponent } from './ambient-sound.component';
import { FocusTimerService } from '../application/focus-timer.service';
import { validBreakSetting, validFocusMinutes } from '../domain/focus-settings';
import { focusMessages } from './focus-messages';

type Panel = 'duration' | 'settings' | 'stop';
type FormError = 'duration' | 'short' | 'long' | 'frequency' | 'write';

@Component({
  selector: 'app-focus-page',
  imports: [DialogComponent, FocusHistoryComponent, AmbientSoundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    button[aria-pressed='true'] {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-wash);
    }
    button[aria-disabled='true'] {
      opacity: 0.55;
      cursor: default;
    }
  `,
  templateUrl: './focus-page.component.html',
})
export class FocusPageComponent {
  protected readonly timer = inject(FocusTimerService);
  protected readonly tasks = inject(TasksService);
  protected readonly selectedTask = signal('');
  protected readonly locale = inject(LocalizationService);
  protected readonly mode = signal<'timer' | 'stopwatch'>('timer');
  protected readonly panel = signal<Panel | null>(null);
  protected readonly formError = signal<FormError | null>(null);
  protected readonly presetError = signal(false);
  protected readonly presets = [25, 45, 60];
  protected readonly dialog = viewChild.required<DialogComponent>('dialog');
  protected readonly stopContext =
    signal<Awaited<ReturnType<FocusTimerService['prepareStop']>>>(undefined);
  private readonly continueButton =
    viewChild<ElementRef<HTMLButtonElement>>('continueButton');
  private readonly primary =
    viewChild<ElementRef<HTMLButtonElement>>('primary');
  private readonly title = inject(Title);
  private readonly injector = inject(Injector);
  protected readonly text = computed(
    () => focusMessages[this.locale.language()],
  );
  protected readonly blocked = computed(
    () => this.timer.busy() || this.timer.hasError(),
  );
  protected readonly customHours = computed(() =>
    Math.floor(this.timer.settings().focusDurationMinutes / 60),
  );
  protected readonly customMinutes = computed(
    () => this.timer.settings().focusDurationMinutes % 60,
  );
  protected readonly canSave = computed(() => {
    const active = this.stopContext()?.active;
    return (
      active?.type === 'timer' ||
      (active?.type === 'stopwatch' && active.accumulatedActiveMs >= 1000)
    );
  });
  protected readonly dialogHeading = computed(() => {
    if (this.panel() === 'duration') return this.text().custom;
    if (this.panel() === 'settings') return this.text().settings;
    return this.stopContext()?.active.type === 'stopwatch'
      ? this.text().stopWatchTitle
      : this.text().stopTitle;
  });
  protected readonly heading = computed(() => {
    const type = this.timer.active()?.type;
    const pending = this.timer.pendingBreak();
    if (type === 'long-break' || pending === 'long')
      return this.text().longBreak;
    if (type === 'short-break' || pending === 'short')
      return this.text().shortBreak;
    return (type ?? this.mode()) === 'stopwatch'
      ? this.text().stopwatch
      : this.text().mode;
  });
  private readonly digits = computed(
    () =>
      new Intl.NumberFormat(this.locale.language(), {
        minimumIntegerDigits: 2,
        useGrouping: false,
      }),
  );
  private readonly minutes = computed(
    () =>
      new Intl.NumberFormat(this.locale.language(), {
        style: 'unit',
        unit: 'minute',
        unitDisplay: 'short',
      }),
  );
  protected readonly display = computed(() => {
    const seconds =
      this.timer.phase() === 'idle' && this.mode() === 'stopwatch'
        ? 0
        : this.timer.seconds();
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds / 60) % 60;
    return (hours ? [hours, minutes, seconds % 60] : [minutes, seconds % 60])
      .map((value) => this.digits().format(value))
      .join(':');
  });
  protected readonly action = computed(() => {
    const phase = this.timer.phase();
    if (phase === 'running') return this.text().pause;
    if (phase === 'paused') return this.text().resume;
    if (phase === 'completed') return this.text().startBreak;
    return this.text().start;
  });

  constructor() {
    effect(() => this.title.setTitle(this.locale.text().focus + ' · Doop'));
    effect(() => {
      if (this.timer.taskUnavailable()) {
        this.selectedTask.set('');
        void this.tasks.retry();
      }
    });
  }

  protected minuteLabel(minutes: number): string {
    return this.minutes().format(minutes);
  }

  protected async preset(minutes: number): Promise<void> {
    if (this.blocked()) return;
    this.presetError.set(false);
    try {
      await this.timer.configure({ focusDurationMinutes: minutes });
    } catch {
      this.presetError.set(true);
    }
  }

  protected open(panel: Panel, trigger: HTMLElement): void {
    if (this.blocked()) return;
    this.formError.set(null);
    this.presetError.set(false);
    this.panel.set(panel);
    this.dialog().open(trigger);
    afterNextRender(() => this.continueButton()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  protected async openStop(trigger: HTMLElement): Promise<void> {
    const context = await this.timer.prepareStop();
    if (context) {
      if (context.active.type === 'stopwatch') this.mode.set('stopwatch');
      this.stopContext.set(context);
      this.open('stop', trigger);
    }
  }

  protected closed(): void {
    const context = this.stopContext();
    this.stopContext.set(undefined);
    this.panel.set(null);
    if (context?.resume) void this.timer.stopDecision(context.active, 'resume');
  }

  protected async decide(action: 'save' | 'discard'): Promise<void> {
    const context = this.stopContext();
    if (!context || this.blocked() || (action === 'save' && !this.canSave()))
      return;
    const result = await this.timer.stopDecision(context.active, action);
    if (result === 'committed' || result === 'conflict') this.finishStop();
  }

  protected async retryStop(): Promise<void> {
    await this.timer.retry();
    if (!this.timer.hasError()) this.finishStop();
  }

  private finishStop(): void {
    this.stopContext.set(undefined);
    this.dialog().close();
  }

  protected async saveSettings(
    event: SubmitEvent,
    form: HTMLFormElement,
  ): Promise<void> {
    event.preventDefault();
    if (this.blocked()) return;
    this.formError.set(null);
    const value = (name: string) => {
      const field = form.elements.namedItem(name);
      return field instanceof HTMLInputElement ? field.valueAsNumber : NaN;
    };
    try {
      if (this.panel() === 'duration') {
        const hours = value('hours');
        const minutes = value('minutes');
        const duration = hours * 60 + minutes;
        if (
          !Number.isInteger(hours) ||
          hours < 0 ||
          minutes < 0 ||
          minutes > 55 ||
          minutes % 5 !== 0 ||
          !validFocusMinutes(duration)
        ) {
          this.formError.set('duration');
          form.querySelector<HTMLInputElement>('input')?.focus();
          return;
        }
        await this.timer.configure({ focusDurationMinutes: duration });
      } else {
        for (const field of ['short', 'long', 'frequency'] as const) {
          const max = field === 'short' ? 60 : field === 'long' ? 120 : 12;
          if (!validBreakSetting(value(field), max)) {
            this.formError.set(field);
            form
              .querySelector<HTMLInputElement>('[name="' + field + '"]')
              ?.focus();
            return;
          }
        }
        const transition = new FormData(form).get('transition');
        await this.timer.configure({
          shortBreakDurationMinutes: value('short'),
          longBreakDurationMinutes: value('long'),
          focusSessionsBeforeLongBreak: value('frequency'),
          breakTransition: transition === 'manual' ? 'manual' : 'automatic',
        });
      }
      this.dialog().close();
    } catch {
      this.formError.set('write');
    }
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
