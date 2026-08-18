import type { Edge } from 'react-native-safe-area-context';

/** Android 由系统窗口处理底部区域，其他平台由 SafeAreaView 同时保护上下边缘。 */
export function getAppFrameSafeAreaEdges(platform: string): Edge[] {
  return platform === 'web' ? [] : ['top', 'right', 'bottom', 'left'];
}
