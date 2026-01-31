// Type definitions for sound system quote output
// Used by pdf-sound-quote.tsx for PDF generation

export interface QuoteLineItems {
  foh: number;
  monitors: { count: number; cost: number };
  microphones: { count: number; cost: number };
  console: number;
  cables: number;
  vehicle: number;
  techTime: { hours: number; rate: number; cost: number };
}

export interface SuggestedGearItem {
  item: string;
  quantity: number;
  notes?: string;
  matchedInInventory?: boolean;
  matchedName?: string;
}

export interface SoundQuoteOutput {
  quoteNumber: string;
  title: string;
  subtitle: string;
  lineItems: QuoteLineItems;
  executionNotes: string[];
  suggestedGear: SuggestedGearItem[];
  unavailableGear: string[];
  subtotal: number;
  gst: number;
  total: number;
}
