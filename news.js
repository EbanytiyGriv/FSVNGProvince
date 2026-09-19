// API endpoint для работы с новостями
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, serverTimestamp } from 'firebase/firestore';

// Инициализация Firebase (только на сервере)
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    initFirebase();

    // GET - получить список новостей
    if (req.method === 'GET') {
      const q = query(collection(db, 'news'), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      const newsData = [];
      querySnapshot.forEach((document) => {
        newsData.push({ ...document.data(), docId: document.id });
      });
      return res.status(200).json({ news: newsData });
    }

    // POST - добавить новость (требует авторизацию)
    if (req.method === 'POST') {
      const adminCode = req.headers.authorization;
      if (adminCode !== process.env.ADMIN_CODE) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { text, image } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const newsItem = {
        text,
        timestamp: serverTimestamp(),
        time: new Date().toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      if (image) {
        newsItem.image = image;
      }

      await addDoc(collection(db, 'news'), newsItem);
      return res.status(200).json({ success: true });
    }

    // DELETE - удалить новость (требует авторизацию)
    if (req.method === 'DELETE') {
      const adminCode = req.headers.authorization;
      if (adminCode !== process.env.ADMIN_CODE) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { docId } = req.body;
      if (!docId) {
        return res.status(400).json({ error: 'Document ID is required' });
      }

      await deleteDoc(doc(db, 'news', docId));
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
