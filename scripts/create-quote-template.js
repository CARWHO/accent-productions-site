// Run with: node scripts/create-quote-template.js
// Creates a fully formatted Quote Template in Google Drive

require('dotenv').config({ path: '.env' });
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function createQuoteTemplate() {
  console.log('Creating Quote Template...');

  // 1. Create new spreadsheet
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'Quote Template - Full System' },
      sheets: [
        { properties: { title: 'Quote', index: 0 } },
        { properties: { title: 'Data', index: 1 } },
        { properties: { title: 'LineItems', index: 2 } },
        { properties: { title: 'Price Catalog', index: 3, hidden: true } },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;
  console.log(`Created spreadsheet: ${spreadsheetId}`);

  // 2. Populate Data tab (placeholder values)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Data!A1:B9',
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['quote_number', '2025-XXXX'],
        ['issued_date', '01 Jan 2025'],
        ['client_name', 'Client Name'],
        ['client_email', 'client@example.com'],
        ['client_phone', '027 XXX XXXX'],
        ['client_address', '123 Street, City'],
        ['event_name', 'Event Name'],
        ['event_date', '01 Jan 2025'],
        ['event_location', 'Venue Address'],
      ],
    },
  });

  // 3. Populate LineItems tab
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'LineItems!A1:D8',
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['Quantity', 'Cost', 'Rate', 'Description'],
        [1, 500, '', 'FOH System'],
        [6, 450, '', 'Monitors'],
        [4, 100, '', 'Microphones'],
        [1, 400, '', 'Console'],
        [1, 250, '', 'Cables & Accessories'],
        [1, 100, '', 'Vehicle'],
        [4, 240, 60, 'Tech Time'],
      ],
    },
  });

  // 4. Populate Quote tab with formulas
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Quote!A1:E36',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        ['', '', '', '', ''],
        ['Barrie Hutton trading as', '', '', '', ''],
        ['Accent Entertainment', '', '', '', ''],
        ['Production Company', '', '', '', ''],
        ['', '', '', '', ''],
        ['23 Moxham Ave', '', '', '', ''],
        ['Hataitai Wellington 6021', '', '', '', ''],
        ['Tel 027 602 3869', '', '', '', ''],
        ['Email hello@accent-productions.co.nz', '', '', '', ''],
        ['', '', '', '', ''],
        ['=CONCATENATE("Quote No: ",Data!B1)', '', '', '=CONCATENATE("Issued: ",Data!B2)', ''],
        ['', '', '', '', ''],
        ['=Data!B3', '', '', '', ''],
        ['=Data!B6', '', '', '', ''],
        ['=Data!B4', '', '', '', ''],
        ['=Data!B5', '', '', '', ''],
        ['', '', '', '', ''],
        ['Quote valid for 28 days', '', '', '', ''],
        ['', '', '', '', ''],
        ['Description', '', '', '', 'Cost'],
        ['=CONCATENATE("Sound System Hire @ ",Data!B9," (",Data!B8,")")', '', '', '', ''],
        ['=Data!B7', '', '', '', ''],
        ['', '', '', '', ''],
        ['=LineItems!D2', '', '', '', '=LineItems!B2'],
        ['=CONCATENATE(LineItems!D3," (",LineItems!A3,"x)")', '', '', '', '=LineItems!B3'],
        ['=CONCATENATE(LineItems!D4," (",LineItems!A4,"x)")', '', '', '', '=LineItems!B4'],
        ['=LineItems!D5', '', '', '', '=LineItems!B5'],
        ['=LineItems!D6', '', '', '', '=LineItems!B6'],
        ['=LineItems!D7', '', '', '', '=LineItems!B7'],
        ['=CONCATENATE(LineItems!D8," (",LineItems!A8," hrs @ $",LineItems!C8,"/hr)")', '', '', '', '=LineItems!B8'],
        ['', '', '', '', ''],
        ['', '', '', 'Subtotal', '=SUM(E24:E30)'],
        ['', '', '', '', ''],
        ['', '', '', 'GST (15%)', '=E32*0.15'],
        ['', '', '', '', ''],
        ['', '', '', 'Total', '=E32+E34'],
      ],
    },
  });

  // 5. Format the sheet
  const quoteSheetId = spreadsheet.data.sheets[0].properties.sheetId;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // Bold header row
        { repeatCell: { range: { sheetId: quoteSheetId, startRowIndex: 1, endRowIndex: 4 }, cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 12 } } }, fields: 'userEnteredFormat.textFormat' } },
        // Bold totals
        { repeatCell: { range: { sheetId: quoteSheetId, startRowIndex: 31, endRowIndex: 36, startColumnIndex: 3, endColumnIndex: 5 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat' } },
        // Currency format for cost column
        { repeatCell: { range: { sheetId: quoteSheetId, startRowIndex: 23, endRowIndex: 36, startColumnIndex: 4, endColumnIndex: 5 }, cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } } }, fields: 'userEnteredFormat.numberFormat' } },
        // Column widths
        { updateDimensionProperties: { range: { sheetId: quoteSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 350 }, fields: 'pixelSize' } },
        { updateDimensionProperties: { range: { sheetId: quoteSheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 100 }, fields: 'pixelSize' } },
      ],
    },
  });

  // 6. Populate Price Catalog
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Price Catalog'!A1:C15",
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['Item', 'Unit Price', 'Category'],
        ['FOH System', 500, 'system'],
        ['Monitor Wedge', 75, 'monitors'],
        ['Microphone (SM58)', 25, 'microphones'],
        ['Microphone (SM57)', 25, 'microphones'],
        ['Wireless Handheld', 75, 'microphones'],
        ['DI Box', 15, 'microphones'],
        ['Console (Small)', 300, 'console'],
        ['Console (Medium)', 400, 'console'],
        ['Console (Large)', 600, 'console'],
        ['Cables & Accessories', 250, 'cables'],
        ['Vehicle', 100, 'vehicle'],
        ['Tech Time (per hour)', 60, 'labour'],
      ],
    },
  });

  console.log('\n✅ Template created successfully!');
  console.log(`\nSpreadsheet URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
  console.log(`\nAdd this to your .env:`);
  console.log(`GOOGLE_FULLSYSTEM_QUOTE_TEMPLATE_ID=${spreadsheetId}`);
}

createQuoteTemplate().catch(console.error);
