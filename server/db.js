import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || (fs.existsSync('/data') ? '/data' : __dirname);
const DATA_FILE = path.join(DATA_DIR, 'data_store.json');

let prisma = null;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.warn('Prisma client fallback:', e.message);
}

function loadJsonStore() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.error('Error loading JSON store:', e);
    }
  }
  return { escorts: [], photos: [], stories: [], adminConfig: { adsEnabled: true, antiAdblock: true } };
}

function saveJsonStore(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export const db = {
  async getEscorts(filter = {}) {
    const now = new Date();
    if (prisma) {
      try {
        const where = { isBlocked: false };
        if (filter.gender) where.gender = filter.gender;
        if (filter.city) where.city = { contains: filter.city };
        if (filter.nationality) where.nationality = { contains: filter.nationality };
        if (filter.bodyType) where.bodyType = filter.bodyType;
        if (filter.service) where.services = { contains: filter.service };

        if (filter.minAge || filter.maxAge) {
          where.age = {};
          if (filter.minAge) where.age.gte = parseInt(filter.minAge);
          if (filter.maxAge) where.age.lte = parseInt(filter.maxAge);
        }

        if (filter.maxRate) {
          where.hourlyRate = { lte: parseFloat(filter.maxRate) };
        }

        if (filter.isAvailable !== undefined && filter.isAvailable !== '') {
          where.isAvailable = filter.isAvailable === 'true' || filter.isAvailable === true;
        }
        if (filter.isFeatured !== undefined && filter.isFeatured !== '') {
          where.isFeatured = filter.isFeatured === 'true' || filter.isFeatured === true;
        }

        const escorts = await prisma.escort.findMany({
          where,
          include: {
            photos: true,
            stories: {
              where: { expiresAt: { gt: now } }
            }
          },
          orderBy: [
            { isFeatured: 'desc' },
            { isVerified: 'desc' },
            { createdAt: 'desc' }
          ]
        });
        return escorts;
      } catch (e) {
        console.warn('Prisma getEscorts fallback:', e.message);
      }
    }

    // JSON fallback
    const store = loadJsonStore();
    let result = store.escorts.filter(e => !e.isBlocked);

    if (filter.gender) {
      result = result.filter(e => e.gender.toUpperCase() === filter.gender.toUpperCase());
    }
    if (filter.city) {
      result = result.filter(e => e.city.toLowerCase().includes(filter.city.toLowerCase()));
    }
    if (filter.nationality) {
      result = result.filter(e => e.nationality && e.nationality.toLowerCase().includes(filter.nationality.toLowerCase()));
    }
    if (filter.bodyType) {
      result = result.filter(e => e.bodyType === filter.bodyType);
    }
    if (filter.service) {
      result = result.filter(e => e.services && e.services.toLowerCase().includes(filter.service.toLowerCase()));
    }
    if (filter.minAge) {
      result = result.filter(e => e.age >= parseInt(filter.minAge));
    }
    if (filter.maxAge) {
      result = result.filter(e => e.age <= parseInt(filter.maxAge));
    }
    if (filter.maxRate) {
      result = result.filter(e => e.hourlyRate <= parseFloat(filter.maxRate));
    }
    if (filter.isAvailable !== undefined && filter.isAvailable !== '') {
      const isAvail = filter.isAvailable === 'true' || filter.isAvailable === true;
      result = result.filter(e => e.isAvailable === isAvail);
    }

    result.sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return b.isFeatured ? 1 : -1;
      if (a.isVerified !== b.isVerified) return b.isVerified ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const activeStories = (store.stories || []).filter(s => new Date(s.expiresAt) > now);

    return result.map(escort => {
      const photos = store.photos.filter(p => p.escortId === escort.id);
      const stories = activeStories.filter(s => s.escortId === escort.id);
      return { ...escort, photos, stories };
    });
  },

  async incrementProfileView(id) {
    if (prisma) {
      try {
        await prisma.escort.update({
          where: { id },
          data: { profileViews: { increment: 1 } }
        });
        return;
      } catch (e) {
        console.warn('Prisma incrementProfileView fallback:', e.message);
      }
    }
    const store = loadJsonStore();
    const escort = store.escorts.find(e => e.id === id);
    if (escort) {
      escort.profileViews = (escort.profileViews || 0) + 1;
      saveJsonStore(store);
    }
  },

  async incrementWhatsappClick(id) {
    if (prisma) {
      try {
        await prisma.escort.update({
          where: { id },
          data: { whatsappClicks: { increment: 1 } }
        });
        return;
      } catch (e) {
        console.warn('Prisma incrementWhatsappClick fallback:', e.message);
      }
    }
    const store = loadJsonStore();
    const escort = store.escorts.find(e => e.id === id);
    if (escort) {
      escort.whatsappClicks = (escort.whatsappClicks || 0) + 1;
      saveJsonStore(store);
    }
  },

  async getAllEscortsAdmin() {
    if (prisma) {
      try {
        return await prisma.escort.findMany({
          include: { photos: true, stories: true },
          orderBy: { createdAt: 'desc' }
        });
      } catch (e) {
        console.warn('Prisma getAllEscortsAdmin fallback:', e.message);
      }
    }
    const store = loadJsonStore();
    return store.escorts.map(escort => {
      const photos = store.photos.filter(p => p.escortId === escort.id);
      const stories = (store.stories || []).filter(s => s.escortId === escort.id);
      return { ...escort, photos, stories };
    });
  },

  async getEscortById(id) {
    const now = new Date();
    if (prisma) {
      try {
        const escort = await prisma.escort.findUnique({
          where: { id },
          include: {
            photos: true,
            stories: {
              where: { expiresAt: { gt: now } }
            }
          }
        });
        if (escort) return escort;
      } catch (e) {
        console.warn('Prisma getEscortById fallback:', e.message);
      }
    }

    const store = loadJsonStore();
    const escort = store.escorts.find(e => e.id === id);
    if (!escort) return null;
    const photos = store.photos.filter(p => p.escortId === escort.id);
    const stories = (store.stories || []).filter(s => s.escortId === escort.id && new Date(s.expiresAt) > now);
    return { ...escort, photos, stories };
  },

  async findEscortByEmail(email) {
    if (prisma) {
      try {
        const escort = await prisma.escort.findUnique({
          where: { email: email.toLowerCase() },
          include: { photos: true, stories: true }
        });
        if (escort) return escort;
      } catch (e) {
        console.warn('Prisma findEscortByEmail fallback:', e.message);
      }
    }

    const store = loadJsonStore();
    const escort = store.escorts.find(e => e.email.toLowerCase() === email.toLowerCase());
    if (!escort) return null;
    const photos = store.photos.filter(p => p.escortId === escort.id);
    const stories = (store.stories || []).filter(s => s.escortId === escort.id);
    return { ...escort, photos, stories };
  },

  async createEscort(data) {
    if (prisma) {
      try {
        return await prisma.escort.create({
          data: { ...data, email: data.email.toLowerCase() },
          include: { photos: true, stories: true }
        });
      } catch (e) {
        console.warn('Prisma createEscort fallback:', e.message);
      }
    }

    const store = loadJsonStore();
    const newEscort = {
      id: 'escort_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      name: data.name,
      gender: data.gender || 'FEMALE',
      age: parseInt(data.age) || 21,
      nationality: data.nationality || 'Mexicana',
      bodyType: data.bodyType || 'Atlética',
      city: data.city || 'Ciudad de México',
      zone: data.zone || '',
      bio: data.bio || '',
      phone: data.phone || '',
      whatsapp: data.whatsapp || '',
      telegram: data.telegram || '',
      hourlyRate: parseFloat(data.hourlyRate) || 150,
      currency: data.currency || 'DOP',
      isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
      isVerified: data.isVerified || false,
      isFeatured: data.isFeatured || false,
      isBlocked: data.isBlocked || false,
      verificationRequested: data.verificationRequested || false,
      profileViews: 0,
      whatsappClicks: 0,
      services: data.services || 'Acompañante VIP',
      schedule: data.schedule || '24/7',
      avatarUrl: data.avatarUrl || 'assets/images/escorts/female1.jpg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    store.escorts.push(newEscort);
    saveJsonStore(store);
    return { ...newEscort, photos: [], stories: [] };
  },

  async updateEscort(id, updateData) {
    if (prisma) {
      try {
        return await prisma.escort.update({
          where: { id },
          data: updateData,
          include: { photos: true, stories: true }
        });
      } catch (e) {
        console.warn('Prisma updateEscort fallback:', e.message);
      }
    }

    const store = loadJsonStore();
    const index = store.escorts.findIndex(e => e.id === id);
    if (index === -1) return null;

    store.escorts[index] = {
      ...store.escorts[index],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    saveJsonStore(store);
    const photos = store.photos.filter(p => p.escortId === id);
    const stories = (store.stories || []).filter(s => s.escortId === id);
    return { ...store.escorts[index], photos, stories };
  },

  async addPhoto(escortId, photoUrl, isPrimary = false, mediaType = 'IMAGE') {
    if (prisma) {
      try {
        return await prisma.photo.create({
          data: { url: photoUrl, isPrimary, mediaType, escortId }
        });
      } catch (e) {
        console.warn('Prisma addPhoto fallback:', e.message);
      }
    }

    const store = loadJsonStore();
    const newPhoto = {
      id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      url: photoUrl,
      mediaType,
      isPrimary,
      viewsCount: 0,
      escortId,
      createdAt: new Date().toISOString()
    };
    store.photos.push(newPhoto);
    saveJsonStore(store);
    return newPhoto;
  },

  async deletePhoto(photoId, escortId) {
    if (prisma) {
      try {
        await prisma.photo.deleteMany({ where: { id: photoId, escortId } });
        return true;
      } catch (e) {
        console.warn('Prisma deletePhoto fallback:', e.message);
      }
    }

    const store = loadJsonStore();
    store.photos = store.photos.filter(p => !(p.id === photoId && p.escortId === escortId));
    saveJsonStore(store);
    return true;
  },

  // STORY METHODS (24 Hours Expiration)
  async addStory(escortId, mediaUrl, mediaType = 'IMAGE', caption = '') {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours from now
    if (prisma) {
      try {
        return await prisma.story.create({
          data: {
            url: mediaUrl,
            mediaType,
            caption,
            escortId,
            expiresAt
          }
        });
      } catch (e) {
        console.warn('Prisma addStory fallback:', e.message);
      }
    }

    const store = loadJsonStore();
    if (!store.stories) store.stories = [];
    const newStory = {
      id: 'story_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      url: mediaUrl,
      mediaType,
      caption,
      escortId,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString()
    };
    store.stories.push(newStory);
    saveJsonStore(store);
    return newStory;
  },

  async deleteStory(storyId, escortId) {
    if (prisma) {
      try {
        await prisma.story.deleteMany({ where: { id: storyId, escortId } });
        return true;
      } catch (e) {
        console.warn('Prisma deleteStory fallback:', e.message);
      }
    }
    const store = loadJsonStore();
    if (store.stories) {
      store.stories = store.stories.filter(s => !(s.id === storyId && s.escortId === escortId));
      saveJsonStore(store);
    }
    return true;
  },

  async setPrimaryPhoto(escortId, photoUrl) {
    await this.updateEscort(escortId, { avatarUrl: photoUrl });
  },

  async getAdminConfig() {
    if (prisma) {
      try {
        let config = await prisma.adminConfig.findUnique({ where: { id: 'config' } });
        if (!config) {
          config = await prisma.adminConfig.create({
            data: { id: 'config', adsEnabled: true, antiAdblock: true }
          });
        }
        return config;
      } catch (e) {
        console.warn('Prisma getAdminConfig fallback:', e.message);
      }
    }
    const store = loadJsonStore();
    return store.adminConfig || { adsEnabled: true, antiAdblock: true };
  },

  async updateAdminConfig(updateData) {
    if (prisma) {
      try {
        return await prisma.adminConfig.upsert({
          where: { id: 'config' },
          update: updateData,
          create: { id: 'config', ...updateData }
        });
      } catch (e) {
        console.warn('Prisma updateAdminConfig fallback:', e.message);
      }
    }
    const store = loadJsonStore();
    store.adminConfig = { ...store.adminConfig, ...updateData };
    saveJsonStore(store);
    return store.adminConfig;
  }
};
