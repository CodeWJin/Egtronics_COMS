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

  // ── 시리얼 채번 규칙 (그룹코드-타입코드-연월코드-순번) ──────────────────────
  // "생산 수락"(생산요청 → 생산착수, startProduction) 시점에 자동 채번되며,
  // 생산착수 모달(production-waiting.jsx)에서 수동 수정 + 재생성도 가능하다.
  const SERIAL_MODEL_CODES = {
    'EGSW101101':    ['G00', '00S'],
    'EGMI205001':    ['G01', '00P'],
    'EGMI105001':    ['G01', '01P'],
    'EGMI104001':    ['G01', '02P'],
    'EGMI103001':    ['G01', '03P'],
    'EGFA210001':    ['G02', '00P'],
    'EGFA110001':    ['G02', '01P'],
    'EGSW100701':    ['G03', '00S'],
    'EGSW101102':    ['G04', '00H'],
    'EGSW100702':    ['G05', '00H'],
    'EGSW101103':    ['G07', '00P'],
    'EGSW101103P':   ['G07', '01S'],
    'EGSW101103I':   ['G07', '02P'],
    'EGSW101103PI':  ['G07', '03P'],
    'EGSW101103N':   ['G07', '04S'],
    'EGSW100703':    ['G08', '00P'],
    'EGSW100703P':   ['G08', '01S'],
    'EGSW100703I':   ['G08', '02P'],
    'EGSW100703PI':  ['G08', '03P'],
    'EGSW100703N':   ['G08', '04S'],
    'EGFA220001':    ['G09', '00P'],
    'EGFA120001':    ['G09', '01P'],
  };
  window.SERIAL_MODEL_CODES = SERIAL_MODEL_CODES;

  function makeSerialDateCode(dateISO) {
    const d = new Date(dateISO);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const yearCode = String.fromCharCode('A'.charCodeAt(0) + (year - 2023) % 20);
    const monthCode = month <= 9 ? String(month) : String.fromCharCode('A'.charCodeAt(0) + month - 10);
    return yearCode + monthCode;
  }
  window.makeSerialDateCode = makeSerialDateCode;

  // 시리얼번호가 생성규칙(그룹-타입-날짜코드-순번)에 맞는지 검증.
  // 그룹·타입 코드는 SERIAL_MODEL_CODES에 등록된 조합만 유효.
  // 날짜코드: 연도 A~T(2023=A) + 월 1~9/A~C(10월=A). 순번: 0001~9999.
  // as-receipt.jsx(신규 충전기 등록 게이트) 등에서 사용.
  //
  // 2026-02 이전 구형 장비는 타입코드가 없는 3세그먼트(그룹-날짜코드-순번) 시리얼을 사용했다.
  // 그룹 코드는 SERIAL_MODEL_CODES에 등록된 그룹만 유효, 날짜코드 규칙은 신형과 동일.
  const LEGACY_GROUPS = new Set(Object.values(SERIAL_MODEL_CODES).map(([g]) => g));
  const LEGACY_SERIAL_RE = /^([A-Z0-9]{3})-([A-T][1-9A-C])-(?!0000)(\d{4})$/;
  window.isValidSerialNo = function (serial) {
    const s = String(serial || '').trim().toUpperCase();
    const m = s.match(/^([A-Z0-9]{3})-([A-Z0-9]{3})-([A-T][1-9A-C])-(?!0000)(\d{4})$/);
    if (m) return Object.values(SERIAL_MODEL_CODES).some(([g, t]) => g === m[1] && t === m[2]);
    const lm = s.match(LEGACY_SERIAL_RE);
    return !!lm && LEGACY_GROUPS.has(lm[1]);
  };

  // 시리얼번호 앞 그룹-타입 코드로 모델(model_code)을 역추적.
  // as-receipt.jsx(신규 충전기 등록 — 시리얼번호로 모델 자동 선택)에서 사용.
  window.findModelCodeFromSerial = function (serial) {
    const s = String(serial || '').trim().toUpperCase();
    const m = s.match(/^([A-Z0-9]{3})-([A-Z0-9]{3})-/);
    if (!m) return null;
    const entry = Object.entries(SERIAL_MODEL_CODES).find(([, [g, t]]) => g === m[1] && t === m[2]);
    return entry ? entry[0] : null;
  };

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
    { name: '카스',     address: '' },
    { name: '마이크로', address: '' },
    { name: 'LG',       address: '' },
    { name: '삼성',     address: '' },
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
    // cache.orders: tb_charge_infor(충전기 유닛) 원본 행. cache.batches: tb_sales_order(배치) 원본 행.
    // loadOrders()가 매 호출마다 두 캐시 + 위성 테이블을 조인해 뷰용 평탄화 객체를 만든다.
    const cache = { orders: [], batches: [], managers: [], users: [], history: [], customers: [], cpos: [], program_versions: [], models: [], as_receptions: [], as_logs: [], as_photos: [], func_inspections: [], ship_inspections: [], usage_type_public: [], customer_addresses: [] };
    let mgrSeq = 0;
    let addrSeq = 0;
    let histSeq = 0;
    let asRecSeq = 0;
    let asLogSeq = 0;
    let asPhotoSeq = 0;
    let pubSeq = 0;
    let funcInspSeq = 0;
    let shipInspSeq = 0;

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
        const [b, o, m, u, h] = await Promise.race([
          Promise.all([
            client.from('tb_sales_order').select('*'),
            client.from('tb_charge_infor').select('*'),
            client.from('tb_customer_manager').select('*'),
            client.from('tb_users').select('*'),
            client.from('tb_order_history').select('*'),
          ]),
          deadline,
        ]);
        const firstErr = b.error || o.error || m.error || u.error || h.error;
        if (firstErr) {
          const hint = firstErr.message?.toLowerCase().includes('apikey') || firstErr.message?.toLowerCase().includes('invalid')
            ? '\n→ API 키가 잘못되었습니다. supabase-config.js의 SUPABASE_ANON_KEY를 확인하세요'
            : firstErr.message?.toLowerCase().includes('relation') || firstErr.message?.toLowerCase().includes('does not exist')
            ? '\n→ 테이블이 없습니다. supabase-schema.sql을 Supabase SQL 에디터에서 실행하세요'
            : '';
          dbLog('ERROR', 'loadAll', 'Supabase 데이터 로드 실패 — ' + firstErr.message, firstErr);
          throw new Error('Supabase 데이터 로드 실패: ' + firstErr.message + hint);
        }
        cache.batches    = b.data || [];
        cache.orders     = o.data || [];
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

          client.from('tb_inspection_func').select('*').order('id').then(({ data, error }) => {
            if (!error) { cache.func_inspections = data || []; funcInspSeq = cache.func_inspections.reduce((mx, x) => Math.max(mx, x.id || 0), 0); }
            else dbLog('WARN', 'loadAll', 'tb_inspection_func 조회 실패 — ' + error.message);
          }).catch(e => dbLog('WARN', 'loadAll', 'tb_inspection_func 로드 오류 — ' + e.message)),

          client.from('tb_inspection_ship').select('*').order('id').then(({ data, error }) => {
            if (!error) { cache.ship_inspections = data || []; shipInspSeq = cache.ship_inspections.reduce((mx, x) => Math.max(mx, x.id || 0), 0); }
            else dbLog('WARN', 'loadAll', 'tb_inspection_ship 조회 실패 — ' + error.message);
          }).catch(e => dbLog('WARN', 'loadAll', 'tb_inspection_ship 로드 오류 — ' + e.message)),

          client.from('tb_usagetype_public').select('*').then(({ data, error }) => {
            if (!error) { cache.usage_type_public = data || []; pubSeq = cache.usage_type_public.reduce((mx, x) => Math.max(mx, x.id || 0), 0); }
            else dbLog('WARN', 'loadAll', 'tb_usagetype_public 조회 실패 — ' + error.message);
          }).catch(e => dbLog('WARN', 'loadAll', 'tb_usagetype_public 로드 오류 — ' + e.message)),

          client.from('tb_customer_address').select('*').then(({ data, error }) => {
            if (!error) {
              addrSeq = 0;
              cache.customer_addresses = (data || []).map(row => ({
                address_id:    ++addrSeq,
                customer_name: row.customer_name,
                label:         row.label,
                address:       row.address || '',
                is_primary:    row.is_primary || 0,
              }));
            } else dbLog('WARN', 'loadAll', 'tb_customer_address 조회 실패 — ' + error.message);
          }).catch(e => dbLog('WARN', 'loadAll', 'tb_customer_address 로드 오류 — ' + e.message)),
        ]);

        // 마스터 데이터 로드 (테이블 미존재 시에도 앱 정상 동작)
        try {
          const mapResult = (r, fn) => r.error ? [] : (r.data || []).map(fn);
          const [mc, mm, mpv, mcpo] = await Promise.all([
            client.from('tb_customer').select('*').order('name'),
            client.from('tb_master_model').select('*').order('id'),
            client.from('tb_program_version').select('*').order('id'),
            client.from('tb_master_cpo').select('*').order('id'),
          ]);
          cache.customers = mapResult(mc, c => ({ name: c.name, address: c.address || '' }));
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
          tb_sales_order:      cache.batches.length,
          tb_charge_infor:     cache.orders.length,
          tb_customer_manager: cache.managers.length,
          users:               cache.users.length,
          tb_order_history:    cache.history.length,
        });
      },

      // 결정 A: tb_charge_infor(충전기 유닛)를 뷰가 기대하는 "order" 형태로 평탄화한다.
      // o.id(충전기 유닛 PK)를 order_id로, 원래 배치 PK는 batch_id로 노출한다.
      loadOrders() {
        const batchMap = {};
        cache.batches.forEach(b => { batchMap[b.order_id] = b; });
        const pubMap = {};
        cache.usage_type_public.forEach(p => { pubMap[p.id] = p; });
        return [...cache.orders]
          .sort((a, b) => (b.created || '').localeCompare(a.created || '') || String(b.id).localeCompare(String(a.id)))
          .map(o => {
            const batch = batchMap[o.order_id] || {};
            const pub = o.usage_public_id != null ? (pubMap[o.usage_public_id] || {}) : {};
            return {
              ...o,
              order_id: o.id,
              batch_id: o.order_id || '',
              requested_by: batch.requested_by || '',
              inspection_date: pub.inspection_date || '',
              station_id: pub.station_id || '',
              charger_no: pub.charger_no || '',
              router_no:  pub.router_no  || '',
              usim_no:    pub.usim_no    || '',
              cpo_name:   pub.cpo_name   || '',
            };
          });
      },

      _genOrderId() {
        const d = new Date();
        const yy = String(d.getFullYear()).slice(2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const prefix = `${yy}${mm}${dd}-`;
        const nums = cache.batches
          .filter(b => b.order_id && String(b.order_id).startsWith(prefix))
          .map(b => parseInt(String(b.order_id).slice(prefix.length), 10))
          .filter(n => !isNaN(n));
        const next = nums.length ? Math.max(...nums) + 1 : 0;
        return `${prefix}${String(next).padStart(4, '0')}`;
      },

      // '{order_id}-01'부터 시작하는 충전기 유닛 ID를 배치 스코프로 순차 채번
      _genChargeId(order_id) {
        const prefix = `${order_id}-`;
        const nums = cache.orders
          .filter(o => o.order_id === order_id)
          .map(o => parseInt(String(o.id).slice(prefix.length), 10))
          .filter(n => !isNaN(n));
        const next = nums.length ? Math.max(...nums) + 1 : 1;
        return `${prefix}${String(next).padStart(2, '0')}`;
      },

      _isRegisteredCharger(o) {
        return o.status === 'COMPLETED' || o.order_id == null;
      },

      // qty만큼 tb_charge_infor(충전기 유닛)를 생성하는 배치 등록.
      // 반환값 { batch_id, charge_ids }: charge_ids[0]이 기존 addOrder()의 반환값(단일 order_id) 역할을 한다.
      addOrderBatch(form) {
        const batchId = this._genOrderId();
        const qty = Math.max(1, parseInt(form.qty, 10) || 1);
        const usageType = form.usage_type || '공용';
        const batchRow = { order_id: batchId, model_name: form.model_name, usage_type: usageType, qty, requested_by: form.requested_by || '', created: TODAY };
        cache.batches.push(batchRow);
        dbLog('INFO', 'write:tb_sales_order', `배치 등록 — order_id=${batchId}, 모델=${form.model_name}, 수량=${qty}`);

        const chargeIds = [];
        const chargeRows = [];
        for (let i = 0; i < qty; i++) {
          const chargeId = this._genChargeId(batchId);
          const chargeRow = {
            id: chargeId, order_id: batchId, model_name: form.model_name, usage_type: usageType,
            serial_no: '', status: 'PENDING',
            usage_public_id: null, func_inspection_id: null, ship_inspection_id: null,
            sw_version: '', fw_version: '', cable_length: null,
            prod_date: '', delivery_date: '', ship_from_address: '', install_address: '',
            customer_name: '', customer_manager: '', field_manager_phone: '',
            created: TODAY,
          };
          cache.orders.push(chargeRow);
          chargeIds.push(chargeId);

          // 생산요청 등록 시점에 시리얼번호 자동 채번 (모델에 등록된 채번 규칙이 없으면 생략).
          // 생산착수(startProduction) 시에는 이미 채번된 값이 있으면 재채번하지 않는다.
          // generateSerialSuggestion은 캐시만 참조하므로 동기 호출 가능 — insert 페이로드에 바로 포함시킨다.
          const serial = this.generateSerialSuggestion(form.model_name, usageType, TODAY, chargeId);
          if (serial) chargeRow.serial_no = serial;
          chargeRows.push(chargeRow);
        }

        // tb_charge_infor.order_id는 tb_sales_order.order_id를 참조하는 FK(fk_charge_order)이므로,
        // 배치 insert가 커밋되기 전에 유닛 insert가 도착하면 FK 위반이 난다. 두 write를 별도의
        // dbWrite로 각각 fire-and-forget 하면 순서가 보장되지 않으므로, 하나의 dbWrite 안에서
        // 배치 → 유닛 순으로 순차 await 한다(updateOrder/saveProduction과 동일한 패턴).
        dbWrite('tb_sales_order', 'insert', async () => {
          const batchRes = await client.from('tb_sales_order').insert(batchRow);
          if (batchRes.error) return batchRes;
          for (const chargeRow of chargeRows) {
            const res = await client.from('tb_charge_infor').insert(chargeRow);
            if (res.error) return res;
          }
          return { error: null };
        });
        return { batch_id: batchId, charge_ids: chargeIds };
      },

      // 생산요청(PENDING)·생산착수(IN_PROGRESS) 수정과 생산완료(AWAIT_PICKUP) 영업정보 입력이
      // 모두 이 함수를 쓰되 서로 다른 필드 부분집합만 보내므로, form에 실제로 담긴 키만
      // 병합한다(전체 덮어쓰기 금지). order_id 인자는 충전기 유닛 ID(tb_charge_infor.id)를
      // 가리킨다(결정 A).
      updateOrder(order_id, form) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o || (o.status !== 'PENDING' && o.status !== 'IN_PROGRESS' && o.status !== 'AWAIT_PICKUP')) {
          dbLog('WARN', 'write:tb_charge_infor', `충전기 정보 수정 불가 — id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        const FIELDS = ['model_name', 'usage_type', 'customer_name', 'customer_manager', 'field_manager_phone', 'delivery_date', 'install_address', 'ship_from_address', 'cable_length'];
        const upd = {};
        FIELDS.forEach(k => { if (form[k] !== undefined) upd[k] = form[k]; });
        Object.assign(o, upd);

        // 공용 전용 필드(station_id 등, cpo_name, inspection_date)는 tb_usagetype_public 위성 테이블로 라우팅.
        // 캐시는 동기 반영 — Supabase 응답을 기다렸다가 반영하면, 직후 호출되는 loadOrders()가 값을
        // 못 보고 isSalesInfoComplete가 false로 평가되어 화면 전환이 저장 즉시 일어나지 않는 문제가 있었다.
        const PUB_FIELDS = ['station_id', 'charger_no', 'router_no', 'usim_no', 'cpo_name', 'inspection_date'];
        const hasPubFields = PUB_FIELDS.some(k => form[k] !== undefined);
        let pubInsert = null, pubUpdate = null;
        if (hasPubFields && (o.usage_type || '공용') === '공용') {
          if (o.usage_public_id != null) {
            const existing = cache.usage_type_public.find(p => p.id === o.usage_public_id);
            if (existing) {
              const changed = {};
              PUB_FIELDS.forEach(k => { if (form[k] !== undefined) { existing[k] = form[k]; changed[k] = form[k]; } });
              pubUpdate = { id: existing.id, ...changed };
            }
          } else {
            const id = ++pubSeq;
            const row = { id, inspection_date: form.inspection_date || '', station_id: form.station_id || '', charger_no: form.charger_no || '', router_no: form.router_no || '', usim_no: form.usim_no || '', cpo_name: form.cpo_name || '', created: TODAY };
            cache.usage_type_public.push(row);
            o.usage_public_id = id;
            pubInsert = row;
          }
        }

        dbLog('INFO', 'write:tb_charge_infor', `충전기 정보 수정 — id=${order_id}`);
        dbWrite('tb_charge_infor', 'update', async () => {
          await client.from('tb_charge_infor').update(upd).eq('id', order_id);
          if (pubInsert) {
            await client.from('tb_usagetype_public').insert(pubInsert);
            await client.from('tb_charge_infor').update({ usage_public_id: pubInsert.id }).eq('id', order_id);
          } else if (pubUpdate) {
            const { id, ...rest } = pubUpdate;
            await client.from('tb_usagetype_public').update(rest).eq('id', id);
          }
          return { error: null };
        });
        return true;
      },

      // 생산요청 취소 — PENDING 유닛만 완전 삭제(공용이면 tb_usagetype_public 행도 함께 삭제).
      // 배치(tb_sales_order)에 남은 유닛이 0개가 되면 배치 행도 함께 삭제한다(빈 배치를 남기지 않음).
      // 취소 이력(action:'cancel')은 이 함수 호출 전 actions.cancelOrder()에서 먼저 기록한다.
      deleteOrder(order_id) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o || o.status !== 'PENDING') {
          dbLog('WARN', 'write:tb_charge_infor', `충전기 취소 불가 — id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        const batchId = o.order_id;
        cache.orders = cache.orders.filter(x => x.id !== order_id);
        const hadPub = o.usage_public_id != null;
        if (hadPub) cache.usage_type_public = cache.usage_type_public.filter(p => p.id !== o.usage_public_id);
        const batchEmpty = !!batchId && !cache.orders.some(x => x.order_id === batchId);
        if (batchEmpty) cache.batches = cache.batches.filter(b => b.order_id !== batchId);
        dbLog('INFO', 'write:tb_charge_infor', `충전기 취소(삭제) — id=${order_id}${batchEmpty ? ', 배치도 함께 삭제' : ''}`);
        dbWrite('tb_charge_infor', 'delete', async () => {
          if (hadPub) await client.from('tb_usagetype_public').delete().eq('id', o.usage_public_id);
          await client.from('tb_charge_infor').delete().eq('id', order_id);
          if (batchEmpty) await client.from('tb_sales_order').delete().eq('order_id', batchId);
          return { error: null };
        });
        return true;
      },

      // inspection_date(검정일자)는 tb_charge_infor 컬럼이 아니라 tb_usagetype_public(위성 테이블)
      // 소속이므로 분리해서 라우팅한다(updateOrder()의 PUB_FIELDS 처리와 동일한 이유).
      saveProduction(order_id, p) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o) return;
        const { inspection_date, ...chargeFields } = p;
        Object.assign(o, chargeFields);
        let pubInsert = null, pubUpdate = null;
        if (inspection_date !== undefined && (o.usage_type || '공용') === '공용') {
          if (o.usage_public_id != null) {
            const existing = cache.usage_type_public.find(x => x.id === o.usage_public_id);
            if (existing) { existing.inspection_date = inspection_date; pubUpdate = { id: existing.id, inspection_date }; }
          } else {
            const id = ++pubSeq;
            const row = { id, inspection_date, station_id: '', charger_no: '', router_no: '', usim_no: '', cpo_name: '', created: TODAY };
            cache.usage_type_public.push(row);
            o.usage_public_id = id;
            pubInsert = row;
          }
        }
        dbLog('INFO', 'write:tb_charge_infor', `생산 정보 저장 — id=${order_id}`);
        dbWrite('tb_charge_infor', 'update', async () => {
          if (Object.keys(chargeFields).length) await client.from('tb_charge_infor').update(chargeFields).eq('id', order_id);
          if (pubInsert) {
            await client.from('tb_usagetype_public').insert(pubInsert);
            await client.from('tb_charge_infor').update({ usage_public_id: pubInsert.id }).eq('id', order_id);
          } else if (pubUpdate) {
            const { id, ...rest } = pubUpdate;
            await client.from('tb_usagetype_public').update(rest).eq('id', id);
          }
          return { error: null };
        });
      },

      // saveProduction()과 동일한 이유로 inspection_date는 tb_usagetype_public로 분리 라우팅한다.
      completeOrder(order_id, p) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o) return;
        const { inspection_date, ...chargeFields } = p;
        Object.assign(o, chargeFields, { status: 'AWAIT_PICKUP' });
        let pubInsert = null, pubUpdate = null;
        if (inspection_date !== undefined && (o.usage_type || '공용') === '공용') {
          if (o.usage_public_id != null) {
            const existing = cache.usage_type_public.find(x => x.id === o.usage_public_id);
            if (existing) { existing.inspection_date = inspection_date; pubUpdate = { id: existing.id, inspection_date }; }
          } else {
            const id = ++pubSeq;
            const row = { id, inspection_date, station_id: '', charger_no: '', router_no: '', usim_no: '', cpo_name: '', created: TODAY };
            cache.usage_type_public.push(row);
            o.usage_public_id = id;
            pubInsert = row;
          }
        }
        dbLog('INFO', 'write:tb_charge_infor', `생산 완료 — 출하대기 전환, id=${order_id}`);
        dbWrite('tb_charge_infor', 'complete', async () => {
          await client.from('tb_charge_infor').update({ ...chargeFields, status: 'AWAIT_PICKUP' }).eq('id', order_id);
          if (pubInsert) {
            await client.from('tb_usagetype_public').insert(pubInsert);
            await client.from('tb_charge_infor').update({ usage_public_id: pubInsert.id }).eq('id', order_id);
          } else if (pubUpdate) {
            const { id, ...rest } = pubUpdate;
            await client.from('tb_usagetype_public').update(rest).eq('id', id);
          }
          return { error: null };
        });
      },

      shipOrder(order_id) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o || o.status !== 'AWAIT_PICKUP') {
          dbLog('WARN', 'write:tb_charge_infor', `출하 처리 불가 — id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        o.status = 'COMPLETED';
        dbLog('INFO', 'write:tb_charge_infor', `출하 완료 — id=${order_id}`);
        dbWrite('tb_charge_infor', 'ship', () => client.from('tb_charge_infor').update({ status: 'COMPLETED' }).eq('id', order_id));
        return true;
      },

      revertOrder(order_id) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o) return;
        o.status = 'PENDING';
        o.serial_no = '';
        const funcId = o.func_inspection_id;
        const shipId = o.ship_inspection_id;
        o.func_inspection_id = null;
        o.ship_inspection_id = null;
        const shipRow = shipId != null ? cache.ship_inspections.find(x => x.id === shipId) : null;
        const shipPhotoPaths = shipRow
          ? JSON.parse(shipRow.photos || '[]').map(p => p.storage_path).filter(Boolean)
          : [];
        if (funcId != null) cache.func_inspections = cache.func_inspections.filter(x => x.id !== funcId);
        if (shipId != null) cache.ship_inspections = cache.ship_inspections.filter(x => x.id !== shipId);
        dbLog('INFO', 'write:revert', `생산대기로 변경 — serial 초기화·검사 정보 삭제, id=${order_id}`);
        dbWrite('tb_charge_infor', 'revert', async () => {
          await client.from('tb_charge_infor').update({ status: 'PENDING', serial_no: '', func_inspection_id: null, ship_inspection_id: null }).eq('id', order_id);
          if (funcId != null) await client.from('tb_inspection_func').delete().eq('id', funcId);
          if (shipId != null) await client.from('tb_inspection_ship').delete().eq('id', shipId);
          if (shipPhotoPaths.length > 0) {
            try { await client.storage.from('ship-photos').remove(shipPhotoPaths); } catch (_) {}
          }
          return { error: null };
        });
      },

      revertToAwaitPickup(order_id) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o || o.status !== 'COMPLETED') {
          dbLog('WARN', 'write:tb_charge_infor', `AWAIT_PICKUP 복귀 불가 — id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        o.status = 'AWAIT_PICKUP';
        dbLog('INFO', 'write:tb_charge_infor', `출하대기로 변경 — id=${order_id}`);
        dbWrite('tb_charge_infor', 'revertToAwaitPickup', () => client.from('tb_charge_infor').update({ status: 'AWAIT_PICKUP' }).eq('id', order_id));
        return true;
      },

      revertToInProgress(order_id) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o || o.status !== 'COMPLETED') {
          dbLog('WARN', 'write:tb_charge_infor', `IN_PROGRESS 복귀 불가 — id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        o.status = 'IN_PROGRESS';
        dbLog('INFO', 'write:tb_charge_infor', `생산진행중으로 변경 — id=${order_id}`);
        dbWrite('tb_charge_infor', 'revertToInProgress', () => client.from('tb_charge_infor').update({ status: 'IN_PROGRESS' }).eq('id', order_id));
        return true;
      },

      awaitToInProgress(order_id) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o || o.status !== 'AWAIT_PICKUP') {
          dbLog('WARN', 'write:tb_charge_infor', `작업중 복귀 불가 — id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        o.status = 'IN_PROGRESS';
        dbLog('INFO', 'write:tb_charge_infor', `출하대기→작업중 변경 — id=${order_id}`);
        dbWrite('tb_charge_infor', 'awaitToInProgress', () => client.from('tb_charge_infor').update({ status: 'IN_PROGRESS' }).eq('id', order_id));
        return true;
      },

      startProduction(order_id) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o || o.status !== 'PENDING') {
          dbLog('WARN', 'write:tb_charge_infor', `생산 시작 불가 — id=${order_id}, status=${o?.status ?? '없음'}`);
          return false;
        }
        o.status = 'IN_PROGRESS';
        dbLog('INFO', 'write:tb_charge_infor', `생산 시작 — id=${order_id}`);
        dbWrite('tb_charge_infor', 'start', () => client.from('tb_charge_infor').update({ status: 'IN_PROGRESS' }).eq('id', order_id));
        // 생산요청 등록 시점에 이미 채번되어 있으면 재채번하지 않는다(되돌리기 등으로 초기화된 경우에만 여기서 새로 채번).
        if (!o.serial_no) {
          const serial = this.generateSerialSuggestion(o.model_name, o.usage_type, TODAY, order_id);
          if (serial) this.saveProduction(order_id, { serial_no: serial });
        }
        return true;
      },

      serialExists(serial, excludeOrderId) {
        return cache.orders.some(o => o.serial_no === serial && o.id !== excludeOrderId);
      },

      // 모델·용도·생산일자로 다음 사용 가능한 시리얼번호를 추천(중복 자동 회피)
      generateSerialSuggestion(model_name, usage_type, prodDateISO, excludeOrderId) {
        const entry = window.findModelInfo ? window.findModelInfo(model_name) : null;
        const modelCode = entry ? entry.model : model_name;
        const codes = SERIAL_MODEL_CODES[modelCode];
        if (!codes) return '';
        const dateCode = makeSerialDateCode(prodDateISO || TODAY);
        const base = `${codes[0]}-${codes[1]}-${dateCode}`;
        let idx = 1, candidate;
        do {
          candidate = `${base}-${String(idx).padStart(4, '0')}`;
          idx++;
        } while (this.serialExists(candidate, excludeOrderId) && idx <= 9999);
        return candidate;
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

      getAddresses(customer_name) {
        const list = customer_name ? cache.customer_addresses.filter(a => a.customer_name === customer_name) : [...cache.customer_addresses];
        return list.sort((a, b) => (b.is_primary || 0) - (a.is_primary || 0) || (a.label || '').localeCompare(b.label || ''));
      },

      addAddress(a) {
        if (a.is_primary) cache.customer_addresses.forEach(x => { if (x.customer_name === a.customer_name) x.is_primary = 0; });
        const id = ++addrSeq;
        const row = { address_id: id, customer_name: a.customer_name, label: a.label, address: a.address || '', is_primary: a.is_primary ? 1 : 0 };
        cache.customer_addresses.push(row);
        dbLog('INFO', 'write:tb_customer_address', `납품장소 추가 — 고객=${a.customer_name}, 장소=${a.label}`);
        dbWrite('tb_customer_address', 'insert', async () => {
          if (a.is_primary) await client.from('tb_customer_address').update({ is_primary: 0 }).eq('customer_name', a.customer_name);
          return client.from('tb_customer_address').insert({ customer_name: a.customer_name, label: a.label, address: a.address || '', is_primary: a.is_primary ? 1 : 0 });
        });
        return id;
      },

      updateAddress(id, a) {
        const row = cache.customer_addresses.find(x => x.address_id === id);
        if (!row) return;
        if (a.is_primary) cache.customer_addresses.forEach(x => { if (x.customer_name === row.customer_name) x.is_primary = 0; });
        const oldLabel = row.label;
        const upd = { address: a.address || '', is_primary: a.is_primary ? 1 : 0 };
        Object.assign(row, { label: a.label, ...upd });
        dbLog('INFO', 'write:tb_customer_address', `납품장소 수정 — 고객=${row.customer_name}, 장소=${oldLabel}→${a.label}`);
        dbWrite('tb_customer_address', 'update', async () => {
          if (a.is_primary) await client.from('tb_customer_address').update({ is_primary: 0 }).eq('customer_name', row.customer_name);
          if (a.label !== oldLabel) {
            await client.from('tb_customer_address').delete().eq('customer_name', row.customer_name).eq('label', oldLabel);
            return client.from('tb_customer_address').insert({ customer_name: row.customer_name, label: a.label, ...upd });
          }
          return client.from('tb_customer_address').update(upd).eq('customer_name', row.customer_name).eq('label', oldLabel);
        });
      },

      deleteAddress(id) {
        const row = cache.customer_addresses.find(x => x.address_id === id);
        if (!row) return;
        cache.customer_addresses = cache.customer_addresses.filter(x => x.address_id !== id);
        dbLog('INFO', 'write:tb_customer_address', `납품장소 삭제 — 고객=${row.customer_name}, 장소=${row.label}`);
        dbWrite('tb_customer_address', 'delete', () => client.from('tb_customer_address').delete().eq('customer_name', row.customer_name).eq('label', row.label));
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
        const row = { history_id: id, charge_id: order_id, serial_no: serial_no || '', changed_at: changedAt, changed_by: changedBy, action: action || 'update', changed_fields: JSON.stringify(fields) };
        cache.history.push(row);
        dbLog('INFO', 'write:tb_order_history', `이력 추가 — charge_id=${order_id}, action=${action || 'update'}, by=${changedBy}`);
        dbWrite('tb_order_history', 'insert', () => client.from('tb_order_history').insert(row));
      },

      getHistory(order_id) {
        return [...cache.history.filter(h => h.charge_id === order_id)]
          .sort((a, b) => (b.changed_at || '').localeCompare(a.changed_at || ''))
          .map(r => ({ ...r, changed_fields: JSON.parse(r.changed_fields || '[]') }));
      },

      // 대시보드 "출하완료" 주간/월간 집계용 — action:'ship' 이력만 전역 조회 (오더별이 아님)
      getShipHistory() {
        return cache.history.filter(h => h.action === 'ship');
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

      addAsReception(form, by) {
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
        // 최초 이력('' → 접수대기)은 reception_id가 이 행을 FK로 참조하므로,
        // tb_as_reception insert가 실제로 커밋된 뒤에 이어서 실행되어야 한다.
        // 두 insert를 별개의 dbWrite로 분리하면 네트워크 순서가 뒤바뀌어
        // tb_as_log가 존재하지 않는 reception_id를 참조해 FK 위반이 날 수 있다.
        const logId = ++asLogSeq;
        const logRow = { id: logId, reception_id: id, changed_at: now, changed_by: by || '', from_status: '', to_status: '접수대기', memo: '접수 등록' };
        cache.as_logs.push(logRow);
        dbLog('INFO', 'write:tb_as_reception', `AS 접수 등록 — id=${id}, no=${reception_no}`);
        dbWrite('tb_as_reception', 'insert', async () => {
          const { error } = await client.from('tb_as_reception').insert(row);
          if (error) return { error };
          return client.from('tb_as_log').insert(logRow);
        });
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

      addMasterCustomer(name, address) {
        if (cache.customers.find(c => c.name === name))
          return { ok: false, msg: '이미 등록된 고객사명입니다' };
        const row = { name, address: address || '' };
        cache.customers.push(row);
        dbLog('INFO', 'write:tb_customer', `고객사 추가 — ${name}`);
        dbWrite('tb_customer', 'insert', () => client.from('tb_customer').insert(row));
        return { ok: true };
      },

      updateMasterCustomer(idx, name, address) {
        const c = cache.customers[idx];
        if (!c) return { ok: false, msg: '고객사를 찾을 수 없습니다' };
        const dupName = cache.customers.findIndex(x => x.name === name);
        if (dupName !== -1 && dupName !== idx) return { ok: false, msg: '이미 등록된 고객사명입니다' };
        const oldName = c.name;
        cache.customers[idx] = { name, address: address || '' };
        dbLog('INFO', 'write:tb_customer', `고객사 수정 — ${oldName} → ${name}`);
        dbWrite('tb_customer', 'update', () => client.from('tb_customer').update({ name, address: address || '' }).eq('name', oldName));
        return { ok: true };
      },

      deleteMasterCustomer(idx) {
        const c = cache.customers[idx];
        if (!c) return;
        const name = c.name;
        cache.customers.splice(idx, 1);
        dbLog('INFO', 'write:tb_customer', `고객사 삭제 — ${name}`);
        dbWrite('tb_customer', 'delete', () => client.from('tb_customer').delete().eq('name', name));
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

      // ── 충전기 정보 (tb_charge_infor) — "실물로 존재가 확정된 충전기"만 대상 ──
      // AS접수 시리얼 조회 등에서 PENDING/IN_PROGRESS 유닛까지 잡히면 안 되므로
      // _isRegisteredCharger()로 COMPLETED이거나 오더 미연결(order_id=null, 수동등록)인 것만 필터링.
      loadChargepoints() {
        return cache.orders.filter(o => this._isRegisteredCharger(o));
      },

      getChargepointBySerial(serial_no) {
        const q = String(serial_no || '').trim().toUpperCase();
        if (!q) return null;
        return cache.orders.find(o => this._isRegisteredCharger(o) && String(o.serial_no || '').trim().toUpperCase() === q) || null;
      },

      addChargepoint(data) {
        const serial_no = String(data.serial_no || '').trim();
        if (!serial_no) return { ok: false, msg: '시리얼번호를 입력하세요' };
        if (this.getChargepointBySerial(serial_no))
          return { ok: false, msg: '이미 등록된 시리얼번호입니다' };
        const id = 'CP-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const row = {
          id, order_id: null,
          model_name:      data.model_name      || '',
          usage_type:      data.usage_type      || '',
          serial_no,
          status:           'COMPLETED',
          usage_public_id: null, func_inspection_id: null, ship_inspection_id: null,
          sw_version: '', fw_version: '', cable_length: null,
          prod_date: '', delivery_date: '', ship_from_address: '',
          install_address: data.install_address || '',
          customer_name: '', customer_manager: '', field_manager_phone: '',
          created:         data.created         || '',
        };
        cache.orders.push(row);
        dbLog('INFO', 'write:tb_charge_infor', `충전기 정보 수동 등록 — serial_no=${serial_no}`);
        dbWrite('tb_charge_infor', 'insert', () => client.from('tb_charge_infor').insert(row));
        return { ok: true };
      },

      getFuncInspection(order_id) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o || o.func_inspection_id == null) return null;
        const r = cache.func_inspections.find(x => x.id === o.func_inspection_id);
        if (!r) return null;
        return { insp_date: r.insp_date, inspector: r.inspector, checks: JSON.parse(r.checks || '{}'), notes: r.notes || '', saved_at: r.saved_at };
      },

      saveFuncInspection(order_id, data) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o) return;
        const checks = JSON.stringify(data.checks || {});
        const payload = { insp_date: data.insp_date, inspector: data.inspector, checks, notes: data.notes || '', saved_at: data.saved_at };
        if (o.func_inspection_id != null) {
          const existing = cache.func_inspections.find(x => x.id === o.func_inspection_id);
          if (existing) Object.assign(existing, payload);
          dbLog('INFO', 'write:tb_inspection_func', `기능 검사 성적서 저장 — charge_id=${order_id}`);
          dbWrite('tb_inspection_func', 'update', () => client.from('tb_inspection_func').update(payload).eq('id', o.func_inspection_id));
        } else {
          const id = ++funcInspSeq;
          cache.func_inspections.push({ id, ...payload });
          o.func_inspection_id = id;
          dbLog('INFO', 'write:tb_inspection_func', `기능 검사 성적서 신규 저장 — charge_id=${order_id}`);
          dbWrite('tb_inspection_func', 'insert', async () => {
            await client.from('tb_inspection_func').insert({ id, ...payload });
            return client.from('tb_charge_infor').update({ func_inspection_id: id }).eq('id', order_id);
          });
        }
      },

      deleteFuncInspection(order_id) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o || o.func_inspection_id == null) return;
        const id = o.func_inspection_id;
        cache.func_inspections = cache.func_inspections.filter(x => x.id !== id);
        o.func_inspection_id = null;
        dbLog('INFO', 'write:tb_inspection_func', `기능 검사 성적서 삭제 — charge_id=${order_id}`);
        dbWrite('tb_inspection_func', 'delete', async () => {
          await client.from('tb_charge_infor').update({ func_inspection_id: null }).eq('id', order_id);
          return client.from('tb_inspection_func').delete().eq('id', id);
        });
      },

      getShipInspectionDB(order_id) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o || o.ship_inspection_id == null) return null;
        const r = cache.ship_inspections.find(x => x.id === o.ship_inspection_id);
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
        const o = cache.orders.find(x => x.id === order_id);
        if (!o) return;
        if (data == null) {
          if (o.ship_inspection_id == null) return;
          const id = o.ship_inspection_id;
          cache.ship_inspections = cache.ship_inspections.filter(x => x.id !== id);
          o.ship_inspection_id = null;
          dbLog('INFO', 'write:tb_inspection_ship', `출하 검사 성적서 삭제 — charge_id=${order_id}`);
          dbWrite('tb_inspection_ship', 'delete', async () => {
            await client.from('tb_charge_infor').update({ ship_inspection_id: null }).eq('id', order_id);
            return client.from('tb_inspection_ship').delete().eq('id', id);
          });
          return;
        }
        const checks = JSON.stringify(data.checks || {});
        const payload = { insp_date: data.insp_date, inspector: data.inspector, checks, notes: data.notes || '', saved_at: data.saved_at };
        if (o.ship_inspection_id != null) {
          const existing = cache.ship_inspections.find(x => x.id === o.ship_inspection_id);
          if (existing) Object.assign(existing, payload); // photos 필드는 건드리지 않음 — addShipPhoto/deleteShipPhoto로만 변경
          dbLog('INFO', 'write:tb_inspection_ship', `출하 검사 성적서 저장 — charge_id=${order_id}`);
          dbWrite('tb_inspection_ship', 'update', () => client.from('tb_inspection_ship').update(payload).eq('id', o.ship_inspection_id));
        } else {
          const id = ++shipInspSeq;
          cache.ship_inspections.push({ id, ...payload, photos: '[]' });
          o.ship_inspection_id = id;
          dbLog('INFO', 'write:tb_inspection_ship', `출하 검사 성적서 신규 저장 — charge_id=${order_id}`);
          dbWrite('tb_inspection_ship', 'insert', async () => {
            await client.from('tb_inspection_ship').insert({ id, ...payload });
            return client.from('tb_charge_infor').update({ ship_inspection_id: id }).eq('id', order_id);
          });
        }
      },

      getShipPhotos(order_id) {
        const o = cache.orders.find(x => x.id === order_id);
        if (!o || o.ship_inspection_id == null) return [];
        const r = cache.ship_inspections.find(x => x.id === o.ship_inspection_id);
        if (!r) return [];
        try { return JSON.parse(r.photos || '[]'); } catch (_) { return []; }
      },

      async addShipPhoto(order_id, file, by) {
        const o = cache.orders.find(x => x.id === order_id);
        const existing = o && o.ship_inspection_id != null ? cache.ship_inspections.find(x => x.id === o.ship_inspection_id) : null;
        if (!existing) throw new Error('출하검사 성적서를 먼저 저장하세요');
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
        const storagePath = `charge/${order_id}/${Date.now()}${ext}`;
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
        dbLog('INFO', 'write:tb_inspection_ship', `출하 사진 추가 — charge_id=${order_id}, path=${storagePath}`);
        const photosJson = existing.photos;
        dbWrite('tb_inspection_ship', 'update-photos', () =>
          client.from('tb_inspection_ship').update({ photos: photosJson }).eq('id', existing.id)
        );
        return photoEntry;
      },

      async deleteShipPhoto(order_id, storagePath) {
        const o = cache.orders.find(x => x.id === order_id);
        const existing = o && o.ship_inspection_id != null ? cache.ship_inspections.find(x => x.id === o.ship_inspection_id) : null;
        if (!existing) return;
        const currentPhotos = JSON.parse(existing.photos || '[]');
        existing.photos = JSON.stringify(currentPhotos.filter(p => p.storage_path !== storagePath));
        dbLog('INFO', 'write:tb_inspection_ship', `출하 사진 삭제 — charge_id=${order_id}, path=${storagePath}`);
        if (storagePath) {
          try { await client.storage.from('ship-photos').remove([storagePath]); } catch (_) {}
        }
        const photosJson = existing.photos;
        dbWrite('tb_inspection_ship', 'update-photos', () =>
          client.from('tb_inspection_ship').update({ photos: photosJson }).eq('id', existing.id)
        );
      },

    };
  }

  // ============================================================
  // 실시간 동기화 — 다른 사용자의 변경을 postgres_changes로 수신해
  // 전체 재조회 후 notify()로 화면을 갱신한다. 테이블별 patch 대신
  // loadAll() 재사용 — loadOrders()의 배치/위성 테이블 조인 로직을
  // 중복 구현하지 않기 위함(여러 이벤트가 몰리면 400ms 디바운스로 묶음).
  // ============================================================
  function startRealtimeSync(client, backend) {
    const TABLES = [
      'tb_charge_infor', 'tb_sales_order', 'tb_usagetype_public',
      'tb_customer_manager', 'tb_customer_address', 'tb_users',
      'tb_as_reception', 'tb_as_log', 'tb_as_photo',
      'tb_inspection_func', 'tb_inspection_ship', 'tb_order_history',
    ];
    let timer = null;
    const scheduleReload = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          await backend.loadAll();
          window.notify?.();
          dbLog('INFO', 'realtime', '다른 사용자 변경 감지 → 재조회 완료');
        } catch (e) {
          dbLog('ERROR', 'realtime', '재조회 실패 — ' + e.message);
        }
      }, 400);
    };
    const channel = client.channel('pmdb-sync');
    TABLES.forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleReload);
    });
    channel.subscribe();
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
          const { data, error } = await client.from('tb_customer').insert(SEED_MASTER_CUSTOMERS).select();
          if (error) dbLog('WARN', 'init', '초기 고객사 삽입 실패 — ' + error.message);
          else {
            backend.cache.customers = (data || []).map(c => ({ name: c.name, address: c.address || '' }));
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
      startRealtimeSync(client, backend);
      dbLog('SUCCESS', 'init', `PMDB 준비 완료 (총 ${Date.now() - t0}ms)`);
      window.updateBootStatus?.('준비 완료 중…');
      return this;
    },

    loadOrders()             { return this.backend.loadOrders(); },
    addOrderBatch(f)         { return this.backend.addOrderBatch(f); },
    updateOrder(id, f)       { return this.backend.updateOrder(id, f); },
    deleteOrder(id)          { return this.backend.deleteOrder(id); },
    saveProduction(id, p)    { return this.backend.saveProduction(id, p); },
    completeOrder(id, p)     { return this.backend.completeOrder(id, p); },
    shipOrder(id)            { return this.backend.shipOrder(id); },
    revertOrder(id)          { return this.backend.revertOrder(id); },
    revertToAwaitPickup(id)  { return this.backend.revertToAwaitPickup(id); },
    revertToInProgress(id)   { return this.backend.revertToInProgress(id); },
    awaitToInProgress(id)    { return this.backend.awaitToInProgress(id); },
    startProduction(id)      { return this.backend.startProduction(id); },
    serialExists(s, excl)    { return this.backend.serialExists(s, excl); },
    generateSerialSuggestion(model, usage, prodDate, excl) { return this.backend.generateSerialSuggestion(model, usage, prodDate, excl); },
    getManagers(c)           { return this.backend.getManagers(c); },
    addManager(m)            { return this.backend.addManager(m); },
    updateManager(id, m)     { return this.backend.updateManager(id, m); },
    deleteManager(id)        { return this.backend.deleteManager(id); },
    getAddresses(c)          { return this.backend.getAddresses(c); },
    addAddress(a)            { return this.backend.addAddress(a); },
    updateAddress(id, a)     { return this.backend.updateAddress(id, a); },
    deleteAddress(id)        { return this.backend.deleteAddress(id); },
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
    getShipHistory()         { return this.backend.getShipHistory(); },
    getAsHistory(orderId)        { return this.backend.getAsHistory(orderId); },
    addAsRecord(record)          { return this.backend.addAsRecord(record); },
    deleteAsRecord(id)           { return this.backend.deleteAsRecord(id); },
    loadAsReceptions()           { return this.backend.loadAsReceptions(); },
    getAsReception(id)           { return this.backend.getAsReception(id); },
    addAsReception(form, by)     { return this.backend.addAsReception(form, by); },
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
    loadChargepoints()                { return this.backend.loadChargepoints(); },
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
