import bcrypt from 'bcryptjs';
import { db } from './db.js';

export async function seedInitialData() {
  const existing = await db.getEscorts();
  if (existing && existing.length >= 6) {
    console.log(`Base de datos ya contiene ${existing.length} perfiles de escorts.`);
    return;
  }

  console.log('Sembrando datos completos de Escorts con Historias de 24h...');
  const defaultPass = await bcrypt.hash('123456', 10);

  const initialEscorts = [
    {
      email: 'valeria.vip@escorts.com',
      passwordHash: defaultPass,
      name: 'Valeria Deluxe',
      gender: 'FEMALE',
      age: 23,
      city: 'Ciudad de México',
      zone: 'Polanco / Condesa',
      phone: '+525512345678',
      whatsapp: '+525512345678',
      hourlyRate: 200,
      currency: 'USD',
      isAvailable: true,
      isVerified: true,
      isFeatured: true,
      services: 'Acompañante VIP, Cenas románticas, Viajes, Eventos de gala',
      schedule: '24 Horas',
      bio: 'Hola amor, me llamo Valeria. Chica súper dulce, discreta y apasionada. Disponible para caballeros exigentes.',
      avatarUrl: 'assets/images/escorts/female1.jpg'
    },
    {
      email: 'camila.models@escorts.com',
      passwordHash: defaultPass,
      name: 'Camila Rose',
      gender: 'FEMALE',
      age: 25,
      city: 'Guadalajara',
      zone: 'Providencia',
      phone: '+523311223344',
      whatsapp: '+523311223344',
      hourlyRate: 180,
      currency: 'USD',
      isAvailable: true,
      isVerified: true,
      isFeatured: true,
      services: 'Acompañante de lujo, Cenas, Salidas nocturnas, Trato de novia',
      schedule: '12:00 PM - 03:00 AM',
      bio: 'Camila Rose. Modelo independiente con elegancia y carisma. Me encanta pasar un tiempo agradable y sin prisas.',
      avatarUrl: 'assets/images/escorts/female2.jpg'
    },
    {
      email: 'santiago.vip@escorts.com',
      passwordHash: defaultPass,
      name: 'Santiago Sterling',
      gender: 'GAY',
      age: 27,
      city: 'Ciudad de México',
      zone: 'Santa Fe / Lomas',
      phone: '+525599887766',
      whatsapp: '+525599887766',
      hourlyRate: 250,
      currency: 'USD',
      isAvailable: true,
      isVerified: true,
      isFeatured: true,
      services: 'Acompañante masculino Gay / Bisexual, Cenas, Eventos VIP, Viajes',
      schedule: '24/7 con previa cita',
      bio: 'Santiago Sterling. Caballero educado, atlético, discreto y atento. El mejor acompañante masculino.',
      avatarUrl: 'assets/images/escorts/male1.jpg'
    },
    {
      email: 'nicole.trans@escorts.com',
      passwordHash: defaultPass,
      name: 'Nicole Star',
      gender: 'TRANS',
      age: 24,
      city: 'Monterrey',
      zone: 'San Pedro',
      phone: '+528188776655',
      whatsapp: '+528188776655',
      hourlyRate: 190,
      currency: 'USD',
      isAvailable: true,
      isVerified: true,
      isFeatured: false,
      services: 'Acompañante VIP Trans, Fiestas privadas, Masajes relajantes',
      schedule: '04:00 PM - 02:00 AM',
      bio: 'Nicole Star. Chica Trans hermosa, alegre y super complaciente. Atención personalizada.',
      avatarUrl: 'assets/images/escorts/trans1.jpg'
    }
  ];

  for (const escortData of initialEscorts) {
    const created = await db.createEscort(escortData);
    await db.addPhoto(created.id, created.avatarUrl, true);
    await db.addPhoto(created.id, 'assets/images/escorts/female1.jpg', false);

    // Seed 24h story for Valeria and Camila
    if (created.name === 'Valeria Deluxe' || created.name === 'Camila Rose') {
      await db.addStory(created.id, created.avatarUrl, 'IMAGE', '¡Hola amor! Disponible hoy en Polanco ✨');
      await db.addStory(created.id, 'assets/images/escorts/female3.jpg', 'IMAGE', 'Pasa un momento VIP conmigo 👑');
    }
  }

  console.log('✅ Datos iniciales con historias sembrados con éxito.');
}

if (process.argv[1] && process.argv[1].includes('seed.js')) {
  seedInitialData();
}
