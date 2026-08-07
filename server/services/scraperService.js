import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

/**
 * Extractor especializado de Fotos para Skokka y Clasificados Adultos
 */
function extractSkokkaPhotos(html, targetUrl) {
  const photos = [];

  function pushPhoto(url) {
    if (!url || typeof url !== 'string') return;
    let clean = url.replace(/\\/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
    
    // Si viene dentro de objeto JSON/Vue {'url': 'https://...'}
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

  // 1. Decodificar entidades HTML como &#x27; en el HTML completo
  const decodedHtml = html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

  // 2. Extraer de <post-gallery :items="[...]"> o JSON inline de Skokka
  const postGalleryMatch = decodedHtml.match(/:items="(\[.*?\])"/s) || decodedHtml.match(/items:\s*(\[.*?\])/s);
  if (postGalleryMatch) {
    const rawItems = postGalleryMatch[1];
    const imgMatches = rawItems.match(/https?:\/\/[^\s"'<>]+(?:\.jpg|\.png|\.jpeg|\.webp)/gi);
    if (imgMatches) {
      imgMatches.forEach(img => pushPhoto(img));
    }
  }

  // 3. Extraer de metatag og:image
  const $ = cheerio.load(html);
  $('meta[property="og:image"], meta[name="og:image"]').each((i, el) => {
    pushPhoto($(el).attr('content'));
  });

  // 4. Extraer de enlaces de imagen de Skokka / CDN
  const skokkaPattern = /(https?:\/\/do\.skokka\.com\/image\/post\/[^\s"'<>\)\\]+)/gi;
  let match;
  while ((match = skokkaPattern.exec(decodedHtml)) !== null) {
    pushPhoto(match[1]);
  }

  // 5. Extraer cualquier otra URL de imagen .jpg/.jpeg/.png/.webp
  const genPattern = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp))/gi;
  while ((match = genPattern.exec(decodedHtml)) !== null) {
    pushPhoto(match[1]);
  }

  return photos.slice(0, 10);
}

/**
 * Función Principal para parsear HTML de Skokka e Importar Perfil
 */
export async function parseAndSaveProfileFromHtml(html, targetUrl = 'https://do.skokka.com', customCity = 'Santo Domingo', customGender = 'FEMALE') {
  const $ = cheerio.load(html);

  // 1. Extraer Apodo / Nombre
  let nickname = $('[data-testid="ad-detail-nickname"]').text().trim();
  let fullTitle = $('h1[data-testid="ad-detail-title"], h1').first().text().trim();
  
  let name = nickname || fullTitle || $('title').text().split('-')[0].trim() || 'Modelo VIP';
  // Limpiar emojis y caracteres especiales del título si era muy largo
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

  // 6. Extraer Nacionalidad si existe en tags
  let nationality = 'Dominicana';
  if (html.includes('Colombiana')) nationality = 'Colombiana';
  else if (html.includes('Venezolana')) nationality = 'Venezolana';
  else if (html.includes('Dominicana')) nationality = 'Dominicana';

  // 7. Extraer Galería Completa de Fotos
  const photos = extractSkokkaPhotos(html, targetUrl);

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
    nationality,
    city,
    zone: 'Centro',
    phone: whatsapp,
    whatsapp,
    hourlyRate: 4000,
    currency: 'DOP',
    services: 'Acompañante VIP, Trato de Novios, Cenas, Eventos',
    bio,
    avatarUrl,
    isAvailable: true,
    isVerified: true,
    isFeatured: true
  });

  // Registrar fotos en la galería de la base de datos
  for (const pUrl of photos) {
    await db.addPhoto(escort.id, pUrl, pUrl === avatarUrl);
  }

  console.log(`[Scraper] ✅ Perfil importado con éxito: ${name} (Edad: ${age}, Ciudad: ${city}, Tel: ${whatsapp}) con ${photos.length} fotos.`);
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
