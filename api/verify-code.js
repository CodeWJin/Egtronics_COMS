const crypto = require('crypto');

const VALID_MS = 3 * 60 * 1000;

function makeToken(code, email, issuedAt) {
  const secret = process.env.HMAC_SECRET || 'dev-secret-change-in-prod';
  const payload = `${code}:${email.toLowerCase().trim()}:${issuedAt}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, code, email, issuedAt } = req.body;
  if (!token || !code || !email || !issuedAt) {
    return res.status(400).json({ error: '필수 항목 누락' });
  }

  if (Date.now() - Number(issuedAt) >= VALID_MS) {
    return res.status(400).json({ error: 'EXPIRED' });
  }

  const expected = makeToken(String(code), email, Number(issuedAt));

  let valid = false;
  try {
    valid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(token, 'hex'),
    );
  } catch {
    return res.status(400).json({ error: 'INVALID' });
  }

  if (!valid) return res.status(400).json({ error: 'INVALID' });

  res.json({ ok: true });
};
