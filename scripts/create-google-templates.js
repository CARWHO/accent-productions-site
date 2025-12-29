// Run with: node scripts/create-google-templates.js
// Creates ALL Quote and Jobsheet templates in Google Drive

require('dotenv').config({ path: '.env' });
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

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
        { properties: { title: 'Quote', index: 0 } },
        { properties: { title: 'Data', index: 1 } },
        { properties: { title: 'LineItems', index: 2 } },
        { properties: { title: 'Price Catalog', index: 3, hidden: true } },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;

  // Data tab
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

  // LineItems tab
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

  // Quote tab with formulas
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

  // Format
  const quoteSheetId = spreadsheet.data.sheets[0].properties.sheetId;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { repeatCell: { range: { sheetId: quoteSheetId, startRowIndex: 1, endRowIndex: 4 }, cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 12 } } }, fields: 'userEnteredFormat.textFormat' } },
        { repeatCell: { range: { sheetId: quoteSheetId, startRowIndex: 31, endRowIndex: 36, startColumnIndex: 3, endColumnIndex: 5 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat' } },
        { repeatCell: { range: { sheetId: quoteSheetId, startRowIndex: 23, endRowIndex: 36, startColumnIndex: 4, endColumnIndex: 5 }, cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } } }, fields: 'userEnteredFormat.numberFormat' } },
        { updateDimensionProperties: { range: { sheetId: quoteSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 350 }, fields: 'pixelSize' } },
        { updateDimensionProperties: { range: { sheetId: quoteSheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 100 }, fields: 'pixelSize' } },
      ],
    },
  });

  // Price Catalog
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Price Catalog'!A1:C13",
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['Item', 'Unit Price', 'Category'],
        ['FOH System', 500, 'system'],
        ['Monitor Wedge', 75, 'monitors'],
        ['Microphone (SM58)', 25, 'microphones'],
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
        { properties: { title: 'Job Sheet', index: 0 } },
        { properties: { title: 'Event Data', index: 1 } },
        { properties: { title: 'Equipment', index: 2 } },
        { properties: { title: 'Crew', index: 3 } },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;

  // Event Data tab
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Event Data'!A1:B14",
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['quote_number', '2025-XXXX'],
        ['event_name', 'Event Name'],
        ['event_date', '01 Jan 2025'],
        ['event_time', '18:00'],
        ['location', 'Venue Address'],
        ['client_name', 'Client Name'],
        ['client_email', 'client@example.com'],
        ['client_phone', '027 XXX XXXX'],
        ['load_in_time', '14:00'],
        ['sound_check_time', '16:00'],
        ['doors_time', '17:30'],
        ['set_time', '18:00'],
        ['finish_time', '23:00'],
        ['pack_down_time', '23:30'],
      ],
    },
  });

  // Equipment tab
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Equipment!A1:C7',
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['Item', 'Quantity', 'Notes'],
        ['FOH System', 1, ''],
        ['Monitor Wedge', 6, ''],
        ['Microphone (SM58)', 4, ''],
        ['Console', 1, 'Medium'],
        ['DI Box', 2, ''],
        ['Cables & Accessories', 1, ''],
      ],
    },
  });

  // Crew tab
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Crew!A1:E3',
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['Role', 'Name', 'Phone', 'Email', 'Notes'],
        ['Sound Tech', '', '', '', 'Lead tech'],
        ['Assistant', '', '', '', 'If required'],
      ],
    },
  });

  // Job Sheet tab with formulas
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Job Sheet'!A1:D35",
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        ['JOB SHEET', '', '', ''],
        ['Accent Entertainment', '', '', ''],
        ['', '', '', ''],
        ['="Quote: "&\'Event Data\'!B1', '', '="Event: "&\'Event Data\'!B2', ''],
        ['', '', '', ''],
        ['EVENT DETAILS', '', '', ''],
        ['Location:', '=\'Event Data\'!B5', '', ''],
        ['Date:', '=\'Event Data\'!B3', '', ''],
        ['', '', '', ''],
        ['SCHEDULE', '', '', ''],
        ['Load In:', '=\'Event Data\'!B9', '', ''],
        ['Sound Check:', '=\'Event Data\'!B10', '', ''],
        ['Doors:', '=\'Event Data\'!B11', '', ''],
        ['Set Time:', '=\'Event Data\'!B12', '', ''],
        ['Finish:', '=\'Event Data\'!B13', '', ''],
        ['Pack Down:', '=\'Event Data\'!B14', '', ''],
        ['', '', '', ''],
        ['CLIENT CONTACT', '', '', ''],
        ['Name:', '=\'Event Data\'!B6', '', ''],
        ['Phone:', '=\'Event Data\'!B8', '', ''],
        ['Email:', '=\'Event Data\'!B7', '', ''],
        ['', '', '', ''],
        ['EQUIPMENT', '', '', ''],
        ['Item', 'Qty', 'Notes', ''],
        ['=Equipment!A2', '=Equipment!B2', '=Equipment!C2', ''],
        ['=Equipment!A3', '=Equipment!B3', '=Equipment!C3', ''],
        ['=Equipment!A4', '=Equipment!B4', '=Equipment!C4', ''],
        ['=Equipment!A5', '=Equipment!B5', '=Equipment!C5', ''],
        ['=Equipment!A6', '=Equipment!B6', '=Equipment!C6', ''],
        ['=Equipment!A7', '=Equipment!B7', '=Equipment!C7', ''],
        ['', '', '', ''],
        ['CREW', '', '', ''],
        ['Role', 'Name', 'Phone', ''],
        ['=Crew!A2', '=Crew!B2', '=Crew!C2', ''],
        ['=Crew!A3', '=Crew!B3', '=Crew!C3', ''],
      ],
    },
  });

  // Format
  const jobSheetId = spreadsheet.data.sheets[0].properties.sheetId;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { repeatCell: { range: { sheetId: jobSheetId, startRowIndex: 0, endRowIndex: 2 }, cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 } } }, fields: 'userEnteredFormat.textFormat' } },
        { repeatCell: { range: { sheetId: jobSheetId, startRowIndex: 5, endRowIndex: 6 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat' } },
        { repeatCell: { range: { sheetId: jobSheetId, startRowIndex: 9, endRowIndex: 10 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat' } },
        { repeatCell: { range: { sheetId: jobSheetId, startRowIndex: 17, endRowIndex: 18 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat' } },
        { repeatCell: { range: { sheetId: jobSheetId, startRowIndex: 22, endRowIndex: 23 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat' } },
        { repeatCell: { range: { sheetId: jobSheetId, startRowIndex: 31, endRowIndex: 32 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat' } },
        { updateDimensionProperties: { range: { sheetId: jobSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 150 }, fields: 'pixelSize' } },
        { updateDimensionProperties: { range: { sheetId: jobSheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 200 }, fields: 'pixelSize' } },
      ],
    },
  });

  console.log(`  ✅ Created: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
  return spreadsheetId;
}

async function main() {
  console.log('🚀 Creating all Google Sheets templates...\n');

  const results = {
    quote: {},
    jobsheet: {},
  };

  for (const folderType of FOLDER_TYPES) {
    results.quote[folderType] = await createQuoteTemplate(folderType);
    results.jobsheet[folderType] = await createJobsheetTemplate(folderType);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL TEMPLATES CREATED!\n');
  console.log('Add these to your .env.local:\n');
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
}

main().catch(console.error);
