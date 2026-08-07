import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

/**
 * Extractor Multi-Paso de Fotos para Skokka y Sitios de Escorts
 */
function extractAllPhotosFromHtml(html, targetUrl = 'https://do.skokka.com') {
  const $ = cheerio.load(html);
  const rawPhotos = [];

  function addCandidate(url) {
    if (!url || typeof url !== 'string') return;
    let clean = url.trim();

    // Normalizar URLs relativas
    if (clean.startsWith('//')) {
      clean = `https:${clean}`;
    } else if (clean.startsWith('/')) {
      try {
        const u = new URL(targetUrl);
        clean = `${u.origin}${clean}`;
      } catch (e) {
        clean = `https://do.skokka.com${clean}`;
      }
    }

    // Ignorar iconos, logos o avatares por defecto de plantillas
    const lower = clean.toLowerCase();
    if (
      lower.includes('logo') ||
      lower.includes('icon') ||
      lower.includes('favicon') ||
      lower.includes('svg') ||
      lower.includes('blank.gif') ||
      lower.includes('loader') ||
      lower.includes('avatar-default')
    ) {
      return;
    }

    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      if (!rawPhotos.includes(clean)) {
        rawPhotos.push(clean);
      }
    }
  }

  // 1. Meta Tags (og:image, twitter:image)
  $('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"], link[rel="image_src"]').each((i, el) => {
    addCandidate($(el).attr('content') || $(el).attr('href'));
  });

  // 2. Elementos <img>, <source>, <a> (Cheerio DOM Scan)
  $('img, source, a, div[data-src], div[data-image]').each((i, el) => {
    const $el = $(el);
    addCandidate($el.attr('src'));
    addCandidate($el.attr('data-src'));
    addCandidate($el.attr('data-original'));
    addCandidate($el.attr('data-lazy'));
    addCandidate($el.attr('data-big'));
    addCandidate($el.attr('data-zoom-image'));
    addCandidate($el.attr('href'));

    // Parsear srcset
    const srcset = $el.attr('srcset') || $el.attr('data-srcset');
    if (srcset) {
      const parts = srcset.split(',');
      parts.forEach(p => {
        const candidate = p.trim().split(' ')[0];
        addCandidate(candidate);
      });
    }
  });

  // 3. Regex Scan directo en todo el texto HTML
  const urlRegex = /(https?:\/\/[^\s"'<>\(\)]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?)/gi;
  let match;
  while ((match = urlRegex.exec(html)) !== null) {
    addCandidate(match[1]);
  }

  // Regex para CDN de Skokka / Clasificados
  const skokkaImgRegex = /(https?:\/\/[^\s"'<>]*(?:skokka|cdn|images|media)[^\s"'<>]*(?:photos|anuncios|uploads|images)[^\s"'<>]*)/gi;
  while ((match = skokkaImgRegex.exec(html)) !== null) {
    addCandidate(match[1]);
  }

  return rawPhotos.slice(0, 10);
}

/**
 * Función Principal para parsear HTML e importar Escort con Fotos
 */
export async function parseAndSaveProfileFromHtml(html, targetUrl = 'https://do.skokka.com', customCity = 'Santo Domingo', customGender = 'FEMALE') {
  const $ = cheerio.load(html);

  // Extraer nombre del perfil
  let name = $('h1').first().text().trim() || $('title').text().split('-')[0].trim() || 'Modelo VIP';
  name = name.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
  if (!name || name.length < 2) name = 'Escort VIP Auto';

  // Extraer edad
  const ageMatch = html.match(/(\d{2})\s*(años|años de edad|years)/i);
  const age = ageMatch ? parseInt(ageMatch[1]) : 23;

  // Extraer teléfono / WhatsApp
  const phoneMatch = html.match(/(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  const phone = phoneMatch ? phoneMatch[0].replace(/\D/g, '') : '18095551234';
  const whatsapp = phone.startsWith('1') ? `+${phone}` : `+1${phone}`;

  // Extraer biografía o descripción
  let bio = $('.listing-description, .description, p').text().trim().substring(0, 300) || `Hola, soy ${name}. Disponible para servicios exclusivos en ${customCity}.`;

  // Extraer fotos
  const photos = extractAllPhotosFromHtml(html, targetUrl);

  const avatarUrl = photos.length > 0 ? photos[0] : 'assets/images/escorts/female1.jpg';
  const defaultPassword = await bcrypt.hash('123456', 10);
  const email = `${name.toLowerCase().replace(/\s+/g, '')}_${Date.now()}@imported.escortsvip.do`;

  // Crear modelo en Base de Datos
  const escort = await db.createEscort({
    email,
    passwordHash: defaultPassword,
    name,
    gender: customGender,
    age,
    nationality: 'Dominicana',
    city: customCity,
    zone: 'Centro',
    phone: whatsapp,
    whatsapp,
    hourlyRate: 4000,
    currency: 'DOP',
    services: 'Acompañante VIP, Cenas, Eventos',
    bio,
    avatarUrl,
    isAvailable: true,
    isVerified: true,
    isFeatured: true
  });

  // Registrar fotos en galería
  for (const pUrl of photos) {
    await db.addPhoto(escort.id, pUrl, pUrl === avatarUrl);
  }

  console.log(`[Scraper] ✅ Perfil parseado e importado: ${name} (${escort.id}) con ${photos.length} fotos extraídas.`);
  return {
    success: true,
    escort,
    importedPhotosCount: photos.length,
    photos
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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
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
