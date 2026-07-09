export type PaymentStatus = 'REQUIRES_PAYMENT' | 'PAID' | 'FAILED';

export interface Payment {
  id: string;
  orderId: string;
  clientId: string;
  providerId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gateway: string;
  providerRef?: string;
  failureReason?: string | null;
  createdAt: string;
}
