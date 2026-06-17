import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionFilePath = path.join(__dirname, 'src', 'version.json');

try {
  let versionData = { version: "4.0.0" };
  if (fs.existsSync(versionFilePath)) {
    const rawData = fs.readFileSync(versionFilePath, 'utf8');
    versionData = JSON.parse(rawData);
  }
  
  const currentVersion = versionData.version || "4.0.0";
  const parts = currentVersion.split('.').map(Number);
  
  if (parts.length === 3 && !parts.some(isNaN)) {
    parts[2] += 1; // Increment patch version
    versionData.version = parts.join('.');
  } else if (parts.length === 2 && !parts.some(isNaN)) {
    versionData.version = `${parts[0]}.${parts[1]}.1`;
  } else {
    versionData.version = "4.0.1";
  }

  fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
  console.log(`Version incremented to: ${versionData.version}`);
} catch (error) {
  console.error("Failed to increment version:", error);
  process.exit(1);
}
