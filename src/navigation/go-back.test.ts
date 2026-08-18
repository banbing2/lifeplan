import { describe, expect, it, vi } from 'vitest';

import { goBackOrHome, handleCompletionToggleSuccess } from './go-back';

describe('goBackOrHome', () => {
  it('uses browser history when the detail page was opened from the app', () => {
    const router = { canGoBack: () => true, back: vi.fn(), replace: vi.fn() };

    goBackOrHome(router);

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('returns direct detail visits to the home screen', () => {
    const router = { canGoBack: () => false, back: vi.fn(), replace: vi.fn() };

    goBackOrHome(router);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});

describe('handleCompletionToggleSuccess', () => {
  it('returns to the source list after marking a pending plan complete', async () => {
    const router = { canGoBack: () => true, back: vi.fn(), replace: vi.fn() };
    const reloadPlan = vi.fn();

    await handleCompletionToggleSuccess({ wasCompleted: false, router, reloadPlan });

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
    expect(reloadPlan).not.toHaveBeenCalled();
  });

  it('falls back to home after completion when detail has no navigation history', async () => {
    const router = { canGoBack: () => false, back: vi.fn(), replace: vi.fn() };
    const reloadPlan = vi.fn();

    await handleCompletionToggleSuccess({ wasCompleted: false, router, reloadPlan });

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(reloadPlan).not.toHaveBeenCalled();
  });

  it('stays on detail and reloads after cancelling completion', async () => {
    const router = { canGoBack: () => true, back: vi.fn(), replace: vi.fn() };
    const reloadPlan = vi.fn().mockResolvedValue(undefined);

    await handleCompletionToggleSuccess({ wasCompleted: true, router, reloadPlan });

    expect(reloadPlan).toHaveBeenCalledOnce();
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
