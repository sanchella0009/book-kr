import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool(
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

export const query = (text: string, params?: any[]) => pool.query(text, params);
