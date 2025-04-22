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
      model: 'gpt-4',
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  middleware(config)(req, res, () => {
    Promise.all(
      req.body.events.map(async (event) => {
        if (event.type === 'message' && event.message.type === 'text') {
          const userMessage = event.message.text;
          const replyText = await askGPT(userMessage);

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
