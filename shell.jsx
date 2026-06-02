// App shell: top nav + screen container + global store

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// Global store via simple hook + window event
const STORE_KEY = '__pm_store__';
window[STORE_KEY] = window[STORE_KEY] || {
  orders: [],
  listeners: new Set(),
  selectedOrderId: null,
  editingOrderId: null,
  currentUser: null,
  dbReady: false,
  view: 'sales', // 'sales' | 'waiting' | 'mapping' | 'completed' | 'lookup'
  waitingView: 'table', // 'table' | 'card' | 'kanban' | 'timeline'
  toast: null,
  completingOrderId: null,
};

function notify() {
  window[STORE_KEY].listeners.forEach((fn) => fn());
}

function useStore() {
  const [, setT] = useState(0);
  useEffect(() => {
    const fn = () => setT((x) => x + 1);
    window[STORE_KEY].listeners.add(fn);
    return () => window[STORE_KEY].listeners.delete(fn);
  }, []);
  return window[STORE_KEY];
}

window.useStore = useStore;
window.notify = notify;

const ORDER_FIELD_LABELS = {
  customer_name: '고객사', customer_manager: '고객사 담당자', model_name: '모델',
  delivery_date: '납품일자', station_id: '충전소 ID', router_no: '라우터번호',
  usim_no: 'USIM번호', install_address: '설치주소',
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
    setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, 2400);
  },
  login(userId, password) {
    const u = window.PMDB.authenticate(userId, password);
    if (!u) return false;
    const s = window[STORE_KEY];
    s.currentUser = u;
    try { localStorage.setItem('pm_session', u.user_id); } catch (e) {}
    const allowed = window.ROLE_TABS[u.role] || ['lookup'];
    s.view = allowed[0];
    s.selectedOrderId = null;
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
    s.view = 'sales';
    notify();
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
    window[STORE_KEY].selectedOrderId = id;
    notify();
  },
  setView(v) {
    window[STORE_KEY].view = v;
    notify();
  },
  setWaitingView(v) {
    window[STORE_KEY].waitingView = v;
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
      s.toast = { kind: 'success', text: `오더 #${order_id} 생산완료 처리` };
      s.selectedOrderId = null;
      s.view = 'waiting';
      notify();
      setTimeout(() => { window[STORE_KEY].toast = null; notify(); }, 2600);
    }, 900);
  },
};

function TopNav() {
  const s = useStore();
  const pendingCount = s.orders.filter(o => o.status === 'PENDING').length;
  const inProgressCount = s.orders.filter(o => o.status === 'IN_PROGRESS').length;
  const completedCount = s.orders.filter(o => o.status === 'COMPLETED').length;
  const user = s.currentUser;
  const allowed = user ? (window.ROLE_TABS[user.role] || []) : [];

  const TAB_META = {
    sales:     { label: '영업 입력' },
    waiting:   { label: '생산 대기', count: pendingCount + inProgressCount },
    mapping:   { label: '생산 매핑' },
    completed: { label: '생산 완료', count: completedCount },
    lookup:    { label: '조회' },
  };

  return (
    <header className="topnav">
      <div className="topnav__brand">
        <div className="topnav__logo">P</div>
        <span>EgtronicsCharger Management Web</span>
        <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, marginLeft: 4, padding: '2px 6px', border: '1px solid var(--border-1)', borderRadius: 4, letterSpacing: '0.04em' }}>v2.5</span>
      </div>
      <nav className="topnav__tabs">
        {allowed.map(k => (
          <button key={k}
                  className={`topnav__tab ${s.view === k ? 'topnav__tab--active' : ''}`}
                  onClick={() => window.actions.setView(k)}>
            {TAB_META[k].label}
            {TAB_META[k].count != null && <span className="topnav__count">{TAB_META[k].count}</span>}
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
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const initial = user.role;//(user.name || user.user_id || '?').slice(0, 1);
  
  return (
    <div className="usermenu" ref={ref}>
      <button className="usermenu__trigger" onClick={() => setOpen(v => !v)}>
        
        <span className="usermenu__role" data-role={user.role}>{window.ROLE_LABEL[user.role]}</span>
        <span className="usermenu__meta">
        </span>
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
          <button className="usermenu__item" onClick={() => { setOpen(false); window.actions.logout(); }}>
            <Icon name="external" size={20}/> 로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

window.TopNav = TopNav;

function Toast() {
  const s = useStore();
  if (!s.toast) return null;
  const err = s.toast.kind === 'error';
  return (
    <div className={`toast ${err ? 'toast--error' : ''}`}>
      <Icon name={err ? 'alert' : 'check'} size={14}/>
      {s.toast.text}
    </div>
  );
}

window.Toast = Toast;
