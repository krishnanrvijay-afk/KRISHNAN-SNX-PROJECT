const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/proxy/mexc/kline', async (req, res) => {
  try {
    const { symbol, interval, limit } = req.query;
    const binanceInterval = (interval || 'Min5').replace('Min', '') + 'm';
    const response = await axios.get('https://fapi.binance.com/fapi/v1/klines', {
      params: { symbol, interval: binanceInterval, limit },
      timeout: 10000
    });
    // Convert Binance format to MEXC format so dashboard code stays the same
    const data = response.data;
    const out = {
      success: true,
      code: 0,
      data: {
        time:  data.map(c => Math.floor(c[0] / 1000)),
        open:  data.map(c => c[1]),
        high:  data.map(c => c[2]),
        low:   data.map(c => c[3]),
        close: data.map(c => c[4])
      }
    };
    res.json(out);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/proxy/mexc/ticker', async (req, res) => {
  try {
    const { symbol } = req.query;
    const response = await axios.get('https://fapi.binance.com/fapi/v1/ticker/price', {
      params: { symbol },
      timeout: 10000
    });
    res.json({ success: true, data: { lastPrice: response.data.price } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Multi Scalper running on port ' + PORT);
});