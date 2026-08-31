// API endpoint для Discord OAuth2 авторизации
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

let db;

function initFirebase() {
  if (getApps().length === 0) {
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    };
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } else {
    db = getFirestore();
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    initFirebase();

    // GET - обменять код на токен Discord
    if (req.method === 'GET' && req.query.code) {
      const code = req.query.code;

      // Обмениваем код на access_token
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.DISCORD_REDIRECT_URI
        })
      });

      if (!tokenResponse.ok) {
        return res.status(400).json({ error: 'Invalid authorization code' });
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Получаем информацию о пользователе
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!userResponse.ok) {
        return res.status(400).json({ error: 'Failed to fetch user info' });
      }

      const userData = await userResponse.json();
      const userId = userData.id;
      const username = userData.username;
      const discriminator = userData.discriminator;
      const avatarHash = userData.avatar;
      const avatarUrl = avatarHash
        ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(discriminator) % 5}.png`;

      // Проверяем, существует ли пользователь в базе
      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      let userDataDB = {
        discordId: userId,
        username: username,
        discriminator: discriminator,
        avatar: avatarUrl,
        lastLogin: new Date().toISOString()
      };

      if (userDoc.exists()) {
        // Обновляем информацию при входе
        const existing = userDoc.data();
        userDataDB = {
          ...existing,
          username: username,
          discriminator: discriminator,
          avatar: avatarUrl,
          lastLogin: new Date().toISOString()
        };
        await setDoc(userDocRef, userDataDB, { merge: true });
      } else {
        // Новый пользователь - создаём с дефолтными значениями
        userDataDB.status = 'Пользователь';
        userDataDB.rank = 'Без звания';
        userDataDB.createdAt = new Date().toISOString();
        await setDoc(userDocRef, userDataDB);
      }

      // Создаём сессию (простая реализация - в продакшене лучше использовать JWT)
      const sessionId = Buffer.from(`${userId}-${Date.now()}`).toString('base64');
      await setDoc(doc(db, 'sessions', sessionId), {
        userId: userId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 дней
      });

      return res.status(200).json({
        sessionId: sessionId,
        user: userDataDB
      });
    }

    // POST - проверка сессии
    if (req.method === 'POST') {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
      }

      const { doc, getDoc } = await import('firebase/firestore');
      const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));

      if (!sessionDoc.exists()) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const sessionData = sessionDoc.data();
      const expiresAt = new Date(sessionData.expiresAt);

      if (expiresAt < new Date()) {
        return res.status(401).json({ error: 'Session expired' });
      }

      // Получаем данные пользователя
      const userDoc = await getDoc(doc(db, 'users', sessionData.userId));

      if (!userDoc.exists()) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        valid: true,
        user: userDoc.data()
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
