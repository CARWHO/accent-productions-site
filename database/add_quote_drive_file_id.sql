-- Add quote_drive_file_id column to store Google Drive file ID for quote PDF
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS quote_drive_file_id TEXT;
