export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESCHEDULE_PROPOSED';

export interface OrderItem {
  serviceId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  clientId: string;
  providerId: string;
  items: OrderItem[];
  notes: string;
  status: OrderStatus;
  totalAmount: number;
  scheduledDate?: string | null; // date requested by the client
  proposedDate?: string | null;  // alternative date proposed by the provider
  createdAt: string;
}
