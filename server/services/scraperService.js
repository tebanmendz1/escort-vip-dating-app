import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { db } from '../db.js';

/**
 * Genera un Watermark SVG colocado estratégicamente en el CENTRO de la imagen (donde Skokka estampa su logo)
 */
function createWatermarkSvg(width, height) {
  const fontSize = Math.max(16, Math.floor(width * 0.048));
  const svgWidth = Math.floor(width * 0.72);
  const svgHeight = Math.floor(fontSize * 2.6);

  // Posición CENTRAL exacta donde Skokka coloca su logo
  const centerX = Math.floor((width - svgWidth) / 2);
  const centerY = Math.floor((height - svgHeight) / 2);

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.8"/>
        </filter>
      </defs>
      <style>
        .watermark-pill {
          fill: rgba(12, 12, 20, 0.92);
          stroke: #FF2A7A;
          stroke-width: 2.5px;
          rx: 20px;
          ry: 20px;
          filter: url(#shadow);
        }
        .watermark-text {
          fill: #FFFFFF;
          font-family: Arial, sans-serif;
          font-size: ${fontSize}px;
          font-weight: 900;
          letter-spacing: 2px;
        }
        .watermark-sub {
          fill: #FF2A7A;
          font-weight: 900;
        }
      </style>
      <!-- Badge Central que Tapará 100% el Logo de Skokka -->
      <g transform="translate(${centerX}, ${centerY})">
        <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" class="watermark-pill"/>
        <text x="${svgWidth / 2}" y="${svgHeight / 2 + fontSize * 0.35}" text-anchor="middle" class="watermark-text">
          <tspan class="watermark-sub">🔥 </tspan>CITASRD.APP
        </text>
      </g>
    </svg>
  `;
}

/**
 * Descarga y estampa nuestra marca de agua oficial (ESCORTSVIP.DO) tapando el logo central de Skokka
 */
async function downloadAndWatermarkPhoto(imageUrl, escortId, index) {
  try {
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!res.ok) return imageUrl;

    const buffer = Buffer.from(await res.arrayBuffer());
    
    // Leer dimensiones de la imagen con Sharp
    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;

    if (width && height && height > 150) {
      const dirPath = path.join(process.cwd(), 'server', 'uploads', 'scraped');
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const filename = `escort_${escortId}_${index + 1}_${Date.now()}.jpg`;
      const filePath = path.join(dirPath, filename);

      const watermarkSvg = createWatermarkSvg(width, height);

      await sharp(buffer)
        .composite([{ input: Buffer.from(watermarkSvg), top: 0, left: 0 }])
        .jpeg({ quality: 93 })
        .toFile(filePath);

      return `uploads/scraped/${filename}`;
    }

    return imageUrl;
  } catch (err) {
    console.error(`[Scraper] Error al estampar marca de agua central ESCORTSVIP.DO en imagen ${index + 1}:`, err.message);
    return imageUrl;
  }
}

/**
 * Extractor especializado de Fotos para Skokka
 */
function extractSkokkaPhotos(html, targetUrl) {
  const photos = [];

  function pushPhoto(url) {
    if (!url || typeof url !== 'string') return;
    let clean = url.replace(/\\/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
    
    const urlMatch = clean.match(/(https?:\/\/[^\s"'<>]+(?:\.jpg|\.png|\.jpeg|\.webp)[^\s"'<>]*)/i);
    if (urlMatch) {
      clean = urlMatch[1];
    }

    if (clean.startsWith('//')) clean = `https:${clean}`;

    const lower = clean.toLowerCase();
    if (
      lower.includes('logo') ||
      lower.includes('icon') ||
      lower.includes('favicon') ||
      lower.includes('svg') ||
      lower.includes('blank.gif') ||
      lower.includes('loader')
    ) {
      return;
    }

    if ((clean.startsWith('http://') || clean.startsWith('https://')) && !photos.includes(clean)) {
      photos.push(clean);
    }
  }

  const decodedHtml = html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

  // 1. Extraer de <post-gallery :items="[...]"> de Skokka
  const postGalleryMatch = decodedHtml.match(/:items="(\[.*?\])"/s) || decodedHtml.match(/items:\s*(\[.*?\])/s);
  if (postGalleryMatch) {
    const rawItems = postGalleryMatch[1];
    const imgMatches = rawItems.match(/https?:\/\/[^\s"'<>]+(?:\.jpg|\.png|\.jpeg|\.webp)/gi);
    if (imgMatches) {
      imgMatches.forEach(img => pushPhoto(img));
    }
  }

  // 2. Metatag og:image
  const $ = cheerio.load(html);
  $('meta[property="og:image"], meta[name="og:image"]').each((i, el) => {
    pushPhoto($(el).attr('content'));
  });

  // 3. URLs de Skokka / CDN
  const skokkaPattern = /(https?:\/\/do\.skokka\.com\/image\/post\/[^\s"'<>\)\\]+)/gi;
  let match;
  while ((match = skokkaPattern.exec(decodedHtml)) !== null) {
    pushPhoto(match[1]);
  }

  return photos.slice(0, 10);
}

/**
 * Función Principal para parsear HTML de Skokka e Importar Perfil con Secciones Organizadas y Marca de Agua ESCORTSVIP.DO Central
 */
export async function parseAndSaveProfileFromHtml(html, targetUrl = 'https://do.skokka.com', customCity = 'Santo Domingo', customGender = 'FEMALE') {
  const $ = cheerio.load(html);

  // 1. Extraer Apodo / Nombre
  let nickname = $('[data-testid="ad-detail-nickname"]').text().trim();
  let fullTitle = $('h1[data-testid="ad-detail-title"], h1').first().text().trim();
  
  let name = nickname || fullTitle || $('title').text().split('-')[0].trim() || 'Modelo VIP';
  name = name.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
  if (!name || name.length < 2) name = 'Yesica VIP';
  if (name.length > 25) name = name.substring(0, 25);

  // 2. Extraer Edad
  let age = 23;
  const ageElementText = $('[data-testid="ad-detail-age"]').text().trim();
  const ageMatch = ageElementText.match(/(\d{2})/) || html.match(/(\d{2})\s*(años|years)/i);
  if (ageMatch) {
    age = parseInt(ageMatch[1]);
  }

  // 3. Extraer Teléfono / WhatsApp
  let phoneStr = '';
  $('[data-testid*="post-phone-button"], [data-testid*="post-whatsapp-button"]').each((i, el) => {
    const val = $(el).attr('value');
    if (val && !phoneStr) {
      const nums = val.replace(/\D/g, '');
      if (nums.length >= 10) phoneStr = nums;
    }
  });

  if (!phoneStr) {
    const rawPhoneMatch = html.match(/(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
    phoneStr = rawPhoneMatch ? rawPhoneMatch[0].replace(/\D/g, '') : '8296458134';
  }

  const cleanPhone = phoneStr.length === 10 ? `1${phoneStr}` : phoneStr;
  const whatsapp = `+${cleanPhone}`;

  // 4. Extraer Ciudad
  const cityFromAd = $('[data-testid="ad-detail-city"]').text().trim().replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
  const city = cityFromAd || customCity || 'Santiago';

  // 5. Extraer Biografía Limpia
  let rawBio = $('[data-testid="ad-detail-description"]').text().trim();
  if (!rawBio) {
    rawBio = $('.listing-description, .description, p').text().trim();
  }
  let cleanBio = rawBio.substring(0, 400) || `Hola amor, recién llegada. Escríbeme y disfruta conmigo una noche inolvidable en ${city}.`;

  // 6. Extraer Secciones Estructuradas (:hierarchy JSON)
  let extractedServices = [];
  let attentionTo = [];
  let placeOfService = [];
  let paymentMethods = [];
  let aboutYou = [];

  const hierarchyMatch = html.match(/:hierarchy='(.*?)'/s) || html.match(/:hierarchy="(.*?)"/s);
  if (hierarchyMatch) {
    try {
      const hierarchyData = JSON.parse(hierarchyMatch[1]);
      if (hierarchyData && hierarchyData.sections) {
        hierarchyData.sections.forEach(sec => {
          if (sec.code === 'services' && sec.tags) {
            extractedServices = sec.tags.map(t => t.title);
          } else if (sec.code === 'attention_to' && sec.tags) {
            attentionTo = sec.tags.map(t => t.title);
          } else if (sec.code === 'place_of_service' && sec.tags) {
            placeOfService = sec.tags.map(t => t.title);
          } else if (sec.code === 'payment_methods' && sec.tags) {
            paymentMethods = sec.tags.map(t => t.title);
          } else if (sec.code === 'section_about_you' && sec.tags) {
            aboutYou = sec.tags.map(t => t.title);
          }
        });
      }
    } catch (e) {
      console.warn('[Scraper] No se pudo parsear :hierarchy JSON:', e.message);
    }
  }

  // 7. Extraer Nacionalidad
  let nationality = 'Dominicana';
  const natTag = aboutYou.find(t => t.includes('Colombiana') || t.includes('Venezolana') || t.includes('Dominicana'));
  if (natTag) {
    nationality = natTag.replace(/[^\w]/g, '').trim() || 'Colombiana';
  } else if (html.includes('Colombiana')) {
    nationality = 'Colombiana';
  }

  const servicesFormatted = extractedServices.length > 0
    ? extractedServices.join(', ')
    : 'Acompañante VIP, Trato de Novios, Cenas, Eventos';

  const extraDetails = [];
  if (aboutYou.length > 0) extraDetails.push(`✨ Características: ${aboutYou.join(', ')}`);
  if (attentionTo.length > 0) extraDetails.push(`👥 Atiendo a: ${attentionTo.join(', ')}`);
  if (placeOfService.length > 0) extraDetails.push(`📍 Lugar de encuentro: ${placeOfService.join(', ')}`);
  if (paymentMethods.length > 0) extraDetails.push(`💳 Métodos de pago: ${paymentMethods.join(', ')}`);

  const fullBio = extraDetails.length > 0
    ? `${cleanBio}\n\n${extraDetails.join('\n')}`
    : cleanBio;

  // 8. Extraer Fotos y Estampar Marca de Agua Central ESCORTSVIP.DO (Tapando a Skokka)
  const rawPhotos = extractSkokkaPhotos(html, targetUrl);

  const escortId = `scraped_${Date.now()}`;
  const defaultPassword = await bcrypt.hash('123456', 10);
  const email = `${name.toLowerCase().replace(/\s+/g, '')}_${Date.now()}@imported.citasrd.app`;

  const watermarkedPhotos = [];
  for (let i = 0; i < rawPhotos.length; i++) {
    const cleanUrl = await downloadAndWatermarkPhoto(rawPhotos[i], escortId, i);
    watermarkedPhotos.push(cleanUrl);
  }

  const avatarUrl = watermarkedPhotos.length > 0 ? watermarkedPhotos[0] : 'assets/images/escorts/female1.jpg';

  // Crear modelo en Base de Datos
  const escort = await db.createEscort({
    email,
    passwordHash: defaultPassword,
    name,
    gender: customGender,
    age,
    nationality,
    city,
    zone: 'Centro',
    phone: whatsapp,
    whatsapp,
    hourlyRate: 4000,
    currency: 'DOP',
    services: servicesFormatted,
    bio: fullBio,
    avatarUrl,
    isAvailable: true,
    isVerified: true,
    isFeatured: true
  });

  // Registrar fotos en la galería de la base de datos
  for (const pUrl of watermarkedPhotos) {
    await db.addPhoto(escort.id, pUrl, pUrl === avatarUrl);
  }

  console.log(`[Scraper] ✅ Perfil importado con éxito: ${name} (Marca de agua central CITASRD.APP estampada cubriendo Skokka en ${watermarkedPhotos.length} fotos).`);
  return {
    success: true,
    escort,
    importedPhotosCount: watermarkedPhotos.length,
    extractedServices,
    photos: watermarkedPhotos
  };
}

/**
 * Servicio Scraper por URL directa
 */
export async function scrapeAndImportProfile(targetUrl, customCity = 'Santo Domingo', customGender = 'FEMALE') {
  console.log(`[Scraper] Iniciando extracción desde URL: ${targetUrl}`);

  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`El sitio web bloqueó el acceso directo (HTTP ${response.status}). Utiliza la opción 'Pegar HTML / Bookmarklet'.`);
  }

  const html = await response.text();
  return await parseAndSaveProfileFromHtml(html, targetUrl, customCity, customGender);
}
