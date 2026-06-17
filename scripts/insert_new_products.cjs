const fs = require('fs');
const path = require('path');
const os = require('os');

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

async function getAccessToken() {
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

  const data = await response.json();
  return data.access_token;
}

const PRODUCTS = [
  { name: "Stik PS3 Baru - Hitam Tanpa Box", price: 60000 },
  { name: "Stik PS3 Baru - Hitam Dengan Box", price: 65000 },
  { name: "Stik PS3 Baru - Putih Dengan Box", price: 70000 },
  { name: "Stik PS3 Baru - Biru Dengan Box", price: 70000 },
  { name: "Stik PS3 Baru - Merah Dengan Box", price: 70000 },
  { name: "Stik PS3 Baru - Pink Dengan Box", price: 70000 },
  { name: "Stik PS3 Baru - Gold Dengan Box", price: 75000 },
  { name: "Stik PS4 Baru - Semua Warna + Box", price: 140000 },
  { name: "Stik PS4 Baru - Semua Warna Tanpa Box", price: 130000 },
  { name: "PS3 Slim 320GB", price: 2050000 },
  { name: "PS3 Slim Limited Edition 160GB", price: 2050000 },
  { name: "PS4 Fat HEN 500GB", price: 2950000 },
  { name: "PS4 Fat HEN 1TB", price: 3450000 },
  { name: "PS4 Slim HEN 500GB", price: 3450000 },
  { name: "PS4 Slim HEN 1TB", price: 3950000 },
  { name: "PS4 Pro HEN 1TB", price: 4450000 },
  { name: "PS5 Slim Disc (Baru)", price: 10450000 },
  { name: "PS5 Slim Digital (Baru)", price: 8950000 },
  { name: "Kabel Charger PS3", price: 20000 },
  { name: "Kabel Charger PS4", price: 20000 },
  { name: "HDD Cover", price: 60000 },
  { name: "Kaset HEN VDJB", price: 100000 },
  { name: "LuckFox HEN 11", price: 100000 },
  { name: "HDD External Full Game 500GB", price: 450000 },
  { name: "HDD External 1TB", price: 700000 },
  { name: "HDMI", price: 50000 },
  { name: "Kabel Power Premium", price: 20000 },
  { name: "Kaset PS4 - The Sims 4", price: 50000 },
  { name: "Kaset PS4 - Days Gone", price: 150000 },
  { name: "Downgrade PS4 HEN", price: 500000 }
];

async function run() {
  try {
    console.log('Refreshing OAuth access token...');
    const accessToken = await getAccessToken();
    console.log('Access token successfully retrieved.');

    const url = 'https://firestore.googleapis.com/v1/projects/pembukuan-app-digital-urban/databases/(default)/documents/products';
    console.log(`Starting to insert ${PRODUCTS.length} products to Firestore...`);

    for (const p of PRODUCTS) {
      console.log(`Inserting: ${p.name} - Rp ${p.price}...`);
      
      const payload = {
        fields: {
          name: { stringValue: p.name },
          price: { integerValue: p.price.toString() },
          category: { stringValue: "JUALAN" },
          imageUrl: { stringValue: "" },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`Failed to insert ${p.name}: ${response.status} ${text}`);
      } else {
        const result = await response.json();
        console.log(`Successfully inserted: ${p.name} with ID ${result.name.split('/').pop()}`);
      }
    }
    console.log('All insertions finished.');
  } catch (err) {
    console.error('Error during run:', err);
  }
}

run();
