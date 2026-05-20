const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/proxy/mexc/kline', async (req, res) => {
  try {
    const { symbol, interval, limit } = req.query;
    const response = await axios.get('https://contract.mexc.com/api/v1/contract/kline', {
      params: { symbol, interval, limit },
      timeout: 10000
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/proxy/mexc/ticker', async (req, res) => {
  try {
    const { symbol } = req.query;
    const response = await axios.get('https://contract.mexc.com/api/v1/contract/ticker', {
      params: { symbol },
      timeout: 10000
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SNX Scalper running on port ${PORT}`);
});