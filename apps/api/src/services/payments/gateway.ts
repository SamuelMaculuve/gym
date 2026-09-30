/**
 * Contrato para gateways de pagamento online (M-Pesa, e-Mola, cartões...).
 * Nesta versão só existe o fornecedor "manual": o link mostra instruções e os contactos
 * do ginásio. Um gateway real implementa `createCheckout` e confirma o pagamento
 * através de webhook, chamando `registerPayment` com `source: 'ONLINE'`.
 */
export interface CheckoutRequest {
  paymentLinkId: string;
  amountCents: number;
  currency: string;
  phone?: string;
  description: string;
}

export interface CheckoutResponse {
  /** URL para onde redireccionar o membro, se aplicável. */
  redirectUrl?: string;
  externalRef: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
}

export interface PaymentGateway {
  readonly id: string;
  readonly label: string;
  readonly available: boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResponse>;
}

export const gateways: PaymentGateway[] = [
  {
    id: 'mpesa',
    label: 'M-Pesa',
    available: false,
    createCheckout: async () => {
      throw new Error('Pagamento M-Pesa online ainda não disponível');
    },
  },
  {
    id: 'emola',
    label: 'e-Mola',
    available: false,
    createCheckout: async () => {
      throw new Error('Pagamento e-Mola online ainda não disponível');
    },
  },
];
