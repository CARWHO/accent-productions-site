// Run with: node scripts/add-missing-equipment.js
// Adds missing equipment items to Supabase audio_equipment table

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Equipment to add (based on what AI generates but isn't in inventory)
const newEquipment = [
  {
    category: 'Powered Speakers',
    name: 'EV ZLX 8P G2',
    notes: '8" powered speaker, 1000W',
    hire_rate_per_day: 50.00,
    stock_quantity: 2,
    available: true,
  },
  // Also add alternate name for EKX18 Sub (without space)
  {
    category: 'Powered Speakers',
    name: 'EV EKX18 Sub',
    notes: '18" powered sub, 1500W (alias for EV EKX 18 Sub)',
    hire_rate_per_day: 125.00,
    stock_quantity: 8,
    available: true,
  },
];

async function addEquipment() {
  console.log('Adding missing equipment to Supabase...\n');

  for (const item of newEquipment) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('audio_equipment')
      .select('id, name')
      .eq('name', item.name)
      .single();

    if (existing) {
      console.log(`⏭️  "${item.name}" already exists, skipping`);
      continue;
    }

    const { data, error } = await supabase
      .from('audio_equipment')
      .insert(item)
      .select()
      .single();

    if (error) {
      console.error(`❌ Failed to add "${item.name}":`, error.message);
    } else {
      console.log(`✅ Added: ${item.name} @ $${item.hire_rate_per_day}/day`);
    }
  }

  console.log('\nDone! Now run: node scripts/sync-equipment-sheet.js');
}

addEquipment().catch(console.error);
