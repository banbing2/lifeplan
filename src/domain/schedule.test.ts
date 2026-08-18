import { describe, expect, it } from 'vitest';

import { getPlanDateLabel, getPlanDateTimeLabel, getScheduleDateLabel, scheduleDays } from './schedule';

describe('schedule date labels', () => {
  it('keeps the schedule header aligned with the visible date strip', () => {
    expect(scheduleDays).toEqual([
      { day: 14, weekday: '周四' },
      { day: 15, weekday: '周五' },
      { day: 16, weekday: '周六' },
      { day: 17, weekday: '周日' },
      { day: 18, weekday: '周一' },
      { day: 19, weekday: '周二' },
      { day: 20, weekday: '周三' },
    ]);

    expect(getScheduleDateLabel(15)).toBe('2026年8月15日 周五');
    expect(getScheduleDateLabel(16)).toBe('2026年8月16日 周六');
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
