export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      firebaseConfig: {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
      },
      recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY
    });
  }

  if (req.method === 'POST') {
    try {
      const { action, userAdminCode, messageText } = req.body;

      if (action === 'checkAdmin') {
        if (userAdminCode === process.env.ADMIN_CODE) {
          return res.status(200).json({ authorized: true });
        }
        return res.status(403).json({ authorized: false, error: 'Неверный код' });
      }

      if (action === 'sendToDiscord') {
        if (!process.env.DISCORD_WEBHOOK_URL) {
          return res.status(500).json({ error: 'Вебхук не настроен в Vercel' });
        }

        const discordResponse = await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: messageText || 'Новая отправка формы!' })
        });

        if (discordResponse.ok) {
          return res.status(200).json({ success: true });
        }
        return res.status(500).json({ error: 'Ошибка отправки в Discord' });
      }

    } catch (e) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  }

  return res.status(405).json({ error: 'Метод не поддерживается' });
}
