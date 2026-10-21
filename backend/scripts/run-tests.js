import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDirectory = fileURLToPath(new URL('..', import.meta.url))
const testFiles = readdirSync(join(backendDirectory, 'test'))
  .filter((file) => file.endsWith('.test.js'))
  .map((file) => join('test', file))
const result = spawnSync(
  process.execPath,
  ['--test', '--test-concurrency=1', ...process.argv.slice(2), ...testFiles],
  {
    cwd: backendDirectory,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DB_TEST_NAME: 'identarchive_test',
    },
    stdio: 'inherit',
  }
)

if (result.error) {
  console.error('Unable to start backend tests:', result.error.code || 'UNKNOWN')
  process.exitCode = 1
} else {
  process.exitCode = result.status ?? 1
}
