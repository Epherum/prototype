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
  "parent" | "children"
> & {
  id: string; // The natural ID for the journal
  children?: SeedJournalInput[];
};

/**
 * Deletes all data from the database in an order that respects foreign key constraints.
 */
async function deleteAllData() {
  console.log("--- Deleting all existing data... ---");
  await prisma.$transaction([
    prisma.journalPartnerGoodLink.deleteMany({}),
    prisma.rolePermission.deleteMany({}),
    prisma.userRole.deleteMany({}),
    prisma.journalPartnerLink.deleteMany({}),
    prisma.journalGoodLink.deleteMany({}),
    prisma.goodsAndService.deleteMany({}),
    prisma.partner.deleteMany({}),
    prisma.taxCode.deleteMany({}),
    prisma.unitOfMeasure.deleteMany({}),
    prisma.user.deleteMany({}),
    prisma.role.deleteMany({}),
    prisma.permission.deleteMany({}),
  ]);
  console.log(
    "Deleted linking tables, auth models, and core business entities."
  );

  let journalsCount = await prisma.journal.count();
  let pass = 0;
  while (journalsCount > 0 && pass < 20) {
    pass++;
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
  console.log("Deleted all Journals.");
  console.log("--- Deletion complete. ---");
}

/**
 * Recursively creates journals.
 */
async function createJournals(
  journalsData: SeedJournalInput[],
  parentNaturalId?: string
) {
  for (const journalInput of journalsData) {
    const { children, ...data } = journalInput;
    await prisma.journal.create({
      data: {
        ...data,
        parent: parentNaturalId
          ? { connect: { id: parentNaturalId } }
          : undefined,
      },
    });
    if (children && children.length > 0) {
      await createJournals(children, data.id);
    }
  }
}

/**
 * Traverses up the journal tree to get all parent journals.
 */
async function getJournalHierarchy(
  journalNaturalId: string | null
): Promise<PrismaJournal[]> {
  if (!journalNaturalId) return [];
  const hierarchy: PrismaJournal[] = [];
  let currentNaturalId: string | null = journalNaturalId;
  while (currentNaturalId) {
    const journal = await prisma.journal.findUnique({
      where: { id: currentNaturalId },
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
  partnerId: bigint,
  terminalJournalNaturalId: string,
  partnershipType: string | null
) {
  const hierarchy = await getJournalHierarchy(terminalJournalNaturalId);
  for (const journal of hierarchy) {
    await prisma.journalPartnerLink.upsert({
      where: {
        journalId_partnerId_partnershipType: {
          journalId: journal.id,
          partnerId,
          partnershipType: partnershipType ?? "DEFAULT",
        },
      },
      update: {},
      create: { journalId: journal.id, partnerId, partnershipType },
    });
  }
}

/**
 * Links a good to a terminal journal and all of its parents.
 */
async function linkGoodToJournalWithHierarchy(
  goodId: bigint,
  terminalJournalNaturalId: string
) {
  const hierarchy = await getJournalHierarchy(terminalJournalNaturalId);
  for (const journal of hierarchy) {
    await prisma.journalGoodLink.upsert({
      where: {
        journalId_goodId: {
          journalId: journal.id,
          goodId,
        },
      },
      update: {},
      create: { journalId: journal.id, goodId },
    });
  }
}

async function main() {
  await deleteAllData();
  console.log(`--- Start seeding... ---`);

  // --- 1. Create ALL Permissions using upsert for safety ---
  console.log("Upserting permissions...");
  const permissionsToCreate = [
    {
      action: "MANAGE",
      resource: "USERS",
      description: "Can create, view, edit, and assign roles to users",
    },
    {
      action: "READ",
      resource: "ROLE",
      description: "Can view role list and permissions",
    },
    {
      action: "CREATE",
      resource: "ROLE",
      description: "Can create, edit, and delete roles",
    },
    {
      action: "CREATE",
      resource: "PARTNER",
      description: "Can create new partners",
    },
    {
      action: "READ",
      resource: "PARTNER",
      description: "Can read partner data",
    },
    {
      action: "UPDATE",
      resource: "PARTNER",
      description: "Can update partner data",
    },
    {
      action: "CREATE",
      resource: "GOODS",
      description: "Can create new goods/services",
    },
    {
      action: "READ",
      resource: "GOODS",
      description: "Can read goods/services data",
    },
    {
      action: "READ",
      resource: "JOURNAL",
      description: "Can read journal data",
    },
  ];
  for (const p of permissionsToCreate) {
    await prisma.permission.upsert({
      where: { action_resource: { action: p.action, resource: p.resource } },
      update: {},
      create: p,
    });
  }
  console.log("Permissions upserted successfully.");

  // --- 2. Create Roles and connect permissions ---
  const adminRole = await prisma.role.create({
    data: {
      name: "Admin",
      description: "Full access to all application data and settings.",
      permissions: {
        create: permissionsToCreate.map((p) => ({
          permission: {
            connect: {
              action_resource: { action: p.action, resource: p.resource },
            },
          },
        })),
      },
    },
  });

  const salesManagerRole = await prisma.role.create({
    data: {
      name: "Sales Manager",
      description: "Manages customers and sales-related goods.",
      permissions: {
        create: [
          {
            permission: {
              connect: {
                action_resource: { action: "CREATE", resource: "PARTNER" },
              },
            },
          },
          {
            permission: {
              connect: {
                action_resource: { action: "READ", resource: "PARTNER" },
              },
            },
          },
          {
            permission: {
              connect: {
                action_resource: { action: "UPDATE", resource: "PARTNER" },
              },
            },
          },
          {
            permission: {
              connect: {
                action_resource: { action: "READ", resource: "GOODS" },
              },
            },
          },
          {
            permission: {
              connect: {
                action_resource: { action: "READ", resource: "JOURNAL" },
              },
            },
          },
        ],
      },
    },
  });

  const procurementRole = await prisma.role.create({
    data: {
      name: "Procurement Specialist",
      description: "Manages suppliers and ingredients.",
      permissions: {
        create: [
          {
            permission: {
              connect: {
                action_resource: { action: "CREATE", resource: "PARTNER" },
              },
            },
          },
          {
            permission: {
              connect: {
                action_resource: { action: "READ", resource: "PARTNER" },
              },
            },
          },
          {
            permission: {
              connect: {
                action_resource: { action: "READ", resource: "GOODS" },
              },
            },
          },
          {
            permission: {
              connect: {
                action_resource: { action: "READ", resource: "JOURNAL" },
              },
            },
          },
        ],
      },
    },
  });
  console.log("Created Roles: Admin, Sales Manager, Procurement Specialist");

  // --- 3. Create Journals ---
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
  await createJournals(journalsStructure);
  console.log("Expanded Journals seeded.");

  // --- 4. Create Users ---
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@bakerydemo.com",
      name: "Admin User",
      passwordHash: await bcrypt.hash("admin123", 10),
      // This admin is unrestricted, so restrictedTopLevelJournalId is null (default)
      userRoles: { create: { roleId: adminRole.id } },
    },
  });
  const salesUser = await prisma.user.create({
    data: {
      email: "sales.manager@bakerydemo.com",
      name: "Sales Manager Sam",
      passwordHash: await bcrypt.hash("sales123", 10),
      // REFACTORED: Restriction is now at the User level
      restrictedTopLevelJournalId: "4",
      userRoles: {
        create: {
          roleId: salesManagerRole.id,
        },
      },
    },
  });
  const procurementUser = await prisma.user.create({
    data: {
      email: "procurement.specialist@bakerydemo.com",
      name: "Procurement Specialist Pat",
      passwordHash: await bcrypt.hash("procurement123", 10),
      // REFACTORED: Restriction is now at the User level
      restrictedTopLevelJournalId: "5",
      userRoles: {
        create: {
          roleId: procurementRole.id,
        },
      },
    },
  });
  console.log(
    `Created Users: Admin (unrestricted), Sales Manager (restricted to journal '4'), Procurement Specialist (restricted to journal '5')`
  );
  const defaultCreatorId = salesUser.id;

  // --- 5. Create Tax Codes & Units of Measure ---
  const taxStd = await prisma.taxCode.create({
    data: { code: "STD20", description: "Standard 20%", rate: 0.2 },
  });
  const taxExempt = await prisma.taxCode.create({
    data: { code: "EXEMPT", description: "Tax Exempt", rate: 0 },
  });
  const uomEach = await prisma.unitOfMeasure.create({
    data: { code: "EA", name: "Each" },
  });
  const uomKg = await prisma.unitOfMeasure.create({
    data: { code: "KG", name: "Kilogram" },
  });
  const uomBox = await prisma.unitOfMeasure.create({
    data: { code: "BOX", name: "Box" },
  });

  // --- 6. Create Partners (Customers & Suppliers) ---
  console.log("\nCreating partners...");
  const pSupplierFlourMart = await prisma.partner.create({
    data: {
      name: "FlourMart Inc.",
      partnerType: PartnerType.LEGAL_ENTITY,
      createdById: procurementUser.id,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
    },
  });
  const pSupplierSweetHarvest = await prisma.partner.create({
    data: {
      name: "Sweet Harvest Co.",
      partnerType: PartnerType.LEGAL_ENTITY,
      createdById: procurementUser.id,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
    },
  });
  const pSupplierPackRight = await prisma.partner.create({
    data: {
      name: "PackRight Solutions",
      partnerType: PartnerType.LEGAL_ENTITY,
      createdById: procurementUser.id,
      approvalStatus: ApprovalStatus.PENDING,
      entityState: EntityState.ACTIVE,
    },
  });
  const pCustomerCafeA = await prisma.partner.create({
    data: {
      name: "The Cozy Cafe",
      partnerType: PartnerType.LEGAL_ENTITY,
      createdById: defaultCreatorId,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
    },
  });
  const pCustomerMegaCorp = await prisma.partner.create({
    data: {
      name: "MegaCorp Events",
      partnerType: PartnerType.LEGAL_ENTITY,
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
    pSupplierFlourMart.id,
    "5001",
    "SUPPLIER"
  );
  await linkPartnerToJournalWithHierarchy(
    pSupplierSweetHarvest.id,
    "5002",
    "SUPPLIER"
  );
  await linkPartnerToJournalWithHierarchy(
    pCustomerCafeA.id,
    "4001",
    "CUSTOMER"
  );
  await linkPartnerToJournalWithHierarchy(
    pCustomerCafeA.id,
    "4003",
    "CUSTOMER"
  );
  await linkPartnerToJournalWithHierarchy(
    pCustomerMegaCorp.id,
    "4101",
    "CUSTOMER"
  );
  await linkGoodToJournalWithHierarchy(gGoodFlour.id, "5001");
  await linkGoodToJournalWithHierarchy(gGoodSugar.id, "5002");
  await linkGoodToJournalWithHierarchy(gGoodChocolateCake.id, "4001");
  await linkGoodToJournalWithHierarchy(gGoodCroissant.id, "4003");
  await linkGoodToJournalWithHierarchy(gGoodCatering.id, "4101");
  console.log("Hierarchical Partner-Journal and Good-Journal links created.");

  // --- 9. Create Tri-partite Links (Journal-Partner-Good) ---
  console.log("\nCreating tri-partite Journal-Partner-Good links...");
  const jplCafeCakes = await prisma.journalPartnerLink.findFirstOrThrow({
    where: { partnerId: pCustomerCafeA.id, journalId: "4001" },
  });
  await prisma.journalPartnerGoodLink.create({
    data: {
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
