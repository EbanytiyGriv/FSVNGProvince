// API endpoint для управления статусом набора
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    initFirebase();

    // GET - получить статус набора
    if (req.method === 'GET') {
      const snap = await getDoc(doc(db, 'settings', 'recruitment'));
      const isOpen = snap.exists() && snap.data().open !== false;
      return res.status(200).json({ open: isOpen });
    }

    // POST - изменить статус набора (требует авторизацию)
    if (req.method === 'POST') {
      const adminCode = req.headers.authorization;
      if (adminCode !== process.env.ADMIN_CODE) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { open } = req.body;
      if (typeof open !== 'boolean') {
        return res.status(400).json({ error: 'Invalid status' });
      }

      await setDoc(doc(db, 'settings', 'recruitment'), { open }, { merge: true });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
