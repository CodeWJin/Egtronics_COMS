// ============================================================
// EgtronicsCharger Management Web — Data layer (Supabase)
// 로컬 캐시로 동기 읽기, Supabase에 비동기 쓰기.
// 앱 시작 시 Supabase에서 전체 데이터를 로드합니다.
// ============================================================

(function () {
  const TODAY = new Date().toISOString().slice(0, 10);

  // ── 비밀번호 해싱 (Web Crypto API — PBKDF2/SHA-256) ──────────────────────
  // 저장 형식: "pbkdf2:<16바이트 salt hex>:<32바이트 hash hex>"
  // 평문("pbkdf2:" 미시작)이면 마이그레이션 전 데이터로 간주해 평문 비교 후 자동 변환.
  async function hashPassword(password) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256
    );
    const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    return `pbkdf2:${toHex(salt)}:${toHex(bits)}`;
  }

  async function verifyPassword(password, stored) {
    if (!stored || !stored.startsWith('pbkdf2:')) return password === stored;
    const [, saltHex, hashHex] = stored.split(':');
    const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256
    );
    const newHex = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
    return newHex === hashHex;
  }

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
    { user_id: 'admin',   password: '1234', name: '박우진', role: 'admin',      dept: '충전기개발실', phone: '010-2567-8418', email: 'wjpark@egtronics.com' },
    { user_id: 'sales',   password: '1234', name: '신정륜', role: 'sales',      dept: '영업부',       phone: '010-3000-4000', email: 'sales@egtrinocs.com' },
    { user_id: 'prod',    password: '1234', name: '김태윤', role: 'production', dept: '생산부',       phone: '010-5000-6000', email: 'prod@egtrinocs.com' },
    { user_id: 'qual',    password: '1234', name: '민경선', role: 'quality',    dept: '품질관리본부',  phone: '010-5000-6000', email: 'qual@egtrinocs.com' },
  ];
  window.SEED_USERS = SEED_USERS;

  const SEED_MASTER_CUSTOMERS = [
    { name: '카스',     is_address: '', last: '' },
    { name: '마이크로', is_address: '', last: '' },
    { name: 'LG',       is_address: '', last: '' },
    { name: '삼성',     is_address: '', last: '' },
  ];

  const SEED_MASTER_CPOS = [
    { name: '한국전력공사',   code: 'KEPCO' },
    { name: '환경부',         code: 'ME' },
    { name: '이지트로닉스',   code: 'EGT' },
    { name: '차지비',         code: 'CHEVI' },
  ];

  const TODAY_ISO = new Date().toISOString().slice(0, 10);
  const SEED_PROGRAM_VERSIONS = [
    { type: 'S/W', tag: 'v1.0.0', released: TODAY_ISO, stable: true },
    { type: 'F/W', tag: 'v1.0.0', released: TODAY_ISO, stable: true },
  ];
  // ============================================================
  // Supabase 백엔드 (로컬 캐시 + 비동기 쓰기)
  // ============================================================
  function makeSupabaseBackend(client) {
    const cache = { orders: [], production: [], managers: [], users: [], history: [], customers: [], cpos: [], program_versions: [], models: [], as_receptions: [], as_logs: [], as_photos: [], func_inspections: [], ship_inspections: [], usage_type_public: [], chargepoints: [] };
    let mgrSeq = 0;
    let histSeq = 0;
    let asRecSeq = 0;
    let asLogSeq = 0;
    let asPhotoSeq = 0;

    // 비동기 쓰기 — 로컬 캐시 업데이트 후 백그라운드에서 Supabase에 동기화
    function dbWrite(table, op, fn) {
      fn().then(({ error }) => {
        if (error) {
          dbLog('ERROR', `write:${table}`, `${op} 실패 — ${error.message}`, { table, op, error });
          window.actions?.flashToast?.(`DB 저장 실패 (${op}): ${error.message}`, 'error');
        } else {
          dbLog('SUCCESS', `write:${table}`, `${op} 완료`);
        }
      }).catch(err => {
        dbLog('ERROR', `write:${table}`, `네트워크 오류 — ${err.message}`, err);
        window.actions?.flashToast?.(`네트워크 오류 (${op}): ${err.message}`, 'error');
      });
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
            client.from('tb_users').select('*'),
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
        cache.users      = u.data || [];
        cache.history    = h.data || [];
        histSeq = cache.history.reduce((mx, x) => Math.max(mx, x.history_id || 0), 0);
        // 매니저: composite PK (customer_name, name) → 캐시에 로컬 ID 부여
        mgrSeq = 0;
        cache.managers = (m.data || []).map(row => ({
          manager_id:    ++mgrSeq,
          customer_name: row.customer_name,
          name:          row.name,
          phone:         row.phone || '',
          is_primary:    row.is_primary || 0,
        }));

        // 부속 테이블 병렬 로드 (테이블 미존재 시에도 앱 정상 동작)
        await Promise.allSettled([
          client.from('tb_as_reception').select('*').order('id').then(({ data, error }) => {
            if (!error) { cache.as_receptions = data || []; asRecSeq = cache.as_receptions.reduce((mx, x) => Math.max(mx, x.id || 0), 0); }
            else dbLog('WARN', 'loadAll', 'tb_as_reception 조회 실패 — ' + error.message);
          }).catch(e => dbLog('WARN', 'loadAll', 'tb_as_reception 로드 오류 — ' + e.message)),

          client.from('tb_as_log').select('*').order('id').then(({ data, error }) => {
            if (!error) { cache.as_logs = data || []; asLogSeq = cache.as_logs.reduce((mx, x) => Math.max(mx, x.id || 0), 0); }
            else dbLog('WARN', 'loadAll', 'tb_as_log 조회 실패 — ' + error.message);
          }).catch(e => dbLog('WARN', 'loadAll', 'tb_as_log 로드 오류 — ' + e.message)),

          client.from('tb_as_photo').select('*').order('id').then(({ data, error }) => {
            if (!error) { cache.as_photos = data || []; asPhotoSeq = cache.as_photos.reduce((mx, x) => Math.max(mx, x.id || 0), 0); }
            else dbLog('WARN', 'loadAll', 'tb_as_photo 조회 실패 — ' + error.message);
          }).catch(e => dbLog('WARN', 'loadAll', 'tb_as_photo 로드 오류 — ' + e.message)),

          client.from('tb_func_inspection').select('*').order('order_id').then(({ data, error }) => {
            if (!error) cache.func_inspections = data || [];
            else dbLog('WARN', 'loadAll', 'tb_func_inspection 조회 실패 — ' + error.message);
          }).catch(e => dbLog('WARN', 'loadAll', 'tb_func_inspection 로드 오류 — ' + e.message)),

          client.from('tb_ship_inspection').select('*').order('order_id').then(({ data, error }) => {
            if (!error) cache.ship_inspections = data || [];
            else dbLog('WARN', 'loadAll', 'tb_ship_inspection 조회 실패 — ' + error.message);
          }).catch(e => dbLog('WARN', 'loadAll', 'tb_ship_inspection 로드 오류 — ' + e.message)),

          client.from('tb_UsageType_Public').select('*').then(({ data, error }) => {
            if (!error) cache.usage_type_public = data || [];
            else dbLog('WARN', 'loadAll', 'tb_UsageType_Public 조회 실패 — ' + error.message);
          }).catch(e => dbLog('WARN', 'loadAll', 'tb_UsageType_Public 로드 오류 — ' + e.message)),

          client.from('tb_chargepoint_infor').select('*').then(({ data, error }) => {
            if (!error) cache.chargepoints = data || [];
            else dbLog('WARN', 'loadAll', 'tb_chargepoint_infor 조회 실패 — ' + error.message);
          }).catch(e => dbLog('WARN', 'loadAll', 'tb_chargepoint_infor 로드 오류 — ' + e.message)),
        ]);

        // 마스터 데이터 로드 (테이블 미존재 시에도 앱 정상 동작)
        try {
          const mapResult = (r, fn) => r.error ? [] : (r.data || []).map(fn);
          const [mc, mm, mpv, mcpo] = await Promise.all([
            client.from('tb_master_customer').select('*').order('name'),
            client.from('tb_master_model').select('*').order('id'),
            client.from('tb_program_version').select('*').order('id'),
            client.from('tb_master_cpo').select('*').order('id'),
          ]);
          cache.customers = mapResult(mc, c => ({ name: c.name, is_address: c.is_address || '', last: c.last || '' }));
          cache.cpos = mapResult(mcpo, c => ({ id: c.id, name: c.name, code: c.code }));
          // model_code → model (하위 호환성 유지)
          cache.models = mapResult(mm, m => ({ model: m.model_code || '', description: m.description || '', power: m.power || '' }));
          cache.program_versions = mapResult(mpv, r => ({ type: r.type, tag: r.tag, released: r.released, stable: r.stable }));
          const errs = [mc, mm, mpv, mcpo].map(r => r.error).filter(Boolean);
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
        });
      },

      loadOrders() {
        const pmap = {};
        cache.production.forEach(p => { const { order_id, ...rest } = p; pmap[order_id] = rest; });
        const pubmap = {};
        cache.usage_type_public.forEach(p => { pubmap[p.order_id] = p; });
        return [...cache.orders]
          .sort((a, b) => (b.created || '').localeCompare(a.created || '') || b.order_id - a.order_id)
          .map(o => {
            const pub = pubmap[o.order_id] || {};
            return {
              ...o,
              station_id: pub.station_id || '',
              charger_no: pub.charger_no || '',
              router_no:  pub.router_no  || '',
              usim_no:    pub.usim_no    || '',
              ...(pmap[o.order_id] ? { production: pmap[o.order_id] } : {}),
            };
          });
      },

      addOrder(form) {
        const id = cache.orders.reduce((mx, o) => Math.max(mx, o.order_id), 24000) + 1;
        const row = { order_id: id, customer_name: form.customer_name, customer_manager: form.customer_manager || '', cpo_name: form.cpo_name || '', usage_type: form.usage_type || '공용', model_name: form.model_name, delivery_date: form.delivery_date, install_address: form.install_address || '', field_manager_name: form.field_manager_name || '', field_manager_phone: form.field_manager_phone || '', status: 'PENDING', created: TODAY };
        cache.orders.push(row);
        dbLog('INFO', 'write:tb_sales_order', `주문 추가 — order_id=${id}, 고객=${form.customer_name}`);
        dbWrite('tb_sales_order', 'insert', async () => {
          await client.from('tb_sales_order').insert(row);
          if ((form.usage_type || '공용') === '공용') {
            const pub = { order_id: id, station_id: form.station_id || '', charger_no: form.charger_no || '', router_no: form.router_no || '', usim_no: form.usim_no || '' };
            cache.usage_type_public.push(pub);
            return client.from('tb_UsageType_Public').insert(pub);
          }
          return { error: null };
        });
        return id;
      },

      updateOrder(order_id, form) {
        const o = cache.orders.find(x => x.order_id === order_id);
        if (!o || o.status !== 'PENDING') {
          dbLog('WARN', 'write:tb_sales_order', `주문 수정 불가 — order_id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        const upd = { customer_name: form.customer_name, customer_manager: form.customer_manager || '', cpo_name: form.cpo_name || '', usage_type: form.usage_type || '공용', model_name: form.model_name, delivery_date: form.delivery_date, install_address: form.install_address || '', field_manager_name: form.field_manager_name || '', field_manager_phone: form.field_manager_phone || '' };
        Object.assign(o, upd);
        dbLog('INFO', 'write:tb_sales_order', `주문 수정 — order_id=${order_id}`);
        dbWrite('tb_sales_order', 'update', async () => {
          await client.from('tb_sales_order').update(upd).eq('order_id', order_id);
          const pub = { order_id, station_id: form.station_id || '', charger_no: form.charger_no || '', router_no: form.router_no || '', usim_no: form.usim_no || '' };
          const idx = cache.usage_type_public.findIndex(p => p.order_id === order_id);
          if (idx !== -1) cache.usage_type_public[idx] = pub; else cache.usage_type_public.push(pub);
          if ((form.usage_type || '공용') === '공용') {
            return client.from('tb_UsageType_Public').upsert(pub, { onConflict: 'order_id' });
          }
          return { error: null };
        });
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
        if (o) o.status = 'AWAIT_PICKUP';
        dbLog('INFO', 'write:tb_sales_order', `생산 완료 — 출하대기 전환, order_id=${order_id}`);
        dbWrite('tb_sales_order', 'complete', async () => {
          await client.from('tb_production_info').upsert({ order_id, ...p }, { onConflict: 'order_id' });
          return client.from('tb_sales_order').update({ status: 'AWAIT_PICKUP' }).eq('order_id', order_id);
        });
      },

      shipOrder(order_id) {
        const o = cache.orders.find(x => x.order_id === order_id);
        if (!o || o.status !== 'AWAIT_PICKUP') {
          dbLog('WARN', 'write:tb_sales_order', `출하 처리 불가 — order_id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        o.status = 'COMPLETED';
        dbLog('INFO', 'write:tb_sales_order', `출하 완료 — order_id=${order_id}`);
        dbWrite('tb_sales_order', 'ship', () => client.from('tb_sales_order').update({ status: 'COMPLETED' }).eq('order_id', order_id));
        return true;
      },

      revertOrder(order_id) {
        const o = cache.orders.find(x => x.order_id === order_id);
        if (o) o.status = 'PENDING';
        const prod = cache.production.find(x => x.order_id === order_id);
        if (prod) prod.serial_no = null;
        // 출하 사진 경로를 캐시에서 수집 (삭제 전에)
        const shipRow = cache.ship_inspections.find(x => x.order_id === order_id);
        const shipPhotoPaths = shipRow
          ? JSON.parse(shipRow.photos || '[]').map(p => p.storage_path).filter(Boolean)
          : [];
        cache.func_inspections = cache.func_inspections.filter(x => x.order_id !== order_id);
        cache.ship_inspections = cache.ship_inspections.filter(x => x.order_id !== order_id);
        dbLog('INFO', 'write:revert', `생산대기로 변경 — serial 초기화·검사 삭제, order_id=${order_id}`);
        dbWrite('tb_sales_order', 'revert', async () => {
          await client.from('tb_sales_order').update({ status: 'PENDING' }).eq('order_id', order_id);
          await client.from('tb_production_info').update({ serial_no: null }).eq('order_id', order_id);
          await client.from('tb_func_inspection').delete().eq('order_id', order_id);
          await client.from('tb_ship_inspection').delete().eq('order_id', order_id);
          if (shipPhotoPaths.length > 0) {
            try { await client.storage.from('ship-photos').remove(shipPhotoPaths); } catch (_) {}
          }
          return { error: null };
        });
      },

      revertToAwaitPickup(order_id) {
        const o = cache.orders.find(x => x.order_id === order_id);
        if (!o || o.status !== 'COMPLETED') {
          dbLog('WARN', 'write:tb_sales_order', `AWAIT_PICKUP 복귀 불가 — order_id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        o.status = 'AWAIT_PICKUP';
        dbLog('INFO', 'write:tb_sales_order', `출하대기로 변경 — order_id=${order_id}`);
        dbWrite('tb_sales_order', 'revertToAwaitPickup', () => client.from('tb_sales_order').update({ status: 'AWAIT_PICKUP' }).eq('order_id', order_id));
        return true;
      },

      revertToInProgress(order_id) {
        const o = cache.orders.find(x => x.order_id === order_id);
        if (!o || o.status !== 'COMPLETED') {
          dbLog('WARN', 'write:tb_sales_order', `IN_PROGRESS 복귀 불가 — order_id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        o.status = 'IN_PROGRESS';
        dbLog('INFO', 'write:tb_sales_order', `생산진행중으로 변경 — order_id=${order_id}`);
        dbWrite('tb_sales_order', 'revertToInProgress', () => client.from('tb_sales_order').update({ status: 'IN_PROGRESS' }).eq('order_id', order_id));
        return true;
      },

      awaitToInProgress(order_id) {
        const o = cache.orders.find(x => x.order_id === order_id);
        if (!o || o.status !== 'AWAIT_PICKUP') {
          dbLog('WARN', 'write:tb_sales_order', `작업중 복귀 불가 — order_id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        o.status = 'IN_PROGRESS';
        dbLog('INFO', 'write:tb_sales_order', `출하대기→작업중 변경 — order_id=${order_id}`);
        dbWrite('tb_sales_order', 'awaitToInProgress', () => client.from('tb_sales_order').update({ status: 'IN_PROGRESS' }).eq('order_id', order_id));
        return true;
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

      serialExists(serial, excludeOrderId) {
        return cache.production.some(p => p.serial_no === serial && p.order_id !== excludeOrderId);
      },

      getManagers(customer_name) {
        const list = customer_name ? cache.managers.filter(m => m.customer_name === customer_name) : [...cache.managers];
        return list.sort((a, b) => (b.is_primary || 0) - (a.is_primary || 0) || (a.name || '').localeCompare(b.name || ''));
      },

      addManager(m) {
        if (m.is_primary) cache.managers.forEach(x => { if (x.customer_name === m.customer_name) x.is_primary = 0; });
        const id = ++mgrSeq;
        const row = { manager_id: id, customer_name: m.customer_name, name: m.name, phone: m.phone || '', is_primary: m.is_primary ? 1 : 0 };
        cache.managers.push(row);
        dbLog('INFO', 'write:tb_customer_manager', `담당자 추가 — 고객=${m.customer_name}, 이름=${m.name}`);
        dbWrite('tb_customer_manager', 'insert', async () => {
          if (m.is_primary) await client.from('tb_customer_manager').update({ is_primary: 0 }).eq('customer_name', m.customer_name);
          return client.from('tb_customer_manager').insert({ customer_name: m.customer_name, name: m.name, phone: m.phone || '', is_primary: m.is_primary ? 1 : 0 });
        });
        return id;
      },

      updateManager(id, m) {
        const row = cache.managers.find(x => x.manager_id === id);
        if (!row) return;
        if (m.is_primary) cache.managers.forEach(x => { if (x.customer_name === row.customer_name) x.is_primary = 0; });
        const oldName = row.name;
        const upd = { phone: m.phone || '', is_primary: m.is_primary ? 1 : 0 };
        Object.assign(row, { name: m.name, ...upd });
        dbLog('INFO', 'write:tb_customer_manager', `담당자 수정 — 고객=${row.customer_name}, 이름=${oldName}→${m.name}`);
        dbWrite('tb_customer_manager', 'update', async () => {
          if (m.is_primary) await client.from('tb_customer_manager').update({ is_primary: 0 }).eq('customer_name', row.customer_name);
          if (m.name !== oldName) {
            await client.from('tb_customer_manager').delete().eq('customer_name', row.customer_name).eq('name', oldName);
            return client.from('tb_customer_manager').insert({ customer_name: row.customer_name, name: m.name, ...upd });
          }
          return client.from('tb_customer_manager').update(upd).eq('customer_name', row.customer_name).eq('name', oldName);
        });
      },

      deleteManager(id) {
        const row = cache.managers.find(x => x.manager_id === id);
        if (!row) return;
        cache.managers = cache.managers.filter(x => x.manager_id !== id);
        dbLog('INFO', 'write:tb_customer_manager', `담당자 삭제 — 고객=${row.customer_name}, 이름=${row.name}`);
        dbWrite('tb_customer_manager', 'delete', () => client.from('tb_customer_manager').delete().eq('customer_name', row.customer_name).eq('name', row.name));
      },

      async authenticate(userId, password) {
        const u = cache.users.find(x => x.user_id === userId);
        if (!u) { dbLog('WARN', 'auth', `로그인 실패 — user_id=${userId}`); return null; }
        try {
          const ok = await verifyPassword(password, u.password);
          if (!ok) { dbLog('WARN', 'auth', `로그인 실패 — user_id=${userId}`); return null; }
          // 평문 비밀번호면 첫 로그인 시 자동 해시 변환
          if (!u.password.startsWith('pbkdf2:')) {
            try {
              const hashed = await hashPassword(password);
              u.password = hashed;
              dbWrite('tb_users', 'update', () => client.from('tb_users').update({ password: hashed }).eq('user_id', userId));
            } catch (he) { dbLog('WARN', 'auth', `해시 변환 실패 — user_id=${userId}`, he); }
          }
          dbLog('SUCCESS', 'auth', `로그인 성공 — user_id=${userId}, role=${u.role}`);
          return { user_id: u.user_id, name: u.name, role: u.role, dept: u.dept, phone: u.phone, email: u.email || '' };
        } catch (e) {
          dbLog('ERROR', 'auth', `인증 오류 — user_id=${userId}`, e);
          return null;
        }
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

      async changePassword(userId, newPw) {
        const u = cache.users.find(x => x.user_id === userId);
        if (!u) return false;
        const hashed = await hashPassword(newPw);
        u.password = hashed;
        dbLog('INFO', 'write:users', `비밀번호 변경 — user_id=${userId}`);
        dbWrite('tb_users', 'update', () => client.from('tb_users').update({ password: hashed }).eq('user_id', userId));
        return true;
      },

      getAllUsers() {
        return cache.users.map(u => ({
          user_id: u.user_id, name: u.name, role: u.role,
          dept: u.dept || '', phone: u.phone || '', email: u.email || '',
        }));
      },

      async addUser(data) {
        if (cache.users.find(x => x.user_id === data.user_id)) return { ok: false, msg: '이미 존재하는 아이디입니다' };
        const hashed = await hashPassword(data.password || '1234');
        const row = { user_id: data.user_id, password: hashed, name: data.name, role: data.role, dept: data.dept || '', phone: data.phone || '', email: data.email || '' };
        cache.users.push(row);
        dbLog('INFO', 'write:users', `사용자 추가 — user_id=${data.user_id}, role=${data.role}`);
        dbWrite('tb_users', 'insert', () => client.from('tb_users').insert(row));
        return { ok: true };
      },

      async updateUser(userId, data) {
        const u = cache.users.find(x => x.user_id === userId);
        if (!u) return { ok: false, msg: '사용자를 찾을 수 없습니다' };
        const upd = { name: data.name, role: data.role, dept: data.dept || '', phone: data.phone || '', email: data.email || '' };
        if (data.password) upd.password = await hashPassword(data.password);
        Object.assign(u, upd);
        dbLog('INFO', 'write:users', `사용자 수정 — user_id=${userId}`);
        dbWrite('tb_users', 'update', () => client.from('tb_users').update(upd).eq('user_id', userId));
        return { ok: true };
      },

      deleteUser(userId) {
        const idx = cache.users.findIndex(x => x.user_id === userId);
        if (idx === -1) return { ok: false, msg: '사용자를 찾을 수 없습니다' };
        cache.users.splice(idx, 1);
        dbLog('INFO', 'write:users', `사용자 삭제 — user_id=${userId}`);
        dbWrite('tb_users', 'delete', () => client.from('tb_users').delete().eq('user_id', userId));
        return { ok: true };
      },

      query() { return []; },

      addHistory(order_id, changedBy, changedAt, fields, action, serial_no) {
        const id = ++histSeq;
        const row = { history_id: id, order_id, serial_no: serial_no || '', changed_at: changedAt, changed_by: changedBy, action: action || 'update', changed_fields: JSON.stringify(fields) };
        cache.history.push(row);
        dbLog('INFO', 'write:tb_order_history', `이력 추가 — order_id=${order_id}, action=${action || 'update'}, by=${changedBy}`);
        dbWrite('tb_order_history', 'insert', () => client.from('tb_order_history').insert(row));
      },

      getHistory(order_id) {
        return [...cache.history.filter(h => h.order_id === order_id)]
          .sort((a, b) => (b.changed_at || '').localeCompare(a.changed_at || ''))
          .map(r => ({ ...r, changed_fields: JSON.parse(r.changed_fields || '[]') }));
      },


      // ── AS 접수 (tb_as_reception) ──────────────────────────────
      _genReceptionNo() {
        const d = new Date();
        const yy = String(d.getFullYear()).slice(2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const prefix = `AS-${yy}${mm}${dd}-`;
        const nums = cache.as_receptions
          .filter(r => r.reception_no && r.reception_no.startsWith(prefix))
          .map(r => parseInt(r.reception_no.slice(prefix.length), 10))
          .filter(n => !isNaN(n));
        const next = nums.length ? Math.max(...nums) + 1 : 0;
        return `${prefix}${String(next).padStart(4, '0')}`;
      },

      loadAsReceptions() {
        return [...cache.as_receptions]
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      },

      getAsReception(id) {
        return cache.as_receptions.find(x => x.id === id) || null;
      },

      addAsReception(form) {
        const id = ++asRecSeq;
        const reception_no = this._genReceptionNo();
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const row = {
          id,
          reception_no,
          serial_no:      form.serial_no      || '',
          fault_type:     form.fault_type     || '',
          fault_detail:   form.fault_detail   || '',
          status:         '접수대기',
          priority:       form.priority       || '일반',
          reporter_name:  form.reporter_name  || '',
          reporter_phone: form.reporter_phone || '',
          received_at:    form.received_at    || now,
          received_by:    form.received_by    || '',
          assignee:       '',
          dispatch_date:  '',
          action_type:    '',
          action_detail:  '',
          cost:           '',
          completed_at:   '',
          notes:          '',
          created_at:     now,
        };
        cache.as_receptions.push(row);
        dbLog('INFO', 'write:tb_as_reception', `AS 접수 등록 — id=${id}, no=${reception_no}`);
        dbWrite('tb_as_reception', 'insert', () => client.from('tb_as_reception').insert(row));
        return { id, reception_no };
      },

      updateAsReception(id, form) {
        const r = cache.as_receptions.find(x => x.id === id);
        if (!r) return false;
        const upd = {};
        const fields = ['serial_no','fault_type','fault_detail',
                        'priority','reporter_name','reporter_phone','received_at','assignee','dispatch_date',
                        'status','action_type','action_detail','cost','completed_at','notes'];
        fields.forEach(k => { if (form[k] !== undefined) upd[k] = form[k]; });
        Object.assign(r, upd);
        dbLog('INFO', 'write:tb_as_reception', `AS 접수 수정 — id=${id}`);
        dbWrite('tb_as_reception', 'update', () => client.from('tb_as_reception').update(upd).eq('id', id));
        return true;
      },

      // ── AS 처리 이력 (tb_as_log) ───────────────────────────────
      addAsLog(reception_id, from_status, to_status, memo, by) {
        const id = ++asLogSeq;
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const row = { id, reception_id, changed_at: now, changed_by: by || '', from_status: from_status || '', to_status: to_status || '', memo: memo || '' };
        cache.as_logs.push(row);
        dbLog('INFO', 'write:tb_as_log', `AS 이력 추가 — reception_id=${reception_id}, ${from_status} → ${to_status}`);
        dbWrite('tb_as_log', 'insert', () => client.from('tb_as_log').insert(row));
      },

      getAsLogs(reception_id) {
        return [...cache.as_logs.filter(x => x.reception_id === reception_id)]
          .sort((a, b) => (b.changed_at || '').localeCompare(a.changed_at || ''));
      },

      // ── AS 첨부 사진 (tb_as_photo + Supabase Storage) ──────────────
      getAsPhotos(reception_id) {
        return [...cache.as_photos.filter(x => x.reception_id === reception_id)]
          .sort((a, b) => (a.uploaded_at || '').localeCompare(b.uploaded_at || ''));
      },

      async addAsPhoto(reception_id, file, by) {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const ext = file.name.split('.').pop();
        const storagePath = `${reception_id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        let url = '';
        try {
          const { error: upErr } = await client.storage.from('as-photos').upload(storagePath, file, { upsert: false });
          if (upErr) throw upErr;
          const { data: urlData } = client.storage.from('as-photos').getPublicUrl(storagePath);
          url = urlData.publicUrl || '';
        } catch (e) {
          dbLog('ERROR', 'addAsPhoto', 'Storage 업로드 실패 — ' + e.message);
          throw e;
        }
        const id = ++asPhotoSeq;
        const row = { id, reception_id, filename: file.name, url, storage_path: storagePath, uploaded_by: by || '', uploaded_at: now };
        cache.as_photos.push(row);
        dbLog('INFO', 'write:tb_as_photo', `사진 추가 — reception_id=${reception_id}, path=${storagePath}`);
        dbWrite('tb_as_photo', 'insert', () => client.from('tb_as_photo').insert(row));
        return row;
      },

      async deleteAsPhoto(id, storage_path) {
        cache.as_photos = cache.as_photos.filter(x => x.id !== id);
        dbLog('INFO', 'write:tb_as_photo', `사진 삭제 — id=${id}`);
        if (storage_path) {
          try { await client.storage.from('as-photos').remove([storage_path]); } catch (_) {}
        }
        dbWrite('tb_as_photo', 'delete', () => client.from('tb_as_photo').delete().eq('id', id));
      },

      getCustomers() {
        return [...cache.customers];
      },

      addMasterCustomer(name, is_address) {
        if (cache.customers.find(c => c.name === name))
          return { ok: false, msg: '이미 등록된 고객사명입니다' };
        const last = new Date().toISOString().slice(0, 10);
        cache.customers.push({ name, is_address: !!is_address, last });
        dbLog('INFO', 'write:tb_master_customer', `고객사 추가 — ${name}`);
        dbWrite('tb_master_customer', 'insert', () => client.from('tb_master_customer').insert({ name, is_address: !!is_address, last }));
        return { ok: true };
      },

      updateMasterCustomer(idx, name, is_address) {
        const c = cache.customers[idx];
        if (!c) return { ok: false, msg: '고객사를 찾을 수 없습니다' };
        const dupName = cache.customers.findIndex(x => x.name === name);
        if (dupName !== -1 && dupName !== idx) return { ok: false, msg: '이미 등록된 고객사명입니다' };
        const oldName = c.name;
        cache.customers[idx] = { ...c, name, is_address: !!is_address };
        dbLog('INFO', 'write:tb_master_customer', `고객사 수정 — ${oldName} → ${name}`);
        dbWrite('tb_master_customer', 'update', () => client.from('tb_master_customer').update({ name, is_address: !!is_address }).eq('name', oldName));
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
        return cache.program_versions.filter(v => v.type === 'S/W');
      },

      addMasterSwVersion(ver) {
        const row = { type: 'S/W', tag: ver.tag, released: ver.released, stable: !!ver.stable };
        cache.program_versions.unshift(row);
        dbLog('INFO', 'write:tb_program_version', `S/W 버전 추가 — ${ver.tag}`);
        dbWrite('tb_program_version', 'insert', () => client.from('tb_program_version').insert(row));
      },

      getFwVersions() {
        return cache.program_versions.filter(v => v.type === 'F/W');
      },

      addMasterFwVersion(ver) {
        const row = { type: 'F/W', tag: ver.tag, released: ver.released, stable: !!ver.stable };
        cache.program_versions.unshift(row);
        dbLog('INFO', 'write:tb_program_version', `F/W 버전 추가 — ${ver.tag}`);
        dbWrite('tb_program_version', 'insert', () => client.from('tb_program_version').insert(row));
      },

      getModels() {
        return [...cache.models];
      },

      addMasterModel(model, description, power) {
        if (cache.models.find(m => m.model === model))
          return { ok: false, msg: '이미 등록된 모델 코드입니다' };
        const row = { model, description: description || '', power: power || '' };
        cache.models.push(row);
        dbLog('INFO', 'write:tb_master_model', `모델 추가 — ${model}`);
        dbWrite('tb_master_model', 'insert', () => client.from('tb_master_model').insert({ model_code: model, description: description || '', power: power || '' }));
        return { ok: true };
      },

      updateMasterModel(idx, model, description, power) {
        const m = cache.models[idx];
        if (!m) return { ok: false, msg: '모델을 찾을 수 없습니다' };
        if (model !== m.model && cache.models.find(x => x.model === model))
          return { ok: false, msg: '이미 등록된 모델 코드입니다' };
        const oldModel = m.model;
        Object.assign(m, { model, description: description || '', power: power || '' });
        dbLog('INFO', 'write:tb_master_model', `모델 수정 — ${model}`);
        dbWrite('tb_master_model', 'update', () => client.from('tb_master_model').update({ model_code: model, description: description || '', power: power || '' }).eq('model_code', oldModel));
        return { ok: true };
      },

      deleteMasterModel(idx) {
        const m = cache.models[idx];
        if (!m) return;
        const model = m.model;
        cache.models.splice(idx, 1);
        dbLog('INFO', 'write:tb_master_model', `모델 삭제 — ${model}`);
        dbWrite('tb_master_model', 'delete', () => client.from('tb_master_model').delete().eq('model_code', model));
      },

      // ── 충전기 설치 정보 (tb_chargepoint_infor) ───────────────────
      getChargepointBySerial(serial_no) {
        const q = String(serial_no || '').trim().toUpperCase();
        if (!q) return null;
        return cache.chargepoints.find(c => String(c.serial_no || '').trim().toUpperCase() === q) || null;
      },

      addChargepoint(data) {
        const serial_no = String(data.serial_no || '').trim();
        if (!serial_no) return { ok: false, msg: '시리얼번호를 입력하세요' };
        if (this.getChargepointBySerial(serial_no))
          return { ok: false, msg: '이미 등록된 시리얼번호입니다' };
        const row = {
          serial_no,
          model_name:      data.model_name      || '',
          order_id:        data.order_id        || null,
          install_address: data.install_address || '',
          created:         data.created         || '',
        };
        cache.chargepoints.push(row);
        dbLog('INFO', 'write:tb_chargepoint_infor', `충전기 정보 추가 — serial_no=${serial_no}`);
        dbWrite('tb_chargepoint_infor', 'insert', () => client.from('tb_chargepoint_infor').insert(row));
        return { ok: true };
      },

      getFuncInspection(order_id) {
        const r = cache.func_inspections.find(x => x.order_id === order_id);
        if (!r) return null;
        return { insp_date: r.insp_date, inspector: r.inspector, checks: JSON.parse(r.checks || '{}'), notes: r.notes || '', saved_at: r.saved_at };
      },

      saveFuncInspection(order_id, data) {
        const checks = JSON.stringify(data.checks || {});
        const existing = cache.func_inspections.find(x => x.order_id === order_id);
        if (existing) {
          Object.assign(existing, { insp_date: data.insp_date, inspector: data.inspector, checks, notes: data.notes || '', saved_at: data.saved_at });
        } else {
          cache.func_inspections.push({ order_id, insp_date: data.insp_date, inspector: data.inspector, checks, notes: data.notes || '', saved_at: data.saved_at });
        }
        dbLog('INFO', 'write:tb_func_inspection', `기능 검사 성적서 저장 — order_id=${order_id}`);
        dbWrite('tb_func_inspection', 'upsert', () => client.from('tb_func_inspection').upsert(
          { order_id, insp_date: data.insp_date, inspector: data.inspector, checks, notes: data.notes || '', saved_at: data.saved_at },
          { onConflict: 'order_id' }
        ));
      },

      deleteFuncInspection(order_id) {
        cache.func_inspections = cache.func_inspections.filter(x => x.order_id !== order_id);
        dbLog('INFO', 'write:tb_func_inspection', `기능 검사 성적서 삭제 — order_id=${order_id}`);
        dbWrite('tb_func_inspection', 'delete', () => client.from('tb_func_inspection').delete().eq('order_id', order_id));
      },

      getShipInspectionDB(order_id) {
        const r = cache.ship_inspections.find(x => x.order_id === order_id);
        if (!r) return null;
        return {
          insp_date: r.insp_date,
          inspector: r.inspector,
          checks: JSON.parse(r.checks || '{}'),
          notes: r.notes || '',
          saved_at: r.saved_at,
          photos: JSON.parse(r.photos || '[]'),
        };
      },

      saveShipInspection(order_id, data) {
        if (data == null) {
          cache.ship_inspections = cache.ship_inspections.filter(x => x.order_id !== order_id);
          dbLog('INFO', 'write:tb_ship_inspection', `출하 검사 성적서 삭제 — order_id=${order_id}`);
          dbWrite('tb_ship_inspection', 'delete', () => client.from('tb_ship_inspection').delete().eq('order_id', order_id));
          return;
        }
        const checks = JSON.stringify(data.checks || {});
        const existing = cache.ship_inspections.find(x => x.order_id === order_id);
        if (existing) {
          Object.assign(existing, { insp_date: data.insp_date, inspector: data.inspector, checks, notes: data.notes || '', saved_at: data.saved_at });
          // photos 필드는 건드리지 않음 — addShipPhoto/deleteShipPhoto로만 변경
        } else {
          cache.ship_inspections.push({ order_id, insp_date: data.insp_date, inspector: data.inspector, checks, notes: data.notes || '', saved_at: data.saved_at, photos: '[]' });
        }
        dbLog('INFO', 'write:tb_ship_inspection', `출하 검사 성적서 저장 — order_id=${order_id}`);
        dbWrite('tb_ship_inspection', 'upsert', () => client.from('tb_ship_inspection').upsert(
          { order_id, insp_date: data.insp_date, inspector: data.inspector, checks, notes: data.notes || '', saved_at: data.saved_at },
          { onConflict: 'order_id' }
        ));
        // photos 컬럼을 upsert payload에 포함하지 않음:
        //   INSERT 시 → DB DEFAULT '[]' 적용
        //   UPDATE 시 → 기존 photos 값 유지 (Supabase upsert는 payload에 없는 컬럼을 덮어쓰지 않음)
      },

      getShipPhotos(order_id) {
        const r = cache.ship_inspections.find(x => x.order_id === order_id);
        if (!r) return [];
        try { return JSON.parse(r.photos || '[]'); } catch (_) { return []; }
      },

      async addShipPhoto(order_id, file, by) {
        const existing = cache.ship_inspections.find(x => x.order_id === order_id);
        if (!existing) throw new Error('출하검사 성적서를 먼저 저장하세요');
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
        const storagePath = `order/${order_id}/${Date.now()}${ext}`;
        let url = '';
        try {
          const { error: upErr } = await client.storage.from('ship-photos').upload(storagePath, file, { upsert: false });
          if (upErr) throw upErr;
          const { data: urlData } = client.storage.from('ship-photos').getPublicUrl(storagePath);
          url = urlData.publicUrl || '';
        } catch (e) {
          dbLog('ERROR', 'addShipPhoto', 'Storage 업로드 실패 — ' + e.message);
          throw e;
        }
        const photoEntry = { filename: file.name, url, storage_path: storagePath, uploaded_by: by || '', uploaded_at: now };
        const currentPhotos = JSON.parse(existing.photos || '[]');
        currentPhotos.push(photoEntry);
        existing.photos = JSON.stringify(currentPhotos);
        dbLog('INFO', 'write:tb_ship_inspection', `출하 사진 추가 — order_id=${order_id}, path=${storagePath}`);
        const photosJson = existing.photos;
        dbWrite('tb_ship_inspection', 'update-photos', () =>
          client.from('tb_ship_inspection').update({ photos: photosJson }).eq('order_id', order_id)
        );
        return photoEntry;
      },

      async deleteShipPhoto(order_id, storagePath) {
        const existing = cache.ship_inspections.find(x => x.order_id === order_id);
        if (!existing) return;
        const currentPhotos = JSON.parse(existing.photos || '[]');
        existing.photos = JSON.stringify(currentPhotos.filter(p => p.storage_path !== storagePath));
        dbLog('INFO', 'write:tb_ship_inspection', `출하 사진 삭제 — order_id=${order_id}, path=${storagePath}`);
        if (storagePath) {
          try { await client.storage.from('ship-photos').remove([storagePath]); } catch (_) {}
        }
        const photosJson = existing.photos;
        dbWrite('tb_ship_inspection', 'update-photos', () =>
          client.from('tb_ship_inspection').update({ photos: photosJson }).eq('order_id', order_id)
        );
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
      window._supabaseClient = client;  // 이메일 OTP 인증용 전역 노출
      const backend = makeSupabaseBackend(client);

      window.updateBootStatus?.('데이터 로드 중…');
      await backend.loadAll();

      // 테이블이 비어 있으면 초기 데이터 삽입
      if (backend.cache.users.length === 0) {
        dbLog('INFO', 'init', '초기 사용자 데이터 삽입');
        const { error } = await client.from('tb_users').insert(SEED_USERS.map(u => ({ ...u })));
        if (error) dbLog('ERROR', 'init', '초기 사용자 삽입 실패 — ' + error.message, error);
        else backend.cache.users = SEED_USERS.map(u => ({ ...u }));
      }

      // 마스터 테이블이 비어 있으면 초기 데이터 삽입
      if (backend.cache.customers.length === 0) {
        try {
          const { data, error } = await client.from('tb_master_customer').insert(SEED_MASTER_CUSTOMERS).select();
          if (error) dbLog('WARN', 'init', '초기 고객사 삽입 실패 — ' + error.message);
          else {
            backend.cache.customers = (data || []).map(c => ({ name: c.name, is_address: !!c.is_address, last: c.last || '' }));
            dbLog('INFO', 'init', `초기 고객사 데이터 삽입 — ${backend.cache.customers.length}개`);
          }
        } catch (e) { dbLog('WARN', 'init', '초기 고객사 삽입 오류 — ' + e.message); }
        if (backend.cache.customers.length === 0)
          backend.cache.customers = SEED_MASTER_CUSTOMERS.map(c => ({ ...c }));
      }
      if (backend.cache.cpos.length === 0) {
        try {
          const { data, error } = await client.from('tb_master_cpo').insert(SEED_MASTER_CPOS).select();
          if (error) dbLog('WARN', 'init', '초기 CPO 운영사 삽입 실패 — ' + error.message);
          else {
            backend.cache.cpos = (data || []).map(c => ({ name: c.name, code: c.code }));
            dbLog('INFO', 'init', `초기 CPO 운영사 데이터 삽입 — ${backend.cache.cpos.length}개`);
          }
        } catch (e) { dbLog('WARN', 'init', '초기 CPO 운영사 삽입 오류 — ' + e.message); }
        if (backend.cache.cpos.length === 0)
          backend.cache.cpos = SEED_MASTER_CPOS.map(c => ({ ...c }));
      }
      if (backend.cache.program_versions.length === 0) {
        try {
          const { error } = await client.from('tb_program_version').insert(SEED_PROGRAM_VERSIONS);
          if (error) dbLog('WARN', 'init', '초기 프로그램 버전 삽입 실패 — ' + error.message);
          else dbLog('INFO', 'init', '초기 프로그램 버전 데이터 삽입 완료');
        } catch (e) { dbLog('WARN', 'init', '초기 프로그램 버전 삽입 오류 — ' + e.message); }
        backend.cache.program_versions = SEED_PROGRAM_VERSIONS.map(v => ({ ...v }));
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
    shipOrder(id)            { return this.backend.shipOrder(id); },
    revertOrder(id)          { return this.backend.revertOrder(id); },
    revertToAwaitPickup(id)  { return this.backend.revertToAwaitPickup(id); },
    revertToInProgress(id)   { return this.backend.revertToInProgress(id); },
    awaitToInProgress(id)    { return this.backend.awaitToInProgress(id); },
    startProduction(id)      { return this.backend.startProduction(id); },
    serialExists(s, excl)    { return this.backend.serialExists(s, excl); },
    getManagers(c)           { return this.backend.getManagers(c); },
    addManager(m)            { return this.backend.addManager(m); },
    updateManager(id, m)     { return this.backend.updateManager(id, m); },
    deleteManager(id)        { return this.backend.deleteManager(id); },
    async authenticate(id, pw)     { return this.backend.authenticate(id, pw); },
    getUser(id)                    { return this.backend.getUser(id); },
    verifyUserPhone(id, ph)        { return this.backend.verifyUserPhone(id, ph); },
    verifyUserEmail(id, em)        { return this.backend.verifyUserEmail(id, em); },
    async changePassword(id, pw)   { return this.backend.changePassword(id, pw); },
    getAllUsers()                   { return this.backend.getAllUsers(); },
    async addUser(data)            { return this.backend.addUser(data); },
    async updateUser(id, data)     { return this.backend.updateUser(id, data); },
    deleteUser(id)           { return this.backend.deleteUser(id); },
    query()                  { return []; },
    addHistory(id, by, at, f, a, sn) { return this.backend.addHistory(id, by, at, f, a, sn); },
    getHistory(id)           { return this.backend.getHistory(id); },
    getAsHistory(orderId)        { return this.backend.getAsHistory(orderId); },
    addAsRecord(record)          { return this.backend.addAsRecord(record); },
    deleteAsRecord(id)           { return this.backend.deleteAsRecord(id); },
    loadAsReceptions()           { return this.backend.loadAsReceptions(); },
    getAsReception(id)           { return this.backend.getAsReception(id); },
    addAsReception(form)         { return this.backend.addAsReception(form); },
    updateAsReception(id, form)  { return this.backend.updateAsReception(id, form); },
    addAsLog(rid, fs, ts, m, by)       { return this.backend.addAsLog(rid, fs, ts, m, by); },
    getAsLogs(rid)                     { return this.backend.getAsLogs(rid); },
    getAsPhotos(rid)                   { return this.backend.getAsPhotos(rid); },
    addAsPhoto(rid, file, by)          { return this.backend.addAsPhoto(rid, file, by); },
    deleteAsPhoto(id, storagePath)     { return this.backend.deleteAsPhoto(id, storagePath); },
    getCustomers()                     { return this.backend.getCustomers(); },
    addMasterCustomer(n, ia)          { return this.backend.addMasterCustomer(n, ia); },
    updateMasterCustomer(i, n, ia)    { return this.backend.updateMasterCustomer(i, n, ia); },
    deleteMasterCustomer(i)           { return this.backend.deleteMasterCustomer(i); },
    getCpos()                          { return this.backend.getCpos(); },
    addMasterCpo(n, c)                 { return this.backend.addMasterCpo(n, c); },
    updateMasterCpo(i, n, c)           { return this.backend.updateMasterCpo(i, n, c); },
    deleteMasterCpo(i)                 { return this.backend.deleteMasterCpo(i); },
    getModels()                       { return this.backend.getModels(); },
    addMasterModel(m, d, p)           { return this.backend.addMasterModel(m, d, p); },
    updateMasterModel(i, m, d, p)     { return this.backend.updateMasterModel(i, m, d, p); },
    deleteMasterModel(i)              { return this.backend.deleteMasterModel(i); },
    getChargepointBySerial(sn)        { return this.backend.getChargepointBySerial(sn); },
    addChargepoint(data)              { return this.backend.addChargepoint(data); },
    getFuncInspection(id)             { return this.backend.getFuncInspection(id); },
    saveFuncInspection(id, data)      { return this.backend.saveFuncInspection(id, data); },
    deleteFuncInspection(id)          { return this.backend.deleteFuncInspection(id); },
    getShipInspectionDB(id)           { return this.backend.getShipInspectionDB(id); },
    getShipPhotos(id)                 { return this.backend.getShipPhotos(id); },
    addShipPhoto(id, file, by)        { return this.backend.addShipPhoto(id, file, by); },
    deleteShipPhoto(id, path)         { return this.backend.deleteShipPhoto(id, path); },
    saveShipInspection(id, data)      { return this.backend.saveShipInspection(id, data); },
    getSwVersions()                   { return this.backend.getSwVersions(); },
    addMasterSwVersion(v)             { return this.backend.addMasterSwVersion(v); },
    getFwVersions()                   { return this.backend.getFwVersions(); },
    addMasterFwVersion(v)             { return this.backend.addMasterFwVersion(v); },
    reset()                      { dbLog('WARN', 'reset', 'Supabase 모드에서는 reset()을 지원하지 않습니다'); },
  };

  window.PMDB = PMDB;
  dbLog('INFO', 'module', 'PMDB (Supabase) 모듈 로드됨');
})();
