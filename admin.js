const admin = require('firebase-admin');
require('dotenv').config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function fetchUsers() {
  const snapshot = await db.collection('users').get();

  console.log('🧑‍💻 [登録ユーザー一覧]');
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id}`);
    console.log(`  gpt_mode: ${data.gpt_mode}`);
    console.log(`  createdAt: ${new Date(data.createdAt).toLocaleString()}`);
    console.log(`  lastUsed: ${new Date(data.lastUsed).toLocaleString()}`);
    console.log('---');
  });
}

fetchUsers();
