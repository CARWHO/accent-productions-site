-- Consolidate audio_equipment and hire_items into single equipment table
-- Google Sheet becomes the source of truth

-- Create new consolidated equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  name TEXT NOT NULL UNIQUE,
  notes TEXT,
  hire_rate_per_day DECIMAL(10,2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 1,
  type TEXT NOT NULL DEFAULT 'audio',
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS equipment_name_idx ON equipment(name);
CREATE INDEX IF NOT EXISTS equipment_type_idx ON equipment(type);
CREATE INDEX IF NOT EXISTS equipment_category_idx ON equipment(category);

-- Migrate existing data from audio_equipment
INSERT INTO equipment (category, name, notes, hire_rate_per_day, stock_quantity, type, available, created_at, updated_at)
SELECT
  COALESCE(category, 'Uncategorized'),
  name,
  notes,
  COALESCE(hire_rate_per_day, 0),
  COALESCE(stock_quantity, 1),
  'audio',
  COALESCE(available, true),
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW())
FROM audio_equipment
WHERE name IS NOT NULL AND name != ''
ON CONFLICT (name) DO NOTHING;

-- Migrate existing data from hire_items (uses quantity, no updated_at)
INSERT INTO equipment (category, name, notes, hire_rate_per_day, stock_quantity, type, available, created_at, updated_at)
SELECT
  COALESCE(category, 'Uncategorized'),
  name,
  notes,
  COALESCE(hire_rate_per_day, 0),
  COALESCE(stock_quantity, quantity, 1),
  'backline',
  COALESCE(available, true),
  COALESCE(created_at, NOW()),
  NOW()
FROM hire_items
WHERE name IS NOT NULL AND name != ''
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access" ON equipment
  FOR SELECT USING (true);

-- Service role full access (for sync operations)
CREATE POLICY "Service role full access" ON equipment
  FOR ALL USING (auth.role() = 'service_role');
