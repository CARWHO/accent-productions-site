const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
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

// Parse the CSV file
const csvPath = path.join(__dirname, '..', 'example-data', "Barrie's Backline 2024 - Touring Company List.csv");
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n');

function parseCost(costStr) {
  if (!costStr) return null;
  // Remove $ and any text, extract first number
  const match = costStr.replace(/\$/g, '').match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const items = [];
let currentCategoryLeft = 'Uncategorized';
let currentCategoryRight = 'Uncategorized';

// Skip the title row (row 0)
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;

  const cols = parseCSVLine(line);

  // Check if this is a header row (row 1 has category headers)
  if (i === 1) {
    if (cols[0]) currentCategoryLeft = cols[0];
    if (cols[2]) currentCategoryRight = cols[2];
    continue;
  }

  // Check for category changes in left columns
  if (cols[0] && !cols[1] && cols[0].includes(':')) {
    // This is a sub-category header like "Cymbals:" or "Drum Hardware:"
    currentCategoryLeft = cols[0].replace(':', '').trim();
  } else if (cols[0] && cols[1] === '' && cols[2] === '' && cols[3] === '') {
    // Category header row
    currentCategoryLeft = cols[0];
  } else if (cols[0] === '' && cols[1] === '' && cols[2] && cols[3] === '') {
    // Right side category header
    currentCategoryRight = cols[2];
  }

  // Check for new category headers (single item in a column with no price following)
  if (cols[0] && !cols[1]) {
    const leftText = cols[0].toLowerCase();
    if (leftText.includes('bass heads') || leftText === 'bass heads') {
      currentCategoryLeft = 'Bass Heads';
    } else if (leftText.includes('bass cabinets') || leftText === 'bass cabinets') {
      currentCategoryLeft = 'Bass Cabinets';
    } else if (leftText.includes('guitars') || leftText === 'guitars') {
      currentCategoryLeft = 'Guitars';
    }
  }

  if (cols[2] && !cols[3]) {
    const rightText = cols[2].toLowerCase();
    if (rightText.includes('keyboards') || rightText === 'keyboards') {
      currentCategoryRight = 'Keyboards';
    } else if (rightText.includes('bass guitars') || rightText === 'bass guitars') {
      currentCategoryRight = 'Bass Guitars';
    }
  }

  // Parse left side items (cols 0-1)
  if (cols[0] && cols[0].trim()) {
    const name = cols[0].trim();
    const cost = parseCost(cols[1]);

    // Skip category headers and notes
    const isHeader = name.toLowerCase().includes('bass heads') ||
                     name.toLowerCase().includes('bass cabinets') ||
                     name.toLowerCase() === 'guitars' ||
                     name.includes(':') && !name.includes('(') ||
                     name.toLowerCase().includes('backline workshop') ||
                     name.toLowerCase().includes('deliver') ||
                     name.toLowerCase().includes('comes with');

    if (!isHeader && cost !== null) {
      let category = currentCategoryLeft;

      // Determine category based on keywords
      if (name.toLowerCase().includes('ampeg') || name.toLowerCase().includes('ashdown') ||
          name.toLowerCase().includes('aguilar') || name.toLowerCase().includes('aguila') ||
          name.toLowerCase().includes('vox bass') || name.toLowerCase().includes('t 60 vox')) {
        if (name.toLowerCase().includes('x 10') || name.toLowerCase().includes('x 15') ||
            name.toLowerCase().includes('x10') || name.toLowerCase().includes('x15') ||
            name.toLowerCase().includes('cab')) {
          category = 'Bass Cabinets';
        } else {
          category = 'Bass Heads';
        }
      } else if (name.toLowerCase().includes('dw ') || name.toLowerCase().includes('tama') ||
                 name.toLowerCase().includes('ludwig') || name.toLowerCase().includes('roland electronic drum')) {
        category = 'Drum Kits';
      } else if (name.toLowerCase().includes('paiste') || name.toLowerCase().includes('zildjian') ||
                 name.toLowerCase().includes('zildjiam')) {
        category = 'Cymbals';
      } else if (name.toLowerCase().includes('snare')) {
        category = 'Snares';
      } else if (name.toLowerCase().includes('conga') || name.toLowerCase().includes('bongo') ||
                 name.toLowerCase().includes('tambor') || name.toLowerCase().includes('percussion') ||
                 name.toLowerCase().includes('block') || name.toLowerCase().includes('cow bell')) {
        category = 'Percussion';
      } else if (name.toLowerCase().includes('epiphone') || name.toLowerCase().includes('gretch') ||
                 name.toLowerCase().includes('fender') && (name.toLowerCase().includes('strat') ||
                 name.toLowerCase().includes('tele')) || name.toLowerCase().includes('yari') ||
                 name.toLowerCase().includes('martin') || name.toLowerCase().includes('cort') ||
                 name.toLowerCase().includes('yamaha nylon')) {
        category = 'Guitars';
      } else if (name.toLowerCase().includes('keyboard stand') || name.toLowerCase().includes('guitar stand')) {
        category = 'Stands';
      } else if (name.toLowerCase().includes('stool')) {
        category = 'Furniture';
      } else if (name.toLowerCase().includes('carpet') || name.toLowerCase().includes('persian')) {
        category = 'Furniture';
      }

      items.push({
        name: name,
        category: category,
        hire_rate_per_day: cost,
        notes: '',
        stock_quantity: 1,
        available: true
      });
    }
  }

  // Parse right side items (cols 2-3)
  if (cols[2] && cols[2].trim()) {
    const name = cols[2].trim();
    const cost = parseCost(cols[3]);

    // Skip category headers
    const isHeader = name.toLowerCase() === 'keyboards' ||
                     name.toLowerCase() === 'bass guitars' ||
                     name.toLowerCase().includes('backline workshop') ||
                     name.toLowerCase().includes('deliver');

    if (!isHeader && cost !== null) {
      let category = currentCategoryRight;

      // Determine category based on keywords
      if (name.toLowerCase().includes('fender') && (name.toLowerCase().includes('twin') ||
          name.toLowerCase().includes('reverb') || name.toLowerCase().includes('princeton') ||
          name.toLowerCase().includes('hot rod') || name.toLowerCase().includes('blues') ||
          name.toLowerCase().includes('deville'))) {
        category = 'Guitar Amps';
      } else if (name.toLowerCase().includes('vox ac') || name.toLowerCase().includes('marshall') ||
                 name.toLowerCase().includes('epiphone blues')) {
        category = 'Guitar Amps';
      } else if (name.toLowerCase().includes('peavey keyboard') || name.toLowerCase().includes('roland kc') ||
                 name.toLowerCase().includes('roland jc') || name.toLowerCase().includes('roland ac')) {
        category = 'Keyboard Amps';
      } else if (name.toLowerCase().includes('casio') || name.toLowerCase().includes('edirol') ||
                 name.toLowerCase().includes('alesis') || name.toLowerCase().includes('nord') ||
                 name.toLowerCase().includes('roland rd') || name.toLowerCase().includes('rhodes') ||
                 name.toLowerCase().includes('yamaha mo')) {
        category = 'Keyboards';
      } else if (name.toLowerCase().includes('fender jazz') || name.toLowerCase().includes('ovation') ||
                 name.toLowerCase().includes('beatles bass') || name.toLowerCase().includes('hofner')) {
        category = 'Bass Guitars';
      } else if (name.toLowerCase().includes('cab') || name.toLowerCase().includes('cabinet')) {
        category = 'Guitar Amps';
      }

      items.push({
        name: name,
        category: category,
        hire_rate_per_day: cost,
        notes: '',
        stock_quantity: 1,
        available: true
      });
    }
  }
}

// Remove duplicates based on name
const uniqueItems = [];
const seenNames = new Set();
for (const item of items) {
  if (!seenNames.has(item.name)) {
    seenNames.add(item.name);
    uniqueItems.push(item);
  }
}

console.log(`Parsed ${uniqueItems.length} unique items`);
console.log('\nCategories found:');
const categories = [...new Set(uniqueItems.map(i => i.category))];
categories.forEach(cat => {
  const count = uniqueItems.filter(i => i.category === cat).length;
  console.log(`  ${cat}: ${count} items`);
});

async function updateDatabase() {
  console.log('\nClearing existing hire_items...');
  const { error: deleteError } = await supabase.from('hire_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  if (deleteError) {
    console.error('Error deleting:', deleteError);
    return;
  }

  console.log('Inserting new items...');
  const { data, error: insertError } = await supabase.from('hire_items').insert(uniqueItems).select();

  if (insertError) {
    console.error('Error inserting:', insertError);
    return;
  }

  console.log(`Successfully inserted ${data.length} items!`);
}

updateDatabase();
