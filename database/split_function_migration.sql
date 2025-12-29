-- Migration: Add columns for split Edge Function workflow
-- These columns store intermediate data between the 3 Edge Functions:
-- 1. generate-quote: Creates quote_data
-- 2. generate-pdfs: Creates PDFs and uploads to Drive
-- 3. send-email: Sends final email

-- Add quote_data column to store the generated quote JSON
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS quote_data JSONB;

-- Add PDF storage columns (base64 encoded)
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS quote_pdf_base64 TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS job_sheet_pdf_base64 TEXT;

-- Add Drive file ID for reference
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS drive_file_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN inquiries.quote_data IS 'JSON data from AI quote generation (line items, totals, etc)';
COMMENT ON COLUMN inquiries.quote_pdf_base64 IS 'Base64 encoded quote PDF for email attachment';
COMMENT ON COLUMN inquiries.job_sheet_pdf_base64 IS 'Base64 encoded job sheet PDF for email attachment (fullsystem only)';
COMMENT ON COLUMN inquiries.drive_file_id IS 'Google Drive file ID for uploaded quote PDF';
