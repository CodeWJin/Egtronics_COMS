// 로그인 화면 + 역할(Role) 접근 설정

// 역할별 접근 가능한 탭
window.ROLE_TABS = {
  admin:      ['dashboard', 'sales', 'waiting', 'AwaitPickup', 'lookup', 'admin', 'as-receipt', 'as-processing'],
  sales:      ['dashboard', 'sales', 'waiting', 'lookup','as-receipt','as-processing'],
  production: ['dashboard', 'waiting', 'AwaitPickup', 'lookup'],
  quality:    ['dashboard', 'AwaitPickup', 'lookup', 'as-receipt', 'as-processing'],
};
window.ROLE_LABEL = { admin: '관리자', sales: '영업', production: '생산', quality: '품질' };

const { useState: useStateAU } = React;

function LoginScreen() {
  const s = window.useStore();
  const [userId, setUserId] = useStateAU('');
  const [pw, setPw] = useStateAU('');
  const [err, setErr] = useStateAU('');
  const [busy, setBusy] = useStateAU(false);

  const submit = async (e) => {
    if (e) e.preventDefault();
    setErr('');
    if (!userId || !pw) { setErr('아이디와 비밀번호를 입력하세요'); return; }
    setBusy(true);
    try {
      const ok = await window.actions.login(userId.trim(), pw);
      if (!ok) setErr('아이디 또는 비밀번호가 올바르지 않습니다');
    } catch (e) {
      console.error('[Login]', e);
      setErr('로그인 중 오류가 발생했습니다. 다시 시도하세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      {/* ── 다크 왼쪽 패널 ── */}
      <div className="login__side">
        <div className="login__side__brand">
          <img className="login__logo--inv" src="logo_header_black.png" alt="Egtronics"/>
          <span className="login__side__brand-name">COMS</span>
        </div>
        <div className="login__side__tagline">
          Egtronics 충전기 통합 관리 시스템
        </div>
        <ul className="login__side__feats">
          <li className="login__side__feat">
            <span className="login__side__feat-icon"><Icon name="cart" size={14}/></span>
            영업 발주부터 출하까지 한 화면으로
          </li>
          <li className="login__side__feat">
            <span className="login__side__feat-icon"><Icon name="factory" size={14}/></span>
            생산·품질 전주기 이력 추적
          </li>
          <li className="login__side__feat">
            <span className="login__side__feat-icon"><Icon name="shield" size={14}/></span>
            AS 접수·처리 이력 통합 관리
          </li>
        </ul>
        <div className="login__side__foot">© 2026 Egtronics Co., Ltd.</div>
        <svg className="login__side__watermark" viewBox="0 0 220 320" fill="currentColor" aria-hidden="true">
          <polygon points="128,18 52,162 118,162 88,302 186,148 120,148"/>
        </svg>
      </div>

      {/* ── 흰색 폼 패널 ── */}
      <div className="login__form-panel">
        <div className="login__card">
          <h1 className="login__title">로그인</h1>
          <form onSubmit={submit} className="login__form">
            <div className="field">
              <label className="field__label" htmlFor="login-userid">
                <Icon name="user" size={11}/>아이디
              </label>
              <input id="login-userid" className={`input ${err ? 'input--error' : ''}`} autoFocus
                     placeholder="예: admin"
                     value={userId}
                     onChange={(e) => { setUserId(e.target.value); setErr(''); }}/>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="login-pw">
                <Icon name="lock" size={11}/>비밀번호
              </label>
              <input id="login-pw" type="password"
                     className={`input ${err ? 'input--error' : ''}`}
                     placeholder="••••"
                     value={pw}
                     onChange={(e) => { setPw(e.target.value); setErr(''); }}/>
            </div>
            {err && <div role="alert" className="login__err"><Icon name="alert" size={13}/> {err}</div>}
            <button type="submit" className="btn btn--primary btn--lg login__submit" disabled={busy}>
              {busy ? '확인 중…' : <><Icon name="arrow-right" size={15}/> 로그인</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

window.LoginScreen = LoginScreen;
