import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@escorts.com';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

// Registro exclusivo para Proveedores / Escorts (Mujeres, Hombres, Trans)
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, gender, age, city, zone, phone, whatsapp, telegram, hourlyRate, services, bio } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Por favor proporciona email, contraseña y nombre.' });
    }

    const existing = await db.findEscortByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const escort = await db.createEscort({
      email,
      passwordHash,
      name,
      gender: gender ? gender.toUpperCase() : 'FEMALE',
      age: parseInt(age) || 21,
      city: city || 'Ciudad de México',
      zone: zone || 'Centro',
      phone: phone || '',
      whatsapp: whatsapp || phone || '',
      telegram: telegram || '',
      hourlyRate: parseFloat(hourlyRate) || 120,
      services: services || 'Acompañante VIP, Cenas, Eventos',
      bio: bio || 'Hola, soy ' + name + ', disponible para servicios exclusivos.',
      avatarUrl: gender === 'MALE' ? 'assets/images/avatar/5.jpg' : 'assets/images/avatar/1.jpg'
    });

    const token = generateToken({ id: escort.id, email: escort.email, name: escort.name, gender: escort.gender, role: 'ESCORT' });

    // Excluir passwordHash de la respuesta
    const { passwordHash: _, ...escortData } = escort;
    return res.status(201).json({ token, role: 'ESCORT', redirectUrl: 'escort-dashboard.html', escort: escortData });
  } catch (error) {
    console.error('Error en registro:', error);
    return res.status(500).json({ error: 'Error al registrar el perfil de escort.' });
  }
});

// Inicio de Sesión Unificado (Detección automática de Admin o Escort)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Por favor ingresa tu correo y contraseña.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Verificación si es Administrador
    if (cleanEmail === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASS) {
      const adminToken = generateToken({ id: 'admin_root', email: ADMIN_EMAIL, role: 'ADMIN' });
      return res.json({
        token: adminToken,
        role: 'ADMIN',
        redirectUrl: 'admin.html',
        message: 'Bienvenido Administrador'
      });
    }

    // 2. Verificación si es Escort
    const escort = await db.findEscortByEmail(cleanEmail);
    if (!escort) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const isValid = await bcrypt.compare(password, escort.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = generateToken({ id: escort.id, email: escort.email, name: escort.name, gender: escort.gender, role: 'ESCORT' });
    const { passwordHash: _, ...escortData } = escort;

    return res.json({
      token,
      role: 'ESCORT',
      redirectUrl: 'escort-dashboard.html',
      escort: escortData
    });
  } catch (error) {
    console.error('Error en login unificado:', error);
    return res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

// Obtener perfil actual del Escort autenticado
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const escort = await db.getEscortById(req.user.id);
    if (!escort) {
      return res.status(404).json({ error: 'Perfil no encontrado.' });
    }
    const { passwordHash: _, ...escortData } = escort;
    return res.json(escortData);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener información del perfil.' });
  }
});

// CAMBIAR CONTRASEÑA DE ESCORT
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Proporciona la contraseña actual y la nueva.' });
    }

    const escort = await db.getEscortById(req.user.id);
    if (!escort) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const isValid = await bcrypt.compare(currentPassword, escort.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.updateEscort(escort.id, { passwordHash: newHash });

    return res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al cambiar contraseña.' });
  }
});

export default router;
