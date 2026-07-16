// App shell: top nav + screen container + global store

const { useState: useStateSH, useEffect: useEffectSH, useMemo: useMemoSH, useRef: useRefSH } = React;

// Global store via simple hook + window event
const STORE_KEY = '__pm_store__';
window[STORE_KEY] = window[STORE_KEY] || {
  orders: [],
  listeners: new Set(),
  selectedOrderId: null,
  editingOrderId: null,
  currentUser: null,
  dbReady: false,
  view: 'sales', // 'sales' | 'waiting' | 'AwaitPickup' | 'lookup' | 'as-receipt' | 'as-processing'
  toast: null,
  completingOrderId: null,
  asReceptions: [],
  selectedAsId: null,
  confirmModal: null,
};

function notify() {
  window[STORE_KEY].listeners.forEach((fn) => fn());
}

function useStore() {
  const [, setT] = useStateSH(0);
  useEffectSH(() => {
    const fn = () => setT((x) => x + 1);
    window[STORE_KEY].listeners.add(fn);
    return () => window[STORE_KEY].listeners.delete(fn);
  }, []);
  return window[STORE_KEY];
}

window.useStore = useStore;
window.notify = notify;

// 모델 마스터 조회 — model_name에는 model_code가 저장됨
window.findModelInfo = function (modelName) {
  if (!modelName || !window.PMDB || !window.PMDB.getModels) return null;
  return window.PMDB.getModels().find(m => m.model === modelName) || null;
};

// 생산완료(AWAIT_PICKUP) 단계 영업정보 입력이 끝났는지 — "생산완료"와 "출하대기"를
// 같은 status(AWAIT_PICKUP)에서 구분하는 파생 플래그
window.isSalesInfoComplete = function (o) {
  if (!o) return false;
  const commonOk = !!(o.customer_name && o.delivery_date && o.install_address && o.cable_length && o.customer_manager && o.field_manager_phone);
  if (!commonOk) return false;
  if ((o.usage_type || '공용') === '공용') return !!(o.station_id && o.charger_no && o.router_no && o.usim_no);
  return true;
};

// main 스크롤 잠금 훅 — 드로어·모달 공용
function useLockScroll() {
  useEffectSH(() => {
    const el = document.querySelector('main');
    if (!el) return;
    const scrollTop = el.scrollTop;
    const inner = el.firstElementChild;
    el.style.overflow = 'hidden';
    // overflow:hidden 적용 시 브라우저가 scrollTop을 0으로 리셋하므로
    // 첫 번째 자식을 위로 밀어 시각적 위치를 유지
    if (inner && scrollTop > 0) inner.style.marginTop = `-${scrollTop}px`;
    return () => {
      el.style.overflow = '';
      if (inner) inner.style.marginTop = '';
      el.scrollTop = scrollTop;
    };
  }, []);
}
window.useLockScroll = useLockScroll;

const ORDER_FIELD_LABELS = {
  customer_name: '고객사', customer_manager: '고객사 담당자', model_name: '모델',
  delivery_date: '납품일자', install_address: '설치주소',
  station_id: '충전소 ID', router_no: '라우터번호', usim_no: 'USIM번호',
  cable_length: '케이블 길이', field_manager_phone: '담당자 전화번호', requested_by: '생산요청자',
};
function localTimestamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

window.actions = {
  flashToast(text, kind = 'success') {
    const s = window[STORE_KEY];
    s.toast = { kind, text };
    notify();
    const duration = Math.max(2400, text.length * 80);
    setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, duration);
  },
  async login(userId, password) {
    let u;
    try { u = await window.PMDB.authenticate(userId, password); } catch (e) { console.error('[login]', e); return false; }
    if (!u) return false;
    const s = window[STORE_KEY];
    s.currentUser = u;
    try { localStorage.setItem('pm_session', u.user_id); } catch (e) {}
    const allowed = window.ROLE_TABS[u.role] || ['lookup'];
    s.view = allowed[0];
    s.selectedOrderId = null;
    history.replaceState({ view: allowed[0], selectedOrderId: null }, '', '#' + allowed[0]);
    window.actions.flashToast(`${u.name}님 환영합니다 · ${window.ROLE_LABEL[u.role]} 권한`);
    notify();
    return true;
  },
  logout() {
    const s = window[STORE_KEY];
    s.currentUser = null;
    s.selectedOrderId = null;
    s.editingOrderId = null;
    try { localStorage.removeItem('pm_session'); } catch (e) {}
    notify();
  },
  refreshOrders() {
    const s = window[STORE_KEY];
    s.orders = window.PMDB.loadOrders();
    notify();
  },
  addOrder(order) {
    const s = window[STORE_KEY];
    const nextId = window.PMDB.addOrder(order);
    const fields = Object.entries(ORDER_FIELD_LABELS)
      .filter(([k]) => order[k])
      .map(([k, label]) => ({ field: k, label, before: '', after: order[k] || '' }));
    window.PMDB.addHistory(nextId, s.currentUser ? s.currentUser.name : '알 수 없음', localTimestamp(), fields, 'create');
    s.orders = window.PMDB.loadOrders();
    s.toast = { kind: 'success', text: `오더 #${nextId} 등록 완료` };
    notify();
    setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, 2400);
  },
  // 영업 수정: 생산대기(PENDING) 오더만 진입
  editOrder(id) {
    const s = window[STORE_KEY];
    const o = s.orders.find(x => x.order_id === id);
    if (!o || o.status !== 'PENDING') {
      window.actions.flashToast('생산대기 상태의 오더만 수정할 수 있습니다', 'error');
      return;
    }
    s.editingOrderId = id;
    window.actions.setView('sales');
  },
  cancelEdit() {
    window[STORE_KEY].editingOrderId = null;
    notify();
  },
  updateOrder(id, form) {
    const s = window[STORE_KEY];
    const current = s.orders.find(x => x.order_id === id);
    const ok = window.PMDB.updateOrder(id, form);
    if (!ok) { window.actions.flashToast('생산대기 상태가 아니어서 수정할 수 없습니다', 'error'); return false; }
    if (current) {
      const changed = Object.entries(ORDER_FIELD_LABELS)
        .filter(([k]) => String(current[k] || '') !== String(form[k] || ''))
        .map(([k, label]) => ({ field: k, label, before: current[k] || '', after: form[k] || '' }));
      if (changed.length) {
        window.PMDB.addHistory(id, s.currentUser ? s.currentUser.name : '알 수 없음', localTimestamp(), changed, 'update');
      }
    }
    s.orders = window.PMDB.loadOrders();
    s.editingOrderId = null;
    s.toast = { kind: 'success', text: `오더 #${id} 수정 완료` };
    notify();
    setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, 2400);
    return true;
  },
  revertOrder(order_id) {
    const s = window[STORE_KEY];
    window.PMDB.revertOrder(order_id);
    s.orders = window.PMDB.loadOrders();
    s.toast = { kind: 'success', text: `오더 #${order_id} 생산대기로 변경` };
    notify();
    setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, 2400);
  },
  revertToAwaitPickup(order_id) {
    const s = window[STORE_KEY];
    const ok = window.PMDB.revertToAwaitPickup(order_id);
    if (!ok) return;
    s.orders = window.PMDB.loadOrders();
    s.toast = { kind: 'success', text: `오더 #${order_id} 출하대기로 변경` };
    notify();
    setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, 2400);
  },
  revertToInProgress(order_id) {
    const s = window[STORE_KEY];
    const ok = window.PMDB.revertToInProgress(order_id);
    if (!ok) return;
    s.orders = window.PMDB.loadOrders();
    s.toast = { kind: 'success', text: `오더 #${order_id} 생산진행중으로 변경` };
    notify();
    setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, 2400);
  },
  awaitToInProgress(order_id) {
    const s = window[STORE_KEY];
    const ok = window.PMDB.awaitToInProgress(order_id);
    if (!ok) return;
    s.orders = window.PMDB.loadOrders();
    s.toast = { kind: 'success', text: `오더 #${order_id} 작업중으로 변경` };
    notify();
    setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, 2400);
  },
  startProduction(order_id) {
    const s = window[STORE_KEY];
    const ok = window.PMDB.startProduction(order_id);
    if (!ok) { window.actions.flashToast('생산대기 상태의 오더만 시작할 수 있습니다', 'error'); return; }
    s.orders = window.PMDB.loadOrders();
    s.toast = { kind: 'success', text: `오더 #${order_id} 생산 시작` };
    notify();
    setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, 2400);
  },
  selectOrder(id) {
    const s = window[STORE_KEY];
    s.selectedOrderId = id;
    notify();
  },
  setView(v) {
    const s = window[STORE_KEY];
    if (s.view !== v) {
      history.pushState({ view: v, selectedOrderId: s.selectedOrderId }, '', '#' + v);
    }
    s.view = v;
    notify();
  },
  setViewReplace(v) {
    const s = window[STORE_KEY];
    history.replaceState({ view: v, selectedOrderId: s.selectedOrderId }, '', '#' + v);
    s.view = v;
    notify();
  },
  completeOrder(order_id, production) {
    const s = window[STORE_KEY];
    s.completingOrderId = order_id;
    notify();
    setTimeout(() => {
      window.PMDB.completeOrder(order_id, production);
      s.orders = window.PMDB.loadOrders();
      s.completingOrderId = null;
      s.toast = { kind: 'success', text: `오더 #${order_id} 생산완료 — 출하대기로 이동` };
      s.selectedOrderId = null;
      window.actions.setView('waiting');
      setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, 2600);
    }, 900);
  },
  shipOrder(order_id) {
    const s = window[STORE_KEY];
    const ok = window.PMDB.shipOrder(order_id);
    if (!ok) { window.actions.flashToast('출하대기 상태의 오더만 출하 처리할 수 있습니다', 'error'); return; }
    s.orders = window.PMDB.loadOrders();
    s.toast = { kind: 'success', text: `오더 #${order_id} 출하 완료 처리` };
    notify();
    setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, 2400);
  },

  // ── AS 접수 ────────────────────────────────────────────────────
  addAsReception(form) {
    const s = window[STORE_KEY];
    const result = window.PMDB.addAsReception({ ...form, received_by: s.currentUser ? s.currentUser.user_id : '' });
    window.PMDB.addAsLog(result.id, '', '접수대기', '접수 등록', s.currentUser ? s.currentUser.name : '');
    s.asReceptions = window.PMDB.loadAsReceptions();
    s.toast = { kind: 'success', text: `${result.reception_no} 접수 완료` };
    notify();
    setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, 2400);
    return result;
  },
  updateAsReception(id, form, memo) {
    const s = window[STORE_KEY];
    const current = window.PMDB.getAsReception(id);
    const prevStatus = current ? current.status : '';
    window.PMDB.updateAsReception(id, form);
    if (form.status && form.status !== prevStatus) {
      window.PMDB.addAsLog(id, prevStatus, form.status, memo || '', s.currentUser ? s.currentUser.name : '');
    }
    s.asReceptions = window.PMDB.loadAsReceptions();
    s.toast = { kind: 'success', text: 'AS 처리 내용 저장' };
    notify();
    setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, 2400);
  },
  selectAs(id) {
    window[STORE_KEY].selectedAsId = id;
    notify();
  },
  showConfirm(message, onConfirm, opts = {}) {
    window[STORE_KEY].confirmModal = { message, onConfirm, ...opts };
    notify();
  },
  closeConfirm() {
    window[STORE_KEY].confirmModal = null;
    notify();
  },
};

// 도움말 팝오버 — title 툴팁은 태블릿 터치에서 표시되지 않으므로 클릭·탭 토글로 제공
function HelpDot({ text }) {
  const [open, setOpen] = useStateSH(false);
  const ref = useRefSH(null);
  useEffectSH(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span className="helpdot-wrap" ref={ref}>
      <button type="button" className="helpdot" aria-expanded={open}
              aria-haspopup="dialog"
              aria-label={`도움말: ${text}`}
              onClick={() => setOpen(v => !v)}>?</button>
      {open && <span role="dialog" aria-label={text} className="helpdot-pop">{text}</span>}
    </span>
  );
}
window.HelpDot = HelpDot;

function TopNav() {
  const s = useStore();
  const pendingCount = s.orders.filter(o => o.status === 'PENDING').length;
  const awaitPickupCount = s.orders.filter(o => o.status === 'AWAIT_PICKUP' && window.isSalesInfoComplete(o)).length;
  const user = s.currentUser;
  const allowed = user ? (window.ROLE_TABS[user.role] || []) : [];

  const asCount = (s.asReceptions || []).filter(r => r.status !== '처리완료').length;

  const TAB_META = {
    dashboard:       { label: '대시보드' },
    sales:           { label: '생산 요청' },
    waiting:         { label: '생산 대기', count: pendingCount },
    AwaitPickup:     { label: '출하대기', count: awaitPickupCount },
    lookup:          { label: '조회' },
    admin:           { label: '사용자 관리' },
    'as-receipt':    { label: 'AS 접수', count: asCount },
    'as-processing': { label: 'AS 처리' },
  };

  return (
    <header className="topnav">
      <div className="topnav__brand">
        <img className="topnav__logo" src="logo_header.png" alt="Egtronics" />
        <span style={{ display: 'inline-block' }}>COMS</span>
        <span className="topnav__version">v2.0</span>
      </div>
      <nav className="topnav__tabs">
        {allowed.map(k => (
          <button key={k}
                  className={`topnav__tab ${s.view === k ? 'topnav__tab--active' : ''}`}
                  aria-current={s.view === k ? 'page' : undefined}
                  onClick={() => window.actions.setView(k)}>
            {TAB_META[k].label}
            {TAB_META[k].count > 0 && <span className="topnav__count" aria-label={`${TAB_META[k].count}건`}>{TAB_META[k].count}</span>}
          </button>
        ))}
      </nav>
      <div className="topnav__spacer" />
      <div className="topnav__right">
        {user && <UserMenu user={user}/>}
      </div>
    </header>
  );
}

function UserMenu({ user }) {
  const [open, setOpen] = useStateSH(false);
  const [showChangePw, setShowChangePw] = useStateSH(false);
  const ref = useRefSH(null);
  useEffectSH(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', fn);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', fn);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  return (
    <div className="usermenu" ref={ref}>
      <button className="usermenu__trigger" aria-expanded={open} aria-haspopup="menu" aria-label={`사용자 메뉴 — ${user.name}`} onClick={() => setOpen(v => !v)}>
        <span className="usermenu__role" data-role={user.role}>{window.ROLE_LABEL[user.role]}</span>
        <span className="usermenu__name">{user.name}</span>
        <Icon name="chevron-down" size={20} style={{ color: 'var(--ink-4)' }}/>
      </button>
      {open && (
        <div className="usermenu__pop">
          <div className="usermenu__head">
            <div className="usermenu__head__name">{user.name}</div>
            <div className="usermenu__head__sub">{user.dept} · @{user.user_id}</div>
          </div>
          <div className="usermenu__divider"/>
          <button className="usermenu__item" onClick={() => { setOpen(false); setShowChangePw(true); }}>
            <Icon name="lock" size={14}/> 비밀번호 변경
          </button>
          <button className="usermenu__item" onClick={() => { setOpen(false); window.actions.logout(); }}>
            <Icon name="external" size={20}/> 로그아웃
          </button>
        </div>
      )}
      {showChangePw && (
        <ChangePasswordModal user={user} onClose={() => setShowChangePw(false)}/>
      )}
    </div>
  );
}

function ChangePasswordModal({ user, onClose }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const [step, setStep] = useStateSH(1); // 1: 현재 비밀번호  2: 새 비밀번호  3: 완료
  const [curPw, setCurPw] = useStateSH('');
  const [newPw, setNewPw] = useStateSH('');
  const [confirmPw, setConfirmPw] = useStateSH('');
  const [err, setErr] = useStateSH('');
  const [busy, setBusy] = useStateSH(false);

  const verifyCurrentPw = async () => {
    setErr('');
    if (!curPw) { setErr('현재 비밀번호를 입력하세요'); return; }
    setBusy(true);
    const ok = await window.PMDB.authenticate(user.user_id, curPw);
    setBusy(false);
    if (!ok) { setErr('현재 비밀번호가 올바르지 않습니다'); return; }
    setStep(2);
  };

  const saveNewPw = async () => {
    setErr('');
    if (newPw.length < 4) { setErr('비밀번호는 4자 이상이어야 합니다'); return; }
    if (newPw !== confirmPw) { setErr('새 비밀번호가 일치하지 않습니다'); return; }
    if (newPw === curPw) { setErr('현재 비밀번호와 동일합니다'); return; }
    setBusy(true);
    await window.PMDB.changePassword(user.user_id, newPw);
    setBusy(false);
    setStep(3);
  };

  const STEPS = ['현재 비밀번호', '새 비밀번호'];

  return (
    <div className="modal-backdrop" ref={dialogRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-chpw-title" style={{ width: 400, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h2 id="modal-chpw-title" className="modal__title">{step === 3 ? '변경 완료' : '비밀번호 변경'}</h2>
          <p className="modal__sub">{user.name} ({user.user_id})</p>
        </div>

        {step < 3 && (
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
          {step === 1 && (
            <div className="field">
              <label className="field__label" htmlFor="chpw-cur"><Icon name="lock" size={11}/> 현재 비밀번호</label>
              <input id="chpw-cur" type="password" className="input" autoFocus placeholder="현재 비밀번호 입력"
                     value={curPw}
                     onChange={(e) => { setCurPw(e.target.value); setErr(''); }}
                     onKeyDown={(e) => e.key === 'Enter' && verifyCurrentPw()}/>
            </div>
          )}

          {step === 2 && (
            <>
              <div className="field">
                <label className="field__label" htmlFor="chpw-new"><Icon name="lock" size={11}/> 새 비밀번호</label>
                <input id="chpw-new" type="password" className="input" autoFocus placeholder="4자 이상"
                       value={newPw}
                       onChange={(e) => { setNewPw(e.target.value); setErr(''); }}/>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="chpw-confirm"><Icon name="lock" size={11}/> 새 비밀번호 확인</label>
                <input id="chpw-confirm" type="password" className="input" placeholder="다시 입력"
                       value={confirmPw}
                       onChange={(e) => { setConfirmPw(e.target.value); setErr(''); }}
                       onKeyDown={(e) => e.key === 'Enter' && saveNewPw()}/>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="reset-done">
              <div className="reset-done__icon"><Icon name="check" size={26}/></div>
              <div className="reset-done__title">비밀번호가 변경되었습니다</div>
              <div className="reset-done__sub">다음 로그인부터 새 비밀번호를 사용하세요.</div>
            </div>
          )}

          {err && <div role="alert" className="login__err"><Icon name="alert" size={13}/> {err}</div>}
        </div>

        <div className="modal__foot">
          {step === 1 && <>
            <button className="btn btn--secondary" onClick={onClose}>취소</button>
            <button className="btn btn--primary" disabled={busy} onClick={verifyCurrentPw}>
              {busy ? '확인 중…' : '다음'}
            </button>
          </>}
          {step === 2 && <>
            <button className="btn btn--secondary" onClick={() => { setStep(1); setCurPw(''); setErr(''); }}>이전</button>
            <button className="btn btn--primary" disabled={busy} onClick={saveNewPw}>
              {busy ? '저장 중…' : <><Icon name="check" size={13}/> 비밀번호 변경</>}
            </button>
          </>}
          {step === 3 && <button className="btn btn--primary" onClick={onClose}>닫기</button>}
        </div>
      </div>
    </div>
  );
}

window.TopNav = TopNav;

// 모바일(≤600px) 하단 탭바 — 현장에서 엄지 도달 범위 안에 주요 화면 이동 배치.
// CSS(.mobilenav)가 데스크탑에서는 display:none 처리하므로 항상 렌더링해도 안전.
function MobileTabBar() {
  const s = useStore();
  const user = s.currentUser;
  if (!user) return null;
  const allowed = window.ROLE_TABS[user.role] || [];

  const pendingCount = s.orders.filter(o => o.status === 'PENDING').length;
  const awaitPickupCount = s.orders.filter(o => o.status === 'AWAIT_PICKUP' && window.isSalesInfoComplete(o)).length;
  const asCount = (s.asReceptions || []).filter(r => r.status !== '처리완료').length;

  const META = {
    dashboard:       { label: '대시보드', icon: 'grid' },
    sales:           { label: '영업', icon: 'cart' },
    waiting:         { label: '생산대기', icon: 'clock', count: pendingCount },
    mapping:         { label: '생산입력', icon: 'factory' },
    AwaitPickup:     { label: '출하대기', icon: 'truck', count: awaitPickupCount },
    lookup:          { label: '조회', icon: 'search' },
    admin:           { label: '사용자', icon: 'users' },
    'as-receipt':    { label: 'AS접수', icon: 'bell', count: asCount },
    'as-processing': { label: 'AS처리', icon: 'settings' },
  };

  return (
    <nav className="mobilenav" aria-label="주요 화면 이동">
      {allowed.map(k => {
        const m = META[k];
        if (!m) return null;
        const active = s.view === k;
        return (
          <button key={k} type="button"
                  className={`mobilenav__item ${active ? 'mobilenav__item--active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => window.actions.setView(k)}>
            <span className="mobilenav__icon">
              <Icon name={m.icon} size={20}/>
              {m.count > 0 && (
                <span className="mobilenav__badge" aria-label={`${m.count}건`}>
                  {m.count > 99 ? '99+' : m.count}
                </span>
              )}
            </span>
            <span className="mobilenav__label">{m.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
window.MobileTabBar = MobileTabBar;

// 모달 키보드 접근성 훅 — Escape 닫기 + 포커스 트랩
// 반환된 ref 를 modal-backdrop 에 연결하면 자동 동작
function useModalKeyboard(onClose) {
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    const trigger = document.activeElement;
    const FOCUSABLE = 'button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const el = containerRef.current;
      if (!el) return;
      const nodes = Array.from(el.querySelectorAll(FOCUSABLE)).filter(n => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !el.contains(active)) { e.preventDefault(); last.focus(); }
      } else {
        if (active === last || !el.contains(active)) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handler);
    const t = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const first = el.querySelector(FOCUSABLE);
      first?.focus();
    }, 30);

    return () => {
      document.removeEventListener('keydown', handler);
      clearTimeout(t);
      if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
        trigger.focus();
      }
    };
  }, []);

  return containerRef;
}
window.useModalKeyboard = useModalKeyboard;

function Toast() {
  const s = useStore();
  if (!s.toast) return null;
  const err = s.toast.kind === 'error';
  return (
    <div role={err ? 'alert' : 'status'} aria-live={err ? 'assertive' : 'polite'} className={`toast ${err ? 'toast--error' : ''}`}>
      <Icon name={err ? 'alert' : 'check'} size={14}/>
      {s.toast.text}
    </div>
  );
}

window.Toast = Toast;

function ConfirmModal() {
  const s = useStore();
  const modal = s.confirmModal;
  const containerRef = useModalKeyboard(() => window.actions.closeConfirm());
  if (!modal) return null;
  return ReactDOM.createPortal(
    <div className="modal-backdrop" ref={containerRef}
         onClick={e => { if (e.target === e.currentTarget) window.actions.closeConfirm(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <div className="modal__head">
          <h2 className="modal__title" id="confirm-modal-title">{modal.title || '확인'}</h2>
        </div>
        <div className="modal__body">
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {modal.message}
          </p>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={() => window.actions.closeConfirm()}>취소</button>
          <button
            className={`btn ${modal.danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={() => { window.actions.closeConfirm(); modal.onConfirm(); }}>
            {modal.confirmLabel || '확인'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
window.ConfirmModal = ConfirmModal;
