import { useLocalSearchParams } from 'expo-router';

import { PlanEditorScreen } from '@/components/plans/plan-editor-screen';

/** 编辑计划路由，将路径中的计划 ID 交给共用编辑控制器。 */
export default function EditPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <PlanEditorScreen mode="edit" planId={id} />;
}
