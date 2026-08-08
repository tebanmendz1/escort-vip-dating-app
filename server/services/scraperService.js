import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { db } from '../db.js';
import { uploadBufferWithDiagnostics, getMinioDiagnostics } from './minioService.js';


/**
 * Genera un Watermark SVG colocado estratégicamente en el CENTRO de la imagen (donde Skokka estampa su logo)
 */
function createWatermarkSvg(width, height) {
  const svgWidth = Math.floor(width * 0.78);
  const svgHeight = Math.floor(Math.max(30, width * 0.12));

  // Posición CENTRAL exacta donde Skokka coloca su logo
  const centerX = Math.floor((width - svgWidth) / 2);
  const centerY = Math.floor((height - svgHeight) / 2);

  const flameSize = Math.floor(svgHeight * 0.58);
  const flameY = Math.floor((svgHeight - flameSize) / 2);
  const scale = (svgHeight * 0.48) / 24;

  const fontPaths = {
    'C': 'M14 4C8.5 4 4 8.5 4 14s4.5 10 10 10c3.5 0 6.5-1.8 8.2-4.5h-4.2c-1.1 1.5-2.5 2.2-4 2.2-3.3 0-6-2.7-6-6s2.7-6 6-6c1.5 0 2.9.7 4 2.2h4.2C20.5 5.8 17.5 4 14 4z',
    'I': 'M4 4h5v20H4z',
    'T': 'M2 4h16v4.5h-5.5V24h-5V8.5H2z',
    'A': 'M8.5 4h5l6 20h-4.8l-1.3-4.5H8.6L7.3 24H2.5zM11 7.8L9.5 15h4z',
    'S': 'M12 4C8 4 4 6 4 10.5c0 6.5 9 4.2 9 8 0 1.8-1.5 3-4 3-2.5 0-4.5-1.2-5.5-3H0c1.2 4.2 5 7.5 9.5 7.5 5.5 0 9.5-3 9.5-7.5 0-6.8-9-4.5-9-8.2 0-1.6 1.5-2.8 3.8-2.8 2.2 0 4 1 5 2.2h3.5C16.5 5.2 14.5 4 12 4z',
    'R': 'M4 4h9c3.5 0 6 2 6 5.5 0 2.5-1.5 4.5-3.8 5.2L19 24h-5.5l-3.3-8.2H9V24H4V4zm5 4v5.5h3.8c1.5 0 2.5-.8 2.5-2.8 0-1.9-1-2.7-2.5-2.7H9z',
    'D': 'M4 4h8.5c5.5 0 9.5 3.8 9.5 10s-4 10-9.5 10H4V4zm5 4.5v11h3.5c3.2 0 5.2-2.3 5.2-5.5s-2-5.5-5.2-5.5H9z',
    '.': 'M2 19h5.5v5H2z',
    'P': 'M4 4h9c3.5 0 6 2.2 6 5.8S16.5 15.5 13 15.5H9V24H4V4zm5 4v4.5h3.8c1.5 0 2.5-.8 2.5-2.3 0-1.5-1-2.2-2.5-2.2H9z'
  };

  const letterWidths = {
    'C': 22, 'I': 10, 'T': 18, 'A': 20, 'S': 20, 'R': 20, 'D': 22, '.': 9, 'P': 19
  };

  const word = 'CITASRD.APP';
  let totalWordWidth = 0;
  for (let char of word) {
    totalWordWidth += (letterWidths[char] || 18) + 4;
  }

  const startX = Math.floor((svgWidth - totalWordWidth * scale) / 2 + flameSize * 0.4);
  const textY = Math.floor((svgHeight - 24 * scale) / 2);

  let currentX = startX;
  let letterPathsSvg = '';

  for (let char of word) {
    const p = fontPaths[char];
    const w = letterWidths[char] || 18;
    if (p) {
      letterPathsSvg += `<g transform="translate(${Math.round(currentX)}, ${textY}) scale(${scale})"><path fill="#FFFFFF" d="${p}"/></g>`;
    }
    currentX += (w + 4) * scale;
  }

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.95"/>
        </filter>
        <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FF2A7A"/>
          <stop offset="100%" stop-color="#FF758C"/>
        </linearGradient>
      </defs>
      <g transform="translate(${centerX}, ${centerY})" filter="url(#shadow)">
        <!-- Container Pill Badge -->
        <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" rx="${Math.floor(svgHeight / 2)}" ry="${Math.floor(svgHeight / 2)}" fill="#0A0B14" fill-opacity="0.96" stroke="#FF2A7A" stroke-width="3"/>
        
        <!-- Vector Flame Icon -->
        <g transform="translate(${Math.floor(svgWidth * 0.05)}, ${flameY}) scale(${flameSize / 24})">
          <path fill="url(#neonGrad)" d="M12 23c6.075 0 11-4.925 11-11 0-4.04-2.18-7.57-5.43-9.5a.75.75 0 0 0-1.12.82c.45 1.83.1 3.82-.99 5.34-1.2 1.67-3.15 2.5-5.11 2.22a8.03 8.03 0 0 1-5.74-5.38.75.75 0 0 0-1.3-.23C2.12 7.08 1 9.9 1 12c0 6.075 4.925 11 11 11z"/>
        </g>

        <!-- Pure Vector Text Paths (0% Font Dependency) -->
        ${letterPathsSvg}
      </g>
    </svg>
  `;
}

/**
 * Descarga y estampa nuestra marca de agua oficial (ESCORTSVIP.DO) tapando el logo central de Skokka
 */
async function downloadAndWatermarkPhoto(imageUrl, escortId, index) {
  try {
    let fetchUrl = imageUrl;
    if (fetchUrl.startsWith('//')) fetchUrl = `https:${fetchUrl}`;

    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://do.skokka.com/',
        'Origin': 'https://do.skokka.com',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      console.warn(`[Scraper] HTTP ${res.status} al descargar foto ${index + 1}: ${fetchUrl}`);
      return { sourceUrl: fetchUrl, url: null, storage: 'failed', verified: false, error: `HTTP ${res.status}` };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    
    // Leer dimensiones de la imagen con Sharp
    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;

    if (width && height && height > 100) {
      const filename = `escort_${escortId}_${index + 1}_${Date.now()}.jpg`;
      const watermarkSvg = createWatermarkSvg(width, height);

      const watermarkedBuffer = await sharp(buffer)
        .composite([{ input: Buffer.from(watermarkSvg), top: 0, left: 0 }])
        .jpeg({ quality: 93 })
        .toBuffer();

      const upload = await uploadBufferWithDiagnostics(watermarkedBuffer, filename, 'image/jpeg', 'scraped');
      return { sourceUrl: fetchUrl, ...upload };
    }

    return { sourceUrl: fetchUrl, url: null, storage: 'failed', verified: false, error: 'Dimensiones de imagen inválidas' };
  } catch (err) {
    console.error(`[Scraper] Error al estampar marca de agua central ESCORTSVIP.DO en imagen ${index + 1}:`, err.message);
    return { sourceUrl: imageUrl, url: null, storage: 'failed', verified: false, error: err.message };
  }
}

/**
 * Extractor especializado de Fotos para Skokka (Escaneo exhaustivo multi-pase)
 */
function extractSkokkaPhotos(html, targetUrl) {
  const photos = [];

  function pushPhoto(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return;
    
    // 1. Desinfectar comillas, barras invertidas y entidades XML/HTML al inicio y final
    let clean = rawUrl
      .replace(/\\/g, '')
      .replace(/["']/g, '')
      .replace(/&#x27;/g, '')
      .replace(/&quot;/g, '')
      .trim();

    // 2. Normalizar URLs relativas de Skokka (/image/post/...)
    if (clean.startsWith('//')) clean = `https:${clean}`;
    if (clean.startsWith('/image/') || clean.startsWith('/')) {
      clean = `https://do.skokka.com${clean.startsWith('/') ? '' : '/'}${clean}`;
    }

    // 3. Extraer patrón de URL de imagen limpia
    const urlMatch = clean.match(/(https?:\/\/[^\s"'<>]+(?:\.jpg|\.png|\.jpeg|\.webp)[^\s"'<>]*)/i) 
                  || clean.match(/(https?:\/\/[^\s"'<>]*skokka[^\s"'<>]*\/image\/post\/[^\s"'<>]*)/i);
    if (urlMatch) {
      clean = urlMatch[1];
    }

    // Filtrar recursos que no son fotos del catálogo (logos, avatars, icons)
    const lower = clean.toLowerCase();
    if (
      lower.includes('logo') ||
      lower.includes('icon') ||
      lower.includes('favicon') ||
      lower.includes('svg') ||
      lower.includes('blank.gif') ||
      lower.includes('loader') ||
      lower.includes('avatar')
    ) {
      return;
    }

    if ((clean.startsWith('http://') || clean.startsWith('https://')) && !photos.includes(clean)) {
      photos.push(clean);
    }
  }

  const decodedHtml = html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
  const $ = cheerio.load(decodedHtml);

  // 1. Escanear absolutamente TODOS los elementos DOM y TODOS sus atributos
  $('*').each((i, el) => {
    const attribs = el.attribs || {};
    Object.keys(attribs).forEach(attrName => {
      const val = attribs[attrName];
      if (val && typeof val === 'string' && (val.includes('/image/') || val.includes('skokka') || val.includes('.jpg') || val.includes('.png') || val.includes('.webp'))) {
        if (val.includes(',')) {
          val.split(',').forEach(s => pushPhoto(s.trim().split(' ')[0]));
        } else {
          pushPhoto(val);
        }
      }
    });
  });

  // 2. Metatags OpenGraph y Twitter
  $('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"]').each((i, el) => {
    pushPhoto($(el).attr('content'));
  });

  // 3. Extracción de JSON / JSON-LD Schema
  $('script').each((i, el) => {
    const content = $(el).html() || '';
    if (content.includes('image') || content.includes('photo') || content.includes('post')) {
      const matches = content.match(/(?:https?:\/\/[^\s"'<>]+|\/image\/post\/[^\s"'<>]+)(?:\.jpg|\.png|\.jpeg|\.webp|[^\s"'<>]*)/gi);
      if (matches) matches.forEach(img => pushPhoto(img));
    }
  });

  // 4. Bloques Vue :items o arrays javascript
  const vueMatches = decodedHtml.match(/(\[.*?\])/gs);
  if (vueMatches) {
    vueMatches.forEach(block => {
      if (block.includes('/image/') || block.includes('http') || block.includes('jpg') || block.includes('png') || block.includes('webp')) {
        const imgs = block.match(/(?:https?:\/\/[^\s"'<>]+|\/image\/post\/[^\s"'<>]+)(?:\.jpg|\.png|\.jpeg|\.webp|[^\s"'<>]*)/gi);
        if (imgs) imgs.forEach(img => pushPhoto(img));
      }
    });
  }

  // 5. Escaneo directo de todas las referencias de ruta relativas /image/post/ en el HTML
  const rawPostMatches = decodedHtml.match(/(\/image\/post\/[^\s"'<>\)\\]+)/gi);
  if (rawPostMatches) {
    rawPostMatches.forEach(m => pushPhoto(m));
  }

  // 6. Patrón universal de imágenes CDN Skokka
  const skokkaPattern = /(https?:\/\/[^\s"'<>]*(?:skokka|cdn|image|post)[^\s"'<>]*\/image\/post\/[^\s"'<>\)\\]+)/gi;
  let match;
  while ((match = skokkaPattern.exec(decodedHtml)) !== null) {
    pushPhoto(match[1]);
  }

  // 7. Reconstrucción inteligente de URLs desde hashes de imagen MD5 Skokka (32 caracteres hexadecimales)
  // Ejemplo: bb49bca2f44e4a4fae2807cae70addcb.jpg -> https://do.skokka.com/image/post/bb/49/bb49bca2f44e4a4fae2807cae70addcb.jpg
  const md5ImagePattern = /\b([a-f0-9]{32}\.(?:jpg|png|jpeg|webp))\b/gi;
  let md5Match;
  while ((md5Match = md5ImagePattern.exec(html)) !== null) {
    const filename = md5Match[1];
    const p1 = filename.substring(0, 2);
    const p2 = filename.substring(2, 4);
    const fullSkokkaUrl = `https://do.skokka.com/image/post/${p1}/${p2}/${filename}`;
    pushPhoto(fullSkokkaUrl);
  }

  // 8. Patrón genérico de imágenes de alta resolución
  const genericPhotoPattern = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp))/gi;
  while ((match = genericPhotoPattern.exec(decodedHtml)) !== null) {
    pushPhoto(match[1]);
  }

  return photos.slice(0, 15);
}

/**
 * Consulta la API pública de Skokka para obtener todas las fotos originales del anuncio
 */
async function fetchSkokkaAdApiPhotos(adId) {
  if (!adId) return [];
  const photos = [];
  const apiUrls = [
    `https://do.skokka.com/eu/api/ad/${adId}/`,
    `https://do.skokka.com/api/ad/${adId}/`
  ];

  for (const apiUrl of apiUrls) {
    try {
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://do.skokka.com/',
          'Accept': 'application/json, text/plain, */*'
        }
      });
      if (res.ok) {
        const jsonStr = await res.text();
        const matches = jsonStr.match(/(?:https?:)?\/\/[^\s"'<>]+\.(?:jpg|png|jpeg|webp)/gi) 
                     || jsonStr.match(/\/image\/post\/[^\s"'<>]+\.(?:jpg|png|jpeg|webp)/gi);
        if (matches) {
          matches.forEach(m => {
            let clean = m.replace(/\\/g, '');
            if (clean.startsWith('//')) clean = `https:${clean}`;
            if (clean.startsWith('/image/')) clean = `https://do.skokka.com${clean}`;
            if (clean.startsWith('http') && !photos.includes(clean)) {
              photos.push(clean);
            }
          });
        }

        const md5Matches = jsonStr.match(/\b([a-f0-9]{32}\.(?:jpg|png|jpeg|webp))\b/gi);
        if (md5Matches) {
          md5Matches.forEach(filename => {
            const p1 = filename.substring(0, 2);
            const p2 = filename.substring(2, 4);
            const fullUrl = `https://do.skokka.com/image/post/${p1}/${p2}/${filename}`;
            if (!photos.includes(fullUrl)) photos.push(fullUrl);
          });
        }
      }
    } catch (e) {
      console.warn(`[Scraper] Intento API ${apiUrl} omitido:`, e.message);
    }
  }
  return photos;
}

/**
 * Función Principal para parsear HTML de Skokka e Importar Perfil con Secciones Organizadas y Marca de Agua ESCORTSVIP.DO Central
 */
export async function parseAndSaveProfileFromHtml(html, targetUrl = 'https://do.skokka.com', customCity = 'Santo Domingo', customGender = 'FEMALE') {
  const $ = cheerio.load(html);

  // 1. Extraer Apodo / Nombre
  let nickname = $('[data-testid="ad-detail-nickname"]').text().trim();
  let fullTitle = $('h1[data-testid="ad-detail-title"], h1').first().text().trim();
  
  let name = nickname || fullTitle || $('title').text().split('-')[0].trim() || '';
  name = name.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
  if (name.length < 2) name = '';
  if (name.length > 25) name = name.substring(0, 25);

  // 2. Extraer Edad
  let age = null;
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
    phoneStr = rawPhoneMatch ? rawPhoneMatch[0].replace(/\D/g, '') : '';
  }

  const cleanPhone = phoneStr.length === 10 ? `1${phoneStr}` : phoneStr;
  const whatsapp = cleanPhone ? `+${cleanPhone}` : '';

  // 4. Extraer Ciudad
  const cityFromAd = $('[data-testid="ad-detail-city"]').text().trim().replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
  const city = cityFromAd || customCity || '';

  // 5. Extraer Biografía Limpia
  let rawBio = $('[data-testid="ad-detail-description"]').text().trim();
  if (!rawBio) {
    rawBio = $('.listing-description, .description, p').text().trim();
  }
  let cleanBio = rawBio.substring(0, 400) || '';

  // 6. Extraer Secciones Estructuradas (Servicios, A quién atiendes, Lugar, Métodos de Pago, Características)
  let extractedServices = [];
  let attentionTo = [];
  let placeOfService = [];
  let paymentMethods = [];
  let aboutYou = [];

  // A) Extracción Directa desde Elementos DOM HTML (.tags-list-detail, .tags-sections-detail)
  $('.tags-list-detail').each((i, el) => {
    const titleText = $(el).find('h5, strong').text().trim().toLowerCase();
    const tags = [];
    $(el).find('.badge, .badge-pill, span').each((j, tagEl) => {
      const tagVal = $(tagEl).text().trim();
      if (tagVal && !tags.includes(tagVal)) tags.push(tagVal);
    });

    if (tags.length > 0) {
      if (titleText.includes('servicio')) {
        extractedServices.push(...tags);
      } else if (titleText.includes('quien') || titleText.includes('atiend')) {
        attentionTo.push(...tags);
      } else if (titleText.includes('lugar') || titleText.includes('encuentro')) {
        placeOfService.push(...tags);
      } else if (titleText.includes('pago') || titleText.includes('método') || titleText.includes('metodo')) {
        paymentMethods.push(...tags);
      } else {
        aboutYou.push(...tags);
      }
    }
  });

  // B) Fallback: Extracción desde atributo :hierarchy JSON si el DOM HTML no contenía las clases
  const hierarchyMatch = html.match(/:hierarchy='(.*?)'/s) || html.match(/:hierarchy="(.*?)"/s);
  if (hierarchyMatch) {
    try {
      const hierarchyData = JSON.parse(hierarchyMatch[1]);
      if (hierarchyData && hierarchyData.sections) {
        hierarchyData.sections.forEach(sec => {
          if (sec.code === 'services' && sec.tags && extractedServices.length === 0) {
            extractedServices = sec.tags.map(t => t.title);
          } else if (sec.code === 'attention_to' && sec.tags && attentionTo.length === 0) {
            attentionTo = sec.tags.map(t => t.title);
          } else if (sec.code === 'place_of_service' && sec.tags && placeOfService.length === 0) {
            placeOfService = sec.tags.map(t => t.title);
          } else if (sec.code === 'payment_methods' && sec.tags && paymentMethods.length === 0) {
            paymentMethods = sec.tags.map(t => t.title);
          } else if (sec.code === 'section_about_you' && sec.tags && aboutYou.length === 0) {
            aboutYou = sec.tags.map(t => t.title);
          }
        });
      }
    } catch (e) {
      console.warn('[Scraper] No se pudo parsear :hierarchy JSON:', e.message);
    }
  }

  // 7. Extraer Nacionalidad
  let nationality = '';
  const natTag = aboutYou.find(t => t.includes('Colombiana') || t.includes('Venezolana') || t.includes('Dominicana'));
  if (natTag) {
    nationality = natTag.replace(/[^\wáéíóúÁÉÍÓÚñÑ]/g, '').trim();
  } else if (html.includes('Colombiana')) {
    nationality = 'Colombiana';
  }

  const servicesFormatted = extractedServices.join(', ');

  const extraDetails = [];
  if (aboutYou.length > 0) extraDetails.push(`✨ Características: ${aboutYou.join(', ')}`);
  if (attentionTo.length > 0) extraDetails.push(`👥 Atiendo a: ${attentionTo.join(', ')}`);
  if (placeOfService.length > 0) extraDetails.push(`📍 Lugar de encuentro: ${placeOfService.join(', ')}`);
  if (paymentMethods.length > 0) extraDetails.push(`💳 Métodos de pago: ${paymentMethods.join(', ')}`);

  const fullBio = extraDetails.length > 0
    ? `${cleanBio}\n\n${extraDetails.join('\n')}`
    : cleanBio;

  // 8. Extraer ID del Anuncio de Skokka
  const adIdMatch = html.match(/ID del anuncio:\s*([a-zA-Z0-9]+)/i) 
                 || html.match(/post-phone-button-([a-f0-9]+)/i)
                 || targetUrl.match(/([a-zA-Z0-9]{7,25})\/?$/);
  const adId = adIdMatch ? adIdMatch[1] : null;

  let rawPhotos = extractSkokkaPhotos(html, targetUrl);

  if (adId) {
    console.log(`[Scraper] 🔍 Buscando fotos adicionales en la API de Skokka para ID de anuncio: ${adId}...`);
    const apiPhotos = await fetchSkokkaAdApiPhotos(adId);
    apiPhotos.forEach(p => {
      if (!rawPhotos.includes(p)) rawPhotos.push(p);
    });
  }
  rawPhotos = rawPhotos.slice(0, 15);

  console.log(`[Scraper] 📸 Total de fotos candidatas encontradas (${rawPhotos.length}):`, rawPhotos);

  const escortId = `scraped_${Date.now()}`;
  const defaultPassword = await bcrypt.hash('123456', 10);
  const emailPrefix = name.toLowerCase().replace(/\s+/g, '') || 'perfil';
  const email = `${emailPrefix}_${Date.now()}@imported.citasrd.app`;

  const watermarkedPhotos = [];
  const imageDiagnostics = [];
  for (let i = 0; i < rawPhotos.length; i++) {
    const result = await downloadAndWatermarkPhoto(rawPhotos[i], escortId, i);
    imageDiagnostics.push(result);
    if (result?.url) watermarkedPhotos.push(result.url);
  }

  // 3.5. Extraer Tarifa / Precio Real
  let hourlyRate = null;
  const priceElementText = $('[data-testid="ad-detail-price"], .price, .price-tag').text().trim();
  const priceMatch = priceElementText.match(/(?:RD\$|\$|RD)?\s*([\d,.]+)/i)
                  || rawBio.match(/(?:RD\$|\$|RD)\s*([\d,.]+)/i)
                  || rawBio.match(/(\d{1,2}[\s,.]?\d{3})\s*(?:pesos|rd|dop|\$|\/h|\/hr|hora)/i);
  if (priceMatch) {
    const parsedPrice = parseInt(priceMatch[1].replace(/[.,\s]/g, ''), 10);
    if (parsedPrice >= 500 && parsedPrice <= 50000) {
      hourlyRate = parsedPrice;
    }
  }

  const avatarUrl = watermarkedPhotos[0] || null;

  // Crear modelo en Base de Datos
  const escort = await db.createEscort({
    email,
    passwordHash: defaultPassword,
    name,
    gender: customGender,
    age,
    nationality,
    city,
    zone: '',
    phone: whatsapp,
    whatsapp,
    hourlyRate: hourlyRate,
    currency: 'DOP',
    services: servicesFormatted,
    bio: fullBio,
    avatarUrl,
    isAvailable: true,
    isVerified: false,
    isFeatured: false
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
    persistentPhotosCount: imageDiagnostics.filter(p => p?.storage === 'minio' && p.verified).length,
    localFallbackPhotosCount: imageDiagnostics.filter(p => p?.storage === 'local').length,
    failedPhotosCount: imageDiagnostics.filter(p => !p?.url).length,
    storage: getMinioDiagnostics(),
    imageDiagnostics,
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
