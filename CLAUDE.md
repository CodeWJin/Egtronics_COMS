# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

`index.html`이 CDN에서 React 18, Babel Standalone, Supabase JS를 로드한 뒤 모든 `.jsx` 파일을 `<script type="text/babel">`로 순서대로 삽입. Babel이 브라우저에서 실시간 트랜스파일.

**로드 순서 = 의존성 순서:**
```
tweaks-panel.jsx → icons.jsx → auth.jsx → shell.jsx
→ sales-input.jsx → production-waiting.jsx → ship-inspection.jsx → production-mapping.jsx → quality-AwaitPickup.jsx
→ order-lookup.jsx → admin-users.jsx
→ as-components.jsx → as-receipt.jsx → as-processing.jsx
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

**Supabase 테이블 목록:**

| 테이블 | 설명 |
|---|---|
| `tb_sales_order` | 영업 오더 |
| `tb_production_info` | 생산 정보 |
| `tb_customer_manager` | 고객사 담당자 |
| `users` | 사용자 계정 |
| `tb_order_history` | 오더 변경 이력 |
| `tb_as_reception` | AS 접수 |
| `tb_as_log` | AS 처리 상태 변경 이력 |
| `tb_as_photo` | AS 첨부 사진 메타데이터 |
| `tb_func_inspection` | 기능 검사 성적서 (order_id UNIQUE, checks: JSON 문자열) |
| `tb_ship_inspection` | 출하 검사 성적서 (order_id UNIQUE, checks: JSON 문자열, photos: JSON 배열) |
| `tb_master_customer` | 고객사 마스터 |
| `tb_master_cpo` | CPO 운영사 마스터 |
| `tb_master_model` | 충전기 모델 마스터 (`model` 코드, `name` 표시명, `description`, `power` 필드) |
| `tb_master_sw_version` | SW 버전 마스터 |
| `tb_master_fw_version` | FW 버전 마스터 |
| `tb_master_cable_length` | 케이블 길이 마스터 |

**`tb_sales_order` 주요 필드:** `customer_name`, `customer_manager`, `model_name`, `delivery_date`, `station_id`, `router_no`, `usim_no`, `install_address`, `cable_length`, `field_manager_name`, `field_manager_phone`, `cpo_name`, `usage_type`(공용/비공용), `status`

### 모델 코드 vs 표시명 구분 (중요)

`tb_master_model`에는 두 개의 이름 필드가 있다:
- `model` — 코드 (예: `EGSW101101`). 시리얼 채번·체크리스트 JSON 파일명에 사용.
- `name` — 표시명 (예: `SW 1CH 10kW`). `tb_sales_order.model_name`에 저장되는 값.

**`order.model_name` = `tb_master_model.name` (표시명)**, 코드가 필요할 때는 반드시 조회:
```js
const modelInfo = window.PMDB.getModels().find(m => m.name === order.model_name);
// UI 표시: modelInfo?.model || order.model_name
```

### 전역 상태 (`shell.jsx` → `window.__pm_store__`)

React Context 없이 `window.__pm_store__`에 단일 상태 객체를 두고, `Set<function>`인 `listeners`에 컴포넌트 리렌더러를 등록하는 수동 pub-sub 패턴.

- `useStore()` — 리스너 등록 + 강제 리렌더 훅 (모든 뷰에서 사용)
- `window.notify()` — 모든 리스너 호출
- `window.actions` — 상태 변경 액션 집합 (`addOrder`, `completeOrder`, `setView`, `addAsReception`, `updateAsReception` 등)

```
상태 변경: actions.X() → PMDB 캐시 수정 → store 업데이트 → notify() → 전체 리렌더
```

**store 주요 필드:**
- `view` — 현재 활성 화면 (`'sales' | 'waiting' | 'mapping' | 'AwaitPickup' | 'lookup' | 'admin' | 'as-receipt' | 'as-processing'`)
- `waitingView` — 생산대기 화면 서브뷰 (`'kanban' | 'table' | 'card' | 'timeline'`)
- `selectedOrderId` / `editingOrderId` — 현재 선택/편집 중인 오더
- `currentUser` — 로그인 사용자 객체
- `asReceptions` / `selectedAsId` — AS 관련 상태

`localStorage` 영속 키:
- `pm_session` — 로그인 `user_id` (페이지 새로고침 유지)
- `pm_tweaks_*` — Tweaks 패널 설정값

### 역할 기반 라우팅 (`auth.jsx` → `window.ROLE_TABS`)

`ROLE_TABS` 맵이 역할마다 허용 뷰 배열 정의.

| store.view      | 컴포넌트                   | 접근 역할                     |
|-----------------|---------------------------|-------------------------------|
| `sales`         | `SalesInputScreen`        | admin, sales                  |
| `waiting`       | `ProductionWaitingScreen` | admin, sales, production      |
| `mapping`       | `ProductionMappingScreen` | admin, production             |
| `AwaitPickup`   | `ProductionCompleteScreen`| admin, production, quality     |
| `lookup`        | `OrderLookupScreen`       | 전체 (A/S 이력은 as 역할만)   |
| `admin`         | `AdminUsersScreen`        | admin 전용                    |
| `as-receipt`    | `AsReceiptScreen`         | admin, quality, sales              |
| `as-processing` | `AsProcessingScreen`      | admin, quality                     |

`ROLE_TABS`에 정의되지 않은 역할은 `['lookup']`으로 폴백된다.

### 시리얼 번호 생성 (`production-mapping.jsx`)

`SERIAL_MODEL_CODES` 맵이 모델 코드(`tb_master_model.model`)를 `[그룹코드, 타입코드]`로 매핑. `makeSerialDateCode(dateISO)`가 연도·월을 알파벳 코드로 변환 (2023년 = `A`, 이후 +1 알파벳씩). 생산 화면에서 시리얼 자동 채번에 사용.

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

### Tweaks 패널 (`tweaks-panel.jsx`)

`useTweaks(defaults)` 훅이 `localStorage`에 값을 영속 저장. `app.jsx`에서 accent 색상, density, cornerStyle, defaultView를 CSS 변수로 주입.

`/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` 주석 사이의 JSON 블록이 외부 editmode 도구로 조작 가능한 기본값.

### CSV 내보내기

`quality-AwaitPickup.jsx`의 `downloadCSV()` 헬퍼는 Excel 한국어 깨짐 방지를 위해 UTF-8 BOM(`﻿`)을 파일 앞에 삽입한다. 다른 화면에서 CSV를 내보낼 때도 동일한 방식 사용.

### Vercel Serverless (`api/`)

| 엔드포인트               | 파일               | 역할                                                  |
|--------------------------|--------------------|-------------------------------------------------------|
| `GET /supabase-config.js`| `api/config.js`    | Vercel 환경변수 → 브라우저 `window.SUPABASE_URL/KEY` 주입 |
| `POST /api/send-code`    | `api/send-code.js` | Resend API로 이메일 인증 코드 발송                    |

로컬에서 `vercel dev` 실행 시 `api/` 서빙됨. `npx serve`만으론 api/ 동작 안 함.

## 주요 설계 규칙

- **CSS 클래스 이름 고정**: `styles.css`의 클래스(`btn`, `card`, `table`, `toolbar` 등)를 모든 뷰에서 직접 사용. CSS 모듈/Tailwind 없음. 클래스 이름 변경 시 JSX도 함께 수정.
- **CSS 변수로 테마**: 색상·반지름·그림자는 `:root` 변수로 관리. `app.jsx`의 tweaks가 JS로 덮어씀.
- **supabase-config.js**: `.gitignore` 대상. 절대 커밋 금지.

## 환경 변수 (Vercel)

| 변수               | 설명                           |
|--------------------|-------------------------------|
| `SUPABASE_URL`     | Supabase 프로젝트 URL          |
| `SUPABASE_ANON_KEY`| Supabase anon public 키        |
| `RESEND_API_KEY`   | Resend 이메일 API 키           |
| `MAIL_FROM`        | 발신자 이름·주소 (선택)        |
