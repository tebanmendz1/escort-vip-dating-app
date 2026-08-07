import express from 'express';
import { db } from '../db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

let currentAdminPass = process.env.ADMIN_PASS || 'admin123';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@escorts.com';

// Admin Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === currentAdminPass) {
    const token = generateToken({ id: 'admin_root', email: ADMIN_EMAIL, role: 'ADMIN' });
    return res.json({ token, message: 'Autenticado como Administrador' });
  }
  return res.status(401).json({ error: 'Credenciales de Administrador inválidas' });
});

// Middleware for admin routes
function requireAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user && (req.user.role === 'ADMIN' || req.user.email === ADMIN_EMAIL)) {
      return next();
    }
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de Administrador.' });
  });
}

// Cambiar contraseña de Admin
router.post('/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (currentPassword !== currentAdminPass) {
    return res.status(400).json({ error: 'La contraseña actual del administrador es incorrecta.' });
  }
  if (!newPassword || newPassword.length < 5) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 5 caracteres.' });
  }
  currentAdminPass = newPassword;
  return res.json({ success: true, message: 'Contraseña del Administrador actualizada con éxito.' });
});

// Get all escorts for admin dashboard
router.get('/escorts', requireAdmin, async (req, res) => {
  try {
    const escorts = await db.getAllEscortsAdmin();
    return res.json(escorts);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Toggle Verification (Insignia ✔️)
router.patch('/escorts/:id/verify', requireAdmin, async (req, res) => {
  try {
    const { isVerified } = req.body;
    const updated = await db.updateEscort(req.params.id, { isVerified: Boolean(isVerified) });
    return res.json({ success: true, isVerified: updated.isVerified });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Toggle VIP Featured Status (⭐)
router.patch('/escorts/:id/feature', requireAdmin, async (req, res) => {
  try {
    const { isFeatured } = req.body;
    const updated = await db.updateEscort(req.params.id, { isFeatured: Boolean(isFeatured) });
    return res.json({ success: true, isFeatured: updated.isFeatured });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Block or Unblock Escort Profile
router.patch('/escorts/:id/block', requireAdmin, async (req, res) => {
  try {
    const { isBlocked } = req.body;
    const updated = await db.updateEscort(req.params.id, { isBlocked: Boolean(isBlocked) });
    return res.json({ success: true, isBlocked: updated.isBlocked });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get Admin Config (ADS & Anti-Adblock)
router.get('/config', requireAdmin, async (req, res) => {
  try {
    const config = await db.getAdminConfig();
    return res.json(config);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Update Admin Config
router.put('/config', requireAdmin, async (req, res) => {
  try {
    const { adsEnabled, bannerCode, antiAdblock } = req.body;
    const config = await db.updateAdminConfig({ adsEnabled, bannerCode, antiAdblock });
    return res.json(config);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
