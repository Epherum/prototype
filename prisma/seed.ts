import {
  PrismaClient,
  PartnerType,
  Journal as PrismaJournal,
  Prisma, // Import Prisma for types like JsonObject
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Define a type for our Journal structure in the seed
type SeedJournalInput = Omit<
  PrismaJournal,
  | "createdAt"
  | "updatedAt"
  | "companyId" // companyId will be passed to the creation function
  | "parentId" // parentId will be handled during recursive creation
> & {
  id: string; // Keep natural id for journal
  parentId?: string | null; // parentId refers to the natural id of the parent journal
  children?: SeedJournalInput[]; // For nested creation
  // isTerminal and additionalDetails are already part of PrismaJournal
};

async function deleteAllData() {
  console.log("Deleting existing data...");
  // Order of deletion matters to respect foreign key constraints.
  // Start with tables that have the most dependencies or are "many" sides of relationships.

  // Linking tables first (depend on multiple entities)
  await prisma.journalPartnerGoodLink.deleteMany({});
  console.log("Deleted JournalPartnerGoodLinks.");

  // Then tables involved in many-to-many for auth
  await prisma.rolePermission.deleteMany({});
  console.log("Deleted RolePermissions.");
  await prisma.userRole.deleteMany({});
  console.log("Deleted UserRoles.");

  // Linking tables that depend on primary entities
  await prisma.journalPartnerLink.deleteMany({});
  console.log("Deleted JournalPartnerLinks.");
  await prisma.journalGoodLink.deleteMany({});
  console.log("Deleted JournalGoodLinks.");

  // Primary auth entities (Permissions can be global, so keep or delete as needed)
  // If permissions are truly static, you might skip deleting them. For a full wipe:
  await prisma.permission.deleteMany({});
  console.log("Deleted Permissions.");
  await prisma.role.deleteMany({}); // Depends on Company
  console.log("Deleted Roles.");
  await prisma.user.deleteMany({}); // Depends on Company
  console.log("Deleted Users.");

  // Core business entities that other things might depend on
  await prisma.goodsAndService.deleteMany({}); // Depends on Company, TaxCode, UnitOfMeasure
  console.log("Deleted GoodsAndServices.");
  await prisma.partner.deleteMany({}); // Depends on Company
  console.log("Deleted Partners.");
  await prisma.taxCode.deleteMany({}); // Depends on Company
  console.log("Deleted TaxCodes.");
  await prisma.unitOfMeasure.deleteMany({}); // Depends on Company
  console.log("Deleted UnitsOfMeasure.");

  // Journal deletion: iterative approach for self-referencing hierarchy
  let journalsCount = await prisma.journal.count();
  let pass = 0;
  console.log(`Starting journal deletion. Initial count: ${journalsCount}`);
  while (journalsCount > 0) {
    pass++;
    const { count: deletedInPass } = await prisma.journal.deleteMany({
      where: { children: { none: {} } }, // Delete leaf nodes
    });
    console.log(`Pass ${pass}: Deleted ${deletedInPass} leaf journals.`);
    const newJournalsCount = await prisma.journal.count();
    if (deletedInPass === 0 && newJournalsCount > 0) {
      const remaining = await prisma.journal.findMany({
        select: { id: true, companyId: true, name: true, parentId: true },
        take: 10,
      });
      console.error(
        "Could not delete all journals. Remaining journals (sample):",
        remaining
      );
      throw new Error(
        "Stuck deleting journals. Manual check required. Possible cycle or unhandled dependency."
      );
    }
    journalsCount = newJournalsCount;
    if (pass > 20 && journalsCount > 0) {
      // Increased safety break passes
      const remaining = await prisma.journal.findMany({
        select: { id: true, companyId: true, name: true, parentId: true },
        take: 10,
      });
      console.error(
        "Journal deletion took too many passes. Possible cycle or issue. Remaining (sample):",
        remaining
      );
      throw new Error(
        "Journal deletion took too many passes. Possible cycle or issue."
      );
    }
  }
  console.log("All journals deleted.");

  // Finally, delete companies (this should cascade to any remaining direct dependents if configured,
  // but we aim to delete dependents explicitly above for clarity and control)
  await prisma.company.deleteMany({});
  console.log("Deleted Companies.");

  console.log("Finished deleting all data.");
}

async function createJournalsForCompany(
  companyId: string,
  journalsData: SeedJournalInput[]
): Promise<Record<string, PrismaJournal>> {
  const createdJournals: Record<string, PrismaJournal> = {};

  async function createJournalRecursive(
    journalInput: SeedJournalInput,
    parentNaturalIdForPrisma?: string | null // Explicitly for Prisma's parentId field
  ) {
    const { children, id: naturalId, parentId, ...data } = journalInput;

    const created = await prisma.journal.create({
      data: {
        ...data,
        id: naturalId, // This is the natural ID part of the composite key
        companyId: companyId,
        parentId: parentNaturalIdForPrisma, // Use the passed parentNaturalIdForPrisma
        // isTerminal is part of `data` from SeedJournalInput
        // additionalDetails is part of `data` from SeedJournalInput
      },
    });
    createdJournals[created.id] = created; // Store by natural ID for easy lookup
    console.log(
      `Created Journal: ${created.name} (Natural ID: ${
        created.id
      }, Company: ${companyId}, Parent: ${parentNaturalIdForPrisma || "ROOT"})`
    );

    if (children && children.length > 0) {
      for (const child of children) {
        await createJournalRecursive(child, naturalId); // Pass current journal's naturalId as parent for children
      }
    }
  }

  for (const journal of journalsData) {
    if (!journal.parentId) {
      // Process top-level journals first (those whose parentId in input is null/undefined)
      await createJournalRecursive(journal, null);
    }
  }
  return createdJournals;
}

async function getJournalHierarchy(
  companyId: string,
  journalNaturalId: string | null
): Promise<PrismaJournal[]> {
  if (!journalNaturalId) return [];
  const hierarchy: PrismaJournal[] = [];
  let currentNaturalId: string | null = journalNaturalId;
  while (currentNaturalId) {
    const journal = await prisma.journal.findUnique({
      where: { id_companyId: { id: currentNaturalId, companyId: companyId } },
    });
    if (journal) {
      hierarchy.push(journal);
      currentNaturalId = journal.parentId;
    } else {
      currentNaturalId = null;
    }
  }
  return hierarchy.reverse();
}

async function linkPartnerToJournalWithHierarchy(
  companyId: string,
  partnerId: bigint,
  terminalJournalNaturalId: string,
  partnershipType: string | null // Prisma schema expects string, not String | null, ensure DB allows null
) {
  const hierarchy = await getJournalHierarchy(
    companyId,
    terminalJournalNaturalId
  );
  for (const journal of hierarchy) {
    await prisma.journalPartnerLink.upsert({
      where: {
        companyId_journalId_partnerId_partnershipType: {
          companyId: companyId,
          journalId: journal.id,
          partnerId: partnerId,
          partnershipType: partnershipType ?? "", // Handle null for unique constraint if DB field is NOT NULL
          // If DB field allows NULL, Prisma might require explicit null or a default.
          // Check schema: partnershipType     String?
          // So, `partnershipType: partnershipType,` should be fine if it's truly optional
        },
      },
      update: {}, // No specific fields to update if it exists
      create: {
        companyId: companyId,
        journalId: journal.id,
        partnerId: partnerId,
        partnershipType: partnershipType,
      },
    });
  }
}

async function linkGoodToJournalWithHierarchy(
  companyId: string,
  goodId: bigint,
  terminalJournalNaturalId: string
) {
  const hierarchy = await getJournalHierarchy(
    companyId,
    terminalJournalNaturalId
  );
  for (const journal of hierarchy) {
    await prisma.journalGoodLink.upsert({
      where: {
        companyId_journalId_goodId: {
          companyId: companyId,
          journalId: journal.id,
          goodId: goodId,
        },
      },
      update: {},
      create: {
        companyId: companyId,
        journalId: journal.id,
        goodId: goodId,
      },
    });
  }
}

async function main() {
  await deleteAllData(); // Ensure this runs and completes successfully
  console.log(`Start seeding ...`);

  // --- 1. Create a Company ---
  const company1 = await prisma.company.create({
    data: { name: "BakeryDemo Inc." },
  });
  console.log(`Created Company: ${company1.name} (ID: ${company1.id})`);

  // --- 2. Create Permissions (Global) ---
  const permissionsData = [
    { action: "CREATE", resource: "JOURNAL", description: "Create journals" },
    { action: "READ", resource: "JOURNAL", description: "Read journals" },
    // ... (add descriptions for all)
    { action: "UPDATE", resource: "JOURNAL" },
    { action: "DELETE", resource: "JOURNAL" },
    { action: "CREATE", resource: "PARTNER" },
    { action: "READ", resource: "PARTNER" },
    { action: "UPDATE", resource: "PARTNER" },
    { action: "DELETE", resource: "PARTNER" },
    { action: "CREATE", resource: "GOODS" },
    { action: "READ", resource: "GOODS" },
    { action: "UPDATE", resource: "GOODS" },
    { action: "DELETE", resource: "GOODS" },
    { action: "LINK", resource: "PARTNER_JOURNAL" },
    { action: "UNLINK", resource: "PARTNER_JOURNAL" },
    { action: "LINK", resource: "GOOD_JOURNAL" },
    { action: "UNLINK", resource: "GOOD_JOURNAL" },
    { action: "CREATE", resource: "JPGLINK" },
    { action: "DELETE", resource: "JPGLINK" },
    { action: "CREATE", resource: "DOCUMENT" },
    { action: "READ", resource: "DOCUMENT" },
    { action: "MANAGE", resource: "USERS" },
    { action: "MANAGE", resource: "ROLES" },
  ];

  // Create permissions and then fetch them to build the map
  await prisma.permission.createMany({
    data: permissionsData,
    skipDuplicates: true,
  });
  console.log(`Created/Ensured Permissions.`);

  const allPermissions = await prisma.permission.findMany();
  const permMap = allPermissions.reduce((acc, p) => {
    acc[`${p.action}_${p.resource}`] = p.id;
    return acc;
  }, {} as Record<string, string>);

  // --- 3. Create Roles for Company1 ---
  const adminRoleC1 = await prisma.role.create({
    data: {
      name: "Company Admin",
      companyId: company1.id,
      description: "Full access to company data and user management.",
      permissions: {
        create: Object.values(permMap).map((permissionId) => ({
          // All permissions
          permissionId,
        })),
      },
    },
  });
  // ... (accountantRoleC1 and salesRoleC1 definitions remain the same, ensure permMap keys are correct)
  const accountantRoleC1 = await prisma.role.create({
    data: {
      name: "Accountant",
      companyId: company1.id,
      description:
        "Access to financial data, CRUD on journals, partners, goods, linking.",
      permissions: {
        create: [
          permMap["CREATE_JOURNAL"],
          permMap["READ_JOURNAL"],
          permMap["UPDATE_JOURNAL"],
          permMap["DELETE_JOURNAL"],
          permMap["CREATE_PARTNER"],
          permMap["READ_PARTNER"],
          permMap["UPDATE_PARTNER"],
          permMap["DELETE_PARTNER"],
          permMap["CREATE_GOODS"],
          permMap["READ_GOODS"],
          permMap["UPDATE_GOODS"],
          permMap["DELETE_GOODS"],
          permMap["LINK_PARTNER_JOURNAL"],
          permMap["UNLINK_PARTNER_JOURNAL"],
          permMap["LINK_GOOD_JOURNAL"],
          permMap["UNLINK_GOOD_JOURNAL"],
          permMap["CREATE_JPGLINK"],
          permMap["DELETE_JPGLINK"],
          permMap["CREATE_DOCUMENT"],
          permMap["READ_DOCUMENT"],
        ]
          .filter(Boolean) // Ensure no undefined IDs if a permMap key was mistyped
          .map((permissionId) => ({ permissionId: permissionId! })),
      },
    },
  });
  const salesRoleC1 = await prisma.role.create({
    data: {
      name: "Sales Restricted",
      companyId: company1.id,
      description:
        "Read access to Sales journals, partners, goods. Can create documents.",
      permissions: {
        create: [
          permMap["READ_JOURNAL"],
          permMap["READ_PARTNER"],
          permMap["READ_GOODS"],
          permMap["CREATE_DOCUMENT"],
          permMap["CREATE_JPGLINK"],
        ]
          .filter(Boolean)
          .map((permissionId) => ({ permissionId: permissionId! })),
      },
    },
  });
  console.log(`Created Roles for ${company1.name}.`);

  // --- 4. Create Journals (L1, L2, L3) for Company1 ---
  // (Moved before User creation)
  const journalsStructure: SeedJournalInput[] = [
    {
      id: "1",
      name: "Assets",
      isTerminal: false,
      additionalDetails: {},
      children: [
        {
          id: "10",
          name: "Current Assets",
          isTerminal: false,
          additionalDetails: {},
          children: [
            {
              id: "1001",
              name: "Cash on Hand",
              isTerminal: true,
              additionalDetails: {},
            },
            {
              id: "1002",
              name: "Accounts Receivable",
              isTerminal: true,
              additionalDetails: {},
            },
          ],
        },
        {
          id: "11",
          name: "Fixed Assets",
          isTerminal: true,
          additionalDetails: {},
        },
      ],
    },
    { id: "2", name: "Liabilities", isTerminal: false, additionalDetails: {} },
    { id: "3", name: "Equity", isTerminal: true, additionalDetails: {} },
    {
      id: "4",
      name: "Revenue",
      isTerminal: false,
      additionalDetails: {},
      children: [
        {
          id: "40",
          name: "Sales Revenue",
          isTerminal: false,
          additionalDetails: {},
          children: [
            {
              id: "4001",
              name: "Cake Sales",
              isTerminal: true,
              additionalDetails: {},
            },
            {
              id: "4002",
              name: "Cookie Sales",
              isTerminal: true,
              additionalDetails: {},
            },
          ],
        },
      ],
    },
    {
      id: "5",
      name: "Expenses",
      isTerminal: false,
      additionalDetails: {},
      children: [
        {
          id: "50",
          name: "Ingredient Costs",
          isTerminal: false,
          additionalDetails: {},
          children: [
            {
              id: "5001",
              name: "Flour Costs",
              isTerminal: true,
              additionalDetails: {},
            },
            {
              id: "5002",
              name: "Sugar Costs",
              isTerminal: true,
              additionalDetails: {},
            },
          ],
        },
        {
          id: "51",
          name: "Operating Expenses",
          isTerminal: true,
          additionalDetails: {},
        },
      ],
    },
  ];

  const c1_journals = await createJournalsForCompany(
    company1.id,
    journalsStructure
  );
  console.log("Journals seeded for Company1.");

  // --- 5. Create Users for Company1 ---
  const hashedPasswordAdmin = await bcrypt.hash("admin123", 10);
  const adminUserC1 = await prisma.user.create({
    data: {
      email: "admin@bakerydemo.com",
      name: "Admin User",
      passwordHash: hashedPasswordAdmin,
      companyId: company1.id,
      userRoles: { create: { roleId: adminRoleC1.id } },
    },
  });

  const hashedPasswordAccountant = await bcrypt.hash("accountant123", 10);
  const accountantUserC1 = await prisma.user.create({
    data: {
      email: "accountant@bakerydemo.com",
      name: "Accountant User",
      passwordHash: hashedPasswordAccountant,
      companyId: company1.id,
      userRoles: { create: { roleId: accountantRoleC1.id } },
    },
  });

  const hashedPasswordSales = await bcrypt.hash("sales123", 10);
  const salesUserC1 = await prisma.user.create({
    data: {
      email: "sales@bakerydemo.com",
      name: "Sales Person Restricted",
      passwordHash: hashedPasswordSales,
      companyId: company1.id,
      userRoles: {
        create: {
          roleId: salesRoleC1.id,
          restrictedTopLevelJournalId: "4", // Natural ID of "Revenue" journal
          restrictedTopLevelJournalCompanyId: company1.id,
        },
      },
    },
  });
  console.log(`Created Users for ${company1.name}.`);

  // --- 6. Create Partners for Company1 ---
  // ... (your partner data, ensure companyId is set for all)
  const pSupplierFlourMart = await prisma.partner.create({
    data: {
      name: "FlourMart Inc.",
      partnerType: PartnerType.LEGAL_ENTITY,
      taxId: "FM12345",
      companyId: company1.id,
    },
  });
  const pSupplierSugarSweet = await prisma.partner.create({
    data: {
      name: "Sugar & Sweet Co.",
      partnerType: PartnerType.LEGAL_ENTITY,
      taxId: "SS67890",
      companyId: company1.id,
    },
  });
  const pCustomerCafeA = await prisma.partner.create({
    data: {
      name: "The Cozy Cafe",
      partnerType: PartnerType.LEGAL_ENTITY,
      registrationNumber: "CAFEA001",
      companyId: company1.id,
    },
  });
  const pCustomerJohnB = await prisma.partner.create({
    data: {
      name: "John Baker (Caterer)",
      partnerType: PartnerType.NATURAL_PERSON,
      companyId: company1.id,
    },
  });
  const pUnaffectedLogistics = await prisma.partner.create({
    data: {
      name: "Speedy Logistics Ltd.",
      partnerType: PartnerType.LEGAL_ENTITY,
      notes: "Potential future logistics partner, currently unlinked.",
      taxId: "SL99887",
      companyId: company1.id,
    },
  });
  console.log("Partners seeded for Company1.");

  // --- 7. Create Tax Codes & Units of Measure for Company1 ---
  // ... (your tax code & uom data, ensure companyId is set for all)
  const taxStd = await prisma.taxCode.create({
    data: {
      code: "STD20",
      description: "Standard Sales Tax",
      rate: 0.2,
      companyId: company1.id,
    },
  });
  const taxExempt = await prisma.taxCode.create({
    data: {
      code: "EXEMPT",
      description: "Tax Exempt",
      rate: 0.0,
      companyId: company1.id,
    },
  });
  const uomKg = await prisma.unitOfMeasure.create({
    data: { code: "KG", name: "Kilogram", companyId: company1.id },
  });
  const uomEach = await prisma.unitOfMeasure.create({
    data: { code: "EA", name: "Each", companyId: company1.id },
  });
  const uomBox = await prisma.unitOfMeasure.create({
    data: { code: "BOX", name: "Box", companyId: company1.id },
  });
  console.log("Tax Codes & UoM seeded for Company1.");

  // --- 8. Create GoodsAndServices for Company1 ---
  // ... (your goods data, ensure companyId is set for all)
  const goodFlour = await prisma.goodsAndService.create({
    data: {
      label: "Premium Baking Flour",
      referenceCode: "FLR001",
      typeCode: "INGREDIENT",
      taxCodeId: taxExempt.id,
      unitCodeId: uomKg.id,
      companyId: company1.id,
    },
  });
  const goodSugar = await prisma.goodsAndService.create({
    data: {
      label: "Granulated Sugar",
      referenceCode: "SUG001",
      typeCode: "INGREDIENT",
      taxCodeId: taxExempt.id,
      unitCodeId: uomKg.id,
      companyId: company1.id,
    },
  });
  const goodChocolateCake = await prisma.goodsAndService.create({
    data: {
      label: "Classic Chocolate Cake",
      referenceCode: "CAKE001",
      typeCode: "FNGD_CAKE",
      taxCodeId: taxStd.id,
      unitCodeId: uomEach.id,
      companyId: company1.id,
    },
  });
  const goodVanillaCookies = await prisma.goodsAndService.create({
    data: {
      label: "Vanilla Bean Cookies (Box of 12)",
      referenceCode: "CKIE001",
      typeCode: "FNGD_COOKIE",
      taxCodeId: taxStd.id,
      unitCodeId: uomBox.id,
      companyId: company1.id,
    },
  });
  const goodOfficeSupplies = await prisma.goodsAndService.create({
    data: {
      label: "A4 Printer Paper Ream",
      referenceCode: "PAPER001",
      typeCode: "OFFICE_SUPPLY",
      taxCodeId: taxStd.id,
      unitCodeId: uomEach.id,
      description: "Standard office printer paper.",
      companyId: company1.id,
    },
  });
  console.log("GoodsAndServices seeded for Company1.");

  // --- 9. Create JournalPartnerLinks (JPL - 2-way) with HIERARCHY for Company1 ---
  console.log("\nLinking Partners to Journals with Hierarchy for Company1...");
  // ... (your linking logic for JPL)
  await linkPartnerToJournalWithHierarchy(
    company1.id,
    pSupplierFlourMart.id,
    "5001",
    "SUPPLIER"
  );
  await linkPartnerToJournalWithHierarchy(
    company1.id,
    pSupplierSugarSweet.id,
    "5002",
    "SUPPLIER"
  );
  await linkPartnerToJournalWithHierarchy(
    company1.id,
    pCustomerCafeA.id,
    "4001",
    "CUSTOMER"
  );
  await linkPartnerToJournalWithHierarchy(
    company1.id,
    pCustomerCafeA.id,
    "4002",
    "CUSTOMER"
  );
  await linkPartnerToJournalWithHierarchy(
    company1.id,
    pCustomerCafeA.id,
    "1002",
    "DEBTOR"
  );
  await linkPartnerToJournalWithHierarchy(
    company1.id,
    pCustomerJohnB.id,
    "4002",
    "CUSTOMER"
  );
  console.log("JournalPartnerLinks with hierarchy seeded for Company1.");

  // --- 10. Create JournalGoodLinks (JGL - 2-way) with HIERARCHY for Company1 ---
  console.log("\nLinking Goods to Journals with Hierarchy for Company1...");
  // ... (your linking logic for JGL)
  await linkGoodToJournalWithHierarchy(
    company1.id,
    goodChocolateCake.id,
    "4001"
  );
  await linkGoodToJournalWithHierarchy(
    company1.id,
    goodVanillaCookies.id,
    "4002"
  );
  await linkGoodToJournalWithHierarchy(company1.id, goodFlour.id, "5001");
  await linkGoodToJournalWithHierarchy(company1.id, goodSugar.id, "5002");
  console.log("JournalGoodLinks with hierarchy seeded for Company1.");

  // --- 11. Create JournalPartnerGoodLinks (JPGL - 3-way) for Company1 ---
  console.log("\nCreating JournalPartnerGoodLinks (3-way) for Company1...");
  // ... (your JPGL creation logic - ensure unique constraints are met)
  const jplCafeACakeSales = await prisma.journalPartnerLink.findUniqueOrThrow({
    where: {
      companyId_journalId_partnerId_partnershipType: {
        companyId: company1.id,
        journalId: "4001",
        partnerId: pCustomerCafeA.id,
        partnershipType: "CUSTOMER",
      },
    },
  });
  // ... (rest of your findUniqueOrThrow calls for JPLs)
  const jplCafeACookieSales = await prisma.journalPartnerLink.findUniqueOrThrow(
    {
      where: {
        companyId_journalId_partnerId_partnershipType: {
          companyId: company1.id,
          journalId: "4002",
          partnerId: pCustomerCafeA.id,
          partnershipType: "CUSTOMER",
        },
      },
    }
  );
  const jplJohnBCookieSales = await prisma.journalPartnerLink.findUniqueOrThrow(
    {
      where: {
        companyId_journalId_partnerId_partnershipType: {
          companyId: company1.id,
          journalId: "4002",
          partnerId: pCustomerJohnB.id,
          partnershipType: "CUSTOMER",
        },
      },
    }
  );
  const jplFlourMartFlourCosts =
    await prisma.journalPartnerLink.findUniqueOrThrow({
      where: {
        companyId_journalId_partnerId_partnershipType: {
          companyId: company1.id,
          journalId: "5001",
          partnerId: pSupplierFlourMart.id,
          partnershipType: "SUPPLIER",
        },
      },
    });
  const jplSugarSweetSugarCosts =
    await prisma.journalPartnerLink.findUniqueOrThrow({
      where: {
        companyId_journalId_partnerId_partnershipType: {
          companyId: company1.id,
          journalId: "5002",
          partnerId: pSupplierSugarSweet.id,
          partnershipType: "SUPPLIER",
        },
      },
    });

  await prisma.journalPartnerGoodLink.createMany({
    data: [
      {
        companyId: company1.id,
        journalPartnerLinkId: jplCafeACakeSales.id,
        goodId: goodChocolateCake.id,
        descriptiveText: "Cozy Cafe - Choc Cake",
      },
      {
        companyId: company1.id,
        journalPartnerLinkId: jplCafeACookieSales.id,
        goodId: goodVanillaCookies.id,
        descriptiveText: "Cozy Cafe - Cookies",
      },
      {
        companyId: company1.id,
        journalPartnerLinkId: jplJohnBCookieSales.id,
        goodId: goodVanillaCookies.id,
        descriptiveText: "John Baker - Cookies",
      },
      {
        companyId: company1.id,
        journalPartnerLinkId: jplFlourMartFlourCosts.id,
        goodId: goodFlour.id,
        descriptiveText: "FlourMart - Flour",
      },
      {
        companyId: company1.id,
        journalPartnerLinkId: jplSugarSweetSugarCosts.id,
        goodId: goodSugar.id,
        descriptiveText: "SugarSweet - Sugar",
      },
    ],
    skipDuplicates: true, // Add if there's any chance of re-running parts and causing duplicates
  });
  console.log("JournalPartnerGoodLinks seeded for Company1.");

  console.log(`Seeding finished.`);
}

main()
  .catch(async (e) => {
    console.error("Seeding failed:", e);
    // Try to disconnect even on error
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Failed to disconnect Prisma client:", disconnectError);
    }
    process.exit(1);
  })
  .finally(async () => {
    // Ensure disconnection happens
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error(
        "Failed to disconnect Prisma client in finally block:",
        disconnectError
      );
    }
  });
