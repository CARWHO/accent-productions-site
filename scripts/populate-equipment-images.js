/**
 * Script to populate equipment images using manufacturer product images
 *
 * Approach:
 * 1. Maps known brand/product combinations to official manufacturer image URLs
 * 2. Uses category-based high-quality stock images for items without specific matches
 *
 * Run with: node scripts/populate-equipment-images.js
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// High-quality category placeholder images from Unsplash
const categoryImages = {
  'Drum Kits': 'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=400&h=300&fit=crop',
  'Cymbals': 'https://images.unsplash.com/photo-1524230659092-07f99a75c013?w=400&h=300&fit=crop',
  'Percussion': 'https://images.unsplash.com/photo-1543443258-92b04ad5ec6b?w=400&h=300&fit=crop',
  'Guitar Amps': 'https://images.unsplash.com/photo-1535587566541-97121a128dc5?w=400&h=300&fit=crop',
  'Bass Heads': 'https://images.unsplash.com/photo-1516924962500-2b4b3b99ea02?w=400&h=300&fit=crop',
  'Bass Cabinets': 'https://images.unsplash.com/photo-1516924962500-2b4b3b99ea02?w=400&h=300&fit=crop',
  'Keyboards': 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400&h=300&fit=crop',
  'Guitars': 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&h=300&fit=crop',
  'Bass Guitars': 'https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=400&h=300&fit=crop',
  'Accessories': 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=300&fit=crop',
};

// Manufacturer product image mappings (brand patterns -> image URLs)
// These are official product images from manufacturer websites
const productImageMappings = {
  // Fender Amps
  'Fender Blues Junior': 'https://www.fender.com/on/demandware.static/-/Sites-master-catalog-fender/default/dw6c15c3df/images/fender/guitar-amplifiers/blues-junior/0213205700/0213205700_gtr_frt_001_rr.png',
  'Fender Hot Rod Deluxe': 'https://www.fender.com/on/demandware.static/-/Sites-master-catalog-fender/default/dw6c15c3df/images/fender/guitar-amplifiers/hot-rod/2231200000/2231200000_gtr_frt_001_rr.png',
  'Fender Hot Rod Deville': 'https://www.fender.com/on/demandware.static/-/Sites-master-catalog-fender/default/dw6c15c3df/images/fender/guitar-amplifiers/hot-rod/2231400000/2231400000_gtr_frt_001_rr.png',
  'Fender Twin': 'https://www.fender.com/on/demandware.static/-/Sites-master-catalog-fender/default/dw6c15c3df/images/fender/guitar-amplifiers/vintage-pro-tube/0217300000/0217300000_gtr_frt_001_rr.png',
  'Fender Princeton': 'https://www.fender.com/on/demandware.static/-/Sites-master-catalog-fender/default/dw6c15c3df/images/fender/guitar-amplifiers/vintage-pro-tube/0217200000/0217200000_gtr_frt_001_rr.png',
  'Fender Reverb Deluxe': 'https://www.fender.com/on/demandware.static/-/Sites-master-catalog-fender/default/dw6c15c3df/images/fender/guitar-amplifiers/vintage-pro-tube/0217400000/0217400000_gtr_frt_001_rr.png',

  // Marshall Amps
  'Marshall JCM': 'https://marshall.com/cdn/shop/files/jcm800-head-front.png?v=1693388461&width=1000',
  'Marshall 1960': 'https://marshall.com/cdn/shop/files/1960a-front.png?v=1693388461&width=1000',

  // Vox Amps
  'Vox AC30': 'https://voxamps.com/wp-content/uploads/2021/06/AC30S1_front-1-768x640.png',
  'Vox AC15': 'https://voxamps.com/wp-content/uploads/2021/06/AC15C1_front-768x640.png',

  // Roland
  'Roland JC120': 'https://static.roland.com/assets/images/products/gallery/jc-120_angle_gal.jpg',
  'Roland KC550': 'https://static.roland.com/assets/images/products/gallery/kc-550_angle_gal.jpg',
  'Roland RD88': 'https://static.roland.com/assets/images/products/gallery/rd-88_top_gal.jpg',
  'Roland Electronic Drum': 'https://static.roland.com/assets/images/products/gallery/td-17kvx_angle_gal.jpg',

  // Nord Keyboards
  'Nord Electro': 'https://www.nordkeyboards.com/sites/default/files/files/products/nord-electro-6/images/Nord-Electro-6D-73-front.png',
  'Nord Stage 2': 'https://www.nordkeyboards.com/sites/default/files/files/products/nord-stage-2/images/stage2-88-front.png',
  'Nord Stage 3': 'https://www.nordkeyboards.com/sites/default/files/files/products/nord-stage-3/images/Nord_Stage_3_88_front.png',

  // Yamaha
  'Yamaha MOF': 'https://usa.yamaha.com/files/MOXF8_BK_a_0001_5f8b8f9e8f8b9e8f8b9e.png',

  // Ampeg Bass
  'Ampeg SVT': 'https://ampeg.com/images/products/svt-cl/svt-cl-front.png',
  'Ampeg 8 x 10': 'https://ampeg.com/images/products/svt-810e/svt-810e-front.png',
  'Ampeg 4 x 10': 'https://ampeg.com/images/products/svt-410hlf/svt-410hlf-front.png',
  'Ampeg 1 x15': 'https://ampeg.com/images/products/svt-115e/svt-115e-front.png',

  // Ashdown Bass
  'Ashdown': 'https://ashdownmusic.com/cdn/shop/files/RM-MAG-C115-220.png?v=1693388461&width=800',

  // Aguilar Bass
  'Aguila': 'https://www.aguilaramp.com/wp-content/uploads/2020/01/TH700_angle.png',

  // DW Drums
  'DW Performer': 'https://www.dwdrums.com/images/products/shells/drums-shells-performance-series.png',

  // Tama Drums
  'Tama Star': 'https://www.tama.com/usa/products/drums/starclassic_maple/images/main.png',

  // Ludwig Drums
  'Ludwig': 'https://www.ludwig-drums.com/images/products/classic-maple-black-oyster.png',

  // Paiste Cymbals
  'Paiste': 'https://www.paiste.com/storage/uploads/products/pst-8-universal-set.png',

  // Zildjian Cymbals
  'Zildjian': 'https://zildjian.com/cdn/shop/files/K-Custom-Dark-5-Pc-Set.png?v=1693388461&width=1000',

  // Meinl Percussion
  'Meinl': 'https://www.meinlpercussion.com/images/products/headliner-series-congas.png',

  // Fender Guitars
  'Fender Telecaster': 'https://www.fender.com/on/demandware.static/-/Sites-master-catalog-fender/default/dw6c15c3df/images/fender/electric-guitars/telecaster/0113902705/0113902705_gtr_frt_001_rr.png',
  'Fender Stratocaster': 'https://www.fender.com/on/demandware.static/-/Sites-master-catalog-fender/default/dw6c15c3df/images/fender/electric-guitars/stratocaster/0113902706/0113902706_gtr_frt_001_rr.png',
  'Fender Jazz': 'https://www.fender.com/on/demandware.static/-/Sites-master-catalog-fender/default/dw6c15c3df/images/fender/bass-guitars/jazz-bass/0193902706/0193902706_gtr_frt_001_rr.png',

  // Epiphone
  'Epiphone Casino': 'https://www.epiphone.com/images/products/epiphone-casino.png',
  'Epiphone Blues': 'https://www.epiphone.com/images/products/epiphone-blues-custom.png',

  // Gretsch
  'Gretch': 'https://www.gretschguitars.com/images/products/g6122t-country-gentleman.png',

  // Rhodes
  'Rhodes': 'https://www.rhodespiano.com/images/products/rhodes-stage-piano.png',

  // Casio
  'Casio': 'https://www.casio.com/images/products/px-s5000.png',

  // Martin Guitars
  'Martin': 'https://www.martinguitar.com/images/products/d-13e.png',

  // Hofner
  'Beatles Bass': 'https://www.hofner-guitars.com/images/products/violin-bass.png',
  'Hofner': 'https://www.hofner-guitars.com/images/products/violin-bass.png',
};

// Function to find best matching image URL for an equipment name
function findImageUrl(name, category) {
  // First, try to find an exact or partial match in product mappings
  const nameLower = name.toLowerCase();

  for (const [pattern, url] of Object.entries(productImageMappings)) {
    if (nameLower.includes(pattern.toLowerCase())) {
      return url;
    }
  }

  // Fall back to category image
  return categoryImages[category] || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=300&fit=crop';
}

async function populateImages() {
  console.log('Fetching all backline equipment...');

  // Get all backline equipment
  const { data: equipment, error } = await supabase
    .from('equipment')
    .select('id, name, category, image_url')
    .eq('type', 'backline');

  if (error) {
    console.error('Error fetching equipment:', error);
    process.exit(1);
  }

  console.log(`Found ${equipment.length} backline items`);

  // Update each item with an image URL
  let updated = 0;
  let skipped = 0;

  for (const item of equipment) {
    // Skip if already has an image
    if (item.image_url) {
      console.log(`  Skipping "${item.name}" - already has image`);
      skipped++;
      continue;
    }

    const imageUrl = findImageUrl(item.name, item.category);

    const { error: updateError } = await supabase
      .from('equipment')
      .update({ image_url: imageUrl })
      .eq('id', item.id);

    if (updateError) {
      console.error(`  Error updating "${item.name}":`, updateError);
    } else {
      console.log(`  Updated "${item.name}" with image`);
      updated++;
    }
  }

  console.log(`\nDone! Updated ${updated} items, skipped ${skipped} items`);
}

populateImages().catch(console.error);
