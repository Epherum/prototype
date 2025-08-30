// prisma/seed.ts

import {
  PrismaClient,
  PartnerType,
  Journal as PrismaJournal,
  EntityState,
  DocumentType,
  PartnershipType,
  DocumentState,
  ApprovalStatus,
  Prisma,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSION_DEFINITIONS = {
  USER: ["MANAGE"],
  ROLE: ["MANAGE"],
  PARTNER: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
  GOODS: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
  JOURNAL: ["CREATE", "READ", "UPDATE", "DELETE"],
  DOCUMENT: ["MANAGE"],
} as const; // 'as const' is crucial for TypeScript to infer the exact string literals.

// Step 2: Automatically create strong types from your definitions.
// 'Resource' will now be a type: 'USER' | 'ROLE' | 'PARTNER' | ...
type Resource = keyof typeof PERMISSION_DEFINITIONS;

// This is a helper type that represents a valid permission assignment.
// This is the key to catching errors!
type PermissionAssignment = {
  action: string; // We keep action as a string for simplicity, but it could be typed more strongly too.
  resource: Resource; // This is the magic! It can ONLY be one of the keys from PERMISSION_DEFINITIONS.
};

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
    prisma.documentLine.deleteMany({}),
    prisma.document.deleteMany({}),
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
    prisma.status.deleteMany({}),
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
 * Creates default status options to replace the old ApprovalStatus enum.
 */
async function createDefaultStatuses() {
  console.log("--- Creating default statuses... ---");
  
  const pendingStatus = await prisma.status.create({
    data: {
      id: "pending-default",
      name: "Pending",
      description: "Awaiting review and approval",
      color: "#f59e0b",
      isDefault: true,
      displayOrder: 1,
    },
  });
  
  const approvedStatus = await prisma.status.create({
    data: {
      id: "approved-default", 
      name: "Approved",
      description: "Reviewed and approved for use",
      color: "#10b981",
      isDefault: false,
      displayOrder: 2,
    },
  });
  
  const rejectedStatus = await prisma.status.create({
    data: {
      id: "rejected-default",
      name: "Rejected", 
      description: "Reviewed and rejected",
      color: "#ef4444",
      isDefault: false,
      displayOrder: 3,
    },
  });
  
  console.log("Created default statuses:", {
    pending: pendingStatus.id,
    approved: approvedStatus.id, 
    rejected: rejectedStatus.id
  });
  
  return {
    pending: pendingStatus,
    approved: approvedStatus,
    rejected: rejectedStatus,
  };
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
        isTerminal: !children || children.length === 0,
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
  partnershipType: PartnershipType
) {
  const hierarchy = await getJournalHierarchy(terminalJournalNaturalId);
  for (const journal of hierarchy) {
    await prisma.journalPartnerLink.upsert({
      where: {
        journalId_partnerId_partnershipType: {
          journalId: journal.id,
          partnerId,
          partnershipType: partnershipType,
        },
      },
      update: {},
      create: { 
        journalId: journal.id, 
        partnerId, 
        partnershipType,
        creationLevel: 0,
        currentPendingLevel: 0,
        approvalStatus: 'APPROVED'
      },
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
      create: { 
        journalId: journal.id, 
        goodId,
        creationLevel: 0,
        currentPendingLevel: 0,
        approvalStatus: 'APPROVED'
      },
    });
  }
}

async function main() {
  await deleteAllData();
  console.log(`--- Start seeding... ---`);

  // --- 0. Create Default Statuses ---
  const statuses = await createDefaultStatuses();

  // --- 1. Create ALL Permissions Programmatically ---
  console.log("Defining and creating all possible permissions...");

  const allPermissions: PermissionAssignment[] = [];
  for (const resource in PERMISSION_DEFINITIONS) {
    for (const action of PERMISSION_DEFINITIONS[
      resource as keyof typeof PERMISSION_DEFINITIONS
    ]) {
      allPermissions.push({ action, resource: resource as Resource });
    }
  }

  for (const p of allPermissions) {
    const description = `Allows ${p.action.toLowerCase()} on ${p.resource.toLowerCase()}`;
    await prisma.permission.upsert({
      where: { action_resource: { action: p.action, resource: p.resource } },
      update: { description },
      create: {
        action: p.action,
        resource: p.resource,
        description,
      },
    });
  }
  console.log("All permissions created/updated successfully.");

  // --- 2. Create Roles and connect permissions ---
  const adminRole = await prisma.role.create({
    data: {
      name: "Admin",
      description:
        "Full access to all application data and settings. Has all permissions.",
      permissions: {
        create: allPermissions.map((p) => ({
          permission: {
            connect: {
              action_resource: { action: p.action, resource: p.resource },
            },
          },
        })),
      },
    },
  });

  const salesManagerPermissions: PermissionAssignment[] = [
    { action: "CREATE", resource: "PARTNER" },
    { action: "READ", resource: "PARTNER" },
    { action: "UPDATE", resource: "PARTNER" },
    { action: "CREATE", resource: "GOODS" },
    { action: "READ", resource: "GOODS" },
    { action: "UPDATE", resource: "GOODS" },
    { action: "READ", resource: "JOURNAL" },
    { action: "MANAGE", resource: "DOCUMENT" },
  ];

  const salesManagerRole = await prisma.role.create({
    data: {
      name: "Gestionnaire des Ventes",
      description: "Gère les clients, les produits de vente, et les documents.",
      permissions: {
        create: salesManagerPermissions.map((p) => ({
          permission: {
            connect: {
              action_resource: { action: p.action, resource: p.resource },
            },
          },
        })),
      },
    },
  });

  const procurementSpecialistPermissions: PermissionAssignment[] = [
    { action: "CREATE", resource: "PARTNER" },
    { action: "READ", resource: "PARTNER" },
    { action: "UPDATE", resource: "PARTNER" },
    { action: "CREATE", resource: "GOODS" },
    { action: "READ", resource: "GOODS" },
    { action: "UPDATE", resource: "GOODS" },
    { action: "READ", resource: "JOURNAL" },
  ];

  const procurementRole = await prisma.role.create({
    data: {
      name: "Spécialiste Achats",
      description: "Gère les fournisseurs et les matières premières.",
      permissions: {
        create: procurementSpecialistPermissions.map((p) => ({
          permission: {
            connect: {
              action_resource: { action: p.action, resource: p.resource },
            },
          },
        })),
      },
    },
  });
  console.log(
    "Created Roles: Admin, Gestionnaire des Ventes, Spécialiste Achats"
  );

  // --- 3. Create ERP Chart of Accounts with Numeric Journal Codes ---
  const journalsStructure: SeedJournalInput[] = [
    {
      id: "1",
      name: "ASSETS",
      children: [
        {
          id: "10",
          name: "Current Assets",
          children: [
            { id: "101", name: "Cash and Cash Equivalents" },
            { id: "102", name: "Accounts Receivable" },
            { id: "103", name: "Inventory - Raw Materials" },
            { id: "104", name: "Inventory - Finished Goods" },
            { id: "105", name: "Prepaid Expenses" },
          ],
        },
        {
          id: "15",
          name: "Fixed Assets",
          children: [
            { id: "151", name: "Equipment and Machinery" },
            { id: "152", name: "Buildings" },
            { id: "153", name: "Vehicles" },
            { id: "154", name: "Accumulated Depreciation" },
          ],
        },
      ],
    },
    {
      id: "2",
      name: "LIABILITIES",
      children: [
        {
          id: "20",
          name: "Current Liabilities",
          children: [
            { id: "201", name: "Accounts Payable" },
            { id: "202", name: "Accrued Expenses" },
            { id: "203", name: "Short-term Loans" },
            { id: "204", name: "Tax Payable" },
          ],
        },
        {
          id: "25",
          name: "Long-term Liabilities",
          children: [
            { id: "251", name: "Long-term Debt" },
            { id: "252", name: "Mortgage Payable" },
          ],
        },
      ],
    },
    {
      id: "3",
      name: "EQUITY",
      children: [
        { id: "301", name: "Owner's Capital" },
        { id: "302", name: "Retained Earnings" },
        { id: "303", name: "Current Year Earnings" },
      ],
    },
    {
      id: "4",
      name: "REVENUE",
      children: [
        {
          id: "40",
          name: "Sales Revenue",
          children: [
            { id: "401", name: "Bread Sales" },
            { id: "402", name: "Pastry Sales" },
            { id: "403", name: "Cake Sales" },
            { id: "404", name: "Catering Services" },
            { id: "405", name: "Wholesale Revenue" },
          ],
        },
        {
          id: "45",
          name: "Other Revenue",
          children: [
            { id: "451", name: "Interest Income" },
            { id: "452", name: "Other Income" },
          ],
        },
      ],
    },
    {
      id: "5",
      name: "COST OF GOODS SOLD",
      children: [
        { id: "501", name: "Raw Materials - Flour" },
        { id: "502", name: "Raw Materials - Dairy" },
        { id: "503", name: "Raw Materials - Sugar & Sweeteners" },
        { id: "504", name: "Raw Materials - Other Ingredients" },
        { id: "505", name: "Direct Labor" },
        { id: "506", name: "Manufacturing Overhead" },
      ],
    },
    {
      id: "6",
      name: "OPERATING EXPENSES",
      children: [
        {
          id: "60",
          name: "Administrative Expenses",
          children: [
            { id: "601", name: "Salaries and Wages" },
            { id: "602", name: "Rent Expense" },
            { id: "603", name: "Utilities" },
            { id: "604", name: "Insurance" },
            { id: "605", name: "Office Supplies" },
          ],
        },
        {
          id: "65",
          name: "Selling Expenses",
          children: [
            { id: "651", name: "Marketing and Advertising" },
            { id: "652", name: "Delivery Expenses" },
            { id: "653", name: "Sales Commissions" },
          ],
        },
      ],
    },
  ];
  await createJournals(journalsStructure);
  console.log("ERP Chart of Accounts with numeric journal codes created successfully.");

  // --- 4. Create Users ---
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@demo.com",
      name: "Admin User",
      passwordHash: await bcrypt.hash("admin123", 10),
      userRoles: { create: { roleId: adminRole.id } },
    },
  });
  const salesUser = await prisma.user.create({
    data: {
      email: "ventes@demo.com",
      name: "Samir Vente",
      passwordHash: await bcrypt.hash("ventes123", 10),
      restrictedTopLevelJournalId: "40", // Restricted to sales revenue operations
      userRoles: { create: { roleId: salesManagerRole.id } },
    },
  });
  const procurementUser = await prisma.user.create({
    data: {
      email: "achats@demo.com",
      name: "Patricia Achat",
      passwordHash: await bcrypt.hash("achats123", 10),
      restrictedTopLevelJournalId: "5", // Restricted to cost of goods sold/procurement
      userRoles: { create: { roleId: procurementRole.id } },
    },
  });
  console.log(
    `Created Users: Admin (unrestricted), Sales Manager (restricted to Sales Revenue), Procurement Specialist (restricted to COGS)`
  );

  // --- 5. Create Tax Codes & Units of Measure ---
  const taxTVA19 = await prisma.taxCode.create({
    data: { code: "TVA19", description: "TVA Standard 19%", rate: 0.19 },
  });
  const taxTVA7 = await prisma.taxCode.create({
    data: { code: "TVA7", description: "TVA Réduite 7%", rate: 0.07 },
  });
  const taxExempt = await prisma.taxCode.create({
    data: { code: "EXON", description: "Exonéré de TVA", rate: 0 },
  });
  const taxFodec = await prisma.taxCode.create({
    data: { code: "FODEC", description: "FODEC 1%", rate: 0.01 },
  });

  const uomUnit = await prisma.unitOfMeasure.create({
    data: { code: "U", name: "Unité" },
  });
  const uomKg = await prisma.unitOfMeasure.create({
    data: { code: "KG", name: "Kilogramme" },
  });
  const uomLitre = await prisma.unitOfMeasure.create({
    data: { code: "L", name: "Litre" },
  });
  const uomBox = await prisma.unitOfMeasure.create({
    data: { code: "Boite", name: "Boîte" },
  });

  // --- 6. Create Partners for Bakery Operations ---
  console.log("\nCreating bakery partners...");
  
  // Suppliers for raw materials (linked to PURCHASES journal)
  const supplierFlour = await prisma.partner.create({
    data: {
      name: "Premium Flour Mills",
      partnerType: PartnerType.LEGAL_ENTITY,
      createdById: procurementUser.id,
      statusId: statuses.approved.id,
      entityState: EntityState.ACTIVE,
      notes: "High-quality flour supplier with organic options",
      approvalStatus: ApprovalStatus.APPROVED,
      creationJournalLevel: 0,
      currentPendingLevel: 0,
      approvedByUserIds: [procurementUser.id],
      approvalTimestamps: [new Date()],
    },
  });

  // Customers for retail sales (linked to BAKERY-SALES-RETAIL journal)
  console.log("Creating retail customers for BAKERY-SALES-RETAIL...");
  const retailCustomers = [
    {
      key: "cafe_central",
      name: "Café Central",
      notes: "Daily fresh bread orders, premium customer",
    },
    {
      key: "hotel_royal",
      name: "Hotel Royal",
      notes: "Large breakfast orders, weekly deliveries",
    },
    {
      key: "corner_market",
      name: "Corner Market",
      notes: "Neighborhood store, varied product mix",
    },
    {
      key: "school_canteen",
      name: "City School Canteen",
      notes: "Bulk orders for school meals",
    },
    {
      key: "restaurant_bella",
      name: "Restaurant Bella Vista",
      notes: "Artisan bread for upscale dining",
    },
  ];

  const customers: { [key: string]: any } = {};
  for (const customerData of retailCustomers) {
    customers[customerData.key] = await prisma.partner.create({
      data: {
        name: customerData.name,
        partnerType: PartnerType.LEGAL_ENTITY,
        createdById: salesUser.id,
        statusId: statuses.approved.id,
        entityState: EntityState.ACTIVE,
        notes: customerData.notes,
        approvalStatus: ApprovalStatus.APPROVED,
        creationJournalLevel: 0,
        currentPendingLevel: 0,
        approvedByUserIds: [salesUser.id],
        approvalTimestamps: [new Date()],
      },
    });
  }

  // --- 7. Create Goods & Services for Bakery ---
  console.log("\nCreating bakery goods & services...");
  
  // Raw Materials (for PURCHASES journal)
  const rawFlour = await prisma.goodsAndService.create({
    data: {
      label: "Premium Wheat Flour",
      referenceCode: "RM-FLOUR-001",
      createdById: procurementUser.id,
      statusId: statuses.approved.id,
      entityState: EntityState.ACTIVE,
      taxCodeId: taxTVA7.id,
      unitCodeId: uomKg.id,
      approvalStatus: ApprovalStatus.APPROVED,
      creationJournalLevel: 0,
      currentPendingLevel: 0,
      approvedByUserIds: [procurementUser.id],
      approvalTimestamps: [new Date()],
    },
  });

  // Finished Products for retail sales (BAKERY-SALES-RETAIL journal)
  const retailProducts = [
    {
      label: "Artisan Croissant",
      referenceCode: "RETAIL-CROISSANT",
      taxId: taxTVA7.id,
      unitId: uomUnit.id,
    },
    {
      label: "Fresh Baguette",
      referenceCode: "RETAIL-BAGUETTE",
      taxId: taxTVA7.id,
      unitId: uomUnit.id,
    },
    {
      label: "Chocolate Éclair",
      referenceCode: "RETAIL-ECLAIR",
      taxId: taxTVA19.id,
      unitId: uomUnit.id,
    },
    {
      label: "Custom Birthday Cake",
      referenceCode: "RETAIL-CAKE",
      taxId: taxTVA19.id,
      unitId: uomUnit.id,
    },
    {
      label: "Pain au Chocolat",
      referenceCode: "RETAIL-PAIN-CHOC",
      taxId: taxTVA7.id,
      unitId: uomUnit.id,
    },
  ];

  const goods: { [key: string]: any } = {};
  for (const productData of retailProducts) {
    goods[productData.referenceCode] = await prisma.goodsAndService.create({
      data: {
        label: productData.label,
        referenceCode: productData.referenceCode,
        createdById: salesUser.id,
        statusId: statuses.approved.id,
        entityState: EntityState.ACTIVE,
        taxCodeId: productData.taxId,
        unitCodeId: productData.unitId,
        approvalStatus: ApprovalStatus.APPROVED,
        creationJournalLevel: 0,
        currentPendingLevel: 0,
        approvedByUserIds: [salesUser.id],
        approvalTimestamps: [new Date()],
      },
    });
  }

  // --- 8. Create Links with Hierarchy ---
  console.log("\nLinking entities with hierarchy...");
  
  // Link suppliers to Raw Materials - Flour journal (501)
  await linkPartnerToJournalWithHierarchy(
    supplierFlour.id,
    "501",
    PartnershipType.STANDARD_TRANSACTION
  );
  await linkGoodToJournalWithHierarchy(rawFlour.id, "501");

  // Link customers and products to Bread Sales journal (401)
  console.log("Creating hierarchical links for Bread Sales (401)...");
  for (const key in customers) {
    await linkPartnerToJournalWithHierarchy(
      customers[key].id,
      "401",
      PartnershipType.STANDARD_TRANSACTION
    );
  }
  for (const key in goods) {
    await linkGoodToJournalWithHierarchy(goods[key].id, "401");
  }

  // --- 9. Create Tri-partite Links (Journal-Partner-Good) ---
  console.log("\nCreating tri-partite Journal-Partner-Good links...");
  
  const customerProductLinks = [
    {
      customer: customers.cafe_central,
      products: [goods["RETAIL-CROISSANT"], goods["RETAIL-BAGUETTE"]],
    },
    {
      customer: customers.hotel_royal,
      products: [goods["RETAIL-CROISSANT"], goods["RETAIL-BAGUETTE"], goods["RETAIL-PAIN-CHOC"]],
    },
    {
      customer: customers.corner_market,
      products: Object.values(goods), // Sells all products
    },
    {
      customer: customers.school_canteen,
      products: [goods["RETAIL-BAGUETTE"], goods["RETAIL-PAIN-CHOC"]],
    },
    {
      customer: customers.restaurant_bella,
      products: [goods["RETAIL-BAGUETTE"], goods["RETAIL-CAKE"]],
    },
  ];

  for (const link of customerProductLinks) {
    const jpl = await prisma.journalPartnerLink.findFirstOrThrow({
      where: { partnerId: link.customer.id, journalId: "401" },
    });
    for (const product of link.products) {
      await prisma.journalPartnerGoodLink.create({
        data: {
          journalPartnerLinkId: jpl.id,
          goodId: product.id,
          descriptiveText: `Regular purchase of ${product.label} by ${link.customer.name}`,
          creationLevel: 0,
          currentPendingLevel: 0,
          approvalStatus: 'APPROVED',
        },
      });
    }
  }

  // --- 10. Create Sample Documents ---
  console.log("\nCreating sample documents...");

  // Invoice for Hotel Royal
  const hotelJpgl = await prisma.journalPartnerGoodLink.findFirstOrThrow({
    where: {
      journalPartnerLink: {
        partnerId: customers.hotel_royal.id,
        journalId: "401",
      },
      goodId: goods["RETAIL-CROISSANT"].id,
    },
  });
  
  await prisma.document.create({
    data: {
      refDoc: "INV-2024-001",
      type: DocumentType.INVOICE,
      date: new Date(),
      state: DocumentState.FINALIZED,
      description: "Weekly breakfast pastry delivery",
      partnerId: customers.hotel_royal.id,
      createdById: salesUser.id,
      journalId: "401",
      totalHT: new Prisma.Decimal(150.0),
      totalTax: new Prisma.Decimal(10.5),
      totalTTC: new Prisma.Decimal(160.5),
      balance: new Prisma.Decimal(160.5),
      statusId: statuses.approved.id,
      approvalStatus: ApprovalStatus.APPROVED,
      creationJournalLevel: 0,
      currentPendingLevel: 0,
      approvedByUserIds: [salesUser.id],
      approvalTimestamps: [new Date()],
      lines: {
        create: [
          {
            journalPartnerGoodLinkId: hotelJpgl.id,
            goodId: goods["RETAIL-CROISSANT"].id,
            designation: "Artisan Croissant",
            quantity: 100,
            unitPrice: 1.5,
            taxRate: 0.07,
            netTotal: 150.0,
            taxAmount: 10.5,
            discountAmount: 0,
          },
        ],
      },
    },
  });

  // Quote for Corner Market
  const marketJpgl = await prisma.journalPartnerGoodLink.findFirstOrThrow({
    where: {
      journalPartnerLink: {
        partnerId: customers.corner_market.id,
        journalId: "401",
      },
      goodId: goods["RETAIL-CAKE"].id,
    },
  });
  
  await prisma.document.create({
    data: {
      refDoc: "QUO-2024-001",
      type: DocumentType.QUOTE,
      date: new Date(),
      state: DocumentState.DRAFT,
      description: "Monthly product supply quote",
      partnerId: customers.corner_market.id,
      createdById: salesUser.id,
      journalId: "401",
      totalHT: new Prisma.Decimal(500.0),
      totalTax: new Prisma.Decimal(85.0),
      totalTTC: new Prisma.Decimal(585.0),
      balance: new Prisma.Decimal(585.0),
      statusId: statuses.pending.id,
      approvalStatus: ApprovalStatus.PENDING,
      creationJournalLevel: 0,
      currentPendingLevel: 0,
      approvedByUserIds: [],
      approvalTimestamps: [],
      lines: {
        create: [
          {
            journalPartnerGoodLinkId: marketJpgl.id,
            goodId: goods["RETAIL-CAKE"].id,
            designation: "Custom Birthday Cake",
            quantity: 20,
            unitPrice: 25.0,
            taxRate: 0.19,
            netTotal: 500.0,
            taxAmount: 95.0,
            discountAmount: 10.0,
          },
        ],
      },
    },
  });

  console.log("Sample documents with lines created successfully.");
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
