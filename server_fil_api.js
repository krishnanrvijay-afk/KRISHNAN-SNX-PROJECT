const express = require('express');
const axios   = require('axios');
const crypto  = require('crypto');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3002;
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── MEXC CONFIG ───────────────────────────────────────────────────────────────
const MEXC_BASE  = 'https://contract.mexc.com';
const API_KEY    = process.env.MEXC_API_KEY    || '';
const API_SECRET = process.env.MEXC_API_SECRET || '';
const FIL_SYM    = 'FILECOIN_USDT';
const RECV_WIN   = '5000';

// ── SIGNATURE ─────────────────────────────────────────────────────────────────
function sign(timestamp, body) {
  const msg = timestamp + API_KEY + RECV_WIN + (body || '');
  return crypto.createHmac('sha256', API_SECRET).update(msg).digest('hex');
}

// ── AUTHENTICATED HELPERS ─────────────────────────────────────────────────────
async function mexcPost(endpoint, params) {
  const ts   = Date.now().toString();
  const body = JSON.stringify(params);
  const sig  = sign(ts, body);
  const r = await axios.post(MEXC_BASE + endpoint, params, {
    headers: {
      'ApiKey':       API_KEY,
      'Request-Time': ts,
      'Signature':    sig,
      'Recv-Window':  RECV_WIN,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
  return r.data;
}

async function mexcGet(endpoint, params = {}) {
  const ts  = Date.now().toString();
  const qs  = Object.keys(params).length
    ? Object.entries(params).map(([k,v]) => k+'='+v).join('&')
    : '';
  const sig = sign(ts, qs);
  const url = MEXC_BASE + endpoint + (qs ? '?' + qs : '');
  const r = await axios.get(url, {
    headers: {
      'ApiKey':       API_KEY,
      'Request-Time': ts,
      'Signature':    sig,
      'Recv-Window':  RECV_WIN,
    },
    timeout: 10000,
  });
  return r.data;
}

// ── PUBLIC KLINE PROXY (no auth) ──────────────────────────────────────────────
// Uses req.query.symbol so all pairs (FIL, XRP, SNX, CRV, ATOM) get their own data.
// Cache-Control: no-store prevents Railway/CDN from serving one symbol's data for another.
app.get('/proxy/mexc/kline', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const symbol = req.query.symbol || FIL_SYM;
    const r = await axios.get(`${MEXC_BASE}/api/v1/contract/kline/${symbol}`, {
      params: { interval: req.query.interval || 'Min1', limit: req.query.limit || 25 },
      timeout: 10000,
    });
    res.json(r.data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PUBLIC DEPTH PROXY (no auth) ──────────────────────────────────────────────
app.get('/proxy/mexc/depth', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const symbol = req.query.symbol || FIL_SYM;
    const r = await axios.get(`${MEXC_BASE}/api/v1/contract/depth/${symbol}`, {
      params: { limit: req.query.limit || 10 },
      timeout: 10000,
    });
    res.json(r.data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PUBLIC TICKER PROXY (no auth) ─────────────────────────────────────────────
app.get('/proxy/mexc/ticker', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const symbol = req.query.symbol || FIL_SYM;
    const r = await axios.get(`${MEXC_BASE}/api/v1/contract/ticker`, {
      params: { symbol },
      timeout: 10000,
    });
    res.json(r.data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── API HEALTH / KEY CHECK ────────────────────────────────────────────────────
app.get('/api/fil/health', async (req, res) => {
  if (!API_KEY || !API_SECRET) {
    return res.json({ ok: false, error: 'API_KEY or API_SECRET not configured in env secrets' });
  }
  try {
    const data = await mexcGet('/api/v1/private/account/assets');
    res.json({ ok: true, keyConfigured: true, data });
  } catch (e) {
    res.json({ ok: false, keyConfigured: true, error: e.message });
  }
});

// ── SET LEVERAGE ──────────────────────────────────────────────────────────────
app.post('/api/fil/leverage', async (req, res) => {
  try {
    const data = await mexcPost('/api/v1/private/position/change_leverage', {
      symbol:   FIL_SYM,
      leverage: req.body.leverage  || 50,
      openType: req.body.openType  || 1,
    });
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── OPEN LONG (limit buy) ─────────────────────────────────────────────────────
app.post('/api/fil/order/open', async (req, res) => {
  try {
    const data = await mexcPost('/api/v1/private/order/submit', {
      symbol:      FIL_SYM,
      price:       String(req.body.price),
      vol:         req.body.vol,
      leverage:    req.body.leverage || 50,
      side:        1,
      type:        1,
      openType:    1,
      externalOid: 'fil_entry_' + Date.now(),
    });
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PLACE TP ──────────────────────────────────────────────────────────────────
app.post('/api/fil/order/tp', async (req, res) => {
  try {
    const data = await mexcPost('/api/v1/private/order/submit', {
      symbol:      FIL_SYM,
      price:       String(req.body.price),
      vol:         req.body.vol,
      leverage:    50,
      side:        3,
      type:        1,
      openType:    1,
      externalOid: 'fil_tp_' + Date.now(),
    });
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PLACE SL ──────────────────────────────────────────────────────────────────
app.post('/api/fil/order/sl', async (req, res) => {
  try {
    const data = await mexcPost('/api/v1/private/planorder/place', {
      symbol:       FIL_SYM,
      side:         3,
      vol:          req.body.vol,
      openType:     1,
      triggerType:  1,
      triggerPrice: String(req.body.triggerPrice),
      price:        String(req.body.triggerPrice),
      matchType:    2,
    });
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── CANCEL REGULAR ORDER ──────────────────────────────────────────────────────
app.post('/api/fil/order/cancel', async (req, res) => {
  try {
    const data = await mexcPost('/api/v1/private/order/cancel', {
      symbol:  FIL_SYM,
      orderId: req.body.orderId,
    });
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── CANCEL PLAN ORDER (SL) ────────────────────────────────────────────────────
app.post('/api/fil/planorder/cancel', async (req, res) => {
  try {
    const data = await mexcPost('/api/v1/private/planorder/cancel', {
      symbol:  FIL_SYM,
      orderId: req.body.orderId,
    });
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── GET ORDER STATUS ──────────────────────────────────────────────────────────
app.get('/api/fil/order/:orderId', async (req, res) => {
  try {
    const data = await mexcGet('/api/v1/private/order/get_order_id', {
      symbol:  FIL_SYM,
      orderId: req.params.orderId,
    });
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── GET OPEN POSITIONS ────────────────────────────────────────────────────────
app.get('/api/fil/position', async (req, res) => {
  try {
    const data = await mexcGet('/api/v1/private/position/open_positions', { symbol: FIL_SYM });
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── CLOSE ALL ─────────────────────────────────────────────────────────────────
app.post('/api/fil/closeall', async (req, res) => {
  try {
    const data = await mexcPost('/api/v1/private/order/submit', {
      symbol:   FIL_SYM,
      price:    '0',
      vol:      req.body.vol,
      leverage: 50,
      side:     3,
      type:     5,
      openType: 1,
    });
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'FIL_API_MEXC.html'));
});

app.listen(PORT, () => {
  console.log('FIL API MEXC server running on port ' + PORT);
  if (!API_KEY) console.warn('  ⚠ MEXC_API_KEY not set — authenticated routes will fail');
  if (!API_SECRET) console.warn('  ⚠ MEXC_API_SECRET not set — authenticated routes will fail');
});
