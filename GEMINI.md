## Commands

```bash
# 로컬 개발 서버 (정적 파일 서빙 — api/ 서버리스 함수 미포함)
npm run dev          # npx serve . -p 3000 → localhost:3000

# api/ 서버리스 함수까지 포함한 풀스택 로컬 실행 (Vercel CLI 필요)
npx vercel dev       # vercel dev → localhost:3000

# 역할별 권한 테스트
npm test             # node tests/role-permissions.test.js

# 의존성 설치
npm install

# Supabase 설정 초기화 (최초 1회)
cp supabase-config.example.js supabase-config.js
# 이후 supabase-config.js 에 실제 URL/키 입력
```

빌드/번들 스텝 없음 — JSX를 Babel Standalone이 브라우저에서 직접 트랜스파일.

## 작업 절차 (모든 코드 변경 시 필수)

이 코드베이스는 빌드 스텝이 없어서 실수가 컴파일 에러로 잡히지 않고 런타임에 조용히 깨진다. 아래 절차를 생략하지 말 것.

1. **읽기 먼저**: 수정할 파일 전체를 Read로 읽는다. 검색 스니펫이나 기억만으로 편집 금지. 전역 함수/상태를 바꿀 때는 `grep`으로 모든 사용처를 먼저 확인.
2. **기존 패턴 모방**: 새 코드를 쓰기 전에 같은 종류의 기존 구현 1개를 찾아 컨벤션(훅 별칭, actions 경유, CSS 클래스)을 그대로 따른다. 새 화면이면 `order-lookup.jsx`, Drawer면 `ship-inspection.jsx`가 참고 기준.
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

다음이 필요해지면 구현하지 말고 먼저 확인: DB 스키마 변경(컬럼 추가/삭제/타입 변경), 오더 상태 전환 규칙 변경, `ROLE_TABS` 권한 변경, `seed.sql` 재실행이 필요한 변경, 기존 데이터 마이그레이션. 요청을 두 가지 이상으로 해석할 수 있을 때도 마찬가지.

## 프로덕트 컨텍스트

EV 충전기 영업·생산 통합 관리 시스템(COMS). 사용자는 이지트로닉스 내부 직원 5개 역할(영업·생산·품질·A/S·관리자). **사무실(데스크탑)과 현장(태블릿/모바일)을 혼용**하므로 터치 타깃(44×44px 이상)·반응형 레이아웃이 필수다.

디자인 원칙:
- 상태 배지(PENDING / IN_PROGRESS / AWAIT_PICKUP / COMPLETED)가 주변에 묻히지 않도록 충분한 대비 유지
- Pretendard 폰트, CSS 변수 기반 테마 (`--primary`, `--r-md` 등)
- AI 양산 디자인(글래스모피즘, 그라데이션 텍스트)과 글로벌 SaaS 복제 스타일 지양
- `prefers-reduced-motion` 대응 필수

## DB 초기화 및 마이그레이션

- **초기 세팅**: `seed.sql` 전체를 Supabase SQL 에디터에서 실행 (테이블 생성 + 시드 데이터 포함)
- **스키마 변경만**: `supabase-schema.sql`의 마이그레이션 전용 섹션만 실행 (기존 데이터 유지, 신규 컬럼·제약 추가)
- AS 사진 첨부는 Supabase Storage **`as-photos`** 버킷 사용 (퍼블릭 버킷으로 설정 필요)
- 출하 전 사진은 Supabase Storage **`ship-photos`** 버킷 사용

## 아키텍처

### 실행 흐름

`index.html`이 CDN에서 React 18, Babel Standalone, Supabase JS, Chart.js(대시보드용)를 로드한 뒤 모든 `.jsx` 파일을 `<script type="text/babel">`로 순서대로 삽입. Babel이 브라우저에서 실시간 트랜스파일.

**로드 순서 = 의존성 순서:**
```
tweaks-panel.jsx → icons.jsx → auth.jsx → shell.jsx
→ production-request-modal.jsx → production-waiting.jsx → ship-inspection.jsx → production-mapping.jsx → quality-AwaitPickup.jsx
→ order-lookup.jsx → admin-users.jsx
→ as-components.jsx → as-receipt.jsx → as-processing.jsx
→ dashboard.jsx
→ app.jsx
```

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

**`window.MASTER`**: 마스터 데이터 전역 캐시. 현재 `MASTER.CABLE_LENGTHS: string[]`만 사용. 마스터 데이터 변경 시 `window.dispatchEvent(new CustomEvent('masterLoaded'))`를 발행하여 구독 컴포넌트에 갱신을 알린다.

**Supabase 테이블 목록:** (실제 DB 기준 — 2026-07-09 확인)

| 테이블 | 설명 |
|---|---|
| `tb_users` | 사용자 계정 (role 허용값: `admin`, `sales`, `production`, `quality`) |
| `tb_sales_order` | 영업 오더 (`cable_length`: smallint) |
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

**`tb_sales_order` 주요 필드:** `customer_name`, `customer_manager`, `model_name`, `delivery_date`, `install_address`, `cable_length`(smallint), `field_manager_name`, `field_manager_phone`, `cpo_name`, `usage_type`(공용/비공용), `status`

**`tb_usagetype_public` 주요 필드:** `order_id`, `station_id`, `charger_no`, `router_no`, `usim_no` — `usage_type='공용'` 오더에 한해 생성

### 모델 코드 구분 (중요)

`tb_master_model`의 실제 컬럼: `model_code`, `description`, `power`. **`name` 컬럼은 DB에 없다.**

`db.js`가 `model_code` 컬럼을 `model` 키로 매핑하여 `PMDB.getModels()`가 반환하는 객체는 `{ model, description, power }` 형태다.

**주의: 기존 데이터에는 `order.model_name`에 표시명과 코드가 혼재**할 수 있다. 모델 마스터 조회는 반드시 전역 헬퍼를 사용할 것 (`shell.jsx` 정의):
```js
const modelInfo = window.findModelInfo(order.model_name); // 양방향 매칭
// UI 표시: modelInfo?.model || order.model_name
```
`getModels().find(m => m.name === ...)` 직접 비교 금지 (`name` 필드는 DB에 없음).

### 전역 상태 (`shell.jsx` → `window.__pm_store__`)

React Context 없이 `window.__pm_store__`에 단일 상태 객체를 두고, `Set<function>`인 `listeners`에 컴포넌트 리렌더러를 등록하는 수동 pub-sub 패턴.

- `useStore()` — 리스너 등록 + 강제 리렌더 훅 (모든 뷰에서 사용)
- `window.notify()` — 모든 리스너 호출
- `window.actions` — 상태 변경 액션 집합 (`addOrder`, `completeOrder`, `setView`, `addAsReception`, `updateAsReception` 등)

```
상태 변경: actions.X() → PMDB 캐시 수정 → store 업데이트 → notify() → 전체 리렌더
```

**store 주요 필드:**
- `view` — 현재 활성 화면 (`'dashboard' | 'sales' | 'waiting' | 'mapping' | 'AwaitPickup' | 'lookup' | 'admin' | 'as-receipt' | 'as-processing'`)
- `waitingView` — 생산대기 화면 서브뷰 (`'kanban' | 'table' | 'card' | 'timeline'`)
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
| `dashboard`     | `DashboardScreen`         | 전체                          |
| `waiting`       | `ProductionWaitingScreen` | admin, sales, production      |
| `mapping`       | `ProductionMappingScreen` | admin, production             |
| `AwaitPickup`   | `ProductionCompleteScreen`| admin, production, quality     |
| `lookup`        | `OrderLookupScreen`       | 전체 (A/S 이력은 as 역할만)   |
| `admin`         | `AdminUsersScreen`        | admin 전용                    |
| `as-receipt`    | `AsReceiptScreen`         | admin, quality, sales              |
| `as-processing` | `AsProcessingScreen`      | admin, sales, quality              |

`ROLE_TABS`에 정의되지 않은 역할은 `['lookup']`으로 폴백된다.

### 시리얼 번호 생성 (`production-mapping.jsx`)

`SERIAL_MODEL_CODES` 맵이 모델 코드(`tb_master_model.model_code`, db.js에서 `model` 키로 노출)를 `[그룹코드, 타입코드]`로 매핑. `makeSerialDateCode(dateISO)`가 연도·월을 알파벳 코드로 변환 (2023년 = `A`, 이후 +1 알파벳씩). 생산 화면에서 시리얼 자동 채번에 사용.

### 검사 성적서 모듈 (`ship-inspection.jsx`)

`production-mapping.jsx`보다 먼저 로드되어야 한다(index.html 순서 참조). 두 Drawer 컴포넌트를 제공한다:

- `ShipInspectionDrawer` — 출하 검사 성적서
- `FuncInspectionDrawer` — 기능 검사 성적서 (선택적 prop `modelInfo` 또는 내부 조회 폴백)

`production-mapping.jsx`(생산 완료), `quality-AwaitPickup.jsx`(출하대기), `order-lookup.jsx`(조회) 3곳에서 공용으로 사용한다.

**체크리스트 JSON 로딩**: 마운트 시 `docs/ship/{modelCode}.json` / `docs/func/{modelCode}.json`을 fetch. 파일이 없으면 JS 내 `SHIP_CHECKLIST_DEFAULT` / `FUNC_CHECKLIST_DEFAULT`를 사용. 저장 시 `_checklist` 필드에 스냅샷 포함 → 성적서 표시 시 재사용. 체크리스트 항목은 `type: 'checkbox'` (boolean) 또는 `type: 'input'` (string) 지원.

**전역 헬퍼 함수** (`ship-inspection.jsx` 정의):
- `window.setFuncInspection(orderId, data)` — PMDB 저장 + store 갱신
- `window.setShipInspection(orderId, data)` — PMDB 저장 + store 갱신

**데이터 읽기/쓰기:**
- `PMDB.saveFuncInspection(id, data)` / `PMDB.getFuncInspection(id)`
- `PMDB.saveShipInspection(id, data)` — `null` 전달 시 삭제
- `PMDB.getShipInspectionDB(id)` — `checks`가 이미 파싱된 객체 반환
- `PMDB.getShipPhotos(id)` — 출하 전 첨부 사진 배열

### 오더 상태 전환

```
PENDING →[startProduction]→ IN_PROGRESS →[completeOrder]→ AWAIT_PICKUP →[shipOrder]→ COMPLETED
```

**되돌리기 액션 (모두 `COMPLETED` 상태에서만 사용 가능):**

| 액션 | 전환 | 데이터 처리 |
|---|---|---|
| `revertOrder(id)` | 어느 상태 → `PENDING` | serial null 초기화, 기능·출하 검사 행 삭제, 출하 사진 스토리지 삭제 |
| `revertToAwaitPickup(id)` | `COMPLETED → AWAIT_PICKUP` | 모든 데이터 유지 |
| `revertToInProgress(id)` | `COMPLETED → IN_PROGRESS` | 모든 데이터 유지 |

각 전환마다 `tb_order_history`에 이력 기록. `CompletedView`(`production-mapping.jsx`)가 `AWAIT_PICKUP`·`COMPLETED` 두 상태를 모두 처리하며, 상태별로 적합한 버튼을 렌더링.

**화면 간 이동**: 출하대기(`quality-AwaitPickup.jsx`) 목록 행 클릭 → `selectOrder(id)` + `setView('mapping')` → `CompletedView`.

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

### 대시보드 (`dashboard.jsx`)

`DashboardScreen`이 역할별 주간/월간 수량 지표를 표시 — 영업: 발주수량(`order.created` 기준), 생산: 생산수량(`production.prod_date` 기준), 품질: AS건수(`처리완료` 상태의 `completed_at` 기준). admin은 세 지표를 버튼으로 전환, 다른 역할은 담당 지표 1개만 표시. 막대그래프는 index.html에서 CDN으로 로드한 **Chart.js 4** 사용 (canvas ref + `useEffect`에서 인스턴스 생성/파기). 모든 역할이 접근 가능하며 `ROLE_TABS` 각 역할 배열의 첫 항목이다.

### Tweaks 패널 (`tweaks-panel.jsx`)

`useTweaks(defaults)` 훅이 `localStorage`에 값을 영속 저장. `app.jsx`에서 accent 색상, density, cornerStyle, defaultView를 CSS 변수로 주입.

`/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` 주석 사이의 JSON 블록이 외부 editmode 도구로 조작 가능한 기본값.

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
