-- Add jobsheet_sheet_id column for storing Google Sheet ID for jobsheets
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS jobsheet_sheet_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS jobsheet_sheet_id TEXT;
