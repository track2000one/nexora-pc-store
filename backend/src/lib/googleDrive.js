import { Readable } from 'node:stream';
import path from 'node:path';
import { google } from 'googleapis';

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    const error = new Error(`${name} is not configured on the server.`);
    error.code = 'GOOGLE_DRIVE_NOT_CONFIGURED';
    throw error;
  }
  return value;
}

function driveClient() {
  const clientId = requiredEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requiredEnv('GOOGLE_CLIENT_SECRET');
  const refreshToken = requiredEnv('GOOGLE_REFRESH_TOKEN');

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: 'v3', auth });
}

function safeName(originalName = 'product-image') {
  const ext = path.extname(originalName).toLowerCase();
  const base = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9-_\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'product-image';
  return `nexora-${Date.now()}-${base}${ext || ''}`;
}

export async function uploadProductImage(file) {
  if (!file?.buffer?.length) {
    const error = new Error('No image file was provided.');
    error.code = 'UPLOAD_FILE_MISSING';
    throw error;
  }

  const folderId = requiredEnv('GOOGLE_DRIVE_FOLDER_ID');
  const drive = driveClient();

  const result = await drive.files.create({
    requestBody: {
      name: safeName(file.originalname),
      parents: [folderId]
    },
    media: {
      mimeType: file.mimetype,
      body: Readable.from(file.buffer)
    },
    fields: 'id,name,mimeType,size,webViewLink',
    supportsAllDrives: true
  });

  const fileId = result.data.id;
  if (!fileId) {
    const error = new Error('Google Drive did not return a file ID.');
    error.code = 'GOOGLE_DRIVE_UPLOAD_FAILED';
    throw error;
  }

  let publicPermission = true;
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { type: 'anyone', role: 'reader' },
      supportsAllDrives: true
    });
  } catch (error) {
    publicPermission = false;
    console.warn('Google Drive public permission could not be applied:', error?.message || error);
  }

  return {
    fileId,
    name: result.data.name,
    mimeType: result.data.mimeType,
    size: result.data.size == null ? file.size : Number(result.data.size),
    imageUrl: `https://drive.google.com/uc?export=view&id=${fileId}`,
    webViewLink: result.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    publicPermission
  };
}
