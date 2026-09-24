/**
 * Request schema tests.
 *
 * A browser sends "" for a field nobody filled in. Every optional text field
 * has to accept that, because otherwise a form fails for reasons the customer
 * cannot see and the site can only answer "something went wrong". The quote
 * form did exactly that: it carried an empty city and was rejected every time.
 *
 * The other half matters as much: loosening these must not let bad data in.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bookingSchema, callbackSchema, quoteSchema } from '../src/validation/schemas.js';

const customer = {
  name: 'Mohammad Abbas',
  email: 'kund@example.se',
  phone: '+46701234567',
};

describe('fields a form leaves empty', () => {
  it('accepts a quote with an empty city', () => {
    const result = quoteSchema.safeParse({
      serviceSlug: 'butiksstadning',
      customer: { ...customer, city: '' },
      propertyType: 'Butik',
      squareMeters: 20,
      frequency: 'ONCE',
      description: 'Behöver städning efter stängning.',
      website: '',
    });

    assert.equal(result.success, true);
    assert.equal(result.data.customer.city, undefined);
  });

  it('accepts a booking with an empty street and postal code', () => {
    const result = bookingSchema.safeParse({
      serviceSlug: 'hemstadning',
      squareMeters: 70,
      frequency: 'BIWEEKLY',
      customer: { ...customer, street: '', postalCode: '', city: '' },
    });

    assert.equal(result.success, true);
  });

  it('accepts a callback with no name', () => {
    const result = callbackSchema.safeParse({ name: '', phone: '070-123 45 67' });

    assert.equal(result.success, true);
    assert.equal(result.data.name, undefined);
  });
});

describe('what must still be refused', () => {
  it('rejects a malformed email', () => {
    const result = quoteSchema.safeParse({ customer: { ...customer, email: 'kund@' } });
    assert.equal(result.success, false);
  });

  it('rejects a missing phone number', () => {
    const result = quoteSchema.safeParse({ customer: { ...customer, phone: '' } });
    assert.equal(result.success, false);
  });

  it('rejects a postal code that is not five digits', () => {
    const result = bookingSchema.safeParse({
      serviceSlug: 'hemstadning',
      squareMeters: 70,
      customer: { ...customer, postalCode: '123' },
    });

    assert.equal(result.success, false);
  });

  it('rejects an impossible home size', () => {
    const result = bookingSchema.safeParse({
      serviceSlug: 'hemstadning',
      squareMeters: 5000,
      customer,
    });

    assert.equal(result.success, false);
  });
});

describe('tidying what does arrive', () => {
  it('strips the space out of a postal code', () => {
    const result = bookingSchema.safeParse({
      serviceSlug: 'hemstadning',
      squareMeters: 70,
      customer: { ...customer, postalCode: '511 55' },
    });

    assert.equal(result.success, true);
    assert.equal(result.data.customer.postalCode, '51155');
  });

  it('reads a number sent as text', () => {
    const result = bookingSchema.safeParse({
      serviceSlug: 'hemstadning',
      squareMeters: '70',
      customer,
    });

    assert.equal(result.success, true);
    assert.equal(result.data.squareMeters, 70);
  });

  it('keeps the honeypot empty-only', () => {
    const filled = quoteSchema.safeParse({ customer, website: 'http://spam.example' });
    assert.equal(filled.success, false);
  });
});
