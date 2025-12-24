-- Equipment table for backline hire
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on category for faster grouping
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);

-- Enable Row Level Security
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for the form to fetch equipment)
CREATE POLICY "Allow public read access" ON equipment
  FOR SELECT
  USING (true);

-- Example data (replace with your actual Excel data)
-- INSERT INTO equipment (name, category, price) VALUES
--   ('Shure SM58', 'Microphones', 25.00),
--   ('Shure SM57', 'Microphones', 25.00),
--   ('Sennheiser e835', 'Microphones', 30.00),
--   ('JBL EON615', 'Speakers', 80.00),
--   ('QSC K12.2', 'Speakers', 100.00),
--   ('Yamaha MG12XU', 'Mixers', 75.00),
--   ('Allen & Heath ZED-12FX', 'Mixers', 90.00);
