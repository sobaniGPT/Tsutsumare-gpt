
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const lineClient = new Client(config);

app.post('/webhook', middleware(config), async (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text;
  const replyText = await askGPT(userMessage);

  return lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText || 'ごめんね、うまく返せなかったみたい。もう一度話しかけてみてね。'
  });
}

async function askGPT(userText) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.GPT_MODEL || 'gpt-4',
        messages: [
  {
    role: 'system',
    content:
      'あなたは、産後のママにやさしく寄り添うAIチャットボットです。話し方は、少しくだけた会話口調で、丁寧だけど親しみやすく。一度に伝える文は短めにして、あたたかく、やわらかい語尾を意識してください。アドバイスよりも、話を受け止め、共感することを大切に。「うんうん」「そっか」「〜だよね」「〜かもね」など、自然な会話のように返してください。長文にならないように、2〜3文を目安にしてください。'
  },
  {
    role: 'user',
    content: userText
  }
]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('GPT error:', error.response?.data || error.message);
    return '今ちょっと調子が悪いみたい。少ししてからまた話しかけてみてね。';
  }
}

app.get('/', (req, res) => res.send('ツツマレは稼働中です'));

app.listen(port, () => {
  console.log(`ツツマレサーバーがポート${port}で稼働中`);
});
