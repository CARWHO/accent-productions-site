import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSupabaseAdmin } from '@/lib/supabase';

const MASTER_SHEET_ID = process.env.GOOGLE_MASTER_EQUIPMENT_SHEET_ID;

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not set - allowing request');
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

async function getGoogleSheetsClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.sheets({ version: 'v4', auth: oauth2Client });
}

export async function GET(request: Request) {
  try {
    // Verify authorization
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    if (!MASTER_SHEET_ID) {
      return NextResponse.json({ error: 'GOOGLE_MASTER_EQUIPMENT_SHEET_ID not set' }, { status: 500 });
    }

    console.log('Starting equipment sync from Google Sheet...');

    // Read data from Google Sheet
    const sheets = await getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: MASTER_SHEET_ID,
      range: 'Equipment!A2:F500',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const rows = response.data.values || [];
    console.log(`Read ${rows.length} rows from Google Sheet`);

    // Parse rows into equipment objects
    // Expected columns: Category, Name, Daily Rate, Stock, Notes, Type
    const sheetItems = rows
      .filter(row => row[1]) // Must have a name (column B)
      .map(row => ({
        category: String(row[0] || 'Uncategorized').trim(),
        name: String(row[1]).trim(),
        hire_rate_per_day: Number(row[2]) || 0,
        stock_quantity: Number(row[3]) || 1,
        notes: row[4] ? String(row[4]).trim() : null,
        type: row[5] ? String(row[5]).trim().toLowerCase() : 'audio',
        available: true,
        updated_at: new Date().toISOString(),
      }));

    console.log(`Parsed ${sheetItems.length} valid equipment items`);

    if (sheetItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items to sync',
        synced: 0
      });
    }

    // Get all names from sheet for deletion comparison
    const sheetNames = sheetItems.map(item => item.name);

    // Delete items NOT in sheet (full sync)
    const { error: deleteError, count: deleteCount } = await supabase
      .from('equipment')
      .delete({ count: 'exact' })
      .not('name', 'in', `(${sheetNames.map(n => `"${n.replace(/"/g, '\\"')}"`).join(',')})`);

    if (deleteError) {
      console.error('Error deleting removed items:', deleteError);
    } else {
      console.log(`Deleted ${deleteCount || 0} items not in sheet`);
    }

    // Upsert all items from sheet
    const { error: upsertError } = await supabase
      .from('equipment')
      .upsert(sheetItems, {
        onConflict: 'name',
        ignoreDuplicates: false
      });

    if (upsertError) {
      console.error('Error upserting equipment:', upsertError);
      return NextResponse.json({
        error: 'Failed to sync equipment',
        details: upsertError.message
      }, { status: 500 });
    }

    console.log(`Successfully synced ${sheetItems.length} equipment items`);

    return NextResponse.json({
      success: true,
      message: 'Equipment synced from Google Sheet',
      synced: sheetItems.length,
      deleted: deleteCount || 0,
    });

  } catch (error) {
    console.error('Error in equipment sync cron:', error);
    return NextResponse.json({
      error: 'Sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
