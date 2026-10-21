import 'dotenv/config'
import crypto from 'node:crypto'
import readline from 'node:readline'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { hashPassword } from '../src/utils/password.js'
import * as userRepo from '../src/repositories/userRepository.js'
import pool, { closePool } from '../src/config/database.js'

const adminInputSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  email: z.string().trim().email('A valid email is required.').transform((email) => email.toLowerCase()),
  password: z.string().min(12, 'Password must be at least 12 characters.'),
})

export async function createAdminUser(input) {
  const parsed = adminInputSchema.safeParse(input)
  if (!parsed.success) {
    const error = new Error(parsed.error.issues[0].message)
    error.name = 'AdminInputError'
    throw error
  }

  const { name, email, password } = parsed.data
  const connection = await pool.getConnection()
  let lockAcquired = false
  try {
    const [lockRows] = await connection.execute(
      'SELECT GET_LOCK(?, 10) AS acquired',
      ['identarchive:create-admin']
    )
    lockAcquired = Number(lockRows[0]?.acquired) === 1
    if (!lockAcquired) {
      throw new Error('Could not acquire the admin-creation lock.')
    }

    if (await userRepo.adminExists(connection)) {
      const error = new Error('An admin user already exists. Aborting.')
      error.name = 'AdminExistsError'
      throw error
    }

    return await userRepo.create({
      userId: crypto.randomUUID(),
      name,
      email,
      passwordHash: await hashPassword(password),
      role: 'admin',
      phone: null,
      verifiedAt: new Date(),
    }, connection)
  } finally {
    try {
      if (lockAcquired) {
        await connection.execute('SELECT RELEASE_LOCK(?)', ['identarchive:create-admin'])
      }
    } finally {
      connection.release()
    }
  }
}

// ---------------------------------------------------------------------------
// Terminal input. One reader is used for every prompt (mixing readline with raw
// mode was unreliable). Passwords echo "*" so you can see that typing works.
// If your terminal cannot do raw input, run: npm run create-admin -- --visible
// (the password is then shown on screen as you type).
// ---------------------------------------------------------------------------
const VISIBLE = process.argv.includes('--visible')

function askRaw(question, { hidden = false } = {}) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    let value = ''
    process.stdout.write(question)
    stdin.setEncoding('utf8')
    stdin.setRawMode(true)
    stdin.resume()

    const finish = (error) => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      process.stdout.write('\n')
      if (error) reject(error)
      else resolve(value)
    }

    const onData = (chunk) => {
      // Drop escape sequences such as arrow keys / Home / Delete.
      const text = chunk.replace(/\u001b(?:\[[0-9;]*[A-Za-z~]|O[A-Za-z])/g, '')
      for (const key of text) {
        if (key === '\u0003') return finish(new Error('Admin creation cancelled.'))
        if (key === '\r' || key === '\n') return finish()
        if (key === '\u007f' || key === '\b') {
          if (value.length > 0) {
            value = Array.from(value).slice(0, -1).join('')
            process.stdout.write('\b \b')
          }
        } else if (key >= ' ') {
          value += key
          process.stdout.write(hidden ? '*' : key)
        }
      }
    }
    stdin.on('data', onData)
  })
}

async function collectCredentials() {
  if (VISIBLE) {
    console.log('WARNING: --visible is on. Your password will be shown on screen.')
    const rl = readline.createInterface({ input: process.stdin })
    const lines = rl[Symbol.asyncIterator]()
    const ask = async (question) => {
      process.stdout.write(question)
      const { value, done } = await lines.next()
      if (done) throw Object.assign(new Error('Input ended before all fields were entered.'), { name: 'AdminInputError' })
      return value
    }
    try {
      const name = await ask('Full name: ')
      const email = await ask('Email: ')
      const password = await ask('Password (min 12 chars, visible): ')
      return { name, email, password }
    } finally {
      rl.close()
    }
  }

  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw Object.assign(
      new Error('This terminal cannot hide password input. Open a normal terminal (PowerShell / Windows Terminal) and run again, or use: npm run create-admin -- --visible'),
      { name: 'AdminInputError' }
    )
  }

  const name = await askRaw('Full name: ')
  const email = await askRaw('Email: ')
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const password = await askRaw('Password (min 12 chars, characters show as *): ', { hidden: true })
    const confirm = await askRaw('Confirm password: ', { hidden: true })
    if (password === confirm) return { name, email, password }
    console.log('Passwords do not match. Try again.')
  }
  throw Object.assign(new Error('Passwords did not match 3 times. Aborting.'), { name: 'AdminInputError' })
}

async function main() {
  if (await userRepo.adminExists()) {
    throw Object.assign(new Error('An admin user already exists. Aborting.'), { name: 'AdminExistsError' })
  }

  console.log('=== IdentArchive - Create Admin User ===')
  const credentials = await collectCredentials()
  await createAdminUser(credentials)
  console.log('[create-admin] Admin user created.')
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (isMain) {
  main()
    .catch((error) => {
      const message = ['AdminExistsError', 'AdminInputError'].includes(error.name)
        ? error.message
        : `Failed to create admin (${error.code || 'UNKNOWN'}).`
      console.error(`[create-admin] ${message}`)
      process.exitCode = 1
    })
    .finally(closePool)
}