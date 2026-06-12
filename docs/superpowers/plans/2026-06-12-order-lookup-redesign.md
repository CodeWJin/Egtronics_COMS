# order-lookup 화면 개편 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 생산완료(COMPLETED) 오더 전용 통합 조회 화면으로 재구성하고, 드로어에서 오더 변경 이력·A/S 접수 현황·처리 이력을 모두 표시한다.

**Architecture:** 단일 파일(`order-lookup.jsx`) 수정. 상태 필터 UI 제거 후 fStatus 상수 고정, 테이블 열 정리, 두 개의 신규 컴포넌트(`OrderHistorySection`, `AsReceptionSection`/`AsReceptionCard`)를 추가하고 `OrderDrawer`에 삽입한다.

**Tech Stack:** React 18 (CDN), Babel Standalone, `window.PMDB` 캐시 API, 기존 CSS 클래스(`card`, `badge`, `dgrid`, `dsec__title` 등)

---

## 파일 구조

| 파일 | 변경 내용 |
|------|----------|
| `order-lookup.jsx` | 전체 수정 — 아래 Task 순서대로 적용 |

---

## Task 1: fStatus 고정 및 필터 패널에서 상태 드롭다운 제거

**Files:**
- Modify: `order-lookup.jsx`

- [ ] **Step 1: 상태 state를 상수로 교체**

`OrderLookupScreen` 함수 안 15번째 줄:
```js
// 제거
const [fStatus, setFStatus] = useStateOL('COMPLETED');

// 추가 (useState 불필요 — 상수)
const fStatus = 'COMPLETED';
```

- [ ] **Step 2: activeFilters 계산에서 fStatus 항 제거**

```js
// 변경 전
const activeFilters = (fStatus !== 'all') + (fModel !== 'all') + ...

// 변경 후
const activeFilters = (fModel !== 'all') + (fCustomer !== 'all') + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (search ? 1 : 0) + (fAsOnly ? 1 : 0);
```

- [ ] **Step 3: reset() 에서 setFStatus 제거**

```js
// 변경 전
const reset = () => {
  setSearch(''); setFStatus('all'); setFModel('all'); setFCustomer('all');
  setDateFrom(''); setDateTo(''); setDateField('delivery'); setFAsOnly(false);
};

// 변경 후
const reset = () => {
  setSearch(''); setFModel('all'); setFCustomer('all');
  setDateFrom(''); setDateTo(''); setDateField('delivery'); setFAsOnly(false);
};
```

- [ ] **Step 4: 화면 헤더 통계 교체**

```jsx
// 변경 전
<div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: 'var(--ink-3)' }}>
  전체 <strong style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{s.orders.length}</strong>건 ·
  대기 <strong style={{ color: 'var(--warning-700)', fontWeight: 600 }}>{s.orders.filter(o => o.status === 'PENDING').length}</strong> ·
  완료 <strong style={{ color: 'var(--success-700)', fontWeight: 600 }}>{s.orders.filter(o => o.status === 'COMPLETED').length}</strong> ·
  A/S <strong style={{ color: 'var(--primary-600)', fontWeight: 600 }}>{asStats.ordersWithAs}</strong>오더
  <span style={{ color: 'var(--ink-5)' }}>|</span>
  이력 <strong style={{ color: 'var(--primary-600)', fontWeight: 600 }}>{asStats.totalRecords}</strong>건
</div>

// 변경 후
<div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: 'var(--ink-3)' }}>
  생산완료 <strong style={{ color: 'var(--success-700)', fontWeight: 600 }}>{s.orders.filter(o => o.status === 'COMPLETED').length}</strong>건 ·
  검색결과 <strong style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{filtered.length}</strong>건 ·
  A/S <strong style={{ color: 'var(--primary-600)', fontWeight: 600 }}>{asStats.ordersWithAs}</strong>오더 ·
  이력 <strong style={{ color: 'var(--primary-600)', fontWeight: 600 }}>{asStats.totalRecords}</strong>건
</div>
```

- [ ] **Step 5: 필터 패널에서 상태 드롭다운 JSX 블록 제거**

아래 블록 전체 삭제 (현재 lines 130-138):
```jsx
<div className="field">
  <label className="field__label" htmlFor="ol-status">상태</label>
  <select id="ol-status" className="select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
    <option value="all">전체 상태</option>
    <option value="PENDING">생산대기</option>
    <option value="IN_PROGRESS">생산중</option>
    <option value="AWAIT_PICKUP">출하대기</option>
    <option value="COMPLETED">생산완료</option>
  </select>
</div>
```

- [ ] **Step 6: 브라우저에서 확인**

`npx serve . -p 3000` 실행 후 `localhost:3000` 열기.
- 필터 패널에 상태 드롭다운이 없어야 함
- 검색 조건: 통합검색, 모델, 고객사, 기간기준, 시작일, 종료일, A/S 필터만 표시
- 헤더 통계: "생산완료 N건 · 검색결과 N건 · A/S …" 형태

- [ ] **Step 7: 커밋**

```bash
git add order-lookup.jsx
git commit -m "refactor: order-lookup 상태 필터 제거 및 COMPLETED 고정"
```

---

## Task 2: 테이블에서 상태(status) 열 제거

**Files:**
- Modify: `order-lookup.jsx`

- [ ] **Step 1: colgroup에서 상태 열 col 제거**

```jsx
// 변경 전 (7개 col)
<colgroup>
  <col style={{ textAlign: 'left', width: 76 }}/>
  <col style={{ textAlign: 'left', width: 190 }}/>
  <col style={{ textAlign: 'left', width: 150 }}/>
  <col style={{ textAlign: 'left', width: 120 }}/>
  <col style={{ textAlign: 'left', width: 140 }}/>
  <col style={{ textAlign: 'left', width: 140 }}/>
  <col style={{ textAlign: 'left', width: 110 }}/>  {/* 상태 열 */}
  <col style={{ textAlign: 'left', width: 40 }}/>
</colgroup>

// 변경 후 (6개 col — 상태 110px 제거)
<colgroup>
  <col style={{ width: 76 }}/>
  <col style={{ width: 200 }}/>
  <col style={{ width: 160 }}/>
  <col style={{ width: 130 }}/>
  <col style={{ width: 150 }}/>
  <col style={{ width: 150 }}/>
  <col style={{ width: 40 }}/>
</colgroup>
```

- [ ] **Step 2: thead에서 상태 th 제거**

```jsx
// 변경 전
<th style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>상태{sortArrow('status')}</th>

// 제거 (위 th 한 줄 삭제)
```

- [ ] **Step 3: tbody tr에서 상태 td 제거**

```jsx
// 변경 전 — 상태 배지와 A/S 배지가 같은 td 안에 있음
<td>
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    {statusBadge(o)}
    {(window.PMDB.getAsHistory(o.order_id) || []).length > 0 && (
      <span className="badge badge--pending" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)', fontSize: 10.5 }}>
        A/S {(window.PMDB.getAsHistory(o.order_id) || []).length}
      </span>
    )}
  </div>
</td>

// 변경 후 — A/S 배지만 남김 (상태 배지 제거)
<td>
  {(window.PMDB.getAsHistory(o.order_id) || []).length > 0 && (
    <span className="badge badge--pending" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)', fontSize: 10.5 }}>
      A/S {(window.PMDB.getAsHistory(o.order_id) || []).length}
    </span>
  )}
</td>
```

- [ ] **Step 4: sortKey 기본값 변경 및 status sort 케이스 제거**

`toggleSort`에서 status 케이스는 남겨도 무방하지만, 헤더 th에서 status 정렬을 트리거하는 곳이 없으므로 데드코드가 된다. 그냥 그대로 둔다.

- [ ] **Step 5: 브라우저에서 확인**

- 테이블 열: 오더#, 고객사, 모델, 충전소 ID, 납품일, 생산일, A/S, `>`
- 상태 열 없음

- [ ] **Step 6: 커밋**

```bash
git add order-lookup.jsx
git commit -m "refactor: order-lookup 테이블에서 상태 열 제거"
```

---

## Task 3: OrderHistorySection 컴포넌트 추가

**Files:**
- Modify: `order-lookup.jsx` — `AsHistorySection` 함수 바로 위에 삽입

- [ ] **Step 1: OrderHistorySection 컴포넌트 작성**

`AsHistorySection` 함수 정의 바로 위(현재 line 266)에 아래 컴포넌트를 삽입:

```jsx
function OrderHistorySection({ orderId }) {
  const list = React.useMemo(() => window.PMDB.getHistory(orderId), [orderId]);

  return (
    <section>
      <div className="dsec__title"><Icon name="timeline" size={12}/> 오더 변경 이력</div>
      {list.length === 0 ? (
        <div className="emptystate" style={{ padding: '14px 0' }}>
          <div className="emptystate__title" style={{ fontSize: 13 }}>변경 이력이 없습니다</div>
        </div>
      ) : list.map((r, i) => (
        <div key={r.history_id} style={{ padding: '10px 0', borderBottom: i < list.length - 1 ? '1px solid var(--border-1)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{r.changed_at}</span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{r.changed_by}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12.5 }}>
            <span className="badge badge--neutral">{r.action || 'update'}</span>
            {Array.isArray(r.changed_fields) && r.changed_fields.length > 0 && (
              <span style={{ color: 'var(--ink-3)' }}>{r.changed_fields.join(', ')}</span>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: 커밋 (아직 드로어에 연결 안 됨)**

```bash
git add order-lookup.jsx
git commit -m "feat: OrderHistorySection 컴포넌트 추가"
```

---

## Task 4: AsReceptionSection + AsReceptionCard 컴포넌트 추가

**Files:**
- Modify: `order-lookup.jsx` — `OrderHistorySection` 바로 아래에 삽입

- [ ] **Step 1: AsReceptionCard 컴포넌트 작성**

`OrderHistorySection` 함수 아래에 삽입:

```jsx
function AsReceptionCard({ reception: r }) {
  const logs = React.useMemo(() => window.PMDB.getAsLogs(r.id), [r.id]);

  const statusStyle = {
    '접수대기':   { bg: 'var(--ink-6)',       fg: 'var(--ink-3)' },
    '담당자배정': { bg: 'var(--primary-50)',   fg: 'var(--primary-600)' },
    '처리중':     { bg: 'var(--warning-50)',   fg: 'var(--warning-700)' },
    '처리완료':   { bg: 'var(--success-50)',   fg: 'var(--success-700)' },
  }[r.status] || { bg: 'var(--ink-6)', fg: 'var(--ink-3)' };

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-1)', borderRadius: 'var(--r-lg)', padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600 }}>{r.reception_no}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {r.priority && r.priority !== '일반' && (
            <span className="badge badge--pending">{r.priority}</span>
          )}
          <span className="badge" style={{ background: statusStyle.bg, color: statusStyle.fg, border: 'none' }}>{r.status}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12.5 }}>
        {r.fault_type && <div><span style={{ color: 'var(--ink-3)' }}>고장유형 </span><span>{r.fault_type}</span></div>}
        {r.received_at && <div><span style={{ color: 'var(--ink-3)' }}>접수일 </span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.received_at.slice(0, 10)}</span></div>}
        {r.reporter_name && (
          <div style={{ gridColumn: 'span 2' }}>
            <span style={{ color: 'var(--ink-3)' }}>신고자 </span>
            <span>{r.reporter_name}{r.reporter_phone ? ` (${r.reporter_phone})` : ''}</span>
          </div>
        )}
        {r.assignee && <div><span style={{ color: 'var(--ink-3)' }}>담당자 </span><span>{r.assignee}</span></div>}
        {r.dispatch_date && <div><span style={{ color: 'var(--ink-3)' }}>출동일 </span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.dispatch_date}</span></div>}
        {r.action_type && <div><span style={{ color: 'var(--ink-3)' }}>처리유형 </span><span>{r.action_type}</span></div>}
        {r.action_detail && <div style={{ gridColumn: 'span 2' }}><span style={{ color: 'var(--ink-3)' }}>처리내용 </span><span>{r.action_detail}</span></div>}
        {r.cost && <div><span style={{ color: 'var(--ink-3)' }}>비용 </span><span>{r.cost}</span></div>}
        {r.notes && <div style={{ gridColumn: 'span 2' }}><span style={{ color: 'var(--ink-3)' }}>비고 </span><span>{r.notes}</span></div>}
      </div>
      {logs.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: 8, marginTop: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>처리 이력</div>
          {logs.map(l => (
            <div key={l.id} style={{ display: 'flex', gap: 8, fontSize: 11.5, padding: '3px 0', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', flexShrink: 0, minWidth: 72 }}>{(l.changed_at || '').slice(0, 10)}</span>
              <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{l.from_status || '—'} → {l.to_status || '—'}</span>
              {l.memo && <span style={{ color: 'var(--ink-2)' }}>{l.memo}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: AsReceptionSection 컴포넌트 작성**

`AsReceptionCard` 바로 아래에 삽입:

```jsx
function AsReceptionSection({ orderId }) {
  const receptions = React.useMemo(
    () => window.PMDB.loadAsReceptions().filter(r => r.order_id === orderId),
    [orderId]
  );

  return (
    <section>
      <div className="dsec__title">
        <Icon name="list" size={12}/> A/S 접수 현황{receptions.length > 0 && ` (${receptions.length}건)`}
      </div>
      {receptions.length === 0 ? (
        <div className="emptystate" style={{ padding: '14px 0' }}>
          <div className="emptystate__title" style={{ fontSize: 13 }}>등록된 A/S 접수가 없습니다</div>
        </div>
      ) : (
        receptions.map(r => <AsReceptionCard key={r.id} reception={r}/>)
      )}
    </section>
  );
}
```

- [ ] **Step 3: 커밋 (아직 드로어에 연결 안 됨)**

```bash
git add order-lookup.jsx
git commit -m "feat: AsReceptionSection, AsReceptionCard 컴포넌트 추가"
```

---

## Task 5: OrderDrawer에 신규 섹션 연결

**Files:**
- Modify: `order-lookup.jsx` — `OrderDrawer` 함수의 `drawer__body` 안

- [ ] **Step 1: OrderDrawer body에 섹션 삽입**

`OrderDrawer` 내 `<div className="drawer__body">` 안 기존 섹션 배치를 아래와 같이 변경:

```jsx
<div className="drawer__body">
  {/* 섹션 1: 영업 입력 정보 (기존 유지) */}
  <section>
    <div className="dsec__title"><Icon name="cart" size={12}/> 영업 입력 정보</div>
    <div className="dgrid">
      <Field k="모델" v={order.model_name}/>
      <Field k="케이블 길이" v={order.cable_length}/>
      <Field k="담당자" v={managerDisplay}/>
      <Field k="납품일자" v={order.delivery_date} mono/>
      <Field k="충전소 ID" v={order.station_id} mono/>
      <Field k="라우터 S/N" v={order.router_no} mono/>
      <Field k="USIM (ICCID)" v={order.usim_no} mono full/>
      <Field k="설치주소" v={order.install_address} full/>
      {(order.field_manager_name || order.field_manager_phone) && (
        <Field k="현장담당자"
               v={[order.field_manager_name, order.field_manager_phone].filter(Boolean).join(' · ')}
               full/>
      )}
    </div>
  </section>

  {/* 섹션 2: 생산 실적 정보 (기존 유지) */}
  <section>
    <div className="dsec__title"><Icon name="factory" size={12}/> 생산 실적 정보</div>
    {p ? (
      <div className="dgrid">
        <Field k="생산일자" v={p.prod_date}/>
        <Field k="검정일자" v={p.inspection_date}/>
        <Field k="로트번호" v={p.lot_no} mono/>
        <Field k="시리얼" v={p.serial_no} mono/>
        <Field k="S/W 버전" v={p.sw_version} mono/>
        <Field k="문서번호 (성적서)" v={p.doc_no} mono full/>
      </div>
    ) : (
      <div style={{ padding: '20px 18px', background: 'var(--warning-50)', border: '1px solid var(--warning)', borderRadius: 'var(--r-lg)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Icon name="clock" size={16} style={{ color: 'var(--warning-700)', flexShrink: 0, marginTop: 1 }}/>
        <div style={{ fontSize: 12.5, color: 'var(--warning-700)', lineHeight: 1.55 }}>
          아직 생산이 완료되지 않은 오더입니다. 생산 입력 화면에서 실적을 입력하면 이 영역이 채워집니다.
        </div>
      </div>
    )}
  </section>

  {/* 섹션 3: 오더 변경 이력 (신규) */}
  <OrderHistorySection orderId={order.order_id}/>

  {/* 섹션 4: A/S 접수 현황 (신규) */}
  <AsReceptionSection orderId={order.order_id}/>

  {/* 섹션 5: A/S 이력 구형 (기존 유지) */}
  <AsHistorySection orderId={order.order_id} canEdit={isAs} onAsChange={onAsChange}/>
</div>
```

- [ ] **Step 2: 브라우저에서 확인**

생산완료 오더를 클릭해 드로어 열기. 확인 항목:
- 영업 입력 정보 표시
- 생산 실적 정보 표시
- 오더 변경 이력: 이력 있으면 목록, 없으면 "변경 이력이 없습니다"
- A/S 접수 현황: 접수 있으면 카드(접수번호·상태·처리 이력), 없으면 "등록된 A/S 접수가 없습니다"
- A/S 이력(구형) 섹션 표시

- [ ] **Step 3: 커밋**

```bash
git add order-lookup.jsx
git commit -m "feat: order-lookup 드로어에 오더 변경 이력 및 A/S 접수 현황 섹션 추가"
```

---

## 자체 검토 (spec coverage)

| 요구사항 | 구현 Task |
|----------|----------|
| status === COMPLETED만 표시 | Task 1 — fStatus 상수 고정 |
| 통합검색·모델·고객사·날짜 필터 | Task 1 — 상태 드롭다운만 제거, 나머지 유지 |
| A/S 필터 | Task 1 — 유지 |
| 상세 클릭 시 모든 정보 표시 | Task 5 — 5개 섹션 |
| 오더 변경 이력 (tb_order_history) | Task 3, 5 |
| A/S 접수 현황 (tb_as_reception + tb_as_log) | Task 4, 5 |
| A/S 이력 구형 유지 | Task 5 |
