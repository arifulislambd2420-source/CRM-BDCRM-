export type Role = 'admin' | 'sub_admin' | 'store_manager';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // mock only; replace with hashed backend field later
  role: Role;
  storeId?: string; // required for store_manager
  canEditOwnNotes?: boolean; // admin-controlled; admins always can
}

export interface Store {
  id: string;
  name: string;
  managerIds: string[];
}

export interface Stage {
  id: string;
  name: string;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: Stage[]; // ordered
}

export interface Note {
  id: string;
  number: number; // sequential per-customer, never reused
  text: string;
  createdAt: string; // ISO
  createdById: string;
  createdByName: string; // denormalized snapshot for display resilience
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  source: string;
  pipelineId: string;
  currentStageId: string;
  storeId: string;
  notes: Note[];
  createdAt: string; // ISO
  createdById: string;
}

export interface SettingsData {
  sources: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
  imagePath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  storeId?: string;
  canEditOwnNotes?: boolean;
}
