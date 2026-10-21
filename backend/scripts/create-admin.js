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

function promptText(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer))
  })
}

function promptHiddenPassword() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Create-admin requires an interactive terminal to hide the password.')
  }

  return new Promise((resolve, reject) => {
    let password = ''
    process.stdout.write('Password: ')
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const finish = (error = null) => {
      process.stdin.setRawMode(false)
      process.stdin.removeListener('data', onData)
      process.stdout.write('\n')
      if (error) reject(error)
      else resolve(password)
    }

    const onData = (character) => {
      for (const key of character) {
        if (key === '\u0003') {
          finish(new Error('Admin creation cancelled.'))
          return
        }
        if (key === '\r' || key === '\n') {
          finish()
          return
        }
        if (key === '\u007f' || key === '\b') {
          password = Array.from(password).slice(0, -1).join('')
        } else {
          password += key
        }
      }
    }

    process.stdin.on('data', onData)
  })
}

async function main() {
  if (await userRepo.adminExists()) {
    throw Object.assign(new Error('An admin user already exists. Aborting.'), { name: 'AdminExistsError' })
  }

  console.log('=== IdentArchive - Create Admin User ===')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  let name
  let email
  try {
    name = await promptText(rl, 'Full name: ')
    email = await promptText(rl, 'Email: ')
  } finally {
    rl.close()
  }

  const password = await promptHiddenPassword()
  await createAdminUser({ name, email, password })
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
