/**
 * One-time script to get Google OAuth refresh token
 * Run with: node scripts/get-google-token.js
 */

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Load from environment variables
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3333';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar'
];

async function getToken() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force to get refresh token
  });

  console.log('\n=== Google OAuth Token Generator ===\n');
  console.log('1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Sign in and authorize the app');
  console.log('3. You will be redirected to localhost - the token will be captured automatically\n');

  // Start a temporary server to catch the OAuth callback
  const server = http.createServer(async (req, res) => {
    const queryParams = url.parse(req.url, true).query;

    if (queryParams.code) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Success!</h1><p>You can close this window and check your terminal.</p>');

      try {
        const { tokens } = await oauth2Client.getToken(queryParams.code);

        console.log('\n=== SUCCESS! ===\n');
        console.log('Add these to your .env file:\n');
        console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
        console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log('\nAlso add your Google Drive folder ID:');
        console.log('GOOGLE_DRIVE_QUOTES_FOLDER_ID=your_folder_id_here');
        console.log('\n(Get folder ID from the URL when viewing your Quotes folder in Drive)');

        server.close();
        process.exit(0);
      } catch (error) {
        console.error('Error getting tokens:', error);
        server.close();
        process.exit(1);
      }
    } else if (queryParams.error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error</h1><p>${queryParams.error}</p>`);
      console.error('Auth error:', queryParams.error);
      server.close();
      process.exit(1);
    }
  });

  server.listen(3333, () => {
    console.log('Waiting for authorization...\n');
  });
}

getToken();
