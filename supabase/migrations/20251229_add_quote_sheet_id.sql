-- Add quote_sheet_id column to store Google Sheets ID for editable quotes
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS quote_sheet_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS quote_sheet_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN inquiries.quote_sheet_id IS 'Google Sheets ID for editable quote';
COMMENT ON COLUMN bookings.quote_sheet_id IS 'Google Sheets ID for editable quote';
