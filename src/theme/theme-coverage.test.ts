import { describe, expect, it } from 'vitest';

declare const process: {
  cwd(): string;
  getBuiltinModule(name: 'node:fs'): { readFileSync(path: string, encoding: 'utf8'): string };
  getBuiltinModule(name: 'node:path'): { join(...parts: string[]): string };
};

const { readFileSync } = process.getBuiltinModule('node:fs');
const { join } = process.getBuiltinModule('node:path');

const themedFiles = [
  'src/components/layout/app-frame.tsx',
  'src/app/index.tsx',
  'src/app/plan/[id].tsx',
  'src/components/plans/home-controls.tsx',
  'src/components/plans/plan-list.tsx',
  'src/components/plans/plan-detail.tsx',
  'src/components/plans/plan-expense-breakdown.tsx',
  'src/components/plans/journey-timeline.tsx',
  'src/components/plans/plan-editor-screen.tsx',
  'src/components/plans/plan-editor.tsx',
  'src/components/plans/single-plan-editor.tsx',
  'src/components/plans/single-plan-time-field.tsx',
  'src/components/plans/journey-plan-editor.tsx',
  'src/components/plans/journey-stage-editor.tsx',
  'src/components/plans/fixed-stage-editor.tsx',
  'src/components/plans/choice-stage-editor.tsx',
  'src/components/plans/expense-editor.tsx',
  'src/components/plans/plan-structure-control.tsx',
  'src/components/plans/date-time-field.tsx',
  'src/components/plans/date-time-field.web.tsx',
];

describe('global theme coverage', () => {
  it.each(themedFiles)('%s consumes dynamic colors and typography', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');

    expect(source).toContain('useThemedStyles');
    expect(source).not.toMatch(/import\s*\{[^}]*\bcolors\b[^}]*\}\s*from\s*['"][^'"]*theme\/tokens['"]/s);
  });
});
