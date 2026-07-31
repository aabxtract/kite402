import type { PaymentPayload } from '@x402/core/types';
import type { endpoints } from '@x402-gateway/shared/schema';

type Endpoint = typeof endpoints.$inferSelect;

declare module 'hono' {
  interface ContextVariableMap {
    paymentPayload: PaymentPayload;
    payerAddress: string | undefined;
    paymentTxId: string | undefined;
    paymentAsset: string | undefined;
    paymentAmount: string | undefined;
    endpoint: Endpoint;
    privyId: string;
  }
}
