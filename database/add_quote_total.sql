-- Add quote_total column to bookings table
-- This stores the total from the generated quote so invoices can reference a single source

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS quote_total DECIMAL(10, 2);

-- Add invoice number column while we're at it (used when sending to client)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_number TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_invoice_number ON bookings(invoice_number);
