import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { uploadBufferToMinio, deleteFromMinio } from '../services/minioService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // Max 50MB for video/images
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

const router = express.Router();

// Actualizar perfil
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const escortId = req.user.id;
    const { name, age, nationality, bodyType, city, zone, phone, whatsapp, telegram, hourlyRate, currency, bio, services, schedule, avatarUrl } = req.body;

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (age !== undefined) updateFields.age = parseInt(age);
    if (nationality !== undefined) updateFields.nationality = nationality;
    if (bodyType !== undefined) updateFields.bodyType = bodyType;
    if (city !== undefined) updateFields.city = city;
    if (zone !== undefined) updateFields.zone = zone;
    if (phone !== undefined) updateFields.phone = phone;
    if (whatsapp !== undefined) updateFields.whatsapp = whatsapp;
    if (telegram !== undefined) updateFields.telegram = telegram;
    if (hourlyRate !== undefined) updateFields.hourlyRate = parseFloat(hourlyRate);
    if (currency !== undefined) updateFields.currency = currency;
    if (bio !== undefined) updateFields.bio = bio;
    if (services !== undefined) updateFields.services = services;
    if (schedule !== undefined) updateFields.schedule = schedule;
    if (avatarUrl !== undefined) updateFields.avatarUrl = avatarUrl;

    const updated = await db.updateEscort(escortId, updateFields);
    if (!updated) {
      return res.status(404).json({ error: 'Perfil no encontrado.' });
    }
    const { passwordHash: _, ...escortData } = updated;
    return res.json(escortData);
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    return res.status(500).json({ error: 'Error al actualizar información del perfil.' });
  }
});

// Cambiar disponibilidad
router.patch('/availability', authenticateToken, async (req, res) => {
  try {
    const escortId = req.user.id;
    const { isAvailable } = req.body;
    const updated = await db.updateEscort(escortId, { isAvailable: Boolean(isAvailable) });
    return res.json({ isAvailable: updated.isAvailable });
  } catch (error) {
    return res.status(500).json({ error: 'Error al actualizar disponibilidad.' });
  }
});

// Subir foto o video a la Galería
router.post('/photos', authenticateToken, upload.single('media'), async (req, res) => {
  try {
    const escortId = req.user.id;
    let mediaUrl = req.body.mediaUrl;
    let mediaType = 'IMAGE';

    if (req.file) {
      if (req.file.mimetype.startsWith('video/')) {
        mediaType = 'VIDEO';
      }
      mediaUrl = await uploadBufferToMinio(req.file.buffer, req.file.originalname, req.file.mimetype, 'photos');
    } else if (req.body.mediaType) {
      mediaType = req.body.mediaType;
    }

    if (!mediaUrl) {
      return res.status(400).json({ error: 'Por favor adjunta un archivo o proporciona una URL.' });
    }

    const isPrimary = req.body.isPrimary === 'true' || req.body.isPrimary === true;
    const photo = await db.addPhoto(escortId, mediaUrl, isPrimary, mediaType);

    if (isPrimary || req.body.setAvatar === 'true') {
      await db.updateEscort(escortId, { avatarUrl: mediaUrl });
    }

    return res.status(201).json(photo);
  } catch (error) {
    console.error('Error al subir multimedia:', error);
    return res.status(500).json({ error: 'Error al subir archivo multimedia.' });
  }
});

// PUBLICAR HISTORIA DE 24 HORAS
router.post('/stories', authenticateToken, upload.single('media'), async (req, res) => {
  try {
    const escortId = req.user.id;
    let mediaUrl = req.body.mediaUrl;
    let mediaType = 'IMAGE';
    const caption = req.body.caption || '';

    if (req.file) {
      if (req.file.mimetype.startsWith('video/')) {
        mediaType = 'VIDEO';
      }
      mediaUrl = await uploadBufferToMinio(req.file.buffer, req.file.originalname, req.file.mimetype, 'stories');
    } else if (req.body.mediaType) {
      mediaType = req.body.mediaType;
    }

    if (!mediaUrl) {
      return res.status(400).json({ error: 'Por favor adjunta una imagen o video para tu historia.' });
    }

    const story = await db.addStory(escortId, mediaUrl, mediaType, caption);
    return res.status(201).json(story);
  } catch (error) {
    console.error('Error al publicar historia:', error);
    return res.status(500).json({ error: 'Error al publicar la historia de 24h.' });
  }
});

// Eliminar historia
router.delete('/stories/:id', authenticateToken, async (req, res) => {
  try {
    const escortId = req.user.id;
    const escort = await db.getEscortById(escortId);
    if (escort && escort.stories) {
      const story = escort.stories.find(s => s.id === req.params.id);
      if (story && story.url) {
        await deleteFromMinio(story.url);
      }
    }
    await db.deleteStory(req.params.id, escortId);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Error al eliminar historia.' });
  }
});

// Definir foto principal
router.patch('/photos/:id/primary', authenticateToken, async (req, res) => {
  try {
    const escortId = req.user.id;
    const photoId = req.params.id;
    const escort = await db.getEscortById(escortId);

    const photo = (escort.photos || []).find(p => p.id === photoId);
    if (!photo) return res.status(404).json({ error: 'Fotografía no encontrada.' });

    await db.setPrimaryPhoto(escortId, photo.url);
    return res.json({ success: true, avatarUrl: photo.url });
  } catch (error) {
    return res.status(500).json({ error: 'Error al establecer foto principal.' });
  }
});

// Eliminar foto
router.delete('/photos/:id', authenticateToken, async (req, res) => {
  try {
    const escortId = req.user.id;
    const photoId = req.params.id;
    const escort = await db.getEscortById(escortId);
    if (escort && escort.photos) {
      const photo = escort.photos.find(p => p.id === photoId);
      if (photo && photo.url) {
        await deleteFromMinio(photo.url);
      }
    }
    await db.deletePhoto(photoId, escortId);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Error al eliminar multimedia.' });
  }
});

// Analytics & Consejos Inteligentes (AI Smart Profile Coach)
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const escort = await db.getEscortById(req.user.id);
    if (!escort) return res.status(404).json({ error: 'Perfil no encontrado.' });

    const totalViews = escort.profileViews || 0;
    const totalWhatsappClicks = escort.whatsappClicks || 0;
    const photoCount = (escort.photos || []).length;
    const storyCount = (escort.stories || []).length;
    const conversionRate = totalViews > 0 ? ((totalWhatsappClicks / totalViews) * 100).toFixed(1) : 0;

    // Smart Tips System
    const tips = [];

    if (storyCount === 0) {
      tips.push({
        id: 'tip_stories',
        title: 'Publica una Historia de 24 Horas 📸',
        desc: 'Los perfiles con historias activas obtienen un aro brillante tipo Instagram y reciben 2.5x más clics.',
        action: 'Publicar Historia Ahora'
      });
    }

    if (!escort.isVerified) {
      tips.push({
        id: 'tip_verify',
        title: 'Verifica tu perfil',
        desc: 'Los perfiles con la insignia "Verificado ✔️" obtienen un 60% más de clics en WhatsApp.',
        action: 'Solicitar Verificación Gratis'
      });
    }

    if (photoCount < 4) {
      tips.push({
        id: 'tip_photos',
        title: 'Sube al menos 4 fotografías en HD',
        desc: 'Tu perfil actualmente tiene ' + photoCount + ' fotos. Los clientes prefieren galerías abundantes.',
        action: 'Subir más fotos'
      });
    }

    return res.json({
      metrics: {
        profileViews: totalViews,
        whatsappClicks: totalWhatsappClicks,
        conversionRate: `${conversionRate}%`,
        photosUploaded: photoCount,
        storiesActive: storyCount
      },
      tips
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener analytics.' });
  }
});

export default router;
