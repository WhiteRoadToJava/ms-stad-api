/**
 * Money helpers.
 * Prices are stored and calculated in ore (1 SEK = 100 ore) to keep the
 * arithmetic exact; they are only converted to kronor for display.
 */
export const kronorToOre = (kronor) => Math.round(kronor * 100);

export const oreToKronor = (ore) => ore / 100;

/** Formats ore as a Swedish price string, e.g. 52500 -> "525 kr". */
export const formatOre = (ore, locale = 'sv-SE') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(oreToKronor(ore));
