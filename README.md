# Egtronics COMS — 충전기 운영 관리 웹

이지트로닉스의 EV 충전기 **영업(생산요청) → 생산(착수·완료) → 출하대기 → A/S** 전 과정을 관리하는 웹 애플리케이션입니다.

빌드/번들 스텝이 없는 정적 웹앱으로, React 18 + Babel Standalone을 CDN에서 로드해 브라우저에서 JSX를 직접 트랜스파일합니다. 데이터는 Supabase(PostgreSQL + Storage)에 저장하고 Vercel에 배포합니다.

## 주요 기능

| 화면 | 접근 역할 | 설명 |
|------|-----------|------|
| 대시보드 | 전체 | 역할별 주간·월간 KPI(발주·생산·AS 수량), Chart.js 막대 차트 |
| 생산요청 | admin, sales | 모델·용도(공용/비공용)·수량 대량 등록(행 복제, 최대 500개) |
| 생산 대기 | admin, sales, production | 칸반(생산요청·생산착수·생산완료·출하대기), 다중선택 일괄 생산착수 |
| — 생산착수 모달 | production, admin | 시리얼 자동채번(수정 가능)·검정일자(공용)·SW/FW버전·기능검사 성적서 입력 |
| — 생산완료 모달 | sales, admin | 케이블길이·발주처·담당자·납품장소·납품일자(+공용 통신정보) 입력 |
| 출하 대기 | admin, production, quality | 출하 검사 성적서 작성·사진 첨부(`.switch` 토글), 출하완료 처리, CSV 내보내기 |
| 통합 조회 | 전체 | 오더 검색·필터·정렬, 변경이력, 기능·출하 성적서 조회, 상태 되돌리기(production/admin) |
| 사용자 관리 | admin | 계정·역할 관리 |
| A/S 접수 | admin, quality, sales | 접수번호(`AS-{연도월일}-{4자리}`) 자동발번, 시리얼 조회 → 미등록 시 충전기 등록 모달 |
| A/S 처리 | admin, sales, quality | 상태 흐름 관리, 처리이력 로그, 사진 첨부 |

## 기술 스택

- **Frontend**: React 18.3.1 (CDN) · JSX + Babel Standalone 7.29.0 · Chart.js 4(UMD, 대시보드) · Vanilla CSS (Pretendard + JetBrains Mono)
- **Backend**: Supabase (PostgreSQL + Storage)
- **Serverless**: Vercel Functions (`api/`) — Supabase 접속 정보 주입만 담당
- **주소 검색**: 카카오(Daum) 우편번호 서비스
- **배포**: Vercel

## 설치 및 실행

```bash
git clone https://github.com/CodeWJin/Egtronics_COMS.git
cd Egtronics_COMS
npm install

# Supabase 접속 정보 설정 (최초 1회)
cp supabase-config.example.js supabase-config.js
# supabase-config.js 에 실제 URL과 키 입력 (절대 커밋 금지)
```

```bash
# 정적 파일만 서빙 — api/ 서버리스 함수 미포함
npm run dev        # localhost:3000

# 풀스택 실행 (api/config.js 포함, Vercel CLI 필요)
npx vercel dev     # localhost:3000
```

```bash
# 역할별 권한 테스트 (auth.jsx의 ROLE_TABS 파싱·검증)
npm test
```

로그인은 `tb_users` 기반 ID/비밀번호 방식(`PMDB.authenticate`)입니다.

## 초기 DB 세팅

1. **최초 세팅**: Supabase 대시보드 → SQL Editor에서 `seed.sql` 전체 실행 (테이블 생성 + 시드 데이터)
2. **스키마 변경만 반영**: `supabase-schema.sql`의 마이그레이션 전용 섹션만 실행 (기존 데이터 유지)
3. **출하 전 사진 첨부**: Supabase Storage에 `ship-photos` 버킷을 퍼블릭으로 생성
4. **A/S 사진 첨부**: Supabase Storage에 `as-photos` 버킷을 퍼블릭으로 생성

## 환경 변수 (Vercel)

| 변수 | 설명 |
|------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | Supabase anon public 키 |

## 프로젝트 구조

```
├── index.html               # 진입점 — CDN 로드 후 .jsx 순서대로 삽입
├── styles.css               # 전역 스타일 (CSS 변수, 다크/라이트, 반응형)
│
│  # 코어
├── app.jsx                  # React 앱 루트 (부팅·테마 주입)
├── shell.jsx                # 레이아웃 + 전역 상태 (window.__pm_store__, actions)
├── auth.jsx                 # 로그인 / 역할 라우팅 (ROLE_TABS)
├── db.js                    # 데이터 레이어 (window.PMDB — 캐시 + Supabase 동기화, 시리얼 채번 유틸)
│
│  # 화면
├── tweaks-panel.jsx         # 실시간 테마 변경 패널
├── icons.jsx                # 아이콘 컴포넌트
├── production-request-modal.jsx  # 생산요청 등록/수정/취소 모달
├── production-waiting.jsx   # 생산 대기 칸반 (생산착수·생산완료 모달 포함)
├── ship-inspection.jsx      # 기능·출하 검사 성적서 Drawer (공용)
├── quality-AwaitPickup.jsx  # 출하 대기 (검수 체크·사진·CSV 내보내기)
├── order-lookup.jsx         # 통합 조회
├── admin-users.jsx          # 사용자 관리
├── as-components.jsx        # A/S 공용 상수·컴포넌트
├── as-receipt.jsx           # A/S 접수
├── as-processing.jsx        # A/S 처리
├── dashboard.jsx            # 대시보드 (역할별 KPI, Chart.js)
│
│  # 체크리스트 JSON (모델별, 없으면 JS 기본값 폴백)
├── docs/ship/{modelCode}.json
├── docs/func/{modelCode}.json
│
│  # Vercel Serverless
├── api/config.js            # GET /supabase-config.js (환경변수 → 브라우저 주입)
│
│  # DB
├── seed.sql                 # 초기화 (테이블 생성 + 시드 데이터)
└── supabase-schema.sql      # 마이그레이션 (변경분만 적용)
```

## Supabase 테이블 구조

| 테이블 | 설명 |
|--------|------|
| `tb_users` | 사용자 계정 (role: admin/sales/production/quality) |
| `tb_sales_order` | 발주(오더) 정보 — 모델·용도·수량·상태, 발주처는 생산완료 단계에서 입력 |
| `tb_usagetype_public` | 공용 충전기 전용 필드 (충전소ID·충전기ID·라우터번호·USIM번호), `tb_sales_order`와 1:1 |
| `tb_production_info` | 생산 정보 (생산일자·시리얼·검정일자·SW/FW버전) |
| `tb_customer_manager` | 고객사별 담당자 목록 |
| `tb_order_history` | 오더 상태·필드 변경 이력 |
| `tb_chargepoint_infor` | 충전기 설치 정보 (시리얼·모델명·설치주소) — A/S 접수 시 조회 |
| `tb_func_inspection` | 기능 검사 성적서 (order_id UNIQUE) |
| `tb_ship_inspection` | 출하 검사 성적서 + 출하 전 사진 (order_id UNIQUE) |
| `tb_as_reception` | A/S 접수 |
| `tb_as_log` | A/S 상태 변경 이력 |
| `tb_as_photo` | A/S 첨부 사진 메타데이터 |
| `tb_master_customer` | 고객사 마스터 |
| `tb_master_cpo` | CPO 운영사 마스터 |
| `tb_master_model` | 충전기 모델 마스터 (`model_code`, `description`, `power`) |
| `tb_program_version` | SW/FW 버전 마스터 (`type`, `tag`, `released`, `stable` 통합 테이블) |

**오더 상태 흐름**: `PENDING`(생산요청) → `IN_PROGRESS`(생산착수) → `AWAIT_PICKUP`(생산완료/출하대기) → `COMPLETED`(출하완료). `AWAIT_PICKUP`은 `window.isSalesInfoComplete(order)` 값으로 생산완료(false)/출하대기(true) 두 업무 단계를 구분합니다. 각 전환마다 `tb_order_history`에 이력 기록. `COMPLETED → AWAIT_PICKUP/IN_PROGRESS`, `AWAIT_PICKUP → IN_PROGRESS`로 되돌릴 수 있으며, 어느 상태에서든 `PENDING`으로 초기화 가능(시리얼·검사 데이터·출하 사진 삭제).

## 트러블슈팅

| 증상 | 원인·해결 |
|------|-----------|
| Supabase 연결 오류 | Vercel 환경변수 등록 여부 확인 / 로컬은 `supabase-config.js` 확인 |
| 드롭다운 비어 있음 | `seed.sql`을 Supabase SQL 에디터에서 실행 |
| `api/` 함수가 동작 안 함 | `npx serve`는 정적 서빙만 지원 — `npx vercel dev`로 실행 |
| A/S·출하 사진 업로드 실패 | `as-photos`/`ship-photos` 버킷이 퍼블릭으로 생성되어 있는지 확인 |
| DB 동작 이상 | 브라우저 콘솔에서 `window.pmdbLogs()` 또는 `window.pmdbLogs('ERROR')` 실행 |

> **새 JSX 파일 추가 시**: 모든 파일이 동일한 전역 스코프에 로드되므로, React 훅을 파일별 고유 접미사로 별칭해야 합니다 (`const { useState: useStateXXX } = React;`). 자세한 규칙은 `CLAUDE.md` 참고.
