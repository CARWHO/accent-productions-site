// Run with: node scripts/sync-equipment-sheet.js
// Syncs equipment data from Supabase to Master Equipment Google Sheet
// This should be run whenever equipment/pricing changes

require('dotenv').config({ path: '.env' });
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// Supabase setup
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Google setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

const MASTER_SHEET_ID = process.env.GOOGLE_MASTER_EQUIPMENT_SHEET_ID;

async function fetchEquipmentFromSupabase() {
  console.log('Fetching equipment from Supabase...');

  // Fetch from audio_equipment
  const { data: audioEquipment, error: audioError } = await supabase
    .from('audio_equipment')
    .select('category, name, hire_rate_per_day, stock_quantity, notes')
    .eq('available', true)
    .order('category')
    .order('name');

  if (audioError) {
    console.error('Error fetching audio_equipment:', audioError);
    return [];
  }

  // Fetch from hire_items
  const { data: hireItems, error: hireError } = await supabase
    .from('hire_items')
    .select('category, name, hire_rate_per_day, stock_quantity, notes')
    .eq('available', true)
    .order('category')
    .order('name');

  if (hireError) {
    console.error('Error fetching hire_items:', hireError);
    return audioEquipment || [];
  }

  // Combine and dedupe by name
  const allItems = [...(audioEquipment || []), ...(hireItems || [])];
  const seen = new Set();
  const deduped = allItems.filter(item => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });

  console.log(`  Found ${deduped.length} unique equipment items`);
  return deduped;
}

async function createMasterSheet() {
  console.log('Creating new Master Equipment Sheet...');

  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'Accent Equipment Master' },
      sheets: [
        { properties: { title: 'Equipment', index: 0 } },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;

  // Set header row
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Equipment!A1:E1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [['Category', 'Name', 'Daily Rate', 'Stock', 'Notes']],
    },
  });

  // Format header
  const sheetId = spreadsheet.data.sheets[0].properties.sheetId;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
              },
            },
            fields: 'userEnteredFormat.textFormat,userEnteredFormat.backgroundColor',
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
            properties: { pixelSize: 250 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 },
            properties: { pixelSize: 300 },
            fields: 'pixelSize',
          },
        },
      ],
    },
  });

  // Share with anyone who has link
  await drive.permissions.create({
    fileId: spreadsheetId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  console.log(`  Created: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
  return spreadsheetId;
}

async function syncEquipmentToSheet(spreadsheetId, equipment) {
  console.log(`Syncing ${equipment.length} items to Master Sheet...`);

  // Clear existing data (except header)
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: 'Equipment!A2:E1000',
  });

  if (equipment.length === 0) {
    console.log('  No equipment to sync');
    return;
  }

  // Prepare data rows
  const rows = equipment.map(item => [
    item.category || '',
    item.name || '',
    item.hire_rate_per_day || 0,
    item.stock_quantity || 0,
    item.notes || '',
  ]);

  // Write data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Equipment!A2:E${rows.length + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  // Format currency column
  const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetId = sheetInfo.data.sheets[0].properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 1, endRowIndex: rows.length + 1, startColumnIndex: 2, endColumnIndex: 3 },
            cell: {
              userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        },
      ],
    },
  });

  console.log(`  Synced ${rows.length} items`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('SYNC EQUIPMENT TO MASTER SHEET');
  console.log('='.repeat(60) + '\n');

  // Fetch equipment from Supabase
  const equipment = await fetchEquipmentFromSupabase();

  // Check if master sheet exists
  let spreadsheetId = MASTER_SHEET_ID;

  if (!spreadsheetId) {
    // Create new master sheet
    spreadsheetId = await createMasterSheet();
    console.log('\n' + '='.repeat(60));
    console.log('ADD THIS TO YOUR .env:');
    console.log(`GOOGLE_MASTER_EQUIPMENT_SHEET_ID=${spreadsheetId}`);
    console.log('='.repeat(60) + '\n');
  } else {
    console.log(`Using existing Master Sheet: ${spreadsheetId}`);
  }

  // Sync equipment
  await syncEquipmentToSheet(spreadsheetId, equipment);

  console.log('\n' + '='.repeat(60));
  console.log('SYNC COMPLETE!');
  console.log(`Master Sheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
  console.log('='.repeat(60));
}

main().catch(console.error);
