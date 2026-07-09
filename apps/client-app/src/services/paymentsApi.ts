import axios from 'axios';
import type { ApiResponse } from '@/types/order.types';
import type { Payment } from '@/types/payment.types';

/** Vite proxy: /api/payments → payment-service (3006) */
const paymentsApi = axios.create({
  baseURL: '/api/payments',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

/** GET /payments?clientId= — the client's payments */
export async function getMyPayments(clientId: string): Promise<Payment[]> {
  const { data } = await paymentsApi.get<ApiResponse<Payment[]>>('', {
    params: { clientId },
  });
  return data.data;
}

/**
 * POST /payments/:id/pay — DEMO: simulate completing the payment.
 * Routes through the service's signed-webhook verification path.
 */
export async function payPayment(
  paymentId: string,
  outcome: 'success' | 'fail' = 'success',
): Promise<Payment> {
  const { data } = await paymentsApi.post<ApiResponse<Payment>>(`/${paymentId}/pay`, {
    outcome,
  });
  return data.data;
}
