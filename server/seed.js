import bcrypt from 'bcryptjs';
import { db } from './db.js';

export async function seedInitialData() {
  const existing = await db.getEscorts();
  if (existing && existing.length > 0) {
    console.log(`Base de datos ya contiene ${existing.length} perfiles de escorts. Omitiendo seed inicial.`);
    return;
  }

  console.log('Sembrando datos completos de Escorts con moneda RD$ DOP...');
  const defaultPass = await bcrypt.hash('123456', 10);

  const initialEscorts = [
    {
      email: 'valeria.vip@escorts.com',
      passwordHash: defaultPass,
      name: 'Valeria Deluxe',
      gender: 'FEMALE',
      age: 23,
      nationality: 'Dominicana',
      city: 'Santo Domingo',
      zone: 'Piantini / Naco',
      phone: '+18095551234',
      whatsapp: '+18095551234',
      hourlyRate: 4500,
      currency: 'DOP',
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
      nationality: 'Dominicana',
      city: 'Santiago',
      zone: 'Los Jardines',
      phone: '+18095555678',
      whatsapp: '+18095555678',
      hourlyRate: 3800,
      currency: 'DOP',
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
      nationality: 'Dominicana',
      city: 'Santo Domingo',
      zone: 'Bella Vista',
      phone: '+18095559988',
      whatsapp: '+18095559988',
      hourlyRate: 5000,
      currency: 'DOP',
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
      nationality: 'Dominicana',
      city: 'Punta Cana',
      zone: 'Bávaro',
      phone: '+18095554433',
      whatsapp: '+18095554433',
      hourlyRate: 4000,
      currency: 'DOP',
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

    if (created.name === 'Valeria Deluxe' || created.name === 'Camila Rose') {
      await db.addStory(created.id, created.avatarUrl, 'IMAGE', '¡Hola amor! Disponible hoy en Piantini ✨');
      await db.addStory(created.id, 'assets/images/escorts/female3.jpg', 'IMAGE', 'Pasa un momento VIP conmigo 👑');
    }
  }

  console.log('✅ Datos iniciales sembrados con moneda RD$ DOP.');
}

if (process.argv[1] && process.argv[1].includes('seed.js')) {
  seedInitialData();
}
