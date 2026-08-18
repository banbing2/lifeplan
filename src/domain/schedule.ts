import { getPlanDisplayTime } from './plan-time';
import type { PlanTimeInput } from './plan-time';

const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** 日程日期条中的一个真实本地日期。 */
export type ScheduleDay = {
  dateKey: string;
  day: number;
  weekday: (typeof weekdayLabels)[number];
};

/** 完整月历中的日期；相邻月份日期也保留，便于维持固定六行布局。 */
export type MonthCalendarDay = {
  dateKey: string;
  day: number;
  isCurrentMonth: boolean;
};

/** 将本地 Date 格式化为不受 UTC 时区偏移影响的 YYYY-MM-DD。 */
export function getLocalDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/** 从完整日期键中取得月份查询键。 */
export function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

/** 按天移动本地日期，使用中午避免夏令时边界造成日期漂移。 */
export function shiftDateKey(dateKey: string, offset: number) {
  const date = parseLocalDateKey(dateKey);
  date.setDate(date.getDate() + offset);
  return getLocalDateKey(date);
}

/** 按月移动 YYYY-MM 查询键，并正确处理跨年。 */
export function shiftMonthKey(monthKey: string, offset: number) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1, 12);
  return getMonthKey(getLocalDateKey(date));
}

/** 生成选中日期所在月份从 1 日到月底的完整日程日期条。 */
export function createScheduleDays(selectedDateKey: string): ScheduleDay[] {
  const monthKey = getMonthKey(selectedDateKey);
  const [year, month] = monthKey.split('-').map(Number);
  const dayCount = new Date(year, month, 0, 12).getDate();
  const firstDateKey = `${monthKey}-01`;

  return Array.from({ length: dayCount }, (_, index) => {
    const dateKey = shiftDateKey(firstDateKey, index);
    const date = parseLocalDateKey(dateKey);
    return { dateKey, day: date.getDate(), weekday: weekdayLabels[date.getDay()] };
  });
}

/**
 * 计算横向日期条的滚动位置，使选中日期尽量居中。
 * 常量与日期项 42px 宽、10px 间距及 16px 起始留白保持一致。
 */
export function getScheduleDateScrollOffset(selectedDateKey: string, viewportWidth: number) {
  const dayIndex = Number(selectedDateKey.slice(8, 10)) - 1;
  const selectedCenter = spacingForDateStrip.padding + dayIndex * spacingForDateStrip.stride
    + spacingForDateStrip.itemWidth / 2;
  return Math.max(0, selectedCenter - viewportWidth / 2);
}

const spacingForDateStrip = { padding: 16, itemWidth: 42, stride: 52 } as const;

/** 生成周一开头、固定六行的完整月历，并包含首尾相邻月份日期。 */
export function createMonthCalendarDays(monthKey: string): MonthCalendarDay[] {
  const [year, month] = monthKey.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1, 12);
  const mondayBasedOffset = (firstDay.getDay() + 6) % 7;
  const firstDateKey = getLocalDateKey(new Date(year, month - 1, 1 - mondayBasedOffset, 12));

  return Array.from({ length: 42 }, (_, index) => {
    const dateKey = shiftDateKey(firstDateKey, index);
    const date = parseLocalDateKey(dateKey);
    return { dateKey, day: date.getDate(), isCurrentMonth: getMonthKey(dateKey) === monthKey };
  });
}

/** 生成日程页顶部的完整真实日期标题。 */
export function getScheduleDateLabel(dateKey: string) {
  const date = parseLocalDateKey(dateKey);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekdayLabels[date.getDay()]}`;
}

/** 将 YYYY-MM-DD 转为包含真实星期的中文日期。 */
export function getPlanDateLabel(dateKey: string, includeYear = true) {
  const value = parseLocalDateKey(dateKey);
  const weekday = weekdayLabels[value.getDay()];
  const date = `${value.getMonth() + 1}月${value.getDate()}日（${weekday}）`;
  return includeYear ? `${value.getFullYear()}年${date}` : date;
}

/** 将日期键解析为本地中午，统一供日期移动和星期计算使用。 */
function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

/** 详情日期时间展示所需的结构感知计划字段。 */
export type PlanDateTimeInput = PlanTimeInput & { dateKey: string };

/** 组合详情页使用的结构感知计划日期与时间描述。 */
export function getPlanDateTimeLabel(plan: PlanDateTimeInput) {
  return `${getPlanDateLabel(plan.dateKey, false)} ${getPlanDisplayTime(plan).label}`;
}
