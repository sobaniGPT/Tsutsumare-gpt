
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
    text: replyText || 'うまく返せなかったみたい、ごめんね。'
  });
}

async function askGPT(userText) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: 'あなたは産後のママを優しく励ますサポートAIです。' }, { role: 'user', content: userText }]
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
    return 'いまちょっと考えがまとまらないみたい。もう一度話しかけてみてね。';
  }
}

app.get('/', (req, res) => res.send('GPT LINE Bot is running!'));

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
