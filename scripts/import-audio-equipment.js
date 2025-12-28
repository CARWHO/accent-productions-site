const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse the Excel file
const xlsxPath = path.join(process.cwd(), 'example-data', 'Accent Audio Hire Item Allocation 2025.xlsx');
const workbook = XLSX.readFile(xlsxPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Equipment categories we want to import (row indices where categories start)
const categoryRanges = [
  { category: 'Consoles', start: 3, end: 15 },
  { category: 'Digital Stage Boxes', start: 17, end: 20 },
  { category: 'Powered Compact Mixers', start: 22, end: 23 },
  { category: 'Powered Speakers', start: 26, end: 67 },
  { category: 'Passive Speakers', start: 69, end: 100 },
  { category: 'Battery PA Speakers', start: 102, end: 106 },
  { category: 'PA Amps', start: 109, end: 118 },
  { category: 'Rack Gear', start: 121, end: 125 },
  { category: 'IEM', start: 128, end: 135 },
];

const items = [];

for (const range of categoryRanges) {
  for (let i = range.start; i <= range.end; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;

    const name = row[0]?.toString().trim();
    const quantity = parseInt(row[8]) || 1;
    const notes = row[9]?.toString().trim() || null;
    const hireRate = parseFloat(row[11]) || 0;

    // Skip rows that don't look like equipment items
    if (!name || name.startsWith('(') || name === '') continue;

    // Skip items with zero hire rate (not available for hire)
    if (hireRate === 0) continue;

    items.push({
      category: range.category,
      name: name,
      notes: notes,
      hire_rate_per_day: hireRate,
      stock_quantity: quantity,
      available: true
    });
  }
}

// Group by base model name for quantity tracking
const groupedItems = new Map();

for (const item of items) {
  // Create a base name by removing trailing instance identifiers like "#1", " 1", " 2", "no.1", etc.
  // But preserve model numbers that are part of the name (like "X32", "EKX12", "S16")
  let baseName = item.name
    // Remove trailing "#N" or " #N"
    .replace(/\s*#\s*\d+\s*$/, '')
    // Remove trailing " N" where N is a standalone digit at the end (like "EV ETX 35P 1")
    .replace(/\s+\d\s*$/, '')
    // Remove "no.N" or "No.N"
    .replace(/\s*no\.?\s*\d+\s*$/i, '')
    // Trim whitespace
    .trim();

  const key = `${item.category}::${baseName}`;

  if (groupedItems.has(key)) {
    const existing = groupedItems.get(key);
    existing.stock_quantity += item.stock_quantity;
  } else {
    groupedItems.set(key, {
      ...item,
      name: baseName,
      stock_quantity: item.stock_quantity
    });
  }
}

const finalItems = Array.from(groupedItems.values());

console.log(`Parsed ${finalItems.length} unique equipment types`);
console.log('\nCategories found:');
const categories = [...new Set(finalItems.map(i => i.category))];
categories.forEach(cat => {
  const catItems = finalItems.filter(i => i.category === cat);
  const totalQty = catItems.reduce((sum, i) => sum + i.stock_quantity, 0);
  console.log(`  ${cat}: ${catItems.length} types, ${totalQty} total units`);
});

console.log('\nSample items:');
finalItems.slice(0, 10).forEach(item => {
  console.log(`  [${item.category}] ${item.name} (qty: ${item.stock_quantity}) - $${item.hire_rate_per_day}/day`);
});

async function updateDatabase() {
  console.log('\n--- Database Update ---');

  // First, check if table exists by trying to select from it
  const { error: checkError } = await supabase.from('audio_equipment').select('id').limit(1);

  if (checkError) {
    console.error('Error: audio_equipment table does not exist. Please run the schema first:');
    console.error('  Run database/audio_equipment_schema.sql in Supabase SQL Editor');
    return;
  }

  console.log('Clearing existing audio_equipment...');
  const { error: deleteError } = await supabase
    .from('audio_equipment')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (deleteError) {
    console.error('Error deleting:', deleteError);
    return;
  }

  console.log('Inserting new items...');
  const { data: insertedData, error: insertError } = await supabase
    .from('audio_equipment')
    .insert(finalItems)
    .select();

  if (insertError) {
    console.error('Error inserting:', insertError);
    return;
  }

  console.log(`Successfully inserted ${insertedData.length} items!`);
}

// Only run if called directly (not imported)
if (require.main === module) {
  updateDatabase();
}

module.exports = { finalItems };
