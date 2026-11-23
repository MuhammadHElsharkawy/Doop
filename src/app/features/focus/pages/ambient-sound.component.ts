import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import type { WorkspaceSettings } from '../../../core/domain/workspace-records';
import { LocalizationService } from '../../../core/localization/localization.service';
import { AmbientPlayerService } from '../application/ambient-player.service';
import { FocusTimerService } from '../application/focus-timer.service';
import { ambientSounds, type AmbientSound } from '../domain/ambient-audio';
import { focusExtras, soundNames } from './focus-extras-messages';

type SoundPreference = Partial<
  Pick<WorkspaceSettings, 'ambientSound' | 'ambientVolume'>
>;

@Component({
  selector: 'app-ambient-sound',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ambient-sound.component.html',
  styles: `
    input[type='range'] {
      accent-color: var(--accent);
    }
  `,
})
export class AmbientSoundComponent {
  private readonly locale = inject(LocalizationService);
  private readonly timer = inject(FocusTimerService);
  protected readonly player = inject(AmbientPlayerService);
  protected readonly sounds = ambientSounds;
  protected readonly text = computed(() => focusExtras[this.locale.language()]);
  protected readonly names = computed(() => soundNames[this.locale.language()]);
  protected readonly ready = computed(
    () => this.timer.phase() !== 'loading' && this.timer.phase() !== 'invalid',
  );
  protected readonly timerLoadingLabel = computed(() =>
    this.timer.phase() === 'invalid'
      ? this.text().settingsUnavailable
      : this.text().loadingSettings,
  );
  protected readonly playing = signal(false);
  protected readonly playError = signal(false);
  protected readonly saving = signal(false);
  protected readonly pending = signal<SoundPreference | null>(null);
  private readonly liveVolume = signal<number | null>(null);
  protected readonly sound = computed(() => {
    const draft = this.pending()?.ambientSound;
    return draft === undefined ? this.timer.settings().ambientSound : draft;
  });
  protected readonly volume = computed(
    () =>
      this.liveVolume() ??
      this.pending()?.ambientVolume ??
      this.timer.settings().ambientVolume,
  );
  protected readonly volumeLabel = computed(() =>
    new Intl.NumberFormat(this.locale.language(), { style: 'percent' }).format(
      this.volume() / 100,
    ),
  );

  constructor() {
    effect(() => {
      if (this.player.sound() && this.player.sound() !== this.sound())
        this.player.stop();
      this.player.setVolume(this.volume());
    });
  }

  protected async play(): Promise<void> {
    const sound = this.sound();
    if (!sound || this.playing() || this.player.status() === 'playing') return;
    this.playError.set(false);
    this.playing.set(true);
    try {
      await this.player.play(sound, this.volume());
    } catch {
      this.playError.set(true);
    } finally {
      this.playing.set(false);
    }
  }

  protected stop(): void {
    if (
      !this.playing() &&
      this.player.status() === 'stopped' &&
      !this.playError()
    )
      return;
    this.player.stop();
    this.playError.set(false);
  }

  protected select(value: string): void {
    const sound: AmbientSound | null =
      this.sounds.find((choice) => choice === value) ?? null;
    this.stop();
    void this.save({ ...this.pending(), ambientSound: sound });
  }

  protected previewVolume(value: number): void {
    this.liveVolume.set(value);
    this.player.setVolume(value);
  }

  protected async saveVolume(value: number): Promise<void> {
    await this.save({ ...this.pending(), ambientVolume: value });
    this.liveVolume.set(null);
  }

  protected async save(patch: SoundPreference | null): Promise<void> {
    if (!patch) return;
    this.pending.set(patch);
    if (this.saving()) return;
    this.saving.set(true);
    try {
      let draft = this.pending();
      while (draft) {
        await this.timer.configure(draft);
        if (this.pending() === draft) this.pending.set(null);
        draft = this.pending();
      }
    } catch {
      // Keep the draft so the user can retry the same preference.
    } finally {
      this.saving.set(false);
    }
  }
}
