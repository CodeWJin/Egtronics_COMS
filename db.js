// ============================================================
// EgtronicsCharger Management Web — Data layer (Supabase)
// 로컬 캐시로 동기 읽기, Supabase에 비동기 쓰기.
// 앱 시작 시 Supabase에서 전체 데이터를 로드합니다.
// ============================================================

(function () {
  const TODAY = new Date().toISOString().slice(0, 10);

  // ============================================================
  // DB 로거 — 브라우저 콘솔 + window.PMDB_LOGS 배열에 저장
  // 조회: window.pmdbLogs() 또는 window.pmdbLogs('ERROR')
  // ============================================================
  const PMDB_LOGS = [];
  const LOG_STYLES = {
    INFO:    'color:#2563eb;font-weight:600',
    SUCCESS: 'color:#16a34a;font-weight:600',
    WARN:    'color:#d97706;font-weight:600',
    ERROR:   'color:#dc2626;font-weight:600',
  };

  function dbLog(level, category, message, detail) {
    const ts = new Date().toISOString();
    const entry = { ts, level, category, message, detail: detail ?? null };
    PMDB_LOGS.push(entry);
    const style = LOG_STYLES[level] || LOG_STYLES.INFO;
    const prefix = `%c[DB][${level}]%c ${ts} | ${category} |`;
    if (level === 'ERROR') {
      console.error(prefix + ' ' + message, style, 'color:inherit', detail ?? '');
    } else if (level === 'WARN') {
      console.warn(prefix + ' ' + message, style, 'color:inherit', detail ?? '');
    } else {
      console.log(prefix + ' ' + message, style, 'color:inherit', ...(detail !== undefined ? [detail] : []));
    }
  }

  window.PMDB_LOGS = PMDB_LOGS;
  window.pmdbLogs = function (levelFilter) {
    const list = levelFilter
      ? PMDB_LOGS.filter(e => e.level === levelFilter.toUpperCase())
      : PMDB_LOGS;
    console.table(list.map(e => ({
      시각: e.ts.replace('T', ' ').slice(0, 23),
      레벨: e.level,
      분류: e.category,
      메시지: e.message,
    })));
    return list;
  };

  const SEED_USERS = [
    { user_id: 'admin', password: '1234', name: '박우진', role: 'admin',      dept: '충전기개발실', phone: '010-2567-8418', email: 'wjpark@egtronics.com' },
    { user_id: 'sales', password: '1234', name: '신정륜', role: 'sales',      dept: '영업부',       phone: '010-3000-4000', email: 'sales@egtrinocs.com' },
    { user_id: 'prod',  password: '1234', name: '김태윤', role: 'production', dept: '생산부',       phone: '010-5000-6000', email: 'prod@egtrinocs.com' },
    { user_id: 'as',    password: '1234', name: '민경선', role: 'as',         dept: '품질관리본부',       phone: '010-5000-6000', email: 'as@egtrinocs.com' },
  ];
  window.SEED_USERS = SEED_USERS;

  const SEED_MASTER_CUSTOMERS = [
    { name: '카스',     code: 'CAS',     last: '' },
    { name: '마이크로', code: 'MICRO',   last: '' },
    { name: 'LG',       code: 'LG',      last: '' },
    { name: '삼성',     code: 'SAMSUNG', last: '' },
  ];

  const SEED_MASTER_CPOS = [
    { name: '한국전력공사',   code: 'KEPCO' },
    { name: '환경부',         code: 'ME' },
    { name: '이지트로닉스',   code: 'EGT' },
    { name: '차지비',         code: 'CHEVI' },
  ];

  const SEED_MASTER_CABLE_LENGTHS = ['3m', '5m', '7m', '10m'];

  const TODAY_ISO = new Date().toISOString().slice(0, 10);
  const SEED_MASTER_SW_VERSIONS = [
    { tag: 'v1.0.0', released: TODAY_ISO, stable: true },
  ];
  window.MASTER = { CABLE_LENGTHS: [] };
  // ============================================================
  // Supabase 백엔드 (로컬 캐시 + 비동기 쓰기)
  // ============================================================
  function makeSupabaseBackend(client) {
    const cache = { orders: [], production: [], managers: [], users: [], history: [], as_history: [], customers: [], cpos: [], sw_versions: [], models: [] };
    let mgrSeq = 0;
    let histSeq = 0;
    let asHistSeq = 0;

    // 비동기 쓰기 — 로컬 캐시 업데이트 후 백그라운드에서 Supabase에 동기화
    function dbWrite(table, op, fn) {
      fn().then(({ error }) => {
        if (error) {
          dbLog('ERROR', `write:${table}`, `${op} 실패 — ${error.message}`, { table, op, error });
        } else {
          dbLog('SUCCESS', `write:${table}`, `${op} 완료`);
        }
      }).catch(err => dbLog('ERROR', `write:${table}`, `네트워크 오류 — ${err.message}`, err));
    }

    return {
      engine: 'supabase',
      cache,

      async loadAll() {
        dbLog('INFO', 'loadAll', '전체 테이블 조회 시작');
        const t0 = Date.now();
        const deadline = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('연결 시간 초과 (15초)\n→ Supabase URL과 API 키를 supabase-config.js에서 확인하세요')), 15000)
        );
        const [o, p, m, u, h] = await Promise.race([
          Promise.all([
            client.from('tb_sales_order').select('*'),
            client.from('tb_production_info').select('*'),
            client.from('tb_customer_manager').select('*'),
            client.from('users').select('*'),
            client.from('tb_order_history').select('*'),
          ]),
          deadline,
        ]);
        const firstErr = o.error || p.error || m.error || u.error || h.error;
        if (firstErr) {
          const hint = firstErr.message?.toLowerCase().includes('apikey') || firstErr.message?.toLowerCase().includes('invalid')
            ? '\n→ API 키가 잘못되었습니다. supabase-config.js의 SUPABASE_ANON_KEY를 확인하세요'
            : firstErr.message?.toLowerCase().includes('relation') || firstErr.message?.toLowerCase().includes('does not exist')
            ? '\n→ 테이블이 없습니다. supabase-schema.sql을 Supabase SQL 에디터에서 실행하세요'
            : '';
          dbLog('ERROR', 'loadAll', 'Supabase 데이터 로드 실패 — ' + firstErr.message, firstErr);
          throw new Error('Supabase 데이터 로드 실패: ' + firstErr.message + hint);
        }
        cache.orders     = o.data || [];
        cache.production = p.data || [];
        cache.managers   = m.data || [];
        cache.users      = u.data || [];
        cache.history    = h.data || [];
        mgrSeq  = cache.managers.reduce((mx, x) => Math.max(mx, x.manager_id || 0), 0);
        histSeq = cache.history.reduce((mx, x) => Math.max(mx, x.history_id || 0), 0);

        // A/S 이력 별도 로드 (테이블 미존재 시에도 앱 정상 동작)
        try {
          const { data: asData, error: asErr } = await client.from('tb_as_history').select('*');
          if (!asErr) {
            cache.as_history = asData || [];
            asHistSeq = cache.as_history.reduce((mx, x) => Math.max(mx, x.id || 0), 0);
          } else {
            dbLog('WARN', 'loadAll', 'tb_as_history 조회 실패 — ' + asErr.message);
          }
        } catch (e) {
          dbLog('WARN', 'loadAll', 'tb_as_history 로드 오류 — ' + e.message);
        }

        // 마스터 데이터 로드 (테이블 미존재 시에도 앱 정상 동작)
        try {
          const mapResult = (r, fn) => r.error ? [] : (r.data || []).map(fn);
          const [mc, mm, msw, mcl, mcpo] = await Promise.all([
            client.from('tb_master_customer').select('*').order('id'),
            client.from('tb_master_model').select('*').order('id'),
            client.from('tb_master_sw_version').select('*').order('id'),
            client.from('tb_master_cable_length').select('*').order('id'),
            client.from('tb_master_cpo').select('*').order('id'),
          ]);
          cache.customers = mapResult(mc, c => ({ id: c.id, name: c.name, code: c.code, last: c.last || '' }));
          cache.cpos = mapResult(mcpo, c => ({ id: c.id, name: c.name, code: c.code }));
          cache.models = mapResult(mm, m => ({ name: m.name, spec: m.spec || '', power: m.power || '' }));
          cache.sw_versions = mapResult(msw, r => ({ tag: r.tag, released: r.released, stable: r.stable }));
          window.MASTER = {
            CABLE_LENGTHS: mapResult(mcl, c => c.value),
          };
          const errs = [mc, mm, msw, mcl, mcpo].map(r => r.error).filter(Boolean);
          if (errs.length) {
            dbLog('WARN', 'loadAll', `마스터 테이블 일부 조회 실패 (${errs.length}개) — seed.sql 실행 필요: ` + errs.map(e => e.message).join('; '));
          } else {
            dbLog('SUCCESS', 'loadAll', '마스터 데이터 로드 완료', { customers: mc.data.length, models: mm.data.length });
          }
          window.dispatchEvent(new CustomEvent('masterLoaded'));
        } catch (e) {
          dbLog('WARN', 'loadAll', '마스터 데이터 로드 오류 — ' + e.message);
          window.dispatchEvent(new CustomEvent('masterLoaded'));
        }

        const elapsed = Date.now() - t0;
        dbLog('SUCCESS', 'loadAll', `전체 조회 완료 (${elapsed}ms)`, {
          tb_sales_order:      cache.orders.length,
          tb_production_info:  cache.production.length,
          tb_customer_manager: cache.managers.length,
          users:               cache.users.length,
          tb_order_history:    cache.history.length,
          tb_as_history:       cache.as_history.length,
        });
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
        const row = { order_id: id, customer_name: form.customer_name, customer_manager: form.customer_manager || '', cpo_name: form.cpo_name || '', usage_type: form.usage_type || '공용', model_name: form.model_name, delivery_date: form.delivery_date, cable_length: form.cable_length || '', station_id: form.station_id, router_no: form.router_no, usim_no: form.usim_no, install_address: form.install_address, field_manager_name: form.field_manager_name || '', field_manager_phone: form.field_manager_phone || '', status: 'PENDING', created: TODAY };
        cache.orders.push(row);
        dbLog('INFO', 'write:tb_sales_order', `주문 추가 — order_id=${id}, 고객=${form.customer_name}`);
        dbWrite('tb_sales_order', 'insert', () => client.from('tb_sales_order').insert(row));
        return id;
      },

      updateOrder(order_id, form) {
        const o = cache.orders.find(x => x.order_id === order_id);
        if (!o || o.status !== 'PENDING') {
          dbLog('WARN', 'write:tb_sales_order', `주문 수정 불가 — order_id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        const upd = { customer_name: form.customer_name, customer_manager: form.customer_manager || '', cpo_name: form.cpo_name || '', usage_type: form.usage_type || '공용', model_name: form.model_name, delivery_date: form.delivery_date, cable_length: form.cable_length || '', station_id: form.station_id, router_no: form.router_no, usim_no: form.usim_no, install_address: form.install_address, field_manager_name: form.field_manager_name || '', field_manager_phone: form.field_manager_phone || '' };
        Object.assign(o, upd);
        dbLog('INFO', 'write:tb_sales_order', `주문 수정 — order_id=${order_id}`);
        dbWrite('tb_sales_order', 'update', () => client.from('tb_sales_order').update(upd).eq('order_id', order_id));
        return true;
      },

      saveProduction(order_id, p) {
        cache.production = cache.production.filter(x => x.order_id !== order_id);
        cache.production.push({ order_id, ...p });
        dbLog('INFO', 'write:tb_production_info', `생산 정보 저장 — order_id=${order_id}`);
        dbWrite('tb_production_info', 'upsert', () => client.from('tb_production_info').upsert({ order_id, ...p }, { onConflict: 'order_id' }));
      },

      completeOrder(order_id, p) {
        cache.production = cache.production.filter(x => x.order_id !== order_id);
        cache.production.push({ order_id, ...p });
        const o = cache.orders.find(x => x.order_id === order_id);
        if (o) o.status = 'COMPLETED';
        dbLog('INFO', 'write:tb_sales_order', `주문 완료 처리 — order_id=${order_id}`);
        dbWrite('tb_sales_order', 'complete', async () => {
          await client.from('tb_production_info').upsert({ order_id, ...p }, { onConflict: 'order_id' });
          return client.from('tb_sales_order').update({ status: 'COMPLETED' }).eq('order_id', order_id);
        });
      },

      revertOrder(order_id) {
        const o = cache.orders.find(x => x.order_id === order_id);
        if (o) o.status = 'PENDING';
        dbLog('INFO', 'write:tb_sales_order', `주문 되돌리기 — order_id=${order_id}`);
        dbWrite('tb_sales_order', 'revert', () => client.from('tb_sales_order').update({ status: 'PENDING' }).eq('order_id', order_id));
      },

      startProduction(order_id) {
        const o = cache.orders.find(x => x.order_id === order_id);
        if (!o || o.status !== 'PENDING') {
          dbLog('WARN', 'write:tb_sales_order', `생산 시작 불가 — order_id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        o.status = 'IN_PROGRESS';
        dbLog('INFO', 'write:tb_sales_order', `생산 시작 — order_id=${order_id}`);
        dbWrite('tb_sales_order', 'start', () => client.from('tb_sales_order').update({ status: 'IN_PROGRESS' }).eq('order_id', order_id));
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
        dbLog('INFO', 'write:tb_customer_manager', `담당자 추가 — manager_id=${id}, 고객=${m.customer_name}, 이름=${m.name}`);
        dbWrite('tb_customer_manager', 'insert', async () => {
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
        dbLog('INFO', 'write:tb_customer_manager', `담당자 수정 — manager_id=${id}`);
        dbWrite('tb_customer_manager', 'update', async () => {
          if (m.is_primary) await client.from('tb_customer_manager').update({ is_primary: 0 }).eq('customer_name', row.customer_name);
          return client.from('tb_customer_manager').update(upd).eq('manager_id', id);
        });
      },

      deleteManager(id) {
        cache.managers = cache.managers.filter(x => x.manager_id !== id);
        dbLog('INFO', 'write:tb_customer_manager', `담당자 삭제 — manager_id=${id}`);
        dbWrite('tb_customer_manager', 'delete', () => client.from('tb_customer_manager').delete().eq('manager_id', id));
      },

      authenticate(userId, password) {
        const u = cache.users.find(x => x.user_id === userId && x.password === password);
        if (u) {
          dbLog('SUCCESS', 'auth', `로그인 성공 — user_id=${userId}, role=${u.role}`);
        } else {
          dbLog('WARN', 'auth', `로그인 실패 — user_id=${userId}`);
        }
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
        dbLog('INFO', 'write:users', `비밀번호 변경 — user_id=${userId}`);
        dbWrite('users', 'update', () => client.from('users').update({ password: newPw }).eq('user_id', userId));
        return true;
      },

      getAllUsers() {
        return cache.users.map(u => ({
          user_id: u.user_id, name: u.name, role: u.role,
          dept: u.dept || '', phone: u.phone || '', email: u.email || '',
        }));
      },

      addUser(data) {
        if (cache.users.find(x => x.user_id === data.user_id)) return { ok: false, msg: '이미 존재하는 아이디입니다' };
        const row = { user_id: data.user_id, password: data.password || '1234', name: data.name, role: data.role, dept: data.dept || '', phone: data.phone || '', email: data.email || '' };
        cache.users.push(row);
        dbLog('INFO', 'write:users', `사용자 추가 — user_id=${data.user_id}, role=${data.role}`);
        dbWrite('users', 'insert', () => client.from('users').insert(row));
        return { ok: true };
      },

      updateUser(userId, data) {
        const u = cache.users.find(x => x.user_id === userId);
        if (!u) return { ok: false, msg: '사용자를 찾을 수 없습니다' };
        const upd = { name: data.name, role: data.role, dept: data.dept || '', phone: data.phone || '', email: data.email || '' };
        if (data.password) upd.password = data.password;
        Object.assign(u, upd);
        dbLog('INFO', 'write:users', `사용자 수정 — user_id=${userId}`);
        dbWrite('users', 'update', () => client.from('users').update(upd).eq('user_id', userId));
        return { ok: true };
      },

      deleteUser(userId) {
        const idx = cache.users.findIndex(x => x.user_id === userId);
        if (idx === -1) return { ok: false, msg: '사용자를 찾을 수 없습니다' };
        cache.users.splice(idx, 1);
        dbLog('INFO', 'write:users', `사용자 삭제 — user_id=${userId}`);
        dbWrite('users', 'delete', () => client.from('users').delete().eq('user_id', userId));
        return { ok: true };
      },

      query() { return []; },

      addHistory(order_id, changedBy, changedAt, fields, action) {
        const id = ++histSeq;
        const row = { history_id: id, order_id, changed_at: changedAt, changed_by: changedBy, action: action || 'update', changed_fields: JSON.stringify(fields) };
        cache.history.push(row);
        dbLog('INFO', 'write:tb_order_history', `이력 추가 — order_id=${order_id}, action=${action || 'update'}, by=${changedBy}`);
        dbWrite('tb_order_history', 'insert', () => client.from('tb_order_history').insert(row));
      },

      getHistory(order_id) {
        return [...cache.history.filter(h => h.order_id === order_id)]
          .sort((a, b) => (b.changed_at || '').localeCompare(a.changed_at || ''))
          .map(r => ({ ...r, changed_fields: JSON.parse(r.changed_fields || '[]') }));
      },

      getAsHistory(order_id) {
        return [...cache.as_history.filter(r => r.order_id === order_id)]
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      },

      addAsRecord(record) {
        const id = ++asHistSeq;
        const row = {
          id,
          order_id:       record.order_id,
          reception_date: record.reception_date || '',
          dispatch_date:  record.dispatch_date  || '',
          action:         record.action         || '',
          notes:          record.notes          || '',
          field_manager:  record.field_manager  || '',
          created_at:     record.created_at     || TODAY,
        };
        cache.as_history.push(row);
        dbLog('INFO', 'write:tb_as_history', `A/S 이력 추가 — order_id=${record.order_id}`);
        dbWrite('tb_as_history', 'insert', () => client.from('tb_as_history').insert(row));
        return id;
      },

      deleteAsRecord(id) {
        cache.as_history = cache.as_history.filter(r => r.id !== id);
        dbLog('INFO', 'write:tb_as_history', `A/S 이력 삭제 — id=${id}`);
        dbWrite('tb_as_history', 'delete', () => client.from('tb_as_history').delete().eq('id', id));
      },

      getCustomers() {
        return [...cache.customers];
      },

      addMasterCustomer(name, code) {
        if (cache.customers.find(c => c.name === name))
          return { ok: false, msg: '이미 등록된 고객사명입니다' };
        if (cache.customers.find(c => c.code === code))
          return { ok: false, msg: '이미 사용 중인 코드입니다' };
        const last = new Date().toISOString().slice(0, 10);
        cache.customers.push({ name, code, last });
        dbLog('INFO', 'write:tb_master_customer', `고객사 추가 — ${name}`);
        dbWrite('tb_master_customer', 'insert', () => client.from('tb_master_customer').insert({ name, code, last }));
        return { ok: true };
      },

      updateMasterCustomer(idx, name, code) {
        const c = cache.customers[idx];
        if (!c) return { ok: false, msg: '고객사를 찾을 수 없습니다' };
        const dupName = cache.customers.findIndex(x => x.name === name);
        if (dupName !== -1 && dupName !== idx) return { ok: false, msg: '이미 등록된 고객사명입니다' };
        const dupCode = cache.customers.findIndex(x => x.code === code);
        if (dupCode !== -1 && dupCode !== idx) return { ok: false, msg: '이미 사용 중인 코드입니다' };
        const oldName = c.name;
        cache.customers[idx] = { ...c, name, code };
        dbLog('INFO', 'write:tb_master_customer', `고객사 수정 — ${oldName} → ${name}`);
        dbWrite('tb_master_customer', 'update', () => client.from('tb_master_customer').update({ name, code }).eq('name', oldName));
        return { ok: true };
      },

      deleteMasterCustomer(idx) {
        const c = cache.customers[idx];
        if (!c) return;
        const name = c.name;
        cache.customers.splice(idx, 1);
        dbLog('INFO', 'write:tb_master_customer', `고객사 삭제 — ${name}`);
        dbWrite('tb_master_customer', 'delete', () => client.from('tb_master_customer').delete().eq('name', name));
      },

      getCpos() {
        return [...cache.cpos];
      },

      addMasterCpo(name, code) {
        if (cache.cpos.find(c => c.name === name))
          return { ok: false, msg: '이미 등록된 CPO 운영사명입니다' };
        if (cache.cpos.find(c => c.code === code))
          return { ok: false, msg: '이미 사용 중인 코드입니다' };
        const row = { name, code };
        cache.cpos.push(row);
        dbLog('INFO', 'write:tb_master_cpo', `CPO 운영사 추가 — ${name}`);
        dbWrite('tb_master_cpo', 'insert', () => client.from('tb_master_cpo').insert({ name, code }));
        return { ok: true };
      },

      updateMasterCpo(idx, name, code) {
        const c = cache.cpos[idx];
        if (!c) return { ok: false, msg: 'CPO 운영사를 찾을 수 없습니다' };
        const dupName = cache.cpos.findIndex(x => x.name === name);
        if (dupName !== -1 && dupName !== idx) return { ok: false, msg: '이미 등록된 CPO 운영사명입니다' };
        const dupCode = cache.cpos.findIndex(x => x.code === code);
        if (dupCode !== -1 && dupCode !== idx) return { ok: false, msg: '이미 사용 중인 코드입니다' };
        const oldName = c.name;
        cache.cpos[idx] = { ...c, name, code };
        dbLog('INFO', 'write:tb_master_cpo', `CPO 운영사 수정 — ${oldName} → ${name}`);
        dbWrite('tb_master_cpo', 'update', () => client.from('tb_master_cpo').update({ name, code }).eq('name', oldName));
        return { ok: true };
      },

      deleteMasterCpo(idx) {
        const c = cache.cpos[idx];
        if (!c) return;
        const name = c.name;
        cache.cpos.splice(idx, 1);
        dbLog('INFO', 'write:tb_master_cpo', `CPO 운영사 삭제 — ${name}`);
        dbWrite('tb_master_cpo', 'delete', () => client.from('tb_master_cpo').delete().eq('name', name));
      },

      getSwVersions() {
        return [...cache.sw_versions];
      },

      addMasterSwVersion(ver) {
        cache.sw_versions.unshift({ tag: ver.tag, released: ver.released, stable: ver.stable });
        dbLog('INFO', 'write:tb_master_sw_version', `SW 버전 추가 — ${ver.tag}`);
        dbWrite('tb_master_sw_version', 'insert', () => client.from('tb_master_sw_version').insert({ tag: ver.tag, released: ver.released, stable: ver.stable }));
      },

      getModels() {
        return [...cache.models];
      },

      addMasterModel(name, spec, power) {
        if (cache.models.find(m => m.name === name))
          return { ok: false, msg: '이미 등록된 모델명입니다' };
        const row = { name, spec: spec || '', power: power || '' };
        cache.models.push(row);
        dbLog('INFO', 'write:tb_master_model', `모델 추가 — ${name}`);
        dbWrite('tb_master_model', 'insert', () => client.from('tb_master_model').insert(row));
        return { ok: true };
      },

      updateMasterModel(idx, name, spec, power) {
        const m = cache.models[idx];
        if (!m) return { ok: false, msg: '모델을 찾을 수 없습니다' };
        if (name !== m.name && cache.models.find(x => x.name === name))
          return { ok: false, msg: '이미 등록된 모델명입니다' };
        const oldName = m.name;
        Object.assign(m, { name, spec: spec || '', power: power || '' });
        dbLog('INFO', 'write:tb_master_model', `모델 수정 — ${name}`);
        dbWrite('tb_master_model', 'update', () => client.from('tb_master_model').update({ name, spec: spec || '', power: power || '' }).eq('name', oldName));
        return { ok: true };
      },

      deleteMasterModel(idx) {
        const m = cache.models[idx];
        if (!m) return;
        const name = m.name;
        cache.models.splice(idx, 1);
        dbLog('INFO', 'write:tb_master_model', `모델 삭제 — ${name}`);
        dbWrite('tb_master_model', 'delete', () => client.from('tb_master_model').delete().eq('name', name));
      },

      addMasterCableLength(value) {
        const v = (value || '').trim();
        if (!v) return { ok: false, msg: '값을 입력하세요' };
        if ((window.MASTER.CABLE_LENGTHS || []).includes(v))
          return { ok: false, msg: '이미 등록된 케이블 길이입니다' };
        window.MASTER.CABLE_LENGTHS.push(v);
        window.MASTER.CABLE_LENGTHS.sort((a, b) => parseInt(a) - parseInt(b));
        dbLog('INFO', 'write:tb_master_cable_length', `케이블 길이 추가 — ${v}`);
        dbWrite('tb_master_cable_length', 'insert', () => client.from('tb_master_cable_length').insert({ value: v }));
        window.dispatchEvent(new CustomEvent('masterLoaded'));
        return { ok: true };
      },

      deleteMasterCableLength(value) {
        const idx = (window.MASTER.CABLE_LENGTHS || []).indexOf(value);
        if (idx === -1) return;
        window.MASTER.CABLE_LENGTHS.splice(idx, 1);
        dbLog('INFO', 'write:tb_master_cable_length', `케이블 길이 삭제 — ${value}`);
        dbWrite('tb_master_cable_length', 'delete', () => client.from('tb_master_cable_length').delete().eq('value', value));
        window.dispatchEvent(new CustomEvent('masterLoaded'));
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

      dbLog('INFO', 'init', 'PMDB 초기화 시작');
      const t0 = Date.now();

      // Supabase 클라이언트 로드 대기 (최대 10초)
      let attempts = 0;
      while (!window.supabase && attempts < 100) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      if (!window.supabase) {
        dbLog('ERROR', 'init', 'Supabase 라이브러리 로드 실패');
        throw new Error('Supabase 라이브러리 로드 실패 — 네트워크를 확인하세요');
      }

      const url = window.SUPABASE_URL;
      const key = window.SUPABASE_ANON_KEY;
      if (!url || url.includes('YOUR_PROJECT_ID')) {
        dbLog('ERROR', 'init', 'SUPABASE_URL 미설정');
        throw new Error('supabase-config.js에 프로젝트 URL을 입력하세요');
      }
      if (!key || key.includes('YOUR_ANON_KEY') || key === '') {
        dbLog('ERROR', 'init', 'SUPABASE_ANON_KEY 미설정');
        throw new Error('supabase-config.js에 API 키를 입력하세요');
      }
      // 키 형식 검사: JWT(eyJ...) 또는 새 publishable 키(sb_publishable_...) 여야 함
      const keyOk = key.startsWith('eyJ') || /^sb_publishable_[A-Za-z0-9_-]{10,}/.test(key);
      if (!keyOk) {
        dbLog('ERROR', 'init', 'SUPABASE_ANON_KEY 형식 오류 — ' + key.slice(0, 30) + '…');
        throw new Error(
          'SUPABASE_ANON_KEY 형식이 올바르지 않습니다.\n' +
          '현재 값: ' + key.slice(0, 30) + '…\n' +
          '→ Supabase 대시보드 → Settings → API → anon public 키를 복사하세요'
        );
      }

      dbLog('INFO', 'init', `Supabase 연결 중 — ${url}`);
      window.updateBootStatus?.('Supabase 연결 중…');
      const client = window.supabase.createClient(url, key);
      const backend = makeSupabaseBackend(client);

      window.updateBootStatus?.('데이터 로드 중…');
      await backend.loadAll();

      // 테이블이 비어 있으면 초기 데이터 삽입
      if (backend.cache.users.length === 0) {
        dbLog('INFO', 'init', '초기 사용자 데이터 삽입');
        const { error } = await client.from('users').insert(SEED_USERS.map(u => ({ ...u })));
        if (error) dbLog('ERROR', 'init', '초기 사용자 삽입 실패 — ' + error.message, error);
        else backend.cache.users = SEED_USERS.map(u => ({ ...u }));
      }

      // 마스터 테이블이 비어 있으면 초기 데이터 삽입
      if (backend.cache.customers.length === 0) {
        try {
          const { data, error } = await client.from('tb_master_customer').insert(SEED_MASTER_CUSTOMERS).select();
          if (error) dbLog('WARN', 'init', '초기 고객사 삽입 실패 — ' + error.message);
          else {
            backend.cache.customers = (data || []).map(c => ({ id: c.id, name: c.name, code: c.code, last: c.last || '' }));
            dbLog('INFO', 'init', `초기 고객사 데이터 삽입 — ${backend.cache.customers.length}개`);
          }
        } catch (e) { dbLog('WARN', 'init', '초기 고객사 삽입 오류 — ' + e.message); }
      }
      if (backend.cache.cpos.length === 0) {
        try {
          const { data, error } = await client.from('tb_master_cpo').insert(SEED_MASTER_CPOS).select();
          if (error) dbLog('WARN', 'init', '초기 CPO 운영사 삽입 실패 — ' + error.message);
          else {
            backend.cache.cpos = (data || []).map(c => ({ id: c.id, name: c.name, code: c.code }));
            dbLog('INFO', 'init', `초기 CPO 운영사 데이터 삽입 — ${backend.cache.cpos.length}개`);
          }
        } catch (e) { dbLog('WARN', 'init', '초기 CPO 운영사 삽입 오류 — ' + e.message); }
        if (backend.cache.cpos.length === 0)
          backend.cache.cpos = SEED_MASTER_CPOS.map(c => ({ ...c }));
      }
      if (backend.cache.sw_versions.length === 0) {
        try {
          const { error } = await client.from('tb_master_sw_version').insert(SEED_MASTER_SW_VERSIONS);
          if (error) dbLog('WARN', 'init', '초기 SW버전 삽입 실패 — ' + error.message);
          else dbLog('INFO', 'init', '초기 SW버전 데이터 삽입 완료');
        } catch (e) { dbLog('WARN', 'init', '초기 SW버전 삽입 오류 — ' + e.message); }
        backend.cache.sw_versions = SEED_MASTER_SW_VERSIONS.map(v => ({ tag: v.tag, released: v.released, stable: v.stable }));
        window.dispatchEvent(new CustomEvent('masterLoaded'));
      }
      if (window.MASTER.CABLE_LENGTHS.length === 0) {
        try {
          const { error } = await client.from('tb_master_cable_length').insert(SEED_MASTER_CABLE_LENGTHS.map(v => ({ value: v })));
          if (error) dbLog('WARN', 'init', '초기 케이블길이 삽입 실패 — ' + error.message);
          else dbLog('INFO', 'init', `초기 케이블길이 데이터 삽입 완료`);
        } catch (e) { dbLog('WARN', 'init', '초기 케이블길이 삽입 오류 — ' + e.message); }
        // DB 삽입 성공 여부와 무관하게 메모리에 시드 데이터 보장
        window.MASTER.CABLE_LENGTHS = [...SEED_MASTER_CABLE_LENGTHS];
        window.dispatchEvent(new CustomEvent('masterLoaded'));
      }

      this.backend = backend;
      this.engine = 'supabase';
      dbLog('SUCCESS', 'init', `PMDB 준비 완료 (총 ${Date.now() - t0}ms)`);
      window.updateBootStatus?.('준비 완료 중…');
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
    getAllUsers()             { return this.backend.getAllUsers(); },
    addUser(data)            { return this.backend.addUser(data); },
    updateUser(id, data)     { return this.backend.updateUser(id, data); },
    deleteUser(id)           { return this.backend.deleteUser(id); },
    query()                  { return []; },
    addHistory(id, by, at, f, a) { return this.backend.addHistory(id, by, at, f, a); },
    getHistory(id)           { return this.backend.getHistory(id); },
    getAsHistory(orderId)        { return this.backend.getAsHistory(orderId); },
    addAsRecord(record)          { return this.backend.addAsRecord(record); },
    deleteAsRecord(id)           { return this.backend.deleteAsRecord(id); },
    getCustomers()                   { return this.backend.getCustomers(); },
    addMasterCustomer(n, c)         { return this.backend.addMasterCustomer(n, c); },
    updateMasterCustomer(i, n, c)   { return this.backend.updateMasterCustomer(i, n, c); },
    deleteMasterCustomer(i)         { return this.backend.deleteMasterCustomer(i); },
    getCpos()                        { return this.backend.getCpos(); },
    addMasterCpo(n, c)               { return this.backend.addMasterCpo(n, c); },
    updateMasterCpo(i, n, c)         { return this.backend.updateMasterCpo(i, n, c); },
    deleteMasterCpo(i)               { return this.backend.deleteMasterCpo(i); },
    getModels()                     { return this.backend.getModels(); },
    addMasterModel(n, s, p)         { return this.backend.addMasterModel(n, s, p); },
    updateMasterModel(i, n, s, p)   { return this.backend.updateMasterModel(i, n, s, p); },
    deleteMasterModel(i)            { return this.backend.deleteMasterModel(i); },
    addMasterCableLength(v)         { return this.backend.addMasterCableLength(v); },
    deleteMasterCableLength(v)      { return this.backend.deleteMasterCableLength(v); },
    getSwVersions()                 { return this.backend.getSwVersions(); },
    addMasterSwVersion(v)           { return this.backend.addMasterSwVersion(v); },
    reset()                      { dbLog('WARN', 'reset', 'Supabase 모드에서는 reset()을 지원하지 않습니다'); },
  };

  window.PMDB = PMDB;
  dbLog('INFO', 'module', 'PMDB (Supabase) 모듈 로드됨');
})();
