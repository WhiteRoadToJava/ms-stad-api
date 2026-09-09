/**
 * Pricing engine.
 *
 * The browser runs the same maths to show a live estimate, but every price that
 * is stored or emailed is produced here. A price arriving from the client is
 * treated as a display value only and never trusted.
 */
import {
  FREQUENCY_MULTIPLIER,
  LABOR_SHARE,
  MIN_BILLABLE_HOURS,
  RUT_RATE,
} from '../config/pricing.js';
import { AppError } from '../utils/AppError.js';

/** Rounds to whole kronor so customers never see prices like 1 483,50 kr. */
const roundToKronor = (ore) => Math.round(ore / 100) * 100;

function calculateBasePrice(input) {
  const { service, squareMeters, hours } = input;

  switch (service.pricingModel) {
    case 'PER_SQM': {
      if (!squareMeters || squareMeters <= 0) {
        throw AppError.badRequest('squareMeters is required for this service');
      }
      if (!service.pricePerSqm) {
        throw AppError.badRequest(`Service ${service.slug} has no square meter price`);
      }
      const bySize = squareMeters * service.pricePerSqm;
      // The minimum covers travel and setup on very small homes.
      return Math.max(bySize, service.minPrice ?? 0);
    }

    case 'HOURLY': {
      if (!service.hourlyRate) {
        throw AppError.badRequest(`Service ${service.slug} has no hourly rate`);
      }
      const billableHours = Math.max(hours ?? MIN_BILLABLE_HOURS, MIN_BILLABLE_HOURS);
      return billableHours * service.hourlyRate;
    }

    case 'PACKAGE': {
      if (!service.packagePrice) {
        throw AppError.badRequest(`Service ${service.slug} has no package price`);
      }
      return service.packagePrice;
    }

    case 'QUOTE_ONLY':
      return 0;
  }
}

export function calculatePrice(input) {
  const { service, availableExtras = [], extraKeys = [] } = input;
  const frequency = input.frequency ?? 'ONCE';

  if (service.pricingModel === 'QUOTE_ONLY') {
    return {
      basePrice: 0,
      extrasPrice: 0,
      grossPrice: 0,
      rutDeduction: 0,
      totalPrice: 0,
      applyRut: false,
      frequency,
      appliedExtras: [],
      quoteOnly: true,
    };
  }

  // A package price is what it says: a one-off service already priced as a
  // single visit. Only recurring models move with how often we come.
  const isRecurring =
    service.pricingModel === 'PER_SQM' || service.pricingModel === 'HOURLY';
  const multiplier = isRecurring ? FREQUENCY_MULTIPLIER[frequency] : 1;

  const basePrice = roundToKronor(calculateBasePrice(input) * multiplier);

  const appliedExtras = availableExtras.filter((extra) => extraKeys.includes(extra.key));
  const extrasPrice = appliedExtras.reduce((sum, extra) => sum + extra.price, 0);

  const grossPrice = basePrice + extrasPrice;

  const applyRut = Boolean(input.applyRut) && service.rutEligible;
  const laborShare = LABOR_SHARE[service.slug] ?? LABOR_SHARE.default;
  const rutDeduction = applyRut ? roundToKronor(grossPrice * laborShare * RUT_RATE) : 0;

  return {
    basePrice,
    extrasPrice,
    grossPrice,
    rutDeduction,
    totalPrice: grossPrice - rutDeduction,
    applyRut,
    frequency,
    appliedExtras,
    quoteOnly: false,
  };
}
