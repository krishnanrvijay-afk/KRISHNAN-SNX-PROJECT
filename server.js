const express = require('express');
const axios   = require('axios');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ── SESSION WINDOWS (EDT hours) ────────────────────────────────────────────────
// Mirrors TOKEN_CONFIG.bestHours in multi_pair_scanner.html.
// Keys are MEXC contract names (what the proxy receives as ?symbol=).
const BEST_HOURS_BY_MEXC_SYM = {
  'FILECOIN_USDT': new Set([0,1,14,15]),
  'XRP_USDT':      new Set([22,23,0,1,2,3]),
  'AVAX_USDT':     new Set([13,14,15,16]),
  'AAVE_USDT':     new Set([14,15,16,17,18,19]),
  'SNX_USDT':      new Set([8,9,11,12]),
  'CRV_USDT':      new Set([3,4,8,9]),
  'ATOM_USDT':     new Set([9,19,22,23]),
};

function edtHourNow() {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric', hour12: false
    }).format(new Date()), 10
  );
}

function isBlackedOut(mexcSym) {
  const hours = BEST_HOURS_BY_MEXC_SYM[mexcSym];
  if (!hours) return false; // unknown symbol — let it through
  return !hours.has(edtHourNow());
}

// HTML already translates symbols (FILUSDT→FILECOIN_USDT etc) before calling these routes.
// Server just forwards the symbol as received to MEXC futures API.

// Proxy to MEXC futures kline
app.get('/proxy/mexc/kline', async (req, res) => {
  const symbol = req.query.symbol || '';
  if (isBlackedOut(symbol)) {
    return res.json({ success: false, blackout: true, message: 'Outside session window — server blackout enforced for ' + symbol });
  }
  try {
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
  const symbol = req.query.symbol || '';
  if (isBlackedOut(symbol)) {
    return res.json({ success: false, blackout: true, message: 'Outside session window — server blackout enforced for ' + symbol });
  }
  try {
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
  const symbol = req.query.symbol || '';
  if (isBlackedOut(symbol)) {
    return res.json({ success: false, blackout: true, message: 'Outside session window — server blackout enforced for ' + symbol });
  }
  try {
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
