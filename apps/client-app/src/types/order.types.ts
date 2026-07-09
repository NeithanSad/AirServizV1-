// Order-related TypeScript types shared across the client-app

export interface OrderItem {
  serviceId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderPayload {
  providerId: string;
  items: OrderItem[];
  scheduledDate: string; // ISO-8601 — date requested by the client
  notes?: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESCHEDULE_PROPOSED';

export interface Order {
  id: string;
  clientId: string;
  providerId: string;
  items: OrderItem[];
  notes?: string;
  status: OrderStatus;
  totalAmount: number;
  scheduledDate?: string | null;
  proposedDate?: string | null;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
