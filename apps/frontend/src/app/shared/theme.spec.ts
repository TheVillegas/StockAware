// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const asset = (relativePath) =>
  readFileSync(join(__dirname, relativePath), 'utf8');

const SA_TOKENS = {
  '--sa-bg': '#f3f5f7',
  '--sa-surface': '#ffffff',
  '--sa-surface-2': '#f7f9fa',
  '--sa-ink': '#14212b',
  '--sa-ink-soft': '#4a5866',
  '--sa-line': '#edf0f3',
  '--sa-line-strong': '#e1e6eb',
  '--sa-border-input': '#cbd3db',
  '--sa-accent': '#2f5bdb',
  '--sa-accent-hover': '#2449b8',
  '--sa-accent-ink': '#ffffff',
  '--sa-accent-tint': '#eaf0ff',
  '--sa-shell': '#14212b',
  '--sa-shell-2': '#1e2d39',
  '--sa-shell-line': '#2b3a47',
  '--sa-shell-ink': '#d5dde5',
  '--sa-shell-soft': '#9aa8b6',
  '--sa-shell-mark': '#ffffff',
  '--sa-shell-strong': '#ffffff',
  '--sa-ok-fg': '#17703f',
  '--sa-ok-bg': '#e4f4ea',
  '--sa-ok-line': '#bfe3cb',
  '--sa-warn-fg': '#8a5200',
  '--sa-warn-bg': '#fff3d6',
  '--sa-warn-line': '#f2dca6',
  '--sa-crit-fg': '#b42318',
  '--sa-crit-bg': '#fdecea',
  '--sa-crit-line': '#f5c9c3',
  '--sa-info-fg': '#1f44b0',
  '--sa-info-bg': '#eaf0ff',
  '--sa-info-line': '#c9d6fb',
  '--sa-crit': '#b42318',
  '--sa-font-sans':
    '"Public Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  '--sa-font-mono':
    '"IBM Plex Mono", ui-monospace, "Cascadia Mono", Consolas, monospace',
  '--sa-text-label': '12px',
  '--sa-text-meta': '12px',
  '--sa-text-dense': '13px',
  '--sa-text-body': '14px',
  '--sa-text-input-mobile': '16px',
  '--sa-text-title': '16px',
  '--sa-text-page': '26px',
  '--sa-text-kpi': '30px',
  '--sa-space-1': '4px',
  '--sa-space-2': '8px',
  '--sa-space-3': '12px',
  '--sa-space-4': '16px',
  '--sa-space-5': '24px',
  '--sa-space-6': '32px',
  '--sa-radius': '8px',
  '--sa-radius-pill': '999px',
  '--sa-border': '1px',
  '--sa-focus-ring': '2px solid var(--sa-accent)',
  '--sa-focus-offset': '2px',
  '--sa-control-h': '40px',
  '--sa-control-h-sm': '34px',
  '--sa-topbar-h': '56px',
  '--sa-menu-w': '248px',
  '--sa-ep1-canvas': '#f3f5f7',
  '--sa-ep1-surface': '#ffffff',
  '--sa-ep1-surface-muted': '#f7f9fa',
  '--sa-ep1-border': '#e1e6eb',
  '--sa-ep1-border-strong': '#cbd3db',
  '--sa-ep1-primary': '#2f5bdb',
  '--sa-ep1-on-primary': '#ffffff',
  '--sa-ep1-text': '#14212b',
  '--sa-ep1-text-muted': '#4a5866',
  '--sa-ep1-text-subtle': '#6b7785',
  '--sa-ep1-radius': '8px',
  '--sa-ep1-radius-card': '12px',
  '--sa-ep1-radius-mark': '10px',
  '--sa-ep1-shadow-card': 'none',
  '--sa-ep1-focus': '0 0 0 3px rgba(47, 91, 219, 0.2)',
  '--sa-ep1-font': 'var(--sa-font-sans)',
};

const escapeForRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('theme foundation contract', () => {
  it('imports fonts then theme files in order in styles.css', () => {
    const styles = asset('../../styles.css');
    const order = [
      '@fontsource/public-sans/400.css',
      '@fontsource/public-sans/500.css',
      '@fontsource/public-sans/600.css',
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

  it('opts the login and the authenticated shell into the EP1 prototype palette', () => {
    const tokens = asset('../../theme/tokens.css');
    const components = asset('../../theme/components.css');
    const login = asset('../login/login.page.ts');
    expect(tokens).toMatch(/--sa-shell:\s*#14212b/);
    expect(tokens).toMatch(/--sa-accent:\s*#2f5bdb/);
    expect(components).toMatch(/\[data-visual="ep1"\]/);
    expect(login).toMatch(/data-visual="ep1"/);
    expect(asset('../app.component.ts')).toMatch(/ion-split-pane[^>]*data-visual="ep1"/);
    expect(login).toMatch(/<sa-field/);
    expect(login).toMatch(/<ion-button/);
    expect(login).toMatch(/Ingresa a StockAware/);
    expect(login).not.toMatch(/Ingresá/);
    expect(login).not.toMatch(/<button/);
    expect(login).not.toMatch(/<h1>ERP<\/h1>/);
    const field = asset('../shared/sa-field.component.ts');
    expect(field).toMatch(/<ion-input/);
    expect(field).not.toMatch(/fill="outline"/);
    expect(asset('../core/auth.service.ts')).toMatch(/Ingresa de nuevo/);
    expect(asset('../core/auth.service.ts')).not.toMatch(/Ingresá/);
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
