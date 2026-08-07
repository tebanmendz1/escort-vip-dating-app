import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import escortRoutes from './routes/escortRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import seoRoutes from './routes/seoRoutes.js';
import seoPages from './routes/seoPages.js';
import { seedInitialData } from './seed.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount SEO Routes (Robots.txt & Sitemap.xml & Aggressive Landings)
app.use('/', seoRoutes);
app.use('/', seoPages);

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/escort', escortRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint for EasyPanel / Docker
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), service: 'Escort Platform API' });
});

// Serve frontend static files
app.use(express.static(rootDir));

// Fallback to index.html for SPA/frontend routes if requested page not found
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Ruta de API no encontrada.' });
  }
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Start Server
app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`🚀 Servidor Escort Platform ejecutándose en puerto ${PORT}`);
  console.log(`http://localhost:${PORT}`);
  console.log(`====================================================`);
  
  // Seed initial demo escorts
  try {
    await seedInitialData();
  } catch (err) {
    console.error('Error al sembrar datos iniciales:', err);
  }
});
