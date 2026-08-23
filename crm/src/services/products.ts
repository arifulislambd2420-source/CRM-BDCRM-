import type { Product } from '../types';
import { apiFetch } from './api';
import { dataStore, refreshProducts } from './store';

export function getProducts(): Product[] {
  return dataStore.getProducts();
}
export function getProduct(id: string): Product | undefined {
  return dataStore.getProducts().find((p) => p.id === id);
}

export interface ProductInput {
  name: string;
  price: number;
  stockQuantity: number;
  description?: string;
  image?: File | null;
}

function toFormData(input: Partial<ProductInput>): FormData {
  const fd = new FormData();
  if (input.name !== undefined) fd.append('name', input.name);
  if (input.price !== undefined) fd.append('price', String(input.price));
  if (input.stockQuantity !== undefined) fd.append('stockQuantity', String(input.stockQuantity));
  if (input.description !== undefined) fd.append('description', input.description);
  if (input.image) fd.append('image', input.image);
  return fd;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const created = await apiFetch<Product>('/api/products', {
    method: 'POST',
    body: toFormData(input),
  });
  await refreshProducts();
  return created;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  const updated = await apiFetch<Product>(`/api/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: toFormData(input),
  });
  await refreshProducts();
  return updated;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiFetch(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await refreshProducts();
}

export const LOW_STOCK_THRESHOLD = 5;
