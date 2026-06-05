// 로그인 화면 + 역할(Role) 접근 설정

// 역할별 접근 가능한 탭
window.ROLE_TABS = {
  admin:      ['sales', 'waiting', 'mapping', 'completed', 'lookup', 'admin'],
  sales:      ['sales', 'waiting', 'lookup'],
  production: ['waiting', 'mapping', 'completed', 'lookup'],
  as:         ['lookup'],
};
window.ROLE_LABEL = { admin: '관리자', sales: '영업', production: '생산', as: 'A/S' };

const { useState: useStateAU } = React;

function LoginScreen() {
  const s = window.useStore();
  const [userId, setUserId] = useStateAU('');
  const [pw, setPw] = useStateAU('');
  const [err, setErr] = useStateAU('');
  const [busy, setBusy] = useStateAU(false);
  const [showDemo, setShowDemo] = useStateAU(false);
  const [showReset, setShowReset] = useStateAU(false);

  const submit = (e) => {
    if (e) e.preventDefault();
    setErr('');
    if (!userId || !pw) { setErr('아이디와 비밀번호를 입력하세요'); return; }
    setBusy(true);
    setTimeout(() => {
      const ok = window.actions.login(userId.trim(), pw);
      setBusy(false);
      if (!ok) setErr('아이디 또는 비밀번호가 올바르지 않습니다');
    }, 380);
  };

  const fillDemo = (id) => { setUserId(id); setPw('1234'); setErr(''); };

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <div className="login__logo">P</div>
          <div>
            <div className="login__brand__name">Egtronics COMS</div>
            <div className="login__brand__sub">EV 충전기 영업 · 생산 통합 관리</div>
          </div>
        </div>

        <h1 className="login__title">로그인</h1>
        <p className="login__lead">부서 계정으로 로그인하세요. 역할에 따라 접근 가능한 메뉴가 달라집니다.</p>

        <form onSubmit={submit} className="login__form">
          <div className="field">
            <label className="field__label"><Icon name="user" size={11}/>아이디</label>
            <input className={`input ${err ? 'input--error' : ''}`} autoFocus
                   placeholder="예: admin"
                   value={userId}
                   onChange={(e) => { setUserId(e.target.value); setErr(''); }}/>
          </div>
          <div className="field">
            <label className="field__label"><Icon name="lock" size={11}/>비밀번호</label>
            <input type="password"
                   className={`input ${err ? 'input--error' : ''}`}
                   placeholder="••••"
                   value={pw}
                   onChange={(e) => { setPw(e.target.value); setErr(''); }}/>
          </div>

          {err && <div className="login__err"><Icon name="alert" size={13}/> {err}</div>}

          <button type="submit" className="btn btn--primary btn--lg login__submit" disabled={busy}>
            {busy ? '확인 중…' : <><Icon name="arrow-right" size={15}/> 로그인</>}
          </button>
        </form>

        <button type="button" className="login__reset" onClick={() => setShowReset(true)}>
          <Icon name="lock" size={12}/> 비밀번호 변경 · 이메일 인증
        </button>

        <div className="login__demo">
          <button type="button" className="login__demo__toggle" onClick={() => setShowDemo(v => !v)}>
            <Icon name={showDemo ? 'chevron-down' : 'chevron-right'} size={12}/> 데모 계정 {showDemo ? '숨기기' : '보기'}
          </button>
          {showDemo && (
            <div className="login__demo__list">
              {window.SEED_USERS.map(u => (
                <button type="button" key={u.user_id} className="login__demo__item" onClick={() => fillDemo(u.user_id)}>
                  <span className="login__demo__role" data-role={u.role}>{window.ROLE_LABEL[u.role]}</span>
                  <span className="login__demo__id">{u.user_id}</span>
                  <span className="login__demo__pw">비밀번호 1234</span>
                  <Icon name="chevron-right" size={12} style={{ color: 'var(--ink-4)' }}/>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
      {showReset && <PasswordResetModal onClose={() => setShowReset(false)}/>}
    </div>
  );
}

/* ────────── 비밀번호 변경 (Resend API → hiworks 수신) ────────── */

const MAIL_API = `${window.location.origin}/api/send-code`;

function PasswordResetModal({ onClose }) {
  const [step, setStep] = useStateAU(1); // 1: 본인확인  2: 인증번호  3: 새 비밀번호  4: 완료
  const [userId, setUserId] = useStateAU('');
  const [email, setEmail] = useStateAU('');
  const [sentCode, setSentCode] = useStateAU('');
  const [code, setCode] = useStateAU('');
  const [newPw, setNewPw] = useStateAU('');
  const [confirmPw, setConfirmPw] = useStateAU('');
  const [err, setErr] = useStateAU('');
  const [busy, setBusy] = useStateAU(false);
  const [sentAt, setSentAt] = useStateAU(null);
  const [left, setLeft] = useStateAU(0);

  const VALID_MS = 3 * 60 * 1000; // 유효시간 3분

  // sentAt 기준으로 남은 시간 계산 — 재전송 시 자동 재시작
  React.useEffect(() => {
    if (!sentAt) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((sentAt + VALID_MS - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [sentAt]);

  // ── 인증번호 생성 + hiworks SMTP 전송 (신규 · 재전송 공통) ───────────────
  const sendCode = async () => {
    setErr('');
    if (!userId.trim()) { setErr('아이디를 입력하세요'); return; }
    if (!email.trim()) { setErr('이메일을 입력하세요'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr('올바른 이메일 형식이 아닙니다'); return; }
    setBusy(true);

    const u = window.PMDB.getUser(userId.trim());
    if (!u) { setBusy(false); setErr('존재하지 않는 아이디입니다'); return; }
    if (!window.PMDB.verifyUserEmail(userId.trim(), email.trim())) {
      setBusy(false); setErr('등록된 이메일과 일치하지 않습니다'); return;
    }

    const c = String(Math.floor(100000 + Math.random() * 900000));
    setSentCode(c);
    setCode('');

    try {
      const res = await fetch(MAIL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email.trim(), name: u.name, code: c }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      const isNetworkError = e instanceof TypeError && e.message === 'Failed to fetch';
      const logEntry = {
        timestamp: new Date().toISOString(),
        endpoint: MAIL_API,
        errorType: isNetworkError ? 'NetworkError' : 'APIError',
        errorMessage: e.message,
        userId: userId.trim(),
        emailDomain: email.trim().split('@')[1] || '(unknown)',
        cause: isNetworkError
          ? '백엔드 서버(4000)에 연결할 수 없음 — node server.js 실행 여부 확인'
          : 'API 응답 오류',
      };
      console.group('%c[Mail] 메일 전송 실패', 'color:#ef4444;font-weight:bold');
      console.error('시각:', logEntry.timestamp);
      console.error('엔드포인트:', logEntry.endpoint);
      console.error('에러 유형:', logEntry.errorType);
      console.error('메시지:', logEntry.errorMessage);
      console.error('원인 추정:', logEntry.cause);
      console.error('전체 에러 객체:', e);
      console.groupEnd();
      try {
        const prev = JSON.parse(localStorage.getItem('mail_error_log') || '[]');
        prev.push(logEntry);
        if (prev.length > 20) prev.splice(0, prev.length - 20);
        localStorage.setItem('mail_error_log', JSON.stringify(prev));
      } catch (_) {}
      setBusy(false);
      setErr(isNetworkError
        ? '메일 서버에 연결할 수 없습니다. 백엔드 서버(npm run server)가 실행 중인지 확인하세요.'
        : `메일 전송 실패: ${e.message}`);
      return;
    }

    setSentAt(Date.now());
    setLeft(VALID_MS / 1000);
    setBusy(false);
    setStep(2);
  };

  // ── 인증번호 검증 (현재 시각으로 유효시간 체크) ─────────────────────────
  const expired = sentAt !== null && Date.now() - sentAt >= VALID_MS;

  const verifyCode = () => {
    setErr('');
    if (!sentAt || Date.now() - sentAt >= VALID_MS) {
      setErr('인증 시간(3분)이 만료되었습니다. 인증번호를 재발급하세요'); return;
    }
    if (code.trim() !== sentCode) { setErr('인증번호가 일치하지 않습니다'); return; }
    setStep(3);
  };

  const savePw = () => {
    setErr('');
    if (newPw.length < 4) { setErr('비밀번호는 4자 이상이어야 합니다'); return; }
    if (newPw !== confirmPw) { setErr('새 비밀번호가 일치하지 않습니다'); return; }
    window.PMDB.changePassword(userId.trim(), newPw);
    setStep(4);
  };

  const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  const STEPS = ['본인 확인', '인증번호', '새 비밀번호'];

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 420, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h3 className="modal__title">{step === 4 ? '변경 완료' : '비밀번호 변경'}</h3>
          <p className="modal__sub">이메일 본인확인 후 새 비밀번호를 설정합니다</p>
        </div>

        {step < 4 && (
          <div className="stepper">
            {STEPS.map((label, i) => {
              const n = i + 1;
              return (
                <div key={label} className={`stepper__item ${step === n ? 'stepper__item--active' : ''} ${step > n ? 'stepper__item--done' : ''}`}>
                  <span className="stepper__dot">{step > n ? <Icon name="check" size={11}/> : n}</span>
                  <span className="stepper__lbl">{label}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── Step 1: 아이디 + 이메일 본인확인 ── */}
          {step === 1 && (
            <>
              <div className="field">
                <label className="field__label"><Icon name="user" size={11}/> 아이디</label>
                <input className="input" autoFocus placeholder="예: admin" value={userId}
                       onChange={(e) => { setUserId(e.target.value); setErr(''); }}/>
              </div>
              <div className="field">
                <label className="field__label"><Icon name="bell" size={11}/> 이메일</label>
                <input className="input" type="email" placeholder="등록된 이메일 주소"
                       value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }}/>
                <div className="field__hint">계정에 등록된 이메일과 일치하면 인증번호가 발급됩니다 (유효시간 3분)</div>
              </div>

            </>
          )}

          {/* ── Step 2: 인증번호 확인 ── */}
          {step === 2 && (
            <>
              <div className="reset-note">
                <Icon name="check" size={13}/>
                <span><strong style={{ fontFamily: 'var(--font-mono)' }}>{email}</strong> 로 인증번호를 발송했습니다.</span>
              </div>

              <div className="reset-demo" style={{ fontSize: 15 }}>
                인증번호&nbsp;
                <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 22, letterSpacing: '0.2em' }}>
                  {sentCode}
                </strong>
              </div>

              <div className="field">
                <label className="field__label">인증번호 6자리 입력</label>
                <input className="input otp-input" autoFocus inputMode="numeric" maxLength={6}
                       placeholder="000000" disabled={expired}
                       value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }}/>

                <div className="field__hint" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {expired ? (
                    <strong style={{ color: 'var(--danger-700)' }}>
                      <Icon name="alert" size={11}/> 인증 시간 만료 — 재발급하세요
                    </strong>
                  ) : (
                    <span>남은 시간&nbsp;
                      <strong style={{
                        color: left <= 60 ? 'var(--danger-700)' : 'var(--primary-600)',
                        fontVariantNumeric: 'tabular-nums',
                        animation: left > 0 && left <= 30 ? 'pulse 1s infinite' : 'none',
                      }}>{fmtTime(left)}</strong>
                    </span>
                  )}
                  <button type="button" className="reset-resend" onClick={sendCode}>
                    인증번호 재발급
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: 새 비밀번호 ── */}
          {step === 3 && (
            <>
              <div className="field">
                <label className="field__label"><Icon name="lock" size={11}/> 새 비밀번호</label>
                <input type="password" className="input" autoFocus placeholder="4자 이상"
                       value={newPw} onChange={(e) => { setNewPw(e.target.value); setErr(''); }}/>
              </div>
              <div className="field">
                <label className="field__label"><Icon name="lock" size={11}/> 새 비밀번호 확인</label>
                <input type="password" className="input" placeholder="다시 입력"
                       value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setErr(''); }}/>
              </div>
            </>
          )}

          {/* ── Step 4: 완료 ── */}
          {step === 4 && (
            <div className="reset-done">
              <div className="reset-done__icon"><Icon name="check" size={26}/></div>
              <div className="reset-done__title">비밀번호가 변경되었습니다</div>
              <div className="reset-done__sub"><strong>{userId}</strong> 계정의 새 비밀번호로 로그인하세요.</div>
            </div>
          )}

          {err && <div className="login__err"><Icon name="alert" size={13}/> {err}</div>}
        </div>

        <div className="modal__foot">
          {step === 1 && <>
            <button className="btn btn--secondary" onClick={onClose}>취소</button>
            <button className="btn btn--primary" disabled={busy} onClick={sendCode}>
              {busy ? '확인 중…' : <><Icon name="check" size={13}/> 이메일 확인 · 인증번호 발급</>}
            </button>
          </>}
          {step === 2 && <>
            <button className="btn btn--secondary" onClick={() => { setStep(1); setSentAt(null); setSentCode(''); setCode(''); setErr(''); }}>이전</button>
            <button className="btn btn--primary" disabled={expired || code.length < 6} onClick={verifyCode}>인증 확인</button>
          </>}
          {step === 3 && <>
            <button className="btn btn--secondary" onClick={() => { setStep(2); setErr(''); }}>이전</button>
            <button className="btn btn--primary" onClick={savePw}><Icon name="check" size={13}/> 비밀번호 변경</button>
          </>}
          {step === 4 && <button className="btn btn--primary" onClick={onClose}>로그인으로 돌아가기</button>}
        </div>
      </div>
    </div>
  );
}

window.LoginScreen = LoginScreen;
