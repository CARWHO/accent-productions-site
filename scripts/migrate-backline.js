const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Parse price string like "$100", "$50-$75", "$0-150" into a number (takes the higher value for ranges)
function parsePrice(priceStr) {
  if (!priceStr || priceStr.trim() === '') return null;

  const cleaned = priceStr.replace(/\$/g, '').replace(/,/g, '').trim();

  // Handle ranges like "50-75" or "0-150"
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const high = parseFloat(parts[1]);
    return isNaN(high) ? null : high;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse the complex CSV format
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').map(line => {
    // Parse CSV properly handling quoted fields
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
  });

  const items = [];
  let currentLeftCategory = '';
  let currentRightCategory = '';

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length < 2) continue;

    const col0 = row[0] || '';
    const col1 = row[1] || '';
    const col2 = row[2] || '';
    const col3 = row[3] || '';

    // Detect category headers (left side)
    if (col0 && !col1 && col0.match(/^(Drum Kits|Cymbals:|Drum Hardware:|Bass Heads|Bass Cabinets|Guitars|Various Single|Guitar Stands)$/i)) {
      if (col0.toLowerCase().includes('drum kit')) currentLeftCategory = 'Drum Kits';
      else if (col0.toLowerCase().includes('cymbal')) currentLeftCategory = 'Cymbals';
      else if (col0.toLowerCase().includes('drum hardware')) currentLeftCategory = 'Drum Hardware';
      else if (col0.toLowerCase().includes('bass head')) currentLeftCategory = 'Bass Heads';
      else if (col0.toLowerCase().includes('bass cabinet')) currentLeftCategory = 'Bass Cabinets';
      else if (col0.toLowerCase() === 'guitars') currentLeftCategory = 'Guitars';
      else if (col0.toLowerCase().includes('keyboard stand')) currentLeftCategory = 'Accessories';
      else if (col0.toLowerCase().includes('guitar stand')) currentLeftCategory = 'Accessories';
      continue;
    }

    // Detect category headers (right side)
    if (col2 && !col3 && col2.match(/^(Guitar Amps|Keyboards|Bass Guitars)$/i)) {
      if (col2.toLowerCase().includes('guitar amp')) currentRightCategory = 'Guitar Amps';
      else if (col2.toLowerCase() === 'keyboards') currentRightCategory = 'Keyboards';
      else if (col2.toLowerCase().includes('bass guitar')) currentRightCategory = 'Bass Guitars';
      continue;
    }

    // Row 2 is the header row
    if (i === 1) {
      currentLeftCategory = 'Drum Kits';
      currentRightCategory = 'Guitar Amps';
      continue;
    }

    // Process left columns (col0 = item, col1 = price)
    if (col0 && col0.trim()) {
      // Check for inline category changes
      let category = currentLeftCategory;

      if (col0.toLowerCase().startsWith('cymbals:')) {
        category = 'Cymbals';
        currentLeftCategory = 'Cymbals';
      } else if (col0.toLowerCase().startsWith('drum hardware:')) {
        category = 'Drum Hardware';
        currentLeftCategory = 'Drum Hardware';
      } else if (col0.toLowerCase().includes('congas') || col0.toLowerCase().includes('bongos') || col0.toLowerCase().includes('tamborine') || col0.toLowerCase().includes('percussion')) {
        category = 'Percussion';
      } else if (col0.toLowerCase().includes('snares:')) {
        category = 'Drum Hardware';
      } else if (col0.toLowerCase().includes('bass head') || (currentLeftCategory === 'Bass Heads' && col0.toLowerCase().includes('ampeg')) || (currentLeftCategory === 'Bass Heads' && col0.toLowerCase().includes('ashdown')) || (currentLeftCategory === 'Bass Heads' && col0.toLowerCase().includes('aguila')) || col0.toLowerCase().includes('svt')) {
        category = 'Bass Heads';
      } else if (col0.toLowerCase().includes('bass cabinet') || (col0.toLowerCase().includes('ampeg') && col0.toLowerCase().includes('x')) || (col0.toLowerCase().includes('ashdown') && (col0.includes('x 10') || col0.includes('x 15')))) {
        category = 'Bass Cabinets';
      } else if (col0.toLowerCase().includes('keyboard stand')) {
        category = 'Accessories';
      } else if (col0.toLowerCase().includes('guitar stand')) {
        category = 'Accessories';
      } else if (col0.toLowerCase().includes('stool')) {
        category = 'Accessories';
      } else if (col0.toLowerCase().includes('carpet')) {
        category = 'Accessories';
      }

      // Skip header/info rows
      if (col0.toLowerCase().includes('kits comes with') ||
          col0.toLowerCase().includes('backline workshop') ||
          col0.toLowerCase().includes('deliver /collection')) {
        continue;
      }

      const price = parsePrice(col1);
      if (col0.trim() && (price !== null || col1.trim() === '')) {
        items.push({
          category: category,
          name: col0.trim(),
          notes: null,
          hire_rate_per_day: price || 0,
          stock_quantity: 1,
          available: true
        });
      }
    }

    // Process right columns (col2 = item, col3 = price)
    if (col2 && col2.trim()) {
      let category = currentRightCategory;

      // Skip header rows and info text
      if (col2.toLowerCase().includes('backline workshop') ||
          col2.toLowerCase().includes('deliver /collection')) {
        continue;
      }

      const price = parsePrice(col3);
      if (col2.trim() && (price !== null || col3.trim() === '')) {
        items.push({
          category: category,
          name: col2.trim(),
          notes: null,
          hire_rate_per_day: price || 0,
          stock_quantity: 1,
          available: true
        });
      }
    }
  }

  return items;
}

// Better categorization pass
function categorizeItems(items) {
  return items.map(item => {
    const name = item.name.toLowerCase();
    let category = item.category;

    // Drum Kits
    if (name.includes('dw performer') || name.includes('tama') || name.includes('ludwig') || name.includes('roland electronic drum')) {
      category = 'Drum Kits';
    }
    // Cymbals
    else if (name.includes('paiste') || name.includes('zildjian') || name.includes('zildjiam')) {
      category = 'Cymbals';
    }
    // Drum Hardware
    else if (name.includes('snare') && !name.includes('kd') || name.includes('cymbal') && name.includes('std') || name.includes('throne') || name.includes('kick pedal')) {
      category = 'Drum Hardware';
    }
    // Percussion
    else if (name.includes('conga') || name.includes('bongo') || name.includes('tamborine') || name.includes('percussion') || name.includes('cow bell') || name.includes('block')) {
      category = 'Percussion';
    }
    // Bass Heads
    else if (name.includes('ampeg') && name.includes('svt') && !name.includes('x 10') && !name.includes('x 15') && !name.includes('x10') && !name.includes('x15')) {
      category = 'Bass Heads';
    }
    else if ((name.includes('ashdown') && name.includes('mag')) || (name.includes('ashdown') && name.includes('agm')) || name.includes('aguila') || name.includes('tone hammer')) {
      category = 'Bass Heads';
    }
    else if (name.includes('vox bass') || name.includes('t 60 vox')) {
      category = 'Bass Heads';
    }
    // Bass Cabinets
    else if (name.includes('ampeg') && (name.includes('x 10') || name.includes('x 15') || name.includes('x10') || name.includes('x15'))) {
      category = 'Bass Cabinets';
    }
    else if (name.includes('ashdown') && (name.includes('x 10') || name.includes('x 15') || name.includes('combo'))) {
      category = 'Bass Cabinets';
    }
    // Guitar Amps
    else if (name.includes('fender') && (name.includes('twin') || name.includes('reverb') || name.includes('princeton') || name.includes('hot rod') || name.includes('blues junior') || name.includes('deville'))) {
      category = 'Guitar Amps';
    }
    else if (name.includes('vox ac') || name.includes('marshall') || name.includes('epiphone blues')) {
      category = 'Guitar Amps';
    }
    else if (name.includes('roland jc') || name.includes('roland ac') || name.includes('roland kc') || name.includes('peavey keyboard')) {
      category = 'Guitar Amps';
    }
    // Keyboards
    else if (name.includes('casio') || name.includes('nord') || name.includes('roland rd') || name.includes('rhodes') || name.includes('yamaha mo') || name.includes('edirol') || name.includes('alesis')) {
      category = 'Keyboards';
    }
    // Guitars
    else if (name.includes('epiphone casino') || name.includes('gretch') || name.includes('stratocaster') || name.includes('telecaster') || name.includes('yari') || name.includes('martin acoustic') || name.includes('cort travel') || name.includes('yamaha nylon')) {
      category = 'Guitars';
    }
    // Bass Guitars
    else if (name.includes('fender jazz') || name.includes('ovation typhoon') || name.includes('hofner') || name.includes('beatles bass')) {
      category = 'Bass Guitars';
    }
    // Accessories
    else if (name.includes('keyboard stand') || name.includes('guitar stand') || name.includes('stool') || name.includes('carpet')) {
      category = 'Accessories';
    }

    return { ...item, category };
  });
}

// Filter out non-items (headers, info text, etc.)
function filterValidItems(items) {
  return items.filter(item => {
    const name = item.name.toLowerCase();

    // Skip if it's clearly not an item
    if (name.includes('costs +gst') ||
        name === 'drum kits' ||
        name === 'guitar amps' ||
        name === 'bass heads' ||
        name === 'bass cabinets' ||
        name === 'keyboards' ||
        name === 'guitars' ||
        name === 'bass guitars' ||
        name.startsWith('cymbals:') ||
        name.startsWith('drum hardware:') ||
        name.includes('kits comes with') ||
        name.includes('backline workshop') ||
        name.includes('deliver /collection') ||
        name.includes('as req.') ||
        name.includes('as needed') ||
        item.hire_rate_per_day === 0 && !name.includes('various')) {
      return false;
    }

    return true;
  });
}

async function migrate() {
  console.log('Reading CSV file...');
  const csvPath = path.join(__dirname, '..', 'example-data', "Barrie's Backline 2024 - Touring Company List.csv");
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  console.log('Parsing CSV...');
  let items = parseCSV(csvContent);
  console.log(`Parsed ${items.length} raw items`);

  items = categorizeItems(items);
  items = filterValidItems(items);
  console.log(`Filtered to ${items.length} valid items`);

  // Log categories for verification
  const categories = {};
  items.forEach(item => {
    categories[item.category] = (categories[item.category] || 0) + 1;
  });
  console.log('Items by category:', categories);

  console.log('\nDeleting existing hire_items...');
  const { error: deleteError } = await supabase
    .from('hire_items')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

  if (deleteError) {
    console.error('Error deleting existing items:', deleteError);
    process.exit(1);
  }
  console.log('Existing items deleted.');

  console.log('\nInserting new items...');
  const { data, error: insertError } = await supabase
    .from('hire_items')
    .insert(items)
    .select();

  if (insertError) {
    console.error('Error inserting items:', insertError);
    process.exit(1);
  }

  console.log(`\nSuccessfully inserted ${data.length} items!`);

  // Print summary
  console.log('\n=== MIGRATION COMPLETE ===');
  console.log('Items by category:');
  Object.entries(categories).sort().forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
}

migrate().catch(console.error);
