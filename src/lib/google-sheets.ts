import { google } from 'googleapis';
import type { FolderType } from './google-drive';

const templateEnvKeys = {
  quote: {
    backline: 'GOOGLE_BACKLINE_QUOTE_TEMPLATE_ID',
    fullsystem: 'GOOGLE_FULLSYSTEM_QUOTE_TEMPLATE_ID',
    soundtech: 'GOOGLE_SOUNDTECH_QUOTE_TEMPLATE_ID',
  },
  jobsheet: {
    backline: 'GOOGLE_BACKLINE_JOBSHEET_TEMPLATE_ID',
    fullsystem: 'GOOGLE_FULLSYSTEM_JOBSHEET_TEMPLATE_ID',
    soundtech: 'GOOGLE_SOUNDTECH_JOBSHEET_TEMPLATE_ID',
  },
} as const;

const folderEnvKeys = {
  quote: {
    backline: 'GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID',
    fullsystem: 'GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID',
    soundtech: 'GOOGLE_DRIVE_SOUND_TECH_QUOTES_FOLDER_ID',
  },
  jobsheet: {
    backline: 'GOOGLE_DRIVE_BACKLINE_JOBSHEET_FOLDER_ID',
    fullsystem: 'GOOGLE_DRIVE_FULL_SYSTEM_JOBSHEET_FOLDER_ID',
    soundtech: 'GOOGLE_DRIVE_SOUND_TECH_JOBSHEET_FOLDER_ID',
  },
} as const;

function extractId(input: string): string {
  if (input.includes('drive.google.com') || input.includes('/d/') || input.includes('/folders/')) {
    const match = input.match(/(?:folders|d)\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
  }
  return input.split('?')[0];
}

/**
 * Convert Excel serial date to formatted date string
 * Excel serial dates count days since 1900-01-01 (with a bug for 1900 leap year)
 */
function excelSerialToDate(serial: string | number): string {
  const num = typeof serial === 'string' ? parseFloat(serial) : serial;

  // If it's not a valid number or already looks like a date string, return as-is
  if (isNaN(num) || num < 1000 || num > 100000) {
    return String(serial);
  }

  // Excel epoch is 1900-01-01, but Excel has a bug treating 1900 as leap year
  // So we subtract 2 days (1 for the bug, 1 because Excel starts at 1 not 0)
  const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
  const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);

  return date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function getOAuth2Client() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  return oauth2Client;
}

export interface QuoteData {
  quoteNumber: string;
  issuedDate: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress?: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
}

export interface LineItem {
  gearName: string;      // Equipment name (for VLOOKUP)
  quantity: number;      // Qty
  days: number;          // Rental days
  // Note: unitRate, day2Rate, lineTotal are calculated by sheet formulas
}

// Legacy format for backward compatibility
export interface LegacyLineItem {
  description: string;
  cost: number;
  quantity?: number;
}

export interface CreateQuoteSheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

/**
 * Copy a template spreadsheet and populate it with quote data
 *
 * NEW STRUCTURE (2024):
 * - Data tab: Key-value pairs for metadata
 * - LineItems tab: A=Gear Name, B=Qty, C=Days, D-F=Formulas (auto-calc from Master Sheet)
 * - Totals tab: Formulas for subtotal/gst/total
 */
export async function createQuoteSheet(
  folderType: FolderType,
  quoteData: QuoteData,
  lineItems: LineItem[]
): Promise<CreateQuoteSheetResult | null> {
  try {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) {
      console.warn('Google not configured');
      return null;
    }

    const templateId = process.env[templateEnvKeys.quote[folderType]];
    const folderId = process.env[folderEnvKeys.quote[folderType]];

    if (!templateId || !folderId) {
      console.warn(`Quote template or folder not configured for ${folderType}`);
      return null;
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // 1. Copy the template
    const copyResponse = await drive.files.copy({
      fileId: extractId(templateId),
      requestBody: {
        name: `Quote-${quoteData.quoteNumber}`,
        parents: [extractId(folderId)],
      },
    });

    const spreadsheetId = copyResponse.data.id!;
    console.log(`Created quote sheet: ${spreadsheetId}`);

    // 2. Populate the Data tab with quote info (B column only - A has keys)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Data!B1:B9',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [quoteData.quoteNumber],
          [quoteData.issuedDate],
          [quoteData.clientName],
          [quoteData.clientEmail],
          [quoteData.clientPhone],
          [quoteData.clientAddress || ''],
          [quoteData.eventName],
          [quoteData.eventDate],
          [quoteData.eventLocation],
        ],
      },
    });

    // 3. Populate line items on LineItems tab (Gear Name, Qty, Days only)
    // Columns D-F have formulas that auto-calculate pricing from Master Sheet
    if (lineItems.length > 0) {
      const lineItemValues = lineItems.map(item => [
        item.gearName,      // A: Gear Name (triggers VLOOKUP for pricing)
        item.quantity,      // B: Qty
        item.days,          // C: Days
      ]);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'LineItems!A2:C' + (1 + lineItems.length),
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: lineItemValues,
        },
      });
    }

    // 4. Share with anyone who has the link (view only)
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  } catch (error) {
    console.error('Error creating quote sheet:', error);
    return null;
  }
}

export interface QuoteSheetData {
  quoteNumber: string;
  issuedDate: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  lineItems: {
    gearName: string;
    quantity: number;
    days: number;
    unitRate: number;
    lineTotal: number;
  }[];
  subtotal: number;
  gst: number;
  total: number;
}

/**
 * Read data from a quote Google Sheet (for PDF generation)
 *
 * NEW STRUCTURE (2024):
 * - Data tab: A=key, B=value
 * - LineItems tab: A=Gear Name, B=Qty, C=Days, D=Unit Rate, E=Day2+ Rate, F=Line Total
 * - Totals tab: A=key (subtotal, gst, total), B=value (formulas)
 */
export async function readQuoteSheetData(
  spreadsheetId: string
): Promise<QuoteSheetData | null> {
  try {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) {
      console.warn('Google not configured');
      return null;
    }

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Read Data tab (key-value pairs)
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Data!A1:B20',
    });

    const dataRows = dataResponse.data.values || [];
    const dataMap: Record<string, string> = {};
    for (const row of dataRows) {
      if (row[0] && row[1] !== undefined) {
        dataMap[row[0]] = String(row[1]);
      }
    }

    // Read LineItems tab (A=Gear Name, B=Qty, C=Days, D=Unit Rate, E=Day2+ Rate, F=Line Total)
    const lineItemsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'LineItems!A2:F100',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const lineItemRows = lineItemsResponse.data.values || [];
    const lineItems = lineItemRows
      .filter(row => row[0]) // Has gear name
      .map(row => ({
        gearName: String(row[0] || ''),
        quantity: Number(row[1]) || 1,
        days: Number(row[2]) || 1,
        unitRate: Number(row[3]) || 0,
        lineTotal: Number(row[5]) || 0, // Column F (index 5)
      }));

    // Read Totals tab (subtotal, gst, total are in B column)
    const totalsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Totals!A1:B4',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const totalsRows = totalsResponse.data.values || [];
    const totalsMap: Record<string, number> = {};
    for (const row of totalsRows) {
      if (row[0] && row[1] !== undefined) {
        totalsMap[row[0]] = Number(row[1]) || 0;
      }
    }

    return {
      quoteNumber: dataMap['quote_number'] || '',
      issuedDate: excelSerialToDate(dataMap['issued_date'] || ''),
      clientName: dataMap['client_name'] || '',
      clientEmail: dataMap['client_email'] || '',
      clientPhone: dataMap['client_phone'] || '',
      clientAddress: dataMap['client_address'] || '',
      eventName: dataMap['event_name'] || '',
      eventDate: excelSerialToDate(dataMap['event_date'] || ''),
      eventLocation: dataMap['event_location'] || '',
      lineItems,
      subtotal: totalsMap['subtotal'] || 0,
      gst: totalsMap['gst'] || 0,
      total: totalsMap['total'] || 0,
    };
  } catch (error) {
    console.error('Error reading quote sheet:', error);
    return null;
  }
}

/**
 * Export a Google Sheet tab as PDF
 */
export async function exportSheetAsPdf(
  spreadsheetId: string,
  sheetGid?: number // Optional: specific tab GID. If omitted, exports first tab
): Promise<Buffer | null> {
  try {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) {
      console.warn('Google not configured');
      return null;
    }

    // Force token refresh
    await oauth2Client.getAccessToken();
    const token = oauth2Client.credentials.access_token;

    // Build PDF export URL
    // See: https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/get#exportformat
    let exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=pdf`;
    exportUrl += '&portrait=true';
    exportUrl += '&fitw=true'; // Fit to width
    exportUrl += '&gridlines=false';
    exportUrl += '&printtitle=false';
    exportUrl += '&sheetnames=false';
    exportUrl += '&pagenum=false';
    exportUrl += '&fzr=false'; // Don't repeat frozen rows

    if (sheetGid !== undefined) {
      exportUrl += `&gid=${sheetGid}`;
    }

    const response = await fetch(exportUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`PDF export failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error exporting sheet as PDF:', error);
    return null;
  }
}

/**
 * Get the URL to edit a spreadsheet directly
 */
export function getSheetEditUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

/**
 * Update line items in an existing quote sheet
 *
 * NEW STRUCTURE: Updates LineItems tab with Gear Name, Qty, Days
 * (pricing formulas auto-calculate from columns D-F)
 */
export async function updateQuoteLineItems(
  spreadsheetId: string,
  lineItems: LineItem[]
): Promise<boolean> {
  try {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) {
      console.warn('Google not configured');
      return false;
    }

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Clear existing line items (rows 2-51 to preserve header and formulas structure)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'LineItems!A2:C51',
    });

    // Write new line items (Gear Name, Qty, Days only)
    if (lineItems.length > 0) {
      const lineItemValues = lineItems.map(item => [
        item.gearName,
        item.quantity,
        item.days,
      ]);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'LineItems!A2:C' + (1 + lineItems.length),
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: lineItemValues,
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Error updating quote line items:', error);
    return false;
  }
}

export interface JobSheetEventData {
  quoteNumber: string;
  eventName: string;
  eventDate: string;
  eventTime?: string;
  location: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  loadInTime?: string;
  soundCheckTime?: string;
  doorsTime?: string;
  setTime?: string;
  finishTime?: string;
  packDownTime?: string;
}

export interface JobSheetEquipment {
  gearName: string;
  quantity: number;
  notes?: string;
}

export interface JobSheetCrew {
  role: string;
  name?: string;
  phone?: string;
  rate?: number;
  hours?: number;
}

/**
 * Create a job sheet from template
 *
 * NEW STRUCTURE (2024):
 * - Event Data tab: Key-value pairs (B column only - A has keys)
 * - Equipment tab: A=Gear Name, B=Qty, C=Notes
 * - Crew tab: A=Role, B=Name, C=Phone, D=Rate, E=Hours, F=Pay (formula)
 */
export async function createJobSheet(
  folderType: FolderType,
  eventData: JobSheetEventData,
  equipment: JobSheetEquipment[],
  crew?: JobSheetCrew[]
): Promise<CreateQuoteSheetResult | null> {
  try {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) {
      console.warn('Google not configured');
      return null;
    }

    const templateId = process.env[templateEnvKeys.jobsheet[folderType]];
    const folderId = process.env[folderEnvKeys.jobsheet[folderType]];

    if (!templateId || !folderId) {
      console.warn(`Jobsheet template or folder not configured for ${folderType}`);
      return null;
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // 1. Copy the template
    const copyResponse = await drive.files.copy({
      fileId: extractId(templateId),
      requestBody: {
        name: `JobSheet-${eventData.quoteNumber}`,
        parents: [extractId(folderId)],
      },
    });

    const spreadsheetId = copyResponse.data.id!;
    console.log(`Created job sheet: ${spreadsheetId}`);

    // 2. Populate Event Data tab (B column only - A has keys)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "'Event Data'!B1:B14",
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [eventData.quoteNumber],
          [eventData.eventName],
          [eventData.eventDate],
          [eventData.eventTime || ''],
          [eventData.location],
          [eventData.clientName],
          [eventData.clientEmail],
          [eventData.clientPhone],
          [eventData.loadInTime || ''],
          [eventData.soundCheckTime || ''],
          [eventData.doorsTime || ''],
          [eventData.setTime || ''],
          [eventData.finishTime || ''],
          [eventData.packDownTime || ''],
        ],
      },
    });

    // 3. Populate Equipment tab (Gear Name, Qty, Notes)
    if (equipment.length > 0) {
      const equipmentValues = equipment.map(item => [
        item.gearName,
        item.quantity,
        item.notes || '',
      ]);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Equipment!A2:C' + (1 + equipment.length),
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: equipmentValues,
        },
      });
    }

    // 4. Populate Crew tab if provided (Role, Name, Phone, Rate, Hours)
    // Pay column (F) has formula that auto-calculates
    if (crew && crew.length > 0) {
      const crewValues = crew.map(member => [
        member.role,
        member.name || '',
        member.phone || '',
        member.rate || '',
        member.hours || '',
      ]);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Crew!A2:E' + (1 + crew.length),
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: crewValues,
        },
      });
    }

    // 5. Share with anyone who has the link
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  } catch (error) {
    console.error('Error creating job sheet:', error);
    return null;
  }
}
