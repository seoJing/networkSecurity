import { Pool } from 'pg';

const required = ['PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

export const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || '5432'),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});
