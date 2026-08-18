import { describe, expect, it } from 'vitest';

import { getAppFrameSafeAreaEdges } from './safe-area';

describe('getAppFrameSafeAreaEdges', () => {
  it('keeps native content above the bottom system navigation area', () => {
    expect(getAppFrameSafeAreaEdges('android')).toEqual(['top', 'right', 'bottom', 'left']);
    expect(getAppFrameSafeAreaEdges('ios')).toEqual(['top', 'right', 'bottom', 'left']);
  });

  it('does not add native insets to the simulated web phone frame', () => {
    expect(getAppFrameSafeAreaEdges('web')).toEqual([]);
  });
});
