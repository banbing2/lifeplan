import { describe, expect, it } from 'vitest';

import {
  createMonthCalendarDays,
  createScheduleDays,
  getScheduleDateScrollOffset,
  getLocalDateKey,
  getMonthKey,
  getPlanDateLabel,
  getPlanDateTimeLabel,
  getScheduleDateLabel,
  shiftDateKey,
  shiftMonthKey,
} from './schedule';

describe('dynamic schedule dates', () => {
  it('uses the local calendar date as the initial date and month', () => {
    const todayKey = getLocalDateKey(new Date(2026, 7, 18, 23, 30));

    expect(todayKey).toBe('2026-08-18');
    expect(getMonthKey(todayKey)).toBe('2026-08');
    expect(getScheduleDateLabel(todayKey)).toBe('2026年8月18日 周二');
  });

  it('builds every date in the selected month', () => {
    const days = createScheduleDays('2026-08-18');

    expect(days).toHaveLength(31);
    expect(days[0]).toEqual({ dateKey: '2026-08-01', day: 1, weekday: '周六' });
    expect(days[30]).toEqual({ dateKey: '2026-08-31', day: 31, weekday: '周一' });
  });

  it('uses the real number of days for leap-year February', () => {
    expect(createScheduleDays('2028-02-10')).toHaveLength(29);
    expect(createScheduleDays('2027-02-10')).toHaveLength(28);
  });

  it('centers the selected day when the month strip is wider than the viewport', () => {
    expect(getScheduleDateScrollOffset('2026-08-01', 430)).toBe(0);
    expect(getScheduleDateScrollOffset('2026-08-18', 430)).toBe(706);
  });

  it('moves dates and months across year boundaries', () => {
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateKey('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
  });

  it('builds a six-week Monday-first calendar including adjacent month days', () => {
    const days = createMonthCalendarDays('2026-08');

    expect(days).toHaveLength(42);
    expect(days[0]).toEqual({ dateKey: '2026-07-27', day: 27, isCurrentMonth: false });
    expect(days[5]).toEqual({ dateKey: '2026-08-01', day: 1, isCurrentMonth: true });
    expect(days[41]).toEqual({ dateKey: '2026-09-06', day: 6, isCurrentMonth: false });
  });
});

describe('persisted plan date labels', () => {
  it('formats the saved date with its real weekday', () => {
    expect(getPlanDateLabel('2026-08-17')).toBe('2026年8月17日（周一）');
    expect(getPlanDateLabel('2026-08-18', false)).toBe('8月18日（周二）');
  });

  it('uses all-day or the saved time in detail metadata', () => {
    expect(getPlanDateTimeLabel({
      structureKind: 'single', dateKey: '2026-08-17', isAllDay: true, time: null,
    })).toBe('8月17日（周一） 全天');
    expect(getPlanDateTimeLabel({
      structureKind: 'single', dateKey: '2026-08-17', isAllDay: false, time: '09:45',
    })).toBe('8月17日（周一） 09:45');
  });

  it('uses the first journey stage time by sort order or reports that time is unset', () => {
    expect(getPlanDateTimeLabel({
      structureKind: 'journey',
      dateKey: '2026-08-17',
      stages: [{ startTime: '13:30', sortOrder: 2 }, { startTime: '08:30', sortOrder: 1 }],
    })).toBe('8月17日（周一） 08:30 开始');
    expect(getPlanDateTimeLabel({
      structureKind: 'journey',
      dateKey: '2026-08-17',
      stages: [{ startTime: null, sortOrder: 0 }],
    })).toBe('8月17日（周一） 时间未设置');
  });
});
