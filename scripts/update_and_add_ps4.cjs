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

// Target updates/insertions
const UPDATES = [
  {
    searchName: "PS4 Fat HEN 500GB",
    newName: "PS4 Fat HEN 500 GB – 2 Stik",
    price: 3050000
  },
  {
    searchName: "PS4 Fat HEN 1TB",
    newName: "PS4 Fat HEN 1TB – 2 Stik",
    price: 3550000
  },
  {
    searchName: "PS4 Slim HEN 500GB",
    newName: "PS4 Slim HEN 500 GB – 2 Stik",
    price: 3650000
  },
  {
    searchName: "PS4 Slim HEN 1TB",
    newName: "PS4 Slim HEN 1 TB – 2 Stik",
    price: 4050000
  },
  {
    searchName: "PS4 Pro HEN 1TB",
    newName: "PS4 Pro HEN 1 TB – 2 Stik",
    price: 4450000
  }
];

const NEW_PRODUCTS = [
  { name: "PS4 Fat 500GB Original - 2 Stik (Seken)", price: 2150000 },
  { name: "PS4 Pro 1TB HEN - 2 Stik (Seken)", price: 3750000 }
];

async function run() {
  try {
    console.log('Refreshing OAuth access token...');
    const accessToken = await getAccessToken();
    console.log('Access token successfully retrieved.');

    // Fetch existing products
    const listUrl = 'https://firestore.googleapis.com/v1/projects/pembukuan-app-digital-urban/databases/(default)/documents/products?pageSize=100';
    console.log('Fetching existing products...');
    const listRes = await fetch(listUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!listRes.ok) {
      throw new Error(`Failed to fetch products list: ${listRes.status} ${await listRes.text()}`);
    }

    const listData = await listRes.json();
    const existingDocs = listData.documents || [];
    console.log(`Found ${existingDocs.length} existing products in database.`);

    // Match and update
    for (const updateInfo of UPDATES) {
      // Find matching document
      const doc = existingDocs.find(d => {
        const nameVal = d.fields?.name?.stringValue || '';
        return nameVal.toLowerCase().replace(/\s+/g, '') === updateInfo.searchName.toLowerCase().replace(/\s+/g, '');
      });

      if (doc) {
        console.log(`Found match for "${updateInfo.searchName}". Document Name: ${doc.name}`);
        
        // Patch it
        const patchUrl = `https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=name&updateMask.fieldPaths=price`;
        const payload = {
          fields: {
            name: { stringValue: updateInfo.newName },
            price: { integerValue: updateInfo.price.toString() }
          }
        };

        const patchRes = await fetch(patchUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!patchRes.ok) {
          console.error(`Failed to patch ${updateInfo.searchName}: ${patchRes.status} ${await patchRes.text()}`);
        } else {
          console.log(`Successfully updated: "${updateInfo.newName}" - Rp ${updateInfo.price}`);
        }
      } else {
        console.log(`No match found for "${updateInfo.searchName}". Creating new...`);
        NEW_PRODUCTS.push({ name: updateInfo.newName, price: updateInfo.price });
      }
    }

    // Insert new products
    const insertUrl = 'https://firestore.googleapis.com/v1/projects/pembukuan-app-digital-urban/databases/(default)/documents/products';
    for (const p of NEW_PRODUCTS) {
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

      const insertRes = await fetch(insertUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!insertRes.ok) {
        console.error(`Failed to insert ${p.name}: ${insertRes.status} ${await insertRes.text()}`);
      } else {
        const result = await insertRes.json();
        console.log(`Successfully inserted: ${p.name} with ID ${result.name.split('/').pop()}`);
      }
    }

    console.log('All operations finished.');
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
