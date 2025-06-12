// prisma/seed.ts

import {
  PrismaClient,
  PartnerType,
  Journal as PrismaJournal,
  ApprovalStatus,
  EntityState,
  Prisma,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// A helper type for creating the nested journal structure.
type SeedJournalInput = Omit<
  Prisma.JournalCreateInput,
  "company" | "parent" | "children"
> & {
  id: string; // The natural ID for the journal
  children?: SeedJournalInput[];
};

/**
 * Deletes all data from the database in an order that respects foreign key constraints.
 */
async function deleteAllData() {
  console.log("--- Deleting all existing data... ---");
  // Use a transaction to ensure all deletions succeed or none do.
  await prisma.$transaction([
    prisma.journalPartnerGoodLink.deleteMany({}),
    prisma.rolePermission.deleteMany({}),
    prisma.userRole.deleteMany({}),
    prisma.journalPartnerLink.deleteMany({}),
    prisma.journalGoodLink.deleteMany({}),
    prisma.permission.deleteMany({}),
    prisma.role.deleteMany({}),
    // Order matters: Delete entities that are referenced by others last.
    prisma.goodsAndService.deleteMany({}),
    prisma.partner.deleteMany({}),
    prisma.taxCode.deleteMany({}),
    prisma.unitOfMeasure.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);
  console.log(
    "Deleted linking tables, auth models, and core business entities."
  );

  // Iterative deletion for self-referencing journals is a good strategy.
  let journalsCount = await prisma.journal.count();
  let pass = 0;
  while (journalsCount > 0 && pass < 20) {
    pass++;
    // Delete journals that are not parents to any other journal.
    const { count } = await prisma.journal.deleteMany({
      where: { children: { none: {} } },
    });
    if (count === 0 && (await prisma.journal.count()) > 0) {
      console.error(
        "Stuck in journal deletion loop. Manual check for cycles required."
      );
      break;
    }
    console.log(
      `Journal Deletion Pass ${pass}: Deleted ${count} leaf journals.`
    );
    journalsCount = await prisma.journal.count();
  }

  // Finally, delete the company.
  await prisma.company.deleteMany({});
  console.log("Deleted all Journals and Companies.");
  console.log("--- Deletion complete. ---");
}

/**
 * Recursively creates journals for a given company.
 */
async function createJournalsForCompany(
  companyId: string,
  journalsData: SeedJournalInput[],
  parentNaturalId?: string
) {
  for (const journalInput of journalsData) {
    const { children, ...data } = journalInput;
    await prisma.journal.create({
      data: {
        ...data,
        company: { connect: { id: companyId } },
        parent: parentNaturalId
          ? { connect: { id_companyId: { id: parentNaturalId, companyId } } }
          : undefined,
      },
    });
    if (children && children.length > 0) {
      await createJournalsForCompany(companyId, children, data.id);
    }
  }
}

/**
 * Traverses up the journal tree to get all parent journals.
 */
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

/**
 * Links a partner to a terminal journal and all of its parents.
 */
async function linkPartnerToJournalWithHierarchy(
  companyId: string,
  partnerId: bigint,
  terminalJournalNaturalId: string,
  partnershipType: string | null
) {
  const hierarchy = await getJournalHierarchy(
    companyId,
    terminalJournalNaturalId
  );
  for (const journal of hierarchy) {
    await prisma.journalPartnerLink.upsert({
      where: {
        companyId_journalId_partnerId_partnershipType: {
          companyId,
          journalId: journal.id,
          partnerId,
          partnershipType: partnershipType ?? "DEFAULT",
        },
      },
      update: {},
      create: { companyId, journalId: journal.id, partnerId, partnershipType },
    });
  }
}

/**
 * Links a good to a terminal journal and all of its parents.
 */
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
          companyId,
          journalId: journal.id,
          goodId,
        },
      },
      update: {},
      create: { companyId, journalId: journal.id, goodId },
    });
  }
}

async function main() {
  await deleteAllData();
  console.log(`--- Start seeding... ---`);

  // --- 1. Create Company ---
  const company1 = await prisma.company.create({
    data: { name: "BakeryDemo Inc." },
  });
  console.log(`Created Company: ${company1.name}`);

  // --- 2. Create Permissions & Roles (without user assignment yet) ---
  const permissionsData = [
    { action: "MANAGE", resource: "USERS" },
    { action: "MANAGE", resource: "ROLES" },
    { action: "CREATE", resource: "PARTNER" },
    { action: "READ", resource: "PARTNER" },
    { action: "UPDATE", resource: "PARTNER" },
    { action: "DELETE", resource: "PARTNER" },
    { action: "APPROVE", resource: "PARTNER" },
    { action: "READ_HISTORY", resource: "PARTNER" },
    { action: "CREATE", resource: "GOODS_AND_SERVICE" },
    { action: "READ", resource: "GOODS_AND_SERVICE" },
    { action: "UPDATE", resource: "GOODS_AND_SERVICE" },
    { action: "DELETE", resource: "GOODS_AND_SERVICE" },
    { action: "APPROVE", resource: "GOODS_AND_SERVICE" },
    { action: "READ_HISTORY", resource: "GOODS_AND_SERVICE" },
    { action: "READ", resource: "JOURNAL" },
    { action: "MANAGE", resource: "JOURNAL" },
    { action: "LINK", resource: "PARTNER_JOURNAL" },
    { action: "LINK", resource: "GOOD_JOURNAL" },
    { action: "LINK", resource: "GOOD_PARTNER_JOURNAL" },
    { action: "CREATE", resource: "DOCUMENT" },
  ];
  await prisma.permission.createMany({
    data: permissionsData,
    skipDuplicates: true,
  });
  const allPermissions = await prisma.permission.findMany();
  const permMap = allPermissions.reduce(
    (acc, p) => ({ ...acc, [`${p.action}_${p.resource}`]: p.id }),
    {} as Record<string, string>
  );

  const adminRole = await prisma.role.create({
    data: {
      name: "Company Admin",
      description: "Full access to all company data and settings.",
      companyId: company1.id,
      permissions: {
        create: Object.values(permMap).map((permissionId) => ({
          permissionId,
        })),
      },
    },
  });

  const salesManagerRole = await prisma.role.create({
    data: {
      name: "Sales Manager",
      description:
        "Manages customers, sales-related goods, and can create documents. View is restricted to Revenue journals.",
      companyId: company1.id,
      permissions: {
        create: [
          { permissionId: permMap["CREATE_PARTNER"] },
          { permissionId: permMap["READ_PARTNER"] },
          { permissionId: permMap["UPDATE_PARTNER"] },
          { permissionId: permMap["CREATE_GOODS_AND_SERVICE"] },
          { permissionId: permMap["READ_GOODS_AND_SERVICE"] },
          { permissionId: permMap["UPDATE_GOODS_AND_SERVICE"] },
          { permissionId: permMap["READ_JOURNAL"] },
          { permissionId: permMap["LINK_PARTNER_JOURNAL"] },
          { permissionId: permMap["LINK_GOOD_JOURNAL"] },
          { permissionId: permMap["LINK_GOOD_PARTNER_JOURNAL"] },
          { permissionId: permMap["CREATE_DOCUMENT"] },
        ],
      },
    },
  });

  const procurementRole = await prisma.role.create({
    data: {
      name: "Procurement Specialist",
      description:
        "Manages suppliers and ingredients. View is restricted to Expense journals.",
      companyId: company1.id,
      permissions: {
        create: [
          { permissionId: permMap["CREATE_PARTNER"] },
          { permissionId: permMap["READ_PARTNER"] },
          { permissionId: permMap["UPDATE_PARTNER"] },
          { permissionId: permMap["APPROVE_PARTNER"] }, // Can approve new suppliers
          { permissionId: permMap["READ_GOODS_AND_SERVICE"] },
          { permissionId: permMap["READ_JOURNAL"] },
          { permissionId: permMap["LINK_PARTNER_JOURNAL"] },
        ],
      },
    },
  });
  console.log("Created Roles: Admin, Sales Manager, Procurement Specialist");

  // --- 3. Create Journals (MOVED UP) ---
  // This MUST be done before creating users that have journal restrictions.
  const journalsStructure: SeedJournalInput[] = [
    {
      id: "1",
      name: "Assets",
      isTerminal: false,
      children: [
        {
          id: "10",
          name: "Current Assets",
          isTerminal: false,
          children: [
            { id: "1001", name: "Cash and Equivalents", isTerminal: true },
            { id: "1002", name: "Accounts Receivable", isTerminal: true },
            { id: "1003", name: "Inventory", isTerminal: true },
          ],
        },
        {
          id: "11",
          name: "Non-Current Assets",
          isTerminal: false,
          children: [
            {
              id: "1101",
              name: "Property, Plant, & Equipment",
              isTerminal: true,
            },
          ],
        },
      ],
    },
    {
      id: "2",
      name: "Liabilities",
      isTerminal: false,
      children: [
        {
          id: "20",
          name: "Current Liabilities",
          isTerminal: false,
          children: [
            { id: "2001", name: "Accounts Payable", isTerminal: true },
          ],
        },
      ],
    },
    {
      id: "4",
      name: "Revenue",
      isTerminal: false,
      children: [
        {
          id: "40",
          name: "Sales Revenue - Goods",
          isTerminal: false,
          children: [
            { id: "4001", name: "Cake Sales", isTerminal: true },
            { id: "4002", name: "Cookie Sales", isTerminal: true },
            { id: "4003", name: "Pastry Sales", isTerminal: true },
          ],
        },
        {
          id: "41",
          name: "Sales Revenue - Services",
          isTerminal: false,
          children: [
            { id: "4101", name: "Catering Services", isTerminal: true },
            { id: "4102", name: "Custom Orders", isTerminal: true },
          ],
        },
      ],
    },
    {
      id: "5",
      name: "Expenses",
      isTerminal: false,
      children: [
        {
          id: "50",
          name: "Cost of Goods Sold (COGS)",
          isTerminal: false,
          children: [
            { id: "5001", name: "Flour & Grains", isTerminal: true },
            { id: "5002", name: "Sweeteners", isTerminal: true },
            { id: "5003", name: "Dairy & Eggs", isTerminal: true },
            { id: "5004", name: "Packaging Materials", isTerminal: true },
          ],
        },
        {
          id: "51",
          name: "Operating Expenses",
          isTerminal: false,
          children: [
            { id: "5101", name: "Rent Expense", isTerminal: true },
            { id: "5102", name: "Utilities Expense", isTerminal: true },
            { id: "5103", name: "Marketing & Advertising", isTerminal: true },
          ],
        },
      ],
    },
  ];
  await createJournalsForCompany(company1.id, journalsStructure);
  console.log("Expanded Journals seeded.");

  // --- 4. Create Users ---
  // Now that journals exist, these foreign key relations will be valid.
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@bakerydemo.com",
      name: "Admin User",
      passwordHash: await bcrypt.hash("admin123", 10),
      companyId: company1.id,
      userRoles: { create: { roleId: adminRole.id } }, // No journal restriction
    },
  });

  const salesUser = await prisma.user.create({
    data: {
      email: "sales.manager@bakerydemo.com",
      name: "Sales Manager Sam",
      passwordHash: await bcrypt.hash("sales123", 10),
      companyId: company1.id,
      userRoles: {
        create: {
          roleId: salesManagerRole.id,
          restrictedTopLevelJournalId: "4", // RESTRICTED to the 'Revenue' branch
          restrictedTopLevelJournalCompanyId: company1.id,
        },
      },
    },
  });

  const procurementUser = await prisma.user.create({
    data: {
      email: "procurement.specialist@bakerydemo.com",
      name: "Procurement Specialist Pat",
      passwordHash: await bcrypt.hash("procurement123", 10),
      companyId: company1.id,
      userRoles: {
        create: {
          roleId: procurementRole.id,
          restrictedTopLevelJournalId: "5", // RESTRICTED to the 'Expenses' branch
          restrictedTopLevelJournalCompanyId: company1.id,
        },
      },
    },
  });

  console.log(
    `Created Users: Admin (unrestricted), Sales Manager (restricted to journal '4'), Procurement Specialist (restricted to journal '5')`
  );
  const defaultCreatorId = salesUser.id; // Use Sales Manager as the default creator for most data.

  // --- 5. Create Tax Codes & Units of Measure ---
  const taxStd = await prisma.taxCode.create({
    data: {
      code: "STD20",
      description: "Standard 20%",
      rate: 0.2,
      companyId: company1.id,
    },
  });
  const taxExempt = await prisma.taxCode.create({
    data: {
      code: "EXEMPT",
      description: "Tax Exempt",
      rate: 0,
      companyId: company1.id,
    },
  });
  const uomEach = await prisma.unitOfMeasure.create({
    data: { code: "EA", name: "Each", companyId: company1.id },
  });
  const uomKg = await prisma.unitOfMeasure.create({
    data: { code: "KG", name: "Kilogram", companyId: company1.id },
  });
  const uomBox = await prisma.unitOfMeasure.create({
    data: { code: "BOX", name: "Box", companyId: company1.id },
  });

  // --- 6. Create Partners (Customers & Suppliers) ---
  console.log("\nCreating partners...");
  const pSupplierFlourMart = await prisma.partner.create({
    data: {
      name: "FlourMart Inc.",
      partnerType: PartnerType.LEGAL_ENTITY,
      companyId: company1.id,
      createdById: procurementUser.id,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
    },
  });
  const pSupplierSweetHarvest = await prisma.partner.create({
    data: {
      name: "Sweet Harvest Co.",
      partnerType: PartnerType.LEGAL_ENTITY,
      companyId: company1.id,
      createdById: procurementUser.id,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
    },
  });
  const pSupplierPackRight = await prisma.partner.create({
    data: {
      name: "PackRight Solutions",
      partnerType: PartnerType.LEGAL_ENTITY,
      companyId: company1.id,
      createdById: procurementUser.id,
      approvalStatus: ApprovalStatus.PENDING,
      entityState: EntityState.ACTIVE,
    },
  });

  const pCustomerCafeA = await prisma.partner.create({
    data: {
      name: "The Cozy Cafe",
      partnerType: PartnerType.LEGAL_ENTITY,
      companyId: company1.id,
      createdById: defaultCreatorId,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
    },
  });
  const pCustomerMegaCorp = await prisma.partner.create({
    data: {
      name: "MegaCorp Events",
      partnerType: PartnerType.LEGAL_ENTITY,
      companyId: company1.id,
      createdById: defaultCreatorId,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
    },
  });
  const pCustomerUnaffected = await prisma.partner.create({
    data: {
      name: "Unaffected Individual Buyer",
      partnerType: PartnerType.NATURAL_PERSON,
      notes: "Approved, but unlinked.",
      companyId: company1.id,
      createdById: adminUser.id,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
    },
  });
  const pCustomerInProcess = await prisma.partner.create({
    data: {
      name: "New Hotel Prospect (In Process)",
      partnerType: PartnerType.LEGAL_ENTITY,
      notes: "A new client created by the sales manager, pending approval.",
      companyId: company1.id,
      createdById: defaultCreatorId,
      approvalStatus: ApprovalStatus.PENDING,
      entityState: EntityState.ACTIVE,
    },
  });

  // --- 7. Create Goods & Services ---
  console.log("\nCreating goods & services...");
  const gGoodFlour = await prisma.goodsAndService.create({
    data: {
      label: "Artisan Bread Flour",
      referenceCode: "ING-FLR-01",
      companyId: company1.id,
      createdById: procurementUser.id,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
      taxCodeId: taxExempt.id,
      unitCodeId: uomKg.id,
    },
  });
  const gGoodSugar = await prisma.goodsAndService.create({
    data: {
      label: "Organic Cane Sugar",
      referenceCode: "ING-SGR-01",
      companyId: company1.id,
      createdById: procurementUser.id,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
      taxCodeId: taxExempt.id,
      unitCodeId: uomKg.id,
    },
  });
  const gGoodBoxes = await prisma.goodsAndService.create({
    data: {
      label: "Cake Boxes (100 pack)",
      referenceCode: "PKG-BOX-LG",
      companyId: company1.id,
      createdById: procurementUser.id,
      approvalStatus: ApprovalStatus.PENDING,
      entityState: EntityState.ACTIVE,
      taxCodeId: taxExempt.id,
      unitCodeId: uomBox.id,
    },
  });

  const gGoodChocolateCake = await prisma.goodsAndService.create({
    data: {
      label: "Classic Chocolate Cake",
      referenceCode: "CAKE-CHOC-01",
      companyId: company1.id,
      createdById: defaultCreatorId,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
      taxCodeId: taxStd.id,
      unitCodeId: uomEach.id,
    },
  });
  const gGoodCroissant = await prisma.goodsAndService.create({
    data: {
      label: "Butter Croissant",
      referenceCode: "PST-CRS-01",
      companyId: company1.id,
      createdById: defaultCreatorId,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
      taxCodeId: taxStd.id,
      unitCodeId: uomEach.id,
    },
  });
  const gGoodCatering = await prisma.goodsAndService.create({
    data: {
      label: "Gold Catering Package",
      referenceCode: "SVC-CAT-GLD",
      companyId: company1.id,
      createdById: defaultCreatorId,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
      taxCodeId: taxStd.id,
      unitCodeId: uomEach.id,
    },
  });

  // --- 8. Create Links (Partner-Journal & Good-Journal) with Hierarchy ---
  console.log("\nLinking entities with hierarchy...");
  await linkPartnerToJournalWithHierarchy(
    company1.id,
    pSupplierFlourMart.id,
    "5001",
    "SUPPLIER"
  );
  await linkPartnerToJournalWithHierarchy(
    company1.id,
    pSupplierSweetHarvest.id,
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
    "4003",
    "CUSTOMER"
  );
  await linkPartnerToJournalWithHierarchy(
    company1.id,
    pCustomerMegaCorp.id,
    "4101",
    "CUSTOMER"
  );

  await linkGoodToJournalWithHierarchy(company1.id, gGoodFlour.id, "5001");
  await linkGoodToJournalWithHierarchy(company1.id, gGoodSugar.id, "5002");
  await linkGoodToJournalWithHierarchy(
    company1.id,
    gGoodChocolateCake.id,
    "4001"
  );
  await linkGoodToJournalWithHierarchy(company1.id, gGoodCroissant.id, "4003");
  await linkGoodToJournalWithHierarchy(company1.id, gGoodCatering.id, "4101");
  console.log("Hierarchical Partner-Journal and Good-Journal links created.");

  // --- 9. Create Tri-partite Links (Journal-Partner-Good) ---
  console.log("\nCreating tri-partite Journal-Partner-Good links...");
  const jplCafeCakes = await prisma.journalPartnerLink.findFirstOrThrow({
    where: { partnerId: pCustomerCafeA.id, journalId: "4001" },
  });
  await prisma.journalPartnerGoodLink.create({
    data: {
      companyId: company1.id,
      journalPartnerLinkId: jplCafeCakes.id,
      goodId: gGoodChocolateCake.id,
      descriptiveText: "Weekly standing order for chocolate cakes.",
    },
  });

  const jplCafePastries = await prisma.journalPartnerLink.findFirstOrThrow({
    where: { partnerId: pCustomerCafeA.id, journalId: "4003" },
  });
  await prisma.journalPartnerGoodLink.create({
    data: {
      companyId: company1.id,
      journalPartnerLinkId: jplCafePastries.id,
      goodId: gGoodCroissant.id,
      descriptiveText: "Daily delivery of 50 croissants.",
    },
  });

  const jplMegaCorpCatering = await prisma.journalPartnerLink.findFirstOrThrow({
    where: { partnerId: pCustomerMegaCorp.id, journalId: "4101" },
  });
  await prisma.journalPartnerGoodLink.create({
    data: {
      companyId: company1.id,
      journalPartnerLinkId: jplMegaCorpCatering.id,
      goodId: gGoodCatering.id,
      descriptiveText: "Contract for annual gala event.",
    },
  });
  console.log("Tri-partite links created successfully.");

  console.log("\n--- Seeding finished successfully! ---");
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
