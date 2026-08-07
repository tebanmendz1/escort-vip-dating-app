import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// Dynamic Robots.txt
router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.send(`User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /escort-dashboard.html
Disallow: /api/admin/
Disallow: /api/escort/

Sitemap: ${baseUrl}/sitemap.xml
`);
});

// Dynamic Sitemap.xml for Google Indexing
router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const escorts = await db.getEscorts();

    const staticPages = [
      '',
      '/escort-login.html',
      '/escort-register.html',
      '/terms.html',
      '/privacy.html'
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    // Static URLs
    staticPages.forEach(page => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${page}</loc>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>${page === '' ? '1.0' : '0.8'}</priority>\n`;
      xml += `  </url>\n`;
    });

    // Dynamic Escort Profiles URLs & Images
    escorts.forEach(escort => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/#profile-${escort.id}</loc>\n`;
      xml += `    <lastmod>${new Date(escort.updatedAt || Date.now()).toISOString().split('T')[0]}</lastmod>\n`;
      xml += `    <changefreq>hourly</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      if (escort.avatarUrl) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${baseUrl}/${escort.avatarUrl.replace(/^\//, '')}</image:loc>\n`;
        xml += `      <image:title>${escort.name} - Escort VIP en ${escort.city}</image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.type('application/xml');
    return res.send(xml);
  } catch (error) {
    console.error('Error al generar sitemap.xml:', error);
    return res.status(500).send('Error al generar sitemap');
  }
});

export default router;
