require('dotenv').config();


// webhook.js

// 🔗 LINEとaxiosの準備
const { Client, middleware } = require('@line/bot-sdk');
const axios = require('axios');

// 🔐 Firebaseの初期化と接続設定（Render環境変数から読み込み）
const admin = require("firebase-admin");
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🤖 LINE Botの設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

// 📥 FirestoreからGPTモード取得（初回ユーザーはtrialで登録）
async function getUserMode(userId) {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  const now = Date.now();
  const trialPeriodMs = 14 * 24 * 60 * 60 * 1000; // 2週間
  const oneDayMs = 24 * 60 * 60 * 1000;

  if (!userDoc.exists) {
    await userRef.set({
      gpt_mode: 'trial',
      createdAt: now,
      lastUsed: now,
      note: '初回登録'
    });
    return 'trial';
  }

  const data = userDoc.data();
  const timeSinceCreated = now - (data.createdAt || now);
  const currentMode = data.gpt_mode || 'trial';

  if (currentMode === 'trial' && timeSinceCreated > trialPeriodMs) {
    await userRef.update({
      gpt_mode: 'expired',
      note: 'trial自動終了',
      lastUsed: now
    });
    return 'expired';
  }

  const daysLeft = Math.floor((trialPeriodMs - timeSinceCreated) / oneDayMs);
  if (currentMode === 'trial' && (daysLeft === 3 || daysLeft === 1)) {
    const reminder = daysLeft === 3
      ? '無料体験はあと3日です🌱 よかったら、続けて使う準備も考えてみてね。'
      : '無料体験は明日で終了だよ🍀 気に入ってもらえたら、これからもそばにいさせてね。';

    await client.pushMessage(userId, {
      type: 'text',
      text: reminder
    });
  }

  await userRef.update({ lastUsed: now });
  return currentMode;
}

// 🧠 GPTに質問して返答をもらう関数（gpt_modeによってモデルを切り替え）
async function askGPT(userText, mode) {
  const model =
    mode === 'light' ? 'gpt-3.5-turbo' :
    mode === 'premium' || mode === 'trial' ? 'gpt-4' : null;

  if (!model) {
    return `ツツマレの無料体験は終了しました💡\n\n引き続きご利用されたい方は、こちらからプランをご確認くださいね☺️\n\n▶︎ https://your-base-url.base.shop`;
  }

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model,
      messages: [
        {
          role: 'system',
          content: `あなたは『ツツマレ』という名前の育児サポートチャットAIです。\n...（プロンプト内容ここに続けてOK）`
        },
        { role: 'user', content: userText }
      ]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      }
    }
  );

  return response.data.choices[0].message.content;
}

// 🌐 LINEからのWebhookイベントを受け取って処理
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  middleware(config)(req, res, () => {
    Promise.all(
      req.body.events.map(async (event) => {
        if (event.type === 'message' && event.message.type === 'text') {
          const userId = event.source.userId;
          const userRef = db.collection('users').doc(userId);
          const gptMode = await getUserMode(userId);

          const userMessage = event.message.text;
          const replyText = await askGPT(userMessage, gptMode);

          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: replyText || 'うまく返せなかったみたい、ごめんね。'
          });
        }
      })
    )
    .then(() => res.status(200).end())
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
  });
};
