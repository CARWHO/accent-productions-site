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

    // 2. Populate the Data tab with quote info
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Data!A1:B10',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          ['quote_number', quoteData.quoteNumber],
          ['issued_date', quoteData.issuedDate],
          ['client_name', quoteData.clientName],
          ['client_email', quoteData.clientEmail],
          ['client_phone', quoteData.clientPhone],
          ['client_address', quoteData.clientAddress || 'N/A'],
          ['event_name', quoteData.eventName],
          ['event_date', quoteData.eventDate],
          ['event_location', quoteData.eventLocation],
        ],
      },
    });

    // 3. Populate line items on LineItems tab
    if (lineItems.length > 0) {
      const lineItemValues = lineItems.map(item => [
        item.quantity || 1,
        item.cost,
        '', // Rate column (for tech time)
        item.description,
      ]);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'LineItems!A2:D' + (1 + lineItems.length),
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
  lineItems: { quantity: number; cost: number; rate: string; description: string }[];
  subtotal: number;
  gst: number;
  total: number;
}

/**
 * Read data from a quote Google Sheet (for PDF generation)
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

    // Read Data tab
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

    // Read LineItems tab
    const lineItemsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'LineItems!A2:D100',
    });

    const lineItemRows = lineItemsResponse.data.values || [];
    const lineItems = lineItemRows
      .filter(row => row[0] || row[1] || row[3]) // Has quantity, cost, or description
      .map(row => ({
        quantity: Number(row[0]) || 1,
        cost: Number(row[1]) || 0,
        rate: String(row[2] || ''),
        description: String(row[3] || ''),
      }));

    // Calculate totals from line items
    const subtotal = lineItems.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    const gst = subtotal * 0.15;
    const total = subtotal + gst;

    return {
      quoteNumber: dataMap['quote_number'] || '',
      issuedDate: dataMap['issued_date'] || '',
      clientName: dataMap['client_name'] || '',
      clientEmail: dataMap['client_email'] || '',
      clientPhone: dataMap['client_phone'] || '',
      clientAddress: dataMap['client_address'] || '',
      eventName: dataMap['event_name'] || '',
      eventDate: dataMap['event_date'] || '',
      eventLocation: dataMap['event_location'] || '',
      lineItems,
      subtotal,
      gst,
      total,
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

    // Clear existing line items first (rows 15-50, adjust range as needed)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Quote!A15:B50',
    });

    // Write new line items
    if (lineItems.length > 0) {
      const lineItemValues = lineItems.map(item => [
        item.description,
        item.cost,
      ]);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Quote!A15:B' + (14 + lineItems.length),
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

/**
 * Create a job sheet from template
 */
export async function createJobSheet(
  folderType: FolderType,
  eventData: {
    quoteNumber: string;
    eventName: string;
    eventDate: string;
    eventTime: string;
    location: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
  },
  equipment: Array<{ item: string; quantity: number; notes?: string }>
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

    // 2. Populate event data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Event Data!A1:B10',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          ['quote_number', eventData.quoteNumber],
          ['event_name', eventData.eventName],
          ['event_date', eventData.eventDate],
          ['event_time', eventData.eventTime],
          ['location', eventData.location],
          ['client_name', eventData.clientName],
          ['client_email', eventData.clientEmail],
          ['client_phone', eventData.clientPhone],
        ],
      },
    });

    // 3. Populate equipment list
    if (equipment.length > 0) {
      const equipmentValues = equipment.map(item => [
        item.item,
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

    // 4. Share with anyone who has the link
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
