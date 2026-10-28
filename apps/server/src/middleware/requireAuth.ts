import type { RequestHandler } from 'express';
import { activeSessionPolicy } from '../security/policies/activePolicy';
import { tokenRotationGuard } from '../security/policies/tokenRotation';

export const requireAuth: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const accepted = await activeSessionPolicy.validate({
      userId,
      sourceIp: req.ip || '',
      userAgent: req.get('user-agent') || '',
      boundIp: req.session.boundIp,
      boundUa: req.session.boundUa,
    });
    if (!accepted) {
      res.status(403).json({ error: 'Session policy rejected request' });
      return;
    }
    // R6: rotate the per-request token (no-op in rounds where rotation is off).
    tokenRotationGuard(req, res, next);
  } catch (error) {
    next(error);
  }
};
