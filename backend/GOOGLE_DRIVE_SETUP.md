# Google Drive upload setup

The NEXORA Admin Console can upload product images directly from the browser to Google Drive through the Railway backend.

## Required Railway variables

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_DRIVE_FOLDER_ID=1THYaYYX-OHrSh1CqWKKXSfocBR_y0GkD
```

## Google Cloud / OAuth

1. Create or select a Google Cloud project.
2. Enable Google Drive API.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 Web application client.
5. Add `https://developers.google.com/oauthplayground` temporarily as an authorized redirect URI.
6. In OAuth 2.0 Playground, enable **Use your own OAuth credentials**, enter the client ID/secret, and authorize the Drive scope with offline access.
7. Exchange the authorization code for tokens and copy the refresh token.
8. Store the client ID, client secret, and refresh token only in Railway Variables.
9. After setup, remove the OAuth Playground redirect URI if it is no longer needed.

## Upload behavior

- Admin session is required.
- Supported types: JPG, PNG, WEBP, GIF, AVIF.
- Maximum image size: 10 MB.
- Files are uploaded to the configured Drive folder.
- The backend attempts to grant public read access so storefront images can render for visitors.
