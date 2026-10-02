// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const asset = (relativePath) =>
  readFileSync(join(__dirname, relativePath), 'utf8');

const SA_TOKENS = {
  '--sa-bg': '#f6f7f8',
  '--sa-surface': '#ffffff',
  '--sa-surface-2': '#eef1f2',
  '--sa-ink': '#12161a',
  '--sa-ink-soft': '#5a626b',
  '--sa-line': '#e3e7ea',
  '--sa-line-strong': '#d5dade',
  '--sa-border-input': '#8b949c',
  '--sa-accent': '#155e63',
  '--sa-accent-hover': '#125357',
  '--sa-accent-ink': '#ffffff',
  '--sa-accent-tint': '#e6f0f0',
  '--sa-shell': '#0e2a2c',
  '--sa-shell-2': '#12383a',
  '--sa-shell-line': '#1c3d3f',
  '--sa-shell-ink': '#cfe0df',
  '--sa-shell-soft': '#7fa3a1',
  '--sa-shell-mark': '#4fd0bd',
  '--sa-shell-strong': '#ffffff',
  '--sa-ok-fg': '#1d6b2f',
  '--sa-ok-bg': '#d6ecd8',
  '--sa-ok-line': '#b9dcbd',
  '--sa-warn-fg': '#7a5a00',
  '--sa-warn-bg': '#fbe6c8',
  '--sa-warn-line': '#eedcb8',
  '--sa-crit-fg': '#8f2019',
  '--sa-crit-bg': '#f7dcd9',
  '--sa-crit-line': '#efcccc',
  '--sa-info-fg': '#14508a',
  '--sa-info-bg': '#d9e8f7',
  '--sa-info-line': '#c2d7ee',
  '--sa-crit': '#b0281f',
  '--sa-font-sans':
    '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  '--sa-font-mono':
    '"IBM Plex Mono", ui-monospace, "Cascadia Mono", Consolas, monospace',
  '--sa-text-label': '11px',
  '--sa-text-meta': '12px',
  '--sa-text-dense': '13px',
  '--sa-text-body': '14px',
  '--sa-text-input-mobile': '16px',
  '--sa-text-title': '16px',
  '--sa-text-page': '18px',
  '--sa-text-kpi': '24px',
  '--sa-space-1': '4px',
  '--sa-space-2': '8px',
  '--sa-space-3': '12px',
  '--sa-space-4': '16px',
  '--sa-space-5': '24px',
  '--sa-space-6': '32px',
  '--sa-radius': '6px',
  '--sa-radius-pill': '3px',
  '--sa-border': '1px',
  '--sa-focus-ring': '2px solid var(--sa-accent)',
  '--sa-focus-offset': '2px',
  '--sa-control-h': '36px',
  '--sa-control-h-sm': '28px',
  '--sa-topbar-h': '48px',
  '--sa-menu-w': '240px',
};

const escapeForRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('theme foundation contract', () => {
  it('imports fonts then theme files in order in styles.css', () => {
    const styles = asset('../../styles.css');
    const order = [
      '@fontsource/ibm-plex-sans/400.css',
      '@fontsource/ibm-plex-sans/500.css',
      '@fontsource/ibm-plex-sans/600.css',
      '@fontsource/ibm-plex-mono/400.css',
      '@fontsource/ibm-plex-mono/500.css',
      '@fontsource/ibm-plex-mono/600.css',
      './theme/tokens.css',
      './theme/ionic.css',
      './theme/components.css',
    ];
    const positions = order.map((needle) => styles.indexOf(needle));
    positions.forEach((position, index) => {
      expect(position).toBeGreaterThanOrEqual(0);
      if (index > 0) {
        expect(position).toBeGreaterThan(positions[index - 1]);
      }
    });
    expect(styles).not.toMatch(/--ion-font-family:\s*system-ui/);
    expect(styles).toMatch(/\.page-content\b/);
    expect(styles).toMatch(/\.page-content--wide\b/);
  });

  it('defines every --sa-* token with the exact value in tokens.css', () => {
    const tokens = asset('../../theme/tokens.css');
    Object.entries(SA_TOKENS).forEach(([name, value]) => {
      const pattern = new RegExp(
        `${escapeForRegExp(name)}\\s*:\\s*${escapeForRegExp(value)}\\s*;`
      );
      expect(tokens).toMatch(pattern);
    });
  });

  it('applies the mobile control overrides in tokens.css', () => {
    const tokens = asset('../../theme/tokens.css');
    expect(tokens).toMatch(/max-width:\s*767\.98px/);
    expect(tokens).toMatch(/--sa-control-h:\s*44px/);
    expect(tokens).toMatch(/--sa-topbar-h:\s*56px/);
  });

  it('bridges --sa-* tokens into Ionic variables in ionic.css', () => {
    const ionic = asset('../../theme/ionic.css');
    const tokens = asset('../../theme/tokens.css');

    const colorBaseTokens = {
      primary: '--sa-accent',
      success: '--sa-ok-fg',
      warning: '--sa-warn-fg',
      danger: '--sa-crit',
      medium: '--sa-ink-soft',
      light: '--sa-surface-2',
    };

    const resolveToken = (name) => {
      const pattern = new RegExp(
        `${escapeForRegExp(name)}\\s*:\\s*(#[0-9a-fA-F]{3,6})\\s*;`
      );
      const match = tokens.match(pattern);
      expect(match).not.toBeNull();
      return match[1];
    };

    const hexToRgb = (hex) => {
      let value = hex.replace('#', '');
      if (value.length === 3) {
        value = value
          .split('')
          .map((char) => char + char)
          .join('');
      }
      const r = parseInt(value.slice(0, 2), 16);
      const g = parseInt(value.slice(2, 4), 16);
      const b = parseInt(value.slice(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    };

    Object.entries(colorBaseTokens).forEach(([color, token]) => {
      const basePattern = new RegExp(
        `--ion-color-${color}:\\s*var\\(${escapeForRegExp(token)}\\)\\s*;`
      );
      expect(ionic).toMatch(basePattern);

      const rgb = hexToRgb(resolveToken(token));
      const rgbPattern = new RegExp(
        `--ion-color-${color}-rgb:\\s*${escapeForRegExp(rgb)}\\s*;`
      );
      expect(ionic).toMatch(rgbPattern);

      ['rgb', 'contrast', 'contrast-rgb', 'shade', 'tint'].forEach((suffix) => {
        const definitionPattern = new RegExp(
          `--ion-color-${color}-${suffix}:\\s*[^;]+;`
        );
        expect(ionic).toMatch(definitionPattern);
      });
    });

    expect(ionic).toMatch(/--ion-font-family:\s*var\(--sa-font-sans\)\s*;/);
  });

  it('uses the focus tokens in the components :focus-visible rule', () => {
    const components = asset('../../theme/components.css');
    expect(components).toMatch(/:focus-visible\s*\{[^}]*outline:\s*var\(--sa-focus-ring\)/s);
    expect(components).toMatch(/:focus-visible\s*\{[^}]*outline-offset:\s*var\(--sa-focus-offset\)/s);
  });

  it('uses only tokens (no literal hex nor font-size px) in components.css', () => {
    const components = asset('../../theme/components.css');
    expect(components).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(components).not.toMatch(/font-size:\s*\d+px/);
  });

  it('defines the shared component selectors in components.css', () => {
    const components = asset('../../theme/components.css');
    const selectors = [
      '.sa-table-wrap',
      '.sa-table',
      '.sa-table .num',
      '.sa-table .code',
      '.sa-table .is-low',
      '.sa-pill',
      '.sa-pill--ok',
      '.sa-pill--warn',
      '.sa-pill--crit',
      '.sa-pill--info',
      '.sa-notice',
      '.sa-notice--ok',
      '.sa-notice--warn',
      '.sa-notice--crit',
      '.sa-notice--info',
      '.sa-link',
      '.sa-kpis',
      '.sa-kpi',
      '.sa-empty',
      '.sa-toolbar',
      '.sa-count',
      ':focus-visible',
    ];
    selectors.forEach((selector) => {
      expect(components).toContain(selector);
    });
    expect(components).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(components).toMatch(/font-family:\s*var\(--sa-font-mono\)/);
  });

  it('renders Ionic buttons in sentence case, as the spec requires', () => {
    const ionic = asset('../../theme/ionic.css');
    expect(ionic).toMatch(/ion-button\s*\{[^}]*text-transform:\s*none/);
  });

  it('pins the side menu width to the --sa-menu-w token', () => {
    const ionic = asset('../../theme/ionic.css');
    expect(ionic).toMatch(/ion-split-pane\s*\{[^}]*--side-min-width:\s*var\(--sa-menu-w\)/);
  });

  it('removes Ionic shadows from buttons and searchbars and outlines form controls', () => {
    const ionic = asset('../../theme/ionic.css');
    expect(ionic).toMatch(/ion-button\s*\{[^}]*--box-shadow:\s*none/);
    expect(ionic).toMatch(/ion-searchbar\[class\]\s*\{[^}]*--box-shadow:\s*none/);
    expect(ionic).toMatch(/ion-searchbar\s+\.searchbar-input-container\s+\.searchbar-input\s*\{[^}]*border:[^;]*var\(--sa-border-input\)/);
    expect(ionic).toMatch(/--border-color:\s*var\(--sa-border-input\)/);
  });
});
