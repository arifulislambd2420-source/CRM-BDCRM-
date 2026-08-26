import type { Order } from '../types';
import { apiFetch } from './api';

export interface CreateOrderInput {
  customerId: string;
  items: { productId: string; quantity: number; unitDiscountedPrice: number }[];
  notes?: string;
}

export async function listOrders(params?: {
  customerId?: string;
  status?: string;
}): Promise<{ total: number; orders: Order[] }> {
  const qs = new URLSearchParams();
  if (params?.customerId) qs.set('customerId', params.customerId);
  if (params?.status) qs.set('status', params.status);
  const q = qs.toString();
  return apiFetch(`/api/orders${q ? `?${q}` : ''}`);
}

export async function getOrder(id: string): Promise<Order> {
  return apiFetch(`/api/orders/${encodeURIComponent(id)}`);
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  return apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(input) });
}

export async function confirmOrder(id: string): Promise<{ order: Order; warnings: string[] }> {
  return apiFetch(`/api/orders/${encodeURIComponent(id)}/confirm`, { method: 'POST' });
}

export async function cancelOrder(id: string): Promise<Order> {
  return apiFetch(`/api/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}

export async function recordPayment(
  orderId: string,
  data: { amount: number; paymentMethod: string; paymentDate?: string; note?: string },
): Promise<{ payment: unknown; order: Order }> {
  return apiFetch(`/api/orders/${encodeURIComponent(orderId)}/payments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'মুলতুবি',
  confirmed: 'কনফার্ম',
  cancelled: 'বাতিল',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const PAYMENT_METHODS = ['নগদ', 'বিকাশ', 'নগদ (মোবাইল)', 'রকেট', 'ব্যাংক', 'অন্যান্য'];
