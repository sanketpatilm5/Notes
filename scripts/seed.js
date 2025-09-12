import { Pool } from 'pg';
import bcryptjs from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function createTables() {
  console.log('Creating tables...');

  // Create tenants table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug VARCHAR NOT NULL UNIQUE,
      plan VARCHAR NOT NULL DEFAULT 'free',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  // Create users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role VARCHAR NOT NULL DEFAULT 'member',
      tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  // Create notes table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      user_id VARCHAR NOT NULL REFERENCES users(id),
      tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  console.log('Tables created successfully');
}

async function seedData() {
  console.log('Seeding data...');

  // Create tenants
  const tenants = [
    { name: 'ACME Corp', slug: 'acme', plan: 'free' },
    { name: 'Globex Inc', slug: 'globex', plan: 'free' }
  ];

  for (const tenant of tenants) {
    const existing = await pool.query('SELECT id FROM tenants WHERE slug = $1', [tenant.slug]);
    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO tenants (name, slug, plan) VALUES ($1, $2, $3)',
        [tenant.name, tenant.slug, tenant.plan]
      );
      console.log(`Created tenant: ${tenant.name}`);
    } else {
      console.log(`Tenant ${tenant.name} already exists`);
    }
  }

  // Get tenant IDs
  const acmeResult = await pool.query('SELECT id FROM tenants WHERE slug = $1', ['acme']);
  const globexResult = await pool.query('SELECT id FROM tenants WHERE slug = $1', ['globex']);
  
  const acmeTenantId = acmeResult.rows[0].id;
  const globexTenantId = globexResult.rows[0].id;

  // Create users
  const users = [
    { email: 'admin@acme.test', password: 'password', role: 'admin', tenantId: acmeTenantId },
    { email: 'user@acme.test', password: 'password', role: 'member', tenantId: acmeTenantId },
    { email: 'admin@globex.test', password: 'password', role: 'admin', tenantId: globexTenantId },
    { email: 'user@globex.test', password: 'password', role: 'member', tenantId: globexTenantId },
  ];

  for (const user of users) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);
    if (existing.rows.length === 0) {
      const hashedPassword = bcryptjs.hashSync(user.password, 8);
      await pool.query(
        'INSERT INTO users (email, password, role, tenant_id) VALUES ($1, $2, $3, $4)',
        [user.email, hashedPassword, user.role, user.tenantId]
      );
      console.log(`Created user: ${user.email}`);
    } else {
      console.log(`User ${user.email} already exists`);
    }
  }

  console.log('Database seeded successfully');
}

async function main() {
  try {
    await createTables();
    await seedData();
    console.log('Seed completed successfully');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
