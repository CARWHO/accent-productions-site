-- Contractors table
CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  skills TEXT[] DEFAULT '{}', -- ['sound_engineer', 'audio_tech', 'dj']
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings table (links inquiries to contractors)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES inquiries(id),
  quote_number TEXT,
  booking_type TEXT DEFAULT 'fullsystem', -- 'backline', 'fullsystem', 'soundtech'
  status TEXT DEFAULT 'pending', -- pending, approved, sent_to_contractors, assigned, completed, cancelled

  -- Event details (copied from inquiry for easy access)
  event_date DATE,
  event_time TEXT,
  location TEXT,
  event_name TEXT,
  job_description TEXT,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,

  -- Approval workflow
  approval_token TEXT UNIQUE,
  approved_at TIMESTAMPTZ,

  -- Contractor assignment
  contractor_token TEXT UNIQUE,
  assigned_contractor_id UUID REFERENCES contractors(id),
  assigned_at TIMESTAMPTZ,
  contractors_notified_at TIMESTAMPTZ,

  -- Google Calendar
  calendar_event_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_bookings_approval_token ON bookings(approval_token);
CREATE INDEX IF NOT EXISTS idx_bookings_contractor_token ON bookings(contractor_token);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
