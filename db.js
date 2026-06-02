// ============================================================
// EgtronicsCharger Management Web — Data layer (Supabase)
// 로컬 캐시로 동기 읽기, Supabase에 비동기 쓰기.
// 앱 시작 시 Supabase에서 전체 데이터를 로드합니다.
// ============================================================

(function () {
  const TODAY = new Date().toISOString().slice(0, 10);

  const SEED_USERS = [
    { user_id: 'admin', password: '1234', name: '박우진', role: 'admin',      dept: '충전기개발실', phone: '010-2567-8418', email: 'wjpark@egtronics.com' },
    { user_id: 'sales', password: '1234', name: '신정륜', role: 'sales',      dept: '영업부',       phone: '010-3000-4000', email: 'sales@egtrinocs.com' },
    { user_id: 'prod',  password: '1234', name: '김태윤', role: 'production', dept: '생산부',       phone: '010-5000-6000', email: 'prod@egtrinocs.com' },
  ];
  window.SEED_USERS = SEED_USERS;

  const primaryManagerFor = (customer) => {
    const ms = (window.SEED_MANAGERS || []).filter(m => m.customer_name === customer);
    const pm = ms.find(m => m.is_primary) || ms[0];
    return pm ? pm.name : '';
  };

  // ============================================================
  // Supabase 백엔드 (로컬 캐시 + 비동기 쓰기)
  // ============================================================
  function makeSupabaseBackend(client) {
    const cache = { orders: [], production: [], managers: [], users: [], history: [] };
    let mgrSeq = 0;
    let histSeq = 0;

    // 비동기 쓰기 — 로컬 캐시 업데이트 후 백그라운드에서 Supabase에 동기화
    function dbWrite(fn) {
      fn().then(({ error }) => {
        if (error) console.error('[DB] Supabase 쓰기 오류:', error.message);
      }).catch(err => console.error('[DB] 네트워크 오류:', err));
    }

    return {
      engine: 'supabase',

      async loadAll() {
        const [o, p, m, u, h] = await Promise.all([
          client.from('tb_sales_order').select('*'),
          client.from('tb_production_info').select('*'),
          client.from('tb_customer_manager').select('*'),
          client.from('users').select('*'),
          client.from('tb_order_history').select('*'),
        ]);
        if (o.error) throw new Error('주문 데이터 로드 실패: ' + o.error.message);
        cache.orders     = o.data || [];
        cache.production = p.data || [];
        cache.managers   = m.data || [];
        cache.users      = u.data || [];
        cache.history    = h.data || [];
        mgrSeq  = cache.managers.reduce((mx, x) => Math.max(mx, x.manager_id || 0), 0);
        histSeq = cache.history.reduce((mx, x) => Math.max(mx, x.history_id || 0), 0);
      },

      loadOrders() {
        const pmap = {};
        cache.production.forEach(p => { const { order_id, ...rest } = p; pmap[order_id] = rest; });
        return [...cache.orders]
          .sort((a, b) => (b.created || '').localeCompare(a.created || '') || b.order_id - a.order_id)
          .map(o => pmap[o.order_id] ? { ...o, production: pmap[o.order_id] } : { ...o });
      },

      addOrder(form) {
        const id = cache.orders.reduce((mx, o) => Math.max(mx, o.order_id), 24000) + 1;
        const row = { order_id: id, customer_name: form.customer_name, customer_manager: form.customer_manager || '', model_name: form.model_name, delivery_date: form.delivery_date, station_id: form.station_id, router_no: form.router_no, usim_no: form.usim_no, install_address: form.install_address, status: 'PENDING', created: TODAY };
        cache.orders.push(row);
        dbWrite(() => client.from('tb_sales_order').insert(row));
        return id;
      },

      updateOrder(order_id, form) {
        const o = cache.orders.find(x => x.order_id === order_id);
        if (!o || o.status !== 'PENDING') return false;
        const upd = { customer_name: form.customer_name, customer_manager: form.customer_manager || '', model_name: form.model_name, delivery_date: form.delivery_date, station_id: form.station_id, router_no: form.router_no, usim_no: form.usim_no, install_address: form.install_address };
        Object.assign(o, upd);
        dbWrite(() => client.from('tb_sales_order').update(upd).eq('order_id', order_id));
        return true;
      },

      saveProduction(order_id, p) {
        cache.production = cache.production.filter(x => x.order_id !== order_id);
        cache.production.push({ order_id, ...p });
        dbWrite(() => client.from('tb_production_info').upsert({ order_id, ...p }, { onConflict: 'order_id' }));
      },

      completeOrder(order_id, p) {
        cache.production = cache.production.filter(x => x.order_id !== order_id);
        cache.production.push({ order_id, ...p });
        const o = cache.orders.find(x => x.order_id === order_id);
        if (o) o.status = 'COMPLETED';
        dbWrite(async () => {
          await client.from('tb_production_info').upsert({ order_id, ...p }, { onConflict: 'order_id' });
          return client.from('tb_sales_order').update({ status: 'COMPLETED' }).eq('order_id', order_id);
        });
      },

      revertOrder(order_id) {
        const o = cache.orders.find(x => x.order_id === order_id);
        if (o) o.status = 'PENDING';
        dbWrite(() => client.from('tb_sales_order').update({ status: 'PENDING' }).eq('order_id', order_id));
      },

      startProduction(order_id) {
        const o = cache.orders.find(x => x.order_id === order_id);
        if (!o || o.status !== 'PENDING') return false;
        o.status = 'IN_PROGRESS';
        dbWrite(() => client.from('tb_sales_order').update({ status: 'IN_PROGRESS' }).eq('order_id', order_id));
        return true;
      },

      serialExists(serial) {
        return cache.production.some(p => p.serial_no === serial);
      },

      getManagers(customer_name) {
        const list = customer_name ? cache.managers.filter(m => m.customer_name === customer_name) : [...cache.managers];
        return list.sort((a, b) => (b.is_primary || 0) - (a.is_primary || 0) || (a.name || '').localeCompare(b.name || ''));
      },

      addManager(m) {
        if (m.is_primary) cache.managers.forEach(x => { if (x.customer_name === m.customer_name) x.is_primary = 0; });
        const id = ++mgrSeq;
        const row = { manager_id: id, customer_name: m.customer_name, name: m.name, phone: m.phone || '', email: m.email || '', is_primary: m.is_primary ? 1 : 0 };
        cache.managers.push(row);
        dbWrite(async () => {
          if (m.is_primary) await client.from('tb_customer_manager').update({ is_primary: 0 }).eq('customer_name', m.customer_name);
          return client.from('tb_customer_manager').insert(row);
        });
        return id;
      },

      updateManager(id, m) {
        const row = cache.managers.find(x => x.manager_id === id);
        if (!row) return;
        if (m.is_primary) cache.managers.forEach(x => { if (x.customer_name === row.customer_name) x.is_primary = 0; });
        const upd = { name: m.name, phone: m.phone || '', email: m.email || '', is_primary: m.is_primary ? 1 : 0 };
        Object.assign(row, upd);
        dbWrite(async () => {
          if (m.is_primary) await client.from('tb_customer_manager').update({ is_primary: 0 }).eq('customer_name', row.customer_name);
          return client.from('tb_customer_manager').update(upd).eq('manager_id', id);
        });
      },

      deleteManager(id) {
        cache.managers = cache.managers.filter(x => x.manager_id !== id);
        dbWrite(() => client.from('tb_customer_manager').delete().eq('manager_id', id));
      },

      authenticate(userId, password) {
        const u = cache.users.find(x => x.user_id === userId && x.password === password);
        return u ? { user_id: u.user_id, name: u.name, role: u.role, dept: u.dept, phone: u.phone, email: u.email || '' } : null;
      },

      getUser(userId) {
        const u = cache.users.find(x => x.user_id === userId);
        return u ? { user_id: u.user_id, name: u.name, role: u.role, dept: u.dept, phone: u.phone, email: u.email || '' } : null;
      },

      verifyUserPhone(userId, phone) {
        const u = cache.users.find(x => x.user_id === userId);
        if (!u) return false;
        const norm = s => String(s || '').replace(/\D/g, '');
        return norm(u.phone) === norm(phone);
      },

      verifyUserEmail(userId, email) {
        const u = cache.users.find(x => x.user_id === userId);
        if (!u) return false;
        return (u.email || '').toLowerCase().trim() === (email || '').toLowerCase().trim();
      },

      changePassword(userId, newPw) {
        const u = cache.users.find(x => x.user_id === userId);
        if (!u) return false;
        u.password = newPw;
        dbWrite(() => client.from('users').update({ password: newPw }).eq('user_id', userId));
        return true;
      },

      query() { return []; },

      addHistory(order_id, changedBy, changedAt, fields, action) {
        const id = ++histSeq;
        const row = { history_id: id, order_id, changed_at: changedAt, changed_by: changedBy, action: action || 'update', changed_fields: JSON.stringify(fields) };
        cache.history.push(row);
        dbWrite(() => client.from('tb_order_history').insert(row));
      },

      getHistory(order_id) {
        return [...cache.history.filter(h => h.order_id === order_id)]
          .sort((a, b) => (b.changed_at || '').localeCompare(a.changed_at || ''))
          .map(r => ({ ...r, changed_fields: JSON.parse(r.changed_fields || '[]') }));
      },
    };
  }

  // ============================================================
  // PMDB 퍼사드
  // ============================================================
  const PMDB = {
    engine: null,
    backend: null,

    async init() {
      if (this.backend) return this;

      // Supabase 클라이언트 로드 대기 (최대 10초)
      let attempts = 0;
      while (!window.supabase && attempts < 100) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      if (!window.supabase) throw new Error('Supabase 라이브러리 로드 실패 — 네트워크를 확인하세요');

      const url = window.SUPABASE_URL;
      const key = window.SUPABASE_ANON_KEY;
      if (!url || url.includes('YOUR_PROJECT_ID')) {
        throw new Error('supabase-config.js에 프로젝트 URL과 키를 입력하세요');
      }

      window.updateBootStatus('Supabase 연결 중…');
      const client = window.supabase.createClient(url, key);
      const backend = makeSupabaseBackend(client);

      window.updateBootStatus('데이터 로드 중…');
      await backend.loadAll();

      // 테이블이 비어 있으면 초기 데이터 삽입
      if (backend.cache.users.length === 0) {
        const { error } = await client.from('users').insert(SEED_USERS.map(u => ({ ...u })));
        if (!error) backend.cache.users = SEED_USERS.map(u => ({ ...u }));
      }

      const SEED_MANAGERS = window.SEED_MANAGERS || [];
      if (backend.cache.managers.length === 0 && SEED_MANAGERS.length > 0) {
        const rows = SEED_MANAGERS.map((m, i) => ({ manager_id: i + 1, customer_name: m.customer_name, name: m.name, phone: m.phone || '', email: m.email || '', is_primary: m.is_primary ? 1 : 0 }));
        const { error } = await client.from('tb_customer_manager').insert(rows);
        if (!error) backend.cache.managers = rows;
      }

      const SEED_ORDERS = window.SEED_ORDERS || [];
      if (backend.cache.orders.length === 0 && SEED_ORDERS.length > 0) {
        const orderRows = SEED_ORDERS.map(o => ({ order_id: o.order_id, customer_name: o.customer_name, customer_manager: o.customer_manager || primaryManagerFor(o.customer_name), model_name: o.model_name, delivery_date: o.delivery_date, station_id: o.station_id, router_no: o.router_no, usim_no: o.usim_no, install_address: o.install_address, status: o.status, created: o.created }));
        const { error: oe } = await client.from('tb_sales_order').insert(orderRows);
        if (!oe) backend.cache.orders = orderRows;

        const prodRows = SEED_ORDERS.filter(o => o.production).map(o => ({ order_id: o.order_id, ...o.production }));
        if (prodRows.length) {
          const { error: pe } = await client.from('tb_production_info').insert(prodRows);
          if (!pe) backend.cache.production = prodRows;
        }
      }

      this.backend = backend;
      this.engine = 'supabase';
      console.log('[PMDB] Supabase 준비 완료');
      window.updateBootStatus('준비 완료 중…');
      return this;
    },

    loadOrders()             { return this.backend.loadOrders(); },
    addOrder(f)              { return this.backend.addOrder(f); },
    updateOrder(id, f)       { return this.backend.updateOrder(id, f); },
    saveProduction(id, p)    { return this.backend.saveProduction(id, p); },
    completeOrder(id, p)     { return this.backend.completeOrder(id, p); },
    revertOrder(id)          { return this.backend.revertOrder(id); },
    startProduction(id)      { return this.backend.startProduction(id); },
    serialExists(s)          { return this.backend.serialExists(s); },
    getManagers(c)           { return this.backend.getManagers(c); },
    addManager(m)            { return this.backend.addManager(m); },
    updateManager(id, m)     { return this.backend.updateManager(id, m); },
    deleteManager(id)        { return this.backend.deleteManager(id); },
    authenticate(id, pw)     { return this.backend.authenticate(id, pw); },
    getUser(id)              { return this.backend.getUser(id); },
    verifyUserPhone(id, ph)  { return this.backend.verifyUserPhone(id, ph); },
    verifyUserEmail(id, em)  { return this.backend.verifyUserEmail(id, em); },
    changePassword(id, pw)   { return this.backend.changePassword(id, pw); },
    query()                  { return []; },
    addHistory(id, by, at, f, a) { return this.backend.addHistory(id, by, at, f, a); },
    getHistory(id)           { return this.backend.getHistory(id); },
    reset()                  { console.warn('[PMDB] Supabase 모드에서는 reset()을 지원하지 않습니다'); },
  };

  window.PMDB = PMDB;
  console.log('[DB] PMDB (Supabase) 모듈 로드됨');
})();
