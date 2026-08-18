type BackRouter = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (path: '/') => void;
};

/** 有历史记录时返回上一页，否则回到首页，避免直接打开详情时无处可退。 */
export function goBackOrHome(router: BackRouter) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace('/');
}

type CompletionToggleSuccessOptions = {
  wasCompleted: boolean;
  router: BackRouter;
  reloadPlan: () => Promise<void> | void;
};

/** 标记完成后返回来源列表；取消完成后留在详情页刷新状态。 */
export async function handleCompletionToggleSuccess({
  wasCompleted,
  router,
  reloadPlan,
}: CompletionToggleSuccessOptions) {
  if (wasCompleted) {
    await reloadPlan();
    return;
  }

  goBackOrHome(router);
}
