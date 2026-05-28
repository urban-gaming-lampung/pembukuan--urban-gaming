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

// Google OAuth client credentials for Firebase CLI
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

// Query all documents matching gameType === 'aviation' from a collection
async function queryAviationDocs(accessToken: string, collectionId: string): Promise<any[]> {
  const url = 'https://firestore.googleapis.com/v1/projects/pembukuan-app-digital-urban/databases/(default)/documents:runQuery';
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'gameType' },
          op: 'EQUAL',
          value: { stringValue: 'aviation' }
        }
      }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Query failed for ${collectionId}: ${text}`);
  }

  const result = await response.json() as any[];
  // Firestore REST query returns a list of results, filter the ones that have a "document" property
  return (result || [])
    .filter(r => r.document)
    .map(r => r.document);
}

// Update gameType field in a document to 'striker'
async function migrateDocumentGameType(accessToken: string, docName: string) {
  const url = `https://firestore.googleapis.com/v1/${docName}?updateMask.fieldPaths=gameType`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        gameType: { stringValue: 'striker' }
      }
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`  Failed to patch ${docName}: ${text}`);
  } else {
    console.log(`  Successfully migrated: ${docName}`);
  }
}

async function migrateGameConfig(accessToken: string) {
  const url = 'https://firestore.googleapis.com/v1/projects/pembukuan-app-digital-urban/databases/(default)/documents/data/game_config';
  
  // Get current config
  const getResponse = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!getResponse.ok) {
    console.log('No game_config document found or failed to fetch. Skipping game_config update.');
    return;
  }

  const docData = await getResponse.json() as any;
  const activeGame = docData?.fields?.activeGame?.stringValue;

  if (activeGame === 'aviation') {
    console.log('Active game is currently "aviation". Changing to "striker"...');
    const patchResponse = await fetch(`${url}?updateMask.fieldPaths=activeGame`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          activeGame: { stringValue: 'striker' }
        }
      }),
    });

    if (patchResponse.ok) {
      console.log('game_config activeGame successfully updated to "striker".');
    } else {
      const text = await patchResponse.text();
      console.error(`Failed to update game_config: ${text}`);
    }
  } else {
    console.log(`game_config activeGame is currently "${activeGame}" (no update needed).`);
  }
}

async function run() {
  try {
    console.log('Retrieving OAuth access token...');
    const accessToken = await getAccessToken();
    console.log('Token retrieved successfully.');

    // 1. Migrate active game config
    console.log('\n--- Migrating game_config ---');
    await migrateGameConfig(accessToken);

    // 2. Migrate game_leaderboard
    console.log('\n--- Migrating game_leaderboard ---');
    const leaderboardDocs = await queryAviationDocs(accessToken, 'game_leaderboard');
    console.log(`Found ${leaderboardDocs.length} leaderboard documents to migrate.`);
    for (const doc of leaderboardDocs) {
      await migrateDocumentGameType(accessToken, doc.name);
    }

    // 3. Migrate game_winners
    console.log('\n--- Migrating game_winners ---');
    const winnersDocs = await queryAviationDocs(accessToken, 'game_winners');
    console.log(`Found ${winnersDocs.length} winner documents to migrate.`);
    for (const doc of winnersDocs) {
      await migrateDocumentGameType(accessToken, doc.name);
    }

    // 4. Migrate game_attempts
    console.log('\n--- Migrating game_attempts ---');
    const attemptsDocs = await queryAviationDocs(accessToken, 'game_attempts');
    console.log(`Found ${attemptsDocs.length} attempt documents to migrate.`);
    for (const doc of attemptsDocs) {
      await migrateDocumentGameType(accessToken, doc.name);
    }

    console.log('\nFirestore migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

run();
