import { describe, expect, it, vi } from 'vitest';

import { goBackOrHome } from './go-back';

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
