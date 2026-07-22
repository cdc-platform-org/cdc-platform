export interface PaymentMethod {
  id: string;
  processorToken: string;
  brand: 'visa' | 'mastercard' | 'amex' | 'other';
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  createdAt: string;
}

export type InvoiceStatus = 'paid' | 'pending' | 'failed' | 'refunded';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  description: string;
  amount: number; // თეთრებში/ცენტებში (ინტეჯერი)
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  paidAt: string | null;
  pdfDownloadUrl: string | null;
}

export interface BillingHistory {
  invoices: Invoice[];
  totalCount: number;
}