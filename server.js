const express = require('express');
const axios   = require('axios');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Candle and depth data is always proxied regardless of session window.
// Off-hours enforcement is handled client-side (trade execution only).
// Remaining pairs: FIL, XRP, SNX, CRV, ATOM

// Proxy to MEXC futures kline
app.get('/proxy/mexc/kline', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const symbol = req.query.symbol || '';
    const response = await axios.get(
      `https://contract.mexc.com/api/v1/contract/kline/${symbol}`,
      { params: { interval: req.query.interval || 'Min1', limit: req.query.limit || 25 }, timeout: 10000 }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Proxy to MEXC futures order book depth
app.get('/proxy/mexc/depth', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const symbol = req.query.symbol || '';
    const response = await axios.get(
      `https://contract.mexc.com/api/v1/contract/depth/${symbol}`,
      { params: { limit: req.query.limit || 10 }, timeout: 10000 }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Proxy to MEXC futures ticker
app.get('/proxy/mexc/ticker', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const symbol = req.query.symbol || '';
    const response = await axios.get(
      'https://contract.mexc.com/api/v1/contract/ticker',
      { params: { symbol }, timeout: 10000 }
    );
    res.json(response.data);
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
