import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

export const appearances = ['light', 'dark', 'system'] as const;
export const themes = [
  'emerald',
  'slate',
  'indigo',
  'teal',
  'rose',
  'amber',
] as const;
export const languages = ['en', 'ar'] as const;

export interface Preferences {
  appearance: (typeof appearances)[number];
  theme: (typeof themes)[number];
  language: (typeof languages)[number];
}

export const defaultPreferences: Preferences = {
  appearance: 'system',
  theme: 'emerald',
  language: 'en',
};
const storageKey = 'doop.preferences';
export const taskViewKey = 'doop.tasks.view';

function isChoice<T extends string>(
  choices: readonly T[],
  value: unknown,
): value is T {
  return choices.some((choice) => choice === value);
}

export function parsePreferences(raw: string): Preferences {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null) return defaultPreferences;

  return {
    appearance:
      'appearance' in value && isChoice(appearances, value.appearance)
        ? value.appearance
        : defaultPreferences.appearance,
    theme:
      'theme' in value && isChoice(themes, value.theme)
        ? value.theme
        : defaultPreferences.theme,
    language:
      'language' in value && isChoice(languages, value.language)
        ? value.language
        : defaultPreferences.language,
  };
}

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly document = inject(DOCUMENT);
  private readonly storageError = signal(false);
  private readonly state = signal(
    this.legacyPreferences() ?? defaultPreferences,
  );
  private commit?: (
    key: keyof Preferences,
    value: Preferences[keyof Preferences],
  ) => Promise<Preferences>;
  private edit = 0;
  private pending = false;

  readonly current = this.state.asReadonly();
  readonly storageUnavailable = this.storageError.asReadonly();

  constructor() {
    effect(() => {
      const { language, appearance, theme } = this.current();
      const root = this.document.documentElement;
      root.lang = language;
      root.dir = language === 'ar' ? 'rtl' : 'ltr';
      root.dataset['appearance'] = appearance;
      root.dataset['theme'] = theme;
    });
  }

  connect(commit: NonNullable<PreferencesService['commit']>): void {
    this.commit = commit;
  }

  adopt(value: Preferences, replaced = false): void {
    if (replaced) {
      this.edit++;
      this.pending = false;
      this.storageError.set(false);
    }
    if (!this.pending && !this.storageError()) this.state.set(value);
    try {
      const storage = this.storage();
      if (replaced) storage.removeItem(taskViewKey);
      storage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // The synchronous theme cache and the task view are presentation only.
    }
  }

  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    const request = ++this.edit;
    this.pending = true;
    this.state.update((current) => ({ ...current, [key]: value }));
    const commit = this.commit;
    if (!commit) {
      this.pending = false;
      this.storageError.set(true);
      return;
    }
    void commit(key, value).then(
      (saved) => {
        if (request !== this.edit) return;
        this.pending = false;
        this.storageError.set(false);
        this.adopt(saved);
      },
      () => {
        if (request !== this.edit) return;
        this.pending = false;
        this.storageError.set(true);
      },
    );
  }

  private storage(): Storage {
    const storage = this.document.defaultView?.localStorage;
    if (!storage) throw new Error('Local preferences storage is unavailable');
    return storage;
  }

  legacyPreferences(): Preferences | null {
    let raw: string | null;
    try {
      raw = this.storage().getItem(storageKey);
    } catch {
      return null;
    }
    try {
      return raw === null ? defaultPreferences : parsePreferences(raw);
    } catch {
      return defaultPreferences;
    }
  }
}
