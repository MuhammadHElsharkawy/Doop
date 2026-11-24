declare const localDateBrand: unique symbol;
declare const instantBrand: unique symbol;

export type LocalDate = string & { readonly [localDateBrand]: true };
export type IsoInstant = string & { readonly [instantBrand]: true };

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function isIsoInstant(value: unknown): value is IsoInstant {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  )
    return false;
  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) && instant.toISOString() === value;
}

export function toLocalDate(date: Date): LocalDate {
  const value = projectLocalDate(date);
  if (value === undefined) throw new RangeError('Invalid local date');
  return value;
}

export function projectLocalDate(date: Date): LocalDate | undefined {
  const localYear = date.getFullYear();
  if (!Number.isInteger(localYear) || localYear < 0 || localYear > 9999)
    return undefined;
  const year = String(localYear).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const value = [year, month, day].join('-');
  return isLocalDate(value) ? value : undefined;
}

export function toIsoInstant(date: Date): IsoInstant {
  const value = date.toISOString();
  if (!isIsoInstant(value))
    throw new RangeError('Instant outside supported range');
  return value;
}

export function addCalendarDays(date: LocalDate, days: number): LocalDate {
  if (!Number.isSafeInteger(days))
    throw new RangeError('Invalid number of days');
  const calendar = new Date(date + 'T00:00:00.000Z');
  calendar.setUTCDate(calendar.getUTCDate() + days);
  const value = calendar.toISOString().slice(0, 10);
  if (!isLocalDate(value)) throw new RangeError('Date outside supported range');
  return value;
}
