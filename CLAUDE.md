# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# 로컬 개발 서버 (정적 파일 서빙 — api/ 서버리스 함수 미포함)
npm run dev          # npx serve . -p 3000 → localhost:3000

# api/ 서버리스 함수까지 포함한 풀스택 로컬 실행 (Vercel CLI 필요)
npx vercel dev       # vercel dev → localhost:3000

# 역할별 권한 테스트 (auth.jsx의 ROLE_TABS를 파싱해 검증)
npm test             # node tests/role-permissions.test.js

# 의존성 설치
npm install

# Supabase 설정 초기화 (최초 1회)
cp supabase-config.example.js supabase-config.js
# 이후 supabase-config.js 에 실제 URL/키 입력
```

빌드/번들 스텝 없음 — JSX를 Babel Standalone이 브라우저에서 직접 트랜스파일. 단일 테스트 파일(`tests/role-permissions.test.js`)만 존재하며 `npm test`로 전체 실행.

## 작업 절차 (모든 코드 변경 시 필수)

이 코드베이스는 빌드 스텝이 없어서 실수가 컴파일 에러로 잡히지 않고 런타임에 조용히 깨진다. 아래 절차를 생략하지 말 것.

1. **읽기 먼저**: 수정할 파일 전체를 Read로 읽는다. 검색 스니펫이나 기억만으로 편집 금지. 전역 함수/상태를 바꿀 때는 `grep`으로 모든 사용처를 먼저 확인.
2. **기존 패턴 모방**: 새 코드를 쓰기 전에 같은 종류의 기존 구현 1개를 찾아 컨벤션(훅 별칭, actions 경유, CSS 클래스)을 그대로 따른다. 새 화면이면 `order-lookup.jsx`, 모달이면 `production-waiting.jsx`의 `SalesCompletionModal`, Drawer면 `ship-inspection.jsx`가 참고 기준.
3. **최소 변경**: 요청 범위 밖 리팩토링·리네이밍·재정렬 금지.
4. **검증 (생략 금지)**:
   - `npm test` 실행
   - 별칭 없는 훅 사용 검사: `grep -n "const { useState }" *.jsx` → 결과가 나오면 실패
   - 뷰의 Supabase 직접 호출 검사: `grep -n "supabase\.from" *.jsx` → `db.js` 외에서 나오면 실패
   - 새 `.jsx` 파일 추가 시: `index.html`의 script 삽입 위치가 로드 순서(=의존성 순서)에 맞는지 확인
5. **정직한 보고**: 실행해보지 못한 부분(브라우저 확인 필요 등)은 "검증 못 함"으로 명시. 근거 없이 "완료"라고 하지 말 것.

### 새 화면(view) 추가 체크리스트

- [ ] 파일별 고유 접미사로 React 훅 별칭 (아래 규칙 참조)
- [ ] `index.html`에 `<script type="text/babel">` 태그 — 의존성 순서에 맞는 위치
- [ ] `auth.jsx`의 `ROLE_TABS`에 뷰 등록 (누락 시 해당 역할은 `['lookup']`으로 폴백)
- [ ] `app.jsx`의 view 라우팅에 컴포넌트 연결
- [ ] `useStore()` 훅으로 리렌더 구독
- [ ] `styles.css` 기존 클래스(`btn`, `card`, `table`, `toolbar`) 사용 — 새 클래스·인라인 스타일 남발 금지
- [ ] 터치 타깃 44×44px 이상, `prefers-reduced-motion` 대응

### 금지 패턴 → 올바른 패턴

| 금지 | 대신 |
|---|---|
| `const { useState } = React` | `const { useState: useStateXXX } = React` (파일 고유 접미사) |
| 뷰에서 `supabase.from(...)` 직접 호출 | `window.actions.*` 또는 `window.PMDB.*` |
| `getModels().find(m => m.name === order.model_name)` | `window.findModelInfo(order.model_name)` (코드·표시명 혼재) |
| `order.status = 'COMPLETED'` 직접 대입 | actions의 전환 액션 사용 (`tb_order_history` 이력 기록 포함) |
| CSV 내보내기 시 BOM 누락 | UTF-8 BOM 삽입 (`quality-AwaitPickup.jsx`의 `downloadCSV` 참고) |
| Tailwind/CSS 모듈/styled-components 도입 | `styles.css` 클래스 + `:root` CSS 변수 |
| `supabase-config.js` 수정·커밋 | 절대 금지 (`.gitignore` 대상) |

### 멈추고 사용자에게 물어볼 것

다음이 필요해지면 구현하지 말고 먼저 확인: DB 스키마 변경(컬럼 추가/삭제/타입 변경), 오더 상태 전환 규칙 변경, `ROLE_TABS` 권한 변경, `seed.sql`/`supabase-schema.sql` 재실행이 필요한 변경, 기존 데이터 마이그레이션. 요청을 두 가지 이상으로 해석할 수 있을 때도 마찬가지.

## 프로덕트 컨텍스트

EV 충전기 영업·생산 통합 관리 시스템(COMS). 사용자는 이지트로닉스 내부 직원 4개 역할(영업·생산·품질·관리자). **사무실(데스크탑)과 현장(태블릿/모바일)을 혼용**하므로 터치 타깃(44×44px 이상)·반응형 레이아웃이 필수다.

디자인 원칙:
- 상태 배지(PENDING / IN_PROGRESS / AWAIT_PICKUP / COMPLETED)가 주변에 묻히지 않도록 충분한 대비 유지
- Pretendard 폰트, CSS 변수 기반 테마 (`--primary`, `--r-md` 등)
- AI 양산 디자인(글래스모피즘, 그라데이션 텍스트)과 글로벌 SaaS 복제 스타일 지양
- `prefers-reduced-motion` 대응 필수

## DB 초기화 및 마이그레이션

- **초기 세팅**: `seed.sql` 전체를 Supabase SQL 에디터에서 실행 (테이블 생성 + 시드 데이터 포함)
- **스키마 변경만**: `supabase-schema.sql`의 마이그레이션 전용 섹션만 실행 (기존 데이터 유지, 신규 컬럼·제약 추가)
- 출하 전 사진은 Supabase Storage **`ship-photos`** 버킷 사용
- AS 사진 첨부는 Supabase Storage **`as-photos`** 버킷 사용 (퍼블릭 버킷으로 설정 필요)

## 아키텍처

### 실행 흐름

`index.html`이 CDN에서 React 18, Babel Standalone, Supabase JS, Chart.js 4(대시보드 차트용)를 로드한 뒤 모든 `.jsx` 파일을 `<script type="text/babel">`로 순서대로 삽입. Babel이 브라우저에서 실시간 트랜스파일. `db.js`는 일반 `<script>`(IIFE로 감싼 순수 JS)로 이보다 먼저 로드된다.

**로드 순서 = 의존성 순서:**
```
db.js
→ tweaks-panel.jsx → icons.jsx → auth.jsx → shell.jsx
→ production-request-modal.jsx → production-waiting.jsx → ship-inspection.jsx → quality-AwaitPickup.jsx
→ order-lookup.jsx → admin-users.jsx
→ as-components.jsx → as-receipt.jsx → as-processing.jsx
→ dashboard.jsx → app.jsx
```

각 `.jsx`는 별도 `<script>` 태그로 로드되며 모듈 시스템이 없어 최상위 `function`/컴포넌트 선언이 전역 스코프에 그대로 노출된다. 따라서 실제 렌더링(사용자 상호작용) 시점에는 모든 스크립트가 이미 로드되어 있으므로, **파일 간 참조는 선언 순서와 무관하게 동작**한다(예: `production-waiting.jsx`가 자신보다 뒤에 로드되는 `ship-inspection.jsx`의 `FuncInspectionDrawer`를 문제없이 사용). 단, `db.js`는 IIFE로 감싸여 있어 내부 선언이 전역으로 노출되지 않으므로 다른 파일에서 참조해야 하는 것은 반드시 `window.X = ...`로 명시적으로 export해야 한다.

### React 훅 별칭 규칙 (필수)

여러 JSX 파일이 동일한 전역 스코프에 로드되기 때문에, 각 파일은 React 훅을 파일별 고유 접미사로 별칭해야 한다:

```js
// 예: as-receipt.jsx
const { useState: useStateAREC, useEffect: useEffectAREC, useMemo: useMemoAREC } = React;
```

**새 JSX 파일을 추가할 때 반드시 이 패턴을 따를 것.** 별칭 없이 `useState`를 전역에 노출하면 다른 파일과 충돌한다.

### 데이터 레이어 (`db.js`)

`window.PMDB`에 단일 객체로 노출된 캐시+Supabase 하이브리드:

- **동기 읽기**: `PMDB.loadOrders()`, `PMDB.loadUsers()` 등은 메모리 캐시 반환 → UI 즉시 렌더링
- **비동기 쓰기**: 로컬 캐시 먼저 변경 → 백그라운드에서 Supabase 동기화 (`dbWrite` 헬퍼)
- **시딩**: `SEED_USERS`, `SEED_MASTER_CUSTOMERS` 등 상수를 DB에 없으면 자동 삽입
- **디버깅**: 브라우저 콘솔에서 `window.pmdbLogs()` 또는 `window.pmdbLogs('ERROR')` 로 DB 작업 로그 조회

뷰 컴포넌트는 Supabase를 직접 호출하지 않고 반드시 `window.actions.*` 또는 `window.PMDB.*`를 통해 데이터 조작.

**시리얼 채번 유틸도 `db.js`에 있다** (`SERIAL_MODEL_CODES`, `makeSerialDateCode`, `window.isValidSerialNo`, `window.findModelCodeFromSerial`, `PMDB.generateSerialSuggestion(model, usage, prodDate, excludeOrderId)`). `PMDB.addOrder(form)`가 `PENDING` 오더 생성 직후(모델에 등록된 채번 규칙이 있으면) 이 유틸로 시리얼을 자동 채번해 `saveProduction`으로 즉시 저장한다 — **생산요청 등록 버튼을 누르는 순간 시리얼이 이미 부여**되며 생산요청 칸반 카드에도 바로 표시된다. `PMDB.startProduction(order_id)`(`PENDING → IN_PROGRESS`)는 이미 채번된 시리얼이 있으면 재채번하지 않고, 없을 때만(예: `revertOrder`로 시리얼이 초기화된 경우) 새로 채번한다.

**충전기 설치 정보 (`tb_chargepoint_infor`)**: `cache.chargepoints`에 캐시. `PMDB.getChargepointBySerial(serial_no)` — 시리얼 대소문자·공백 무시 조회, `PMDB.addChargepoint(data)` — 중복 시리얼 거부 후 삽입. AS 접수(`as-receipt.jsx`)에서 시리얼번호로 조회했을 때 없으면 등록 모달을 띄우는 데 사용.

**Supabase 테이블 목록:**

| 테이블 | 설명 |
|---|---|
| `tb_users` | 사용자 계정 (role 허용값: `admin`, `sales`, `production`, `quality`) |
| `tb_sales_order` | 영업 오더. `customer_name`은 NULL 허용(생산요청 단계엔 아직 비어 있음) |
| `tb_usagetype_public` | 공용 충전기 전용 필드 (`station_id`, `charger_no`, `router_no`, `usim_no`) — `tb_sales_order`와 `order_id`로 1:1 연결 |
| `tb_production_info` | 생산 정보 (`prod_date`, `serial_no`, `inspection_date`, `sw_version`, `fw_version`) |
| `tb_customer_manager` | 고객사 담당자 |
| `tb_order_history` | 오더 변경 이력 |
| `tb_as_reception` | AS 접수 |
| `tb_as_log` | AS 처리 상태 변경 이력 |
| `tb_as_photo` | AS 첨부 사진 메타데이터 |
| `tb_func_inspection` | 기능 검사 성적서 (order_id UNIQUE, checks: JSON 문자열) |
| `tb_ship_inspection` | 출하 검사 성적서 (order_id UNIQUE, checks: JSON 문자열, photos: JSON 배열) |
| `tb_master_customer` | 고객사 마스터 |
| `tb_master_cpo` | CPO 운영사 마스터 |
| `tb_master_model` | 충전기 모델 마스터 (`model_code`, `description`, `power` 필드. `name` 컬럼 없음) |
| `tb_program_version` | SW/FW 버전 마스터 (`type`, `tag`, `released`, `stable`) — SW·FW 통합 테이블 |
| `tb_chargepoint_infor` | 충전기 설치 정보 (`serial_no`, `model_name`, `order_id`, `install_address`) |

**`tb_sales_order` 주요 필드:** `customer_name`(발주처, NULL 허용), `customer_manager`(발주처 담당자), `model_name`, `delivery_date`, `install_address`, `cable_length`, `field_manager_phone`(발주처 담당자 전화번호), `cpo_name`, `usage_type`(공용/비공용), `status`, `requested_by`(생산요청자 이름 — `tb_users.name` 스냅샷)

**`tb_usagetype_public` 주요 필드:** `order_id`, `station_id`, `charger_no`, `router_no`, `usim_no` — `usage_type='공용'` 오더에 한해 생성

`window.MASTER` 같은 마스터 데이터 전역 캐시는 존재하지 않는다 — 케이블 길이 등 마스터 목록이 필요하면 개별 컴포넌트가 자체 상수(예: `production-waiting.jsx`의 `CABLE_LENGTH_OPTIONS`)를 쓰거나 `PMDB.getModels()`류 함수를 직접 호출한다.

### 모델 코드 구분 (중요)

`tb_master_model`의 실제 컬럼: `model_code`, `description`, `power`. **`name` 컬럼은 DB에 없다.**

`db.js`가 `model_code` 컬럼을 `model` 키로 매핑하여 `PMDB.getModels()`가 반환하는 객체는 `{ model, description, power }` 형태다.

**주의: 기존 데이터에는 `order.model_name`에 표시명과 코드가 혼재**할 수 있다. 모델 마스터 조회는 반드시 전역 헬퍼를 사용할 것 (`shell.jsx` 정의):
```js
const modelInfo = window.findModelInfo(order.model_name); // 양방향 매칭
// UI 표시: modelInfo?.model || order.model_name
```
`getModels().find(m => m.name === ...)` 직접 비교 금지 (`name` 필드는 DB에 없음).

모델 필터 `<select>`(`production-waiting.jsx`, `quality-AwaitPickup.jsx`)는 옵션 라벨로 `m.description`이 아니라 `m.model`(model_code)을 그대로 표시한다. `production-request-modal.jsx`의 `ModelSelectModal`은 충전속도(`power`) 칩을 먼저 선택해야 해당 속도의 모델 목록이 나타나며(선택 전에는 빈 안내만 표시), 목록 항목에는 `model_code`와 `description`을 함께 보여준다.

### 전역 상태 (`shell.jsx` → `window.__pm_store__`)

React Context 없이 `window.__pm_store__`에 단일 상태 객체를 두고, `Set<function>`인 `listeners`에 컴포넌트 리렌더러를 등록하는 수동 pub-sub 패턴.

- `useStore()` — 리스너 등록 + 강제 리렌더 훅 (모든 뷰에서 사용)
- `window.notify()` — 모든 리스너 호출
- `window.actions` — 상태 변경 액션 집합 (`addOrder`, `updateOrder`, `startProduction`, `completeOrder`, `shipOrder`, `revertOrder`, `revertToAwaitPickup`, `revertToInProgress`, `awaitToInProgress`, `setView`, `addAsReception`, `updateAsReception` 등)

```
상태 변경: actions.X() → PMDB 캐시 수정 → store 업데이트 → notify() → 전체 리렌더
```

**store 주요 필드:**
- `view` — 현재 활성 화면 (`'dashboard' | 'waiting' | 'AwaitPickup' | 'lookup' | 'admin' | 'as-receipt' | 'as-processing'`)
- `selectedOrderId` / `editingOrderId` — 현재 선택/편집 중인 오더
- `currentUser` — 로그인 사용자 객체
- `asReceptions` / `selectedAsId` — AS 관련 상태

`localStorage` 영속 키:
- `pm_session` — 로그인 `user_id` (페이지 새로고침 유지)
- `pm_tweaks` — Tweaks 패널 설정값 (단일 JSON 객체)

### 역할 기반 라우팅 (`auth.jsx` → `window.ROLE_TABS`)

`ROLE_TABS` 맵이 역할마다 허용 뷰 배열 정의.

| store.view      | 컴포넌트                   | 접근 역할                     |
|-----------------|---------------------------|-------------------------------|
| `dashboard`     | `DashboardScreen`         | admin, sales, production, quality (전체) |
| `waiting`       | `ProductionWaitingScreen` | admin, sales, production      |
| `AwaitPickup`   | `ProductionCompleteScreen`| admin, production, quality     |
| `lookup`        | `OrderLookupScreen`       | 전체                           |
| `admin`         | `AdminUsersScreen`        | admin 전용                    |
| `as-receipt`    | `AsReceiptScreen`         | admin, quality, sales              |
| `as-processing` | `AsProcessingScreen`      | admin, sales, quality               |

`ROLE_TABS`에 정의되지 않은 역할은 `['lookup']`으로 폴백된다. 모든 역할의 `ROLE_TABS` 배열 맨 앞에 `'dashboard'`가 포함된다. 독립된 "생산 요청"·"생산 입력" 화면은 없다 — 생산요청 등록/수정과 시리얼·검사 입력 모두 `waiting`(칸반) 카드/버튼 클릭 시 뜨는 모달로 처리한다(아래 "생산 워크플로우" 참고).

### 대시보드 (`dashboard.jsx`)

주간·월간 수량 지표를 역할별로 보여주는 화면. Chart.js 4(UMD, CDN) 막대 차트 + KPI 카드(`.stat`/`.statrow` 클래스 재사용) 조합.

- **영업**: 발주수량(등록일 기준)
- **생산**: 생산수량 — 생산일자 기준, 출하대기 전 상황까지 집계
- **품질**: AS건수 — 처리완료 시점 기준
- **admin**: 위 지표 전체를 `<button className="stat">` 버튼으로 전환하며 확인 가능

기간 단위(주간/월간)는 `.chip` 토글로 전환. Chart.js 인스턴스는 `useEffectDASH` 안에서 생성하고 cleanup 시 반드시 `destroy()` 호출(재렌더 시 캔버스 중복 생성 방지). 데이터가 없을 때는 빈 상태 문구 + 표 형태 폴백을 렌더링한다.

오더 파이프라인 KPI 타일의 `AWAIT_PICKUP` 카운트는 `window.isSalesInfoComplete(o)`가 `true`인 것만 센다(생산완료 단계에서 영업정보 입력 대기 중인 건은 제외) — `TopNav`의 "출하대기" 뱃지 카운트도 동일 규칙.

### 생산 워크플로우 (생산요청 → 생산착수 → 생산완료 → 출하대기)

오더 상태는 `PENDING → IN_PROGRESS → AWAIT_PICKUP → COMPLETED` 4개뿐이지만, 업무 단계는 4개다: **생산완료와 출하대기는 둘 다 `AWAIT_PICKUP` 상태**이며 `window.isSalesInfoComplete(order)`(영업정보 입력 완료 여부 — `shell.jsx` 정의)로만 구분한다.

1. **생산요청** (`production-waiting.jsx`의 "+ 신규 생산요청" 버튼 → `production-request-modal.jsx`의 `ProductionRequestModal`) — 영업이 모델·용도(공용/비공용)·수량만 입력해 `PENDING` 오더를 생성하는 모달(라우팅 없음). 등록 시 `requested_by`에 `currentUser.name`을 저장. 고객사·납품정보 등은 이 단계에서 입력하지 않는다(발주처 등록 필드 자체가 없음).
2. **생산착수** (`production-waiting.jsx`의 칸반, `ProductionEntryModal`) — 시리얼은 생산요청 등록 시점에 이미 채번되어 있으므로(위 참고) 이 단계에서는 그 값을 그대로 보여준다(수정/재생성 가능). 칸반의 "생산착수" 컬럼 카드를 클릭하면 뜨는 모달에서 생산일자·시리얼·검정일자(공용만)·SW/FW버전·기능검사 성적서(`FuncInspectionDrawer`)를 입력하고 제출하면 `completeOrder`로 `AWAIT_PICKUP` 전환.
3. **생산완료** (`production-waiting.jsx`의 칸반, `SalesCompletionModal`) — `AWAIT_PICKUP`이면서 `isSalesInfoComplete`가 `false`인 오더. "생산완료" 컬럼 카드를 클릭하면 뜨는 모달에서 케이블길이·발주처·발주처 담당자·발주처 담당자 전화번호(`field_manager_phone`)·납품장소·납품일자(+공용이면 충전소ID·충전기ID·라우터번호·USIM번호·CPO운영사)를 입력, `updateOrder`로 저장.
4. **출하대기** (`quality-AwaitPickup.jsx`, `ProductionCompleteScreen`) — `AWAIT_PICKUP`이면서 `isSalesInfoComplete`가 `true`인 오더만 목록에 표시. 출하 전 검사 성적서 작성 + 출하완료(`shipOrder`) 처리. 행 클릭은 역할 구분 없이 `ShipInspectionDrawer`를 바로 연다.

생산착수·생산완료 컬럼의 칸반 카드에는 필드 채움 여부 기준 진행율 바(`stageProgress()`)가 표시된다 — 분모 필드 목록은 각각 `ProductionEntryModal`/`SalesCompletionModal`의 `errors` 검증 필드와 동일하게 유지해야 한다(한쪽만 필드를 추가하면 진행율이 실제 필수 입력과 어긋난다).

칸반 카드 클릭 동작(`production-waiting.jsx`의 `onPick`)은 컬럼·역할별로 분기한다: 생산요청 카드는 `sales`만 `editOrder`(모델/용도 수정 — `ProductionRequestModal`을 편집 모드로 염), 생산착수 카드는 `production`/`admin`만 `ProductionEntryModal`, 생산완료 카드는 `sales`/`admin`만 `SalesCompletionModal`, 출하대기 카드는 `AwaitPickup` 뷰 접근 권한이 있는 역할만 `setView('AwaitPickup')`로 이동.

`editOrder(id)`(`shell.jsx`)는 `s.editingOrderId`를 설정하고 `setView('waiting')`으로 이동시킬 뿐 자체적으로 모달을 열지 않는다 — `production-waiting.jsx`가 `s.editingOrderId`를 감시하는 `useEffect`로 감지해 해당 PENDING 오더를 편집 모드 `ProductionRequestModal`로 연다. `order-lookup.jsx` 드로어의 "영업 정보 수정" 버튼(`canEditSales` — `sales`/`admin`, `PENDING` 상태)도 동일하게 `editOrder()`를 호출해 이 경로를 탄다.

`db.js`의 `updateOrder(order_id, form)`는 `PENDING` 또는 `AWAIT_PICKUP` 상태에서만 허용하며, `form`에 실제로 담긴 키만 병합한다(부분 업데이트) — 생산요청 단계 수정과 생산완료 단계 입력이 서로 다른 필드 부분집합을 보내기 때문에 전체 덮어쓰기를 하면 안 된다.

**일괄 처리(배치 생산입력) 기능은 현재 없다** — 생산요청(`PENDING`) 카드를 다중 선택해 한 번에 "생산착수"로 전환하는 것만 가능(`production-waiting.jsx`의 체크박스 선택 + `quickStart`).

### 검사 성적서 모듈 (`ship-inspection.jsx`)

두 Drawer 컴포넌트를 제공한다:

- `ShipInspectionDrawer` — 출하 검사 성적서
- `FuncInspectionDrawer` — 기능 검사 성적서 (선택적 prop `modelInfo` 또는 내부 조회 폴백)

`production-waiting.jsx`(생산착수 모달), `quality-AwaitPickup.jsx`(출하대기), `order-lookup.jsx`(조회) 에서 공용으로 사용한다.

`ShipInspectionDrawer`의 "사진첨부"는 탭이 아니라 `.switch` 토글 스위치(스타일은 `styles.css`의 재사용 가능한 `.switch`/`.switch__track`/`.switch__input` 클래스)로 켜고 끈다. 토글이 켜지면 체크리스트 본문 아래에 `ShipPhotoTab`이 인라인으로 렌더링된다.

**체크리스트 JSON 로딩**: 마운트 시 `docs/ship/{modelCode}.json` / `docs/func/{modelCode}.json`을 fetch. 파일이 없으면 JS 내 `SHIP_CHECKLIST_DEFAULT` / `FUNC_CHECKLIST_DEFAULT`를 사용. 저장 시 `_checklist` 필드에 스냅샷 포함 → 성적서 표시 시 재사용. 체크리스트 항목은 `type: 'checkbox'` (boolean) 또는 `type: 'input'` (string) 지원.

**전역 헬퍼 함수** (`ship-inspection.jsx` 정의):
- `window.setFuncInspection(orderId, data)` — PMDB 저장 + store 갱신
- `window.setShipInspection(orderId, data)` — PMDB 저장 + store 갱신

**데이터 읽기/쓰기:**
- `PMDB.saveFuncInspection(id, data)` / `PMDB.getFuncInspection(id)`
- `PMDB.saveShipInspection(id, data)` — `null` 전달 시 삭제
- `PMDB.getShipInspectionDB(id)` — `checks`가 이미 파싱된 객체 반환
- `PMDB.getShipPhotos(id)` — 출하 전 첨부 사진 배열

### 오더 상태 전환 및 되돌리기

```
PENDING →[startProduction]→ IN_PROGRESS →[completeOrder]→ AWAIT_PICKUP →[shipOrder]→ COMPLETED
```

**되돌리기 액션은 `order-lookup.jsx`의 오더 상세 드로어**(role: production/admin)에서 상태별로 노출된다:

| 액션 | 전환 | 데이터 처리 |
|---|---|---|
| `revertOrder(id)` | 어느 상태 → `PENDING` | serial null 초기화, 기능·출하 검사 행 삭제, 출하 사진 스토리지 삭제 |
| `revertToAwaitPickup(id)` | `COMPLETED → AWAIT_PICKUP` | 모든 데이터 유지 |
| `revertToInProgress(id)` | `COMPLETED → IN_PROGRESS` | 모든 데이터 유지 |
| `awaitToInProgress(id)` | `AWAIT_PICKUP → IN_PROGRESS` | 모든 데이터 유지 |

각 전환마다 `tb_order_history`에 이력 기록. `production-waiting.jsx`의 `ProductionEntryModal`에도 "대기로 되돌리기"(`IN_PROGRESS → PENDING`, `revertOrder`) 버튼이 자체적으로 있다.

### AS 모듈 (`as-components.jsx`, `as-receipt.jsx`, `as-processing.jsx`)

**전역 상수** (`as-components.jsx`에서 정의):
- `window.FAULT_TYPES` — 고장 유형 선택지
- `window.AS_STATUS_LIST` — `['접수대기', '담당자배정', '처리중', '처리완료']`
- `window.AS_ACTION_TYPES` — 처리 유형 선택지

**데이터 흐름:**
```
AS 접수 등록 (as-receipt)
  → PMDB.addAsReception() → tb_as_reception
  → PMDB.addAsLog() (상태: '' → '접수대기') → tb_as_log

AS 처리 (as-processing)
  → PMDB.updateAsReception() → tb_as_reception
  → PMDB.addAsLog() (상태 변경 시만) → tb_as_log
  → PMDB.addAsPhoto() → tb_as_photo + Supabase Storage as-photos 버킷
```

접수번호는 `AS-{연도,월,일}-{4자리 순번}` 형식으로 자동 생성 (예: `AS-250101-0001`).

**시리얼번호 조회 → 신규 등록**: AS 접수 폼에서 시리얼번호로 `PMDB.getChargepointBySerial()` 조회 → 못 찾으면 `AddChargepointModal`(모델 선택 · 설치주소 필수 · 오더 ID 선택)을 띄워 `PMDB.addChargepoint()`로 `tb_chargepoint_infor`에 등록한 뒤 접수 폼에 이어서 사용한다.

### 생산요청 등록·수정·취소 (`production-request-modal.jsx`의 `ProductionRequestModal`)

라우팅 없는 모달 하나로 신규 등록(다중 행)과 기존 오더 수정(단일 행)을 모두 처리한다 — `order` prop이 없으면 신규 등록 모드, 있으면 해당 PENDING 오더 편집 모드.

**신규 등록**: 행마다 모델·용도(공용/비공용)·수량(`row.qty`)만 입력한다. `clampQty(v, max=500)`가 1~500 범위로 정규화하며, 제출 시(`submit()`) 각 행을 `qty`만큼 반복해 `addOrder`를 호출한다(공용/비공용 구분 없이 모두 수량 배수 등록 가능 — 발주처·통신정보 같은 개별 식별자는 이제 생산완료 단계에서 오더별로 입력하므로 생성 시점에는 제약이 없다). 제출 후에도 모달은 닫히지 않고 행을 초기화해 연속 등록을 지원한다. `PMDB.addOrder`가 오더 생성 직후 시리얼을 자동 채번(`generateSerialSuggestion` + `saveProduction`)하므로 등록 버튼을 누르는 즉시 시리얼이 부여되고 생산요청 칸반 카드에도 바로 표시된다(모델에 채번 규칙이 없으면 생략). 수량 배수 등록 시에도 각 유닛이 순번을 증가시키며 중복 없이 채번된다.

- **행 복제**: 행 목록의 복제 아이콘(`duplicateRow(i)`)이 현재 행(모델·용도·수량)을 그대로 복사해 바로 아래에 추가.
- **용도 상속**: `addRow()`로 새 행을 추가하면 직전 행이 비공용이었을 경우 새 행도 비공용으로 시작한다(기본값은 공용).
- **수량 입력 타이핑**: 입력 중에는 숫자만 허용하고 clamp를 적용하지 않다가, `onBlur` 시점에만 `clampQty()`로 1~500 범위 정리.

**수정**: `PENDING` 상태에서만 가능하며 모델·용도만 고칠 수 있다(`updateOrder(order.order_id, { model_name, usage_type })`). 저장·취소 모두 `onClose()`로 모달을 닫는다(별도 뷰 이동 없음).

**생산요청 취소** (수정 모드 전용, `sales`/`admin`만 노출): 모달 하단 "생산요청 취소" 버튼 → 확인 다이얼로그 → `window.actions.cancelOrder(order_id)`(`shell.jsx`). 이 액션은 `tb_order_history`에 `action:'cancel'` 이력을 먼저 기록한 뒤 `PMDB.deleteOrder(order_id)`로 `tb_sales_order`(및 공용이면 `tb_usagetype_public`) 행을 **완전히 삭제**한다 — `PENDING` 상태가 아니면 거부된다. 오더 자체가 삭제되므로 취소된 오더는 조회 화면에서 다시 열어볼 수 없고, 취소 이력은 DB 원시 기록으로만 남는다(전용 조회 UI 없음).

### Tweaks 패널 (`tweaks-panel.jsx`)

`useTweaks(defaults)` 훅이 `localStorage`에 값을 영속 저장. `app.jsx`에서 accent 색상, density, cornerStyle을 CSS 변수로 주입.

`/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` 주석 사이의 JSON 블록이 외부 editmode 도구로 조작 가능한 기본값(파일 자체의 문서화용 예시이며 실제 tweak 값과는 별개).

### CSV 내보내기

`quality-AwaitPickup.jsx`의 `downloadCSV()` 헬퍼는 Excel 한국어 깨짐 방지를 위해 UTF-8 BOM(`﻿`)을 파일 앞에 삽입한다. 다른 화면에서 CSV를 내보낼 때도 동일한 방식 사용.

### Vercel Serverless (`api/`)

| 엔드포인트               | 파일               | 역할                                                  |
|--------------------------|--------------------|-------------------------------------------------------|
| `GET /supabase-config.js`| `api/config.js`    | Vercel 환경변수 → 브라우저 `window.SUPABASE_URL/KEY` 주입 (`vercel.json`의 rewrite로 연결) |

로컬에서 `vercel dev` 실행 시 `api/` 서빙됨. `npx serve`만으론 api/ 동작 안 함 (이 경우 로컬 `supabase-config.js` 파일이 직접 로드됨).

로그인은 `tb_users` 기반 ID/비밀번호 방식(`PMDB.authenticate`)만 사용한다.

## 주요 설계 규칙

- **CSS 클래스 이름 고정**: `styles.css`의 클래스(`btn`, `card`, `table`, `toolbar` 등)를 모든 뷰에서 직접 사용. CSS 모듈/Tailwind 없음. 클래스 이름 변경 시 JSX도 함께 수정.
- **CSS 변수로 테마**: 색상·반지름·그림자는 `:root` 변수로 관리. `app.jsx`의 tweaks가 JS로 덮어씀.
- **supabase-config.js**: `.gitignore` 대상. 절대 커밋 금지.

## 환경 변수 (Vercel)

| 변수               | 설명                           |
|--------------------|-------------------------------|
| `SUPABASE_URL`     | Supabase 프로젝트 URL          |
| `SUPABASE_ANON_KEY`| Supabase anon public 키        |

## 응답·커뮤니케이션 지침 (CLAUDE-FABLE-5 발췌)

CLAUDE-FABLE-5.md(모델 시스템 프롬프트)에서 이 저장소 작업에 실제로 적용되는 규칙만 발췌했다. 안전 정책·저작권·아티팩트·툴 스키마 등 챗 인터페이스 전용 내용은 제외. 위의 프로젝트 규칙과 충돌하면 프로젝트 규칙이 우선한다.

### 톤과 형식

- 과잉 포맷팅 금지: 불릿·헤더·볼드는 내용이 다면적이어서 꼭 필요할 때만 사용하고, 설명과 보고는 자연스러운 문단 위주로 쓴다.
- 질문은 응답당 최대 1개. 모호한 요청도 먼저 최선을 다해 답한 뒤에 확인 질문을 덧붙인다.
- 따뜻하되 솔직하게: 방향이 틀렸다고 판단되면 근거를 들어 반대 의견을 낸다. 실수했을 때는 과도한 사과나 자기비하 없이 인정하고 수정에 집중한다.

### 작업 습관

- 요청에 파일이 있다고 암시되어도 실제 존재를 직접 확인한 뒤 작업한다 (사용자가 업로드나 생성을 잊었을 수 있음).
- 문서·보고서 산출물을 요청받으면 채팅에 내용만 출력하지 말고 실제 파일로 생성한다.
- 짧은 파일(<100줄)은 한 번에 작성하고, 긴 파일은 구조 잡기 → 섹션별 작성 → 검토 순으로 반복 작성한다.
- 라이브러리 버전, 외부 서비스(Supabase·Vercel) 최신 스펙 등 학습 데이터 이후 변했을 수 있는 사실은 기억으로 단정하지 말고 공식 문서를 확인한다.
