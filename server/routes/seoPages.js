import express from 'express';
import { db } from '../db.js';

const router = express.Router();

const SEO_LANDINGS = {
  'escortssantodomingo': {
    cityFilter: 'Santo Domingo',
    genderFilter: '',
    title: 'Escorts en Santo Domingo 🇩🇴 | Directorio de Acompañantes VIP 24h',
    metaDesc: 'Encuentra las mejores Escorts VIP en Santo Domingo, Piantini, Naco y Bella Vista. Chicas independientes verificadas con contacto directo por WhatsApp 24/7.',
    h1: 'Escorts y Acompañantes VIP en Santo Domingo',
    introText: 'Bienvenido al directorio clasificado #1 de acompañantes VIP en Santo Domingo, República Dominicana. Explora perfiles verificados con fotos reales, tarifas en RD$ y contacto directo sin intermediarios.',
    faqs: [
      { q: '¿Cómo contactar una escort en Santo Domingo?', a: 'Presiona el botón verde de WhatsApp en la ficha de la modelo para chatear de forma directa y discreta.' },
      { q: '¿En qué zonas de Santo Domingo hay cobertura?', a: 'Nuestras acompañantes ofrecen servicios en Piantini, Naco, Bella Vista, Gazcue, Zona Colonial y ensanche Quisqueya.' }
    ]
  },
  'escortssantiago': {
    cityFilter: 'Santiago',
    genderFilter: '',
    title: 'Escorts en Santiago de los Caballeros 🇩🇴 | Acompañantes VIP',
    metaDesc: 'Directorio de Escorts VIP en Santiago de los Caballeros (Los Jardines, Villa Olga, Gurabo). Fotos reales, tarifas claras en RD$ y atención por WhatsApp.',
    h1: 'Escorts y Acompañantes VIP en Santiago de los Caballeros',
    introText: 'Descubre las modelos más exclusivas e independientes en Santiago de los Caballeros. Servicios de acompañamiento para cenas, viajes y eventos en la Ciudad Corazón.',
    faqs: [
      { q: '¿Hay servicio de acompañantes en Los Jardines y Villa Olga?', a: 'Sí, contamos con modelos disponibles en las mejores zonas residenciales y hoteles de Santiago.' }
    ]
  },
  'escortspuntacana': {
    cityFilter: 'Punta Cana',
    genderFilter: '',
    title: 'Escorts en Punta Cana y Bávaro 🇩🇴 | Acompañantes VIP Turísticas',
    metaDesc: 'Acompañantes de lujo y Escorts VIP en Punta Cana, Bávaro y Cap Cana. Modelos independientes disponibles 24/7 para turistas y ejecutivos.',
    h1: 'Escorts y Acompañantes de Lujo en Punta Cana y Bávaro',
    introText: 'Disfruta del mejor entretenimiento y acompañamiento VIP en las playas de Punta Cana, Bávaro y Cap Cana. Atención en hoteles, resorts y villas privadas.',
    faqs: [
      { q: '¿Las acompañantes atienden en hoteles de Punta Cana?', a: 'Sí, todas las acompañantes coordinan salidas (Outcall) directas a resorts y villas privadas.' }
    ]
  },
  'escortstrans': {
    cityFilter: '',
    genderFilter: 'TRANS',
    title: 'Escorts Trans en República Dominicana 🇩🇴 | Chicas Trans VIP',
    metaDesc: 'Directorio exclusivo de Escorts Trans en Santo Domingo, Santiago y Punta Cana. Chicas Trans hermosas, discretas y 100% independientes.',
    h1: 'Escorts Trans y Modelos Trans VIP en República Dominicana',
    introText: 'El portal #1 de Chicas Trans VIP en República Dominicana. Encuentra modelos trans elegantes, complacientes y discretas con contacto directo por WhatsApp.',
    faqs: [
      { q: '¿Cómo verificar la autenticidad de las chicas Trans?', a: 'Los perfiles con insignia azul de "Verificado" han validado la autenticidad de sus fotografías.' }
    ]
  },
  'escortshombres': {
    cityFilter: '',
    genderFilter: 'MALE',
    title: 'Escorts Hombres y Gay en República Dominicana 🇩🇴 | Acompañantes Masculinos',
    metaDesc: 'Acompañantes masculinos VIP y Escorts Hombres (Gay / Bisexual) en Santo Domingo y Santiago. Atención a damas, caballeros y parejas.',
    h1: 'Escorts Hombres y Acompañantes Masculinos VIP',
    introText: 'Directorio discreto de caballeros acompañantes masculinos en República Dominicana. Modelos educados, varoniles y atentos para eventos y privacidad.',
    faqs: [
      { q: '¿Hay atención discreta a damas y caballeros?', a: 'Sí, los acompañantes masculinos brindan trato 100% discreto para damas, caballeros y parejas.' }
    ]
  }
};

// Generador de Landing Pages HTML para SEO Agresivo
Object.keys(SEO_LANDINGS).forEach(slug => {
  router.get(`/${slug}`, async (req, res) => {
    try {
      const config = SEO_LANDINGS[slug];
      const escorts = await db.getEscorts();

      // Filtrar escorts
      let filtered = escorts;
      if (config.cityFilter) {
        filtered = filtered.filter(e => e.city.toLowerCase().includes(config.cityFilter.toLowerCase()));
      }
      if (config.genderFilter) {
        filtered = filtered.filter(e => e.gender === config.genderFilter);
      }

      // Si hay muy pocos resultados, mostrar todos para mantener densidad de landing
      if (filtered.length < 2) {
        filtered = escorts;
      }

      const baseUrl = process.env.BASE_URL || 'https://www.citasrd.app';
      const canonicalUrl = `${baseUrl}/${slug}`;

      // Generar HTML de Escorts
      const escortsCardsHtml = filtered.map(e => `
        <div class="col-6 col-md-4 col-lg-3 mb-3">
          <div class="card bg-dark text-white border-secondary h-100 rounded-4 overflow-hidden shadow-sm" onclick="window.location.href='/?profile=${e.id}'" style="cursor: pointer;">
            <div style="height: 240px; overflow: hidden; position: relative;">
              <img src="${baseUrl}/${e.avatarUrl.replace(/^\//, '')}" class="w-100 h-100" style="object-fit: cover;" alt="Escort ${e.name} en ${e.city}">
              <span class="position-absolute top-0 end-0 bg-primary text-white font-11 font-w800 px-2 py-1 m-2 rounded-pill">RD$ ${e.hourlyRate}</span>
            </div>
            <div class="card-body p-3">
              <h5 class="font-w700 text-white mb-1 font-16">${e.name}, ${e.age}</h5>
              <p class="text-primary font-12 font-w600 mb-1"><i class="fa-solid fa-location-dot me-1"></i> ${e.city}</p>
              <p class="text-white-50 font-11 line-clamp-2 mb-2">${e.services}</p>
              <a href="https://wa.me/${e.whatsapp ? e.whatsapp.replace(/\D/g, '') : ''}" target="_blank" class="btn btn-success btn-sm w-100 rounded-pill font-w600">
                <i class="fa-brands fa-whatsapp me-1"></i> WhatsApp Directo
              </a>
            </div>
          </div>
        </div>
      `).join('');

      // Generar FAQs Schema.org JSON-LD
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": config.faqs.map(f => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": { "@type": "Answer", "text": f.a }
        }))
      };

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
	<!-- Adcash Network Monetization -->
	<script id="aclib" type="text/javascript" src="//acscdn.com/script/aclib.js"></script>
	<script type="text/javascript">
		aclib.runAutoTag({
			zoneId: 'hoj7opxahb',
		});
	</script>

	<title>${config.title}</title>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
	<meta name="description" content="${config.metaDesc}">
	<meta name="keywords" content="${slug}, escorts en ${config.cityFilter || 'dominicana'}, acompañantes vip rd, escorts santo domingo">
	<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
	<link rel="canonical" href="${canonicalUrl}">

	<!-- Open Graph -->
	<meta property="og:type" content="website">
	<meta property="og:title" content="${config.title}">
	<meta property="og:description" content="${config.metaDesc}">
	<meta property="og:url" content="${canonicalUrl}">
	<meta property="og:site_name" content="CitasRD.app - Escorts VIP República Dominicana">

	<!-- Bootstrap & FontAwesome -->
	<link rel="stylesheet" href="${baseUrl}/assets/css/style.css">
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
	<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">

	<script type="application/ld+json">
	${JSON.stringify(faqSchema)}
	</script>
	<style>
		body { background-color: #0b0c10; color: #ffffff; font-family: 'Outfit', sans-serif; }
		.seo-header { background: linear-gradient(135deg, #FF2A7A 0%, #15151e 100%); padding: 40px 20px; text-align: center; }
		.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	</style>
</head>
<body>
	<header class="seo-header">
		<div class="container">
			<a href="${baseUrl}" class="text-white text-decoration-none font-24 font-w800 d-block mb-3">
				<i class="fa-solid fa-fire text-white me-2"></i> CITASRD.APP
			</a>
			<h1 class="text-white font-w800 font-28 mb-2">${config.h1}</h1>
			<p class="text-white-50 font-14 max-w-600 mx-auto">${config.introText}</p>
		</div>
	</header>

	<main class="container py-4">
		<div class="d-flex justify-content-between align-items-center mb-4 border-bottom border-secondary pb-3">
			<h2 class="font-w700 text-white font-20 mb-0">Catálogo de Acompañantes en Destacado</h2>
			<a href="${baseUrl}" class="btn btn-outline-light btn-sm rounded-pill px-3">Ver Todos en App</a>
		</div>

		<div class="row">
			${escortsCardsHtml}
		</div>

		<!-- Sección de FAQs SEO -->
		<div class="my-5 p-4 rounded-4 bg-dark border border-secondary">
			<h3 class="font-w700 text-white mb-3"><i class="fa-solid fa-circle-question text-primary me-2"></i> Preguntas Frecuentes (FAQs)</h3>
			<div class="accordion accordion-flush" id="faqAccordion">
				${config.faqs.map((f, i) => `
					<div class="mb-3">
						<h5 class="text-primary font-w600 font-16 mb-1">Q: ${f.q}</h5>
						<p class="text-white-50 font-14">${f.a}</p>
					</div>
				`).join('')}
			</div>
		</div>

		<!-- Enlaces Internos SEO Cruzados (Internal Linking Architecture) -->
		<div class="p-4 rounded-4 bg-dark border border-secondary text-center mb-5">
			<h4 class="font-w700 text-white mb-3">Explora Escorts en Otras Ciudades de RD</h4>
			<div class="d-flex flex-wrap justify-content-center gap-2">
				<a href="${baseUrl}/escortssantodomingo" class="btn btn-sm btn-outline-secondary rounded-pill text-white">Escorts en Santo Domingo</a>
				<a href="${baseUrl}/escortssantiago" class="btn btn-sm btn-outline-secondary rounded-pill text-white">Escorts en Santiago</a>
				<a href="${baseUrl}/escortspuntacana" class="btn btn-sm btn-outline-secondary rounded-pill text-white">Escorts en Punta Cana</a>
				<a href="${baseUrl}/escortstrans" class="btn btn-sm btn-outline-secondary rounded-pill text-white">Escorts Trans RD</a>
				<a href="${baseUrl}/escortshombres" class="btn btn-sm btn-outline-secondary rounded-pill text-white">Escorts Hombres RD</a>
			</div>
		</div>
	</main>

	<footer class="bg-dark border-top border-secondary py-4 text-center text-white-50 font-13">
		<div class="container">
			<div class="d-flex flex-wrap justify-content-center gap-3 mb-3 font-13 font-w600">
				<a href="${baseUrl}/terms.html" class="text-white-50 text-decoration-none">Términos de Servicio</a>
				<span>•</span>
				<a href="${baseUrl}/privacy.html" class="text-white-50 text-decoration-none">Política de Privacidad</a>
				<span>•</span>
				<a href="${baseUrl}/cookies.html" class="text-white-50 text-decoration-none">Cookies</a>
				<span>•</span>
				<a href="${baseUrl}/2257.html" class="text-white-50 text-decoration-none">18 U.S.C. 2257</a>
				<span>•</span>
				<a href="${baseUrl}/contact.html" class="text-white-50 text-decoration-none">Contacto</a>
			</div>
			<p class="mb-0">© 2026 CitasRD.app - Todos los derechos reservados. Sitio para mayores de 18 años.</p>
		</div>
	</footer>
</body>
</html>`;

      return res.send(html);
    } catch (e) {
      console.error(e);
      return res.redirect('/');
    }
  });
});

export default router;
