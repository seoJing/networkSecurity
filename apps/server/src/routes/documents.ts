import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/requireAuth';

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

type DocumentRow = { id: number; title: string; content: string; updated_at: string };
const fields = 'id, title, content, updated_at';
const present = (row: DocumentRow) => ({ id: row.id, title: row.title, content: row.content, updatedAt: row.updated_at });

documentsRouter.get('/', async (req, res, next) => {
  try {
    const result = await pool.query<DocumentRow>(
      `SELECT ${fields} FROM documents WHERE owner_id = $1 ORDER BY id ASC`,
      [req.session.userId],
    );
    res.json(result.rows.map(present));
  } catch (error) { next(error); }
});

documentsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: 'Invalid document ID' }); return; }
    const result = await pool.query<DocumentRow>(
      `SELECT ${fields} FROM documents WHERE id = $1 AND owner_id = $2`,
      [id, req.session.userId],
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Document not found' }); return; }
    res.json(present(result.rows[0]));
  } catch (error) { next(error); }
});

documentsRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: 'Invalid document ID' }); return; }
    const { title, content } = req.body ?? {};
    if (typeof title !== 'string' || typeof content !== 'string' || !title.trim() || title.length > 120 || content.length > 10000) {
      res.status(400).json({ error: 'Valid title and content are required' }); return;
    }
    const result = await pool.query<DocumentRow>(
      `UPDATE documents SET title = $1, content = $2, updated_at = NOW()
       WHERE id = $3 AND owner_id = $4 RETURNING ${fields}`,
      [title.trim(), content, id, req.session.userId],
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Document not found' }); return; }
    res.json(present(result.rows[0]));
  } catch (error) { next(error); }
});
