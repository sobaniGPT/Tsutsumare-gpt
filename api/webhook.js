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

  if (!userDoc.exists) {
    // 初回アクセス：trialで登録
    await userRef.set({
      gpt_mode: 'trial',
      createdAt: Date.now(),
      lastUsed: Date.now(),
      note: '初回登録'
    });
    return 'trial';
  }

  // 既存ユーザーの最終アクセス更新
  await userRef.update({ lastUsed: Date.now() });
  return userDoc.data().gpt_mode || 'trial';
}

// 🧠 GPTに質問して返答をもらう関数（gpt_modeによってモデルを切り替え）
async function askGPT(userText, mode) {
  const model =
    mode === 'light' ? 'gpt-3.5-turbo' :
    mode === 'premium' || mode === 'trial' ? 'gpt-4' : null;

  if (!model) {
    return 'ツツマレの無料体験は終了しています💡\nご利用を続けたい方はこちらから🍀\n▶︎ https://xxx.base.shop';
  }

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: model,
      messages: [
        {
          role: 'system',
          content: `あなたは『ツツマレ』という名前の育児サポートチャットAIです。

● 話し方は、親しみやすくやわらかい口調で。まるでそばで話を聞いてくれる信頼できる友人、カウンセラーのような雰囲気で応答してください。

● ユーザーは育児中のママが中心です。話す内容がまとまっていなくても、否定せずにやさしく受け止めてください。

● 表現は硬くしすぎず、語尾を「〜ね」「〜よ」「〜かも」「〜かな」などバリエーションを持たせて自然にしてください。感嘆符（！）や絵文字（☺️🌱✨など）も時々入れて、親しみやすく。

● 文量はユーザーのテンションに応じて変えてください。
  - 軽いやりとりには2〜3文ほど
  - 深めの内容には4〜6文もOK。詰め込みすぎず改行を入れて読みやすく。

● 専門的な育児相談には断定せず、必要に応じて信頼できるサイトのURLを紹介してください。（例：「小児科や助産師さんにも相談してみてね」）

● 重い話や深刻な悩み（産後うつ・孤独感など）が出た場合は、共感のうえで相談機関をやさしく案内してください。（例：「〇〇に相談してみると、少し安心できるかも…」など）

● 何より、「あなたはひとりじゃないよ」という気持ちを伝えることを大切にしてください。`
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
          const userMessage = event.message.text;

          // gpt_mode（trial/premiumなど）を取得
          const gptMode = await getUserMode(userId);
          // GPTに質問＆応答取得
          const replyText = await askGPT(userMessage, gptMode);

          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: replyText || 'うまく返せなかったみたい、ごめんね。',
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
