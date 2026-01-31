// Run with: node scripts/update-google-templates.js
// Updates existing Quote and Jobsheet templates with field name changes
// Prerequisites: Templates must already exist (run create-google-templates.js first)

require('dotenv').config({ path: '.env' });
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

// Template IDs from .env
const TEMPLATES = {
  jobsheet: {
    fullsystem: process.env.GOOGLE_FULLSYSTEM_JOBSHEET_TEMPLATE_ID,
    backline: process.env.GOOGLE_BACKLINE_JOBSHEET_TEMPLATE_ID,
    soundtech: process.env.GOOGLE_SOUNDTECH_JOBSHEET_TEMPLATE_ID,
  },
  quote: {
    fullsystem: process.env.GOOGLE_FULLSYSTEM_QUOTE_TEMPLATE_ID,
    backline: process.env.GOOGLE_BACKLINE_QUOTE_TEMPLATE_ID,
    soundtech: process.env.GOOGLE_SOUNDTECH_QUOTE_TEMPLATE_ID,
  },
};

const FOLDER_LABELS = {
  fullsystem: 'Full System',
  backline: 'Backline',
  soundtech: 'Sound Tech',
};

// ============================================
// JOBSHEET TIMING FIELD UPDATES
// ============================================
// Row 9: room_available_from -> site_available_from
// Row 15: pack_down_time -> site_vacate_time

async function updateJobsheetTimingFields(spreadsheetId, folderType) {
  const label = FOLDER_LABELS[folderType];
  console.log(`Updating Jobsheet Template - ${label}...`);

  if (!spreadsheetId) {
    console.log(`  SKIPPED: No template ID found for ${folderType}`);
    return false;
  }

  try {
    // Read current values to verify structure
    const { data: currentValues } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'Event Data'!A1:B15",
    });

    const rows = currentValues.values || [];
    console.log(`  Current row 9: ${rows[8]?.[0] || 'empty'}`);
    console.log(`  Current row 15: ${rows[14]?.[0] || 'empty'}`);

    // Update row 9: room_available_from -> site_available_from
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "'Event Data'!A9",
      valueInputOption: 'RAW',
      requestBody: {
        values: [['site_available_from']],
      },
    });

    // Update row 15: pack_down_time -> site_vacate_time
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "'Event Data'!A15",
      valueInputOption: 'RAW',
      requestBody: {
        values: [['site_vacate_time']],
      },
    });

    console.log(`  Updated: site_available_from (row 9), site_vacate_time (row 15)`);
    return true;
  } catch (error) {
    console.error(`  ERROR updating ${label}:`, error.message);
    return false;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('='.repeat(60));
  console.log('UPDATE GOOGLE SHEETS TEMPLATES');
  console.log('='.repeat(60) + '\n');

  console.log('This script updates existing templates with:');
  console.log('  - Jobsheet: room_available_from -> site_available_from');
  console.log('  - Jobsheet: pack_down_time -> site_vacate_time\n');

  const results = {
    success: [],
    skipped: [],
    failed: [],
  };

  // Update Jobsheet templates
  console.log('\n--- JOBSHEET TEMPLATES ---\n');
  for (const [folderType, templateId] of Object.entries(TEMPLATES.jobsheet)) {
    if (!templateId) {
      results.skipped.push(`Jobsheet ${folderType}`);
      console.log(`Jobsheet ${FOLDER_LABELS[folderType]}: SKIPPED (no template ID)`);
      continue;
    }

    const success = await updateJobsheetTimingFields(templateId, folderType);
    if (success) {
      results.success.push(`Jobsheet ${folderType}`);
    } else {
      results.failed.push(`Jobsheet ${folderType}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Success: ${results.success.length}`);
  results.success.forEach(t => console.log(`  - ${t}`));
  console.log(`Skipped: ${results.skipped.length}`);
  results.skipped.forEach(t => console.log(`  - ${t}`));
  console.log(`Failed: ${results.failed.length}`);
  results.failed.forEach(t => console.log(`  - ${t}`));

  if (results.success.length > 0) {
    console.log('\nNOTE: Templates updated. New inquiries will use new field names.');
    console.log('Existing job sheets in Google Drive are not affected.');
  }
}

main().catch(console.error);
