import * as Minio from 'minio';
import fs from 'fs';
import path from 'path';

// Cargar variables de entorno
const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
const port = parseInt(process.env.MINIO_PORT || '9000', 10);
const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const secretKey = process.env.MINIO_SECRET_KEY || 'minioadminpassword';
const bucketName = process.env.MINIO_BUCKET_NAME || 'escort-media';

let minioClient = null;
let isMinioAvailable = false;

try {
  minioClient = new Minio.Client({
    endPoint: endpoint,
    port: port,
    useSSL: useSSL,
    accessKey: accessKey,
    secretKey: secretKey
  });
} catch (err) {
  console.warn('[MinIO] No se pudo inicializar el cliente de MinIO:', err.message);
}

/**
 * Inicializa el bucket de MinIO con reintentos automáticos y configura la política de lectura pública.
 */
export async function initMinioBucket(maxRetries = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!minioClient) {
        minioClient = new Minio.Client({
          endPoint: endpoint,
          port: port,
          useSSL: useSSL,
          accessKey: accessKey,
          secretKey: secretKey
        });
      }

      const exists = await minioClient.bucketExists(bucketName);
      if (!exists) {
        await minioClient.makeBucket(bucketName, 'us-east-1');
        console.log(`[MinIO] Bucket "${bucketName}" creado con éxito.`);
      }

      // Configurar política de lectura pública para servir imágenes directamente
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/*`]
          }
        ]
      };

      await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
      isMinioAvailable = true;
      console.log(`[MinIO] Conectado exitosamente al bucket "${bucketName}" (${endpoint}:${port}) en intento ${attempt}.`);
      return true;
    } catch (err) {
      console.warn(`[MinIO] Intento de conexión ${attempt}/${maxRetries} falló (${err.message}). Reintentando en ${delayMs / 1000}s...`);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  console.warn('[MinIO] No se pudo conectar a MinIO tras varios intentos. Se utilizará almacenamiento local como respaldo.');
  isMinioAvailable = false;
  return false;
}

/**
 * Subir un Buffer a MinIO (o guardar localmente si MinIO no está disponible)
 */
export async function uploadBufferToMinio(buffer, originalName, mimetype = 'image/jpeg', folder = 'photos') {
  const sanitizedName = originalName ? originalName.replace(/[^a-zA-Z0-9.-]/g, '_') : 'media.jpg';
  const objectKey = `${folder}/${Date.now()}_${sanitizedName}`;

  if (isMinioAvailable && minioClient) {
    try {
      const metaData = {
        'Content-Type': mimetype,
        'Cache-Control': 'public, max-age=31536000'
      };

      await minioClient.putObject(bucketName, objectKey, buffer, buffer.length, metaData);

      const customPublicUrl = process.env.MINIO_PUBLIC_URL;
      let fullUrl;

      if (customPublicUrl && !customPublicUrl.includes('localhost') && !customPublicUrl.includes('127.0.0.1') && !customPublicUrl.includes('minio:')) {
        fullUrl = `${customPublicUrl.replace(/\/$/, '')}/${objectKey}`;
      } else {
        fullUrl = `/uploads/${objectKey}`;
      }

      console.log(`[MinIO] Archivo subido con éxito: ${objectKey} -> URL: ${fullUrl}`);
      return fullUrl;
    } catch (err) {
      console.error(`[MinIO] Error al subir objeto "${objectKey}":`, err.message);
    }
  }

  // Fallback: guardar en el sistema de archivos local
  const uploadsDir = process.env.UPLOADS_DIR || (fs.existsSync('/data/uploads') ? '/data/uploads' : path.join(process.cwd(), 'server', 'uploads'));
  const folderPath = path.join(uploadsDir, folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const localFileName = `${Date.now()}_${sanitizedName}`;
  const localFilePath = path.join(folderPath, localFileName);
  fs.writeFileSync(localFilePath, buffer);

  return `/uploads/${folder}/${localFileName}`;
}

/**
 * Middleware Express para servir archivos de MinIO de forma transparente a través de /uploads/*
 */
export async function serveMinioMedia(req, res, next) {
  if (!minioClient) {
    return next();
  }

  const relPath = req.path.replace(/^\//, '');
  if (!relPath) return next();

  try {
    const dataStream = await minioClient.getObject(bucketName, relPath);

    let contentType = 'image/jpeg';
    if (relPath.endsWith('.png')) contentType = 'image/png';
    else if (relPath.endsWith('.webp')) contentType = 'image/webp';
    else if (relPath.endsWith('.gif')) contentType = 'image/gif';
    else if (relPath.endsWith('.mp4')) contentType = 'video/mp4';
    else if (relPath.endsWith('.webm')) contentType = 'video/webm';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    return dataStream.pipe(res);
  } catch (err) {
    // Si el archivo no está en MinIO, pasa al middleware estático local
    return next();
  }
}

/**
 * Repara automáticamente cualquier URL que haya quedado guardada con localhost:9000
 */
export async function repairLocalhostUrls(db) {
  if (!db || typeof db.repairBrokenMediaUrls !== 'function') return;
  try {
    await db.repairBrokenMediaUrls();
  } catch (err) {
    console.error('[MinIO-Repair] Error al reparar URLs:', err.message);
  }
}

/**
 * Eliminar un objeto de MinIO o del disco local
 */
export async function deleteFromMinio(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string') return;

  try {
    if (mediaUrl.includes(bucketName) || mediaUrl.startsWith('http')) {
      if (isMinioAvailable && minioClient) {
        // Extraer la clave del objeto de la URL (ej: photos/123_abc.jpg)
        const parts = mediaUrl.split(`/${bucketName}/`);
        const objectKey = parts.length > 1 ? parts[1] : mediaUrl.split('/').slice(-2).join('/');
        await minioClient.removeObject(bucketName, objectKey);
        console.log(`[MinIO] Objeto eliminado de MinIO: ${objectKey}`);
        return;
      }
    }

    // Si es una ruta local /uploads/...
    if (mediaUrl.startsWith('/uploads/')) {
      const localRelPath = mediaUrl.replace('/uploads/', '');
      const uploadsDir = process.env.UPLOADS_DIR || (fs.existsSync('/data/uploads') ? '/data/uploads' : path.join(process.cwd(), 'server', 'uploads'));
      const fullPath = path.join(uploadsDir, localRelPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`[MinIO-Fallback] Archivo local eliminado: ${fullPath}`);
      }
    }
  } catch (err) {
    console.error(`[MinIO] Error al eliminar multimedia (${mediaUrl}):`, err.message);
  }
}

/**
 * Migra de forma segura todos los archivos multimedia existentes en /uploads hacia MinIO
 * y elimina los archivos locales una vez subidos exitosamente.
 */
export async function migrateExistingUploadsToMinio(db) {
  if (!isMinioAvailable || !minioClient) {
    console.log('[MinIO-Migration] MinIO no está disponible. Omitiendo migración.');
    return;
  }

  const uploadsDir = process.env.UPLOADS_DIR || (fs.existsSync('/data/uploads') ? '/data/uploads' : path.join(process.cwd(), 'server', 'uploads'));
  if (!fs.existsSync(uploadsDir)) return;

  function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === '.gitkeep') continue;
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        getAllFiles(filePath, fileList);
      } else {
        fileList.push(filePath);
      }
    }
    return fileList;
  }

  const allFiles = getAllFiles(uploadsDir);
  if (allFiles.length === 0) {
    console.log('[MinIO-Migration] No hay archivos locales pendientes por migrar.');
    return;
  }

  console.log(`[MinIO-Migration] Encontrados ${allFiles.length} archivos locales en /uploads para migrar a MinIO...`);
  const urlMapping = {};
  let successCount = 0;

  for (const filePath of allFiles) {
    try {
      const relPath = path.relative(uploadsDir, filePath).replace(/\\/g, '/'); // ej: "scraped/escort_1.jpg" o "escort-123.jpg"
      const buffer = fs.readFileSync(filePath);

      let mimetype = 'image/jpeg';
      if (filePath.endsWith('.png')) mimetype = 'image/png';
      else if (filePath.endsWith('.webp')) mimetype = 'image/webp';
      else if (filePath.endsWith('.gif')) mimetype = 'image/gif';
      else if (filePath.endsWith('.mp4')) mimetype = 'video/mp4';

      const folder = relPath.includes('/') ? relPath.split('/')[0] : 'photos';
      const filename = path.basename(filePath);

      const minioUrl = await uploadBufferToMinio(buffer, filename, mimetype, folder);

      // Variantes de URL en la base de datos
      urlMapping[`/uploads/${relPath}`] = minioUrl;
      urlMapping[`uploads/${relPath}`] = minioUrl;
      urlMapping[`/uploads/${filename}`] = minioUrl;
      urlMapping[`uploads/${filename}`] = minioUrl;

      // Eliminar el archivo local de forma segura tras subir a MinIO
      fs.unlinkSync(filePath);
      successCount++;
    } catch (err) {
      console.error(`[MinIO-Migration] Error al migrar archivo ${filePath}:`, err.message);
    }
  }

  // Actualizar URLs en la base de datos
  if (db && typeof db.updateMediaUrlsAfterMigration === 'function') {
    await db.updateMediaUrlsAfterMigration(urlMapping);
  }

  console.log(`[MinIO-Migration] Migración finalizada con éxito. ${successCount}/${allFiles.length} archivos migrados a MinIO y eliminados de disco local.`);
}

