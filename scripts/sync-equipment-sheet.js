// Run with: node scripts/sync-equipment-sheet.js
// Syncs equipment data from Supabase to Master Equipment Google Sheet
// This populates the sheet with current data including the Type column

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

  // Fetch from consolidated equipment table
  const { data: equipment, error } = await supabase
    .from('equipment')
    .select('category, name, hire_rate_per_day, stock_quantity, notes, type')
    .eq('available', true)
    .order('type')
    .order('category')
    .order('name');

  if (error) {
    console.error('Error fetching equipment:', error);
    return [];
  }

  console.log(`  Found ${equipment.length} equipment items`);
  return equipment;
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

  // Set header row (including Type column)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Equipment!A1:F1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [['Category', 'Name', 'Daily Rate', 'Stock', 'Notes', 'Type']],
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

  // First, update header to include Type column
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Equipment!A1:F1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [['Category', 'Name', 'Daily Rate', 'Stock', 'Notes', 'Type']],
    },
  });

  // Clear existing data (except header)
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: 'Equipment!A2:F1000',
  });

  if (equipment.length === 0) {
    console.log('  No equipment to sync');
    return;
  }

  // Prepare data rows (including type column)
  const rows = equipment.map(item => [
    item.category || '',
    item.name || '',
    item.hire_rate_per_day || 0,
    item.stock_quantity || 0,
    item.notes || '',
    item.type || 'audio',
  ]);

  // Write data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Equipment!A2:F${rows.length + 1}`,
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

  // Count by type
  const typeCounts = equipment.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  console.log(`  Synced ${rows.length} items:`);
  Object.entries(typeCounts).forEach(([type, count]) => {
    console.log(`    - ${type}: ${count}`);
  });
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
