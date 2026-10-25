// @ts-nocheck
const { stockState } = require('./stock-state');

describe('stockState (spec 3.4)', () => {
  it('marks zero or negative stock as crit (SIN STOCK)', () => {
    expect(stockState(0, 10)).toBe('crit');
    expect(stockState(-3, 10)).toBe('crit');
  });

  it('accepts numeric strings from decimal API columns', () => {
    expect(stockState('0.00', '10')).toBe('crit');
    expect(stockState('5', '10')).toBe('warn');
    expect(stockState('12.5', '10')).toBe('ok');
  });

  it('marks stock below the minimum as warn (BAJO MÍNIMO)', () => {
    expect(stockState(5, 10)).toBe('warn');
  });

  it('marks stock at or above the minimum as ok', () => {
    expect(stockState(10, 10)).toBe('ok');
    expect(stockState(40, 10)).toBe('ok');
  });

  it('does not flag positive stock when the minimum is missing', () => {
    expect(stockState(5, null)).toBe('ok');
    expect(stockState(5, undefined)).toBe('ok');
  });

  it('does not invent a state when stock itself is missing', () => {
    expect(stockState(null, 10)).toBe('ok');
    expect(stockState('abc', 10)).toBe('ok');
  });
});
