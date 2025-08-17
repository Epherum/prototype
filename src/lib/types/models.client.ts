// src/lib/types/models.client.ts

import {
  Partner as PartnerPrisma,
  GoodsAndService as GoodPrisma,
  Document as DocumentPrisma,
  DocumentLine as DocumentLinePrisma,
  Journal as JournalPrisma,
  JournalGoodLink as JournalGoodLinkPrisma,
  JournalPartnerLink as JournalPartnerLinkPrisma,
  JournalPartnerGoodLink as JournalPartnerGoodLinkPrisma,
  Role as RolePrisma,
  Permission as PermissionPrisma,
  User as UserPrisma,
  UserRole as UserRolePrisma,
} from "@prisma/client";

// A generic helper to convert a single 'id' field from bigint to string
type WithStringId<T extends { id: bigint }> = Omit<T, "id"> & { id: string };

// A generic helper to convert multiple specified bigint fields to strings
type WithStringKeys<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: string | (T[P] extends bigint | null ? string | null : never); // Handle nullable bigints
};

// ✨ NEWLY ADDED ✨
// Generic paginated response type for all services to use
export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
}

// --- Define Client-Side Models ---

// Simple models with just 'id'  
export type PartnerClient = Omit<PartnerPrisma, "id" | "createdById" | "deletedById" | "previousVersionId" | "nextVersionId"> & {
  id: string;
  createdById: string | null;
  deletedById: string | null; 
  previousVersionId: string | null;
  nextVersionId: string | null;
  journalPartnerLinks?: JournalPartnerLinkWithDetailsClient[];
  // Filter metadata for color coding
  matchedFilters?: string[];
};
export type GoodClient = WithStringId<GoodPrisma> & { 
  jpqLinkId?: string;
  // Filter metadata for color coding
  matchedFilters?: string[];
};
export type JournalClient = JournalPrisma;

// ✨ NEWLY ADDED & CORRECTED ✨
// Define the client model for a Document Line
export type DocumentLineClient = WithStringKeys<
  DocumentLinePrisma,
  "id" | "documentId" | "goodId" | "journalPartnerGoodLinkId"
>;

// Define the client model for a Document, now including its lines
export type DocumentClient = WithStringKeys<
  DocumentPrisma,
  "id" | "partnerId"
> & {
  lines?: DocumentLineClient[];
  partner?: {
    id: string;
    name: string;
    registrationNumber?: string;
    taxId?: string;
  };
  journal?: {
    id: string;
    name: string;
  };
  _count?: {
    lines: number;
  };
};

// ✨ NEWLY ADDED for Link Tables ✨

export type JournalGoodLinkClient = WithStringKeys<
  JournalGoodLinkPrisma,
  "id" | "goodId"
>;

export type JournalPartnerLinkClient = WithStringKeys<
  JournalPartnerLinkPrisma,
  "id" | "partnerId"
>;

export type JournalPartnerGoodLinkClient = WithStringKeys<
  JournalPartnerGoodLinkPrisma,
  "id" | "journalPartnerLinkId" | "goodId"
>;

// Optional: Define "WithDetails" types if you fetch them with relations
export type JournalPartnerLinkWithDetailsClient = JournalPartnerLinkClient & {
  journal?: JournalClient & { parentId?: string | null };
  partner?: PartnerClient;
};

// ✨ NEWLY ADDED for Auth/Authz ✨
export type RoleClient = RolePrisma;
export type PermissionClient = PermissionPrisma;
export type UserClient = UserPrisma;
export type UserRoleClient = UserRolePrisma;

// Define the "WithDetails" client types
export type RoleWithPermissionsClient = RoleClient & {
  permissions: PermissionClient[];
};

export type UserWithRolesClient = UserClient & {
  userRoles: (UserRoleClient & {
    role: RoleClient;
  })[];
};
