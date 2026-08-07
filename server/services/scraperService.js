import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { db } from '../db.js';

/**
 * Descarga y remueve la marca de agua inferior de Skokka usando Sharp
 */
async function downloadAndCleanPhoto(imageUrl, escortId, index) {
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

    if (width && height && height > 200) {
      // Recortar el 6.5% inferior donde Skokka estampa su marca de agua
      const cropHeight = Math.floor(height * 0.935);
      
      const dirPath = path.join(process.cwd(), 'server', 'uploads', 'scraped');
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const filename = `escort_${escortId}_${index + 1}_${Date.now()}.jpg`;
      const filePath = path.join(dirPath, filename);

      await sharp(buffer)
        .extract({ left: 0, top: 0, width, height: cropHeight })
        .jpeg({ quality: 92 })
        .toFile(filePath);

      return `uploads/scraped/${filename}`;
    }

    return imageUrl;
  } catch (err) {
    console.error(`[Scraper] Error limpiando marca de agua en imagen ${index + 1}:`, err.message);
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
 * Función Principal para parsear HTML de Skokka e Importar Perfil con Metadatos Completos y Remover Marca de Agua
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

  // 5. Extraer Biografía / Descripción
  let bio = $('[data-testid="ad-detail-description"]').text().trim();
  if (!bio) {
    bio = $('.listing-description, .description, p').text().trim();
  }
  bio = bio.substring(0, 400) || `Hola amor, recién llegada. Escríbeme y disfruta conmigo en ${city}.`;

  // 6. Extraer Secciones Estructuradas (:hierarchy JSON: Servicios, A quien atiende, Lugar de encuentro, Métodos de Pago)
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

  // 7. Extraer Nacionalidad si existe en tags
  let nationality = 'Dominicana';
  const natTag = aboutYou.find(t => t.includes('Colombiana') || t.includes('Venezolana') || t.includes('Dominicana'));
  if (natTag) {
    nationality = natTag.replace(/[^\w]/g, '').trim() || 'Colombiana';
  } else if (html.includes('Colombiana')) {
    nationality = 'Colombiana';
  }

  // Formatear servicios
  const servicesFormatted = extractedServices.length > 0
    ? extractedServices.join(', ')
    : 'Acompañante VIP, Trato de Novios, Cenas, Eventos';

  // Añadir metadatos extendidos a la biografía
  const extraDetails = [];
  if (aboutYou.length > 0) extraDetails.push(`✨ Características: ${aboutYou.join(', ')}`);
  if (attentionTo.length > 0) extraDetails.push(`👥 Atiendo a: ${attentionTo.join(', ')}`);
  if (placeOfService.length > 0) extraDetails.push(`📍 Lugar de encuentro: ${placeOfService.join(', ')}`);
  if (paymentMethods.length > 0) extraDetails.push(`💳 Métodos de pago: ${paymentMethods.join(', ')}`);

  if (extraDetails.length > 0) {
    bio = `${bio}\n\n${extraDetails.join('\n')}`;
  }

  // 8. Extraer Fotos y Limpiar Marcas de Agua
  const rawPhotos = extractSkokkaPhotos(html, targetUrl);

  const escortId = `scraped_${Date.now()}`;
  const defaultPassword = await bcrypt.hash('123456', 10);
  const email = `${name.toLowerCase().replace(/\s+/g, '')}_${Date.now()}@imported.escortsvip.do`;

  // Limpiar marcas de agua recortando la franja inferior con Sharp
  const cleanedPhotos = [];
  for (let i = 0; i < rawPhotos.length; i++) {
    const cleanUrl = await downloadAndCleanPhoto(rawPhotos[i], escortId, i);
    cleanedPhotos.push(cleanUrl);
  }

  const avatarUrl = cleanedPhotos.length > 0 ? cleanedPhotos[0] : 'assets/images/escorts/female1.jpg';

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
    bio,
    avatarUrl,
    isAvailable: true,
    isVerified: true,
    isFeatured: true
  });

  // Registrar fotos en la galería de la base de datos
  for (const pUrl of cleanedPhotos) {
    await db.addPhoto(escort.id, pUrl, pUrl === avatarUrl);
  }

  console.log(`[Scraper] ✅ Perfil importado con éxito: ${name} (Servicios: ${extractedServices.length}, Fotos sin marca de agua: ${cleanedPhotos.length}).`);
  return {
    success: true,
    escort,
    importedPhotosCount: cleanedPhotos.length,
    extractedServices,
    photos: cleanedPhotos
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
