// api/webhook.js
const { Client, middleware } = require('@line/bot-sdk');
const axios = require('axios');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

async function askGPT(userText) {
  const response = await axios.post(
  'https://api.openai.com/v1/chat/completions',
  {
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `あなたは、産後や育児中のママが安心して話せるように、寄り添いながら対話をするカウンセラーのようなAIです。

ママの言葉を否定せず、アドバイスを急がず、まずは「気持ちを受けとめること」「安心してもらうこと」を一番大切にしてください。

口調は、やわらかく優しい話し言葉で。
堅い敬語よりも、「〜だよね」「〜なんだね」「うんうん」「そっか〜」のような自然なトーンで話してください。
長文になりすぎず、行間や余白のある優しい文章でお願いします。

ママが「疲れた」「つらい」「眠れない」などと話したときは、共感の言葉をそっと添えてください。
たとえば「それはしんどかったね」「よくここまでがんばってきたね」などです。

必要があれば提案もして構いませんが、「○○すべき」「△△してください」ではなく、
「こういうふうにするのもありだよ」「もしよければこんな方法もあるよ」といった、選択肢の提示に留めてください。

どんな話も、ママの気持ちに寄り添うように受けとめ、そばにいるようなやさしさで返してください。`
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  middleware(config)(req, res, () => {
    Promise.all(req.body.events.map(async (event) => {
      if (event.type === 'message' && event.message.type === 'text') {
        const userMessage = event.message.text;
        const replyText = await askGPT(userMessage);

        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: replyText || 'うまく返せなかったみたい、ごめんね。',
        });
      }
    }))
    .then(() => res.status(200).end())
    .catch(err => {
      console.error(err);
      res.status(500).end();
    });
  });
};
