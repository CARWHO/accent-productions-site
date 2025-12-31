-- Add deposit and payment tracking to client_approvals
ALTER TABLE client_approvals
ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_reference TEXT,
ADD COLUMN IF NOT EXISTS poli_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- payment_status values:
-- 'pending' - awaiting payment choice
-- 'awaiting_bank_transfer' - client selected bank transfer, waiting for payment
-- 'processing' - POLI payment initiated
-- 'paid' - payment confirmed
-- 'skipped' - 0% deposit, no payment needed

-- payment_method values:
-- 'poli' - paid via POLI
-- 'bank_transfer' - paid via bank transfer
-- 'none' - no payment required (0% deposit)
