require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'charger_mgmt.db');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

if (!process.env.RESEND_API_KEY) {
  console.error('[FATAL] RESEND_API_KEY 환경변수가 없습니다. .env 파일을 확인하세요.');
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);
const MAIL_FROM = process.env.MAIL_FROM || '이지트로닉스 <evcharger@egtronics.com>';
const PORT = process.env.PORT || 4000;

const app = express();

const log = (level, msg, extra) => {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  if (level === 'ERROR') console.error(line, extra ?? '');
  else console.log(line, extra ?? '');
};

// 개발(localhost:3000)과 프로덕션(egtronics.com) 모두 허용
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://egtronics.com',
  process.env.BASE_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    log('WARN', `CORS 차단 — origin: ${origin}`);
    cb(new Error(`CORS: ${origin} 허용되지 않음`));
  },
}));
app.use(express.json());

app.use((req, _res, next) => {
  log('INFO', `${req.method} ${req.path} — origin: ${req.headers.origin || '없음'}`);
  next();
});

// ── DB 파일 읽기 / 저장 ────────────────────────────────────────
app.get('/api/db', (_req, res) => {
  if (!fs.existsSync(DB_FILE)) return res.json({ data: null });
  const buf = fs.readFileSync(DB_FILE);
  log('INFO', `DB 읽기 — ${buf.length} bytes`);
  res.json({ data: buf.toString('base64') });
});

app.post('/api/db', (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'data 필요' });
  const buf = Buffer.from(data, 'base64');
  fs.writeFileSync(DB_FILE, buf);
  log('INFO', `DB 저장 — ${buf.length} bytes → ${DB_FILE}`);
  res.json({ ok: true });
});

// ── 메일 전송 ──────────────────────────────────────────────────
app.post('/api/send-code', async (req, res) => {
  const { to, name, code } = req.body;
  if (!to || !name || !code) {
    log('WARN', '필수 항목 누락', { to: !!to, name: !!name, code: !!code });
    return res.status(400).json({ error: '필수 항목 누락' });
  }

  log('INFO', `메일 전송 시작 — 수신자: ${to}`);

  const { data, error } = await resend.emails.send({
    from: MAIL_FROM,
    to: [to],
    subject: `[이지트로닉스] 인증번호 ${code}`,
    html: `<div style="font-family:sans-serif;max-width:480px;padding:24px">
      <h3 style="margin:0 0 12px;color:#1e293b">[이지트로닉스] 이메일 인증</h3>
      <p style="color:#475569">${name} 님, 요청하신 인증번호입니다.</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#2563eb;
                  padding:18px;background:#eff6ff;border-radius:10px;text-align:center;
                  margin:16px 0">${code}</div>
      <p style="color:#94a3b8;font-size:13px">이 인증번호는 3분간 유효합니다. 본인이 요청하지 않은 경우 무시하세요.</p>
    </div>`,
  });

  if (error) {
    log('ERROR', `Resend API 실패 — 수신자: ${to}`, { message: error.message, name: error.name });
    return res.status(500).json({ error: error.message });
  }

  log('INFO', `메일 전송 성공 — id: ${data.id}, 수신자: ${to}`);
  res.json({ ok: true, id: data.id });
});

app.listen(PORT, () => log('INFO', `서버 실행 중 → http://localhost:${PORT}`));
