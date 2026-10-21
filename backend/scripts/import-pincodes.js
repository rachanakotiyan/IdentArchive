import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { getPool } from '../src/config/database.js';

const BATCH_SIZE = 1000;

export async function importPincodes(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`[Error] CSV file not found at: ${filePath}`);
    process.exit(1);
  }

  const pool = getPool();
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = true;
  let batch = [];
  let totalImported = 0;
  let totalSkipped = 0;

  console.log(`Starting pincode import from ${filePath}...`);

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue; // Skip header row
    }

    if (!line.trim()) continue;

    // Simple CSV parser handling quotes
    const cols = line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(col => col.replace(/^"\vert{}"$/g, '').trim());

    if (cols.length < 9) {
      totalSkipped++;
      continue;
    }

    const [
      circlename, regionname, divisionname, officename,
      rawPincode, officetype, delivery, district, statename
    ] = cols;

    // Normalize pincode (ensure 6 digits with leading zeros)
    const pincode = String(rawPincode).padStart(6, '0');

    if (!/^\d{6}$/.test(pincode)) {
      totalSkipped++;
      continue;
    }

    batch.push([pincode, officename, district, statename, stateNameOrCode(statename)]);

    if (batch.length >= BATCH_SIZE) {
      const inserted = await insertBatch(pool, batch);
      totalImported += inserted;
      batch = [];
    }
  }

  if (batch.length > 0) {
    const inserted = await insertBatch(pool, batch);
    totalImported += inserted;
  }

  console.log(`\nImport Complete!`);
  console.log(`- Total Records Processed: ${totalImported + totalSkipped}`);
  console.log(`- Successfully Imported: ${totalImported}`);
  console.log(`- Skipped/Invalid Rows: ${totalSkipped}`);
}

function stateNameOrCode(state) {
  return state || null;
}

async function insertBatch(pool, batch) {
  if (batch.length === 0) return 0;
  
  // Use INSERT IGNORE or ON DUPLICATE KEY UPDATE to handle duplicate entries safely
  const query = `
    INSERT IGNORE INTO pincodes (pincode, office_name, district, state, state_code)
    VALUES ?
  `;
  const [result] = await pool.query(query, [batch]);
  return result.affectedRows;
}

// Execution block
const filePath = process.argv[2] || path.join(process.cwd(), '../data/pincodes.csv');
importPincodes(filePath)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });