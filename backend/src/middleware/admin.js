export function requireAdmin(req, res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) {
    return res.status(503).json({
      error: 'ADMIN_API_KEY is not configured on the server.'
    });
  }

  const providedKey = req.get('x-admin-key');
  if (!providedKey || providedKey !== configuredKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
