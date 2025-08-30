// src/app/services/approvalService.ts

import { ApprovalStatus, Prisma } from "@prisma/client";
import prisma from "@/app/utils/prisma";
import { serviceLogger } from "@/lib/logger";
import { ROOT_JOURNAL_ID } from "@/lib/constants";
import { journalService } from "./journalService";

export interface InProcessItem {
  id: string;
  type: 'partner' | 'good' | 'document' | 'journalPartnerLink' | 'journalGoodLink' | 'journalPartnerGoodLink';
  name: string;
  approvalStatus: ApprovalStatus;
  creationJournalLevel: number;
  currentPendingLevel: number;
  createdAt: Date;
  createdById: string;
  approvalHistory?: any;
}

export interface GetInProcessItemsOptions {
  userApprovalLevel: number;
  entityTypes: string[];
  journalIds: string[];
  restrictedJournalId: string | null;
  take: number;
  skip: number;
}

export interface ApproveEntityOptions {
  entityType: string;
  entityId: string;
  userApprovalLevel: number;
  userId: string;
  comments?: string;
  userIp: string;
}

/**
 * Determines the user's approval level based on their journal restriction
 * - Admin (no restriction): Level 0 (root level)
 * - Level 1 User: Level 1
 * - Level 2 User: Level 2
 * etc.
 */
function getUserApprovalLevel(restrictedTopLevelJournalId: string | null): number {
  if (!restrictedTopLevelJournalId || restrictedTopLevelJournalId === ROOT_JOURNAL_ID) {
    return 0; // Admin/Root level
  }
  
  // TODO: Calculate the actual level based on journal hierarchy depth
  // For now, we'll use a simple mapping, but this should be enhanced
  // to dynamically calculate the level based on journal hierarchy
  
  // This is a placeholder - you'll need to implement proper level calculation
  // based on the journal's depth in the hierarchy
  return 1; // Default to level 1 for restricted users
}

/**
 * Gets the journal level for a given journal ID by counting its depth in the hierarchy
 */
async function getJournalLevel(journalId: string): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ level: number }>>`
    WITH RECURSIVE "JournalLevel" AS (
      SELECT "id", "parent_id", 0 AS level FROM "journals" WHERE "id" = ${journalId}
      UNION ALL
      SELECT j."id", j."parent_id", jl.level + 1 FROM "journals" j
      INNER JOIN "JournalLevel" jl ON j."id" = jl."parent_id"
    )
    SELECT level FROM "JournalLevel" WHERE "id" = ${journalId} LIMIT 1;
  `;
  
  return result[0]?.level ?? 0;
}

/**
 * Fetches entities that are pending approval for the user's level
 */
async function getInProcessItems(options: GetInProcessItemsOptions) {
  serviceLogger.debug("approvalService.getInProcessItems", { options });

  const { userApprovalLevel, entityTypes, journalIds, restrictedJournalId, take, skip } = options;

  // Build journal scope based on selection and user restrictions
  let journalScope: string[] = [];
  
  if (journalIds && journalIds.length > 0) {
    journalScope = journalIds;
  } else if (restrictedJournalId && restrictedJournalId !== ROOT_JOURNAL_ID) {
    // Get all descendant journals for restricted user
    const descendants = await journalService.getDescendantJournalIds(restrictedJournalId);
    journalScope = [restrictedJournalId, ...descendants];
  }

  const results: InProcessItem[] = [];

  // If no entity types selected, show only items at user's level (default behavior)
  const showOnlyUserLevel = entityTypes.length === 0;

  // Partners
  if (entityTypes.length === 0 || entityTypes.includes('partner')) {
    const partnerWhere: Prisma.PartnerWhereInput = {
      approvalStatus: ApprovalStatus.PENDING,
      ...(showOnlyUserLevel && { currentPendingLevel: userApprovalLevel }),
      ...(journalScope.length > 0 && {
        journalPartnerLinks: {
          some: {
            journalId: { in: journalScope }
          }
        }
      })
    };

    const partners = await prisma.partner.findMany({
      where: partnerWhere,
      select: {
        id: true,
        name: true,
        approvalStatus: true,
        creationJournalLevel: true,
        currentPendingLevel: true,
        createdAt: true,
        createdById: true,
        approvalHistory: true,
      },
      skip,
      take,
    });

    results.push(...partners.map(p => ({
      ...p,
      id: p.id.toString(),
      type: 'partner' as const,
    })));
  }

  // Goods and Services
  if (entityTypes.length === 0 || entityTypes.includes('good')) {
    const goodWhere: Prisma.GoodsAndServiceWhereInput = {
      approvalStatus: ApprovalStatus.PENDING,
      ...(showOnlyUserLevel && { currentPendingLevel: userApprovalLevel }),
      ...(journalScope.length > 0 && {
        journalGoodLinks: {
          some: {
            journalId: { in: journalScope }
          }
        }
      })
    };

    const goods = await prisma.goodsAndService.findMany({
      where: goodWhere,
      select: {
        id: true,
        label: true,
        approvalStatus: true,
        creationJournalLevel: true,
        currentPendingLevel: true,
        createdAt: true,
        createdById: true,
        approvalHistory: true,
      },
      skip,
      take,
    });

    results.push(...goods.map(g => ({
      ...g,
      id: g.id.toString(),
      name: g.label,
      type: 'good' as const,
    })));
  }

  // Documents
  if (entityTypes.length === 0 || entityTypes.includes('document')) {
    const documentWhere: Prisma.DocumentWhereInput = {
      approvalStatus: ApprovalStatus.PENDING,
      ...(showOnlyUserLevel && { currentPendingLevel: userApprovalLevel }),
      ...(journalScope.length > 0 && {
        journalId: { in: journalScope }
      })
    };

    const documents = await prisma.document.findMany({
      where: documentWhere,
      select: {
        id: true,
        refDoc: true,
        approvalStatus: true,
        creationJournalLevel: true,
        currentPendingLevel: true,
        createdAt: true,
        createdById: true,
        approvalHistory: true,
      },
      skip,
      take,
    });

    results.push(...documents.map(d => ({
      ...d,
      id: d.id.toString(),
      name: d.refDoc,
      type: 'document' as const,
    })));
  }

  // Links (if requested)
  if (entityTypes.includes('link')) {
    // Journal-Partner Links
    const jpLinks = await prisma.journalPartnerLink.findMany({
      where: {
        approvalStatus: ApprovalStatus.PENDING,
        ...(showOnlyUserLevel && { currentPendingLevel: userApprovalLevel }),
        ...(journalScope.length > 0 && {
          journalId: { in: journalScope }
        })
      },
      include: {
        journal: { select: { name: true } },
        partner: { select: { name: true } },
      },
      skip,
      take,
    });

    results.push(...jpLinks.map(link => ({
      id: link.id.toString(),
      name: `${link.journal.name} ↔ ${link.partner.name}`,
      type: 'journalPartnerLink' as const,
      approvalStatus: link.approvalStatus,
      creationJournalLevel: link.creationLevel,
      currentPendingLevel: link.currentPendingLevel,
      createdAt: link.createdAt,
      createdById: 'system', // Links don't have createdById
      approvalHistory: link.approvalMetadata,
    })));
  }

  // Sort by creation date (most recent first)
  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    data: results,
    totalCount: results.length,
  };
}

/**
 * Approves an entity at the current approval level
 */
async function approveEntity(options: ApproveEntityOptions) {
  serviceLogger.debug("approvalService.approveEntity", { options });

  const { entityType, entityId, userApprovalLevel, userId, comments, userIp } = options;

  // Start a transaction to ensure consistency
  return await prisma.$transaction(async (tx) => {
    let entity: any;
    let updateData: any;

    // Get the current entity state
    switch (entityType) {
      case 'partner':
        entity = await tx.partner.findUnique({
          where: { id: BigInt(entityId) },
          select: {
            currentPendingLevel: true,
            creationJournalLevel: true,
            approvalStatus: true,
            approvalHistory: true,
            approvedByUserIds: true,
            approvalTimestamps: true,
          },
        });
        break;
      case 'good':
        entity = await tx.goodsAndService.findUnique({
          where: { id: BigInt(entityId) },
          select: {
            currentPendingLevel: true,
            creationJournalLevel: true,
            approvalStatus: true,
            approvalHistory: true,
            approvedByUserIds: true,
            approvalTimestamps: true,
          },
        });
        break;
      case 'document':
        entity = await tx.document.findUnique({
          where: { id: BigInt(entityId) },
          select: {
            currentPendingLevel: true,
            creationJournalLevel: true,
            approvalStatus: true,
            approvalHistory: true,
            approvedByUserIds: true,
            approvalTimestamps: true,
          },
        });
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }

    if (!entity) {
      throw new Error(`Entity not found: ${entityType} with id ${entityId}`);
    }

    if (entity.approvalStatus !== ApprovalStatus.PENDING) {
      throw new Error(`Entity is not pending approval: ${entityType} with id ${entityId}`);
    }

    // Verify user can approve at this level
    if (entity.currentPendingLevel !== userApprovalLevel) {
      throw new Error(
        `User is not authorized to approve this entity. Entity is at level ${entity.currentPendingLevel} but user can only approve at level ${userApprovalLevel}`
      );
    }

    // Update approval history
    const currentHistory = entity.approvalHistory || [];
    const newHistoryEntry = {
      level: userApprovalLevel,
      approvedBy: userId,
      approvedAt: new Date().toISOString(),
      comments: comments || null,
      userIp,
    };

    const updatedHistory = [...currentHistory, newHistoryEntry];
    const updatedApprovedByUserIds = [...(entity.approvedByUserIds || []), userId];
    const updatedApprovalTimestamps = [...(entity.approvalTimestamps || []), new Date()];

    // Determine if this is the final approval
    const isLastLevel = entity.currentPendingLevel >= entity.creationJournalLevel;

    if (isLastLevel) {
      // Final approval - mark as APPROVED
      updateData = {
        approvalStatus: ApprovalStatus.APPROVED,
        approvalHistory: updatedHistory,
        approvedByUserIds: updatedApprovedByUserIds,
        approvalTimestamps: updatedApprovalTimestamps,
      };
    } else {
      // Move to next approval level
      updateData = {
        currentPendingLevel: entity.currentPendingLevel + 1,
        approvalHistory: updatedHistory,
        approvedByUserIds: updatedApprovedByUserIds,
        approvalTimestamps: updatedApprovalTimestamps,
      };
    }

    // Apply the update
    let updatedEntity: any;
    switch (entityType) {
      case 'partner':
        updatedEntity = await tx.partner.update({
          where: { id: BigInt(entityId) },
          data: updateData,
        });
        break;
      case 'good':
        updatedEntity = await tx.goodsAndService.update({
          where: { id: BigInt(entityId) },
          data: updateData,
        });
        break;
      case 'document':
        updatedEntity = await tx.document.update({
          where: { id: BigInt(entityId) },
          data: updateData,
        });
        break;
    }

    serviceLogger.info(`Entity approved: ${entityType} ${entityId} by user ${userId}`, {
      entityType,
      entityId,
      userId,
      newLevel: updateData.currentPendingLevel,
      isCompleted: isLastLevel,
    });

    return {
      success: true,
      entityId,
      entityType,
      newStatus: isLastLevel ? 'APPROVED' : 'PENDING',
      newLevel: isLastLevel ? null : updateData.currentPendingLevel,
      isCompleted: isLastLevel,
    };
  });
}

const approvalService = {
  getUserApprovalLevel,
  getJournalLevel,
  getInProcessItems,
  approveEntity,
};

export default approvalService;