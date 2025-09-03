// src/services/clientApprovalService.ts

export interface GetInProcessItemsParams {
  entityTypes?: string[];
  journalIds?: string[];
  take?: number;
  skip?: number;
}

export interface ApproveEntityParams {
  entityType: string;
  entityId: string;
  comments?: string;
}

export interface InProcessItem {
  id: string;
  type: 'partner' | 'good' | 'document' | 'link';
  name: string;
  approvalStatus: string;
  creationJournalLevel: number;
  currentPendingLevel: number;
  createdAt: string;
  createdById: string;
  canApprove: boolean;
  // Additional fields for better display
  journalName?: string;
  partnerName?: string;
  goodName?: string;
  refDoc?: string;
}

export interface InProcessResponse {
  data: InProcessItem[];
  totalCount: number;
}

export interface ApprovalResponse {
  success: boolean;
  entityId: string;
  entityType: string;
  newStatus: string;
  newLevel?: number;
  isCompleted: boolean;
}

/**
 * Fetches entities that are pending approval
 */
export async function getInProcessItems(params: GetInProcessItemsParams = {}): Promise<InProcessResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.entityTypes && params.entityTypes.length > 0) {
    searchParams.append('entityTypes', params.entityTypes.join(','));
  }
  
  if (params.journalIds && params.journalIds.length > 0) {
    searchParams.append('journalIds', params.journalIds.join(','));
  }
  
  if (params.take !== undefined) {
    searchParams.append('take', params.take.toString());
  }
  
  if (params.skip !== undefined) {
    searchParams.append('skip', params.skip.toString());
  }

  const response = await fetch(`/api/approval/inprocess?${searchParams}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch pending items');
  }

  return await response.json();
}

/**
 * Approves a pending entity
 */
export async function approveEntity(params: ApproveEntityParams): Promise<ApprovalResponse> {
  const response = await fetch('/api/approval/approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to approve entity');
  }

  return await response.json();
}

// Query keys for React Query
export const approvalKeys = {
  all: ['approval'] as const,
  inProcess: () => [...approvalKeys.all, 'inprocess'] as const,
  inProcessFiltered: (params: GetInProcessItemsParams) => 
    [...approvalKeys.inProcess(), params] as const,
};

const clientApprovalService = {
  getInProcessItems,
  approveEntity,
  approvalKeys,
};

export default clientApprovalService;