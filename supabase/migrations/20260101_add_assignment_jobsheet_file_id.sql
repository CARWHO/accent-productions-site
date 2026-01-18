-- Add jobsheet_drive_file_id to assignments table
-- Stores the Google Drive file ID for each contractor's personalized job sheet PDF

ALTER TABLE booking_contractor_assignments
ADD COLUMN IF NOT EXISTS jobsheet_drive_file_id TEXT;

COMMENT ON COLUMN booking_contractor_assignments.jobsheet_drive_file_id IS 'Google Drive file ID for the contractor-specific job sheet PDF';
