# 영업 입력 대량 오더 등록 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `sales-input.jsx`의 "제품 선택" 테이블(신규 오더 등록 모드)에 행 다중선택 + 일괄 적용 툴바 + N행 한번에 추가 기능을 넣어 대량 오더 입력을 빠르게 한다.

**Architecture:** 단일 파일(`sales-input.jsx`) 내 `SalesInputScreen` 컴포넌트에 상태(`selectedRowIds`, `bulkCpoValue`, `addRowCount`)와 헬퍼 함수를 추가하고, 기존 `ModelSelectModal`을 재사용해 모델 일괄 지정을 구현한다. 행 식별에 배열 인덱스 대신 안정적인 `_id`를 도입해 선택 상태가 삭제/추가로 인해 꼬이지 않게 한다.

**Tech Stack:** React 18(Babel Standalone, 브라우저 내 트랜스파일, 빌드 스텝 없음), 순수 클라이언트 상태(Supabase 미관여).

## Global Constraints

- 이 저장소는 빌드 스텝이 없다. 문법 오류가 즉시 드러나지 않고 런타임에 조용히 깨질 수 있으므로, 모든 편집 후 해당 섹션 코드를 다시 읽어 문법을 눈으로 확인한다.
- React 훅은 반드시 파일 상단에 이미 정의된 별칭을 사용한다: `useStateSI`, `useEffectSI`, `useMemoSI`, `useRefSI`. 새 별칭을 만들거나 전역 `useState` 등을 직접 쓰지 않는다.
- 이 파일(`sales-input.jsx`)은 표 셀 레이아웃에 이미 인라인 `style={{...}}`를 광범위하게 사용하는 기존 관례가 있다. 새 코드도 이 파일의 기존 관례를 따라 인라인 스타일을 쓰고, 새 CSS 클래스를 `styles.css`에 추가하지 않는다. 버튼류는 기존 `btn`, `btn--secondary`, `btn--ghost`, `btn--tag`, `chips`, `toolbar` 클래스만 재사용한다.
- 자동화된 컴포넌트 테스트가 없다. 검증은 (1) `npm test`(역할 권한 테스트, 이번 변경과 무관하지만 회귀 확인용), (2) CLAUDE.md가 지정한 grep 검사, (3) 브라우저 수동 확인 세 가지로 한다. 브라우저로 직접 확인하지 못한 항목은 "검증 못 함"으로 명시하고 근거 없이 "완료"라고 보고하지 않는다.
- 이번 작업은 `!isEdit`(신규 등록) 모드에만 적용된다. 수정 모드(`isEdit`)는 행이 항상 1개이므로 체크박스 열·일괄 툴바·N행 추가 UI를 전부 숨긴다.
- DB 스키마 변경 없음. `tb_sales_order` 등 테이블 구조나 `window.actions.addOrder`/`updateOrder` 시그니처는 건드리지 않는다.

## Files

- Modify: `sales-input.jsx` (전 작업 대상, `SalesInputScreen` 함수 및 그 안의 JSX)
- Test: 자동화 테스트 없음. 각 작업 말미에 grep 검사 + 최종 작업(Task 8)에서 브라우저 수동 검증.

---

### Task 1: 행 식별자(`_id`) 도입

**Files:**
- Modify: `sales-input.jsx` (`SalesInputScreen` 상단 상태/헬퍼 선언부, editing 동기화 `useEffectSI`, `submit()`, 테이블 행 `key`)

**Interfaces:**
- Consumes: 없음 (첫 작업)
- Produces: 각 `rows` 배열 원소는 이제 `_id: number` 필드를 가진다. `nextRowIdRef`(컴포넌트 내부 `useRefSI` 카운터)가 이후 모든 작업에서 새 행 생성 시 `_id` 발급에 쓰인다. `duplicateRow(i)`는 복제된 행에 새 `_id`를 부여한다. 제출 payload(`window.actions.addOrder`/`updateOrder`로 전달되는 객체)에는 `_id`가 포함되지 않는다.

- [ ] **Step 1: 현재 코드 확인**

`sales-input.jsx`의 `function SalesInputScreen() {` 부터 `const duplicateRow = ...` 줄까지를 Read로 다시 확인해 아래 old_string과 정확히 일치하는지 확인한다.

- [ ] **Step 2: 컴포넌트 상단 상태/헬퍼에 `_id` 카운터·발급 추가**

```
old_string:
function SalesInputScreen() {
  const s = window.useStore();
  const editing = s.editingOrderId ? s.orders.find(o => o.order_id === s.editingOrderId) : null;
  const isEdit = !!editing;

  const clampQty = (v, max = 500) => Math.max(1, Math.min(max, parseInt(v) || 1));

  const emptyCommon = {
    customer_name: '', customer_manager: '',
    delivery_date: '',
    install_address: '', install_address_detail: '',
    field_manager_name: '', field_manager_phone: '',
  };
  const makeRow = () => ({
    _power: '',
    model_name: '', usage_type: '공용', cpo_name: '',
    station_id: '', charger_no: '', router_no: '', usim_no: '',
    qty: 1,
  });
```

```
new_string:
function SalesInputScreen() {
  const s = window.useStore();
  const editing = s.editingOrderId ? s.orders.find(o => o.order_id === s.editingOrderId) : null;
  const isEdit = !!editing;

  const nextRowIdRef = useRefSI(1);
  const clampQty = (v, max = 500) => Math.max(1, Math.min(max, parseInt(v) || 1));

  const emptyCommon = {
    customer_name: '', customer_manager: '',
    delivery_date: '',
    install_address: '', install_address_detail: '',
    field_manager_name: '', field_manager_phone: '',
  };
  const makeRow = () => ({
    _id: nextRowIdRef.current++,
    _power: '',
    model_name: '', usage_type: '공용', cpo_name: '',
    station_id: '', charger_no: '', router_no: '', usim_no: '',
    qty: 1,
  });
```

- [ ] **Step 3: `duplicateRow`가 새 `_id`를 발급하도록 수정**

```
old_string:
  const duplicateRow = (i) => setRows(r => [...r.slice(0, i + 1), { ...r[i] }, ...r.slice(i + 1)]);
```

```
new_string:
  const duplicateRow = (i) => setRows(r => [...r.slice(0, i + 1), { ...r[i], _id: nextRowIdRef.current++ }, ...r.slice(i + 1)]);
```

- [ ] **Step 4: 수정 모드(editing) 동기화 effect에서 생성하는 행에도 `_id` 부여**

```
old_string:
      setRows([{
        _power: '',
        model_name: editing.model_name || '',
        usage_type: editing.usage_type || '공용',
        cpo_name: editing.cpo_name || '',
        station_id: editing.station_id || '',
        charger_no: editing.charger_no || '',
        router_no: editing.router_no || '',
        usim_no: editing.usim_no || '',
      }]);
```

```
new_string:
      setRows([{
        _id: nextRowIdRef.current++,
        _power: '',
        model_name: editing.model_name || '',
        usage_type: editing.usage_type || '공용',
        cpo_name: editing.cpo_name || '',
        station_id: editing.station_id || '',
        charger_no: editing.charger_no || '',
        router_no: editing.router_no || '',
        usim_no: editing.usim_no || '',
      }]);
```

- [ ] **Step 5: `submit()`의 두 곳에서 payload 구성 시 `_id` 제외**

```
old_string:
      const { _power: _rp, ...cleanRow } = row;
```

```
new_string:
      const { _power: _rp, _id: _rid, ...cleanRow } = row;
```

```
old_string:
    validRows.forEach(({ _power: _rp, qty, ...cleanRow }) => {
```

```
new_string:
    validRows.forEach(({ _power: _rp, _id: _rid, qty, ...cleanRow }) => {
```

- [ ] **Step 6: 테이블 행의 React `key`를 인덱스 대신 `_id`로 변경**

```
old_string:
                      <tr key={i} style={errs.model_name || errs.usim_no ? { background: 'var(--danger-50)' } : (!isPub && (row.qty || 1) > 1) ? { background: 'var(--primary-50)' } : {}}>
```

```
new_string:
                      <tr key={row._id} style={errs.model_name || errs.usim_no ? { background: 'var(--danger-50)' } : (!isPub && (row.qty || 1) > 1) ? { background: 'var(--primary-50)' } : {}}>
```

- [ ] **Step 7: grep 검사**

Run: `grep -n "const { useState }" "sales-input.jsx"`
Expected: 결과 없음 (별칭 없는 훅 사용 없음)

Run: `grep -n "supabase\.from" "sales-input.jsx"`
Expected: 결과 없음

- [ ] **Step 8: 동작 확인 (브라우저)**

`npx vercel dev` 또는 `npm run dev`로 로컬 서버를 띄우고 영업 입력 화면(신규 오더 등록)을 연다. 행 추가/복제/삭제/제출이 이전과 동일하게 동작하는지 확인한다 (겉보기 동작은 이번 작업으로 바뀌지 않아야 한다 — `_id`는 내부 필드일 뿐).

- [ ] **Step 9: 커밋**

```bash
git add sales-input.jsx
git commit -m "$(cat <<'EOF'
feat: 영업 입력 오더 행에 안정적 식별자(_id) 도입

이후 작업에서 체크박스 다중선택 상태를 인덱스가 아닌 _id 기준으로 관리하기 위한 선행 작업.
EOF
)"
```

---

### Task 2: 체크박스 다중선택 상태 및 UI

**Files:**
- Modify: `sales-input.jsx`

**Interfaces:**
- Consumes: Task 1의 `row._id` (모든 행에 존재).
- Produces: `selectedRowIds: Set<number>` 상태, `toggleRowSelect(id)`, `toggleAllRows()`, `allRowIds`, `allRowsSelected`, `someRowsSelected` — Task 3~7이 이 상태와 함수를 그대로 사용한다.

- [ ] **Step 1: `selectedRowIds` 상태와 `selectAllRef` 추가**

```
old_string:
  const [modelModalRow, setModelModalRow] = useStateSI(null);

  const updateCommon = (k, v) => setCommon(c => ({ ...c, [k]: v }));
```

```
new_string:
  const [modelModalRow, setModelModalRow] = useStateSI(null);
  const [selectedRowIds, setSelectedRowIds] = useStateSI(() => new Set());
  const selectAllRef = useRefSI(null);

  const updateCommon = (k, v) => setCommon(c => ({ ...c, [k]: v }));
```

- [ ] **Step 2: 선택 관련 파생값과 토글 함수 추가**

```
old_string:
  const duplicateRow = (i) => setRows(r => [...r.slice(0, i + 1), { ...r[i], _id: nextRowIdRef.current++ }, ...r.slice(i + 1)]);

  useEffectSI(() => {
    setMasterCustomers(window.PMDB.getCustomers());
```

```
new_string:
  const duplicateRow = (i) => setRows(r => [...r.slice(0, i + 1), { ...r[i], _id: nextRowIdRef.current++ }, ...r.slice(i + 1)]);

  const allRowIds = useMemoSI(() => rows.map(r => r._id), [rows]);
  const allRowsSelected = allRowIds.length > 0 && allRowIds.every(id => selectedRowIds.has(id));
  const someRowsSelected = !allRowsSelected && allRowIds.some(id => selectedRowIds.has(id));
  useEffectSI(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someRowsSelected;
  }, [someRowsSelected]);
  const toggleRowSelect = (id) => setSelectedRowIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllRows = () => setSelectedRowIds(allRowsSelected ? new Set() : new Set(allRowIds));

  useEffectSI(() => {
    setMasterCustomers(window.PMDB.getCustomers());
```

- [ ] **Step 3: 표 헤더에 전체선택 체크박스 열 추가 (수정 모드에서는 숨김)**

```
old_string:
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center', paddingLeft: 12 }}>#</th>
                    <th style={{ minWidth: 170 }}>충전속도 (모델) <span className="field__req">*</span></th>
```

```
new_string:
                <thead>
                  <tr>
                    {!isEdit && (
                      <th scope="col" style={{ width: 34, textAlign: 'center', paddingLeft: 12 }}>
                        <input ref={selectAllRef} type="checkbox" aria-label="전체 행 선택/해제"
                               checked={allRowsSelected} onChange={toggleAllRows}/>
                      </th>
                    )}
                    <th style={{ width: 32, textAlign: 'center' }}>#</th>
                    <th style={{ minWidth: 170 }}>충전속도 (모델) <span className="field__req">*</span></th>
```

- [ ] **Step 4: 각 행에 개별 체크박스 셀 추가**

```
old_string:
                      <tr key={row._id} style={errs.model_name || errs.usim_no ? { background: 'var(--danger-50)' } : (!isPub && (row.qty || 1) > 1) ? { background: 'var(--primary-50)' } : {}}>
                        <td style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: 12, paddingLeft: 12 }}>{i + 1}</td>
```

```
new_string:
                      <tr key={row._id} style={errs.model_name || errs.usim_no ? { background: 'var(--danger-50)' } : (!isPub && (row.qty || 1) > 1) ? { background: 'var(--primary-50)' } : {}}>
                        {!isEdit && (
                          <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', paddingLeft: 12 }}>
                            <input type="checkbox" aria-label={`${i + 1}번째 행 선택`}
                                   checked={selectedRowIds.has(row._id)} onChange={() => toggleRowSelect(row._id)}/>
                          </td>
                        )}
                        <td style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: 12, paddingLeft: 12 }}>{i + 1}</td>
```

- [ ] **Step 5: grep 검사**

Run: `grep -n "const { useState }" "sales-input.jsx"`
Expected: 결과 없음

- [ ] **Step 6: 동작 확인 (브라우저)**

신규 오더 등록 화면에서 표 헤더와 각 행에 체크박스가 보이는지, 개별 체크박스 클릭 시 체크 상태가 토글되는지, 헤더 체크박스로 전체 선택/해제가 되는지, 일부만 선택했을 때 헤더 체크박스가 부분선택(가로줄) 표시가 되는지 확인한다. 수정 모드(오더 목록에서 수정 진입)에서는 체크박스 열이 아예 보이지 않아야 한다.

- [ ] **Step 7: 커밋**

```bash
git add sales-input.jsx
git commit -m "$(cat <<'EOF'
feat: 영업 입력 제품 선택 표에 행 다중선택 체크박스 추가

일괄 적용 기능(모델·용도·CPO 일괄 지정, 일괄 삭제)의 선행 UI.
EOF
)"
```

---

### Task 3: 일괄 적용 툴바 뼈대 + 모델 일괄 지정

**Files:**
- Modify: `sales-input.jsx`

**Interfaces:**
- Consumes: Task 2의 `selectedRowIds`, `setSelectedRowIds`. 기존 `ModelSelectModal` 컴포넌트(`powerOptions`, `modelsByPower`, `masterModels` prop은 이미 컴포넌트 상단에 준비되어 있음), 기존 `modelModalRow` 상태.
- Produces: `modelModalRow`가 숫자(개별 행 인덱스) 외에 문자열 `'bulk'` 값도 가질 수 있게 된다. Task 4~5가 같은 툴바 `<div className="toolbar">` 안에 버튼을 추가한다.

- [ ] **Step 1: 카드 바디 상단에 툴바 삽입 (선택 1행 이상일 때만)**

```
old_string:
          <div className="card__body" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 900 }}>
```

```
new_string:
          <div className="card__body" style={{ padding: 0 }}>
            {!isEdit && selectedRowIds.size > 0 && (
              <div className="toolbar" style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)', margin: '12px 16px 0' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-700, var(--primary))' }}>
                  <Icon name="check" size={13}/> {selectedRowIds.size}행 선택됨
                </span>
                <div style={{ flex: 1 }}/>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setModelModalRow('bulk')}>
                  모델 일괄 지정
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelectedRowIds(new Set())}>선택 해제</button>
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 900 }}>
```

- [ ] **Step 2: `ModelSelectModal` 렌더 조건과 `onSelect`가 `'bulk'`를 처리하도록 수정**

```
old_string:
      {modelModalRow !== null && rows[modelModalRow] && (
        <ModelSelectModal
          onClose={() => setModelModalRow(null)}
          onSelect={(model, power) => {
            setRows(r => r.map((rw, idx) => idx === modelModalRow ? { ...rw, model_name: model, _power: power || rw._power } : rw));
            setModelModalRow(null);
          }}
          powerOptions={powerOptions}
          modelsByPower={modelsByPower}
          masterModels={masterModels}
          currentModel={rows[modelModalRow]?.model_name}
          currentPower={rows[modelModalRow]?._power || masterModels.find(m => m.model === rows[modelModalRow]?.model_name)?.power || ''}
        />
      )}
```

```
new_string:
      {(modelModalRow === 'bulk' || (modelModalRow !== null && rows[modelModalRow])) && (
        <ModelSelectModal
          onClose={() => setModelModalRow(null)}
          onSelect={(model, power) => {
            if (modelModalRow === 'bulk') {
              setRows(r => r.map(rw => selectedRowIds.has(rw._id) ? { ...rw, model_name: model, _power: power || rw._power } : rw));
            } else {
              setRows(r => r.map((rw, idx) => idx === modelModalRow ? { ...rw, model_name: model, _power: power || rw._power } : rw));
            }
            setModelModalRow(null);
          }}
          powerOptions={powerOptions}
          modelsByPower={modelsByPower}
          masterModels={masterModels}
          currentModel={modelModalRow === 'bulk' ? '' : rows[modelModalRow]?.model_name}
          currentPower={modelModalRow === 'bulk' ? '' : (rows[modelModalRow]?._power || masterModels.find(m => m.model === rows[modelModalRow]?.model_name)?.power || '')}
        />
      )}
```

- [ ] **Step 3: grep 검사**

Run: `grep -n "const { useState }" "sales-input.jsx"`
Expected: 결과 없음

- [ ] **Step 4: 동작 확인 (브라우저)**

행을 3개 추가하고 그중 2개를 체크박스로 선택 → 표 위에 "2행 선택됨" 툴바가 뜨는지 확인. "모델 일괄 지정" 클릭 → 기존 모델 선택 모달이 열리고, 충전속도/모델을 고르면 선택된 2개 행의 모델이 동시에 바뀌는지, 선택 안 한 행은 그대로인지 확인. "선택 해제" 클릭 시 툴바가 사라지는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add sales-input.jsx
git commit -m "$(cat <<'EOF'
feat: 선택된 행에 모델을 한번에 지정하는 일괄 툴바 추가

기존 ModelSelectModal을 재사용해 여러 행에 같은 모델을 반복해서
모달을 열지 않고 한 번에 지정할 수 있게 함.
EOF
)"
```

---

### Task 4: 일괄 적용 툴바 — 충전기 용도 / CPO 운영사

**Files:**
- Modify: `sales-input.jsx`

**Interfaces:**
- Consumes: Task 3의 툴바 `<div className="toolbar">`, Task 2의 `selectedRowIds`. 기존 `BulkInlineCombo` 컴포넌트, 기존 `cpoOptions`(컴포넌트 상단에 이미 `useMemoSI`로 정의됨).
- Produces: `bulkCpoValue` 상태, `applyBulkUsageType(t)`, `applyBulkCpo()`, `selectedHasPublic` — 이번 작업 안에서만 쓰인다.

- [ ] **Step 1: `bulkCpoValue` 상태 추가**

```
old_string:
  const [modelModalRow, setModelModalRow] = useStateSI(null);
  const [selectedRowIds, setSelectedRowIds] = useStateSI(() => new Set());
  const selectAllRef = useRefSI(null);
```

```
new_string:
  const [modelModalRow, setModelModalRow] = useStateSI(null);
  const [selectedRowIds, setSelectedRowIds] = useStateSI(() => new Set());
  const [bulkCpoValue, setBulkCpoValue] = useStateSI('');
  const selectAllRef = useRefSI(null);
```

- [ ] **Step 2: 일괄 적용 헬퍼 함수 추가**

```
old_string:
  const toggleAllRows = () => setSelectedRowIds(allRowsSelected ? new Set() : new Set(allRowIds));

  useEffectSI(() => {
    setMasterCustomers(window.PMDB.getCustomers());
```

```
new_string:
  const toggleAllRows = () => setSelectedRowIds(allRowsSelected ? new Set() : new Set(allRowIds));
  const selectedHasPublic = rows.some(r => selectedRowIds.has(r._id) && r.usage_type === '공용');
  const applyBulkUsageType = (t) => setRows(r => r.map(rw => {
    if (!selectedRowIds.has(rw._id)) return rw;
    if (t === '비공용') return { ...rw, usage_type: '비공용', cpo_name: '', station_id: '', charger_no: '' };
    return { ...rw, usage_type: t };
  }));
  const applyBulkCpo = () => {
    if (!bulkCpoValue.trim()) return;
    setRows(r => r.map(rw => (selectedRowIds.has(rw._id) && rw.usage_type === '공용') ? { ...rw, cpo_name: bulkCpoValue } : rw));
  };

  useEffectSI(() => {
    setMasterCustomers(window.PMDB.getCustomers());
```

- [ ] **Step 3: 툴바에 용도 · CPO 일괄 적용 컨트롤 추가**

```
old_string:
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setModelModalRow('bulk')}>
                  모델 일괄 지정
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelectedRowIds(new Set())}>선택 해제</button>
              </div>
            )}
```

```
new_string:
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setModelModalRow('bulk')}>
                  모델 일괄 지정
                </button>
                <div className="chips" style={{ gap: 4 }}>
                  {['공용', '비공용'].map(t => (
                    <button key={t} type="button" className="btn btn--tag btn--ghost" onClick={() => applyBulkUsageType(t)}>{t}로 일괄 지정</button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
                  <div style={{ width: 150, border: '1px solid var(--border-1)', borderRadius: 'var(--r-md)', background: 'var(--surface-1)' }}>
                    <BulkInlineCombo
                      value={bulkCpoValue}
                      onChange={setBulkCpoValue}
                      options={cpoOptions}
                      placeholder="CPO 운영사"
                      ariaLabel="일괄 적용할 CPO 운영사"/>
                  </div>
                  <button type="button" className="btn btn--secondary btn--sm" disabled={!selectedHasPublic}
                          title={!selectedHasPublic ? '선택한 행 중 공용 용도가 없습니다' : ''}
                          onClick={applyBulkCpo}>
                    CPO 적용
                  </button>
                </div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelectedRowIds(new Set())}>선택 해제</button>
              </div>
            )}
```

- [ ] **Step 4: grep 검사**

Run: `grep -n "const { useState }" "sales-input.jsx"`
Expected: 결과 없음

- [ ] **Step 5: 동작 확인 (브라우저)**

공용 행 2개, 비공용 행 1개를 만들고 셋 다 선택 → "비공용로 일괄 지정" 클릭 시 세 행 모두 비공용으로 바뀌고 CPO/충전소ID/충전기번호가 비는지 확인. 다시 "공용로 일괄 지정" 클릭 후, CPO 입력란에 값을 넣고 "CPO 적용" 클릭 → 선택된 공용 행에만 CPO가 채워지는지 확인. 선택된 행 중 공용이 하나도 없을 때 "CPO 적용" 버튼이 비활성화되고 툴팁이 뜨는지 확인.

- [ ] **Step 6: 커밋**

```bash
git add sales-input.jsx
git commit -m "$(cat <<'EOF'
feat: 일괄 툴바에 충전기 용도 · CPO 운영사 일괄 지정 추가
EOF
)"
```

---

### Task 5: 일괄 적용 툴바 — 선택 행 일괄 삭제

**Files:**
- Modify: `sales-input.jsx`

**Interfaces:**
- Consumes: Task 2의 `selectedRowIds`/`allRowIds`, `window.actions.showConfirm(message, onConfirm)` (기존 전역 액션, `production-waiting.jsx`에서 이미 같은 시그니처로 사용 중).
- Produces: `bulkDeleteRows()`, `allSelected` — 이번 작업 안에서만 쓰인다.

- [ ] **Step 1: 일괄 삭제 헬퍼 추가**

```
old_string:
  const applyBulkCpo = () => {
    if (!bulkCpoValue.trim()) return;
    setRows(r => r.map(rw => (selectedRowIds.has(rw._id) && rw.usage_type === '공용') ? { ...rw, cpo_name: bulkCpoValue } : rw));
  };

  useEffectSI(() => {
    setMasterCustomers(window.PMDB.getCustomers());
```

```
new_string:
  const applyBulkCpo = () => {
    if (!bulkCpoValue.trim()) return;
    setRows(r => r.map(rw => (selectedRowIds.has(rw._id) && rw.usage_type === '공용') ? { ...rw, cpo_name: bulkCpoValue } : rw));
  };
  const allSelected = allRowIds.length > 0 && selectedRowIds.size === allRowIds.length;
  const bulkDeleteRows = () => {
    window.actions.showConfirm(`선택한 ${selectedRowIds.size}행을 삭제할까요?`, () => {
      setRows(r => r.filter(rw => !selectedRowIds.has(rw._id)));
      setSelectedRowIds(new Set());
    });
  };

  useEffectSI(() => {
    setMasterCustomers(window.PMDB.getCustomers());
```

- [ ] **Step 2: 툴바에 선택 삭제 버튼 추가 (전체 선택 시 비활성화)**

```
old_string:
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelectedRowIds(new Set())}>선택 해제</button>
              </div>
            )}
```

```
new_string:
                <button type="button" className="btn btn--ghost btn--sm" style={{ color: 'var(--danger-700)' }}
                        disabled={allSelected}
                        title={allSelected ? '최소 1개 행은 남아야 합니다' : ''}
                        onClick={bulkDeleteRows}>
                  선택 삭제
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelectedRowIds(new Set())}>선택 해제</button>
              </div>
            )}
```

- [ ] **Step 3: grep 검사**

Run: `grep -n "const { useState }" "sales-input.jsx"`
Expected: 결과 없음

- [ ] **Step 4: 동작 확인 (브라우저)**

행 4개 중 2개 선택 → "선택 삭제" 클릭 → 확인창이 뜨고, 확인 시 선택된 2행만 제거되고 나머지 2행의 데이터는 그대로인지 확인. 전체 행을 선택했을 때 "선택 삭제" 버튼이 비활성화되고 툴팁이 뜨는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add sales-input.jsx
git commit -m "$(cat <<'EOF'
feat: 일괄 툴바에 선택 행 일괄 삭제 추가

전체 행이 선택된 경우 최소 1행을 남기도록 삭제 버튼을 비활성화.
EOF
)"
```

---

### Task 6: 선택 상태 정리 (개별 삭제 / 제출 / 초기화 / 모드 전환과 연동)

**Files:**
- Modify: `sales-input.jsx`

**Interfaces:**
- Consumes: Task 2의 `setSelectedRowIds`. 기존 `removeRow(i)`, `submit()`, "초기화" 버튼 핸들러, editing 동기화 `useEffectSI`.
- Produces: 없음 (기존 함수들의 동작 보완).

- [ ] **Step 1: 개별 행 삭제(`removeRow`) 시 해당 행이 선택돼 있었다면 선택 상태에서도 제거**

```
old_string:
  const removeRow = (i) => setRows(r => r.filter((_, idx) => idx !== i));
```

```
new_string:
  const removeRow = (i) => {
    const removedId = rows[i]?._id;
    setRows(r => r.filter((_, idx) => idx !== i));
    if (removedId !== undefined) {
      setSelectedRowIds(prev => {
        if (!prev.has(removedId)) return prev;
        const next = new Set(prev);
        next.delete(removedId);
        return next;
      });
    }
  };
```

- [ ] **Step 2: 수정 모드 진입/이탈(editing 동기화 effect) 시 선택 상태 초기화**

```
old_string:
    } else {
      setCommon(emptyCommon);
      setRows([makeRow()]);
    }
    setSubmitted(false);
  }, [s.editingOrderId]);
```

```
new_string:
    } else {
      setCommon(emptyCommon);
      setRows([makeRow()]);
    }
    setSelectedRowIds(new Set());
    setSubmitted(false);
  }, [s.editingOrderId]);
```

- [ ] **Step 3: 제출 성공 후 폼 초기화 시 선택 상태도 초기화**

```
old_string:
    setCommon(emptyCommon);
    setRows([makeRow()]);
    setSubmitted(false);
    submittingRef.current = false;
  };
```

```
new_string:
    setCommon(emptyCommon);
    setRows([makeRow()]);
    setSelectedRowIds(new Set());
    setSubmitted(false);
    submittingRef.current = false;
  };
```

- [ ] **Step 4: "초기화" 버튼 클릭 시 선택 상태도 초기화**

```
old_string:
            <button className="btn btn--secondary" onClick={() => { setCommon(emptyCommon); setRows([makeRow()]); setSubmitted(false); }}>
              <Icon name="refresh" size={13}/> 초기화
            </button>
```

```
new_string:
            <button className="btn btn--secondary" onClick={() => { setCommon(emptyCommon); setRows([makeRow()]); setSelectedRowIds(new Set()); setSubmitted(false); }}>
              <Icon name="refresh" size={13}/> 초기화
            </button>
```

- [ ] **Step 5: grep 검사**

Run: `grep -n "const { useState }" "sales-input.jsx"`
Expected: 결과 없음

- [ ] **Step 6: 동작 확인 (브라우저)**

행 3개 중 2개를 선택한 상태에서 그중 체크되지 않은 1개 행을 X(개별 삭제)로 지우면 툴바의 선택 개수가 "2행 선택됨"으로 유지되는지, 선택된 행 하나를 개별 삭제하면 "1행 선택됨"으로 줄어드는지 확인. 오더를 실제로 등록 제출한 뒤 폼이 초기화되며 툴바가 사라지는지, "초기화" 버튼 클릭 시에도 마찬가지인지 확인.

- [ ] **Step 7: 커밋**

```bash
git add sales-input.jsx
git commit -m "$(cat <<'EOF'
fix: 행 삭제·제출·초기화 시 다중선택 상태를 함께 정리

개별 행 삭제, 오더 제출, 폼 초기화, 수정 모드 전환 시
selectedRowIds가 남아 툴바가 잘못된 개수로 뜨는 것을 방지.
EOF
)"
```

---

### Task 7: N행 한번에 추가

**Files:**
- Modify: `sales-input.jsx`

**Interfaces:**
- Consumes: Task 1의 `makeRow()`.
- Produces: `addRow(count = 1)` (기존 `addRow()` 시그니처 확장, 하위 호환 — 인자 없이 호출하면 기존과 동일하게 1행 추가), `addRowCount` 상태.

- [ ] **Step 1: `addRow`가 개수를 받도록 수정**

```
old_string:
  const addRow = () => setRows(r => {
    const last = r[r.length - 1];
    const next = makeRow();
    if (last && last.usage_type === '비공용') next.usage_type = '비공용';
    return [...r, next];
  });
```

```
new_string:
  const addRow = (count = 1) => setRows(r => {
    const last = r[r.length - 1];
    const isNonPublic = last && last.usage_type === '비공용';
    const added = [];
    for (let k = 0; k < count; k++) {
      const row = makeRow();
      if (isNonPublic) row.usage_type = '비공용';
      added.push(row);
    }
    return [...r, ...added];
  });
```

- [ ] **Step 2: `addRowCount` 상태 추가**

```
old_string:
  const [bulkCpoValue, setBulkCpoValue] = useStateSI('');
  const selectAllRef = useRefSI(null);
```

```
new_string:
  const [bulkCpoValue, setBulkCpoValue] = useStateSI('');
  const [addRowCount, setAddRowCount] = useStateSI(1);
  const selectAllRef = useRefSI(null);
```

- [ ] **Step 3: "행 추가" 버튼 옆에 개수 입력 추가**

```
old_string:
              {!isEdit && (
                <button type="button" className="btn btn--secondary btn--sm" onClick={addRow}>
                  <Icon name="plus" size={12}/> 행 추가
                </button>
              )}
```

```
new_string:
              {!isEdit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" min={1} max={50} value={addRowCount}
                         aria-label="추가할 행 개수"
                         onChange={(e) => {
                           const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
                           setAddRowCount(digits === '' ? '' : Math.min(50, parseInt(digits, 10)));
                         }}
                         onBlur={() => setAddRowCount(v => Math.max(1, Math.min(50, parseInt(v, 10) || 1)))}
                         style={{ width: 44, fontFamily: 'var(--font-mono)', fontSize: 12.5, textAlign: 'center', padding: '5px 4px', border: '1px solid var(--border-1)', borderRadius: 'var(--r-md)', background: 'var(--surface-1)' }}/>
                  <button type="button" className="btn btn--secondary btn--sm"
                          onClick={() => addRow(Math.max(1, Math.min(50, parseInt(addRowCount, 10) || 1)))}>
                    <Icon name="plus" size={12}/> 행 추가
                  </button>
                </div>
              )}
```

- [ ] **Step 4: grep 검사**

Run: `grep -n "const { useState }" "sales-input.jsx"`
Expected: 결과 없음

- [ ] **Step 5: 동작 확인 (브라우저)**

개수 입력에 "5"를 넣고 "행 추가" 클릭 → 빈 행 5개가 한 번에 추가되는지 확인. 개수 입력을 기본값(1)로 둔 채 클릭하면 기존과 동일하게 1행만 추가되는지 확인. 직전 마지막 행이 비공용일 때 새로 추가된 행들도 비공용으로 시작하는지 확인.

- [ ] **Step 6: 커밋**

```bash
git add sales-input.jsx
git commit -m "$(cat <<'EOF'
feat: 행 추가 시 한 번에 여러 개(N행) 추가할 수 있도록 개선
EOF
)"
```

---

### Task 8: 통합 검증

**Files:** 없음 (코드 변경 없음, 검증 전용 작업)

**Interfaces:**
- Consumes: Task 1~7의 전체 변경사항.
- Produces: 검증 결과 보고 (통과/실패/미검증 항목 명시).

- [ ] **Step 1: 역할 권한 테스트 실행**

Run: `npm test`
Expected: 기존과 동일하게 전부 통과 (이번 변경은 `sales-input.jsx`의 UI 로직만 건드리므로 회귀가 없어야 한다).

- [ ] **Step 2: CLAUDE.md 필수 grep 검사 재확인**

Run: `grep -n "const { useState }" *.jsx`
Expected: 결과 없음

Run: `grep -n "supabase\.from" *.jsx`
Expected: `db.js` 외 파일에서 결과 없음 (`sales-input.jsx` 포함 모든 뷰 파일에서 결과 없어야 함)

- [ ] **Step 3: 브라우저 종단 시나리오 검증**

`npm run dev` 또는 `npx vercel dev`로 서버를 띄우고 영업(sales) 또는 admin 계정으로 로그인해 "신규 오더 입력" 화면에서 아래를 순서대로 수행하고 각 항목의 통과 여부를 기록한다:

1. 개수 입력에 5를 넣고 행 추가 → 5행이 한 번에 추가되는지
2. 체크박스로 3행 선택 → 툴바에 "3행 선택됨" 표시되는지
3. "모델 일괄 지정" → 모델 하나 선택 → 3행 모두 해당 모델로 바뀌는지, 선택 안 한 행은 그대로인지
4. "비공용로 일괄 지정" → 선택된 행의 CPO·충전소ID·충전기번호가 비워지는지
5. "공용로 일괄 지정" 후 CPO 입력 + 적용 → 선택된 공용 행에만 CPO가 채워지는지
6. 전체 선택 후 "선택 삭제" 비활성화 확인 → 1행 해제 후 "선택 삭제" → 확인창 → 나머지 선택 행만 삭제되는지
7. 개별 행 삭제 후 남은 선택 상태(개수)가 올바른지
8. 오더 제출 후 폼과 선택 상태가 초기화되는지
9. 기존 오더 수정 화면(수정 모드)에 진입했을 때 체크박스 열·일괄 툴바·N행 추가 입력이 전혀 보이지 않는지

- [ ] **Step 4: 결과 보고**

위 9개 시나리오 중 실제로 브라우저에서 확인한 항목과 확인하지 못한 항목을 구분해 사용자에게 보고한다. 확인하지 못한 항목은 "검증 못 함"으로 명시한다.