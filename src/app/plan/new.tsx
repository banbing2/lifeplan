import { useLocalSearchParams } from 'expo-router';

import { PlanEditorScreen } from '@/components/plans/plan-editor-screen';

/** 新建计划路由，接收日程页传入的可选预填日期。 */
export default function NewPlanScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();

  return <PlanEditorScreen initialDateKey={date} mode="create" />;
}
