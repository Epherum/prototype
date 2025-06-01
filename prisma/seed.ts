import { PrismaClient, PartnerType, Journal } from "@prisma/client";

const prisma = new PrismaClient();

async function deleteAllData() {
  console.log("Deleting existing data...");

  // Order of deletion matters to respect foreign key constraints.
  // Start with tables that have the most dependencies or are "many" sides of relationships.

  // 1. JournalPartnerGoodLink (depends on JournalPartnerLink and GoodsAndService)
  await prisma.journalPartnerGoodLink.deleteMany({});
  console.log("Deleted JournalPartnerGoodLinks.");

  // 2. JournalPartnerLink (depends on Journal and Partner)
  await prisma.journalPartnerLink.deleteMany({});
  console.log("Deleted JournalPartnerLinks.");

  // 3. JournalGoodLink (depends on Journal and GoodsAndService)
  await prisma.journalGoodLink.deleteMany({});
  console.log("Deleted JournalGoodLinks.");

  // 4. GoodsAndService (referenced by JournalGoodLink, JournalPartnerGoodLink)
  //    (Its relations to TaxCode and UnitOfMeasure are onDelete: SetNull, so this is fine)
  await prisma.goodsAndService.deleteMany({});
  console.log("Deleted GoodsAndServices.");

  // 5. Partner (referenced by JournalPartnerLink)
  await prisma.partner.deleteMany({});
  console.log("Deleted Partners.");

  // 6. TaxCode and UnitOfMeasure (referenced by GoodsAndService with SetNull)
  await prisma.taxCode.deleteMany({});
  console.log("Deleted TaxCodes.");
  await prisma.unitOfMeasure.deleteMany({});
  console.log("Deleted UnitsOfMeasure.");

  // 7. Journal (self-referencing, this is the trickiest)
  //    The `onDelete: Restrict` for `parentId` means we must delete children before parents.
  //    We'll delete in passes, starting with leaf nodes (journals with no children).
  let journalsCount = await prisma.journal.count();
  let deletedInPass = 0;
  let pass = 0;
  console.log(`Starting journal deletion. Initial count: ${journalsCount}`);
  while (journalsCount > 0) {
    pass++;
    deletedInPass = (
      await prisma.journal.deleteMany({
        where: { children: { none: {} } }, // Delete journals that are not a parent to any other journal
      })
    ).count;

    console.log(`Pass ${pass}: Deleted ${deletedInPass} leaf journals.`);
    if (deletedInPass === 0 && journalsCount > 0) {
      const remaining = await prisma.journal.findMany({
        select: { id: true, name: true, parentId: true },
      });
      console.error(
        "Could not delete all journals. Remaining journals:",
        remaining
      );
      throw new Error(
        "Stuck deleting journals. This might indicate a cycle or an issue with the `children` relation filter. Manual check required."
      );
    }
    journalsCount = await prisma.journal.count();
  }
  console.log("All journals deleted.");
  console.log("Finished deleting all data.");
}

// Helper function to get all parent journals for a given journal ID
async function getJournalHierarchy(
  journalId: string | null
): Promise<Journal[]> {
  if (!journalId) return [];
  const hierarchy: Journal[] = [];
  let currentId: string | null = journalId;
  while (currentId) {
    const journal = await prisma.journal.findUnique({
      where: { id: currentId },
    });
    if (journal) {
      hierarchy.push(journal);
      currentId = journal.parentId;
    } else {
      currentId = null; // Should not happen if data is consistent
    }
  }
  return hierarchy.reverse(); // Return from root to leaf
}

// Helper to create JournalPartnerLinks hierarchically
async function linkPartnerToJournalWithHierarchy(
  partnerId: bigint,
  terminalJournalId: string,
  partnershipType: string | null
) {
  const hierarchy = await getJournalHierarchy(terminalJournalId);
  for (const journal of hierarchy) {
    await prisma.journalPartnerLink.upsert({
      where: {
        journalId_partnerId_partnershipType: {
          journalId: journal.id,
          partnerId: partnerId,
          partnershipType: partnershipType,
        },
      },
      update: {},
      create: {
        journalId: journal.id,
        partnerId: partnerId,
        partnershipType: partnershipType,
      },
    });
    console.log(
      `Linked partner ${partnerId} to journal ${journal.id} (${journal.name})`
    );
  }
}

// Helper to create JournalGoodLinks hierarchically
async function linkGoodToJournalWithHierarchy(
  goodId: bigint,
  terminalJournalId: string
) {
  const hierarchy = await getJournalHierarchy(terminalJournalId);
  for (const journal of hierarchy) {
    await prisma.journalGoodLink.upsert({
      where: {
        journalId_goodId: {
          journalId: journal.id,
          goodId: goodId,
        },
      },
      update: {},
      create: {
        journalId: journal.id,
        goodId: goodId,
      },
    });
    console.log(
      `Linked good ${goodId} to journal ${journal.id} (${journal.name})`
    );
  }
}

async function main() {
  await deleteAllData();

  console.log(`Start seeding ...`);

  // --- Create Journals (L1, L2, L3) ---
  // L1
  const jAssets = await prisma.journal.create({
    data: { id: "1", name: "Assets" },
  });
  const jLiabilities = await prisma.journal.create({
    data: { id: "2", name: "Liabilities" },
  });
  const jEquity = await prisma.journal.create({
    data: { id: "3", name: "Equity", isTerminal: true },
  });
  const jRevenue = await prisma.journal.create({
    data: { id: "4", name: "Revenue" },
  });
  const jExpenses = await prisma.journal.create({
    data: { id: "5", name: "Expenses" },
  });

  // L2 for Assets
  const jCurrentAssets = await prisma.journal.create({
    data: { id: "10", name: "Current Assets", parentId: jAssets.id },
  });
  const jFixedAssets = await prisma.journal.create({
    data: {
      id: "11",
      name: "Fixed Assets",
      parentId: jAssets.id,
      isTerminal: true,
    },
  });

  // L2 for Revenue
  const jSalesRevenue = await prisma.journal.create({
    data: { id: "40", name: "Sales Revenue", parentId: jRevenue.id },
  });

  // L2 for Expenses
  const jIngredientCosts = await prisma.journal.create({
    data: { id: "50", name: "Ingredient Costs", parentId: jExpenses.id },
  });
  const jOperatingExpenses = await prisma.journal.create({
    data: {
      id: "51",
      name: "Operating Expenses",
      parentId: jExpenses.id,
      isTerminal: true,
    },
  });

  // L3 (Terminal Accounts)
  const jCash = await prisma.journal.create({
    data: {
      id: "1001",
      name: "Cash on Hand",
      parentId: jCurrentAssets.id,
      isTerminal: true,
    },
  });
  const jReceivables = await prisma.journal.create({
    data: {
      id: "1002",
      name: "Accounts Receivable",
      parentId: jCurrentAssets.id,
      isTerminal: true,
    },
  });
  const jCakeSales = await prisma.journal.create({
    data: {
      id: "4001",
      name: "Cake Sales",
      parentId: jSalesRevenue.id,
      isTerminal: true,
    },
  });
  const jCookieSales = await prisma.journal.create({
    data: {
      id: "4002",
      name: "Cookie Sales",
      parentId: jSalesRevenue.id,
      isTerminal: true,
    },
  });
  const jFlourCosts = await prisma.journal.create({
    data: {
      id: "5001",
      name: "Flour Costs",
      parentId: jIngredientCosts.id,
      isTerminal: true,
    },
  });
  const jSugarCosts = await prisma.journal.create({
    data: {
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
      taxId: "FM12345",
    },
  });
  const pSupplierSugarSweet = await prisma.partner.create({
    data: {
      name: "Sugar & Sweet Co.",
      partnerType: PartnerType.LEGAL_ENTITY,
      taxId: "SS67890",
    },
  });
  const pCustomerCafeA = await prisma.partner.create({
    data: {
      name: "The Cozy Cafe",
      partnerType: PartnerType.LEGAL_ENTITY,
      registrationNumber: "CAFEA001",
    },
  });
  const pCustomerJohnB = await prisma.partner.create({
    data: {
      name: "John Baker (Caterer)",
      partnerType: PartnerType.NATURAL_PERSON,
    },
  });

  // New Unlinked Partners
  const pUnaffectedLogistics = await prisma.partner.create({
    data: {
      name: "Speedy Logistics Ltd.",
      partnerType: PartnerType.LEGAL_ENTITY,
      notes: "Potential future logistics partner, currently unlinked.",
      taxId: "SL99887",
    },
  });
  const pUnaffectedConsultant = await prisma.partner.create({
    data: {
      name: "Alice Advisor",
      partnerType: PartnerType.NATURAL_PERSON,
      notes: "Business consultant, no direct journal links yet.",
    },
  });
  const pUnaffectedHardware = await prisma.partner.create({
    data: {
      name: "Tech Hardware Supplies",
      partnerType: PartnerType.LEGAL_ENTITY,
      notes: "Hardware store, not yet integrated.",
      registrationNumber: "THS0023",
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
  });
  const uomBox = await prisma.unitOfMeasure.create({
    data: { code: "BOX", name: "Box" },
  });

  console.log("Tax Codes & UoM seeded.");

  // --- Create GoodsAndServices ---
  const goodFlour = await prisma.goodsAndService.create({
    data: {
      label: "Premium Baking Flour",
      referenceCode: "FLR001",
      typeCode: "INGREDIENT",
      taxCodeId: taxExempt.id,
      unitCodeId: uomKg.id,
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
      typeCode: "FNGD_CAKE",
      taxCodeId: taxStd.id,
      unitCodeId: uomEach.id,
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

  // New Unlinked Goods
  const goodOfficeSupplies = await prisma.goodsAndService.create({
    data: {
      label: "A4 Printer Paper Ream",
      referenceCode: "PAPER001",
      typeCode: "OFFICE_SUPPLY",
      taxCodeId: taxStd.id, // Assuming standard tax
      unitCodeId: uomEach.id, // Assuming 'Each' for a ream
      description: "Standard office printer paper.",
    },
  });
  const goodCleaningService = await prisma.goodsAndService.create({
    data: {
      label: "Monthly Office Cleaning",
      referenceCode: "CLEAN01",
      typeCode: "SERVICE",
      taxCodeId: taxStd.id,
      unitCodeId: uomEach.id, // 'Each' instance of service
      description: "Contracted monthly cleaning service.",
    },
  });

  console.log("GoodsAndServices seeded.");

  // --- Create JournalPartnerLinks (JPL - 2-way) with HIERARCHY ---
  console.log("\nLinking Partners to Journals with Hierarchy...");
  // FlourMart is a supplier of Flour (linked to terminal "Flour Costs" - 5001)
  await linkPartnerToJournalWithHierarchy(
    pSupplierFlourMart.id,
    jFlourCosts.id,
    "SUPPLIER"
  );
  // SugarSweet is a supplier of Sugar (linked to terminal "Sugar Costs" - 5002)
  await linkPartnerToJournalWithHierarchy(
    pSupplierSugarSweet.id,
    jSugarCosts.id,
    "SUPPLIER"
  );
  // Cozy Cafe is a customer for Cakes (linked to terminal "Cake Sales" - 4001)
  await linkPartnerToJournalWithHierarchy(
    pCustomerCafeA.id,
    jCakeSales.id,
    "CUSTOMER"
  );
  // Cozy Cafe is also a customer for Cookies (linked to terminal "Cookie Sales" - 4002)
  await linkPartnerToJournalWithHierarchy(
    pCustomerCafeA.id,
    jCookieSales.id,
    "CUSTOMER"
  );
  // Cozy Cafe is also a debtor (linked to terminal "Accounts Receivable" - 1002)
  await linkPartnerToJournalWithHierarchy(
    pCustomerCafeA.id,
    jReceivables.id,
    "DEBTOR"
  );
  // John Baker is a customer for Cookies (linked to terminal "Cookie Sales" - 4002)
  await linkPartnerToJournalWithHierarchy(
    pCustomerJohnB.id,
    jCookieSales.id,
    "CUSTOMER"
  );

  console.log("JournalPartnerLinks with hierarchy seeded.");

  // --- Create JournalGoodLinks (JGL - 2-way) with HIERARCHY ---
  console.log("\nLinking Goods to Journals with Hierarchy...");
  // Chocolate Cakes are sold (linked to terminal "Cake Sales" - 4001)
  await linkGoodToJournalWithHierarchy(goodChocolateCake.id, jCakeSales.id);
  // Vanilla Cookies are sold (linked to terminal "Cookie Sales" - 4002)
  await linkGoodToJournalWithHierarchy(goodVanillaCookies.id, jCookieSales.id);
  // Flour is a cost (linked to terminal "Flour Costs" - 5001)
  await linkGoodToJournalWithHierarchy(goodFlour.id, jFlourCosts.id);
  // Sugar is a cost (linked to terminal "Sugar Costs" - 5002)
  await linkGoodToJournalWithHierarchy(goodSugar.id, jSugarCosts.id);

  console.log("JournalGoodLinks with hierarchy seeded.");

  // --- Create JournalPartnerGoodLinks (JPGL - 3-way) ---
  // These links directly use the *terminal* JournalPartnerLink.
  // The hierarchical nature is for querying/filtering, not necessarily for the 3-way link's direct JPL reference.
  // However, the JPL itself must exist at the terminal level for the transaction.
  console.log("\nCreating JournalPartnerGoodLinks (3-way)...");

  // Find the specific terminal JPLs to use for the 3-way links
  const jplCafeACakeSales = await prisma.journalPartnerLink.findUniqueOrThrow({
    where: {
      journalId_partnerId_partnershipType: {
        journalId: jCakeSales.id,
        partnerId: pCustomerCafeA.id,
        partnershipType: "CUSTOMER",
      },
    },
  });
  const jplCafeACookieSales = await prisma.journalPartnerLink.findUniqueOrThrow(
    {
      where: {
        journalId_partnerId_partnershipType: {
          journalId: jCookieSales.id,
          partnerId: pCustomerCafeA.id,
          partnershipType: "CUSTOMER",
        },
      },
    }
  );
  const jplJohnBCookieSales = await prisma.journalPartnerLink.findUniqueOrThrow(
    {
      where: {
        journalId_partnerId_partnershipType: {
          journalId: jCookieSales.id,
          partnerId: pCustomerJohnB.id,
          partnershipType: "CUSTOMER",
        },
      },
    }
  );
  const jplFlourMartFlourCosts =
    await prisma.journalPartnerLink.findUniqueOrThrow({
      where: {
        journalId_partnerId_partnershipType: {
          journalId: jFlourCosts.id,
          partnerId: pSupplierFlourMart.id,
          partnershipType: "SUPPLIER",
        },
      },
    });
  const jplSugarSweetSugarCosts =
    await prisma.journalPartnerLink.findUniqueOrThrow({
      where: {
        journalId_partnerId_partnershipType: {
          journalId: jSugarCosts.id,
          partnerId: pSupplierSugarSweet.id,
          partnershipType: "SUPPLIER",
        },
      },
    });

  await prisma.journalPartnerGoodLink.createMany({
    data: [
      {
        journalPartnerLinkId: jplCafeACakeSales.id,
        goodId: goodChocolateCake.id,
        descriptiveText: "Cozy Cafe - Choc Cake",
      },
      {
        journalPartnerLinkId: jplCafeACookieSales.id,
        goodId: goodVanillaCookies.id,
        descriptiveText: "Cozy Cafe - Cookies",
      },
      {
        journalPartnerLinkId: jplJohnBCookieSales.id,
        goodId: goodVanillaCookies.id,
        descriptiveText: "John Baker - Cookies",
      },
      {
        journalPartnerLinkId: jplFlourMartFlourCosts.id,
        goodId: goodFlour.id,
        descriptiveText: "FlourMart - Flour",
      },
      {
        journalPartnerLinkId: jplSugarSweetSugarCosts.id,
        goodId: goodSugar.id,
        descriptiveText: "SugarSweet - Sugar",
      },
    ],
  });

  console.log("JournalPartnerGoodLinks seeded.");
  console.log(`Seeding finished.`);
}

main()
  .catch(async (e) => {
    console.error("Seeding failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
