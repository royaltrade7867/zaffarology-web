/**
 * Pure id and date-key helpers.
 *
 * These used to live in `lib/storage`, which imports AsyncStorage — meaning any
 * module needing just `todayKey()` dragged in a native dependency. Keeping them
 * here lets the pillar schemas and the reporting layer stay pure, so they can run
 * (and be tested) outside the React Native runtime.
 */

export const newId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Today as a local-time ISO day key (`YYYY-MM-DD`).
 *  Deliberately local, not UTC: `toISOString()` shifts the day backwards in
 *  negative-offset timezones, which would mis-date a user's rollover. */
export const todayKey = (): string => {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};
