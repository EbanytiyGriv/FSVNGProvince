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

// Защита от перебора и спама анкет в памяти процесса Vercel
const rateLimitMap = new Map();
function isRateLimited(ip, limitCount = 10, timeWindowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const rec = rateLimitMap.get(ip) || { count: 0, windowStart: now };
  if (now - rec.windowStart > timeWindowMs) {
    rec.count = 0;
    rec.windowStart = now;
  }
  rec.count += 1;
  rateLimitMap.set(ip, rec);
  return rec.count > limitCount;
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

// Функция для безопасной отправки лога анкеты в Discord
async function sendToDiscord(webhookUrl, embedData) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embedData] })
    });
  } catch (err) {
    console.error('Discord webhook error:', err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Code');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

  const { action } = req.body || {};
  const ip = getClientIp(req);

  try {
    // -------------------------------------------------------------
    // ДЕЙСТВИЕ 1: Отправка анкеты пользователем (БЕЗ пароля админа)
    // -------------------------------------------------------------
    if (action === 'submitApplication') {
      // Защита от спама анкет: максимум 3 анкеты за 5 минут с одного IP
      if (isRateLimited(ip, 3, 5 * 60 * 1000)) {
        return res.status(429).json({ error: 'Слишком много заявок. Подождите немного перед следующей попыткой' });
      }

      const { formData } = req.body; // Ожидаем объект с полями анкеты (имя, возраст, игровой ник и т.д.)
      if (!formData) {
        return res.status(400).json({ error: 'Данные анкеты отсутствуют' });
      }

      const { db } = initAdmin();
      
      // Сохраняем анкету в коллекцию 'applications' в Firebase
      const docRef = await db.collection('applications').add({
        data: formData,
        ip: ip,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
      });

      // Если в Vercel добавлен Discord-вебхук, отправляем красивое уведомление о новой анкете
      if (process.env.DISCORD_WEBHOOK_URL) {
        const fields = Object.entries(formData).map(([key, val]) => ({
          name: `**${key}**`,
          value: String(val) || 'Не указано',
          inline: false
        }));

        await sendToDiscord(process.env.DISCORD_WEBHOOK_URL, {
          title: '📋 Поступила новая анкета во фракцию!',
          color: 3447003, // Синий цвет полоски
          fields: fields,
          footer: { text: `ID документа: ${docRef.id} | IP: ${ip}` },
          timestamp: new Date().toISOString()
        });
      }

      return res.status(200).json({ success: true, message: 'Анкета успешно отправлена' });
    }

    // -------------------------------------------------------------
    // ДЕЙСТВИЕ 2: Проверка кода админа входа (БЕЗ секретного заголовка)
    // -------------------------------------------------------------
    if (action === 'checkAdmin') {
      if (isRateLimited(ip, 10, 5 * 60 * 1000)) {
        return res.status(429).json({ authorized: false, error: 'Слишком много попыток, попробуйте позже' });
      }
      const { userAdminCode } = req.body;
      if (userAdminCode && process.env.ADMIN_CODE && userAdminCode === process.env.ADMIN_CODE) {
        return res.status(200).json({ authorized: true });
      }
      return res.status(403).json({ authorized: false, error: 'Неверный код' });
    }

    // -------------------------------------------------------------
    // ВСЕ ОСТАЛЬНЫЕ ДЕЙСТВИЯ (Только для подтвержденных администраторов)
    // -------------------------------------------------------------
    if (!isAuthorized(req)) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const { db, bucket } = initAdmin();

    // Создание новости
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
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })
      });

      return res.status(200).json({ success: true });
    }

    // Удаление новости
    if (action === 'deleteNews') {
      const { docId } = req.body;
      if (!docId || typeof docId !== 'string') {
        return res.status(400).json({ error: 'Не указан ID новости' });
      }
      await db.collection('news').doc(docId).delete();
      return res.status(200).json({ success: true });
    }

    // Управление набором
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
