export interface ApiListResponse<T> {
  success: boolean;
  count: number;
  data: T[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'CLIENT' | 'PROVIDER' | 'ADMIN';
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'RESCHEDULED'
  | 'CANCELLED'
  | 'COMPLETED';

export interface Order {
  id: string;
  clientId: string;
  providerId: string;
  items: Array<{ serviceId: string; quantity: number; unitPrice: number }>;
  notes: string | null;
  status: OrderStatus;
  totalAmount: string; // numeric column arrives as string
  scheduledDate: string | null;
  proposedDate: string | null;
  createdAt: string;
}
