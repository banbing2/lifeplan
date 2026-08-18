import { useRouter } from 'expo-router';

import { SettingsScreen } from '@/components/settings/settings-screen';
import { goBackOrHome } from '@/navigation/go-back';

/** 全局设置路由。 */
export default function SettingsRoute() {
  const router = useRouter();
  return <SettingsScreen onBack={() => goBackOrHome(router)} />;
}
