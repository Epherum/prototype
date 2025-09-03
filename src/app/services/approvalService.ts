// src/app/services/approvalService.ts

import { ApprovalStatus, Prisma } from "@prisma/client";
import prisma from "@/app/utils/prisma";
import { serviceLogger } from "@/lib/logger";
import { ROOT_JOURNAL_ID } from "@/lib/constants";
import { journalService } from "./journalService";

export interface InProcessItem {
  id: string;
  type: 'partner' | 'good' | 'document' | 'link';
  name: string;
  approvalStatus: ApprovalStatus;
  creationJournalLevel: number;
  currentPendingLevel: number;
  createdAt: Date;
  createdById: string;
  canApprove: boolean;
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
async function getUserApprovalLevel(restrictedTopLevelJournalId: string | null): Promise<number> {
  serviceLogger.debug(`getUserApprovalLevel: Input restrictedTopLevelJournalId: ${restrictedTopLevelJournalId}, ROOT_JOURNAL_ID: ${ROOT_JOURNAL_ID}`);
  console.log(`🔍 DEBUG: getUserApprovalLevel - input: ${restrictedTopLevelJournalId}, ROOT_JOURNAL_ID: ${ROOT_JOURNAL_ID}`);
  
  if (!restrictedTopLevelJournalId || restrictedTopLevelJournalId === ROOT_JOURNAL_ID) {
    console.log(`🔍 DEBUG: getUserApprovalLevel - returning 0 (admin/root level)`);
    return 0; // Admin/Root level - only truly unrestricted users
  }
  
  // For ANY journal restriction (even if it's the root journal in the DB),
  // the user can only approve at level 1 and above (never at root level 0)
  console.log(`🔍 DEBUG: getUserApprovalLevel - calling getJournalLevel for journal ${restrictedTopLevelJournalId}`);
  const level = await getJournalLevel(restrictedTopLevelJournalId);
  const approvalLevel = Math.max(1, level + 1); // Always at least level 1 for restricted users
  console.log(`🔍 DEBUG: getUserApprovalLevel - journal level: ${level}, approval level: ${approvalLevel}`);
  return approvalLevel;
}

/**
 * Gets the journal level for a given journal ID by counting its depth in the hierarchy
 * Level 0 = root, Level 1 = first child, etc.
 */
async function getJournalLevel(journalId: string): Promise<number> {
  serviceLogger.debug(`getJournalLevel: Input journalId: ${journalId}`);
  
  // First, let's check the journal and its parent
  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    select: { id: true, parentId: true, name: true }
  });
  
  console.log(`🔍 DEBUG: getJournalLevel - journal info:`, { 
    id: journal?.id?.toString(),
    parentId: journal?.parentId?.toString(),
    name: journal?.name 
  });
  
  if (!journal) {
    console.log(`🔍 DEBUG: getJournalLevel - journal not found, returning 0`);
    return 0;
  }
  
  if (!journal.parentId) {
    console.log(`🔍 DEBUG: getJournalLevel - journal has no parent (is root), returning 0`);
    return 0; // This is the root journal
  }
  
  // Count levels by walking up the hierarchy
  let currentJournalId = journal.parentId;
  let level = 1; // Start at 1 since we have at least one parent
  
  while (currentJournalId) {
    const parentJournal = await prisma.journal.findUnique({
      where: { id: currentJournalId },
      select: { parentId: true }
    });
    
    if (!parentJournal?.parentId) {
      break; // Reached root
    }
    
    currentJournalId = parentJournal.parentId;
    level++;
  }
  
  console.log(`🔍 DEBUG: getJournalLevel - journal ${journalId} -> level ${level}`);
  return level;
}

/**
 * Fetches entities that are pending approval for the user's level
 */
async function getInProcessItems(options: GetInProcessItemsOptions) {
  serviceLogger.debug("approvalService.getInProcessItems - START", { options });
  console.log("🔍 DEBUG: START options", JSON.stringify(options, null, 2));

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

  serviceLogger.debug("approvalService.getInProcessItems - journal scope calculated", { 
    journalScope, 
    journalIds, 
    restrictedJournalId 
  });

  const results: InProcessItem[] = [];

  // Show all pending items in user's journal scope for oversight
  // User can approve items at their level, but can see all pending items in their scope
  const showOnlyUserLevel = false;
  
  serviceLogger.debug("approvalService.getInProcessItems - filtering settings", { 
    showOnlyUserLevel, 
    userApprovalLevel,
    entityTypesCount: entityTypes.length 
  });

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

    serviceLogger.debug("approvalService.getInProcessItems - partner query", { 
      partnerWhere: JSON.stringify(partnerWhere, null, 2),
      journalScopeLength: journalScope.length 
    });

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

    serviceLogger.debug("approvalService.getInProcessItems - partner results", { 
      partnersFound: partners.length,
      partnerIds: partners.map(p => p.id.toString())
    });
    console.log("🔍 DEBUG: Partner query results", { 
      partnersFound: partners.length,
      partnerIds: partners.map(p => p.id.toString()),
      partnerDetails: partners.map(p => ({ id: p.id.toString(), name: p.name, approvalStatus: p.approvalStatus, currentPendingLevel: p.currentPendingLevel }))
    });

    results.push(...partners.map(p => ({
      ...p,
      id: p.id.toString(),
      type: 'partner' as const,
      canApprove: p.currentPendingLevel === userApprovalLevel,
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
      canApprove: g.currentPendingLevel === userApprovalLevel,
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
      canApprove: d.currentPendingLevel === userApprovalLevel,
    })));
  }

  // Links (if requested or if no specific entity types requested)
  if (entityTypes.length === 0 || entityTypes.includes('link')) {
    // Journal-Partner-Good Links (3-way relationships that need approval)
    serviceLogger.debug("approvalService.getInProcessItems - jpgLinks query", { 
      journalScope, 
      showOnlyUserLevel, 
      userApprovalLevel 
    });
    
    const jpgLinks = await prisma.journalPartnerGoodLink.findMany({
      where: {
        approvalStatus: ApprovalStatus.PENDING,
        ...(showOnlyUserLevel && { currentPendingLevel: userApprovalLevel }),
        ...(journalScope.length > 0 && {
          journalPartnerLink: {
            journalId: { in: journalScope }
          }
        })
      },
      include: {
        journalPartnerLink: {
          include: {
            journal: { select: { name: true } },
            partner: { select: { name: true } }
          }
        },
        good: { select: { label: true } }
      },
      skip,
      take,
    });

    serviceLogger.debug("approvalService.getInProcessItems - jpgLinks results", { 
      jpgLinksFound: jpgLinks.length,
      jpgLinkIds: jpgLinks.map(link => link.id.toString())
    });

    results.push(...jpgLinks.map(link => ({
      id: link.id.toString(),
      name: `${link.journalPartnerLink.journal.name} ↔ ${link.journalPartnerLink.partner.name} ↔ ${link.good.label}`,
      type: 'link' as const,
      approvalStatus: link.approvalStatus,
      creationJournalLevel: link.creationLevel,
      currentPendingLevel: link.currentPendingLevel,
      createdAt: link.createdAt,
      createdById: 'system', // Links don't have createdById
      canApprove: link.currentPendingLevel === userApprovalLevel,
      approvalHistory: link.approvalMetadata,
    })));
  }

  // Sort by creation date (most recent first)
  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  serviceLogger.debug("approvalService.getInProcessItems - FINAL RESULTS", { 
    totalResults: results.length,
    resultTypes: results.map(r => ({ id: r.id, type: r.type, name: r.name }))
  });

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
      case 'link':
        entity = await tx.journalPartnerGoodLink.findUnique({
          where: { id: BigInt(entityId) },
          select: {
            currentPendingLevel: true,
            creationLevel: true,
            approvalStatus: true,
            approvalMetadata: true,
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
    // For links, use creationLevel instead of creationJournalLevel
    const creationLevel = entity.creationJournalLevel ?? entity.creationLevel;
    const isLastLevel = entity.currentPendingLevel >= creationLevel;

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
      case 'link':
        // For links, use approvalMetadata instead of approvalHistory
        const linkUpdateData = {
          ...updateData,
          approvalMetadata: updateData.approvalHistory,
        };
        delete linkUpdateData.approvalHistory;
        delete linkUpdateData.approvedByUserIds;
        delete linkUpdateData.approvalTimestamps;
        
        updatedEntity = await tx.journalPartnerGoodLink.update({
          where: { id: BigInt(entityId) },
          data: linkUpdateData,
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