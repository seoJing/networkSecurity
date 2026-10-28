import { Router } from 'express';
import { compare } from 'bcryptjs';
import { pool } from '../db';
import { requireAuth } from '../middleware/requireAuth';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password || username.length > 100 || password.length > 200) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }
    const result = await pool.query<{ id: number; username: string; password_hash: string; display_name: string }>(
      'SELECT id, username, password_hash, display_name FROM users WHERE username = $1',
      [username],
    );
    const user = result.rows[0];
    if (!user || !(await compare(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    // Rotate session ID at login to mitigate session fixation.
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.userId = user.id;
      // Defender contract extension: bind the session to the client it was issued to.
      req.session.boundIp = req.ip;
      req.session.boundUa = req.get('user-agent') || '';
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.json({ id: user.id, username: user.username, displayName: user.display_name });
      });
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('mini-office.sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: false });
    res.status(204).end();
  });
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query<{ id: number; username: string; display_name: string }>(
      'SELECT id, username, display_name FROM users WHERE id = $1',
      [req.session.userId],
    );
    if (!result.rows[0]) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    const user = result.rows[0];
    res.json({ id: user.id, username: user.username, displayName: user.display_name });
  } catch (error) {
    next(error);
  }
});
