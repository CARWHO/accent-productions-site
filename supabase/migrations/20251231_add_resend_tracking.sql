-- Add resend tracking to client_approvals
ALTER TABLE client_approvals
ADD COLUMN IF NOT EXISTS resend_count INTEGER DEFAULT 0;
