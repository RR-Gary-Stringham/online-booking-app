export function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLocalDateTime(date: Date) {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateKeyInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatTimeInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function weekdayForDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
}

export function zonedDateTimeToUtc(dateKey: string, time: string, timeZone: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const requestedWallTime = Date.UTC(year, month - 1, day, hour, minute);
  let instant = requestedWallTime;

  // Two passes resolve normal UTC offsets and daylight-saving transitions.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(instant));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedWallTime = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
    );
    instant += requestedWallTime - representedWallTime;
  }

  return new Date(instant);
}

export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function supportedTimeZones() {
  const supportedValuesOf = (Intl as typeof Intl & {
    supportedValuesOf?: (key: 'timeZone') => string[];
  }).supportedValuesOf;
  return supportedValuesOf ? supportedValuesOf('timeZone') : [browserTimeZone(), 'UTC'];
}
