import { Readable } from 'node:stream';
import path from 'node:path';
import { google } from 'googleapis';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MANAGED_FOLDER_NAME = 'NEXORA Product Images';

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    const error = new Error(`${name} is not configured on the server.`);
    error.code = 'GOOGLE_DRIVE_NOT_CONFIGURED';
    throw error;
  }
  return value;
}

function optionalEnv(name) {
  return String(process.env[name] || '').trim();
}

function normalizeGoogleError(error, operation = 'Google Drive request failed') {
  const status = Number(error?.response?.status || error?.code || 0) || 502;
  const apiError = error?.response?.data?.error;
  const reason = apiError?.errors?.[0]?.reason || error?.errors?.[0]?.reason || '';
  const message = apiError?.message || error?.message || operation;
  const wrapped = new Error(`${operation}: ${message}`);
  wrapped.code = 'GOOGLE_DRIVE_API_ERROR';
  wrapped.httpStatus = status;
  wrapped.googleReason = reason;
  return wrapped;
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

async function getAccessibleConfiguredFolder(drive) {
  const folderId = optionalEnv('GOOGLE_DRIVE_FOLDER_ID');
  if (!folderId) return null;

  try {
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,trashed',
      supportsAllDrives: true
    });
    if (response.data?.mimeType === FOLDER_MIME && !response.data?.trashed) {
      return { id: response.data.id, name: response.data.name, source: 'configured' };
    }
  } catch (error) {
    const status = Number(error?.response?.status || error?.code || 0);
    if (status !== 403 && status !== 404) {
      throw normalizeGoogleError(error, 'Could not inspect configured Google Drive folder');
    }
  }

  return null;
}

async function findManagedFolder(drive) {
  try {
    const escapedName = MANAGED_FOLDER_NAME.replace(/'/g, "\\'");
    const response = await drive.files.list({
      q: `name='${escapedName}' and mimeType='${FOLDER_MIME}' and trashed=false`,
      spaces: 'drive',
      pageSize: 10,
      fields: 'files(id,name,mimeType)'
    });
    const folder = response.data.files?.[0];
    return folder ? { id: folder.id, name: folder.name, source: 'managed-existing' } : null;
  } catch (error) {
    throw normalizeGoogleError(error, 'Could not search for the NEXORA Google Drive folder');
  }
}

async function createManagedFolder(drive) {
  try {
    const response = await drive.files.create({
      requestBody: {
        name: MANAGED_FOLDER_NAME,
        mimeType: FOLDER_MIME,
        appProperties: { nexoraManaged: 'true', purpose: 'product-images' }
      },
      fields: 'id,name,mimeType'
    });
    return {
      id: response.data.id,
      name: response.data.name || MANAGED_FOLDER_NAME,
      source: 'managed-created'
    };
  } catch (error) {
    throw normalizeGoogleError(error, 'Could not create the NEXORA Product Images folder');
  }
}

async function resolveUploadFolder(drive) {
  const configured = await getAccessibleConfiguredFolder(drive);
  if (configured) return configured;

  const existing = await findManagedFolder(drive);
  if (existing) return existing;

  return createManagedFolder(drive);
}

export async function inspectGoogleDrive() {
  const drive = driveClient();
  try {
    const [about, folder] = await Promise.all([
      drive.about.get({ fields: 'user(displayName,emailAddress),storageQuota(limit,usage)' }),
      resolveUploadFolder(drive)
    ]);
    return {
      connected: true,
      user: about.data.user || null,
      folder,
      configuredFolderAccessible: folder.source === 'configured'
    };
  } catch (error) {
    if (error?.code === 'GOOGLE_DRIVE_API_ERROR') throw error;
    throw normalizeGoogleError(error, 'Google Drive connection check failed');
  }
}

export async function getProductImageStream(fileId) {
  const safeFileId = String(fileId || '').trim();
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(safeFileId)) {
    const error = new Error('Invalid Google Drive file ID.');
    error.code = 'INVALID_DRIVE_FILE_ID';
    throw error;
  }

  const drive = driveClient();
  try {
    const metadata = await drive.files.get({
      fileId: safeFileId,
      fields: 'id,name,mimeType,size,modifiedTime,trashed',
      supportsAllDrives: true
    });

    if (metadata.data?.trashed) {
      const error = new Error('Google Drive image is in trash.');
      error.code = 'DRIVE_FILE_NOT_FOUND';
      throw error;
    }

    const mimeType = String(metadata.data?.mimeType || 'application/octet-stream');
    if (!mimeType.startsWith('image/')) {
      const error = new Error('Requested Google Drive file is not an image.');
      error.code = 'INVALID_IMAGE_TYPE';
      throw error;
    }

    const media = await drive.files.get(
      { fileId: safeFileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    return {
      stream: media.data,
      mimeType,
      size: metadata.data?.size == null ? null : Number(metadata.data.size),
      name: metadata.data?.name || 'product-image',
      modifiedTime: metadata.data?.modifiedTime || null
    };
  } catch (error) {
    if (error?.code === 'INVALID_IMAGE_TYPE' || error?.code === 'DRIVE_FILE_NOT_FOUND') throw error;
    throw normalizeGoogleError(error, 'Google Drive image download failed');
  }
}

export async function uploadProductImage(file) {
  if (!file?.buffer?.length) {
    const error = new Error('No image file was provided.');
    error.code = 'UPLOAD_FILE_MISSING';
    throw error;
  }

  const drive = driveClient();
  const folder = await resolveUploadFolder(drive);

  let result;
  try {
    result = await drive.files.create({
      requestBody: {
        name: safeName(file.originalname),
        parents: [folder.id],
        appProperties: { nexoraManaged: 'true', purpose: 'product-image' }
      },
      media: {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer)
      },
      fields: 'id,name,mimeType,size,webViewLink,parents',
      supportsAllDrives: true
    });
  } catch (error) {
    throw normalizeGoogleError(error, 'Google Drive image upload failed');
  }

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
    console.warn('Google Drive public permission could not be applied:', error?.response?.data?.error?.message || error?.message || error);
  }

  const webViewLink = result.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  const imageUrl = `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;

  return {
    fileId,
    name: result.data.name,
    mimeType: result.data.mimeType,
    size: result.data.size == null ? file.size : Number(result.data.size),
    webViewLink,
    imageUrl,
    publicPermission,
    folderId: folder.id,
    folderName: folder.name,
    folderSource: folder.source
  };
}
