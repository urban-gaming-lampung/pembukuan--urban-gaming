import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 1. Load the refresh token from firebase-tools.json
const home = os.homedir();
const configPath = path.join(home, '.config', 'configstore', 'firebase-tools.json');

if (!fs.existsSync(configPath)) {
  throw new Error('firebase-tools.json config not found.');
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const refreshToken = config.tokens?.refresh_token;

if (!refreshToken) {
  throw new Error('No refresh token found in firebase-tools.json.');
}

// 2. Correct Google OAuth client credentials for Firebase CLI
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

async function getAccessToken(): Promise<string> {
  const url = 'https://oauth2.googleapis.com/token';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh token: ${text}`);
  }

  const data = await response.json() as any;
  return data.access_token;
}

async function run() {
  try {
    console.log('Refreshing OAuth access token...');
    const accessToken = await getAccessToken();
    console.log('Access token successfully retrieved.');

    // 3. Request document via Firestore REST API
    const url = 'https://firestore.googleapis.com/v1/projects/pembukuan-app-digital-urban/databases/(default)/documents/data/game_config';
    console.log(`Sending GET request to Firestore REST API: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`REST API Request failed: ${response.status} ${text}`);
    }

    const docData = await response.json();
    console.log('Success! Document data fetched via REST API:');
    console.log(JSON.stringify(docData, null, 2));
  } catch (err) {
    console.error('Failed to read Firestore:', err);
  }
}

run();
