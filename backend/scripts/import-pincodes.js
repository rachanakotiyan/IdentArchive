import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import pool, { closePool } from '../src/config/database.js';

const BATCH_SIZE = 1000;

async function runImport() {
  // 1. Get CSV file path from CLI argument or default
  const argPath = process.argv[2] || '../database/data/pincodes.csv';
  const csvPath = path.isAbsolute(argPath)
    ? argPath
    : path.resolve(process.cwd(), argPath);

  console.log(`[Pincode Import] Checking CSV file at: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`\n[Error] CSV file not found at: ${csvPath}`);
    console.error(`Usage: node scripts/import-pincodes.js <path_to_csv_file>\n`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = true;
  let batch = [];
  let totalImported = 0;
  let totalSkipped = 0;

  console.log('[Pincode Import] Reading CSV rows...');

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue; // Skip header row
    }

    if (!line.trim()) continue;

    // Handle CSV comma splitting inside quotes
    const cols = line
      .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
      .map((col) => col.replace(/^"|"$/g, '').trim());

    if (cols.length < 5) {
      totalSkipped++;
      continue;
    }

    const [
      circlename,
      regionname,
      divisionname,
      officename,
      rawPincode,
      officetype,
      delivery,
      district,
      statename,
    ] = cols;

    // Pad pincode to 6 digits (keeps leading zeros safe)
    const pincode = String(rawPincode || '').padStart(6, '0');

    if (!/^\d{6}$/.test(pincode)) {
      totalSkipped++;
      continue;
    }

    batch.push([pincode, officename || district || '', district || '', statename || '']);

    if (batch.length >= BATCH_SIZE) {
      const count = await insertBatch(pool, batch);
      totalImported += count;
      batch = [];
    }
  }

  if (batch.length > 0) {
    const count = await insertBatch(pool, batch);
    totalImported += count;
  }

  console.log(`\n====================================`);
  console.log(`Pincode Import Completed!`);
  console.log(`- Total Records Processed : ${totalImported + totalSkipped}`);
  console.log(`- Successfully Imported   : ${totalImported}`);
  console.log(`- Skipped / Invalid Rows : ${totalSkipped}`);
  console.log(`====================================\n`);
}

async function insertBatch(pool, batch) {
  if (batch.length === 0) return 0;
  const query = `
    INSERT IGNORE INTO pincodes (pincode, city, district, state)
    VALUES ?
  `;
  const [result] = await pool.query(query, [batch]);
  return result.affectedRows;
}

try {
  await runImport();
} catch (err) {
  console.error('[Error] Import failed:', err.code || 'UNKNOWN');
  process.exitCode = 1;
} finally {
  await closePool();
}