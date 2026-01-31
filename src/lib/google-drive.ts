import { google } from 'googleapis';
import { Readable } from 'stream';

export type FolderType = 'backline' | 'fullsystem' | 'soundtech';

const jobSheetFolderEnvKeys: Record<FolderType, string> = {
  backline: 'GOOGLE_DRIVE_BACKLINE_JOBSHEET_FOLDER_ID',
  fullsystem: 'GOOGLE_DRIVE_FULL_SYSTEM_JOBSHEET_FOLDER_ID',
  soundtech: 'GOOGLE_DRIVE_SOUND_TECH_JOBSHEET_FOLDER_ID',
};

/**
 * Extract folder ID from a Google Drive URL or return as-is if already an ID
 * Handles URLs like: https://drive.google.com/drive/folders/ABC123?usp=sharing
 */
function extractFolderId(input: string): string {
  // If it looks like a URL, extract the folder ID
  if (input.includes('drive.google.com') || input.includes('/folders/')) {
    const match = input.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
  }
  // Remove any query params if present (e.g., ?usp=sharing)
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

/**
 * Upload a Job Sheet PDF to the appropriate job sheets folder
 */
export async function uploadJobSheetToDrive(
  pdfBuffer: Buffer,
  filename: string,
  folderType: FolderType
): Promise<string | null> {
  try {
    const rawFolderId = process.env[jobSheetFolderEnvKeys[folderType]];
    const folderId = rawFolderId ? extractFolderId(rawFolderId) : null;
    const oauth2Client = getOAuth2Client();

    if (!folderId || !oauth2Client) {
      console.warn(`Google Drive not configured for ${folderType} job sheets, skipping upload`);
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

    console.log(`Uploaded Job Sheet ${filename} to Google Drive ${folderType} folder (ID: ${response.data.id})`);
    return response.data.id || null;
  } catch (error) {
    console.error('Error uploading Job Sheet to Google Drive:', error);
    return null;
  }
}

/**
 * Copy a file in Google Drive
 * Returns the new file ID or null if failed
 */
export async function copyFile(fileId: string, newName: string): Promise<string | null> {
  try {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) {
      console.warn('Google Drive not configured');
      return null;
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.copy({
      fileId,
      requestBody: {
        name: newName,
      },
    });

    console.log(`Copied file ${fileId} to new file ${response.data.id} with name "${newName}"`);
    return response.data.id || null;
  } catch (error) {
    console.error('Error copying file in Google Drive:', error);
    return null;
  }
}

/**
 * Delete a file from Google Drive
 * Returns true if successful, false if failed
 */
export async function deleteFile(fileId: string): Promise<boolean> {
  try {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) {
      console.warn('Google Drive not configured');
      return false;
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    await drive.files.delete({ fileId });
    console.log(`Deleted file ${fileId} from Google Drive`);
    return true;
  } catch (error) {
    console.error('Error deleting file from Google Drive:', error);
    return false;
  }
}

/**
 * Upload a Tech Rider to the shared tech riders folder
 * Uses GOOGLE_DRIVE_TECH_RIDERS_FOLDER_ID env var
 * Returns the file ID or null if failed
 */
export async function uploadTechRiderToSharedFolder(
  fileBuffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<string | null> {
  try {
    const rawFolderId = process.env.GOOGLE_DRIVE_TECH_RIDERS_FOLDER_ID;
    const folderId = rawFolderId ? extractFolderId(rawFolderId) : null;
    const oauth2Client = getOAuth2Client();

    if (!folderId || !oauth2Client) {
      console.warn('Google Drive tech riders folder not configured, skipping upload');
      return null;
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Determine mime type based on file extension if not provided
    let fileMimeType = mimeType || 'application/pdf';
    if (!mimeType) {
      const lowerFilename = filename.toLowerCase();
      if (lowerFilename.endsWith('.docx')) {
        fileMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (lowerFilename.endsWith('.doc')) {
        fileMimeType = 'application/msword';
      } else if (lowerFilename.endsWith('.png')) {
        fileMimeType = 'image/png';
      } else if (lowerFilename.endsWith('.jpg') || lowerFilename.endsWith('.jpeg')) {
        fileMimeType = 'image/jpeg';
      }
    }

    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType: fileMimeType,
        body: Readable.from(fileBuffer),
      },
    });

    const fileId = response.data.id || null;
    if (fileId) {
      console.log(`Uploaded Tech Rider ${filename} to Google Drive (ID: ${fileId})`);
      // Make the file publicly viewable
      await shareFileWithLink(fileId);
    }
    return fileId;
  } catch (error) {
    console.error('Error uploading Tech Rider to Google Drive:', error);
    return null;
  }
}
