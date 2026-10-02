// @ts-nocheck
const { functionCodeFromUrl } = require('./function-code');

describe('functionCodeFromUrl', () => {
  it('extracts function code from /f/<CODE> pattern', () => {
    expect(functionCodeFromUrl('/f/MATERIAL_X_BODEGA')).toBe('MATERIAL_X_BODEGA');
  });

  it('extracts function code and ignores query and hash', () => {
    expect(functionCodeFromUrl('/f/EMITE_OC?x=1#y')).toBe('EMITE_OC');
  });

  it('decodes URL-encoded function codes', () => {
    expect(functionCodeFromUrl('/f/A%20B')).toBe('A B');
  });

  it('returns empty string for paths without /f/', () => {
    expect(functionCodeFromUrl('/inicio')).toBe('');
    expect(functionCodeFromUrl('/oc/12')).toBe('');
  });

  it('returns empty string for malformed percent encoding', () => {
    expect(functionCodeFromUrl('/f/%E0%A4%A')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(functionCodeFromUrl('')).toBe('');
  });

  it('handles paths with multiple segments after /f/', () => {
    expect(functionCodeFromUrl('/f/CODE/extra')).toBe('CODE');
  });
});