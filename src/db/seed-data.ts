import type { ExpenseCategory, Plan, PlanAccent, PlanIcon, PlanStatus, StageVariant } from '../domain/models';

/** 紧凑费用种子：[名称、分类、整数分金额]。 */
type ExpenseSeed = [name: string, category: ExpenseCategory, amountCents: number];
/** 紧凑方案种子：[ID、名称、备注、费用列表]。 */
type VariantSeed = [id: string, name: string, notes: string, expenses: ExpenseSeed[]];

/** 将紧凑的演示配置展开为完整的阶段领域对象。 */
function makePlan(config: {
  id: string; title: string; notes: string; dateKey: string; startTime: string | null;
  status?: PlanStatus; completedAt?: number | null; isFeatured: boolean; accent: PlanAccent; icon: PlanIcon;
  selectedVariantId: string | null; variants: VariantSeed[];
}): Plan {
  const stageId = `${config.id}-journey-stage`;
  const variants = config.variants.map<StageVariant>(([id, name, notes, expenses], variantIndex) => ({
    id, stageId, name, notes, sortOrder: variantIndex,
    expenses: expenses.map(([expenseName, category, amountCents], expenseIndex) => ({
      id: `${id}-expense-${expenseIndex + 1}`, variantId: id, name: expenseName, category, amountCents, sortOrder: expenseIndex,
    })),
  }));
  return {
    id: config.id, structureKind: 'journey', title: config.title, notes: config.notes, dateKey: config.dateKey, time: null,
    isAllDay: false, status: config.status ?? 'pending', completedAt: config.completedAt ?? null,
    isFeatured: config.isFeatured, accent: config.accent, icon: config.icon,
    stages: variants.length ? [{
      id: stageId, planId: config.id, kind: 'choice', name: '行程方案', notes: '', startTime: config.startTime,
      selectedVariantId: config.selectedVariantId, sortOrder: 0, variants,
    }] : [],
  };
}

/** 全新数据库首次启动时写入的阶段化演示计划。 */
export const seedPlans: Plan[] = [
  makePlan({
    id: 'weekend-trip', title: '周末出行计划', notes: '和朋友一起去周边放松放松：）', dateKey: '2026-08-16',
    startTime: '08:30', isFeatured: true, accent: 'green', icon: 'image', selectedVariantId: 'zhaoqing-day-trip',
    variants: [
      ['zhaoqing-day-trip', '肇庆一日游方案', '经济实惠，景点丰富', [['交通', 'transport', 12600], ['门票', 'ticket', 12000], ['餐饮', 'food', 14000], ['其他', 'other', 3000]]],
      ['huizhou-day-trip', '惠州一日游方案', '海边风景，适合放松', [['交通', 'transport', 19800], ['门票', 'ticket', 12000], ['餐饮', 'food', 20000], ['其他', 'other', 7000]]],
      ['shenzhen-day-trip', '深圳一日游方案', '城市体验，购物方便', [['交通', 'transport', 23000], ['门票', 'ticket', 19000], ['餐饮', 'food', 22000], ['其他', 'other', 5800]]],
    ],
  }),
  makePlan({ id: 'friends-dinner', title: '朋友聚餐', notes: '三个人的周日晚餐', dateKey: '2026-08-17', startTime: '19:00', isFeatured: true, accent: 'orange', icon: 'utensils', selectedVariantId: 'friends-dinner-option', variants: [['friends-dinner-option', '海底捞3人套餐', '交通便利，座位宽松', [['交通', 'transport', 5800], ['餐饮', 'food', 30000]]]] }),
  makePlan({ id: 'shopping-plan', title: '购物计划', notes: '比较品牌和购买组合', dateKey: '2026-08-21', startTime: null, isFeatured: true, accent: 'blue', icon: 'shopping-bag', selectedVariantId: null, variants: [['brand-a-option', '品牌A组合方案', '耳机和保护配件', [['商品', 'shopping', 68800]]]] }),
  makePlan({ id: 'huizhou-trip', title: '惠州两日游', notes: '周末短途旅行', dateKey: '2026-08-23', startTime: null, status: 'completed', completedAt: 1787443200000, isFeatured: true, accent: 'purple', icon: 'tent', selectedVariantId: 'rail-hotel-option', variants: [['rail-hotel-option', '高铁+酒店方案', '省心的两日安排', [['交通', 'transport', 18000], ['住宿', 'lodging', 38200], ['活动', 'activity', 30000]]]] }),
  makePlan({ id: 'movie-night', title: '看电影', notes: '晚间电影安排', dateKey: '2026-08-30', startTime: '20:00', status: 'completed', completedAt: 1788048000000, isFeatured: true, accent: 'red', icon: 'film', selectedVariantId: 'movie-option', variants: [['movie-option', '双人观影方案', '包含饮品小食', [['电影票', 'ticket', 9800], ['小食', 'food', 6000]]]] }),
  makePlan({ id: 'birthday-gift', title: '生日礼物准备', notes: '提前准备礼物与包装', dateKey: '2026-08-31', startTime: null, isFeatured: true, accent: 'teal', icon: 'gift', selectedVariantId: 'gift-option', variants: [['gift-option', '礼物+包装方案', '简洁实用的组合', [['礼物', 'shopping', 58000], ['包装', 'other', 4200]]]] }),
  makePlan({ id: 'lunch-plan', title: '午餐安排', notes: '当地特色餐厅', dateKey: '2026-08-16', startTime: '12:30', isFeatured: false, accent: 'orange', icon: 'utensils', selectedVariantId: 'lunch-option', variants: [['lunch-option', '本地特色餐厅', '午间用餐', [['餐饮', 'food', 12600]]]] }),
  makePlan({ id: 'scenic-plan', title: '星湖景区游玩', notes: '门票和游船', dateKey: '2026-08-16', startTime: '14:00', isFeatured: false, accent: 'purple', icon: 'star', selectedVariantId: 'scenic-option', variants: [['scenic-option', '门票+游船', '下午游玩', [['活动', 'activity', 9800]]]] }),
  makePlan({ id: 'dinner-plan', title: '晚餐安排', notes: '农家乐晚餐', dateKey: '2026-08-16', startTime: '19:00', isFeatured: false, accent: 'blue', icon: 'coffee', selectedVariantId: 'dinner-option', variants: [['dinner-option', '农家乐晚餐', '晚间用餐', [['餐饮', 'food', 17600]]]] }),
];
