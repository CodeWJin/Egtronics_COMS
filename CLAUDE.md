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

## DB 초기화 및 마이그레이션

- **초기 세팅**: `seed.sql` 전체를 Supabase SQL 에디터에서 실행 (테이블 생성 + 시드 데이터 포함)
- **스키마 변경만**: `supabase-schema.sql`의 마이그레이션 전용 섹션만 실행 (기존 데이터 유지, 신규 컬럼·제약 추가)
- `tb_as_history` 테이블은 RLS 비활성화 상태 — anon key로 직접 삽입 허용
- AS 사진 첨부는 Supabase Storage **`as-photos`** 버킷 사용 (퍼블릭 버킷으로 설정 필요)

## 아키텍처

### 실행 흐름

`index.html`이 CDN에서 React 18, Babel Standalone, Supabase JS를 로드한 뒤 모든 `.jsx` 파일을 `<script type="text/babel">`로 순서대로 삽입. Babel이 브라우저에서 실시간 트랜스파일.

**로드 순서 = 의존성 순서:**
```
tweaks-panel.jsx → icons.jsx → auth.jsx → shell.jsx
→ sales-input.jsx → production-waiting.jsx → production-mapping.jsx → quality-AwaitPickup.jsx
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

**Supabase 테이블 목록:**

| 테이블 | 설명 |
|---|---|
| `tb_sales_order` | 영업 오더 |
| `tb_production_info` | 생산 정보 |
| `tb_customer_manager` | 고객사 담당자 |
| `users` | 사용자 계정 |
| `tb_order_history` | 오더 변경 이력 |
| `tb_as_history` | 구형 AS 이력 (lookup 화면) |
| `tb_as_reception` | AS 접수 |
| `tb_as_log` | AS 처리 상태 변경 이력 |
| `tb_as_photo` | AS 첨부 사진 메타데이터 |
| `tb_master_customer` | 고객사 마스터 |
| `tb_master_cpo` | CPO 운영사 마스터 |
| `tb_master_model` | 충전기 모델 마스터 |
| `tb_master_sw_version` | SW 버전 마스터 |
| `tb_master_cable_length` | 케이블 길이 마스터 |

### 전역 상태 (`shell.jsx` → `window.__pm_store__`)

React Context 없이 `window.__pm_store__`에 단일 상태 객체를 두고, `Set<function>`인 `listeners`에 컴포넌트 리렌더러를 등록하는 수동 pub-sub 패턴.

- `useStore()` — 리스너 등록 + 강제 리렌더 훅 (모든 뷰에서 사용)
- `window.notify()` — 모든 리스너 호출
- `window.actions` — 상태 변경 액션 집합 (`addOrder`, `completeOrder`, `setView`, `addAsReception`, `updateAsReception` 등)

```
상태 변경: actions.X() → PMDB 캐시 수정 → store 업데이트 → notify() → 전체 리렌더
```

store의 `view` 필드가 현재 활성 화면을 결정하며, `localStorage`의 `pm_session` 키에 `user_id`를 저장하여 페이지 새로고침 후에도 로그인 상태를 유지한다.

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
| `as-receipt`    | `AsReceiptScreen`         | admin, as, sales              |
| `as-processing` | `AsProcessingScreen`      | admin, as                     |

`ROLE_TABS`에 정의되지 않은 역할은 `['lookup']`으로 폴백된다.

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

접수번호는 `AS-{연도}-{5자리 순번}` 형식으로 자동 생성 (예: `AS-2025-001`).

### Tweaks 패널 (`tweaks-panel.jsx`)

`useTweaks(defaults)` 훅이 `localStorage`에 값을 영속 저장. `app.jsx`에서 accent 색상, density, cornerStyle, defaultView를 CSS 변수로 주입.

`/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` 주석 사이의 JSON 블록이 외부 editmode 도구로 조작 가능한 기본값.

### Vercel Serverless (`api/`)

| 엔드포인트               | 파일               | 역할                                                  |
|--------------------------|--------------------|-------------------------------------------------------|
| `GET /supabase-config.js`| `api/config.js`    | Vercel 환경변수 → 브라우저 `window.SUPABASE_URL/KEY` 주입 |
| `POST /api/send-code`    | `api/send-code.js` | Resend API로 이메일 인증 코드 발송                    |

로컬에서 `vercel dev` 실행 시 `api/` 서빙됨. `npx serve`만으론 api/ 동작 안 함.

## 주요 설계 규칙

- **CSS 클래스 이름 고정**: `styles.css`의 클래스(`btn`, `card`, `table`, `toolbar` 등)를 모든 뷰에서 직접 사용. CSS 모듈/Tailwind 없음. 클래스 이름 변경 시 JSX도 함께 수정.
- **CSS 변수로 테마**: 색상·반지름·그림자는 `:root` 변수로 관리. `app.jsx`의 tweaks가 JS로 덮어씀.
- **오더 상태 흐름**: 
`PENDING` (생산대기) → `IN_PROGRESS` (생산중) → `AWAIT_PICKUP` (출하대기) → `COMPLETED` (생산완료). 각 전환마다 `tb_order_history`에 이력 기록.
- **supabase-config.js**: `.gitignore` 대상. 절대 커밋 금지.

## 환경 변수 (Vercel)

| 변수               | 설명                           |
|--------------------|-------------------------------|
| `SUPABASE_URL`     | Supabase 프로젝트 URL          |
| `SUPABASE_ANON_KEY`| Supabase anon public 키        |
| `RESEND_API_KEY`   | Resend 이메일 API 키           |
| `MAIL_FROM`        | 발신자 이름·주소 (선택)        |
