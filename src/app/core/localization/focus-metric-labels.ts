export const focusGoalMessages = {
  en: {
    sessions: 'Focus Goal',
    of: '{count} of {goal} sessions',
    remaining: 'Sessions remaining: {count}',
    goalReached: 'Daily goal reached',
  },
  ar: {
    sessions: 'هدف التركيز',
    of: '{count} من {goal} جلسات',
    remaining: 'الجلسات المتبقية: {count}',
    goalReached: 'تحقّق الهدف اليومي',
  },
} as const;

export function focusDurationFormatter(
  language: string,
): (seconds: number) => string {
  const units = (['hour', 'minute', 'second'] as const).map(
    (unit) =>
      new Intl.NumberFormat(language, {
        style: 'unit',
        unit,
        unitDisplay: 'short',
      }),
  );
  return (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds / 60) % 60;
    return [hours, minutes, seconds % 60]
      .map((value, index) =>
        value || (index === 2 && !hours && !minutes)
          ? units[index].format(value)
          : '',
      )
      .filter(Boolean)
      .join(' ');
  };
}
