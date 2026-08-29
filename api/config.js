const ALLOWED_ORIGIN = process.env.SITE_ORIGIN || 'https://fsvng-province.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    // Firebase client config является публичным по замыслу самого Firebase
    // (защита данных обеспечивается правилами Firestore/Storage, а не секретностью этих значений).
    return res.status(200).json({
      firebaseConfig: {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
      }
    });
  }

  if (req.method === 'POST') {
    try {
      const { action, messageText } = req.body || {};

      if (action === 'sendToDiscord') {
        if (!process.env.DISCORD_WEBHOOK_URL) {
          return res.status(500).json({ error: 'Вебхук не настроен в Vercel' });
        }
        const discordResponse = await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: (messageText || 'Новая отправка формы!').slice(0, 4090) })
        });
        if (discordResponse.ok) {
          return res.status(200).json({ success: true });
        }
        return res.status(500).json({ error: 'Ошибка отправки в Discord' });
      }

      return res.status(400).json({ error: 'Неизвестное действие' });
    } catch (e) {
      console.error('config api error:', e);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  }

  return res.status(405).json({ error: 'Метод не поддерживается' });
}
