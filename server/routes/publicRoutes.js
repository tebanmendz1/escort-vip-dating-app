import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// Catálogo público de Escorts
router.get('/escorts', async (req, res) => {
  try {
    const { gender, city, nationality, bodyType, service, minAge, maxAge, isAvailable, maxRate, search } = req.query;

    const escorts = await db.getEscorts({
      gender,
      city,
      nationality,
      bodyType,
      service,
      minAge,
      maxAge,
      isAvailable,
      maxRate,
      search
    });

    const cleanEscorts = escorts.map(escort => {
      const { passwordHash: _, ...rest } = escort;
      return rest;
    });

    return res.json({
      count: cleanEscorts.length,
      escorts: cleanEscorts
    });
  } catch (error) {
    console.error('Error al listar escorts públicos:', error);
    return res.status(500).json({ error: 'Error al obtener el catálogo de escorts.' });
  }
});

// Detalle público de un Escort por ID (Incrementa vistas de perfil)
router.get('/escorts/:id', async (req, res) => {
  try {
    const escort = await db.getEscortById(req.params.id);
    if (!escort) {
      return res.status(404).json({ error: 'Escort no encontrado o inactivo.' });
    }

    // Registrar incremento de vistas
    await db.incrementProfileView(req.params.id);

    const { passwordHash: _, ...cleanEscort } = escort;
    return res.json(cleanEscort);
  } catch (error) {
    return res.status(500).json({ error: 'Error al consultar perfil de escort.' });
  }
});

// Registrar clic en WhatsApp (Lead counter)
router.post('/escorts/:id/whatsapp-click', async (req, res) => {
  try {
    await db.incrementWhatsappClick(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Error al registrar evento.' });
  }
});

export default router;
