const { randomBytes } = require('crypto');

function uid() {
  return randomBytes(4).toString('hex').toUpperCase();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtRp(n) {
  try {
    return `${Math.trunc(Number(n) || 0)}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  } catch {
    return '0';
  }
}

function terbilang(n) {
  n = Math.trunc(Math.abs(Number(n) || 0));
  if (n === 0) return 'nol rupiah';

  const SAT = [
    '', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
    'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas',
    'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas',
  ];

  function ratusan(x) {
    if (x === 0) return '';
    if (x < 20) return SAT[x];
    if (x < 100) {
      const k = Math.floor(x / 10);
      const r = x % 10;
      return SAT[k] + ' puluh' + (r ? ' ' + SAT[r] : '');
    }
    const k = Math.floor(x / 100);
    const r = x % 100;
    const ratus = k === 1 ? 'seratus' : SAT[k] + ' ratus';
    const sub = ratusan(r);
    return ratus + (sub ? ' ' + sub : '');
  }

  const parts = [];
  if (n >= 1_000_000_000) {
    const q = Math.floor(n / 1_000_000_000);
    n %= 1_000_000_000;
    parts.push(ratusan(q) + ' miliar');
  }
  if (n >= 1_000_000) {
    const q = Math.floor(n / 1_000_000);
    n %= 1_000_000;
    parts.push(ratusan(q) + ' juta');
  }
  if (n >= 1_000) {
    const q = Math.floor(n / 1_000);
    n %= 1_000;
    parts.push(q === 1 ? 'seribu' : ratusan(q) + ' ribu');
  }
  if (n > 0) parts.push(ratusan(n));

  return parts.join(' ') + ' rupiah';
}

function pickBody(req) {
  return { ...req.query, ...(req.body || {}) };
}

function jsonOk(res, data = {}, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, message, ...data });
}

function jsonErr(res, message = 'Error', status = 400) {
  return res.status(status).json({ success: false, message });
}

module.exports = {
  uid,
  today,
  nowStr,
  fmtRp,
  terbilang,
  pickBody,
  jsonOk,
  jsonErr,
};
