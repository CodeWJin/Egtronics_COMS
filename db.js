// ============================================================
// EgtronicsCharger Management Web — Data layer (real SQLite via sql.js / WASM)
// Persists to localStorage. Falls back to an in-memory JS engine
// (same API) if WASM cannot load, so the prototype never breaks.
// ============================================================

(function () {
  const TODAY = new Date().toISOString().slice(0, 10);
  const DB_KEY = 'pm_sqlite_db';     // base64 of the SQLite file image (localStorage 폴백)
  const MEM_KEY = 'pm_mem_db';       // JSON fallback store
  // Seed users (역할: admin / sales / production)
  // 이메일 인증을 사용하려면 email 값을 실제 이메일 주소로 교체하세요
  const SEED_USERS = [
    { user_id: 'admin', password: '1234', name: '박우진', role: 'admin',      dept: '충전기개발실', phone: '010-2567-8418', email: 'wjpark@egtronics.com' },
    { user_id: 'sales', password: '1234', name: '신정륜', role: 'sales',      dept: '영업부',   phone: '010-3000-4000', email: 'sales@egtrinocs.com' },
    { user_id: 'prod',  password: '1234', name: '김태윤', role: 'production', dept: '생산부',   phone: '010-5000-6000', email: 'prod@egtrinocs.com' },
  ];
  window.SEED_USERS = SEED_USERS;
  const SEED_MANAGERS = window.SEED_MANAGERS || [];
  // primary 담당자 lookup for order seeding
  const primaryManagerFor = (customer) => {
    const ms = SEED_MANAGERS.filter(m => m.customer_name === customer);
    const pm = ms.find(m => m.is_primary) || ms[0];
    return pm ? pm.name : '';
  };

  // ---- base64 <-> bytes ----
  function bytesToB64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ---- File System Access API (서버 없이 .db 파일 직접 저장) ----
  const FSA_IDB = 'pm_fsa_v1';
  const FSA_STORE = 'handles';
  const FSA_KEY = 'db';
  let _fsaHandle = null;

  function _fsaOpenIdb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(FSA_IDB, 1);
      r.onupgradeneeded = e => e.target.result.createObjectStore(FSA_STORE);
      r.onsuccess = e => res(e.target.result);
      r.onerror = e => rej(e.target.error);
    });
  }
  async function _fsaGetHandle() {
    try {
      const idb = await _fsaOpenIdb();
      return new Promise(res => {
        const tx = idb.transaction(FSA_STORE, 'readonly');
        const req = tx.objectStore(FSA_STORE).get(FSA_KEY);
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => res(null);
      });
    } catch { return null; }
  }
  async function _fsaStoreHandle(handle) {
    try {
      const idb = await _fsaOpenIdb();
      return new Promise(res => {
        const tx = idb.transaction(FSA_STORE, 'readwrite');
        tx.objectStore(FSA_STORE).put(handle, FSA_KEY);
        tx.oncomplete = () => res(true);
        tx.onerror = () => res(false);
      });
    } catch { return false; }
  }
  async function _fsaRemoveHandle() {
    try {
      const idb = await _fsaOpenIdb();
      return new Promise(res => {
        const tx = idb.transaction(FSA_STORE, 'readwrite');
        tx.objectStore(FSA_STORE).delete(FSA_KEY);
        tx.oncomplete = () => res(true);
        tx.onerror = () => res(false);
      });
    } catch { return false; }
  }
  async function _fsaRead(handle) {
    const f = await handle.getFile();
    return new Uint8Array(await f.arrayBuffer());
  }
  async function _fsaWrite(handle, bytes) {
    const w = await handle.createWritable();
    await w.write(bytes);
    await w.close();
  }
  async function _fsaTryLoadOnInit() {
    if (!window.showSaveFilePicker) return null;
    const stored = await _fsaGetHandle();
    if (!stored) return null;
    try {
      const perm = await stored.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') return null;
      _fsaHandle = stored;
      const bytes = await _fsaRead(stored);
      return bytes.length > 0 ? bytes : null;
    } catch { return null; }
  }

  const ORDER_COLS = ['order_id', 'customer_name', 'customer_manager', 'model_name', 'delivery_date', 'station_id', 'router_no', 'usim_no', 'install_address', 'status', 'created'];
  const PROD_COLS = ['order_id', 'prod_date', 'lot_no', 'serial_no', 'inspection_date', 'sw_version', 'cable_length', 'doc_no'];
  const MGR_COLS = ['customer_name', 'name', 'phone', 'email', 'is_primary'];

  // ============================================================
  // SQLite backend (sql.js)
  // ============================================================
  function makeSqlBackend(db, persist) {
    function all(sql, params = []) {
      const stmt = db.prepare(sql);
      if (params.length) stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    }
    function run(sql, params = []) { db.run(sql, params); }

    return {
      engine: 'sqlite',
      loadOrders() {
        const orders = all('SELECT * FROM tb_sales_order ORDER BY created DESC, order_id DESC');
        const pmap = {};
        all('SELECT * FROM tb_production_info').forEach(p => {
          const { order_id, ...rest } = p; pmap[order_id] = rest;
        });
        orders.forEach(o => { if (pmap[o.order_id]) o.production = pmap[o.order_id]; });
        return orders;
      },
      addOrder(form) {
        const id = all('SELECT IFNULL(MAX(order_id), 24000) + 1 AS id FROM tb_sales_order')[0].id;
        run(`INSERT INTO tb_sales_order (${ORDER_COLS.join(',')}) VALUES (${ORDER_COLS.map(() => '?').join(',')})`,
          [id, form.customer_name, form.customer_manager || '', form.model_name, form.delivery_date, form.station_id, form.router_no, form.usim_no, form.install_address, 'PENDING', TODAY]);
        persist();
        return id;
      },
      updateOrder(order_id, form) {
        // 생산대기(PENDING) 상태만 수정 허용
        const cur = all('SELECT status FROM tb_sales_order WHERE order_id = ?', [order_id])[0];
        if (!cur || cur.status !== 'PENDING') return false;
        run(`UPDATE tb_sales_order SET customer_name=?, customer_manager=?, model_name=?, delivery_date=?, station_id=?, router_no=?, usim_no=?, install_address=? WHERE order_id=?`,
          [form.customer_name, form.customer_manager || '', form.model_name, form.delivery_date, form.station_id, form.router_no, form.usim_no, form.install_address, order_id]);
        persist();
        return true;
      },
      completeOrder(order_id, p) {
        run(`INSERT OR REPLACE INTO tb_production_info (${PROD_COLS.join(',')}) VALUES (${PROD_COLS.map(() => '?').join(',')})`,
          [order_id, p.prod_date, p.lot_no, p.serial_no, p.inspection_date, p.sw_version, p.cable_length, p.doc_no]);
        run('UPDATE tb_sales_order SET status = ? WHERE order_id = ?', ['COMPLETED', order_id]);
        persist();
      },
      revertOrder(order_id) {
        // 생산완료/진행중 → 생산대기 (생산 실적은 보존하여 재입력 시 자동 복원)
        run('UPDATE tb_sales_order SET status = ? WHERE order_id = ?', ['PENDING', order_id]);
        persist();
      },
      startProduction(order_id) {
        const cur = all('SELECT status FROM tb_sales_order WHERE order_id = ?', [order_id])[0];
        if (!cur || cur.status !== 'PENDING') return false;
        run('UPDATE tb_sales_order SET status = ? WHERE order_id = ?', ['IN_PROGRESS', order_id]);
        persist();
        return true;
      },
      serialExists(serial) {
        return all('SELECT 1 FROM tb_production_info WHERE serial_no = ? LIMIT 1', [serial]).length > 0;
      },
      // ---- 고객사 담당자 (tb_customer_manager) ----
      getManagers(customer_name) {
        if (customer_name) return all('SELECT manager_id, customer_name, name, phone, email, is_primary FROM tb_customer_manager WHERE customer_name = ? ORDER BY is_primary DESC, name', [customer_name]);
        return all('SELECT manager_id, customer_name, name, phone, email, is_primary FROM tb_customer_manager ORDER BY customer_name, is_primary DESC, name');
      },
      addManager(m) {
        if (m.is_primary) run('UPDATE tb_customer_manager SET is_primary = 0 WHERE customer_name = ?', [m.customer_name]);
        run(`INSERT INTO tb_customer_manager (${MGR_COLS.join(',')}) VALUES (${MGR_COLS.map(() => '?').join(',')})`,
          [m.customer_name, m.name, m.phone || '', m.email || '', m.is_primary ? 1 : 0]);
        persist();
        return all('SELECT last_insert_rowid() AS id')[0].id;
      },
      updateManager(id, m) {
        if (m.is_primary) {
          const row = all('SELECT customer_name FROM tb_customer_manager WHERE manager_id = ?', [id])[0];
          if (row) run('UPDATE tb_customer_manager SET is_primary = 0 WHERE customer_name = ?', [row.customer_name]);
        }
        run('UPDATE tb_customer_manager SET name=?, phone=?, email=?, is_primary=? WHERE manager_id=?',
          [m.name, m.phone || '', m.email || '', m.is_primary ? 1 : 0, id]);
        persist();
      },
      deleteManager(id) {
        run('DELETE FROM tb_customer_manager WHERE manager_id = ?', [id]);
        persist();
      },
      authenticate(userId, password) {
        return all('SELECT user_id, name, role, dept, phone, email FROM users WHERE user_id = ? AND password = ?', [userId, password])[0] || null;
      },
      getUser(userId) {
        return all('SELECT user_id, name, role, dept, phone, email FROM users WHERE user_id = ?', [userId])[0] || null;
      },
      // ---- 계정/인증 ----
      verifyUserPhone(userId, phone) {
        const u = all('SELECT phone FROM users WHERE user_id = ?', [userId])[0];
        if (!u) return false;
        const norm = (s) => String(s || '').replace(/\D/g, '');
        return norm(u.phone) === norm(phone);
      },
      verifyUserEmail(userId, email) {
        const u = all('SELECT email FROM users WHERE user_id = ?', [userId])[0];
        if (!u) return false;
        return (u.email || '').toLowerCase().trim() === (email || '').toLowerCase().trim();
      },
      changePassword(userId, newPw) {
        run('UPDATE users SET password = ? WHERE user_id = ?', [newPw, userId]);
        persist();
        return true;
      },
      query(sql, params) { return all(sql, params); },
      addHistory(order_id, changedBy, changedAt, fields, action) {
        run('INSERT INTO tb_order_history (order_id, changed_at, changed_by, action, changed_fields) VALUES (?,?,?,?,?)',
          [order_id, changedAt, changedBy, action || 'update', JSON.stringify(fields)]);
        persist();
      },
      getHistory(order_id) {
        return all('SELECT * FROM tb_order_history WHERE order_id = ? ORDER BY changed_at DESC', [order_id])
          .map(r => ({ ...r, changed_fields: JSON.parse(r.changed_fields || '[]') }));
      },
    };
  }

  // ============================================================
  // In-memory JS fallback backend (same API), JSON-persisted
  // ============================================================
  function makeMemBackend() {
    let state = JSON.parse(localStorage.getItem(MEM_KEY) || 'null');
    if (!state) {
      state = {
        users: SEED_USERS.map(u => ({ ...u })),
        managers: SEED_MANAGERS.map((m, i) => ({ manager_id: i + 1, ...m })),
        orders: (window.SEED_ORDERS || []).map(o => {
          const { production, ...rest } = o;
          return { customer_manager: primaryManagerFor(o.customer_name), ...rest };
        }),
        production: (window.SEED_ORDERS || []).filter(o => o.production).map(o => ({ order_id: o.order_id, ...o.production })),
      };
    }
    // --- migrations for previously-persisted stores ---
    if (!state.managers) state.managers = SEED_MANAGERS.map((m, i) => ({ manager_id: i + 1, ...m }));
    state.users.forEach(u => { if (u.phone == null) { const seed = SEED_USERS.find(s => s.user_id === u.user_id); u.phone = seed ? seed.phone : ''; } });
    state.users.forEach(u => { if (u.email == null) { const seed = SEED_USERS.find(s => s.user_id === u.user_id); u.email = seed ? seed.email : ''; } });
    state.orders.forEach(o => { if (o.customer_manager == null) o.customer_manager = primaryManagerFor(o.customer_name); });
    if (!state.history) state.history = [];
    let mgrSeq = state.managers.reduce((m, x) => Math.max(m, x.manager_id || 0), 0);
    const save = () => localStorage.setItem(MEM_KEY, JSON.stringify(state));
    save();

    return {
      engine: 'memory',
      loadOrders() {
        const pmap = {};
        state.production.forEach(p => { const { order_id, ...rest } = p; pmap[order_id] = rest; });
        return [...state.orders]
          .sort((a, b) => (b.created || '').localeCompare(a.created || '') || b.order_id - a.order_id)
          .map(o => pmap[o.order_id] ? { ...o, production: pmap[o.order_id] } : { ...o });
      },
      addOrder(form) {
        const id = state.orders.reduce((m, o) => Math.max(m, o.order_id), 24000) + 1;
        state.orders.push({ order_id: id, customer_name: form.customer_name, customer_manager: form.customer_manager || '', model_name: form.model_name, delivery_date: form.delivery_date, station_id: form.station_id, router_no: form.router_no, usim_no: form.usim_no, install_address: form.install_address, status: 'PENDING', created: TODAY});
        save();
        return id;
      },
      updateOrder(order_id, form) {
        const o = state.orders.find(x => x.order_id === order_id);
        if (!o || o.status !== 'PENDING') return false;
        Object.assign(o, { customer_name: form.customer_name, customer_manager: form.customer_manager || '', model_name: form.model_name, delivery_date: form.delivery_date, station_id: form.station_id, router_no: form.router_no, usim_no: form.usim_no, install_address: form.install_address });
        save();
        return true;
      },
      completeOrder(order_id, p) {
        state.production = state.production.filter(x => x.order_id !== order_id);
        state.production.push({ order_id, ...p });
        const o = state.orders.find(x => x.order_id === order_id);
        if (o) o.status = 'COMPLETED';
        save();
      },
      revertOrder(order_id) {
        const o = state.orders.find(x => x.order_id === order_id);
        if (o) o.status = 'PENDING';
        save();
      },
      startProduction(order_id) {
        const o = state.orders.find(x => x.order_id === order_id);
        if (!o || o.status !== 'PENDING') return false;
        o.status = 'IN_PROGRESS';
        save();
        return true;
      },
      serialExists(serial) { return state.production.some(p => p.serial_no === serial); },
      getManagers(customer_name) {
        const list = customer_name ? state.managers.filter(m => m.customer_name === customer_name) : [...state.managers];
        return list.sort((a, b) => (b.is_primary || 0) - (a.is_primary || 0) || (a.name || '').localeCompare(b.name || ''));
      },
      addManager(m) {
        if (m.is_primary) state.managers.forEach(x => { if (x.customer_name === m.customer_name) x.is_primary = 0; });
        const id = ++mgrSeq;
        state.managers.push({ manager_id: id, customer_name: m.customer_name, name: m.name, phone: m.phone || '', email: m.email || '', is_primary: m.is_primary ? 1 : 0 });
        save();
        return id;
      },
      updateManager(id, m) {
        const row = state.managers.find(x => x.manager_id === id);
        if (!row) return;
        if (m.is_primary) state.managers.forEach(x => { if (x.customer_name === row.customer_name) x.is_primary = 0; });
        Object.assign(row, { name: m.name, phone: m.phone || '', email: m.email || '', is_primary: m.is_primary ? 1 : 0 });
        save();
      },
      deleteManager(id) {
        state.managers = state.managers.filter(x => x.manager_id !== id);
        save();
      },
      authenticate(userId, password) {
        const u = state.users.find(x => x.user_id === userId && x.password === password);
        return u ? { user_id: u.user_id, name: u.name, role: u.role, dept: u.dept, phone: u.phone, email: u.email || '' } : null;
      },
      getUser(userId) {
        const u = state.users.find(x => x.user_id === userId);
        return u ? { user_id: u.user_id, name: u.name, role: u.role, dept: u.dept, phone: u.phone, email: u.email || '' } : null;
      },
      verifyUserPhone(userId, phone) {
        const u = state.users.find(x => x.user_id === userId);
        if (!u) return false;
        const norm = (s) => String(s || '').replace(/\D/g, '');
        return norm(u.phone) === norm(phone);
      },
      verifyUserEmail(userId, email) {
        const u = state.users.find(x => x.user_id === userId);
        if (!u) return false;
        return (u.email || '').toLowerCase().trim() === (email || '').toLowerCase().trim();
      },
      changePassword(userId, newPw) {
        const u = state.users.find(x => x.user_id === userId);
        if (!u) return false;
        u.password = newPw;
        save();
        return true;
      },
      query() { return []; },
      addHistory(order_id, changedBy, changedAt, fields, action) {
        const id = state.history.reduce((m, h) => Math.max(m, h.history_id || 0), 0) + 1;
        state.history.push({ history_id: id, order_id, changed_at: changedAt, changed_by: changedBy, action: action || 'update', changed_fields: fields });
        save();
      },
      getHistory(order_id) {
        return [...state.history.filter(h => h.order_id === order_id)]
          .sort((a, b) => (b.changed_at || '').localeCompare(a.changed_at || ''));
      },
    };
  }

  // ============================================================
  // Public PMDB facade
  // ============================================================
  const PMDB = {
    engine: null,
    backend: null,
    async init() {
      if (this.backend) return this;
      try {
        // sql.js 로드 대기 (최대 10초)
        let attempts = 0;
        while (typeof initSqlJs !== 'function' && attempts < 100) {
          await new Promise(r => setTimeout(r, 100));
          attempts++;
        }
        
        if (typeof initSqlJs !== 'function') {
          console.error('[DB] sql.js 로드 실패 — CDN 연결 확인 필요');
          throw new Error('sql.js 로드 실패');
        }

        console.log('[DB] sql.js 로드 완료 - 초기화 시작');

        let SQL;
        try {
          const sqlInitPromise = initSqlJs({
            locateFile: (f) => {
              const url = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/' + f;
              console.log('[DB] sql.js 파일 로드:', url);
              return url;
            },
          });
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('sql.js WASM 로드 타임아웃 (15초) — 인메모리 모드로 전환')), 15000)
          );
          SQL = await Promise.race([sqlInitPromise, timeoutPromise]);
          console.log('[DB] SQL.js 초기화 완료');
        } catch (err) {
          console.error('[DB] sql.js 초기화 오류:', err);
          throw new Error('sql.js 초기화 실패: ' + (err.message || err));
        }

        let db;
        try {
          // 1순위: FSA 파일 핸들 (이전에 연결된 .db 파일)
          let initBytes = await _fsaTryLoadOnInit();
          // 2순위: localStorage
          if (!initBytes) {
            const b64 = localStorage.getItem(DB_KEY);
            if (b64) {
              console.log('[DB] localStorage에서 DB 로드');
              initBytes = b64ToBytes(b64);
            }
          }
          if (initBytes) {
            console.log('[DB] 기존 DB 로드:', initBytes.length, 'bytes');
            db = new SQL.Database(initBytes);
          } else {
            console.log('[DB] 새로운 DB 생성');
            db = new SQL.Database();
          }
        } catch (dbErr) {
          console.error('[DB] 데이터베이스 로드 오류:', dbErr);
          db = new SQL.Database(); // 새로운 빈 DB로 시작
        }

        const persist = () => {
          const bytes = db.export();
          if (_fsaHandle) {
            _fsaWrite(_fsaHandle, bytes).catch(() => {
              _fsaHandle = null;
              localStorage.setItem(DB_KEY, bytesToB64(bytes));
            });
          } else {
            localStorage.setItem(DB_KEY, bytesToB64(bytes));
          }
        };
        this._persist = persist;

        // Schema (idempotent)
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY, password TEXT NOT NULL,
            name TEXT NOT NULL, role TEXT NOT NULL, dept TEXT, phone TEXT, email TEXT
          );
          CREATE TABLE IF NOT EXISTS tb_sales_order (
            order_id INTEGER PRIMARY KEY, customer_name TEXT, customer_manager TEXT, model_name TEXT,
            delivery_date TEXT, station_id TEXT, router_no TEXT, usim_no TEXT,
            install_address TEXT, status TEXT, created TEXT
          );
          CREATE TABLE IF NOT EXISTS tb_production_info (
            order_id INTEGER PRIMARY KEY, prod_date TEXT, lot_no TEXT, serial_no TEXT,
            inspection_date TEXT, sw_version TEXT, cable_length TEXT, doc_no TEXT,
            FOREIGN KEY(order_id) REFERENCES tb_sales_order(order_id)
          );
          CREATE TABLE IF NOT EXISTS tb_customer_manager (
            manager_id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL, name TEXT NOT NULL,
            phone TEXT, email TEXT, is_primary INTEGER DEFAULT 0
          );
          CREATE TABLE IF NOT EXISTS tb_order_history (
            history_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            changed_at TEXT NOT NULL,
            changed_by TEXT NOT NULL,
            action TEXT DEFAULT 'update',
            changed_fields TEXT NOT NULL
          );
        `);

        // Migrations for previously-persisted DB images (ignore "duplicate column")
        const tryRun = (sql) => { try { db.run(sql); } catch (e) {} };
        tryRun('ALTER TABLE users ADD COLUMN phone TEXT');
        tryRun('ALTER TABLE users ADD COLUMN email TEXT');
        tryRun('ALTER TABLE tb_sales_order ADD COLUMN customer_manager TEXT');
        // Backfill phone / email on existing seed users
        SEED_USERS.forEach(u => db.run('UPDATE users SET phone = ? WHERE user_id = ? AND (phone IS NULL OR phone = "")', [u.phone, u.user_id]));
        SEED_USERS.forEach(u => db.run('UPDATE users SET email = ? WHERE user_id = ? AND (email IS NULL OR email = "")', [u.email || '', u.user_id]));

        // Seed users if empty
        const userCount = db.exec('SELECT COUNT(*) FROM users');
        if (!userCount.length || userCount[0].values[0][0] === 0) {
          SEED_USERS.forEach(u => db.run('INSERT INTO users VALUES (?,?,?,?,?,?,?)', [u.user_id, u.password, u.name, u.role, u.dept, u.phone, u.email || '']));
        }
        // Seed customer managers if empty
        const mgrCount = db.exec('SELECT COUNT(*) FROM tb_customer_manager');
        if (!mgrCount.length || mgrCount[0].values[0][0] === 0) {
          SEED_MANAGERS.forEach(m => db.run(`INSERT INTO tb_customer_manager (${MGR_COLS.join(',')}) VALUES (${MGR_COLS.map(() => '?').join(',')})`,
            [m.customer_name, m.name, m.phone || '', m.email || '', m.is_primary ? 1 : 0]));
        }
        // Backfill customer_manager on existing orders (대표 담당자)
        SEED_MANAGERS.filter(m => m.is_primary).forEach(m => {
          db.run('UPDATE tb_sales_order SET customer_manager = ? WHERE customer_name = ? AND (customer_manager IS NULL OR customer_manager = "")', [m.name, m.customer_name]);
        });
        // Seed orders if empty
        const ordCount = db.exec('SELECT COUNT(*) FROM tb_sales_order');
        if (!ordCount.length || ordCount[0].values[0][0] === 0) {
          (window.SEED_ORDERS || []).forEach(o => {
            db.run(`INSERT INTO tb_sales_order (${ORDER_COLS.join(',')}) VALUES (${ORDER_COLS.map(() => '?').join(',')})`,
              [o.order_id, o.customer_name, o.customer_manager || primaryManagerFor(o.customer_name), o.model_name, o.delivery_date, o.station_id, o.router_no, o.usim_no, o.install_address, o.status, o.created]);
            if (o.production) {
              const p = o.production;
              db.run(`INSERT INTO tb_production_info (${PROD_COLS.join(',')}) VALUES (${PROD_COLS.map(() => '?').join(',')})`,
                [o.order_id, p.prod_date, p.lot_no, p.serial_no, p.inspection_date, p.sw_version, p.cable_length, p.doc_no]);
            }
          });
        }
        persist();
        this.backend = makeSqlBackend(db, persist);
        this.engine = 'sqlite';
        console.log('[PMDB] SQLite (sql.js) ready');
        window.updateBootStatus('준비 완료 중…');
      } catch (e) {
        console.warn('[PMDB] sql.js unavailable, using in-memory fallback:', e && e.message);
        window.updateBootStatus('데이터베이스 로드 중…(인메모리 모드)');
        this.backend = makeMemBackend();
        this.engine = 'memory';
        setTimeout(() => window.updateBootStatus('준비 완료 중…'), 500);
      }
      return this;
    },
    loadOrders() { return this.backend.loadOrders(); },
    addOrder(f) { return this.backend.addOrder(f); },
    updateOrder(id, f) { return this.backend.updateOrder(id, f); },
    completeOrder(id, p) { return this.backend.completeOrder(id, p); },
    revertOrder(id) { return this.backend.revertOrder(id); },
    startProduction(id) { return this.backend.startProduction(id); },
    serialExists(s) { return this.backend.serialExists(s); },
    getManagers(c) { return this.backend.getManagers(c); },
    addManager(m) { return this.backend.addManager(m); },
    updateManager(id, m) { return this.backend.updateManager(id, m); },
    deleteManager(id) { return this.backend.deleteManager(id); },
    authenticate(id, pw) { return this.backend.authenticate(id, pw); },
    getUser(id) { return this.backend.getUser(id); },
    verifyUserPhone(id, phone) { return this.backend.verifyUserPhone(id, phone); },
    verifyUserEmail(id, email) { return this.backend.verifyUserEmail(id, email); },
    changePassword(id, pw) { return this.backend.changePassword(id, pw); },
    query(sql, params) { return this.backend.query(sql, params); },
    addHistory(id, by, at, fields, action) { return this.backend.addHistory(id, by, at, fields, action); },
    getHistory(id) { return this.backend.getHistory(id); },
    // ---- 파일 연결 (File System Access API) ----
    // 새 .db 파일을 만들거나 기존 파일을 덮어쓸 위치를 선택 (저장용)
    async linkFile() {
      if (!window.showSaveFilePicker) return { ok: false, reason: '지원하지 않는 브라우저' };
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'charger_mgmt.db',
          types: [{ description: 'SQLite Database', accept: { 'application/x-sqlite3': ['.db', '.sqlite'] } }],
        });
        _fsaHandle = handle;
        await _fsaStoreHandle(handle);
        if (this._persist) this._persist();
        return { ok: true };
      } catch (e) {
        if (e.name === 'AbortError') return { ok: false, reason: '취소됨' };
        return { ok: false, reason: e.message };
      }
    },
    // 기존 .db 파일을 불러와 연결 (열기용 — 재시작 없이 즉시 적용됨)
    async openFile() {
      if (!window.showOpenFilePicker) return { ok: false, reason: '지원하지 않는 브라우저' };
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'SQLite Database', accept: { 'application/x-sqlite3': ['.db', '.sqlite'] } }],
        });
        _fsaHandle = handle;
        await _fsaStoreHandle(handle);
        return { ok: true, reload: true };
      } catch (e) {
        if (e.name === 'AbortError') return { ok: false, reason: '취소됨' };
        return { ok: false, reason: e.message };
      }
    },
    async unlinkFile() {
      _fsaHandle = null;
      await _fsaRemoveHandle();
    },
    hasFileLink() { return _fsaHandle !== null; },
    // Dev helper: wipe persisted DB
    reset() { localStorage.removeItem(DB_KEY); localStorage.removeItem(MEM_KEY); localStorage.removeItem('pm_session'); },
  };

  console.log('[DB] PMDB module initialized');
  window.PMDB = PMDB;
  console.log('[DB] window.PMDB assigned');
})();
console.log('[DB] db.js execution complete');
