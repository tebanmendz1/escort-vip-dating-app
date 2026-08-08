import jwt from 'jsonwebtoken';

function getSecret() {
  return process.env.JWT_SECRET || 'escort-secret-key-change-in-production';
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  jwt.verify(token, getSecret(), (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
    req.user = user;
    next();
  });
}

export function generateToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '30d' });
}

