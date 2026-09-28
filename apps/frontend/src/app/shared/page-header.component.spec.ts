// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// These source-level checks protect template/style structure; this project has
// no DOM test environment, so they do not claim to verify rendered behavior.
const source = readFileSync(join(__dirname, 'page-header.component.ts'), 'utf8');

describe('PageHeaderComponent structural contracts', () => {
  it('exposes the current page title as a level-one heading', () => {
    expect(source).toMatch(/<h1\b[^>]*class="page-title"[^>]*>\s*\{\{\s*title\(\)\s*\}\}\s*<\/h1>/);
  });

  it('keeps a compact mobile title and actions/logout within the toolbar', () => {
    expect(source).toMatch(/\.page-title\s*\{[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/s);
    expect(source).toMatch(/\.page-actions/);
    expect(source).toMatch(/class="logout-icon"[^>]*aria-hidden="true"/);
    expect(source).toMatch(/class="logout-label"/);
    expect(source).toMatch(/aria-label="Cerrar sesión"/);
    expect(source).toMatch(/@media\s*\(max-width:\s*620px\)/);
  });

  it('does not clip projected actions and gives them compact intrinsic sizing', () => {
    // Source contract only: without a DOM environment this cannot measure layout.
    expect(source).not.toMatch(/\.page-actions\s*\{[^}]*overflow\s*:\s*hidden/s);
    expect(source).not.toMatch(/ion-toolbar\s*\{[^}]*--overflow\s*:\s*hidden/s);
    expect(source).not.toMatch(/ion-button\[header-actions\][^{]*\{[^}]*max-width\s*:\s*30vw/s);
    expect(source).toMatch(/ion-button\[header-actions\][^{]*\{[^}]*white-space\s*:\s*nowrap/s);
    expect(source).toMatch(/ion-button\[header-actions\][^{]*\{[^}]*--padding-start\s*:\s*5px/s);
    expect(source).toMatch(/ion-button\[header-actions\][^{]*\{[^}]*--padding-end\s*:\s*5px/s);
  });
});
