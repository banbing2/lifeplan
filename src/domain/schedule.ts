import { getPlanDisplayTime } from './plan-time';
import type { PlanTimeInput } from './plan-time';

/** 设计稿当前展示的日程日期条数据。 */
export const scheduleDays = [
  { day: 14, weekday: '周四' },
  { day: 15, weekday: '周五' },
  { day: 16, weekday: '周六' },
  { day: 17, weekday: '周日' },
  { day: 18, weekday: '周一' },
  { day: 19, weekday: '周二' },
  { day: 20, weekday: '周三' },
] as const;

/** 生成日程页顶部的完整日期标题。 */
export function getScheduleDateLabel(day: number) {
  const date = scheduleDays.find((item) => item.day === day);
  return `2026年8月${day}日 ${date?.weekday ?? ''}`.trim();
}

const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** 将 YYYY-MM-DD 转为包含真实星期的中文日期。 */
export function getPlanDateLabel(dateKey: string, includeYear = true) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const weekday = weekdayLabels[new Date(year, month - 1, day).getDay()];
  const date = `${month}月${day}日（${weekday}）`;
  return includeYear ? `${year}年${date}` : date;
}

/** 详情日期时间展示所需的结构感知计划字段。 */
export type PlanDateTimeInput = PlanTimeInput & { dateKey: string };

/** 组合详情页使用的结构感知计划日期与时间描述。 */
export function getPlanDateTimeLabel(plan: PlanDateTimeInput) {
  return `${getPlanDateLabel(plan.dateKey, false)} ${getPlanDisplayTime(plan).label}`;
}
