// Type definitions for backline quote output
// Used by pdf-quote.tsx for PDF generation

export interface QuoteLineItem {
  description: string;
  amount: number;
}

export interface QuoteOutput {
  quoteNumber: string;
  title: string;
  description: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  gst: number;
  total: number;
  rentalDays: number;
}
