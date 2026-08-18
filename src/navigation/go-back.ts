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
