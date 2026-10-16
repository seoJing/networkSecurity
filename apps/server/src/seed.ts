import { hash } from 'bcryptjs';
import { pool } from './db';

export async function seedDemoData(): Promise<void> {
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 8) throw new Error('SEED_PASSWORD must have at least 8 characters');
  const passwordHash = await hash(password, 10);
  for (const [username, displayName] of [['alice', 'Alice'], ['bob', 'Bob']] as const) {
    const user = await pool.query<{ id: number }>(
      `INSERT INTO users (username, password_hash, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id`,
      [username, passwordHash, displayName],
    );
    const id = user.rows[0].id;
    await pool.query(
      `INSERT INTO documents (owner_id, title, content)
       SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM documents WHERE owner_id = $1)`,
      [id, `${displayName}'s private report`, `This is a private sample document belonging to ${displayName}.`],
    );
  }
}
