import { PrismaClient, PartnerType } from "@prisma/client";

const prisma = new PrismaClient();

async function deleteAllData() {
  console.log("Deleting existing data...");

  // Delete from tables that are "many" sides or have fewer dependencies first.
  // The order here matters to avoid foreign key constraint violations.

  // 1. Linking tables that depend on multiple other tables
  // JournalPartnerGoodLink depends on JournalPartnerLink and GoodsAndService
  await prisma.journalPartnerGoodLink.deleteMany({});
  console.log("Deleted JournalPartnerGoodLinks.");

  // 2. Other linking tables
  // JournalPartnerLink depends on Journal and Partner
  await prisma.journalPartnerLink.deleteMany({});
  console.log("Deleted JournalPartnerLinks.");

  // JournalGoodLink depends on Journal and GoodsAndService
  await prisma.journalGoodLink.deleteMany({});
  console.log("Deleted JournalGoodLinks.");

  // 3. Tables that are referenced by the above, but might also be referenced by others.
  // GoodsAndService is referenced by JournalGoodLink and JournalPartnerGoodLink.
  // It also references TaxCode and UnitOfMeasure, but those relations are onDelete: SetNull,
  // so deleting GoodsAndService first is fine.
  await prisma.goodsAndService.deleteMany({});
  console.log("Deleted GoodsAndServices.");

  // Partners are referenced by JournalPartnerLink.
  await prisma.partner.deleteMany({});
  console.log("Deleted Partners.");

  // TaxCodes and UnitsOfMeasure are referenced by GoodsAndService,
  // but with onDelete: SetNull, so their order relative to GoodsAndService deletion
  // is flexible, but best to delete them after GoodsAndService if you want a clean slate.
  await prisma.taxCode.deleteMany({});
  console.log("Deleted TaxCodes.");
  await prisma.unitOfMeasure.deleteMany({});
  console.log("Deleted UnitsOfMeasure.");

  // 4. Journals: This is tricky due to the self-referencing parentId.
  // You need to delete children before parents if onDelete: Restrict is used.
  // A common approach for hierarchical data is to delete in passes or use raw SQL if complex.
  // Simplest for seeding if `onDelete: Restrict` is on `parentId`:
  //    a. Set all parentId to null (if schema allows, yours might not directly without making it optional more broadly)
  //    b. Then delete all journals.
  // OR, delete by levels, starting from the most deeply nested.
  // OR, if your database supports TRUNCATE ... CASCADE (more heavy-handed).

  // Given your `onDelete: Restrict` on `Journal.parentId`, deleting all at once might fail
  // if there are parent-child relationships.
  // A safer way for Journals during seeding is to delete them carefully.
  // However, since `journalPartnerLinks` and `journalGoodLinks` have `onDelete: Cascade`
  // *from the linking table to the Journal*, deleting those links first (done above) helps.
  // The main constraint is the self-referential `parentId`.

  // For simplicity in a seed script where you're wiping everything,
  // and if you don't have many levels or complex interdependencies NOT covered by cascades:
  // Try deleting all journals. If it fails due to `parentId` constraint,
  // you might need to delete them in an order (e.g., find all journals with no children first).
  // For a full reset, sometimes a more direct DB command or specific order is needed.

  // Attempt to delete all journals (might require multiple passes or specific order if restrictive FKs)
  // First, remove links from children to parents to break cycles for deletion for Restrict
  // This step is usually not needed if you delete in the correct order (leaves first)
  // await prisma.journal.updateMany({ where: { parentId: { not: null } }, data: { parentId: null } });

  // Then delete. If `onDelete: Restrict` is an issue, you might need to delete level by level.
  // But since other tables linking to Journal have onDelete: Cascade, this should be okay
  // after those linking tables are cleared. The self-reference is the main concern.
  // Let's try a simple deleteMany first. The ROOT journal has no parent.
  // Children pointing to parents with Restrict can be an issue.
  // To handle self-referential with Restrict:
  // 1. Find all leaf nodes (isTerminal or no children in the `children` relation). Delete them.
  // 2. Repeat until no journals are left.
  // This is complex for a simple seed.
  // A simpler (but potentially slower for huge datasets) loop:
  let count = await prisma.journal.count();
  let previousCount = count + 1; // Ensure loop runs at least once if count > 0
  while (count > 0 && count < previousCount) {
    // Add check to prevent infinite loop if no progress
    previousCount = count;
    try {
      const deletedJournals = await prisma.journal.deleteMany({
        where: { children: { none: {} } }, // Delete journals that have no children
      });
      console.log(
        `Deleted ${deletedJournals.count} leaf journals in this pass.`
      );
      if (deletedJournals.count === 0 && count > 0) {
        const remaining = await prisma.journal.findMany({
          select: { id: true, parentId: true, name: true },
        });
        console.error("Stuck deleting journals. Remaining:", remaining);
        throw new Error(
          "Stuck deleting journals. Manual intervention or review `onDelete` constraints needed for self-referencing table."
        );
      }
      count = await prisma.journal.count();
    } catch (e) {
      console.error("Error during journal deletion pass:", e);
      const remaining = await prisma.journal.findMany({
        select: { id: true, parentId: true, name: true },
      });
      console.error("Remaining journals on error:", remaining);
      break;
    }
  }
  if (count > 0) {
    console.warn(
      `${count} journals could not be deleted automatically. Check constraints or remaining data.`
    );
  } else {
    console.log("All journals deleted.");
  }
  console.log("Finished deleting data.");
}

async function main() {
  await deleteAllData(); // Call the delete function first

  console.log(`Start seeding ...`);

  // L1 Journals (Categories) - parentId is null
  const jAssets = await prisma.journal.create({
    data: { id: "1", name: "Assets", parentId: null, isTerminal: false },
  });
  const jLiabilities = await prisma.journal.create({
    data: { id: "2", name: "Liabilities", parentId: null, isTerminal: false },
  });
  const jEquity = await prisma.journal.create({
    data: { id: "3", name: "Equity", parentId: null, isTerminal: true },
  });
  const jRevenue = await prisma.journal.create({
    data: { id: "4", name: "Revenue", parentId: null, isTerminal: false },
  });
  const jExpenses = await prisma.journal.create({
    data: { id: "5", name: "Expenses", parentId: null, isTerminal: false },
  });

  // L2 Journals (Sub-categories / Account Groups)
  const jCurrentAssets = await prisma.journal.upsert({
    where: { id: "10" },
    update: {},
    create: {
      id: "10",
      name: "Current Assets",
      parentId: jAssets.id,
      isTerminal: false,
    },
  });
  const jFixedAssets = await prisma.journal.upsert({
    where: { id: "11" },
    update: {},
    create: {
      id: "11",
      name: "Fixed Assets",
      parentId: jAssets.id,
      isTerminal: true,
    },
  });
  const jSalesRevenue = await prisma.journal.upsert({
    where: { id: "40" },
    update: {},
    create: {
      id: "40",
      name: "Sales Revenue",
      parentId: jRevenue.id,
      isTerminal: false,
    },
  });
  const jIngredientCosts = await prisma.journal.upsert({
    where: { id: "50" },
    update: {},
    create: {
      id: "50",
      name: "Ingredient Costs",
      parentId: jExpenses.id,
      isTerminal: false,
    },
  });
  const jOperatingExpenses = await prisma.journal.upsert({
    where: { id: "51" },
    update: {},
    create: {
      id: "51",
      name: "Operating Expenses",
      parentId: jExpenses.id,
      isTerminal: true,
    },
  });

  // L3 Journals (Specific Accounts - often terminal)
  const jCash = await prisma.journal.upsert({
    where: { id: "1001" },
    update: {},
    create: {
      id: "1001",
      name: "Cash on Hand",
      parentId: jCurrentAssets.id,
      isTerminal: true,
    },
  });
  const jReceivables = await prisma.journal.upsert({
    where: { id: "1002" },
    update: {},
    create: {
      id: "1002",
      name: "Accounts Receivable",
      parentId: jCurrentAssets.id,
      isTerminal: true,
    },
  });
  const jCakeSales = await prisma.journal.upsert({
    where: { id: "4001" },
    update: {},
    create: {
      id: "4001",
      name: "Cake Sales",
      parentId: jSalesRevenue.id,
      isTerminal: true,
    },
  });
  const jCookieSales = await prisma.journal.upsert({
    where: { id: "4002" },
    update: {},
    create: {
      id: "4002",
      name: "Cookie Sales",
      parentId: jSalesRevenue.id,
      isTerminal: true,
    },
  });
  const jFlourCosts = await prisma.journal.upsert({
    where: { id: "5001" },
    update: {},
    create: {
      id: "5001",
      name: "Flour Costs",
      parentId: jIngredientCosts.id,
      isTerminal: true,
    },
  });
  const jSugarCosts = await prisma.journal.upsert({
    where: { id: "5002" },
    update: {},
    create: {
      id: "5002",
      name: "Sugar Costs",
      parentId: jIngredientCosts.id,
      isTerminal: true,
    },
  });

  console.log("Journals seeded.");

  // --- Create Partners ---
  const pSupplierFlourMart = await prisma.partner.create({
    data: {
      name: "FlourMart Inc.",
      partnerType: PartnerType.LEGAL_ENTITY,
      notes: "Primary flour supplier",
      taxId: "FM12345",
    },
  });
  const pSupplierSugarSweet = await prisma.partner.create({
    data: {
      name: "Sugar & Sweet Co.",
      partnerType: PartnerType.LEGAL_ENTITY,
      notes: "Sugar and sweeteners",
      taxId: "SS67890",
    },
  });
  const pCustomerCafeA = await prisma.partner.create({
    data: {
      name: "The Cozy Cafe",
      partnerType: PartnerType.LEGAL_ENTITY,
      notes: "Regular cake order",
      registrationNumber: "CAFEA001",
    },
  });
  const pCustomerJohnB = await prisma.partner.create({
    data: {
      name: "John Baker (Caterer)",
      partnerType: PartnerType.NATURAL_PERSON,
      notes: "Occasional large cookie orders",
      bioFatherName: "David Baker",
    },
  });
  const pInternalBakery = await prisma.partner.create({
    // Our own company/bakery
    data: {
      name: "My Cake Factory",
      partnerType: PartnerType.LEGAL_ENTITY,
      isUs: true,
    },
  });

  console.log("Partners seeded.");

  // --- Create Tax Codes & Units of Measure ---
  const taxStd = await prisma.taxCode.create({
    data: { code: "STD20", description: "Standard Sales Tax", rate: 0.2 },
  });
  const taxExempt = await prisma.taxCode.create({
    data: { code: "EXEMPT", description: "Tax Exempt", rate: 0.0 },
  });

  const uomKg = await prisma.unitOfMeasure.create({
    data: { code: "KG", name: "Kilogram" },
  });
  const uomEach = await prisma.unitOfMeasure.create({
    data: { code: "EA", name: "Each" },
  }); // EA for Each or PCS for Pieces
  const uomBox = await prisma.unitOfMeasure.create({
    data: { code: "BOX", name: "Box" },
  });

  console.log("Tax Codes & UoM seeded.");

  // --- Create GoodsAndServices (Ingredients & Finished Products) ---
  const goodFlour = await prisma.goodsAndService.create({
    data: {
      label: "Premium Baking Flour",
      referenceCode: "FLR001",
      typeCode: "INGREDIENT",
      taxCodeId: taxExempt.id, // Ingredients might be tax-exempt for B2B
      unitCodeId: uomKg.id,
      description: "High-quality all-purpose flour.",
    },
  });
  const goodSugar = await prisma.goodsAndService.create({
    data: {
      label: "Granulated Sugar",
      referenceCode: "SUG001",
      typeCode: "INGREDIENT",
      taxCodeId: taxExempt.id,
      unitCodeId: uomKg.id,
    },
  });
  const goodChocolateCake = await prisma.goodsAndService.create({
    data: {
      label: "Classic Chocolate Cake",
      referenceCode: "CAKE001",
      typeCode: "FNGD_CAKE", // Finished Good Cake
      taxCodeId: taxStd.id, // Finished goods are taxed
      unitCodeId: uomEach.id,
      description: "A delicious 10-inch chocolate cake.",
    },
  });
  const goodVanillaCookies = await prisma.goodsAndService.create({
    data: {
      label: "Vanilla Bean Cookies (Box of 12)",
      referenceCode: "CKIE001",
      typeCode: "FNGD_COOKIE",
      taxCodeId: taxStd.id,
      unitCodeId: uomBox.id,
    },
  });

  console.log("GoodsAndServices seeded.");

  // --- Create JournalPartnerLinks (JPL - 2-way) ---
  // FlourMart is a supplier, so linked to expense/cost accounts
  const jplFlourMartToFlourCosts = await prisma.journalPartnerLink.create({
    data: {
      journalId: jFlourCosts.id, // 5001 - Flour Costs
      partnerId: pSupplierFlourMart.id,
      partnershipType: "SUPPLIER",
    },
  });
  // SugarSweet is a supplier
  const jplSugarSweetToSugarCosts = await prisma.journalPartnerLink.create({
    data: {
      journalId: jSugarCosts.id, // 5002 - Sugar Costs
      partnerId: pSupplierSugarSweet.id,
      partnershipType: "SUPPLIER",
    },
  });
  // Cozy Cafe is a customer, linked to revenue accounts
  const jplCafeAToCakeSales = await prisma.journalPartnerLink.create({
    data: {
      journalId: jCakeSales.id, // 4001 - Cake Sales
      partnerId: pCustomerCafeA.id,
      partnershipType: "CUSTOMER",
    },
  });
  const jplCafeAToCookieSales = await prisma.journalPartnerLink.create({
    data: {
      journalId: jCookieSales.id, // 4002 - Cookie Sales
      partnerId: pCustomerCafeA.id,
      partnershipType: "CUSTOMER", // Cafe A buys both cakes and cookies
    },
  });
  // John Baker is a customer
  const jplJohnBToCookieSales = await prisma.journalPartnerLink.create({
    data: {
      journalId: jCookieSales.id, // 4002 - Cookie Sales
      partnerId: pCustomerJohnB.id,
      partnershipType: "CUSTOMER",
    },
  });
  // Link Cozy Cafe to Accounts Receivable as well
  const jplCafeAToReceivables = await prisma.journalPartnerLink.create({
    data: {
      journalId: jReceivables.id, // 1002 - Accounts Receivable
      partnerId: pCustomerCafeA.id,
      partnershipType: "DEBTOR",
    },
  });

  console.log("JournalPartnerLinks seeded.");

  // --- Create JournalGoodLinks (JGL - 2-way) ---
  // Cakes are sold, so linked to Cake Sales journal
  const jglCakeSalesToChocCake = await prisma.journalGoodLink.create({
    data: { journalId: jCakeSales.id, goodId: goodChocolateCake.id },
  });
  // Cookies are sold, linked to Cookie Sales journal
  const jglCookieSalesToVanillaCookies = await prisma.journalGoodLink.create({
    data: { journalId: jCookieSales.id, goodId: goodVanillaCookies.id },
  });
  // Flour is a cost, linked to Flour Costs journal
  const jglFlourCostsToFlour = await prisma.journalGoodLink.create({
    data: { journalId: jFlourCosts.id, goodId: goodFlour.id },
  });
  // Sugar is a cost, linked to Sugar Costs journal
  const jglSugarCostsToSugar = await prisma.journalGoodLink.create({
    data: { journalId: jSugarCosts.id, goodId: goodSugar.id },
  });

  console.log("JournalGoodLinks seeded.");

  // --- Create JournalPartnerGoodLinks (JPGL - 3-way) ---
  // When Cozy Cafe buys Chocolate Cakes (links jplCafeAToCakeSales with goodChocolateCake)
  await prisma.journalPartnerGoodLink.create({
    data: {
      journalPartnerLinkId: jplCafeAToCakeSales.id,
      goodId: goodChocolateCake.id,
      descriptiveText: "Standard order for Cozy Cafe",
    },
  });
  // When Cozy Cafe buys Vanilla Cookies
  await prisma.journalPartnerGoodLink.create({
    data: {
      journalPartnerLinkId: jplCafeAToCookieSales.id,
      goodId: goodVanillaCookies.id,
      descriptiveText: "Weekly cookie supply for Cozy Cafe",
    },
  });
  // When John Baker buys Vanilla Cookies
  await prisma.journalPartnerGoodLink.create({
    data: {
      journalPartnerLinkId: jplJohnBToCookieSales.id,
      goodId: goodVanillaCookies.id,
      descriptiveText: "Catering order for John Baker event",
    },
  });
  // When FlourMart supplies Flour (links jplFlourMartToFlourCosts with goodFlour)
  await prisma.journalPartnerGoodLink.create({
    data: {
      journalPartnerLinkId: jplFlourMartToFlourCosts.id,
      goodId: goodFlour.id,
      descriptiveText: "Regular flour supply contract",
    },
  });
  // When SugarSweet supplies Sugar
  await prisma.journalPartnerGoodLink.create({
    data: {
      journalPartnerLinkId: jplSugarSweetToSugarCosts.id,
      goodId: goodSugar.id,
    },
  });
  // Let's add another: FlourMart also supplies sugar sometimes (linking to Sugar Costs for FlourMart)
  // First, ensure a JPL exists for FlourMart and Sugar Costs
  const jplFlourMartToSugarCosts = await prisma.journalPartnerLink.upsert({
    where: {
      // Correct way to specify the composite unique constraint for Prisma Client
      journalId_partnerId_partnershipType: {
        journalId: jSugarCosts.id,
        partnerId: pSupplierFlourMart.id,
        partnershipType: "SUPPLIER", // Ensure this matches exactly, including null if that's part of unique
      },
    },
    update: {}, // What to update if found (can be empty if no changes needed on conflict)
    create: {
      journalId: jSugarCosts.id,
      partnerId: pSupplierFlourMart.id,
      partnershipType: "SUPPLIER",
      // Add any other non-nullable fields required by JournalPartnerLink if not defaulted
    },
  });
  await prisma.journalPartnerGoodLink.create({
    data: {
      journalPartnerLinkId: jplFlourMartToSugarCosts.id,
      goodId: goodSugar.id,
      descriptiveText: "Occasional sugar supply from FlourMart",
    },
  });

  console.log("JournalPartnerGoodLinks seeded.");

  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
