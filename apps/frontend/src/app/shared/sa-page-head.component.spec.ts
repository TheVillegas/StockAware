// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Source-level contracts: the project has no DOM test environment.
const component = readFileSync(join(__dirname, 'sa-page-head.component.ts'), 'utf8');
const css = readFileSync(join(__dirname, '../../theme/components.css'), 'utf8');
const stock = readFileSync(join(__dirname, '../bodega/stock.page.ts'), 'utf8');
const phone = css.match(/\/\* Phones: the top bar shows the brand[\s\S]*?@media \(max-width: 767\.98px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';

describe('SaPageHead phone heading', () => {
  it('keeps the page title visible on phones, since the top bar now shows the brand', () => {
    expect(phone.length).toBeGreaterThan(0);
    const unscoped = phone.replace(/\.sa-page-head--no-phone-title[^{]*\{[^}]*\}/g, '');
    expect(unscoped).not.toMatch(/\.sa-page-head__title\s*[,{][^}]*display:\s*none/);
  });

  it('lets a page with its own phone intro hide the duplicate title and tile', () => {
    expect(component).toMatch(/phoneTitle = input\(true\)/);
    expect(component).toMatch(/'\[class\.sa-page-head--no-phone-title\]': '!phoneTitle\(\)'/);
    expect(phone).toMatch(/\.sa-page-head--no-phone-title \.sa-page-head__tile,\s*\.sa-page-head--no-phone-title \.sa-page-head__title\s*\{\s*display:\s*none/);
    expect(stock).toMatch(/<sa-page-head title="Stock"[^>]*\[phoneTitle\]="false"/);
  });

  it('opts out of the phone title only on Stock', () => {
    const { readdirSync, statSync } = require('node:fs');
    const walk = (dir) => readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
    const hits = walk(join(__dirname, '..')).filter((path) => path.endsWith('.ts')
      && !path.endsWith('.spec.ts') && /<sa-page-head\b[^>]*\[phoneTitle\]="false"/.test(readFileSync(path, 'utf8')));
    expect(hits.map((path) => path.split('/').pop())).toEqual(['stock.page.ts']);
  });

  it('keeps page actions full width on phones', () => {
    expect(phone).toMatch(/\.sa-page-head__actions\s*\{\s*inline-size:\s*100%/);
  });
});
