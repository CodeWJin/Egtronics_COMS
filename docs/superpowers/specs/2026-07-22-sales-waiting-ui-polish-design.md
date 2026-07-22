# 생산요청 · 생산대기 UI 개선 — 반응형/밀도/일관성

날짜: 2026-07-22
대상 파일: `sales-input.jsx`, `production-waiting.jsx`, `styles.css`

## 배경

배포 사이트(coms-egtronics.vercel.app)에서 생산요청/생산대기 화면을 직접 조작하며 확인한 문제 4가지를 다룬다.

1. **칸반(생산대기) 반응형 미대응** — `.kanban`은 4열 grid(`minmax(200px,1fr)`)를 `.kanban-scroll`(`overflow-x:auto`)로 감쌌지만, 900px 이하 폭에 대한 규칙이 전혀 없다(`styles.css:1159-1163`). 실제 태블릿 세로 폭(834px)에서 열어보면 4번째 컬럼("출하대기")이 화면 끝에서 잘리는데, 스크롤 가능하다는 시각적 힌트가 전혀 없어 레이아웃이 깨진 것처럼 보인다. `DESIGN.md`가 "an office desktop and a tablet on the production line"을 명시한 타깃 디바이스인데 이 구간 대응이 비어 있다.
2. **생산요청 테이블 헤더가 스크롤 시 고정되지 않음** — 최대 500행까지 입력하는 화면(`sales-input.jsx:364-378`)인데, 아래로 스크롤하면 컬럼 헤더(#·모델·용도·수량)를 잃는다.
3. **생산요청 테이블 컬럼 폭 불균형** — `<th>`에 `minWidth`만 지정되어 있어(`sales-input.jsx:372-376`) 넓은 데스크탑 화면에서 남는 폭이 "충전기 용도"·"수량"·액션 컬럼에도 분배되고, 그 안의 실제 콘텐츠(칩·스테퍼)는 셀 왼쪽에 붙어 있어 컬럼 사이에 불필요하게 넓은 빈 공간이 생긴다.
4. (부수) 태블릿 폭에서 칸반 스와이프 시 컬럼 경계에 스냅되지 않아 어중간한 위치에서 스크롤이 멈춘다.

브라우저에서 목업 수준까지는 만들지 않았고, 기존 배포본을 조작해 문제를 확인한 뒤 코드 위치까지 대조했다. 사용자가 이 범위(4개 항목 모두)로 진행을 승인했다.

## 범위

- 시각적 언어(색상·타이포·컴포넌트 셰이프)는 `DESIGN.md`를 그대로 따르고 변경하지 않는다 — 이번 작업은 레이아웃/반응형 버그 수정에 한정한다.
- 칸반 카드 정보 구성, 모달 필드, DB/API는 변경하지 않는다 (`2026-07-20` 스펙에서 이미 다룬 영역).
- 브레이크포인트는 기존 시스템의 `900px`(태블릿)을 그대로 재사용한다. `600px`(모바일) 이하 레이아웃은 이미 별도로 처리되어 있으므로 이번 스코프에서 제외한다.
- `sales-input.jsx`는 현재 워킹트리에 다른 미커밋 변경(고객사 관리 모달 제거 등)이 진행 중이다. 이번 작업은 `<thead>`/`<th>` 영역만 건드리고 그 외 diff와는 무관하게 독립적으로 적용 가능해야 한다.

## 설계

### 1. 칸반 — 900px 이하에서 컬럼 최소폭 축소

`production-waiting.jsx:329`는 컬럼 수에 따라 `grid-template-columns`를 인라인 스타일로 계산한다:

```jsx
<div className="kanban" style={{ gridTemplateColumns: `repeat(${visibleCols.length}, minmax(200px, 1fr))` }}>
```

인라인 스타일은 미디어 쿼리로 직접 덮어쓸 수 없으므로, 고정값(`200px`) 대신 CSS 커스텀 프로퍼티를 참조하도록 바꾼다:

```jsx
<div className="kanban" style={{ gridTemplateColumns: `repeat(${visibleCols.length}, minmax(var(--kanban-colmin, 200px), 1fr))` }}>
```

`styles.css`의 기존 `@media (max-width: 900px) { ... }` 블록(`1568`행 부근)에 추가:

```css
.kanban { --kanban-colmin: 168px; }
```

`var()`는 상속되므로 이 규칙은 인라인 스타일보다 특이성 문제 없이 적용된다. 4컬럼 기준 900px 폭에서 `168px×4 + 16px×3 = 720px`로 여백 안에 들어와 잘림이 크게 줄어든다(완전히 없어지진 않음 — 완전 해소하려면 컬럼을 접어야 하는데 이는 범위 밖).

### 2. 칸반 — 스크롤 가능 여부 힌트

`.kanban-scroll` 컨테이너에 실제로 오른쪽에 더 스크롤할 내용이 있을 때만 얇은 인셋 힌트를 표시한다. `ViewKanban` 컴포넌트에 `ref` + `scroll`/`resize` 리스너를 붙여 `scrollLeft`/`scrollWidth`/`clientWidth`를 비교하고, 스크롤 가능한 쪽에 맞는 modifier 클래스(`kanban-scroll--edge-l`, `kanban-scroll--edge-r`)를 토글한다.

```css
.kanban-scroll--edge-r { box-shadow: inset -12px 0 8px -8px rgba(0,0,0,0.10); }
.kanban-scroll--edge-l { box-shadow: inset  12px 0 8px -8px rgba(0,0,0,0.10); }
```

`DESIGN.md`의 "Flat-By-Default Rule"(그림자는 페이지 위에 뜬 레이어에만)을 감안해, 이건 신규 elevation이 아니라 "스크롤 가능"이라는 기능적 신호로만 쓰는 인셋 힌트임을 주석으로 남긴다. `prefers-reduced-motion`과는 무관(애니메이션 아님)하므로 별도 처리 불필요.

### 3. 칸반 — 스크롤 스냅

```css
.kanban-scroll { scroll-snap-type: x proximity; }
.kanban__col { scroll-snap-align: start; }
```

`proximity`(`mandatory`가 아님)를 쓰는 이유: 데스크탑에서 트랙패드/마우스 휠 스크롤 시 강제로 스냅되어 부자연스러워지는 걸 막기 위함 — 터치 스와이프처럼 관성이 큰 제스처에서만 자연스럽게 스냅된다.

### 4. 생산요청 테이블 — 컬럼 폭 재조정

`sales-input.jsx:372-376`의 `<th>` 인라인 스타일을 `minWidth` → `width`로 바꾸고, 모델 컬럼만 폭을 지정하지 않아 남는 공간을 흡수하게 한다:

```jsx
<th scope="col" style={{ width: 34, ... }}>{/* 체크박스, 기존 유지 */}</th>
<th style={{ width: 32, textAlign: 'center' }}>#</th>
<th>충전속도 (모델) <span className="field__req">*</span></th>  {/* width 지정 제거 */}
<th style={{ width: 160 }}>충전기 용도</th>
<th style={{ width: 190 }}>수량</th>
{!isEdit && <th style={{ width: 44 }}></th>}
```

`용도`(160px), `수량`(190px)은 현재 `minWidth`(120/140)에 실제 콘텐츠(칩 2개, ± 스테퍼) 폭을 더해 여유를 준 값 — 정확한 수치는 구현 중 실측해 조정한다. `<td>` 쪽은 이미 명시적 `width`를 걸지 않고 있으므로(모델 셀의 `minWidth: 170`만 예외) 그대로 두면 `<th>` 값이 컬럼 폭을 결정한다.

### 5. 생산요청 테이블 — 헤더 sticky

```css
.table thead th {
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 1;
}
```

주의점: 현재 테이블을 감싸는 `<div style={{ overflowX: 'auto' }}>`(`sales-input.jsx:362`)는 `overflow-y`를 명시하지 않았는데, CSS 스펙상 `overflow-x`가 `visible`이 아니면 `overflow-y`도 `auto`로 강제 계산되어 의도치 않게 자체 스크롤 컨테이너가 될 수 있다. `sticky`가 페이지 스크롤이 아니라 이 div 기준으로 동작하면 안 되므로, `overflowY: 'visible'`을 명시적으로 같이 지정한다:

```jsx
<div style={{ overflowX: 'auto', overflowY: 'visible' }}>
```

`.topnav`는 `position: fixed`/`sticky`가 아니므로(코드 확인 완료) 헤더가 뷰포트 최상단(`top: 0`)에 고정되는 동안 상단 네비게이션과 겹칠 일은 없다 — 다만 실제 브라우저에서 스크롤해보며 겹침 여부를 최종 확인한다.

## 영향받는 파일

| 파일 | 변경 내용 |
|---|---|
| `production-waiting.jsx` | `.kanban` 인라인 스타일의 `minmax(200px,…)` → `var(--kanban-colmin, 200px)`, 스크롤 힌트용 `ref`/이벤트 리스너 추가 |
| `sales-input.jsx` | `<thead>` 내 `<th>` 인라인 스타일(`minWidth`→`width`), 테이블 래퍼 div에 `overflowY: 'visible'` 추가 |
| `styles.css` | `.kanban`(900px 미디어쿼리) 컬럼 최소폭, `.kanban-scroll--edge-l/r` 인셋 힌트, `scroll-snap` 2줄, `.table thead th` sticky |

## 테스트 계획

자동화 테스트가 없는 저장소이므로 수동 검증:

- 데스크탑(1440px)·태블릿 세로(834px)·태블릿 가로(1112px) 3개 폭에서 생산대기 칸반을 열어 컬럼 잘림/스크롤 힌트/스냅 동작 확인
- 생산요청 화면에서 행 20개 이상 추가 후 스크롤하며 헤더 고정 확인, 상단 네비게이션과 겹치지 않는지 확인
- 데스크탑 와이드 폭에서 생산요청 테이블 컬럼 간 빈 공간이 줄었는지 확인
- 기존 기능(행 선택, 일괄 지정, 모델 선택 모달, 칸반 카드 클릭 → 모달 오픈) 회귀 없는지 확인

## 전제 · 제약 · 미확정 사항

- `용도`/`수량` 컬럼의 정확한 `width`(160px/190px)는 구현 중 실제 렌더링을 보고 조정 가능 — 목표는 "남는 빈 공간 제거"이지 특정 px 고정이 아니다.
- 900px 이하에서도 4컬럼이 완전히 잘리지 않게 하려면 컬럼을 접거나(아코디언) 리스트 뷰로 전환해야 하는데, 이는 구조적 재설계로 이번 스코프 밖이다 — `--kanban-colmin: 168px`로 잘림을 줄이는 선에서 마무리한다.
- `sticky` 헤더가 실제 브라우저(특히 Safari/iOS — 생산 현장 태블릿이 iOS일 가능성)에서 `overflow` 강제 계산 이슈 없이 동작하는지는 구현 후 실기기 확인이 필요하다.
