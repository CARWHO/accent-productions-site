-- Migration: Add columns for split Edge Function workflow
-- These columns store intermediate data between the 3 Edge Functions:
-- 1. generate-quote: Creates quote_data
-- 2. generate-pdfs: Generates PDFs and uploads to Drive (stores Drive file IDs)
-- 3. send-email: Fetches PDFs from Drive and sends email

-- Add quote_data column to store the generated quote JSON
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS quote_data JSONB;

-- Add Drive file IDs for PDF references (PDFs stored in Drive, not in DB)
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS job_sheet_drive_file_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN inquiries.quote_data IS 'JSON data from AI quote generation (line items, totals, etc)';
COMMENT ON COLUMN inquiries.drive_file_id IS 'Google Drive file ID for uploaded quote PDF';
COMMENT ON COLUMN inquiries.job_sheet_drive_file_id IS 'Google Drive file ID for uploaded job sheet PDF (fullsystem only)';
