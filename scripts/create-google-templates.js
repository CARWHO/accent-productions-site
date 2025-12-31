// Run with: node scripts/create-google-templates.js
// Creates Quote and Jobsheet templates with proper structure
// Prerequisites: Run sync-equipment-sheet.js first to create Master Sheet

require('dotenv').config({ path: '.env' });
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

const MASTER_SHEET_ID = process.env.GOOGLE_MASTER_EQUIPMENT_SHEET_ID;

if (!MASTER_SHEET_ID) {
  console.error('ERROR: GOOGLE_MASTER_EQUIPMENT_SHEET_ID not set!');
  console.error('Run sync-equipment-sheet.js first to create the Master Sheet.');
  process.exit(1);
}

const FOLDER_TYPES = ['fullsystem', 'backline', 'soundtech'];
const FOLDER_LABELS = {
  fullsystem: 'Full System',
  backline: 'Backline',
  soundtech: 'Sound Tech',
};

async function createQuoteTemplate(folderType) {
  const label = FOLDER_LABELS[folderType];
  console.log(`Creating Quote Template - ${label}...`);

  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `Quote Template - ${label}` },
      sheets: [
        { properties: { title: 'Data', index: 0 } },
        { properties: { title: 'LineItems', index: 1 } },
        { properties: { title: 'Totals', index: 2 } },
        { properties: { title: 'Lookup', index: 3, hidden: true } },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;
  const dataSheetId = spreadsheet.data.sheets[0].properties.sheetId;
  const lineItemsSheetId = spreadsheet.data.sheets[1].properties.sheetId;
  const totalsSheetId = spreadsheet.data.sheets[2].properties.sheetId;
  const lookupSheetId = spreadsheet.data.sheets[3].properties.sheetId;

  // ============================================
  // DATA TAB - Metadata (empty values)
  // ============================================
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Data!A1:B9',
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['quote_number', ''],
        ['issued_date', ''],
        ['client_name', ''],
        ['client_email', ''],
        ['client_phone', ''],
        ['client_address', ''],
        ['event_name', ''],
        ['event_date', ''],
        ['event_location', ''],
      ],
    },
  });

  // ============================================
  // LINEITEMS TAB - With formulas for pricing
  // ============================================
  // Header row
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'LineItems!A1:F1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [['Gear Name', 'Qty', 'Days', 'Unit Rate', 'Day2+ Rate', 'Line Total']],
    },
  });

  // Formula rows (50 rows for line items)
  const lineItemFormulas = [];
  for (let row = 2; row <= 51; row++) {
    lineItemFormulas.push([
      '', // A: Gear Name (will be filled or dropdown)
      '', // B: Qty
      '', // C: Days
      `=IF(A${row}="","",IFERROR(VLOOKUP(A${row},IMPORTRANGE("${MASTER_SHEET_ID}","Equipment!B:C"),2,FALSE),0))`, // D: Unit Rate
      `=IF(D${row}="","",D${row}*0.5)`, // E: Day2+ Rate (50%)
      `=IF(OR(A${row}="",B${row}="",C${row}=""),"",IF(C${row}>1,(D${row}+(C${row}-1)*E${row})*B${row},D${row}*B${row}))`, // F: Line Total
    ]);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'LineItems!A2:F51',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: lineItemFormulas },
  });

  // ============================================
  // TOTALS TAB - Summary calculations
  // ============================================
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Totals!A1:B4',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        ['subtotal', '=SUM(LineItems!F:F)'],
        ['gst', '=B1*0.15'],
        ['total', '=B1+B2'],
        ['item_count', '=COUNTA(LineItems!A2:A51)'],
      ],
    },
  });

  // ============================================
  // LOOKUP TAB - Equipment names for dropdown
  // ============================================
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Lookup!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[`=IMPORTRANGE("${MASTER_SHEET_ID}","Equipment!B2:B500")`]],
    },
  });

  // ============================================
  // FORMATTING
  // ============================================
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // Data tab - bold keys
        {
          repeatCell: {
            range: { sheetId: dataSheetId, startColumnIndex: 0, endColumnIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat',
          },
        },
        // LineItems - header formatting
        {
          repeatCell: {
            range: { sheetId: lineItemsSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
              },
            },
            fields: 'userEnteredFormat.textFormat,userEnteredFormat.backgroundColor',
          },
        },
        // LineItems - freeze header
        {
          updateSheetProperties: {
            properties: { sheetId: lineItemsSheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        // LineItems - currency format for rate/total columns
        {
          repeatCell: {
            range: { sheetId: lineItemsSheetId, startRowIndex: 1, startColumnIndex: 3, endColumnIndex: 6 },
            cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } } },
            fields: 'userEnteredFormat.numberFormat',
          },
        },
        // LineItems - column widths
        {
          updateDimensionProperties: {
            range: { sheetId: lineItemsSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 250 },
            fields: 'pixelSize',
          },
        },
        // LineItems - data validation dropdown for Gear Name column
        {
          setDataValidation: {
            range: {
              sheetId: lineItemsSheetId,
              startRowIndex: 1,
              endRowIndex: 51,
              startColumnIndex: 0,
              endColumnIndex: 1,
            },
            rule: {
              condition: {
                type: 'ONE_OF_RANGE',
                values: [{ userEnteredValue: '=Lookup!$A:$A' }],
              },
              showCustomUi: true,
              strict: false,
            },
          },
        },
        // Totals - bold labels
        {
          repeatCell: {
            range: { sheetId: totalsSheetId, startColumnIndex: 0, endColumnIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat',
          },
        },
        // Totals - currency format
        {
          repeatCell: {
            range: { sheetId: totalsSheetId, startColumnIndex: 1, endColumnIndex: 2, startRowIndex: 0, endRowIndex: 3 },
            cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } } },
            fields: 'userEnteredFormat.numberFormat',
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

  console.log(`  ✅ Created: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
  return spreadsheetId;
}

async function createJobsheetTemplate(folderType) {
  const label = FOLDER_LABELS[folderType];
  console.log(`Creating Jobsheet Template - ${label}...`);

  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `Jobsheet Template - ${label}` },
      sheets: [
        { properties: { title: 'Event Data', index: 0 } },
        { properties: { title: 'Equipment', index: 1 } },
        { properties: { title: 'Crew', index: 2 } },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;
  const eventDataSheetId = spreadsheet.data.sheets[0].properties.sheetId;
  const equipmentSheetId = spreadsheet.data.sheets[1].properties.sheetId;
  const crewSheetId = spreadsheet.data.sheets[2].properties.sheetId;

  // ============================================
  // EVENT DATA TAB - Metadata (empty values)
  // ============================================
  // Rows 1-14: Basic event info
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Event Data'!A1:B14",
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['quote_number', ''],
        ['event_name', ''],
        ['event_date', ''],
        ['event_time', ''],
        ['location', ''],
        ['client_name', ''],
        ['client_email', ''],
        ['client_phone', ''],
        ['load_in_time', ''],
        ['sound_check_time', ''],
        ['doors_time', ''],
        ['set_time', ''],
        ['finish_time', ''],
        ['pack_down_time', ''],
      ],
    },
  });

  // Row 16: Suggested Gear section header + column labels
  // Rows 17-31: Placeholder rows for gear items (Item | Qty | Notes)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Event Data'!A16:D16",
    valueInputOption: 'RAW',
    requestBody: {
      values: [['SUGGESTED GEAR', 'Item', 'Qty', 'Notes']],
    },
  });

  // Row 33: Execution Notes section header
  // Rows 34-48: Placeholder rows for notes
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Event Data'!A33",
    valueInputOption: 'RAW',
    requestBody: {
      values: [['EXECUTION NOTES']],
    },
  });

  // ============================================
  // EQUIPMENT TAB - Gear list (empty)
  // ============================================
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Equipment!A1:C1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [['Gear Name', 'Qty', 'Notes']],
    },
  });

  // ============================================
  // CREW TAB - Crew assignments (empty)
  // ============================================
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Crew!A1:F1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [['Role', 'Name', 'Phone', 'Rate', 'Hours', 'Pay']],
    },
  });

  // Crew pay formula rows (10 rows)
  const crewFormulas = [];
  for (let row = 2; row <= 11; row++) {
    crewFormulas.push([
      '', '', '', '', '',
      `=IF(OR(D${row}="",E${row}=""),"",D${row}*E${row})`, // Pay = Rate * Hours
    ]);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Crew!A2:F11',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: crewFormulas },
  });

  // ============================================
  // FORMATTING
  // ============================================
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // Event Data - bold keys (rows 1-14)
        {
          repeatCell: {
            range: { sheetId: eventDataSheetId, startRowIndex: 0, endRowIndex: 14, startColumnIndex: 0, endColumnIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat',
          },
        },
        // Event Data - Suggested Gear header row (row 16) - bold with background
        {
          repeatCell: {
            range: { sheetId: eventDataSheetId, startRowIndex: 15, endRowIndex: 16, startColumnIndex: 0, endColumnIndex: 4 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.85, green: 0.92, blue: 0.83 }, // Light green
              },
            },
            fields: 'userEnteredFormat.textFormat,userEnteredFormat.backgroundColor',
          },
        },
        // Event Data - Execution Notes header row (row 33) - bold with background
        {
          repeatCell: {
            range: { sheetId: eventDataSheetId, startRowIndex: 32, endRowIndex: 33, startColumnIndex: 0, endColumnIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.85, green: 0.85, blue: 0.95 }, // Light blue
              },
            },
            fields: 'userEnteredFormat.textFormat,userEnteredFormat.backgroundColor',
          },
        },
        // Event Data - column B width for Item names
        {
          updateDimensionProperties: {
            range: { sheetId: eventDataSheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
            properties: { pixelSize: 200 },
            fields: 'pixelSize',
          },
        },
        // Equipment - header formatting
        {
          repeatCell: {
            range: { sheetId: equipmentSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
              },
            },
            fields: 'userEnteredFormat.textFormat,userEnteredFormat.backgroundColor',
          },
        },
        // Equipment - freeze header
        {
          updateSheetProperties: {
            properties: { sheetId: equipmentSheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        // Equipment - column widths
        {
          updateDimensionProperties: {
            range: { sheetId: equipmentSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 250 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: equipmentSheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
            properties: { pixelSize: 300 },
            fields: 'pixelSize',
          },
        },
        // Crew - header formatting
        {
          repeatCell: {
            range: { sheetId: crewSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
              },
            },
            fields: 'userEnteredFormat.textFormat,userEnteredFormat.backgroundColor',
          },
        },
        // Crew - freeze header
        {
          updateSheetProperties: {
            properties: { sheetId: crewSheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        // Crew - currency format for Rate/Pay
        {
          repeatCell: {
            range: { sheetId: crewSheetId, startRowIndex: 1, startColumnIndex: 3, endColumnIndex: 4 },
            cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } } },
            fields: 'userEnteredFormat.numberFormat',
          },
        },
        {
          repeatCell: {
            range: { sheetId: crewSheetId, startRowIndex: 1, startColumnIndex: 5, endColumnIndex: 6 },
            cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } } },
            fields: 'userEnteredFormat.numberFormat',
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

  console.log(`  ✅ Created: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
  return spreadsheetId;
}

async function main() {
  console.log('='.repeat(60));
  console.log('CREATE GOOGLE SHEETS TEMPLATES');
  console.log('='.repeat(60) + '\n');
  console.log(`Using Master Sheet: ${MASTER_SHEET_ID}\n`);

  const results = {
    quote: {},
    jobsheet: {},
  };

  for (const folderType of FOLDER_TYPES) {
    results.quote[folderType] = await createQuoteTemplate(folderType);
    results.jobsheet[folderType] = await createJobsheetTemplate(folderType);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('ALL TEMPLATES CREATED!\n');
  console.log('Add these to your .env:\n');
  console.log('# Quote Templates');
  console.log(`GOOGLE_FULLSYSTEM_QUOTE_TEMPLATE_ID=${results.quote.fullsystem}`);
  console.log(`GOOGLE_BACKLINE_QUOTE_TEMPLATE_ID=${results.quote.backline}`);
  console.log(`GOOGLE_SOUNDTECH_QUOTE_TEMPLATE_ID=${results.quote.soundtech}`);
  console.log('');
  console.log('# Jobsheet Templates');
  console.log(`GOOGLE_FULLSYSTEM_JOBSHEET_TEMPLATE_ID=${results.jobsheet.fullsystem}`);
  console.log(`GOOGLE_BACKLINE_JOBSHEET_TEMPLATE_ID=${results.jobsheet.backline}`);
  console.log(`GOOGLE_SOUNDTECH_JOBSHEET_TEMPLATE_ID=${results.jobsheet.soundtech}`);
  console.log('='.repeat(60));

  console.log('\nIMPORTANT: After creating templates, you need to:');
  console.log('1. Open each QUOTE template in Google Sheets');
  console.log('2. Go to the hidden "Lookup" sheet (unhide it temporarily)');
  console.log('3. Click cell A1 and click "Allow access" for IMPORTRANGE');
  console.log('4. Also authorize the IMPORTRANGE in LineItems column D');
  console.log('   (Both will show #REF! until authorized)');
}

main().catch(console.error);
