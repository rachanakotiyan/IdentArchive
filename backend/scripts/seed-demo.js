import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import 'dotenv/config'
import { hashPassword } from '../src/utils/password.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BACKEND_DIR = path.resolve(__dirname, '..')

export const DEFAULT_MANIFEST_PATH = path.join(BACKEND_DIR, 'demo-manifest.json')
export const DEFAULT_CREDENTIALS_PATH = path.join(BACKEND_DIR, 'demo-credentials.csv')

export const DEFAULT_FALLBACK_PINCODES = [
  { pincode: '560001', city: 'Bengaluru', district: 'Bengaluru Urban', state: 'Karnataka' },
  { pincode: '110001', city: 'New Delhi', district: 'Central Delhi', state: 'Delhi' },
  { pincode: '400001', city: 'Mumbai', district: 'Mumbai City', state: 'Maharashtra' },
  { pincode: '700001', city: 'Kolkata', district: 'Kolkata', state: 'West Bengal' },
  { pincode: '600001', city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu' },
  { pincode: '500001', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  { pincode: '411001', city: 'Pune', district: 'Pune', state: 'Maharashtra' },
  { pincode: '380001', city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat' },
  { pincode: '302001', city: 'Jaipur', district: 'Jaipur', state: 'Rajasthan' },
  { pincode: '226001', city: 'Lucknow', district: 'Lucknow', state: 'Uttar Pradesh' },
]

export const OFFICER_SEEDS = [
  { name: 'Inspector Vikram Malhotra', email: 'vikram.malhotra@demo.identarchive.example', badge: 'DEMO-001', active: 1 },
  { name: 'Sub-Inspector Priya Sharma', email: 'priya.sharma@demo.identarchive.example', badge: 'DEMO-002', active: 1 },
  { name: 'Asst Sub-Inspector Rajesh Iyer', email: 'rajesh.iyer@demo.identarchive.example', badge: 'DEMO-003', active: 1 },
  { name: 'Inspector Sunita Patel', email: 'sunita.patel@demo.identarchive.example', badge: 'DEMO-004', active: 1 },
  { name: 'Sub-Inspector Mohammed Farooq', email: 'mohammed.farooq@demo.identarchive.example', badge: 'DEMO-005', active: 1 },
  { name: 'Asst Sub-Inspector Ananya Das', email: 'ananya.das@demo.identarchive.example', badge: 'DEMO-006', active: 1 },
  { name: 'Sub-Inspector Suresh Nair', email: 'suresh.nair@demo.identarchive.example', badge: 'DEMO-007', active: 0 },
]

export const USER_SEEDS = [
  { name: 'Aarav Sharma', email: 'aarav.sharma@demo.identarchive.example', phone: '+91-00000-00001' },
  { name: 'Diya Mukherjee', email: 'diya.mukherjee@demo.identarchive.example', phone: '+91-00000-00002' },
  { name: 'Rohan Verma', email: 'rohan.verma@demo.identarchive.example', phone: '+91-00000-00003' },
  { name: 'Kavita Joshi', email: 'kavita.joshi@demo.identarchive.example', phone: '+91-00000-00004' },
  { name: 'Amit Singh', email: 'amit.singh@demo.identarchive.example', phone: '+91-00000-00005' },
  { name: 'Pooja Nair', email: 'pooja.nair@demo.identarchive.example', phone: '+91-00000-00006' },
  { name: 'Rahul Bose', email: 'rahul.bose@demo.identarchive.example', phone: '+91-00000-00007' },
  { name: 'Meera Kulkarni', email: 'meera.kulkarni@demo.identarchive.example', phone: '+91-00000-00008' },
  { name: 'Sanjay Gupta', email: 'sanjay.gupta@demo.identarchive.example', phone: '+91-00000-00009' },
  { name: 'Neha Reddy', email: 'neha.reddy@demo.identarchive.example', phone: '+91-00000-00010' },
  { name: 'Arjun Sen', email: 'arjun.sen@demo.identarchive.example', phone: '+91-00000-00011' },
  { name: 'Deepa Sengupta', email: 'deepa.sengupta@demo.identarchive.example', phone: '+91-00000-00012' },
  { name: 'Karthik Raman', email: 'karthik.raman@demo.identarchive.example', phone: '+91-00000-00013' },
  { name: 'Shweta Bhatt', email: 'shweta.bhatt@demo.identarchive.example', phone: '+91-00000-00014' },
  { name: 'Manoj Tiwari', email: 'manoj.tiwari@demo.identarchive.example', phone: '+91-00000-00015' },
  { name: 'Ritu Choudhury', email: 'ritu.choudhury@demo.identarchive.example', phone: '+91-00000-00016' },
  { name: 'Harish Rao', email: 'harish.rao@demo.identarchive.example', phone: '+91-00000-00017' },
  { name: 'Sneha Pillai', email: 'sneha.pillai@demo.identarchive.example', phone: '+91-00000-00018' },
  { name: 'Nikhil Deshmukh', email: 'nikhil.deshmukh@demo.identarchive.example', phone: '+91-00000-00019' },
  { name: 'Tanvi Aggarwal', email: 'tanvi.aggarwal@demo.identarchive.example', phone: '+91-00000-00020' },
]

/**
 * Returns a random strong password (16 characters) with mixed casing and special characters.
 */
function generateRandomStrongPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
  const randomBytes = crypto.randomBytes(16)
  let password = ''
  for (let i = 0; i < 16; i++) {
    password += chars[randomBytes[i] % chars.length]
  }
  return password
}

/**
 * Creates an offset date in UTC.
 */
function makePastDate(daysAgo, hourOffset = 0) {
  const date = new Date(Date.now() - daysAgo * 86400000 + hourOffset * 3600000)
  return date
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10)
}

function formatDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * Connect to database using configuration or connection override.
 */
export async function createDemoConnection(options = {}) {
  if (options.connection) return options.connection
  const host = process.env.DB_HOST || '127.0.0.1'
  const port = Number(process.env.DB_PORT) || 3306
  const user = options.user
    || (process.env.NODE_ENV === 'test'
      ? (process.env.DB_MIGRATE_USER || process.env.DB_USER || 'identarchive_migrate')
      : (process.env.DB_USER || process.env.DB_APP_USER || 'identarchive_app'))
  const password = options.password
    ?? (process.env.NODE_ENV === 'test'
      ? (process.env.DB_MIGRATE_PASSWORD ?? process.env.DB_PASSWORD ?? '')
      : (process.env.DB_PASSWORD ?? process.env.DB_APP_PASSWORD ?? ''))
  const database = options.database
    || options.dbOverride
    || (process.env.NODE_ENV === 'test'
      ? (process.env.DB_TEST_NAME || 'identarchive_test')
      : (process.env.DB_NAME || 'identarchive'))

  return mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    timezone: 'Z',
    charset: 'utf8mb4',
  })
}

/**
 * Remove demo seeded data using recorded manifest.
 */
export async function removeDemo(options = {}) {
  const manifestPath = options.manifestPath || DEFAULT_MANIFEST_PATH
  const credentialsPath = options.credentialsPath || DEFAULT_CREDENTIALS_PATH
  const silent = Boolean(options.silent)

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Demo manifest not found at: ${manifestPath}. Nothing to remove.`)
  }

  const manifestContent = fs.readFileSync(manifestPath, 'utf8')
  let manifest
  try {
    manifest = JSON.parse(manifestContent)
  } catch (err) {
    throw new Error(`Invalid JSON in demo manifest at ${manifestPath}: ${err.message}`)
  }

  const ids = manifest.ids || {}
  const ownConnection = !options.connection
  const connection = await createDemoConnection(options)

  try {
    await connection.beginTransaction()

    // Delete in reverse dependency order (children first)
    if (ids.match_verifications?.length) {
      await connection.query(
        'DELETE FROM match_verifications WHERE id IN (?)',
        [ids.match_verifications]
      )
    }

    if (ids.matches?.length) {
      await connection.query(
        'DELETE FROM matches WHERE match_id IN (?)',
        [ids.matches]
      )
    }

    if (ids.report_history?.length) {
      await connection.query(
        'DELETE FROM report_history WHERE id IN (?)',
        [ids.report_history]
      )
    }

    if (ids.reports?.length) {
      // First unhook case_id from reports to avoid circular FK complications
      await connection.query(
        'UPDATE reports SET case_id = NULL WHERE report_id IN (?)',
        [ids.reports]
      )
      await connection.query(
        'DELETE FROM reports WHERE report_id IN (?)',
        [ids.reports]
      )
    }

    if (ids.case_updates?.length) {
      await connection.query(
        'DELETE FROM case_updates WHERE id IN (?)',
        [ids.case_updates]
      )
    }

    if (ids.cases?.length) {
      await connection.query(
        'DELETE FROM cases WHERE case_id IN (?)',
        [ids.cases]
      )
    }

    if (ids.officers?.length) {
      await connection.query(
        'DELETE FROM officers WHERE officer_id IN (?)',
        [ids.officers]
      )
    }

    if (ids.users?.length) {
      // Never delete any admin account
      await connection.query(
        "DELETE FROM users WHERE user_id IN (?) AND role != 'admin'",
        [ids.users]
      )
    }

    await connection.commit()

    if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath)
    }
    if (fs.existsSync(credentialsPath)) {
      fs.unlinkSync(credentialsPath)
    }

    if (!silent) {
      console.log('Successfully removed all demo data and cleaned up manifest.')
    }
    return { success: true }
  } catch (err) {
    try {
      await connection.rollback()
    } catch {
      // ignore rollback failure
    }
    throw err
  } finally {
    if (ownConnection) {
      await connection.end()
    }
  }
}

/**
 * Seed fictional demo data into database.
 */
export async function seedDemo(options = {}) {
  const manifestPath = options.manifestPath || DEFAULT_MANIFEST_PATH
  const credentialsPath = options.credentialsPath || DEFAULT_CREDENTIALS_PATH
  const force = Boolean(options.force)
  const allowProduction = Boolean(options.allowProduction)
  const silent = Boolean(options.silent)

  // Safety: Refuse when NODE_ENV=production unless --allow-production
  const nodeEnv = process.env.NODE_ENV || 'development'
  if (nodeEnv === 'production' && !allowProduction) {
    throw new Error('Refusing to seed demo data in production environment. Use --allow-production to override.')
  }

  // Safety: Refuse if manifest exists unless --force
  if (fs.existsSync(manifestPath)) {
    if (force) {
      // Clean up previous seed first
      try {
        await removeDemo({ ...options, silent: true })
      } catch (err) {
        if (!silent) {
          console.warn(`[Warning] Could not cleanly remove previous seed: ${err.message}`)
        }
      }
    } else {
      throw new Error(`Demo manifest already exists at: ${manifestPath}. Refusing to double-seed. Use --force to overwrite or --remove to clean up.`)
    }
  }

  // Passwords: Optional env DEMO_PASSWORD (min 12 chars) sets one shared password
  const envPassword = options.demoPassword || process.env.DEMO_PASSWORD
  if (envPassword !== undefined && envPassword !== '') {
    if (typeof envPassword !== 'string' || envPassword.length < 12) {
      throw new Error('DEMO_PASSWORD must be at least 12 characters long.')
    }
  }

  const ownConnection = !options.connection
  const connection = await createDemoConnection(options)

  const manifest = {
    seededAt: new Date().toISOString(),
    database: options.database || options.dbOverride || process.env.DB_NAME || 'identarchive',
    counts: {},
    ids: {
      users: [],
      officers: [],
      cases: [],
      case_updates: [],
      reports: [],
      report_history: [],
      matches: [],
      match_verifications: [],
    },
  }

  const credentialsRows = [
    ['role', 'name', 'email', 'password', 'badge_or_phone'],
  ]

  try {
    await connection.beginTransaction()

    // 0. Ensure real pincodes exist
    const [existingPincodes] = await connection.query(
      'SELECT pincode, city, district, state FROM pincodes ORDER BY pincode LIMIT 50'
    )

    let pincodeList = existingPincodes
    if (!pincodeList || pincodeList.length === 0) {
      for (const p of DEFAULT_FALLBACK_PINCODES) {
        await connection.execute(
          'INSERT IGNORE INTO pincodes (pincode, city, district, state) VALUES (?, ?, ?, ?)',
          [p.pincode, p.city, p.district, p.state]
        )
      }
      pincodeList = DEFAULT_FALLBACK_PINCODES
    }

    // 1. Seed 7 Officers
    const createdOfficers = []
    for (let i = 0; i < OFFICER_SEEDS.length; i++) {
      const seed = OFFICER_SEEDS[i]
      const password = envPassword || generateRandomStrongPassword()
      const passwordHash = await hashPassword(password)
      const userId = crypto.randomUUID()
      const officerId = crypto.randomUUID()
      const district = pincodeList[i % pincodeList.length].district
      const createdAt = formatDateTime(makePastDate(56 - i * 2, 8))

      await connection.execute(
        `INSERT INTO users (user_id, name, email, password_hash, role, phone, verified_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'officer', ?, ?, ?, ?)`,
        [userId, seed.name, seed.email, passwordHash, '+91-00000-0900' + (i + 1), createdAt, createdAt, createdAt]
      )
      manifest.ids.users.push(userId)

      await connection.execute(
        `INSERT INTO officers (officer_id, user_id, badge, district, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [officerId, userId, seed.badge, district, seed.active, createdAt, createdAt]
      )
      manifest.ids.officers.push(officerId)

      credentialsRows.push(['officer', seed.name, seed.email, password, seed.badge])
      createdOfficers.push({ officerId, userId, badge: seed.badge, active: seed.active, district })
    }

    // 2. Seed 20 Individual Users
    const createdUsers = []
    for (let i = 0; i < USER_SEEDS.length; i++) {
      const seed = USER_SEEDS[i]
      const password = envPassword || generateRandomStrongPassword()
      const passwordHash = await hashPassword(password)
      const userId = crypto.randomUUID()
      const createdAt = formatDateTime(makePastDate(55 - Math.floor(i * 2.2), 9))

      await connection.execute(
        `INSERT INTO users (user_id, name, email, password_hash, role, phone, verified_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'individual', ?, ?, ?, ?)`,
        [userId, seed.name, seed.email, passwordHash, seed.phone, createdAt, createdAt, createdAt]
      )
      manifest.ids.users.push(userId)

      credentialsRows.push(['individual', seed.name, seed.email, password, seed.phone])
      createdUsers.push({ userId, name: seed.name, email: seed.email, phone: seed.phone })
    }

    // 3. Seed 10 Cases (created the same way the app does: IA-YYYY-NNNN)
    const activeOfficers = createdOfficers.filter((o) => o.active === 1)
    const currentYear = new Date().getUTCFullYear()
    const caseDefinitions = [
      // 6 Missing cases
      {
        kind: 'missing',
        crime_type: 'missing_person',
        case_status: 'open',
        title: 'Missing Student: Rohan Verma',
        person_name: 'Rohan Verma',
        age: 21,
        estimated_age: null,
        gender: 'male',
        daysAgo: 45,
        short_description: 'College student disappeared near metro station after evening classes.',
        description: 'Last seen wearing navy blue hoodie and grey jeans carrying a black backpack near the central metro station exit. Phone went offline at 8:30 PM.',
        physical_features: 'Slender build, short black wavy hair, clean shaven, brown eyes.',
        identifying_marks: 'Small scar near right eyebrow.',
        height_cm: 175,
        pincodeIdx: 0,
      },
      {
        kind: 'missing',
        crime_type: 'runaway',
        case_status: 'open',
        title: 'Missing Teenager: Diya Sen',
        person_name: 'Diya Sen',
        age: 17,
        estimated_age: null,
        gender: 'female',
        daysAgo: 38,
        short_description: 'High school student missing from tuition center area.',
        description: 'Left tuition classes at 5:00 PM but did not return home. Last seen walking towards bus terminus wearing yellow kurti and denim trousers.',
        physical_features: 'Medium complexion, shoulder length dark hair, slim stature.',
        identifying_marks: 'Mole on left cheek.',
        height_cm: 158,
        pincodeIdx: 1,
      },
      {
        kind: 'missing',
        crime_type: 'missing_person',
        case_status: 'under_review',
        title: 'Missing Senior Citizen: Govind Ram',
        person_name: 'Govind Ram',
        age: 72,
        estimated_age: null,
        gender: 'male',
        daysAgo: 32,
        short_description: 'Elderly gentleman with mild memory lapses missing from morning walk.',
        description: 'Went for morning walk in neighborhood park and failed to return. Carries no phone or identification. Speaks Hindi and Kannada.',
        physical_features: 'Frail build, white hair, spectacles with silver frame.',
        identifying_marks: 'Surgical scar on right knee from joint replacement.',
        height_cm: 165,
        pincodeIdx: 2,
      },
      {
        kind: 'missing',
        crime_type: 'abduction',
        case_status: 'under_review',
        title: 'Missing Businessman: Rajesh Bansal',
        person_name: 'Rajesh Bansal',
        age: 44,
        estimated_age: null,
        gender: 'male',
        daysAgo: 26,
        short_description: 'Business owner missing after vehicle found abandoned near industrial bypass.',
        description: 'Car was discovered with hazard lights flashing on the state highway bypass. Briefcase and mobile phone missing from vehicle.',
        physical_features: 'Stocky build, mustache, thinning hair, wheatish complexion.',
        identifying_marks: 'Burn mark on left forearm.',
        height_cm: 172,
        pincodeIdx: 3,
      },
      {
        kind: 'missing',
        crime_type: 'missing_person',
        case_status: 'resolved',
        title: 'Missing Accountant: Harish Rao',
        person_name: 'Harish Rao',
        age: 36,
        estimated_age: null,
        gender: 'male',
        daysAgo: 40,
        short_description: 'Accountant reported missing after office hours; subsequently located.',
        description: 'Reported missing by family after failing to return home. Hospital trace matched patient admitted with concussion following road incident.',
        physical_features: 'Average build, spectacles, short black hair.',
        identifying_marks: 'None reported.',
        height_cm: 168,
        pincodeIdx: 4,
      },
      {
        kind: 'missing',
        crime_type: 'trafficking',
        case_status: 'closed',
        title: 'Closed Missing Inquiry: Kavita Nair',
        person_name: 'Kavita Nair',
        age: 28,
        estimated_age: null,
        gender: 'female',
        daysAgo: 50,
        short_description: 'Suspected cross-district case; resolved through inter-state coordination.',
        description: 'Subject reported missing after traveling for job interview. Located at cousin residence; case closed upon signed confirmation.',
        physical_features: 'Fair complexion, dark brown eyes, long hair.',
        identifying_marks: 'Birthmark on collarbone.',
        height_cm: 162,
        pincodeIdx: 5,
      },

      // 4 Found cases (some with estimated_age)
      {
        kind: 'found',
        crime_type: 'unidentified_person',
        case_status: 'open',
        title: 'Unidentified Male Found at City Railway Terminal',
        person_name: null,
        age: null,
        estimated_age: '20-25 years',
        gender: 'male',
        daysAgo: 28,
        short_description: 'Unconscious young adult male discovered at railway platform bench.',
        description: 'Admitted to district civil hospital unable to communicate. Wearing blue t-shirt and grey trousers. Possesses no ID or transit tickets.',
        physical_features: 'Lean build, wavy black hair, medium complexion.',
        identifying_marks: 'Small scar near right eyebrow matching student profile.',
        height_cm: 174,
        pincodeIdx: 0,
      },
      {
        kind: 'found',
        crime_type: 'unidentified_person',
        case_status: 'under_review',
        title: 'Disoriented Elderly Person Found Near Bus Depot',
        person_name: 'Found Senior - Ramu',
        age: null,
        estimated_age: '70-75 years',
        gender: 'male',
        daysAgo: 22,
        short_description: 'Disoriented senior citizen sheltered at community welfare home.',
        description: 'Brought in by traffic police from central bus depot. Responds vaguely to "Ramu". Wearing white kurta and reading spectacles.',
        physical_features: 'Frail build, white hair, spectacles with silver frame.',
        identifying_marks: 'Surgical scar on right knee.',
        height_cm: 164,
        pincodeIdx: 2,
      },
      {
        kind: 'found',
        crime_type: 'unidentified_person',
        case_status: 'resolved',
        title: 'Injured Pedestrian Recovered Near Highway',
        person_name: 'Identified: Harish Rao',
        age: 36,
        estimated_age: null,
        gender: 'male',
        daysAgo: 38,
        short_description: 'Hit-and-run victim admitted to trauma care, later identified.',
        description: 'Recovered from highway junction with head injury. Biometric identification confirmed match with missing report.',
        physical_features: 'Average build, spectacles found in pocket.',
        identifying_marks: 'None reported.',
        height_cm: 168,
        pincodeIdx: 4,
      },
      {
        kind: 'found',
        crime_type: 'other',
        case_status: 'closed',
        title: 'Found Individual In Transit Rest Area',
        person_name: 'Sunil Das',
        age: 29,
        estimated_age: null,
        gender: 'male',
        daysAgo: 48,
        short_description: 'Stranded migrant worker assisted and reunited with family.',
        description: 'Discovered without funds at highway truck stop. Family contacted and reunion completed.',
        physical_features: 'Wheatish complexion, sturdy build.',
        identifying_marks: 'Tattoo of trident on right arm.',
        height_cm: 170,
        pincodeIdx: 6,
      },
    ]

    const createdCases = []
    for (let i = 0; i < caseDefinitions.length; i++) {
      const def = caseDefinitions[i]
      const caseId = crypto.randomUUID()
      const loc = pincodeList[def.pincodeIdx % pincodeList.length]
      const eventDate = formatDateOnly(makePastDate(def.daysAgo))
      const createdAt = formatDateTime(makePastDate(def.daysAgo - 1, 10))
      const updatedAt = formatDateTime(makePastDate(Math.max(1, def.daysAgo - 10), 16))

      const [insertResult] = await connection.execute(
        `INSERT INTO cases (
          case_id, case_number, title, crime_type, case_status, kind, person_name,
          age, estimated_age, gender, event_date, short_description, description,
          physical_features, identifying_marks, height_cm, city, district, state,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          caseId,
          caseId, // placeholder
          def.title,
          def.crime_type,
          def.case_status,
          def.kind,
          def.person_name,
          def.age,
          def.estimated_age,
          def.gender,
          eventDate,
          def.short_description,
          def.description,
          def.physical_features,
          def.identifying_marks,
          def.height_cm,
          loc.city,
          loc.district,
          loc.state,
          createdAt,
          updatedAt,
        ]
      )

      const sequence = Number(insertResult.insertId)
      const caseNumber = `IA-${currentYear}-${String(sequence).padStart(4, '0')}`
      await connection.execute(
        'UPDATE cases SET case_number = ? WHERE case_id = ?',
        [caseNumber, caseId]
      )

      manifest.ids.cases.push(caseId)
      createdCases.push({
        caseId,
        caseNumber,
        kind: def.kind,
        status: def.case_status,
        title: def.title,
        personName: def.person_name,
        daysAgo: def.daysAgo,
      })

      // Add 2-3 public-safe case_updates for each case
      const updateNotes = [
        'Initial case file established; automated district notifications broadcasted.',
        'Investigating officer coordinated field search with nearby precinct squads.',
        def.case_status === 'resolved' || def.case_status === 'closed'
          ? 'Case investigation officially finalized following protocol verification.'
          : 'Witness interviews and transit monitoring continue on scheduled rotation.',
      ]

      for (let u = 0; u < updateNotes.length; u++) {
        const updateDate = formatDateOnly(makePastDate(Math.max(1, def.daysAgo - 2 - u * 5)))
        const [uResult] = await connection.execute(
          'INSERT INTO case_updates (case_id, update_date, note, created_at) VALUES (?, ?, ?, ?)',
          [caseId, updateDate, updateNotes[u], formatDateTime(makePastDate(Math.max(1, def.daysAgo - 2 - u * 5), 11 + u))]
        )
        manifest.ids.case_updates.push(Number(uResult.insertId))
      }
    }

    // 4. Seed ~20 Reports (covering submitted, under_review, info_requested, approved, rejected, closed; every priority; missing and found)
    const reportStatuses = [
      // 10 Approved reports (linked to the 10 cases above)
      ...createdCases.map((c, idx) => ({
        status: 'approved',
        priority: ['high', 'urgent', 'normal', 'low'][idx % 4],
        report_type: c.kind,
        caseId: c.caseId,
        officer: activeOfficers[idx % activeOfficers.length],
        review_note: 'Verified with station records; case file authorized.',
        daysAgo: c.daysAgo + 1,
      })),
      // 4 Submitted reports (unassigned & assigned, both types, all priorities)
      {
        status: 'submitted',
        priority: 'urgent',
        report_type: 'missing',
        caseId: null,
        officer: null,
        review_note: null,
        daysAgo: 2,
      },
      {
        status: 'submitted',
        priority: 'high',
        report_type: 'found',
        caseId: null,
        officer: null,
        review_note: null,
        daysAgo: 4,
      },
      {
        status: 'submitted',
        priority: 'normal',
        report_type: 'missing',
        caseId: null,
        officer: activeOfficers[0],
        review_note: null,
        daysAgo: 5,
      },
      {
        status: 'submitted',
        priority: 'low',
        report_type: 'found',
        caseId: null,
        officer: null,
        review_note: null,
        daysAgo: 7,
      },
      // 4 Under review reports (assigned to officers, both types, all priorities)
      {
        status: 'under_review',
        priority: 'urgent',
        report_type: 'missing',
        caseId: null,
        officer: activeOfficers[1],
        review_note: 'Verification in progress with hospital registration records.',
        daysAgo: 10,
      },
      {
        status: 'under_review',
        priority: 'high',
        report_type: 'found',
        caseId: null,
        officer: activeOfficers[2],
        review_note: 'Reviewing shelter intake register for previous logs.',
        daysAgo: 12,
      },
      {
        status: 'under_review',
        priority: 'normal',
        report_type: 'missing',
        caseId: null,
        officer: activeOfficers[3],
        review_note: 'Officer dispatched to interview reporting party.',
        daysAgo: 14,
      },
      {
        status: 'under_review',
        priority: 'low',
        report_type: 'found',
        caseId: null,
        officer: activeOfficers[4],
        review_note: 'Cross-referencing fingerprint classification card.',
        daysAgo: 15,
      },
      // 3 Info requested reports
      {
        status: 'info_requested',
        priority: 'high',
        report_type: 'missing',
        caseId: null,
        officer: activeOfficers[0],
        review_note: 'Please provide high-resolution front-facing photograph and dental history if available.',
        daysAgo: 18,
      },
      {
        status: 'info_requested',
        priority: 'normal',
        report_type: 'found',
        caseId: null,
        officer: activeOfficers[1],
        review_note: 'Please clarify precise clothing labels and any personal effects found on individual.',
        daysAgo: 20,
      },
      {
        status: 'info_requested',
        priority: 'low',
        report_type: 'missing',
        caseId: null,
        officer: activeOfficers[2],
        review_note: 'Additional contact telephone number for secondary guardian required.',
        daysAgo: 22,
      },
      // 2 Rejected reports
      {
        status: 'rejected',
        priority: 'normal',
        report_type: 'missing',
        caseId: null,
        officer: activeOfficers[3],
        review_note: 'Duplicate submission of previously registered incident.',
        daysAgo: 30,
      },
      {
        status: 'rejected',
        priority: 'low',
        report_type: 'found',
        caseId: null,
        officer: activeOfficers[4],
        review_note: 'Non-jurisdictional event forwarded to border district authority.',
        daysAgo: 34,
      },
      // 2 Closed reports
      {
        status: 'closed',
        priority: 'normal',
        report_type: 'missing',
        caseId: null,
        officer: activeOfficers[0],
        review_note: 'Complainant reported person returned home without police intervention.',
        daysAgo: 42,
      },
      {
        status: 'closed',
        priority: 'low',
        report_type: 'found',
        caseId: null,
        officer: activeOfficers[1],
        review_note: 'Subject voluntarily departed after local village elder confirmed identity.',
        daysAgo: 44,
      },
    ]

    for (let i = 0; i < reportStatuses.length; i++) {
      const r = reportStatuses[i]
      const reportId = crypto.randomUUID()
      const reporter = createdUsers[i % createdUsers.length]
      const loc = pincodeList[i % pincodeList.length]
      const eventDate = formatDateOnly(makePastDate(r.daysAgo + 2))
      const createdAt = formatDateTime(makePastDate(r.daysAgo, 10))
      const updatedAt = formatDateTime(makePastDate(Math.max(1, r.daysAgo - 2), 14))
      const assignedOfficerId = r.officer ? r.officer.officerId : null

      const subjectName = r.report_type === 'missing'
        ? `Subject ${USER_SEEDS[(i + 5) % USER_SEEDS.length].name}`
        : null

      const [rResult] = await connection.execute(
        `INSERT INTO reports (
          report_id, reference_no, report_type, status, priority, reporter_id,
          reporter_name, reporter_phone, reporter_email, assigned_officer_id,
          case_id, description, person_name, age, gender, height_cm,
          event_date, location_address, location_pincode, location_city,
          location_district, location_state, review_note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          reportId, // placeholder
          r.report_type,
          r.status,
          r.priority,
          reporter.userId,
          reporter.name,
          reporter.phone,
          reporter.email,
          assignedOfficerId,
          r.caseId,
          `Demo report description for ${r.report_type} person intake #${i + 1}.`,
          subjectName,
          25 + (i % 30),
          i % 2 === 0 ? 'male' : 'female',
          160 + (i % 25),
          eventDate,
          `Plot #${100 + i}, Main Bazaar Road`,
          loc.pincode,
          loc.city,
          loc.district,
          loc.state,
          r.review_note,
          createdAt,
          updatedAt,
        ]
      )

      const sequence = Number(rResult.insertId)
      const datePart = formatDateOnly(makePastDate(r.daysAgo)).replaceAll('-', '')
      const referenceNo = `REF-${datePart}-${String(sequence).padStart(6, '0')}`

      await connection.execute(
        'UPDATE reports SET reference_no = ? WHERE report_id = ?',
        [referenceNo, reportId]
      )
      manifest.ids.reports.push(reportId)

      // Report history trail
      const [h1] = await connection.execute(
        'INSERT INTO report_history (report_id, event, actor_id, created_at) VALUES (?, ?, ?, ?)',
        [reportId, 'Report submitted', reporter.userId, createdAt]
      )
      manifest.ids.report_history.push(Number(h1.insertId))

      if (assignedOfficerId) {
        const [h2] = await connection.execute(
          'INSERT INTO report_history (report_id, event, actor_id, created_at) VALUES (?, ?, ?, ?)',
          [reportId, 'Assigned to investigating officer', r.officer.userId, formatDateTime(makePastDate(r.daysAgo, 12))]
        )
        manifest.ids.report_history.push(Number(h2.insertId))
      }

      if (r.status === 'info_requested') {
        const [h3] = await connection.execute(
          'INSERT INTO report_history (report_id, event, actor_id, created_at) VALUES (?, ?, ?, ?)',
          [reportId, 'Information requested from reporter', r.officer ? r.officer.userId : null, formatDateTime(makePastDate(r.daysAgo, 14))]
        )
        manifest.ids.report_history.push(Number(h3.insertId))
      } else if (r.status === 'approved') {
        const [h4] = await connection.execute(
          'INSERT INTO report_history (report_id, event, actor_id, created_at) VALUES (?, ?, ?, ?)',
          [reportId, 'Report approved and case created', r.officer ? r.officer.userId : null, formatDateTime(makePastDate(r.daysAgo, 15))]
        )
        manifest.ids.report_history.push(Number(h4.insertId))
      } else if (r.status === 'rejected') {
        const [h5] = await connection.execute(
          'INSERT INTO report_history (report_id, event, actor_id, created_at) VALUES (?, ?, ?, ?)',
          [reportId, 'Report rejected', r.officer ? r.officer.userId : null, formatDateTime(makePastDate(r.daysAgo, 15))]
        )
        manifest.ids.report_history.push(Number(h5.insertId))
      } else if (r.status === 'closed') {
        const [h6] = await connection.execute(
          'INSERT INTO report_history (report_id, event, actor_id, created_at) VALUES (?, ?, ?, ?)',
          [reportId, 'Report closed', r.officer ? r.officer.userId : null, formatDateTime(makePastDate(r.daysAgo, 16))]
        )
        manifest.ids.report_history.push(Number(h6.insertId))
      }
    }

    // 5. Seed ~5 Matches (pending, confirmed, dismissed; missing side = missing case, found side = found case)
    const missingCases = createdCases.filter((c) => c.kind === 'missing')
    const foundCases = createdCases.filter((c) => c.kind === 'found')

    const matchDefinitions = [
      // Match 1: Confirmed match (Rohan Verma missing student <-> railway unidentified male)
      {
        missingIdx: 0,
        foundIdx: 0,
        similarity_score: 0.94,
        status: 'confirmed',
        daysAgo: 24,
        verification: {
          officer: activeOfficers[0],
          decision: 'confirmed',
          remarks: 'Biometric facial features and eyebrow scar landmark verified with high certainty.',
        },
      },
      // Match 2: Confirmed match (Harish Rao missing <-> Harish Rao trauma patient)
      {
        missingIdx: 4,
        foundIdx: 2,
        similarity_score: 0.91,
        status: 'confirmed',
        daysAgo: 30,
        verification: {
          officer: activeOfficers[1],
          decision: 'confirmed',
          remarks: 'Fingerprint match confirmed through state repository; family identity verification completed.',
        },
      },
      // Match 3: Dismissed match (Diya Sen missing teen <-> railway unidentified male)
      {
        missingIdx: 1,
        foundIdx: 0,
        similarity_score: 0.65,
        status: 'dismissed',
        daysAgo: 20,
        verification: {
          officer: activeOfficers[2],
          decision: 'dismissed',
          remarks: 'Physical gender and age disparity confirmed upon physical examination.',
        },
      },
      // Match 4: Pending match (Govind Ram senior missing <-> Ramu found senior)
      {
        missingIdx: 2,
        foundIdx: 1,
        similarity_score: 0.88,
        status: 'pending',
        daysAgo: 16,
        verification: null,
      },
      // Match 5: Pending match (Rajesh Bansal businessman <-> found transit area male)
      {
        missingIdx: 3,
        foundIdx: 3,
        similarity_score: 0.76,
        status: 'pending',
        daysAgo: 10,
        verification: null,
      },
    ]

    for (let m = 0; m < matchDefinitions.length; m++) {
      const def = matchDefinitions[m]
      const missingCase = missingCases[def.missingIdx % missingCases.length]
      const foundCase = foundCases[def.foundIdx % foundCases.length]
      const matchId = crypto.randomUUID()
      const createdAt = formatDateTime(makePastDate(def.daysAgo, 8))
      const updatedAt = formatDateTime(makePastDate(Math.max(1, def.daysAgo - 2), 15))

      await connection.execute(
        `INSERT INTO matches (
          match_id, missing_case_id, missing_kind, found_case_id, found_kind,
          similarity_score, status, created_at, updated_at
        ) VALUES (?, ?, 'missing', ?, 'found', ?, ?, ?, ?)`,
        [
          matchId,
          missingCase.caseId,
          foundCase.caseId,
          def.similarity_score,
          def.status,
          createdAt,
          updatedAt,
        ]
      )
      manifest.ids.matches.push(matchId)

      if (def.verification) {
        const vDate = formatDateTime(makePastDate(def.daysAgo - 1, 14))
        const [vResult] = await connection.execute(
          `INSERT INTO match_verifications (
            match_id, officer_id, decision, remarks, verification_date
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            matchId,
            def.verification.officer.officerId,
            def.verification.decision,
            def.verification.remarks,
            vDate,
          ]
        )
        manifest.ids.match_verifications.push(Number(vResult.insertId))
      }
    }

    await connection.commit()

    // Write Credentials CSV (roles, names, emails, passwords, badge/phone)
    const csvContent = credentialsRows
      .map((row) => row.map((val) => `"${String(val).replaceAll('"', '""')}"`).join(','))
      .join('\n') + '\n'
    fs.writeFileSync(credentialsPath, csvContent, 'utf8')

    // Write Manifest JSON
    manifest.counts = {
      users: manifest.ids.users.length,
      officers: manifest.ids.officers.length,
      cases: manifest.ids.cases.length,
      case_updates: manifest.ids.case_updates.length,
      reports: manifest.ids.reports.length,
      report_history: manifest.ids.report_history.length,
      matches: manifest.ids.matches.length,
      match_verifications: manifest.ids.match_verifications.length,
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

    if (!silent) {
      console.log('--- IdentArchive Demo Seed Complete ---')
      console.log(`Officers created: ${manifest.counts.officers} (6 active, 1 inactive; badges DEMO-001..DEMO-007)`)
      console.log(`Individual users: ${manifest.counts.users - manifest.counts.officers} (firstname.lastname@demo.identarchive.example)`)
      console.log(`Reports created:  ${manifest.counts.reports} (covering every status & priority)`)
      console.log(`Cases created:    ${manifest.counts.cases} (covering open, under_review, resolved, closed; both kinds)`)
      console.log(`Matches created:  ${manifest.counts.matches} (pending, confirmed, dismissed with verifications)`)
      console.log(`Manifest saved:   ${manifestPath}`)
      console.log(`Credentials path: ${credentialsPath}`)
    }

    return {
      success: true,
      manifestPath,
      credentialsPath,
      counts: manifest.counts,
    }
  } catch (err) {
    try {
      await connection.rollback()
    } catch {
      // ignore rollback errors
    }
    throw err
  } finally {
    if (ownConnection) {
      await connection.end()
    }
  }
}

// ---------------------------------------------------------------------------
// CLI Execution
// ---------------------------------------------------------------------------
const isDirectCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)

if (isDirectCli) {
  const args = process.argv.slice(2)
  const isRemove = args.includes('--remove')
  const force = args.includes('--force')
  const allowProduction = args.includes('--allow-production')

  let dbOverride
  const dbIndex = args.findIndex((a) => a === '--db' || a === '--database')
  if (dbIndex !== -1 && args[dbIndex + 1]) {
    dbOverride = args[dbIndex + 1]
  }

  let manifestPath
  const manifestIndex = args.indexOf('--manifest')
  if (manifestIndex !== -1 && args[manifestIndex + 1]) {
    manifestPath = path.resolve(process.cwd(), args[manifestIndex + 1])
  }

  let credentialsPath
  const credsIndex = args.indexOf('--credentials')
  if (credsIndex !== -1 && args[credsIndex + 1]) {
    credentialsPath = path.resolve(process.cwd(), args[credsIndex + 1])
  }

  const runCli = async () => {
    try {
      if (isRemove) {
        await removeDemo({
          dbOverride,
          manifestPath,
          credentialsPath,
        })
      } else {
        await seedDemo({
          force,
          allowProduction,
          dbOverride,
          manifestPath,
          credentialsPath,
        })
      }
      process.exit(0)
    } catch (err) {
      console.error(`[Error] Demo operation failed: ${err.message}`)
      process.exit(1)
    }
  }

  runCli()
}

