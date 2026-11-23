import { expect, it } from 'vitest';
import { parsePreferences } from './preferences.service';

it('retains valid choices and replaces unsupported values independently', () => {
  expect(
    parsePreferences('{"appearance":"dark","language":"ar","theme":"unknown"}'),
  ).toEqual({
    appearance: 'dark',
    language: 'ar',
    theme: 'emerald',
  });
});
