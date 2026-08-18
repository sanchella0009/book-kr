import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        user: process.env.POSTGRES_USER || 'chronicles',
        password: process.env.POSTGRES_PASSWORD || 'chronicles',
        database: process.env.POSTGRES_DB || 'chronicles',
      }
);

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running database migrations...');
    const migrationPath = path.join(__dirname, 'migrations', '001_initial.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migrations completed successfully.');

    // Seed default admin user
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminPassword) {
      const res = await client.query('SELECT * FROM users WHERE username = $1', [adminUsername]);
      if (res.rows.length === 0) {
        console.log(`Seeding admin user '${adminUsername}'...`);
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        await client.query(
          'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
          [adminUsername, passwordHash]
        );
        console.log('Admin user seeded.');
      } else {
        console.log(`Admin user '${adminUsername}' already exists.`);
      }
    } else {
      console.warn('ADMIN_PASSWORD not set in env. Default admin user was not seeded.');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error running migrations:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Database migration process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration process failed:', err);
      process.exit(1);
    });
}
