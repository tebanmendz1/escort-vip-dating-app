import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

/**
 * Función Auxiliar para parsear HTML de cualquier perfil (Skokka, etc.)
 */
export async function parseAndSaveProfileFromHtml(html, targetUrl = 'https://escortsvip.do', customCity = 'Santo Domingo', customGender = 'FEMALE') {
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

  // Extraer fotos de alta resolución
  const photos = [];
  $('img').each((i, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy');
    if (src && (src.endsWith('.jpg') || src.endsWith('.png') || src.endsWith('.jpeg') || src.endsWith('.webp') || src.includes('skokka') || src.includes('/uploads/'))) {
      let fullUrl = src;
      if (src.startsWith('//')) fullUrl = `https:${src}`;
      else if (src.startsWith('/')) {
        try {
          const urlObj = new URL(targetUrl);
          fullUrl = `${urlObj.origin}${src}`;
        } catch (e) {
          fullUrl = `https://do.skokka.com${src}`;
        }
      }
      if (!photos.includes(fullUrl) && photos.length < 8 && !fullUrl.includes('logo') && !fullUrl.includes('icon')) {
        photos.push(fullUrl);
      }
    }
  });

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

  console.log(`[Scraper] ✅ Perfil parseado e importado: ${name} (${escort.id}) con ${photos.length} fotos.`);
  return {
    success: true,
    escort,
    importedPhotosCount: photos.length
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
