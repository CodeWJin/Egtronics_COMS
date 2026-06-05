const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, name, code } = req.body;
  if (!to || !name || !code) {
    return res.status(400).json({ error: '필수 항목 누락' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const MAIL_FROM = process.env.MAIL_FROM || '이지트로닉스 <evcharger@egtronics.com>';

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

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, id: data.id });
};
