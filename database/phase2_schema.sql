-- Phase 2: Contractor Scheduling System Updates
-- Run this in Supabase SQL Editor

-- 1. Booking Contractor Assignments (Many-to-Many with job-specific details)
CREATE TABLE IF NOT EXISTS booking_contractor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id),

  -- Assignment details
  pay_amount DECIMAL(10, 2) NOT NULL,
  tasks_description TEXT,
  equipment_assigned TEXT[],

  -- Workflow status
  status TEXT DEFAULT 'pending',  -- pending, notified, accepted, declined
  assignment_token TEXT UNIQUE,
  notified_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure a contractor can only be assigned once per booking
  UNIQUE(booking_id, contractor_id)
);

CREATE INDEX IF NOT EXISTS idx_bca_booking_id ON booking_contractor_assignments(booking_id);
CREATE INDEX IF NOT EXISTS idx_bca_contractor_id ON booking_contractor_assignments(contractor_id);
CREATE INDEX IF NOT EXISTS idx_bca_assignment_token ON booking_contractor_assignments(assignment_token);

-- 2. Client Approvals Table
CREATE TABLE IF NOT EXISTS client_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,

  -- Quote details (dad can adjust before sending to client)
  adjusted_quote_total DECIMAL(10, 2),
  quote_notes TEXT,

  -- Token for client approval link
  client_approval_token TEXT UNIQUE,

  -- Status tracking
  sent_to_client_at TIMESTAMPTZ,
  client_approved_at TIMESTAMPTZ,
  client_email TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_approvals_token ON client_approvals(client_approval_token);
CREATE INDEX IF NOT EXISTS idx_client_approvals_booking_id ON client_approvals(booking_id);

-- 3. Add Phase 2 columns to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contractor_selection_token TEXT UNIQUE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contractors_selected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_contractor_selection_token ON bookings(contractor_selection_token);

-- Phase 2 Fixes: Add hourly rate and hours columns
ALTER TABLE booking_contractor_assignments
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(5,2);
