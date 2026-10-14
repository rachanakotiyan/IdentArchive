/**
 * Mock user accounts.
 * DEMO ONLY — never store real credentials here.
 */

export const MOCK_USERS = [
  {
    userId: 'usr-001',
    name: 'Priya Sharma',
    email: 'priya@demo.test',
    password: 'demo1234',
    role: 'individual',
    phone: '9876543210',
    verifiedAt: '2026-01-10T08:00:00Z',
  },
  {
    userId: 'usr-002',
    name: 'Inspector Rajan Verma',
    email: 'officer@demo.test',
    password: 'demo1234',
    role: 'officer',
    officerId: 'off-001',
    phone: '9000000001',
    verifiedAt: '2026-01-05T08:00:00Z',
  },
  {
    userId: 'usr-003',
    name: 'Superintendent Lakshmi Nair',
    email: 'admin@demo.test',
    password: 'demo1234',
    role: 'admin',
    phone: '9000000003',
    verifiedAt: '2026-01-01T08:00:00Z',
  },
];

export const DEMO_ACCOUNTS = [
  { label: 'Public user', email: 'priya@demo.test', password: 'demo1234', role: 'individual' },
  { label: 'Officer',     email: 'officer@demo.test', password: 'demo1234', role: 'officer' },
  { label: 'Admin',       email: 'admin@demo.test',   password: 'demo1234', role: 'admin' },
];
