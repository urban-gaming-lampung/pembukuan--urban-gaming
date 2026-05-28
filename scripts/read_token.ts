import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const home = os.homedir();
const appDataLocal = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
const appDataRoaming = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');

const searchDirs = [
  path.join(appDataRoaming, 'npm'),
  path.join(home, 'AppData', 'Roaming', 'npm'),
  path.join(appDataLocal, 'npm-cache'),
  // Standard global location for npm on windows
];

const targetStr = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6';

function searchFile(filePath: string) {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > 2 * 1024 * 1024) return; // Skip large files
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(targetStr)) {
      console.log(`Found in: ${filePath}`);
      // Find client_secret in same file
      const secretMatch = content.match(/client_secret['"]?\s*:\s*['"]([^'"]+)['"]/);
      if (secretMatch) {
        console.log('Secret match:', secretMatch[0]);
      } else {
        // Log around the match
        const idx = content.indexOf(targetStr);
        console.log('Context:', content.substring(idx - 100, idx + 300));
      }
    }
  } catch (err) {
    // Ignore errors
  }
}

function traverse(dir: string) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const full = path.join(dir, file);
      const stats = fs.statSync(full);
      if (stats.isDirectory()) {
        traverse(full);
      } else if (stats.isFile() && (file.endsWith('.js') || file.endsWith('.json'))) {
        searchFile(full);
      }
    }
  } catch (err) {
    // Ignore
  }
}

console.log('Starting search...');
for (const d of searchDirs) {
  console.log(`Searching directory: ${d}`);
  traverse(d);
}
console.log('Search complete.');
