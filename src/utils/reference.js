/**
 * Human friendly booking references, e.g. MA-2609-0042.
 *
 * Customers read these over the phone, so no letters that sound alike and no
 * database ids: an incrementing id would tell everyone how many bookings the
 * company has taken.
 */
export const buildReference = (prefix, date, sequence) => {
  const year = String(date.getFullYear()).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const number = String(sequence).padStart(4, '0');

  return `${prefix}-${year}${month}-${number}`;
};
