// Main app

function App() {
  const s = window.useStore();

  // Initial deep-link if no order selected and on mapping
  React.useEffect(() => {
    if (s.view === 'mapping' && !s.selectedOrderId) {
      const first = s.orders.find(o => o.status === 'PENDING');
      if (first) window.actions.selectOrder(first.order_id);
    }
  }, [s.view]);

  // Tweaks
  const [t, setTweak] = useTweaks({
    accent: '#2563EB',
    density: 'regular',
    cornerStyle: 'soft',
    defaultView: 'table',
  });

  // Apply tweak side-effects
  React.useEffect(() => {
    document.documentElement.style.setProperty('--primary', t.accent);
    // Derive primary-600 (slightly darker)
    const darken = (hex) => {
      const m = hex.replace('#', '').match(/.{2}/g);
      if (!m) return hex;
      const [r, g, b] = m.map(x => Math.max(0, parseInt(x, 16) - 20));
      return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
    };
    document.documentElement.style.setProperty('--primary-600', darken(t.accent));
    // Primary-50 / 100 — lighten via rgba mix
    const hex2rgb = (hex) => {
      const m = hex.replace('#', '').match(/.{2}/g);
      return m ? m.map(x => parseInt(x, 16)) : [37,99,235];
    };
    const [pr, pg, pb] = hex2rgb(t.accent);
    document.documentElement.style.setProperty('--primary-50', `rgba(${pr},${pg},${pb},0.08)`);
    document.documentElement.style.setProperty('--primary-100', `rgba(${pr},${pg},${pb},0.18)`);
  }, [t.accent]);

  React.useEffect(() => {
    const map = { compact: 12.5, regular: 14, comfy: 15 };
    document.body.style.fontSize = map[t.density] + 'px';
  }, [t.density]);

  React.useEffect(() => {
    const r = t.cornerStyle === 'sharp' ? { sm: 3, md: 4, lg: 6, xl: 8, xxl: 10 }
            : t.cornerStyle === 'round' ? { sm: 8, md: 12, lg: 16, xl: 22, xxl: 28 }
            : { sm: 6, md: 8, lg: 12, xl: 16, xxl: 20 };
    document.documentElement.style.setProperty('--r-sm', r.sm + 'px');
    document.documentElement.style.setProperty('--r-md', r.md + 'px');
    document.documentElement.style.setProperty('--r-lg', r.lg + 'px');
    document.documentElement.style.setProperty('--r-xl', r.xl + 'px');
    document.documentElement.style.setProperty('--r-2xl', r.xxl + 'px');
  }, [t.cornerStyle]);

  // Persist defaultView into store once on mount
  const setDefaultViewRef = React.useRef(false);
  React.useEffect(() => {
    if (!setDefaultViewRef.current) {
      window.actions.setWaitingView(t.defaultView);
      setDefaultViewRef.current = true;
    }
  }, [t.defaultView]);

  // Redirect away from tabs the current role cannot access
  React.useEffect(() => {
    const u = s.currentUser;
    if (!u) return;
    const allowed = window.ROLE_TABS[u.role] || [];
    if (allowed.length && !allowed.includes(s.view)) {
      window.actions.setView(allowed[0]);
    }
  }, [s.currentUser, s.view]);

  // Gate everything behind login
  if (!s.currentUser) {
    return (<><LoginScreen/><Toast/></>);
  }

  return (
    <div className="app-shell">
      <TopNav/>
      <main style={{ flex: 1, overflow: 'auto' }}>
        {s.view === 'sales'   && <SalesInputScreen/>}
        {s.view === 'waiting' && <ProductionWaitingScreen/>}
        {s.view === 'mapping' && <ProductionMappingScreen/>}
        {s.view === 'completed' && <ProductionCompleteScreen/>}
        {s.view === 'lookup'  && <OrderLookupScreen/>}
      </main>
      <Toast/>

      <TweaksPanel>
        <TweakSection label="테마" />
        <TweakColor label="강조색"
                    value={t.accent}
                    options={['#2563EB', '#0E7490', '#7C3AED', '#15803D', '#DC2626', '#0F172A']}
                    onChange={(v) => setTweak('accent', v)}/>
        <TweakRadio label="모서리"
                    value={t.cornerStyle}
                    options={['sharp', 'soft', 'round']}
                    onChange={(v) => setTweak('cornerStyle', v)}/>
        <TweakSection label="밀도" />
        <TweakRadio label="텍스트 크기"
                    value={t.density}
                    options={['compact', 'regular', 'comfy']}
                    onChange={(v) => setTweak('density', v)}/>
        <TweakSection label="생산대기 기본 보기" />
        <TweakRadio label="레이아웃"
                    value={t.defaultView}
                    options={['table', 'card', 'kanban', 'timeline']}
                    onChange={(v) => { setTweak('defaultView', v); window.actions.setWaitingView(v); }}/>
        <TweakSection label="데모 액션" />
        <TweakButton label="신규 오더 화면으로" onClick={() => window.actions.setView('sales')}/>
        <TweakButton label="생산 대기 화면으로" onClick={() => window.actions.setView('waiting')}/>
        <TweakButton label="생산 완료 화면으로" onClick={() => window.actions.setView('completed')}/>
        <TweakButton label="통합 조회 화면으로" onClick={() => window.actions.setView('lookup')}/>
        <TweakButton label="첫 오더 매핑 시작" onClick={() => {
          const store = window['__pm_store__'];
          const pending = store ? store.orders.find(o => o.status === 'PENDING') : null;
          if (pending) {
            window.actions.selectOrder(pending.order_id);
            window.actions.setView('mapping');
          }
        }}/>
      </TweaksPanel>
    </div>
  );
}

function boot() {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  window.PMDB.init().then(() => {
    const store = window['__pm_store__'];
    store.dbReady = true;
    store.orders = window.PMDB.loadOrders();
    try {
      const sess = localStorage.getItem('pm_session');
      if (sess) { const u = window.PMDB.getUser(sess); if (u) store.currentUser = u; }
    } catch (e) {}
    root.render(<App/>);
  });
}
boot();
