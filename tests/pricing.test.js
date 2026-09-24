/**
 * Pricing engine tests.
 *
 * This is the code that decides what a customer is invoiced, and three real
 * bugs reached production before these existed: a fixed package price was
 * multiplied by the one-off surcharge, the RUT deduction was taken as half of
 * everything including services that get no deduction, and the site and the
 * server disagreed about the price shown versus the price charged.
 *
 * The numbers below are the contract. src/data/pricing.js in the website
 * repository is checked against the same table, so the two calculators cannot
 * drift apart without a test failing on one side.
 *
 * Run with: npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculatePrice } from '../src/services/pricing.service.js';

/** Amounts are in ore throughout, as everywhere else in the codebase. */
const kr = (kronor) => kronor * 100;

const homeCleaning = {
  slug: 'hemstadning',
  pricingModel: 'PER_SQM',
  pricePerSqm: kr(42),
  minPrice: kr(1050),
  hourlyRate: null,
  packagePrice: null,
  rutEligible: true,
};

const movingHelp = {
  slug: 'flytthjalp',
  pricingModel: 'PACKAGE',
  pricePerSqm: null,
  minPrice: null,
  hourlyRate: null,
  packagePrice: kr(2995),
  rutEligible: true,
};

const officeCleaning = {
  slug: 'kontorsstad',
  pricingModel: 'HOURLY',
  pricePerSqm: null,
  minPrice: null,
  hourlyRate: kr(399),
  packagePrice: null,
  rutEligible: false,
};

const windowCleaning = {
  slug: 'fonsterputs',
  pricingModel: 'QUOTE_ONLY',
  pricePerSqm: null,
  minPrice: null,
  hourlyRate: null,
  packagePrice: null,
  rutEligible: true,
};

const extras = [
  { id: 1, key: 'oven', price: kr(400), nameSv: 'Ugn invändigt' },
  { id: 2, key: 'windows', price: kr(600), nameSv: 'Fönsterputs' },
];

describe('size and the minimum price', () => {
  it('charges per square meter above the minimum', () => {
    const price = calculatePrice({
      service: homeCleaning,
      squareMeters: 70,
      frequency: 'BIWEEKLY',
      applyRut: false,
    });

    assert.equal(price.basePrice, kr(2940)); // 70 x 42
    assert.equal(price.totalPrice, kr(2940));
  });

  it('applies the minimum to a home too small to reach it', () => {
    const price = calculatePrice({
      service: homeCleaning,
      squareMeters: 15,
      frequency: 'BIWEEKLY',
      applyRut: false,
    });

    // 15 x 42 = 630 kr, below the floor that covers travel and setup.
    assert.equal(price.basePrice, kr(1050));
  });

  it('refuses a per square meter service without a size', () => {
    assert.throws(
      () => calculatePrice({ service: homeCleaning, frequency: 'ONCE' }),
      /squareMeters/,
    );
  });
});

describe('how often the customer books', () => {
  const base = { service: homeCleaning, squareMeters: 70, applyRut: false };

  it('charges the base price every other week', () => {
    assert.equal(calculatePrice({ ...base, frequency: 'BIWEEKLY' }).totalPrice, kr(2940));
  });

  it('discounts weekly visits by five percent', () => {
    assert.equal(calculatePrice({ ...base, frequency: 'WEEKLY' }).totalPrice, kr(2793));
  });

  it('adds ten percent for a monthly visit', () => {
    assert.equal(calculatePrice({ ...base, frequency: 'MONTHLY' }).totalPrice, kr(3234));
  });

  it('adds thirty five percent for a single visit', () => {
    assert.equal(calculatePrice({ ...base, frequency: 'ONCE' }).totalPrice, kr(3969));
  });

  it('never applies the surcharge to a fixed package price', () => {
    // The bug this replaced turned moving help from 2 995 kr into 4 043 kr.
    const once = calculatePrice({ service: movingHelp, frequency: 'ONCE', applyRut: false });
    const monthly = calculatePrice({ service: movingHelp, frequency: 'MONTHLY', applyRut: false });

    assert.equal(once.totalPrice, kr(2995));
    assert.equal(monthly.totalPrice, kr(2995));
  });
});

describe('hourly services', () => {
  it('charges the hours asked for', () => {
    const price = calculatePrice({
      service: officeCleaning,
      hours: 3,
      frequency: 'BIWEEKLY',
      applyRut: false,
    });

    assert.equal(price.totalPrice, kr(1197)); // 3 x 399
  });

  it('bills a minimum of two hours', () => {
    const price = calculatePrice({
      service: officeCleaning,
      hours: 1,
      frequency: 'BIWEEKLY',
      applyRut: false,
    });

    assert.equal(price.totalPrice, kr(798));
  });
});

describe('the RUT deduction', () => {
  it('takes half of a fully labour based service', () => {
    const price = calculatePrice({
      service: homeCleaning,
      squareMeters: 70,
      frequency: 'BIWEEKLY',
      applyRut: true,
    });

    assert.equal(price.grossPrice, kr(2940));
    assert.equal(price.rutDeduction, kr(1470));
    assert.equal(price.totalPrice, kr(1470));
  });

  it('only covers the labour part of moving help', () => {
    // A van and fuel do not qualify, so the deduction is 50% of 60%.
    const price = calculatePrice({ service: movingHelp, frequency: 'ONCE', applyRut: true });

    assert.equal(price.rutDeduction, kr(899)); // 2 995 x 0.6 x 0.5, rounded
    assert.equal(price.totalPrice, kr(2096));
  });

  it('gives no deduction on a business service, even when asked', () => {
    const price = calculatePrice({
      service: officeCleaning,
      hours: 3,
      frequency: 'BIWEEKLY',
      applyRut: true,
    });

    assert.equal(price.rutDeduction, 0);
    assert.equal(price.applyRut, false);
    assert.equal(price.totalPrice, kr(1197));
  });

  it('charges the full price when the customer declines it', () => {
    const price = calculatePrice({
      service: homeCleaning,
      squareMeters: 70,
      frequency: 'BIWEEKLY',
      applyRut: false,
    });

    assert.equal(price.rutDeduction, 0);
    assert.equal(price.totalPrice, kr(2940));
  });
});

describe('extras', () => {
  it('adds the ones that were chosen', () => {
    const price = calculatePrice({
      service: homeCleaning,
      squareMeters: 70,
      frequency: 'BIWEEKLY',
      extraKeys: ['oven'],
      availableExtras: extras,
      applyRut: false,
    });

    assert.equal(price.extrasPrice, kr(400));
    assert.equal(price.totalPrice, kr(3340));
    assert.deepEqual(price.appliedExtras.map((extra) => extra.key), ['oven']);
  });

  it('ignores a key that does not belong to the service', () => {
    // Extras arrive from the browser, so an invented key must not be priced.
    const price = calculatePrice({
      service: homeCleaning,
      squareMeters: 70,
      frequency: 'BIWEEKLY',
      extraKeys: ['oven', 'private-jet'],
      availableExtras: extras,
      applyRut: false,
    });

    assert.equal(price.extrasPrice, kr(400));
    assert.equal(price.appliedExtras.length, 1);
  });

  it('includes extras in the RUT deduction', () => {
    const price = calculatePrice({
      service: homeCleaning,
      squareMeters: 70,
      frequency: 'BIWEEKLY',
      extraKeys: ['oven', 'windows'],
      availableExtras: extras,
      applyRut: true,
    });

    assert.equal(price.grossPrice, kr(3940));
    assert.equal(price.totalPrice, kr(1970));
  });
});

describe('services priced individually', () => {
  it('returns zero and marks itself as needing a quote', () => {
    const price = calculatePrice({ service: windowCleaning, frequency: 'ONCE', applyRut: true });

    assert.equal(price.quoteOnly, true);
    assert.equal(price.totalPrice, 0);
    assert.equal(price.rutDeduction, 0);
  });
});

describe('rounding', () => {
  it('never produces ore, only whole kronor', () => {
    // 63 x 42 x 1.35 = 3 572.10 kr before rounding.
    const price = calculatePrice({
      service: homeCleaning,
      squareMeters: 63,
      frequency: 'ONCE',
      applyRut: true,
    });

    for (const amount of [price.basePrice, price.grossPrice, price.rutDeduction, price.totalPrice]) {
      assert.equal(amount % 100, 0, `${amount} is not a whole number of kronor`);
    }
  });
});

describe('the price examples published on the site', () => {
  // These figures appear on the city landing pages. If the engine changes,
  // the pages are wrong, so the numbers are pinned here.
  const cases = [
    { sqm: 65, frequency: 'BIWEEKLY', expected: kr(1365) },
    { sqm: 80, frequency: 'BIWEEKLY', expected: kr(1680) },
    { sqm: 130, frequency: 'BIWEEKLY', expected: kr(2730) },
  ];

  for (const { sqm, frequency, expected } of cases) {
    it(`${sqm} m² every other week costs ${expected / 100} kr after RUT`, () => {
      const price = calculatePrice({
        service: homeCleaning,
        squareMeters: sqm,
        frequency,
        applyRut: true,
      });

      assert.equal(price.totalPrice, expected);
    });
  }
});
