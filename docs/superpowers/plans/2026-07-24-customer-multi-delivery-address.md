# 고객사 다중 납품장소 지원 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 생산완료(`SalesCompletionModal`) 화면에서 고객사별로 여러 납품장소를 등록·재사용할 수 있게 한다.

**Architecture:** 발주처 담당자(`tb_customer_manager`) 기능을 구현할 때 쓴 패턴(별도 마스터 테이블 + 복합키→로컬id 캐싱 + "관리" 모달 + ComboField/제안칩)을 새 테이블 `tb_customer_address`에 그대로 복제한다. 기존 `tb_customer.address`(고객사당 주소 1개)는 손대지 않는다.

**Tech Stack:** 바닐라 React(전역 스코프, Babel Standalone 브라우저 트랜스파일), Supabase(Postgres + supabase-js), 빌드 스텝 없음.

## Global Constraints

- 빌드 스텝 없음 — 런타임 오류가 컴파일 타임에 잡히지 않으므로 모든 변경 후 `npm test` + grep 체크를 반드시 수행한다 (CLAUDE.md 작업 절차).
- 새 `.jsx` 파일을 추가하지 않는다 — 기존 파일(`db.js`, `production-request-modal.jsx`, `production-waiting.jsx`)에만 추가한다. 신규 `<script>` 로드 순서 변경 없음.
- 신규 컴포넌트는 기존 훅 별칭을 그대로 사용한다: `production-request-modal.jsx` → `useStateSI`/`useEffectSI`. 별칭 없는 `useState` 직접 사용 금지.
- 뷰 컴포넌트에서 `supabase.from(...)` 직접 호출 금지 — 반드시 `window.PMDB.*` 경유.
- CSS는 `styles.css`의 기존 클래스(`mgr-field`, `mgr-list`, `mgr-row`, `mgr-edit`, `combo__item`, `emptystate`, `badge` 등)만 재사용한다 — 신규 클래스/인라인 대량 스타일 금지. (담당자 관리 모달이 이미 이 클래스들을 쓰고 있으므로 이번 작업은 CSS 변경이 전혀 없다.)
- 이 코드베이스에는 컴포넌트 단위 자동 테스트 프레임워크가 없다(`tests/role-permissions.test.js` 하나뿐, 정적 파싱 방식). 따라서 각 태스크의 검증은 CLAUDE.md에 정의된 실제 검증 절차(`npm test`, 지정된 `grep` 커맨드, 브라우저 수동 확인)를 따른다 — pytest 스타일 단위 테스트를 인위적으로 만들지 않는다.
- DB 스키마 변경(신규 테이블 생성)은 Supabase에 실제 반영되기 전까지 앱이 깨지지 않아야 한다 — `tb_customer_manager` 이외의 "부속 테이블" 로딩과 동일하게 `Promise.allSettled`로 감싸 테이블 부재 시에도 앱이 정상 동작하게 한다.
- Supabase SQL 에디터에서 마이그레이션 SQL을 실제로 실행하는 것은 **사용자가 직접 수행**한다(기존 프로젝트 관례, CLAUDE.md "DB 초기화 및 마이그레이션" 참고) — 이 플랜의 어떤 태스크도 라이브 Supabase 프로젝트에 자동으로 DDL을 적용하지 않는다.

---

### Task 1: DB 스키마 — `tb_customer_address` 테이블 추가

**Files:**
- Modify: `seed.sql:54-61` (신규 설치용 전체 스크립트)
- Modify: `seed.sql:302-304` (RLS 정책 블록)
- Modify: `seed.sql:404-413` (시드 데이터 블록)
- Modify: `supabase-schema.sql:58-65` (기존 운영 DB용 마이그레이션 전용 섹션)

**Interfaces:**
- Produces: Postgres 테이블 `tb_customer_address(customer_name TEXT, label TEXT, address TEXT, is_primary INTEGER, PRIMARY KEY(customer_name, label))` — Task 2/3의 `db.js`가 이 컬럼명을 그대로 참조한다.

- [ ] **Step 1: `seed.sql`에 테이블 정의 추가**

`seed.sql:54-61`의 `tb_customer_manager` 테이블 정의 바로 아래(62번째 줄, 빈 줄 다음)에 삽입:

```sql
-- 고객사 납품장소 (복합 PK: customer_name + label) — tb_customer_manager와 동일한 패턴
CREATE TABLE IF NOT EXISTS tb_customer_address (
  customer_name TEXT    NOT NULL,
  label         TEXT    NOT NULL,
  address       TEXT    NOT NULL DEFAULT '',
  is_primary    INTEGER DEFAULT 0,
  PRIMARY KEY (customer_name, label)
);
```

- [ ] **Step 2: `seed.sql`에 RLS 정책 추가**

`seed.sql:302-304`(`tb_customer_manager`의 RLS 정책 블록) 바로 다음에 삽입:

```sql
ALTER TABLE tb_customer_address ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_customer_address_anon_all ON tb_customer_address;
CREATE POLICY tb_customer_address_anon_all ON tb_customer_address FOR ALL TO anon USING (true) WITH CHECK (true);
```

- [ ] **Step 3: `seed.sql`에 샘플 시드 데이터 추가**

`seed.sql:404-413`(`8-3. 고객사 담당자` INSERT 블록) 바로 다음에 새 섹션으로 삽입:

```sql
-- 8-4. 고객사 납품장소
INSERT INTO tb_customer_address (customer_name, label, address, is_primary) VALUES
  ('카스',     '본사',    '', 1),
  ('카스',     '물류창고', '', 0),
  ('마이크로', '본사',    '', 1)
ON CONFLICT (customer_name, label) DO NOTHING;
```

- [ ] **Step 4: `supabase-schema.sql` 마이그레이션 전용 섹션에 동일 DDL 추가**

`supabase-schema.sql:58-65`(`tb_master_cpo` 블록) 바로 다음에 삽입 (기존 운영 DB에 컬럼·테이블만 추가하는 용도이므로 시드 데이터는 넣지 않는다):

```sql
-- 고객사 납품장소 (복합 PK: customer_name + label)
CREATE TABLE IF NOT EXISTS tb_customer_address (
  customer_name TEXT    NOT NULL,
  label         TEXT    NOT NULL,
  address       TEXT    NOT NULL DEFAULT '',
  is_primary    INTEGER DEFAULT 0,
  PRIMARY KEY (customer_name, label)
);
ALTER TABLE tb_customer_address ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_customer_address_anon_all ON tb_customer_address;
CREATE POLICY tb_customer_address_anon_all ON tb_customer_address FOR ALL TO anon USING (true) WITH CHECK (true);
```

- [ ] **Step 5: 검증**

SQL 문법 확인 — 새로 추가한 4개 블록을 `tb_customer_manager` 관련 블록과 나란히 눈으로 대조해 컬럼명·PK·정책명이 오타 없이 일치하는지 확인한다(자동화된 SQL 테스트 없음). 이 SQL은 아직 Supabase에 적용하지 않는다 — Task 6에서 사용자가 직접 실행한다.

- [ ] **Step 6: Commit**

```bash
git add seed.sql supabase-schema.sql
git commit -m "feat: tb_customer_address 테이블 스키마 추가 (고객사 다중 납품장소)"
```

---

### Task 2: `db.js` — `tb_customer_address` 캐시 로딩

**Files:**
- Modify: `db.js:177` (cache 객체 초기화)
- Modify: `db.js:178-185` (시퀀스 카운터 선언부)
- Modify: `db.js:274-277` (부속 테이블 병렬 로드 `Promise.allSettled` 블록)

**Interfaces:**
- Consumes: Task 1에서 정의한 `tb_customer_address(customer_name, label, address, is_primary)` 컬럼.
- Produces: `cache.customer_addresses` — `{ address_id, customer_name, label, address, is_primary }[]` 배열. Task 3의 백엔드 메서드가 이 배열을 조작한다.

- [ ] **Step 1: cache 객체에 배열 추가**

`db.js:177`을 다음과 같이 수정:

```js
    const cache = { orders: [], batches: [], managers: [], users: [], history: [], customers: [], cpos: [], program_versions: [], models: [], as_receptions: [], as_logs: [], as_photos: [], func_inspections: [], ship_inspections: [], usage_type_public: [], customer_addresses: [] };
```

- [ ] **Step 2: 시퀀스 카운터 추가**

`db.js:178`(`let mgrSeq = 0;`) 바로 다음 줄에 추가:

```js
    let addrSeq = 0;
```

- [ ] **Step 3: 부속 테이블 병렬 로드 블록에 추가**

`db.js:274-277`의 `tb_usagetype_public` 로드 블록(`Promise.allSettled([...])` 배열의 마지막 항목) 바로 다음에 새 항목을 추가한다. 기존:

```js
          client.from('tb_usagetype_public').select('*').then(({ data, error }) => {
            if (!error) { cache.usage_type_public = data || []; pubSeq = cache.usage_type_public.reduce((mx, x) => Math.max(mx, x.id || 0), 0); }
            else dbLog('WARN', 'loadAll', 'tb_usagetype_public 조회 실패 — ' + error.message);
          }).catch(e => dbLog('WARN', 'loadAll', 'tb_usagetype_public 로드 오류 — ' + e.message)),
        ]);
```

다음으로 교체(새 항목을 배열 마지막에 추가):

```js
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
```

- [ ] **Step 4: 검증**

```bash
node -c "d:/3_Project/Egtronics COMS Web/db.js"
```

Expected: 문법 오류 없이 종료(exit code 0). `node -c`는 구문 검사만 하며 `window`/`fetch` 등 브라우저 전역이 없어도 통과한다.

- [ ] **Step 5: Commit**

```bash
git add db.js
git commit -m "feat: tb_customer_address 캐시 로딩 추가"
```

---

### Task 3: `db.js` — CRUD 백엔드 메서드 + PMDB 래퍼

**Files:**
- Modify: `db.js:714-720` (담당자 CRUD 메서드 블록 바로 다음에 추가)
- Modify: `db.js:1395` (PMDB 래퍼 — `deleteManager` 줄 바로 다음에 추가)

**Interfaces:**
- Consumes: Task 2의 `cache.customer_addresses`, `addrSeq` (같은 클로저 스코프).
- Produces: `PMDB.getAddresses(customer_name) → array`, `PMDB.addAddress({customer_name,label,address,is_primary}) → address_id`, `PMDB.updateAddress(address_id, {label,address,is_primary})`, `PMDB.deleteAddress(address_id)`. Task 4/5의 UI 코드가 이 4개 함수 시그니처를 그대로 호출한다.

- [ ] **Step 1: 백엔드 CRUD 메서드 추가**

`db.js:714-720`의 `deleteManager` 메서드(담당자 CRUD 블록의 마지막) 바로 다음, `async authenticate` 메서드 앞에 삽입:

```js
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
```

- [ ] **Step 2: PMDB 래퍼에 노출**

`db.js:1395`(`deleteManager(id)        { return this.backend.deleteManager(id); },`) 바로 다음 줄에 삽입:

```js
    getAddresses(c)          { return this.backend.getAddresses(c); },
    addAddress(a)            { return this.backend.addAddress(a); },
    updateAddress(id, a)     { return this.backend.updateAddress(id, a); },
    deleteAddress(id)        { return this.backend.deleteAddress(id); },
```

- [ ] **Step 3: 검증**

```bash
node -c "d:/3_Project/Egtronics COMS Web/db.js"
```

Expected: exit code 0 (구문 오류 없음).

```bash
grep -n "supabase\.from" "d:/3_Project/Egtronics COMS Web"/*.jsx
```

Expected: 결과 없음(db.js는 `.jsx`가 아니므로 애초에 이 grep 대상이 아니고, 뷰 파일에서 직접 호출이 없어야 함 — Task 4/5 이후에도 재확인).

- [ ] **Step 4: Commit**

```bash
git add db.js
git commit -m "feat: tb_customer_address CRUD API 추가 (getAddresses/addAddress/updateAddress/deleteAddress)"
```

---

### Task 4: `production-request-modal.jsx` — `AddressManageModal` 컴포넌트

**Files:**
- Modify: `production-request-modal.jsx:652` (`ManagerManageModal` 정의 끝 바로 다음에 새 함수 추가)

**Interfaces:**
- Consumes: `window.PMDB.getAddresses/addAddress/updateAddress/deleteAddress` (Task 3), `AddressField`(같은 파일 84번 줄에 이미 정의된 우편번호 검색 컴포넌트), `Icon`(icons.jsx, 전역), `useStateSI/useEffectSI`(파일 상단 3번째 줄에 이미 별칭 정의됨), `window.useLockScroll`/`window.useModalKeyboard`(전역 헬퍼, 이미 사용 중).
- Produces: 전역 함수 `AddressManageModal({ customerName, onClose, onChanged })` — Task 5의 `production-waiting.jsx`가 이 컴포넌트를 렌더링한다. `onChanged(label|null)` 콜백: 저장/대표지정 시 `label` 문자열, 삭제 시 `null`을 전달한다(= `ManagerManageModal`의 `onChanged(name|null)`과 동일한 계약).

- [ ] **Step 1: `ManagerManageModal` 바로 다음에 `AddressManageModal` 추가**

`production-request-modal.jsx:652`(`ManagerManageModal` 함수를 닫는 `}` 다음 줄, `OrderHistoryModal` 정의 앞)에 삽입:

```jsx
/* ────────── 고객사 납품장소 관리 모달 (DB: tb_customer_address) ────────── */
function AddressManageModal({ customerName, onClose, onChanged }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const [list, setList] = useStateSI([]);
  const [draft, setDraft] = useStateSI(null); // { address_id?, label, address, is_primary }
  const [err, setErr] = useStateSI('');

  const reload = () => setList(window.PMDB.getAddresses(customerName));
  useEffectSI(() => { reload(); }, [customerName]);

  const startAdd = () => { setErr(''); setDraft({ label: '', address: '', is_primary: list.length === 0 }); };
  const startEdit = (a) => { setErr(''); setDraft({ ...a }); };

  const saveDraft = () => {
    if (!draft.label.trim()) { setErr('장소명을 입력하세요'); return; }
    if (!draft.address.trim()) { setErr('주소를 입력하세요'); return; }
    if (draft.address_id) {
      window.PMDB.updateAddress(draft.address_id, draft);
    } else {
      window.PMDB.addAddress({ ...draft, customer_name: customerName });
    }
    reload();
    onChanged && onChanged(draft.label);
    setDraft(null);
  };

  const remove = (a) => {
    window.PMDB.deleteAddress(a.address_id);
    reload();
    onChanged && onChanged(null);
  };

  const makePrimary = (a) => {
    window.PMDB.updateAddress(a.address_id, { ...a, is_primary: 1 });
    reload();
    onChanged && onChanged(a.label);
  };

  return (
    <div className="modal-backdrop" ref={dialogRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-customer-addr-title" style={{ width: 520, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h2 id="modal-customer-addr-title" className="modal__title">납품장소 관리</h2>
          <p className="modal__sub"><strong style={{ color: 'var(--ink-1)' }}>{customerName}</strong></p>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="mgr-list">
            {list.length === 0 && (
              <div className="emptystate" style={{ padding: '20px 0' }}>
                <div className="emptystate__title">등록된 납품장소가 없습니다</div>
                <div className="emptystate__sub">아래 ‘납품장소 추가’로 등록하세요</div>
              </div>
            )}
            {list.map(a => (
              <div key={a.address_id} className="mgr-row">
                <div className="mgr-row__main">
                  <div className="mgr-row__name">
                    {a.label}
                    {!!a.is_primary && <span className="badge badge--info" style={{ marginLeft: 6 }}>대표</span>}
                  </div>
                  <div className="mgr-row__meta">
                    <span>{a.address || '—'}</span>
                  </div>
                </div>
                <div className="mgr-row__actions">
                  {!a.is_primary && <button className="btn btn--ghost btn--sm" onClick={() => makePrimary(a)}>대표 지정</button>}
                  <button className="btn btn--secondary btn--sm" onClick={() => startEdit(a)}>수정</button>
                  <button className="btn btn--ghost btn--sm btn--icon" aria-label="삭제" onClick={() => remove(a)}><Icon name="x" size={14}/></button>
                </div>
              </div>
            ))}
          </div>

          {draft ? (
            <div className="mgr-edit">
              <div className="mgr-edit__title">{draft.address_id ? '납품장소 수정' : '납품장소 추가'}</div>
              <div className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="si-addr-label">장소명 <span className="field__req">*</span></label>
                  <input id="si-addr-label" className="input" autoFocus value={draft.label}
                         onChange={(e) => setDraft(d => ({ ...d, label: e.target.value }))}/>
                </div>
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <label className="field__label" htmlFor="si-addr-address">주소 <span className="field__req">*</span></label>
                <AddressField id="si-addr-address" value={draft.address}
                  onChange={(v) => setDraft(d => ({ ...d, address: v }))}/>
              </div>
              <label className="mgr-edit__primary">
                <input type="checkbox" checked={!!draft.is_primary}
                       onChange={(e) => setDraft(d => ({ ...d, is_primary: e.target.checked }))}/>
                대표 납품장소로 지정
              </label>
              {err && <div role="alert" className="field__err"><Icon name="alert" size={12}/> {err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn btn--secondary btn--sm" onClick={() => { setDraft(null); setErr(''); }}>취소</button>
                <button className="btn btn--primary btn--sm" onClick={saveDraft}><Icon name="check" size={13}/> 저장</button>
              </div>
            </div>
          ) : (
            <button className="btn btn--secondary" style={{ alignSelf: 'flex-start' }} onClick={startAdd}>
              <Icon name="plus" size={13}/> 납품장소 추가
            </button>
          )}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 검증**

```bash
node -c "d:/3_Project/Egtronics COMS Web/production-request-modal.jsx" 2>&1 | head -5
```

Expected: JSX 문법이라 `node -c`는 실패할 수 있음(Babel 트랜스파일 대상이므로 정상) — 이 경우 대신 아래 grep으로 별칭 위반과 괄호 짝을 눈으로 검토한다:

```bash
grep -n "const { useState }" "d:/3_Project/Egtronics COMS Web"/*.jsx
```

Expected: 결과 없음(별칭 없는 `useState` 사용 없음).

- [ ] **Step 3: Commit**

```bash
git add production-request-modal.jsx
git commit -m "feat: AddressManageModal 컴포넌트 추가"
```

---

### Task 5: `production-waiting.jsx` — `SalesCompletionModal` 납품장소 필드 교체

**Files:**
- Modify: `production-waiting.jsx:844-863` (state 선언부 + `addressSuggestions` 메모)
- Modify: `production-waiting.jsx:909-926` (발주처 필드 — `refreshAddresses` 훅업)
- Modify: `production-waiting.jsx:1003-1022` (납품장소 필드 — UI 교체)
- Modify: `production-waiting.jsx:1078-1090` (모달 스위치 — `AddressManageModal` 케이스 추가)

**Interfaces:**
- Consumes: `AddressManageModal`(Task 4), `window.PMDB.getAddresses`(Task 3).

- [ ] **Step 1: state 선언 교체**

`production-waiting.jsx:844-863`를 다음으로 교체(기존 `masterCustomers`/`masterCpos`/`managers`/`modal` 선언은 유지하고, 그 사이에 `addresses` state를 추가, 기존 `addressSuggestions` useMemoPW 블록은 삭제):

```jsx
  const [masterCustomers, setMasterCustomers] = useStatePW(() => window.PMDB.getCustomers());
  const [masterCpos, setMasterCpos] = useStatePW(() => window.PMDB.getCpos());
  const [managers, setManagers] = useStatePW(() => window.PMDB.getManagers ? window.PMDB.getManagers(order.customer_name) : []);
  const [addresses, setAddresses] = useStatePW(() => window.PMDB.getAddresses ? window.PMDB.getAddresses(order.customer_name) : []);
  const [modal, setModal] = useStatePW(null);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const refreshManagers = (customerName) => {
    if (!customerName || !window.PMDB.getManagers) { setManagers([]); return []; }
    const raw = window.PMDB.getManagers(customerName);
    const list = raw.map(m => ({ ...m, display: m.phone ? `${m.name} (${m.phone})` : m.name }));
    setManagers(list);
    return list;
  };

  const refreshAddresses = (customerName) => {
    if (!customerName || !window.PMDB.getAddresses) { setAddresses([]); return []; }
    const list = window.PMDB.getAddresses(customerName);
    setAddresses(list);
    return list;
  };
```

(기존 `addressSuggestions` = `useMemoPW(() => form.customer_name ? masterCustomers.filter(...) : [], ...)` 블록은 통째로 삭제한다 — 이 값은 더 이상 어디서도 참조하지 않는다.)

- [ ] **Step 2: 발주처 콤보의 `onChange`에 `refreshAddresses` 훅업**

`production-waiting.jsx:914` 부근, 발주처 `ComboField`의 `onChange`를 수정:

기존:
```jsx
                    onChange={(v) => { update('customer_name', v); update('customer_manager', ''); update('field_manager_phone', ''); refreshManagers(v); }}
```

교체:
```jsx
                    onChange={(v) => { update('customer_name', v); update('customer_manager', ''); update('field_manager_phone', ''); refreshManagers(v); refreshAddresses(v); }}
```

- [ ] **Step 3: 납품장소 필드 UI 교체**

`production-waiting.jsx:1003-1022`(기존 "발주처 등록 주소" 칩 제안 블록 포함)를 다음으로 통째로 교체:

```jsx
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="field__label" htmlFor="scm-address">납품장소<span className="field__req">*</span></label>
                <div className="mgr-field">
                  <AddressField id="scm-address" value={form.install_address}
                    onChange={(v) => update('install_address', v)} error={showErr('install_address')}/>
                  <button type="button" className="btn btn--secondary mgr-field__manage"
                          onClick={() => {
                            if (!form.customer_name) { window.actions.flashToast('발주처를 먼저 선택해 주세요', 'error'); return; }
                            setModal('address');
                          }} title="납품장소 관리" aria-label="납품장소 관리">
                    <Icon name="map-pin" size={13}/>
                  </button>
                </div>
                {addresses.length > 0 && (
                  <div style={{ marginTop: 6, border: '1px solid var(--border-1)', borderRadius: 'var(--r-md)', overflow: 'hidden' }} role="listbox" aria-label="발주처 등록 납품장소">
                    {addresses.map((a) => (
                      <div key={a.address_id} className="combo__item" role="option" tabIndex={0}
                           onClick={() => update('install_address', a.address)}
                           onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); update('install_address', a.address); } }}>
                        <span>{a.label}{!!a.is_primary && <span className="badge badge--info" style={{ marginLeft: 6 }}>대표</span>}</span>
                        <span className="combo__item__meta">{a.address}</span>
                      </div>
                    ))}
                  </div>
                )}
                <input className="input" style={{ marginTop: 6 }} aria-label="상세주소" placeholder="상세주소 (동·호수, 층수 등)"
                  value={form.install_address_detail} onChange={(e) => update('install_address_detail', e.target.value)}/>
                {showErr('install_address') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.install_address}</div>}
              </div>
```

- [ ] **Step 4: 모달 스위치에 `address` 케이스 추가**

`production-waiting.jsx:1078-1090`의 `{modal === 'mgr' && (...)}`  블록 바로 다음에 추가:

```jsx
      {modal === 'address' && (
        <AddressManageModal
          customerName={form.customer_name}
          onClose={() => setModal(null)}
          onChanged={(picked) => {
            const list = refreshAddresses(form.customer_name);
            if (picked) {
              const addr = list.find(a => a.label === picked);
              if (addr) update('install_address', addr.address);
            }
          }}/>
      )}
```

- [ ] **Step 5: 검증**

```bash
grep -n "const { useState }" "d:/3_Project/Egtronics COMS Web"/*.jsx
grep -n "supabase\.from" "d:/3_Project/Egtronics COMS Web"/*.jsx
```

Expected: 둘 다 결과 없음.

```bash
grep -n "addressSuggestions" "d:/3_Project/Egtronics COMS Web/production-waiting.jsx"
```

Expected: 결과 없음 (죽은 코드가 남아있지 않아야 함 — Step 1에서 지운 블록이 다른 곳에서 참조되지 않았는지 확인).

- [ ] **Step 6: Commit**

```bash
git add production-waiting.jsx
git commit -m "feat: 생산완료 모달 납품장소 필드에 다중 등록장소 지원 연결"
```

---

### Task 6: 마이그레이션 적용 + 전체 검증 (자동 + 수동)

**Files:** 없음(검증 전용 태스크)

- [ ] **Step 1: 자동 테스트**

```bash
npm test
```

Expected: 전체 통과(이번 변경은 `ROLE_TABS`/권한 로직을 건드리지 않으므로 기존 결과와 동일해야 함).

- [ ] **Step 2: 전체 grep 체크 재확인**

```bash
grep -n "const { useState }" "d:/3_Project/Egtronics COMS Web"/*.jsx
grep -n "supabase\.from" "d:/3_Project/Egtronics COMS Web"/*.jsx
```

Expected: 둘 다 결과 없음.

- [ ] **Step 3: Supabase에 마이그레이션 SQL 적용 (사용자 작업)**

이 단계는 실행 에이전트가 자동으로 하지 않는다 — 라이브 Supabase 프로젝트에 스키마를 바꾸는 작업이므로 **사용자가 Supabase SQL 에디터에서 직접** `supabase-schema.sql`의 "마이그레이션 전용" 섹션(Task 1에서 추가한 `tb_customer_address` DDL 포함)을 실행해야 한다. 이 단계 없이는 Step 4의 브라우저 확인에서 "납품장소 관리" 모달의 추가/수정/삭제가 실제로 저장되지 않는다(캐시만 낙관적으로 바뀌고 `dbWrite`가 실패 토스트를 띄움).

- [ ] **Step 4: 브라우저 수동 확인**

```bash
npm run dev
```

로컬 서버(`localhost:3000`)에서 다음을 수동으로(또는 chrome-devtools MCP 툴로) 확인한다:
1. `sales` 또는 `admin` 계정으로 로그인 → "생산요청/대기" 화면 이동
2. 생산완료 대상 카드를 클릭해 `SalesCompletionModal`을 연다
3. 발주처를 선택 → 납품장소 필드 옆 "납품장소 관리"(위치 핀 아이콘) 버튼 클릭
4. `AddressManageModal`에서 "납품장소 추가" → 장소명 입력, 우편번호 검색으로 주소 입력, 저장
5. 모달을 닫고 납품장소 필드 아래에 방금 등록한 장소가 칩으로 나타나는지 확인, 클릭 시 `install_address`에 채워지는지 확인
6. 같은 고객사로 두 번째 장소를 추가하고 "대표 지정"을 눌러 대표 배지가 이동하는지 확인
7. 발주처를 다른 고객사로 바꿨다가 다시 원래 고객사로 돌아왔을 때 목록이 올바르게 갱신되는지 확인
8. 브라우저 콘솔에서 `window.pmdbLogs('ERROR')` 실행 — `tb_customer_address` 관련 에러가 없는지 확인

Expected: 위 8개 항목 모두 에러 없이 동작. 실행 에이전트가 브라우저 확인을 수행할 수 없는 환경이라면(예: 헤드리스 불가, Supabase 미연결) "검증 못 함"으로 명시하고 사용자에게 수동 확인을 요청한다 — 근거 없이 "완료"라고 보고하지 않는다.

- [ ] **Step 5: 최종 커밋 없음**

이 태스크는 검증 전용이며 코드 변경이 없으므로 커밋하지 않는다. Step 4에서 문제가 발견되면 해당 Task로 돌아가 수정 후 새 커밋을 만든다.
