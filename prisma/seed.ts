// prisma/seed.ts

import {
  PrismaClient,
  EntityState,
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

  // --- 3. Create Complete French Accounting Chart from docs/journals.md ---
  const journalsStructure: SeedJournalInput[] = [
    {
      id: "1",
      name: "Comptes de Capitaux propres et passifs non courants",
    },
    {
      id: "2", 
      name: "Comptes d'actifs non courants",
    },
    {
      id: "3",
      name: "Comptes de Stocks",
      children: [
        {
          id: "31",
          name: "Matière Première et fournitures liées",
          children: [
            { id: "311", name: "Matière Première" },
            { id: "313", name: "Fournitures liées à la Matière Première" },
          ],
        },
        {
          id: "32",
          name: "autres approvisionnements",
          children: [
            { id: "321", name: "matières consommables" },
            { id: "322", name: "fournitures consommables" },
            { id: "326", name: "Emballages" },
          ],
        },
        {
          id: "33",
          name: "En-cours de production de biens",
          children: [
            {
              id: "331",
              name: "Produits en cours",
              children: [
                { id: "3311", name: "Les Ateliers d'Acheminement Main d'Oeuvre et Matière à Transformées" },
                { id: "3312", name: "Les Tâches Main d'Ouevre Directes liées à la fabrication de bien" },
                { id: "3313", name: "Quote parts de charges et Main d'oeuvre Indirectes liées à la fabrication de bien" },
              ],
            },
            { id: "335", name: "Travaux en cours" },
          ],
        },
        { id: "34", name: "En-cours de production de services" },
        {
          id: "35",
          name: "stocks de produits",
          children: [
            { id: "351", name: "stocks de produits intermédiaires" },
            { id: "355", name: "Produits finis" },
            { id: "357", name: "Produits résiduels" },
            { id: "358", name: "Produits résiduels" },
          ],
        },
        { id: "37", name: "stocks de marchandises" },
        { id: "39", name: "provisions pour dépréciation des stocks" },
      ],
    },
    {
      id: "4",
      name: "Comptes de Tiers",
      children: [
        {
          id: "40",
          name: "fournisseurs et comptes rattachés",
          children: [
            { id: "401", name: "fournisseurs d'exploitation" },
          ],
        },
        {
          id: "41",
          name: "clients et comptes rattachés",
          children: [
            { id: "411", name: "clients" },
          ],
        },
        {
          id: "42",
          name: "personnel et compte rattachés",
          children: [
            {
              id: "425",
              name: "personnel - rémunérations dues",
              children: [
                { id: "4251", name: "Main d'Oeuvre Directe" },
              ],
            },
          ],
        },
        {
          id: "43",
          name: "etat et collectivités publiques",
          children: [
            {
              id: "432",
              name: "etat, impôts et taxes retenues à la source",
              children: [
                { id: "4321", name: "RS" },
                { id: "4322", name: "RS / Salaire" },
              ],
            },
            {
              id: "434",
              name: "etat, impôts sur les bénéfices",
              children: [
                { id: "4341", name: "retenue à la source" },
              ],
            },
            {
              id: "436",
              name: "etat, taxes sur le chiffre d'affaires",
              children: [
                {
                  id: "4366",
                  name: "taxes sur le CA déductibles",
                  children: [
                    { id: "43666", name: "tva sur autres biens & services" },
                    { id: "43667", name: "crédit de tva à reporter" },
                  ],
                },
                {
                  id: "4367",
                  name: "taxes sur le CA collectés par l'entreprise",
                  children: [
                    { id: "43671", name: "tva collectée" },
                    {
                      id: "43678",
                      name: "autres taxes sur le chiffre d'affaires",
                      children: [
                        { id: "436781", name: "FODEC" },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: "437",
              name: "autres impôts, taxes & versements assimilés",
              children: [
                {
                  id: "4371",
                  name: "impôts, taxes et versements assimilés sur rémunérations",
                  children: [
                    { id: "43711", name: "TFP" },
                    { id: "43712", name: "FORPROLOS" },
                  ],
                },
                {
                  id: "4375",
                  name: "autres impôts, taxes et versements assimilés",
                  children: [
                    { id: "43752", name: "TCL" },
                    { id: "43754", name: "Timbre Fiscal" },
                  ],
                },
              ],
            },
            {
              id: "438",
              name: "etat, charges à payer & produits à recevoir",
              children: [
                { id: "4386", name: "autres charges à payer" },
              ],
            },
          ],
        },
        {
          id: "44",
          name: "sociétés du groupe et associés",
          children: [
            { id: "442", name: "associés - comptes courants" },
          ],
        },
        {
          id: "45",
          name: "débiteurs divers et créditeurs divers",
          children: [
            {
              id: "453",
              name: "sécurité sociale & autres organismes sociaux",
              children: [
                {
                  id: "4531",
                  name: "organismes sociaux",
                  children: [
                    { id: "45311", name: "cnss" },
                  ],
                },
              ],
            },
            { id: "457", name: "autres comptes débiteurs ou créditeurs" },
            {
              id: "458",
              name: "divers charges à payer & produits à recevoir",
              children: [
                { id: "4586", name: "charges à payer" },
                { id: "4587", name: "produits à recevoir" },
              ],
            },
          ],
        },
        { id: "46", name: "comptes transitoires ou d'attente" },
        {
          id: "47",
          name: "comptes de régularisation",
          children: [
            { id: "471", name: "charges constatées d'avance" },
            { id: "472", name: "produits constatés d'avance" },
            {
              id: "478",
              name: "comptes de répartition périodique de charges & produits",
              children: [
                { id: "4786", name: "charges" },
                { id: "4787", name: "produits" },
              ],
            },
          ],
        },
        { id: "48", name: "provisions courantes pour risques et charges" },
        { id: "49", name: "provisions pour dépréciation des comptes tiers" },
      ],
    },
    {
      id: "5",
      name: "Comptes Financiers",
      children: [
        {
          id: "53",
          name: "banques, établissements financiers et assimilés",
          children: [
            { id: "532", name: "banques" },
            { id: "534", name: "postes" },
          ],
        },
        { id: "54", name: "caisse" },
      ],
    },
    {
      id: "6",
      name: "Comptes de Charges",
      children: [
        {
          id: "60",
          name: "achats",
          children: [
            {
              id: "601",
              name: "achats Matière Première et fournitures liées",
              children: [
                { id: "6011", name: "achat matières première" },
                { id: "6012", name: "achat fournitures liées à la matière première" },
              ],
            },
            {
              id: "602",
              name: "achats autres approvisionnements",
              children: [
                { id: "6021", name: "matières consommables" },
                { id: "6022", name: "fournitures consommables" },
              ],
            },
            {
              id: "603",
              name: "variation des stocks achats (Achat Consommé approvisionnement et marchandise)",
              children: [
                {
                  id: "6031",
                  name: "variation des stocks de MP et fournitures",
                  children: [
                    {
                      id: "60311",
                      name: "Variation de Stock de matières Premières",
                      children: [
                        { id: "603111", name: "Entrées Matières" },
                        { id: "603112", name: "Sorties Matières" },
                      ],
                    },
                    {
                      id: "60312",
                      name: "Variation du Stock de fourniture liées à la matière première",
                      children: [
                        { id: "603121", name: "Entrées Matières" },
                        { id: "603122", name: "Sorties Matières" },
                      ],
                    },
                  ],
                },
                {
                  id: "6032",
                  name: "variation des stocks des autres approvisionnements",
                  children: [
                    {
                      id: "60321",
                      name: "matières consommables",
                      children: [
                        { id: "603211", name: "Entrées Matières" },
                        { id: "603212", name: "Sorties Matières" },
                      ],
                    },
                    {
                      id: "60322",
                      name: "fourniture consommables",
                      children: [
                        { id: "603221", name: "Entrées Matières" },
                        { id: "603222", name: "Sorties Matières" },
                      ],
                    },
                  ],
                },
                {
                  id: "6037",
                  name: "variation des stocks de marchandises",
                  children: [
                    { id: "60371", name: "marchandises achats" },
                    { id: "60372", name: "marchandises ventes" },
                  ],
                },
              ],
            },
            { id: "604", name: "achats d'études et de prestations de services" },
            { id: "605", name: "achats de matériel, équipements et travaux" },
            { id: "606", name: "achats non stockés de matières et fournitures" },
            { id: "607", name: "achats de marchandises" },
            { id: "608", name: "achats liés à un modification comptable" },
            { id: "609", name: "rrr obtenus sur achats" },
          ],
        },
        { id: "61", name: "charges sur services extérieurs" },
        { id: "62", name: "charge sur autres services extérieurs" },
        { id: "63", name: "charges diverses ordinaires" },
        {
          id: "64",
          name: "charges de personnel",
          children: [
            {
              id: "640",
              name: "salaires et compléments de salaires",
              children: [
                { id: "6401", name: "salaires et compléments de salaires Main d'Oeuvre Directe" },
                { id: "6402", name: "salaires et compléments de salaires Main d'Oeuvre Indirecte" },
              ],
            },
            { id: "647", name: "charges sociales légales" },
          ],
        },
        { id: "65", name: "charges financières" },
        {
          id: "66",
          name: "impôts, taxes et versements assimilés",
          children: [
            {
              id: "661",
              name: "impôts, taxes et versements assimilés sur rémunérations",
              children: [
                { id: "6611", name: "TFP" },
                { id: "6612", name: "FOPROLOS" },
              ],
            },
            {
              id: "665",
              name: "autres impôts, taxes et versements assimilés",
              children: [
                { id: "6651", name: "impôts & taxes divers" },
                {
                  id: "6652",
                  name: "taxes sur le CA non récupérables",
                  children: [
                    { id: "66521", name: "TCL" },
                  ],
                },
                {
                  id: "6654",
                  name: "droits d'enregistrement et de timbre",
                  children: [
                    { id: "66542", name: "droits de timbre" },
                  ],
                },
                { id: "6655", name: "taxes sur les véhicules" },
                { id: "6658", name: "autres droits" },
              ],
            },
          ],
        },
        { id: "67", name: "pertes extraordinaires" },
        { id: "68", name: "dotations aux amortissements et aux provisions" },
        { id: "69", name: "impôts sur les bénéfices" },
      ],
    },
    {
      id: "7",
      name: "Comptes de Produits",
      children: [
        {
          id: "70",
          name: "ventes",
          children: [
            {
              id: "701",
              name: "ventes de produits finis",
              children: [
                { id: "7011", name: "ventes de produits finis achevés" },
                { id: "7012", name: "ventes de produits finis non achevés" },
              ],
            },
            { id: "702", name: "ventes de produits intermédiaires" },
            { id: "703", name: "ventes de produits résiduels" },
            { id: "704", name: "travaux" },
            { id: "705", name: "études et prestations de services" },
            { id: "706", name: "produits des activités annexes" },
            { id: "707", name: "ventes de marchandises" },
            { id: "708", name: "ventes liées à une modification comptable" },
            { id: "709", name: "rrr accordés par l'entreprise" },
          ],
        },
        {
          id: "71",
          name: "production stockée ou déstockée",
          children: [
            {
              id: "713",
              name: "variation des stocks d'encours de production et de produits",
              children: [
                {
                  id: "7133",
                  name: "variation des encours de production de biens",
                  children: [
                    {
                      id: "71331",
                      name: "Les Opérations de Transformations Matières liées à la fabrication de bien",
                      children: [
                        {
                          id: "713311",
                          name: "Approvisionnement des encours en Matières Premières et autres Consommables",
                          children: [
                            { id: "7133111", name: "Approvisionnements des OF en Matière Première" },
                            { id: "7133112", name: "Approvisionnements des OF en Matières Consommables" },
                            { id: "7133113", name: "Approvisionnements des OF en Fournitures Liées" },
                            { id: "7133114", name: "Approvisionnements des OF en Fournitures Consommables" },
                            { id: "7133115", name: "Approvisionnements des OF en Produits Semi finis" },
                          ],
                        },
                        {
                          id: "713312",
                          name: "Attribution des ressources humaines nécessaires à la fabrication de biens",
                          children: [
                            { id: "7133121", name: "Affectation des charges et Main d'Oeuvre Directement liées à la production" },
                            { id: "7133122", name: "Affectation des Quotes Parts de Charges et MOI liées à la production" },
                          ],
                        },
                        {
                          id: "713313",
                          name: "Répartition des Tâches liées à la Productions de bien constat de variation",
                          children: [
                            {
                              id: "7133131",
                              name: "Répartition des taches de Main d'Oeuvre directement liée à la Productions de bien",
                              children: [
                                { id: "71331311", name: "Répartition par employé des actions de MOD achevées sur bien" },
                                { id: "71331312", name: "Répartition par ordre de fabrication des actions de MOD allouées" },
                              ],
                            },
                            {
                              id: "7133132",
                              name: "Répartition des quotes parts de Main d'Oeuvres et charges Indirectes fab bien",
                              children: [
                                { id: "71331321", name: "Répartition par employé du quote part des actions de MOI achevées sur bien" },
                                { id: "71331322", name: "Répartition par ordre de fabrication du quote des actions de MOI allouées" },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    {
                      id: "71332",
                      name: "Appurement des encours et Collecte des biens exonérés qui ont été Produits",
                      children: [
                        { id: "713321", name: "Collecte et conditionnement des Produits Finis" },
                        { id: "713322", name: "Collecte et conditionnement des Produits Semi Finis" },
                      ],
                    },
                  ],
                },
                { id: "7134", name: "variation des encours de production de services" },
                {
                  id: "7135",
                  name: "variation des stocks de produits",
                  children: [
                    {
                      id: "71351",
                      name: "variation des stocks de produits intermédiaires",
                      children: [
                        { id: "713511", name: "les entrées depuis les encours de production" },
                        { id: "713512", name: "les sorties vers une autre phase du cycle de production" },
                        { id: "713513", name: "les sorties pour ventes de produits intermédiaires" },
                      ],
                    },
                    {
                      id: "71355",
                      name: "variation des stocks de produits finis",
                      children: [
                        { id: "713551", name: "les entrées de depuis la production de PF" },
                        { id: "713552", name: "les sorties pour ventes de Produit Fini" },
                        { id: "713553", name: "variation des stocks de produits finis relatif à une oeuvre globale non achevé" },
                      ],
                    },
                    {
                      id: "71357",
                      name: "variation des stocks de produits résiduels",
                      children: [
                        { id: "713571", name: "les entrées depuis les encours de production" },
                        { id: "713572", name: "les sorties vers encours pour une autres phase du cycle de production" },
                        { id: "713573", name: "les sortie pour vente de produits résiduels de la production d'un bien" },
                        { id: "713574", name: "les sorties en tant que déchets à recycler" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { id: "72", name: "production immobilisée" },
        { id: "73", name: "produits divers ordinaires" },
        { id: "74", name: "subventions d'exploitation et d'équilibre" },
        { id: "75", name: "produits financiers" },
        { id: "77", name: "gains extraordinaires" },
        { id: "78", name: "reprises sur amortissements et provisions" },
        { id: "79", name: "produits financiers liés à une modification comptable" },
      ],
    },
    {
      id: "8",
      name: "Comptes Spéciaux",
    },
  ];
  await createJournals(journalsStructure);
  console.log("Complete French Accounting Chart from documentation created successfully.");

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
      restrictedTopLevelJournalId: "7", // Restricted to sales/products operations
      userRoles: { create: { roleId: salesManagerRole.id } },
    },
  });
  const procurementUser = await prisma.user.create({
    data: {
      email: "achats@demo.com",
      name: "Patricia Achat",
      passwordHash: await bcrypt.hash("achats123", 10),
      restrictedTopLevelJournalId: "6", // Restricted to purchases/charges
      userRoles: { create: { roleId: procurementRole.id } },
    },
  });
  console.log(
    `Created Users: Admin (unrestricted), Sales Manager (restricted to Produits), Procurement Specialist (restricted to Charges)`
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

  console.log("Tax codes and units of measure created successfully.");


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
