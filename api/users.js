// API endpoint для управления пользователями
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, query, orderBy } from 'firebase/firestore';

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

async function verifyAdmin(sessionId) {
  if (!sessionId) return false;

  const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
  if (!sessionDoc.exists()) return false;

  const sessionData = sessionDoc.data();
  const userDoc = await getDoc(doc(db, 'users', sessionData.userId));

  if (!userDoc.exists()) return false;

  const userData = userDoc.data();
  return userData.isAdmin === true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    initFirebase();

    // GET - получить список всех пользователей (только для админов)
    if (req.method === 'GET') {
      const sessionId = req.headers.authorization;

      const isAdmin = await verifyAdmin(sessionId);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const usersCollection = collection(db, 'users');
      const q = query(usersCollection, orderBy('lastLogin', 'desc'));
      const querySnapshot = await getDocs(q);

      const users = [];
      querySnapshot.forEach((document) => {
        const data = document.data();
        users.push({
          id: document.id,
          username: data.username,
          discriminator: data.discriminator,
          avatar: data.avatar,
          status: data.status || 'Пользователь',
          rank: data.rank || 'Без звания',
          lastLogin: data.lastLogin,
          isAdmin: data.isAdmin || false
        });
      });

      return res.status(200).json({ users });
    }

    // POST - обновить статус и звание пользователя (только для админов)
    if (req.method === 'POST') {
      const sessionId = req.headers.authorization;

      const isAdmin = await verifyAdmin(sessionId);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { userId, status, rank } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updates = {};
      if (status !== undefined) updates.status = status;
      if (rank !== undefined) updates.rank = rank;

      await setDoc(userDocRef, updates, { merge: true });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Users API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
