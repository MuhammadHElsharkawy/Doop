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

const defaults: Preferences = {
  appearance: 'system',
  theme: 'emerald',
  language: 'en',
};
const storageKey = 'doop.preferences';

function isChoice<T extends string>(
  choices: readonly T[],
  value: unknown,
): value is T {
  return choices.some((choice) => choice === value);
}

export function parsePreferences(raw: string): Preferences {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null) return defaults;

  return {
    appearance:
      'appearance' in value && isChoice(appearances, value.appearance)
        ? value.appearance
        : defaults.appearance,
    theme:
      'theme' in value && isChoice(themes, value.theme)
        ? value.theme
        : defaults.theme,
    language:
      'language' in value && isChoice(languages, value.language)
        ? value.language
        : defaults.language,
  };
}

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly document = inject(DOCUMENT);
  private readonly storageError = signal(false);
  private readonly state = signal(this.read());

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

  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    const next = { ...this.state(), [key]: value };
    this.state.set(next);

    try {
      this.storage().setItem(storageKey, JSON.stringify(next));
      this.storageError.set(false);
    } catch {
      this.storageError.set(true);
    }
  }

  private storage(): Storage {
    const storage = this.document.defaultView?.localStorage;
    if (!storage) throw new Error('Local preferences storage is unavailable');
    return storage;
  }

  private read(): Preferences {
    try {
      const raw = this.storage().getItem(storageKey);
      return raw === null ? defaults : parsePreferences(raw);
    } catch {
      this.storageError.set(true);
      return defaults;
    }
  }
}
