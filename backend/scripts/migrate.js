import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Sanitizes strings and errors to ensure passwords are never printed to stdout/stderr.
 *
 * @param {string|Error} input
 * @returns {string}
 */
export function sanitizeOutput(input) {
  if (!input) return ''
  const str = typeof input === 'string' ? input : (input.message || String(input))
  return str
    .replace(/password=[^;\s&]+/gi, 'password=***')
    .replace(/:[^:@/]+@/g, ':***@')
}

/**
 * Executes pending database migrations or baseline marking.
 *
 * @param {object} options
 * @param {string} [options.dbOverride] - Optional database name override (e.g. for testing)
 * @param {boolean} [options.baseline] - If true, records 001_create_schema.sql as applied without executing it
 * @param {boolean} [options.silent] - If true, suppresses progress logs (useful in tests)
 * @returns {Promise<Array<{ file: string, baseline: boolean }>>}
 */
export async function runMigrations({ dbOverride, baseline = false, silent = false } = {}) {
  const host = process.env.DB_HOST || '127.0.0.1'
  const port = Number(process.env.DB_PORT) || 3306
  const user = process.env.DB_MIGRATE_USER || process.env.DB_USER || 'identarchive_migrate'
  const password = process.env.DB_MIGRATE_PASSWORD ?? process.env.DB_PASSWORD ?? ''
  const database = dbOverride || process.env.DB_NAME || 'identarchive'

  let connection
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true,
      timezone: 'Z',
      charset: 'utf8mb4',
    })

    // Create schema_migrations table if missing
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Load already-applied migrations
    const [rows] = await connection.query('SELECT filename FROM schema_migrations')
    const appliedSet = new Set(rows.map((r) => r.filename))

    // Discover migration files in database/scripts/
    const scriptsDir = path.resolve(__dirname, '../../database/scripts')
    if (!fs.existsSync(scriptsDir)) {
      throw new Error(`Migration scripts directory not found: ${scriptsDir}`)
    }

    const allFiles = fs.readdirSync(scriptsDir)
    const migrationFiles = allFiles
      .filter((f) => /^\d{3}_.*\.sql$/i.test(f) && !f.endsWith('_rollback.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

    const appliedNow = []

    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        if (!silent) {
          console.log(`[skip] Already applied: ${file}`)
        }
        continue
      }

      const filePath = path.join(scriptsDir, file)

      if (baseline && file === '001_create_schema.sql') {
        // Record 001_create_schema.sql as applied without running SQL
        await connection.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [file])
        appliedNow.push({ file, baseline: true })
        if (!silent) {
          console.log(`[baseline] Recorded ${file} as applied (skipped execution)`)
        }
        continue
      }

      const sqlContent = fs.readFileSync(filePath, 'utf8')
      await connection.query(sqlContent)
      await connection.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [file])
      appliedNow.push({ file, baseline: false })
      if (!silent) {
        console.log(`[applied] Executed and recorded: ${file}`)
      }
    }

    if (!silent) {
      if (appliedNow.length === 0) {
        console.log(`Database "${database}" is up to date.`)
      } else {
        console.log(`Successfully processed ${appliedNow.length} migration(s) for "${database}".`)
      }
    }

    return appliedNow
  } catch (err) {
    const safeMsg = sanitizeOutput(err)
    const errCode = err?.code ? ` [${err.code}]` : ''
    console.error(`Migration error on database "${database}": ${safeMsg}${errCode}`)
    throw err
  } finally {
    if (connection) {
      try {
        await connection.end()
      } catch {
        // ignore disconnect errors during shutdown
      }
    }
  }
}

// CLI Execution entrypoint
const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename
if (isMain) {
  const args = process.argv.slice(2)
  const baseline = args.includes('--baseline')

  let dbOverride = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) {
      dbOverride = args[i + 1]
      i++
    } else if (args[i].startsWith('--db=')) {
      dbOverride = args[i].split('=')[1]
    }
  }

  runMigrations({ dbOverride, baseline })
    .then(() => {
      process.exit(0)
    })
    .catch(() => {
      process.exit(1)
    })
}

export default runMigrations
