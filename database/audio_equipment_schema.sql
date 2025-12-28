-- Audio Equipment table for PA/Sound system hire
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS audio_equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  hire_rate_per_day DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 1,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_audio_equipment_category ON audio_equipment(category);
CREATE INDEX IF NOT EXISTS idx_audio_equipment_name ON audio_equipment(name);
CREATE INDEX IF NOT EXISTS idx_audio_equipment_available ON audio_equipment(available);

-- Enable Row Level Security
ALTER TABLE audio_equipment ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for the API to fetch equipment)
CREATE POLICY "Allow public read access" ON audio_equipment
  FOR SELECT
  USING (true);

-- Allow service role to insert/update (for import scripts)
CREATE POLICY "Allow service role full access" ON audio_equipment
  FOR ALL
  USING (auth.role() = 'service_role');
