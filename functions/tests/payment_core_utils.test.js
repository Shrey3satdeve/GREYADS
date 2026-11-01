const test = require('node:test');
const assert = require('node:assert/strict');

const { computePricing } = require('../payment_handlers');
const {
  normalizeQuantity,
  sanitizeGuestsList,
  toDate,
} = require('../core_utils');

test('computePricing coerces invalid quantities and zero-clamps negative prices', () => {
  const pricing = computePricing(-499, 'not-a-number');

  assert.deepEqual(pricing, {
    unit_price: 0,
    quantity: 1,
    base_amount: 0,
    fee_amount: 0,
    charged_amount: 0,
    base_amount_paise: 0,
    fee_amount_paise: 0,
    charged_amount_paise: 0,
    currency: 'INR',
  });
});

test('computePricing applies convenience fee and rounds to whole rupees', () => {
  const pricing = computePricing(199.6, '3');

  assert.equal(pricing.unit_price, 199.6);
  assert.equal(pricing.quantity, 3);
  assert.equal(pricing.base_amount, 599);
  assert.equal(pricing.fee_amount, 30);
  assert.equal(pricing.charged_amount, 629);
  assert.equal(pricing.charged_amount_paise, 62900);
});

test('sanitizeGuestsList trims, truncates, and respects requested quantity', () => {
  const guests = sanitizeGuestsList(
    [
      { name: '  Alice Wonderland  ', age: ' 27 ' },
      { name: '', age: '1234' },
      { name: 'Ignored Guest', age: '99' },
    ],
    2,
    'Fallback Guest',
  );

  assert.deepEqual(guests, [
    { name: 'Alice Wonderland', age: '27' },
    { name: 'Fallback Guest', age: '123' },
  ]);
});

test('sanitizeGuestsList backfills a fallback guest when none are supplied', () => {
  const guests = sanitizeGuestsList(undefined, 3, 'Fallback Guest');

  assert.deepEqual(guests, [
    { name: 'Fallback Guest', age: 'N/A' },
  ]);
});

test('normalizeQuantity and toDate handle string, timestamp-like, and invalid values', () => {
  const timestampLike = {
    toDate() {
      return new Date('2026-04-15T12:00:00.000Z');
    },
  };

  assert.equal(normalizeQuantity('07tickets'), 7);
  assert.equal(normalizeQuantity(undefined), 1);
  assert.equal(toDate('invalid-date'), null);
  assert.equal(toDate(null), null);
  assert.equal(toDate(timestampLike)?.toISOString(), '2026-04-15T12:00:00.000Z');
});
