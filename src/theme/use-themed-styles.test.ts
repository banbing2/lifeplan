import { describe, expect, it } from 'vitest';

import { createThemeTokens } from './create-theme';
import { applyThemeTypography } from './themed-style';

describe('applyThemeTypography', () => {
  it('scales text dimensions and maps relative weight roles', () => {
    const theme = createThemeTokens({ colorMode: 'light', colorScheme: 'green', fontSize: 'large', fontWeight: 'bold' }, 'light');

    expect(applyThemeTypography({ fontSize: 20, lineHeight: 24, fontWeight: '700', color: '#000' }, theme)).toEqual({
      fontSize: 23,
      lineHeight: 28,
      fontWeight: '800',
      color: '#000',
    });
  });

  it('leaves non-text dimensions unchanged', () => {
    const theme = createThemeTokens({ colorMode: 'light', colorScheme: 'green', fontSize: 'small', fontWeight: 'standard' }, 'light');

    expect(applyThemeTypography({ width: 44, height: 44, borderWidth: 1 }, theme)).toEqual({
      width: 44,
      height: 44,
      borderWidth: 1,
    });
  });
});
