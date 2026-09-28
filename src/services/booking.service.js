/**
 * Creating bookings and quotes.
 *
 * The price is recalculated here from the catalogue in the database. Whatever
 * number the browser showed is treated as a preview only, so editing it in dev
 * tools changes nothing that ends up on an invoice.
 */
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { buildReference } from '../utils/reference.js';
import { reserveDay } from './availability.service.js';
import { calculatePrice } from './pricing.service.js';
import { LABOR_SHARE, RUT_RATE } from '../config/pricing.js';

const loadService = async (slug) => {
  const service = await prisma.service.findFirst({
    where: { slug, isActive: true },
    include: { extras: { where: { isActive: true } }, translations: true },
  });

  if (!service) throw AppError.notFound(`Unknown service: ${slug}`);

  return service;
};

/**
 * One customer row per email address. People book again, and the office wants
 * the history in one place rather than a new row every time.
 */
const upsertCustomer = async (tx, input) => {
  const existing = await tx.customer.findFirst({ where: { email: input.email } });

  if (existing) {
    return tx.customer.update({ where: { id: existing.id }, data: input });
  }

  return tx.customer.create({ data: input });
};

/** Sequence resets every month, so references stay short and readable. */
const nextReference = async (tx, model, prefix) => {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const countThisMonth = await tx[model].count({
    where: { createdAt: { gte: monthStart } },
  });

  return buildReference(prefix, now, countThisMonth + 1);
};

/**
 * Applies a price agreed on the phone.
 *
 * The office sets the price BEFORE the RUT deduction, and the deduction is
 * recalculated from it. Letting them set the final figure instead would leave
 * the RUT amount claimed from Skatteverket describing a price that was never
 * charged, which is a tax question, not a rounding one.
 */
const withAgreedPrice = (breakdown, grossPrice) => {
  const share = LABOR_SHARE[breakdown.serviceSlug] ?? LABOR_SHARE.default;

  const rutDeduction = breakdown.applyRut
    ? Math.round((grossPrice * share * RUT_RATE) / 100) * 100
    : 0;

  return {
    ...breakdown,
    basePrice: Math.max(grossPrice - breakdown.extrasPrice, 0),
    grossPrice,
    rutDeduction,
    totalPrice: grossPrice - rutDeduction,
  };
};

export const createBooking = async (input) => {
  const service = await loadService(input.serviceSlug);

  let breakdown = calculatePrice({
    service,
    squareMeters: input.squareMeters,
    hours: input.hours,
    frequency: input.frequency,
    extraKeys: input.extraKeys,
    availableExtras: service.extras,
    applyRut: input.applyRut,
  });

  if (breakdown.quoteOnly) {
    throw AppError.badRequest(
      `${service.slug} is priced individually, use the quote endpoint instead`,
    );
  }

  // The price list can change between the page being loaded and the booking
  // being sent, and the site ships its own copy of it for instant feedback.
  // Charging the recalculated figure silently would mean invoicing a customer
  // something they never saw, so the booking is refused and the client is told
  // what the price is now.
  if (
    input.quotedTotal !== undefined &&
    input.quotedTotal !== breakdown.totalPrice
  ) {
    throw new AppError(409, 'The price has changed since the page was loaded', 'PRICE_CHANGED', {
      quotedTotal: input.quotedTotal,
      currentTotal: breakdown.totalPrice,
      breakdown: {
        basePrice: breakdown.basePrice,
        extrasPrice: breakdown.extrasPrice,
        grossPrice: breakdown.grossPrice,
        rutDeduction: breakdown.rutDeduction,
        totalPrice: breakdown.totalPrice,
      },
    });
  }

  // Only the office can send one of these, and only with a reason recorded
  // alongside it, so an unexplained price never appears in the books.
  if (input.priceOverride !== undefined && input.priceOverride !== null) {
    breakdown = withAgreedPrice(
      { ...breakdown, serviceSlug: service.slug },
      input.priceOverride,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const customer = await upsertCustomer(tx, input.customer);

    // Reserving inside the transaction means a failed booking never leaves a
    // day counted as taken. A booking without a date is fine: the customer
    // asked us to suggest one, and nothing is held until we agree it.
    if (input.scheduledDate) await reserveDay(tx, input.scheduledDate);

    const booking = await tx.booking.create({
      data: {
        reference: await nextReference(tx, 'booking', 'MA'),
        customerId: customer.id,
        serviceId: service.id,
        frequency: input.frequency,
        squareMeters: input.squareMeters,
        rooms: input.rooms,
        floor: input.floor,
        hasElevator: input.hasElevator,
        hasPets: input.hasPets,
        scheduledDate: input.scheduledDate ?? null,
        basePrice: breakdown.basePrice,
        extrasPrice: breakdown.extrasPrice,
        grossPrice: breakdown.grossPrice,
        rutDeduction: breakdown.rutDeduction,
        totalPrice: breakdown.totalPrice,
        applyRut: breakdown.applyRut,
        message: input.message,
        internalNotes: input.internalNotes,
        // "web" for a customer filling the form, "phone" when the office takes
        // the call. Worth knowing when deciding what the site is doing for you.
        source: input.source ?? 'web',
        extras: {
          create: breakdown.appliedExtras.map((extra) => ({
            extraId: extra.id,
            // Label and price are copied, not referenced: the price list will
            // change and old bookings must keep showing what was agreed.
            label: extra.nameSv,
            price: extra.price,
          })),
        },
      },
      include: { extras: true },
    });

    return { booking, customer };
  });

  return { ...result, service, breakdown };
};

export const createQuote = async (input) => {
  const service = input.serviceSlug ? await loadService(input.serviceSlug) : null;

  return prisma.$transaction(async (tx) => {
    const customer = await upsertCustomer(tx, input.customer);

    const quote = await tx.quote.create({
      data: {
        reference: await nextReference(tx, 'quote', 'OF'),
        customerId: customer.id,
        serviceId: service?.id ?? null,
        propertyType: input.propertyType,
        squareMeters: input.squareMeters,
        frequency: input.frequency,
        description: input.description,
      },
    });

    return { quote, customer, service };
  });
};
