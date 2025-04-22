
const express = require('express');
const { middleware } = require('@line/bot-sdk');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const webhook = require('./api/webhook');

app.post('/webhook', webhook);

app.get('/', (req, res) => res.send('ツツマレは稼働中です'));

app.listen(port, () => {
  console.log(`ツツマレサーバーがポート${port}で稼働中`);
});
