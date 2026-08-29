import admin from 'firebase-admin';

const ALLOWED_ORIGIN = process.env.SITE_ORIGIN || 'https://vercel.app';

let dbInstance = null;
let bucketInstance = null;

function initAdmin() {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  }
  if (!dbInstance) dbInstance = admin.firestore();
  if (!bucketInstance) bucketInstance = admin.storage().bucket();
  return { db: dbInstance, bucket: bucketInstance };
}

// Простейший лимит попыток входа в память процесса.
const loginAttempts = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const rec = loginAttempts.get(ip) || { count: 0, windowStart: now };
  if (now - rec.windowStart > windowMs) {
    rec.count = 0;
    rec.windowStart = now;
  }
  rec.count += 1;
  loginAttempts.set(ip, rec);
  return rec.count > 10;
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function isAuthorized(req) {
  const code = req.headers['x-admin-code'];
  return !!code && !!process.env.ADMIN_CODE && code === process.env.ADMIN_CODE;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Code');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

  const { action } = req.body || {};

  try {
    // Проверка кода — единственное действие без предварительной авторизации
    if (action === 'checkAdmin') {
      const ip = getClientIp(req);
      if (isRateLimited(ip)) {
        return res.status(429).json({ authorized: false, error: 'Слишком много попыток, попробуйте позже' });
      }
      const { userAdminCode } = req.body;
      if (userAdminCode && process.env.ADMIN_CODE && userAdminCode === process.env.ADMIN_CODE) {
        return res.status(200).json({ authorized: true });
      }
      return res.status(403).json({ authorized: false, error: 'Неверный код' });
    }

    // Все остальные действия — только с верным кодом в заголовке X-Admin-Code
    if (!isAuthorized(req)) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const { db, bucket } = initAdmin();

    if (action === 'createNews') {
      const { text, imageBase64 } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Текст новости обязателен' });
      }

      let imageUrl = null;
      if (imageBase64) {
        const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(imageBase64);
        if (!match) {
          return res.status(400).json({ error: 'Некорректный формат изображения' });
        }
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        if (buffer.length > 5 * 1024 * 1024) {
          return res.status(400).json({ error: 'Изображение слишком большое (максимум 5МБ)' });
        }
        const ext = mimeType.split('/')[1] || 'png';
        const fileName = `news/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const file = bucket.file(fileName);
        await file.save(buffer, { metadata: { contentType: mimeType } });
        await file.makePublic();
        imageUrl = `https://googleapis.com{bucket.name}/${fileName}`;
      }

      await db.collection('news').add({
        text: text.trim(),
        image: imageUrl,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        time: new Date().toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      });

      return res.status(200).json({ success: true });
    }

    if (action === 'deleteNews') {
      const { docId } = req.body;
      if (!docId || typeof docId !== 'string') {
        return res.status(400).json({ error: 'Не указан ID новости' });
      }
      await db.collection('news').doc(docId).delete();
      return res.status(200).json({ success: true });
    }

    if (action === 'setRecruitment') {
      const { open } = req.body;
      await db.collection('settings').doc('recruitment').set({ open: !!open }, { merge: true });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Неизвестное действие' });
  } catch (e) {
    console.error('admin api error:', e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
