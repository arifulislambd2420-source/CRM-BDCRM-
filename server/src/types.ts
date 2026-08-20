/**
 * Server-side types. Mirror crm/src/types/index.ts.
 * Keep these in sync until we extract a shared package.
 */

export type Role = 'admin' | 'sub_admin' | 'store_manager';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  storeId: string | null;
  canEditOwnNotes: number; // SQLite stores booleans as 0/1
}

/** As returned from /auth/login — no password, no db-internal fields. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  storeId?: string;
  canEditOwnNotes?: boolean;
}

export interface Store {
  id: string;
  name: string;
}

export interface Stage {
  id: string;
  name: string;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
}

export interface Note {
  id: string;
  number: number;
  text: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
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
  createdAt: string;
  createdById: string;
}
