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

  // --- 2. Create Permissions & Roles ---
  const permissionsData = [
    // User & Role Management
    {
      action: "MANAGE",
      resource: "USERS",
      description: "Create, edit, and assign roles to users.",
    },
    {
      action: "MANAGE",
      resource: "ROLES",
      description: "Create, edit, and define roles and their permissions.",
    },

    // Partner Management
    {
      action: "CREATE",
      resource: "PARTNER",
      description: "Create new partners.",
    },
    {
      action: "READ",
      resource: "PARTNER",
      description: "View partner details.",
    },
    {
      action: "UPDATE",
      resource: "PARTNER",
      description: "Edit existing partners.",
    },
    {
      action: "DELETE",
      resource: "PARTNER",
      description: "Soft-delete partners.",
    },
    {
      action: "APPROVE",
      resource: "PARTNER",
      description: "Approve or reject pending partners.",
    },
    {
      action: "READ_HISTORY",
      resource: "PARTNER",
      description: "View the version history of a partner.",
    },

    // Goods & Services Management
    {
      action: "CREATE",
      resource: "GOODS_AND_SERVICE",
      description: "Create new goods/services.",
    },
    {
      action: "READ",
      resource: "GOODS_AND_SERVICE",
      description: "View goods/services.",
    },
    {
      action: "UPDATE",
      resource: "GOODS_AND_SERVICE",
      description: "Edit existing goods/services.",
    },
    {
      action: "DELETE",
      resource: "GOODS_AND_SERVICE",
      description: "Soft-delete goods/services.",
    },
    {
      action: "APPROVE",
      resource: "GOODS_AND_SERVICE",
      description: "Approve or reject pending goods/services.",
    },
    {
      action: "READ_HISTORY",
      resource: "GOODS_AND_SERVICE",
      description: "View the version history of a good/service.",
    },

    // Journal (Chart of Accounts) Management
    {
      action: "READ",
      resource: "JOURNAL",
      description: "View the chart of accounts.",
    },
    {
      action: "MANAGE",
      resource: "JOURNAL",
      description: "Create and edit the chart of accounts.",
    },

    // Entity Linking Management
    {
      action: "LINK",
      resource: "PARTNER_JOURNAL",
      description: "Can link partners to journals.",
    },
    {
      action: "LINK",
      resource: "GOOD_JOURNAL",
      description: "Can link goods to journals.",
    },
    {
      action: "LINK",
      resource: "GOOD_PARTNER_JOURNAL",
      description: "Can create the tri-partite link.",
    },

    // Document / Transaction Management
    {
      action: "CREATE",
      resource: "DOCUMENT",
      description: "Can create transactional documents.",
    },
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

  const adminRoleC1 = await prisma.role.create({
    data: {
      name: "Company Admin",
      companyId: company1.id,
      permissions: {
        create: Object.values(permMap).map((permissionId) => ({
          permissionId,
        })),
      },
    },
  });

  // --- 3. Create Users ---
  const adminUserC1 = await prisma.user.create({
    data: {
      email: "admin@bakerydemo.com",
      name: "Admin User",
      passwordHash: await bcrypt.hash("admin123", 10),
      companyId: company1.id,
      userRoles: { create: { roleId: adminRoleC1.id } },
    },
  });
  const accountantUserC1 = await prisma.user.create({
    data: {
      email: "accountant@bakerydemo.com",
      name: "Accountant User",
      passwordHash: await bcrypt.hash("accountant123", 10),
      companyId: company1.id,
      userRoles: { create: { roleId: adminRoleC1.id } },
    },
  });
  console.log(`Created Users. Accountant ID: ${accountantUserC1.id}`);

  const creatorId = accountantUserC1.id; // Use accountant as the default creator for seeded data.

  // --- 4. Create Journals ---
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
            { id: "1002", name: "Accounts Receivable", isTerminal: true },
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
          name: "Sales Revenue",
          isTerminal: false,
          children: [
            { id: "4001", name: "Cake Sales", isTerminal: true },
            { id: "4002", name: "Cookie Sales", isTerminal: true },
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
          name: "Ingredient Costs",
          isTerminal: false,
          children: [
            { id: "5001", name: "Flour Costs", isTerminal: true },
            { id: "5002", name: "Sugar Costs", isTerminal: true },
          ],
        },
      ],
    },
  ];
  await createJournalsForCompany(company1.id, journalsStructure);
  console.log("Journals seeded.");

  // --- 5. Create Standard, APPROVED Partners ---
  console.log("\nCreating standard, APPROVED partners...");
  const pSupplierFlourMart = await prisma.partner.create({
    data: {
      name: "FlourMart Inc.",
      partnerType: PartnerType.LEGAL_ENTITY,
      companyId: company1.id,
      createdById: creatorId,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
    },
  });
  const pCustomerCafeA = await prisma.partner.create({
    data: {
      name: "The Cozy Cafe",
      partnerType: PartnerType.LEGAL_ENTITY,
      companyId: company1.id,
      createdById: creatorId,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
    },
  });

  // --- 6. Create Special-Case Partners for Filter Testing ---
  console.log("\nCreating special-case partners for filter testing...");

  // For "Unaffected" filter: APPROVED but unlinked. Created by a different user.
  const pUnaffectedLogistics = await prisma.partner.create({
    data: {
      name: "Speedy Logistics (Unaffected)",
      partnerType: PartnerType.LEGAL_ENTITY,
      notes: "Approved, but unlinked.",
      companyId: company1.id,
      createdById: adminUserC1.id,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
    },
  });
  console.log(`Created Unaffected Partner: ${pUnaffectedLogistics.name}`);

  // For "In Process" filter: PENDING and unlinked. CRITICAL: Created by the 'accountant' user.
  const pInProcessNewClient = await prisma.partner.create({
    data: {
      name: "New Client Prospect (In Process)",
      partnerType: PartnerType.LEGAL_ENTITY,
      notes: "A new client created by the accountant, pending approval.",
      companyId: company1.id,
      createdById: creatorId,
      approvalStatus: ApprovalStatus.PENDING,
      entityState: EntityState.ACTIVE,
    },
  });
  console.log(`Created 'In Process' Partner: ${pInProcessNewClient.name}`);

  // --- 7. Create Tax Codes & Units of Measure ---
  const taxStd = await prisma.taxCode.create({
    data: { code: "STD20", rate: 0.2, companyId: company1.id },
  });
  const uomEach = await prisma.unitOfMeasure.create({
    data: { code: "EA", name: "Each", companyId: company1.id },
  });

  // --- 8. Create Goods & Services ---
  const goodChocolateCake = await prisma.goodsAndService.create({
    data: {
      label: "Classic Chocolate Cake",
      companyId: company1.id,
      createdById: creatorId,
      approvalStatus: ApprovalStatus.APPROVED,
      entityState: EntityState.ACTIVE,
      taxCodeId: taxStd.id,
      unitCodeId: uomEach.id,
    },
  });
  const gInProcessNewSupply = await prisma.goodsAndService.create({
    data: {
      label: "New Eco-Friendly Boxes (In Process)",
      companyId: company1.id,
      createdById: creatorId,
      approvalStatus: ApprovalStatus.PENDING,
      entityState: EntityState.ACTIVE,
      taxCodeId: taxStd.id,
      unitCodeId: uomEach.id,
    },
  });
  console.log("Goods and Services seeded.");

  // --- 9. Create Links (with Hierarchy) ---
  console.log("\nLinking entities with hierarchy...");
  await linkPartnerToJournalWithHierarchy(
    company1.id,
    pSupplierFlourMart.id,
    "5001",
    "SUPPLIER"
  );
  await linkPartnerToJournalWithHierarchy(
    company1.id,
    pCustomerCafeA.id,
    "4001",
    "CUSTOMER"
  );
  await linkGoodToJournalWithHierarchy(
    company1.id,
    goodChocolateCake.id,
    "4001"
  );
  console.log("Hierarchical links created.");

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
