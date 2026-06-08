# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# 로컬 개발 서버 (Vercel Dev — api/ 서버리스 함수 포함)
npm run dev          # vercel dev → localhost:3000

# 의존성 설치
npm install

# Supabase 설정 초기화 (최초 1회)
cp supabase-config.example.js supabase-config.js
# 이후 supabase-config.js 에 실제 URL/키 입력

# DB 초기화: seed.sql 전체를 Supabase 대시보드 SQL 에디터에서 실행
```

빌드/번들 스텝 없음 — JSX를 Babel Standalone이 브라우저에서 직접 트랜스파일하므로 로컬 빌드 도구가 필요 없음. 테스트 프레임워크 없음.

## 아키텍처

### 실행 흐름

`index.html`이 CDN에서 React 18, Babel Standalone, Supabase JS를 로드한 뒤 모든 `.jsx` 파일을 `<script type="text/babel">`로 순서대로 삽입한다. Babel이 브라우저에서 실시간 트랜스파일. 빌드 파이프라인 없음.

로드 순서가 의존성 순서임:
```
tweaks-panel.jsx → icons.jsx → auth.jsx → shell.jsx
→ sales-input.jsx → production-*.jsx → order-lookup.jsx
→ admin-users.jsx → app.jsx
```

### 데이터 레이어 (`db.js`)

`window.PMDB`에 단일 객체로 노출된 캐시+Supabase 하이브리드 레이어:

- **로컬 캐시에서 동기 읽기**: `PMDB.loadOrders()`, `PMDB.loadUsers()` 등은 메모리 캐시를 반환해 UI가 즉시 렌더링됨.
- **비동기 쓰기**: 로컬 캐시 먼저 변경 → 백그라운드에서 Supabase에 동기화.
- **시딩**: `SEED_USERS`, `SEED_MASTER_CUSTOMERS` 등 상수를 DB에 없으면 자동 삽입.
- **디버깅**: 브라우저 콘솔에서 `window.pmdbLogs()` 또는 `window.pmdbLogs('ERROR')`로 DB 작업 로그 조회.

### 전역 상태 (`shell.jsx` → `window.__pm_store__`)

React Context 없이 `window.__pm_store__`에 단일 상태 객체를 두고, `Set<function>`인 `listeners`에 컴포넌트 리렌더러를 등록하는 수동 pub-sub 패턴.

- `useStore()` — 리스너 등록 + 강제 리렌더 훅 (모든 뷰에서 사용)
- `window.notify()` — 모든 리스너 호출
- `window.actions` — 상태 변경 액션 집합 (addOrder, completeOrder, setView 등)

```
상태 변경: actions.X() → PMDB 캐시 수정 → store 업데이트 → notify() → 전체 리렌더
```

### 역할 기반 라우팅

`ROLE_TABS` 맵이 역할마다 허용 뷰 배열을 정의. `store.view`가 현재 활성 화면 키.

| store.view | 컴포넌트 |
|---|---|
| `sales` | `SalesInputScreen` |
| `waiting` | `ProductionWaitingScreen` |
| `mapping` | `ProductionMappingScreen` |
| `completed` | `ProductionCompleteScreen` |
| `lookup` | `OrderLookupScreen` |
| `admin` | `AdminUsersScreen` |

### Tweaks 패널 (`tweaks-panel.jsx`)

`useTweaks(defaults)` 훅이 `localStorage`에 값을 영속 저장하는 실시간 테마 조정 패널. `app.jsx`에서 accent 색상, density, cornerStyle, defaultView를 CSS 변수로 주입함.

`/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` 주석 사이의 JSON 블록이 외부 도구(editmode)로 조작 가능한 기본값.

### Vercel Serverless (`api/`)

| 엔드포인트 | 역할 |
|---|---|
| `GET /supabase-config.js` | Vercel 환경변수 → 브라우저 `window.SUPABASE_URL/KEY` 주입 |
| `POST /api/send-code` | Resend API로 이메일 인증 코드 발송 |

로컬에서는 `vercel dev`가 `api/` 디렉터리를 자동으로 서빙함. `supabase-config.js`는 `.gitignore`에 있으므로 로컬 전용 파일임.

## 주요 설계 규칙

- **CSS 클래스 이름 고정**: 모든 뷰에서 `styles.css`의 클래스(`btn`, `card`, `table`, `toolbar` 등)를 직접 사용. CSS 모듈/Tailwind 없음. 클래스 이름 변경 시 JSX 파일도 함께 수정해야 함.
- **CSS 변수로 테마**: 색상·반지름·그림자는 `:root` 변수로 관리. `app.jsx`의 tweaks가 JS로 덮어씀.
- **`window.PMDB`가 단일 진실 공급원**: 뷰 컴포넌트는 직접 Supabase를 호출하지 않고 반드시 `window.actions.*` 또는 `window.PMDB.*`를 통해 데이터 조작.
- **오더 상태 흐름**: `PENDING` (생산대기) → `IN_PROGRESS` (생산중) → `COMPLETED` (생산완료). 각 전환마다 `tb_order_history`에 이력 기록.
- **supabase-config.js**: gitignore 대상. 절대 커밋 금지.
