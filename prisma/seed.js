/**
 * Seed script: `npm run db:seed`
 *
 * Safe to run repeatedly — everything upserts on a natural key.
 *
 * Prices are stored in ore and BEFORE the RUT deduction. Competitors publish
 * after-RUT figures, so a home cleaning advertised at 21 kr/kvm is stored here
 * as 42 kr/kvm and the 50 % deduction is applied at calculation time.
 */
// Node does not read .env on its own, and this file runs outside the server,
// so it never passes through src/config/env.js. The Prisma CLI loads .env for
// commands like `db push`, which is why those work without this line.
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_SLOT_CAPACITY, TIME_SLOTS } from '../src/config/pricing.js';

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is missing. Copy .env.example to .env and set your connection string.',
  );
  process.exit(1);
}

const prisma = new PrismaClient();

const kr = (kronor) => kronor * 100;

const services = [
  {
    slug: 'hemstadning',
    category: 'PRIVATE',
    pricingModel: 'PER_SQM',
    pricePerSqm: kr(42),
    minPrice: kr(1050),
    rutEligible: true,
    isPopular: true,
    sortOrder: 10,
    sv: {
      name: 'Hemstädning',
      shortDescription:
        'Återkommande städning av hela hemmet, utförd av samma team varje gång.',
      includes: [
        'Dammsugning och våttorkning av alla golv',
        'Badrum och kök rengörs och avkalkas',
        'Avtorkning av fria ytor, lister och dörrhandtag',
        'Vi tar med allt städmaterial',
      ],
    },
    en: {
      name: 'Home cleaning',
      shortDescription:
        'Recurring cleaning of your whole home by the same team each time.',
      includes: [
        'Vacuuming and damp mopping of all floors',
        'Bathroom and kitchen cleaned and descaled',
        'Free surfaces, skirting boards and door handles wiped',
        'We bring all cleaning supplies',
      ],
    },
    extras: [
      { key: 'oven', price: kr(400), nameSv: 'Ugn invändigt', nameEn: 'Inside the oven' },
      {
        key: 'fridge',
        price: kr(400),
        nameSv: 'Kyl och frys invändigt',
        nameEn: 'Inside fridge and freezer',
      },
      { key: 'balcony', price: kr(300), nameSv: 'Balkong', nameEn: 'Balcony' },
      {
        key: 'windows',
        price: kr(600),
        nameSv: 'Fönsterputs',
        nameEn: 'Window cleaning',
      },
    ],
  },
  {
    slug: 'flyttstadning',
    category: 'PRIVATE',
    pricingModel: 'PER_SQM',
    pricePerSqm: kr(56),
    minPrice: kr(3360),
    rutEligible: true,
    sortOrder: 20,
    sv: {
      name: 'Flyttstädning',
      shortDescription:
        'Godkänd av hyresvärd eller mäklare, med fönsterputs och vitvaror inkluderat.',
      includes: [
        'Alla rum städas från tak till golv',
        'Vitvaror rengörs invändigt och dras ut',
        'Fönsterputs ingår alltid',
        'Omstädning inom 7 dagar om något missas',
      ],
    },
    en: {
      name: 'Move-out cleaning',
      shortDescription:
        'Approved by landlords and agents, with windows and appliances included.',
      includes: [
        'Every room cleaned from ceiling to floor',
        'Appliances cleaned inside and pulled out',
        'Window cleaning always included',
        'Free re-clean within 7 days if anything is missed',
      ],
    },
    extras: [
      {
        key: 'garage',
        price: kr(800),
        nameSv: 'Garage eller förråd',
        nameEn: 'Garage or storage',
      },
      { key: 'balcony', price: kr(300), nameSv: 'Balkong', nameEn: 'Balcony' },
    ],
  },
  {
    slug: 'storstadning',
    category: 'PRIVATE',
    pricingModel: 'PER_SQM',
    pricePerSqm: kr(52),
    minPrice: kr(3120),
    rutEligible: true,
    sortOrder: 30,
    sv: {
      name: 'Storstädning',
      shortDescription:
        'En grundlig genomgång av hemmet, in i skåp, bakom möbler och upp i tak.',
      includes: [
        'Skåp och garderober rengörs invändigt',
        'Bakom och under möbler',
        'Lister, dörrar och element',
        'Kalkborttagning i badrum',
      ],
    },
    en: {
      name: 'Deep cleaning',
      shortDescription:
        'A thorough pass through the home: inside cupboards, behind furniture, up to the ceiling.',
      includes: [
        'Cupboards and wardrobes cleaned inside',
        'Behind and underneath furniture',
        'Skirting boards, doors and radiators',
        'Limescale removed in bathrooms',
      ],
    },
    extras: [
      { key: 'oven', price: kr(400), nameSv: 'Ugn invändigt', nameEn: 'Inside the oven' },
      {
        key: 'windows',
        price: kr(600),
        nameSv: 'Fönsterputs',
        nameEn: 'Window cleaning',
      },
    ],
  },
  {
    slug: 'fonsterputs',
    category: 'PRIVATE',
    pricingModel: 'QUOTE_ONLY',
    rutEligible: true,
    sortOrder: 40,
    sv: {
      name: 'Fönsterputs',
      shortDescription:
        'Putsade fönster in- och utvändigt, karmar och spröjs inkluderat.',
      includes: [
        'In- och utvändig puts',
        'Karmar och lister torkas av',
        'Spröjsade fönster går bra',
      ],
    },
    en: {
      name: 'Window cleaning',
      shortDescription:
        'Windows cleaned inside and out, frames and glazing bars included.',
      includes: [
        'Cleaned inside and outside',
        'Frames and sills wiped',
        'Glazing bars are no problem',
      ],
    },
  },
  {
    slug: 'flytthjalp',
    category: 'PRIVATE',
    pricingModel: 'PACKAGE',
    packagePrice: kr(2995),
    rutEligible: true,
    sortOrder: 50,
    sv: {
      name: 'Flytthjälp',
      shortDescription: 'Bärhjälp, transport och montering med försäkrat gods.',
      includes: [
        'Två flyttare och bil',
        'Emballage och filtar',
        'Gods försäkrat under hela flytten',
      ],
    },
    en: {
      name: 'Moving help',
      shortDescription: 'Carrying, transport and assembly with your belongings insured.',
      includes: [
        'Two movers and a van',
        'Packing material and blankets',
        'Goods insured throughout the move',
      ],
    },
  },
  {
    slug: 'kontorsstad',
    category: 'BUSINESS',
    pricingModel: 'HOURLY',
    hourlyRate: kr(399),
    sortOrder: 60,
    sv: {
      name: 'Kontorsstäd',
      shortDescription:
        'Fasta städtider för kontoret, kvällar och helger fungerar utmärkt.',
      includes: [
        'Städning efter er verksamhet',
        'Påfyllning av förbrukningsmaterial',
        'Samma personal varje gång',
      ],
    },
    en: {
      name: 'Office cleaning',
      shortDescription:
        'Fixed cleaning times for your office; evenings and weekends work well.',
      includes: [
        'Scheduled around your business',
        'Consumables restocked',
        'The same staff every time',
      ],
    },
  },
  {
    slug: 'trappstadning',
    category: 'BUSINESS',
    pricingModel: 'QUOTE_ONLY',
    sortOrder: 70,
    sv: {
      name: 'Trappstädning',
      shortDescription:
        'Trapphus, entré och tvättstuga med dokumenterad kvalitetskontroll.',
      includes: [
        'Trapphus och hisshall',
        'Entrédörrar och glaspartier',
        'Signeringslista i porten',
      ],
    },
    en: {
      name: 'Stairwell cleaning',
      shortDescription:
        'Stairwells, entrances and laundry rooms with documented quality checks.',
      includes: [
        'Stairwells and lift areas',
        'Entrance doors and glass',
        'Sign-off sheet in the entrance',
      ],
    },
  },
  {
    slug: 'byggstadning',
    category: 'BUSINESS',
    pricingModel: 'QUOTE_ONLY',
    sortOrder: 80,
    sv: {
      name: 'Byggstädning',
      shortDescription: 'Grov- och finstädning efter renovering eller nyproduktion.',
      includes: [
        'Byggdamm och spill',
        'Finstäd inför besiktning',
        'Bortforsling kan ingå',
      ],
    },
    en: {
      name: 'Post-construction cleaning',
      shortDescription: 'Rough and final cleaning after renovation or new builds.',
      includes: [
        'Construction dust and debris',
        'Final clean before inspection',
        'Waste removal can be included',
      ],
    },
  },
  {
    slug: 'butiksstadning',
    category: 'BUSINESS',
    pricingModel: 'QUOTE_ONLY',
    sortOrder: 90,
    sv: {
      name: 'Butiksstädning',
      shortDescription:
        'Städning före öppning eller efter stängning, utan att störa kunderna.',
      includes: ['Golvvård och entréer', 'Provrum och kassaytor', 'Flexibla tider'],
    },
    en: {
      name: 'Retail cleaning',
      shortDescription:
        'Cleaning before opening or after closing, without disturbing customers.',
      includes: [
        'Floor care and entrances',
        'Fitting rooms and counters',
        'Flexible hours',
      ],
    },
  },
];

async function seedServices() {
  for (const service of services) {
    const { slug, sv, en, extras, ...data } = service;

    // Prices belong to the dashboard once the site is live. On a second run the
    // structure is refreshed but the amounts are left exactly as staff set them.
    const { pricePerSqm, minPrice, hourlyRate, packagePrice, ...structure } = data;

    const record = await prisma.service.upsert({
      where: { slug },
      update: structure,
      create: { slug, ...data },
    });

    for (const [locale, content] of [
      ['sv', sv],
      ['en', en],
    ]) {
      await prisma.serviceTranslation.upsert({
        where: { serviceId_locale: { serviceId: record.id, locale } },
        update: { ...content, includes: content.includes },
        create: { serviceId: record.id, locale, ...content, includes: content.includes },
      });
    }

    for (const [index, extra] of (extras ?? []).entries()) {
      await prisma.serviceExtra.upsert({
        where: { serviceId_key: { serviceId: record.id, key: extra.key } },
        // Same rule for add-ons: labels and order follow this file, the price
        // follows whatever was last saved in the dashboard.
        update: { nameSv: extra.nameSv, nameEn: extra.nameEn, sortOrder: index },
        create: { serviceId: record.id, ...extra, sortOrder: index },
      });
    }
  }

  console.log(`Seeded ${services.length} services`);
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'info@mastad.se';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  await prisma.admin.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'MA Städ',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(password, 12),
      // The default password is written in this file, so the dashboard makes
      // the first login replace it before anything else can be done.
      mustChangePassword: !process.env.SEED_ADMIN_PASSWORD,
    },
  });

  console.log(`Admin ready: ${email} (you will be asked to set a new password)`);
}

/** Opens bookable slots for the next 60 days, skipping Sundays. */
async function seedTimeSlots(days = 60) {
  const today = new Date();
  const rows = [];

  for (let offset = 1; offset <= days; offset += 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() + offset);
    date.setUTCHours(0, 0, 0, 0);

    if (date.getUTCDay() === 0) continue;

    for (const slot of TIME_SLOTS) {
      rows.push({ date, ...slot, capacity: DEFAULT_SLOT_CAPACITY });
    }
  }

  // One insert instead of one round trip per slot. On shared hosting the old
  // loop made about 150 sequential queries and took long enough to matter.
  // skipDuplicates leaves existing slots, and their bookings, untouched.
  const result = await prisma.timeSlot.createMany({ data: rows, skipDuplicates: true });

  console.log(`Created ${result.count} of ${rows.length} time slots`);
}

async function seedSettings() {
  const settings = {
    company: {
      name: 'MA Städ',
      email: 'info@mastad.se',
      phone: '+46762638940',
      regions: ['Västra Götaland', 'Jönköpings län', 'Hallands län'],
    },
    quoteResponseHours: 24,
  };

  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });
  }

  console.log(`Seeded ${Object.keys(settings).length} settings`);
}

async function main() {
  await seedServices();
  await seedAdmin();
  await seedTimeSlots();
  await seedSettings();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
