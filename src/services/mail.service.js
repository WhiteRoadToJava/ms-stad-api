/**
 * Outgoing email.
 *
 * Two messages leave the system for every booking: a receipt for the customer
 * and an alert for the office. Sending runs after the booking is committed and
 * never blocks the response — a booking that is saved but whose email failed is
 * a support issue, while a booking lost because the mail server was down is a
 * lost customer.
 *
 * Copy is Swedish: customers are Swedish, and the office reads Swedish.
 */
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { formatOre } from '../utils/money.js';

let transporter = null;

const getTransporter = () => {
  if (!env.SMTP_HOST) return null;

  // Local mail catchers such as Mailpit accept anything on an open port with
  // no credentials, so authentication is only configured when a user is given.
  // Requiring one made every local mail untestable.
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
  });

  return transporter;
};

const send = async (message) => {
  const mailer = getTransporter();

  // Without SMTP configured (typically local development) the message is
  // printed instead of sent, so the flow can still be tested end to end.
  if (!mailer) {
    console.info('[mail] SMTP not configured, message not sent:', {
      to: message.to,
      subject: message.subject,
    });
    return;
  }

  try {
    await mailer.sendMail({ from: env.MAIL_FROM, ...message });
  } catch (error) {
    console.error('[mail] Failed to send:', message.subject, error);
  }
};

const layout = (title, rows, footer = '') => `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#16232b;max-width:560px">
    <h2 style="color:#124559;margin-bottom:16px">${title}</h2>
    <table style="border-collapse:collapse;width:100%">
      ${rows
        .map(
          ([label, value]) => `
        <tr>
          <td style="padding:6px 0;color:#5a6a72">${label}</td>
          <td style="padding:6px 0;font-weight:bold;text-align:right">${value}</td>
        </tr>`,
        )
        .join('')}
    </table>
    <p style="margin-top:20px;color:#5a6a72;font-size:14px">${footer}</p>
  </div>
`;

const formatDate = (date) =>
  date ? new Intl.DateTimeFormat('sv-SE', { dateStyle: 'full' }).format(date) : 'Ej vald';

export const sendBookingEmails = async ({ booking, service, customer }) => {
  // The hour is agreed on the phone, so the receipt promises a day and a call,
  // not a window the office never committed to.
  const when = booking.scheduledDate
    ? `${formatDate(booking.scheduledDate)} (vi ringer och bekräftar tiden)`
    : 'Vi återkommer med datum och tid';

  const rows = [
    ['Bokningsnummer', booking.reference],
    ['Tjänst', service.translations[0]?.name ?? service.slug],
    ['Tid', when],
    ['Att betala', formatOre(booking.totalPrice)],
  ];

  if (booking.rutDeduction > 0) {
    rows.splice(3, 0, ['RUT-avdrag', `−${formatOre(booking.rutDeduction)}`]);
  }

  await send({
    to: customer.email,
    subject: `Tack för din bokning ${booking.reference}`,
    html: layout(
      'Vi har tagit emot din bokning',
      rows,
      'Vi hör av oss samma arbetsdag för att bekräfta tiden. Behöver du ändra något, svara på det här mejlet eller ring oss.',
    ),
  });

  await send({
    to: env.MAIL_TO_INTERNAL,
    subject: `Ny bokning ${booking.reference} — ${customer.name}`,
    html: layout('Ny bokning', [
      ...rows,
      ['Kund', customer.name],
      ['Telefon', customer.phone],
      ['E-post', customer.email],
      ['Adress', [customer.street, customer.postalCode, customer.city].filter(Boolean).join(', ') || '—'],
      ['Meddelande', booking.message || '—'],
    ]),
  });
};

export const sendQuoteEmails = async ({ quote, customer, serviceName }) => {
  await send({
    to: customer.email,
    subject: `Vi har tagit emot din offertförfrågan ${quote.reference}`,
    html: layout(
      'Tack för din förfrågan',
      [
        ['Referens', quote.reference],
        ['Tjänst', serviceName ?? '—'],
      ],
      'Du får en offert från oss inom en arbetsdag.',
    ),
  });

  await send({
    to: env.MAIL_TO_INTERNAL,
    subject: `Ny offertförfrågan ${quote.reference} — ${customer.name}`,
    html: layout('Ny offertförfrågan', [
      ['Referens', quote.reference],
      ['Tjänst', serviceName ?? '—'],
      ['Kund', customer.name],
      ['Telefon', customer.phone],
      ['E-post', customer.email],
      ['Yta', quote.squareMeters ? `${quote.squareMeters} kvm` : '—'],
      ['Beskrivning', quote.description || '—'],
    ]),
  });
};

export const sendCallbackEmail = async (callback) => {
  await send({
    to: env.MAIL_TO_INTERNAL,
    subject: `Ring upp ${callback.phone}`,
    html: layout('Begäran om återuppringning', [
      ['Namn', callback.name || '—'],
      ['Telefon', callback.phone],
    ]),
  });
};
