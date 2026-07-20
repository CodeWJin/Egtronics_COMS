# 생산대기 화면 — 칸반 카드 & 모달 재구성

날짜: 2026-07-20
대상 파일: `production-waiting.jsx` (`ViewKanban`, `ProductionEntryModal`, `SalesCompletionModal`), `styles.css`

## 배경

`production-waiting.jsx`의 칸반 카드는 모델명·용도·발주처(또는 요청자)만 보여줘 정보가 부족하고, 단계 진행 상황을 알려면 카드를 직접 클릭해봐야 한다. 동시에 `ProductionEntryModal`(생산착수)과 `SalesCompletionModal`(생산완료)은 필드가 `form-grid`에 평평하게 나열되어 있어 어디까지 입력했는지 한눈에 파악하기 어렵고, `ship-inspection.jsx`·`order-lookup.jsx`의 Drawer가 이미 쓰고 있는 카드형 섹션 패턴(아이콘 배지 + 제목, `var(--surface-2)` 배경)과도 시각적으로 어긋난다.

브라우저 목업으로 검토한 방향은: (1) 칸반 카드에 시리얼번호와 단계별 입력 완료율을 추가하고, (2) 두 모달의 필드를 기존 Drawer 섹션 패턴으로 그룹화하는 것. 사용자가 이 방향을 승인했다.

## 범위

- 필드 구성, 검증(`errors`) 로직, 제출/임시저장/되돌리기 액션은 변경하지 않는다 — 레이아웃(그룹화)과 칸반 카드 표시 정보만 바꾼다.
- DB 스키마·API 변경 없음.
- `styles.css`에 칸반 카드 진행율 표시용 클래스를 추가한다(기존 클래스명은 변경하지 않음).
- 대상 3개 컬럼: 생산착수(`progress`), 생산완료(`done`) 카드에 진행율 표시 추가. 생산요청(`request`)·출하대기(`ready`) 카드는 표시 정보 변경 없음(출하대기는 기존 D-day 배지 유지).

## 설계

### 1. 진행율 계산 헬퍼 — `stageProgress(order)`

`ViewKanban` 파일 상단(컴포넌트 밖, `KANBAN_COLS` 근처)에 순수 함수로 추가한다. `ProductionEntryModal`의 `errors`, `SalesCompletionModal`의 `errors`와 동일한 필드 목록을 분모로 삼아 두 곳의 필수값 정의가 갈라지지 않게 한다.

```js
function stageProgress(order) {
  const isPublic = (order.usage_type || '공용') === '공용';

  if (order.status === 'IN_PROGRESS') {
    const p = order.production || {};
    const funcData = window.getFuncInspection?.(order.order_id) ?? null;
    const funcDone = funcData != null && Object.keys(funcData.checks || {}).length > 0 &&
      Object.values(funcData.checks || {}).every(v => v === true || (typeof v === 'string' && v.trim() !== ''));
    const items = [
      !!p.prod_date, !!p.serial_no, !!p.sw_version, !!p.fw_version,
      ...(isPublic ? [!!p.inspection_date] : []),
      funcDone,
    ];
    return { done: items.filter(Boolean).length, total: items.length };
  }

  if (order.status === 'AWAIT_PICKUP' && !window.isSalesInfoComplete(order)) {
    const items = [
      order.cable_length, order.customer_name, order.customer_manager,
      order.field_manager_phone, order.install_address, order.delivery_date,
      ...(isPublic ? [order.station_id, order.charger_no, order.router_no, order.usim_no] : []),
    ];
    return { done: items.filter(Boolean).length, total: items.length };
  }

  return null; // request/ready 컬럼은 진행율 없음
}
```

색상 임계값(목업에서 확인한 규칙): `ratio = done/total` 기준 `< 0.4` → `--warning`, `0.4 ~ 0.79` → `--primary`, `>= 0.8`(100% 포함) → `--success`.

### 2. 칸반 카드 — 시리얼 + 진행율 바 추가 (`ViewKanban`)

카드 렌더링 부분(`production-waiting.jsx:308-343`)에서 `o.production?.serial_no`가 있으면 모노폰트로 한 줄 추가하고, `stageProgress(o)`가 값을 반환하면 기존 `kanban__card__meta` 아래에 진행율 바를 추가한다.

```jsx
{items.map((o, idx) => {
  const d = deliveryHint(o.delivery_date);
  const prog = stageProgress(o);
  const serial = o.production?.serial_no;
  // ...기존 checked/selDisabled 로직 그대로...
  return (
    <div key={o.order_id} /* ...기존 props 그대로... */>
      {/* ...기존 kanban__card__top 그대로... */}
      <div className="kanban__card__title">{o.model_name}</div>
      {serial && <div className="kanban__card__serial">{serial}</div>}
      <div className="kanban__card__sub">{o.customer_name || (o.requested_by ? `요청자: ${o.requested_by}` : '발주정보 미입력')}</div>
      <div className="kanban__card__meta">
        <span className="badge badge--neutral" style={{ fontSize: 10.5 }}>{o.usage_type || '공용'}</span>
        {col.id === 'ready' && (
          <span className="dday-badge" style={{ '--dday-color': d.color, '--dday-bg': d.bg }}>{d.text}</span>
        )}
      </div>
      {prog && (
        <div className="kanban__card__progress">
          <div className="kanban__card__progress-track">
            <div className="kanban__card__progress-fill" style={{ width: `${(prog.done / prog.total) * 100}%`, background: progressColor(prog) }}/>
          </div>
          <span className="kanban__card__progress-text">{prog.done}/{prog.total}</span>
        </div>
      )}
    </div>
  );
})}
```

`progressColor(prog)`도 `stageProgress` 옆에 작은 헬퍼로 추가:

```js
function progressColor(prog) {
  const ratio = prog.done / prog.total;
  if (ratio >= 0.8) return 'var(--success)';
  if (ratio >= 0.4) return 'var(--primary)';
  return 'var(--warning, #f59e0b)';
}
```

### 3. `styles.css` — 카드 진행율/시리얼 클래스 추가

`.kanban__card__meta` 정의 바로 뒤(1244행 부근)에 추가:

```css
.kanban__card__serial {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--ink-3);
  margin-bottom: 6px;
  letter-spacing: -0.2px;
}
.kanban__card__progress {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.kanban__card__progress-track {
  flex: 1;
  height: 5px;
  background: var(--border-1);
  border-radius: 999px;
  overflow: hidden;
}
.kanban__card__progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 200ms ease;
}
.kanban__card__progress-text {
  font-size: 11px;
  color: var(--ink-3);
  font-weight: 600;
  white-space: nowrap;
}
```

`@container (max-width: 157px)` 룰(1207행)의 말줄임 대상 목록에 `.kanban__card__serial`도 추가한다(좁은 카드에서 시리얼이 줄바꿈되지 않도록).

### 4. `ProductionEntryModal` — 섹션 그룹화

`modal__body` 안의 단일 `form-grid form-grid--3`(489~618행)를 3개의 `<section>`으로 나눈다. 섹션 헤더는 `ship-inspection.jsx:384-390`의 패턴(26×26 아이콘 배지 + 16px/600 제목)을 그대로 재사용하는 작은 로컬 컴포넌트로 뽑는다:

```jsx
function PWSectionHead({ icon, title, extra }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
        <Icon name={icon} size={16} style={{ color: 'var(--primary-600)' }}/>
      </div>
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>{title}</span>
      {extra}
    </div>
  );
}
```

섹션 구성 (필드 자체는 기존 그대로, 감싸는 컨테이너만 교체):

1. **기본 정보** (`icon="calendar"`) — 생산일자, 시리얼(+중복확인/재생성 UI 그대로), (공용 시) 검정일자. 내부는 `form-grid` 2~3열 유지.
2. **버전 정보** (`icon="bolt"`) — S/W·F/W 태그피커 두 블록을 한 섹션에 세로로 배치(현재 `col-span-2` 두 개를 한 섹션 안 두 서브블록으로).
3. **기능검사 성적서** (`icon="doc"`) — 기존 상태 배너(597~617행)를 그대로 섹션 안에 넣는다. 배너 자체 스타일(완료/미완료 색상)은 변경 없음.

각 섹션은 `<section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>`로 감싸고, 섹션 사이는 `modal__body`에 `display:flex; flexDirection:column; gap:12px`를 적용해 띄운다(기존 `form-grid`의 grid gap 대신).

### 5. `SalesCompletionModal` — 섹션 그룹화

동일한 `PWSectionHead`를 재사용해 `modal__body`(798~920행)를 3개 섹션으로 나눈다:

1. **발주처 정보** (`icon="building"`) — 발주처(`ComboField`+신규등록 버튼), 발주처 담당자(`ComboField`+관리 버튼), 담당자 전화번호. 기존 `mgr-field` 마크업·모달(`AddCustomerModal`, `ManagerManageModal`) 연결 로직은 변경 없음.
2. **납품 정보** (`icon="truck"`) — 케이블 길이, 납품장소(+상세주소), 납품일자, (공용 시) CPO 운영사.
3. **통신 정보** (`icon="wifi"`, 공용일 때만 섹션 자체를 렌더) — 충전소ID, 충전기ID, 라우터번호, USIM번호.

비공용 오더는 섹션 3이 통째로 렌더링되지 않는다(현재도 `isPublic && (<>...</>)`로 조건부 렌더링 중이므로 섹션 wrapper만 그 조건 안으로 옮기면 됨).

### 6. 변경하지 않는 것

- `ProductionRevertReviewModal`의 `PWField`/`dgrid` 레이아웃 — 이미 읽기 전용 요약 화면이라 대상 밖.
- 두 모달의 `modal__foot` 버튼 구성, disabled 조건, `submit`/`saveDraft`/`revertToPending` 로직.
- `KANBAN_COLS`의 `filter` 조건, `onPick` 라우팅, 다중선택/일괄 생산착수(`quickStart`) 로직.
- 상단 툴바(검색·필터·초기화)와 화면 헤더(`screen__head`).

## 검증 계획

- `npm test`, 훅 별칭·`supabase.from` 직접호출 grep — 기존 필수 절차.
- 브라우저 수동 확인(자동화 테스트 없는 코드베이스):
  - 생산착수 컬럼: 시리얼 미채번 상태(이론상 없음, 착수 시 자동 채번되므로 실제로는 항상 존재)와 일부 필드만 입력한 오더에서 진행율이 정확히 갱신되는지(모달에서 필드 하나 채우고 임시저장 → 카드 진행율 분자 +1 확인)
  - 생산완료 컬럼: 발주처 정보 일부만 입력 후 저장 → 카드 진행율이 공용/비공용 분모 차이(9 vs 5)를 반영하는지
  - 진행율 0.4/0.8 경계 부근에서 색상이 amber→primary→success로 바뀌는지
  - 좁은 화면(태블릿 폭, 컬럼 4개 표시)에서 시리얼·진행율 텍스트가 카드 폭을 벗어나지 않는지(`@container` 말줄임 적용 확인)
  - 두 모달 모두 섹션 그룹화 후 필수 입력 검증(`showErr`)이 기존과 동일하게 필드 옆에 뜨는지, 제출/임시저장/취소 버튼 동작이 그대로인지
  - 비공용 오더로 `SalesCompletionModal`을 열어 통신 정보 섹션 자체가 렌더링되지 않는지
