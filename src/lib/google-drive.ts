import { google } from 'googleapis';
import { Readable } from 'stream';

export type QuoteFolderType = 'backline' | 'fullsystem' | 'soundtech';

const folderEnvKeys: Record<QuoteFolderType, string> = {
  backline: 'GOOGLE_DRIVE_BACKLINE_QUOTES_FOLDER_ID',
  fullsystem: 'GOOGLE_DRIVE_FULL_SYSTEM_QUOTES_FOLDER_ID',
  soundtech: 'GOOGLE_DRIVE_SOUND_TECH_QUOTES_FOLDER_ID',
};

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

export async function uploadQuoteToDrive(
  pdfBuffer: Buffer,
  filename: string,
  folderType: QuoteFolderType
): Promise<string | null> {
  try {
    const folderId = process.env[folderEnvKeys[folderType]];
    const oauth2Client = getOAuth2Client();

    if (!folderId || !oauth2Client) {
      console.warn(`Google Drive not configured for ${folderType}, skipping upload`);
      return null;
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(pdfBuffer),
      },
    });

    console.log(`Uploaded ${filename} to Google Drive ${folderType} folder (ID: ${response.data.id})`);
    return response.data.id || null;
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    return null;
  }
}

/**
 * Share a file so anyone with the link can view it
 * Returns the shareable link or null if failed
 */
export async function shareFileWithLink(fileId: string): Promise<string | null> {
  try {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) {
      console.warn('Google Drive not configured');
      return null;
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Create a permission for anyone with the link to view
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Return the shareable link
    const link = `https://drive.google.com/file/d/${fileId}/view`;
    console.log(`Shared file ${fileId}: ${link}`);
    return link;
  } catch (error) {
    console.error('Error sharing file:', error);
    return null;
  }
}
