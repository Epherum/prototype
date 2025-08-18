// src/services/clientStatusService.ts

export interface Status {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isDefault: boolean;
  displayOrder?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StatusFormData {
  name: string;
  description?: string;
  color?: string;
  displayOrder?: number;
}

export interface StatusUsage {
  partners: number;
  goods: number;
  documents: number;
  totalUsage: number;
}

const API_BASE = "/api/statuses";

// Get all statuses
export const getAllStatuses = async (): Promise<Status[]> => {
  const response = await fetch(API_BASE);
  if (!response.ok) {
    throw new Error("Failed to fetch statuses");
  }
  return response.json();
};

// Get status by ID
export const getStatusById = async (id: string): Promise<Status> => {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch status");
  }
  return response.json();
};

// Create new status
export const createStatus = async (data: StatusFormData): Promise<Status> => {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create status");
  }
  
  return response.json();
};

// Update status
export const updateStatus = async (id: string, data: Partial<StatusFormData> & Pick<StatusFormData, 'name'>): Promise<Status> => {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update status");
  }
  
  return response.json();
};

// Delete status
export const deleteStatus = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete status");
  }
};

// Check if status is being used by any entities
export const getStatusUsage = async (id: string): Promise<StatusUsage> => {
  const response = await fetch(`${API_BASE}/${id}/usage`);
  if (!response.ok) {
    throw new Error("Failed to check status usage");
  }
  return response.json();
};