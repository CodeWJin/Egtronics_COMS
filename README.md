# Egtronics COMS — 충전기 운영 관리 웹

Egtronics COMS(Charger Operation Management System)는 이지트로닉스의 EV 충전기 **영업 → 생산 → 출하 → A/S** 전 과정을 관리하는 웹 애플리케이션입니다.

빌드/번들 스텝이 없는 정적 웹앱으로, React 18 + Babel Standalone을 CDN에서 로드해 브라우저에서 JSX를 직접 트랜스파일합니다. 데이터는 Supabase(PostgreSQL + Storage)에 저장하고, Vercel에 배포합니다.

## 주요 기능

- **영업 입력**: 신규 발주 등록 (고객사·모델·납품일·케이블 길이, 카카오 우편번호 실검색, 현장담당자)
- **생산 대기**: 생산 상태별 테이블·카드·칸반·타임라인 뷰, 수정이력 표시
- **생산 입력**: 생산 실적 입력 (시리얼·로트·SW 버전·검사일)
- **출하대기**: 생산완료 오더의 출하 관리
- **통합 조회**: 전체 오더 검색·필터·정렬 및 드로어 상세 조회, 구형 A/S 이력 조회
- **A/S 접수**: 접수번호(`AS-{연도}-{3자리 순번}`) 자동 발번, 고장 유형·증상 등록
- **A/S 처리**: 상태 흐름(접수대기 → 담당자배정 → 처리중 → 처리완료) 관리, 처리 이력 로그, 사진 첨부(Supabase Storage)
- **사용자 관리**: 역할 기반 접근 제어 (관리자 전용)
- **테마 커스터마이징**: Tweaks 패널로 accent 색상·밀도·코너 스타일 실시간 변경 (다크/라이트 테마)

## 기술 스택

- **Frontend**: React 18.3.1 (CDN), JSX + Babel Standalone, Vanilla CSS
- **Backend**: Supabase (PostgreSQL, Storage)
- **Serverless**: Vercel Functions (`api/`) — 설정 주입, 이메일 인증코드 발송
- **이메일**: Resend API
- **주소 검색**: 카카오(Daum) 우편번호 서비스
- **배포**: Vercel

## 설치 및 실행

```bash
git clone https://github.com/CodeWJin/Egtronics_COMS.git
cd Egtronics_COMS
npm install

# Supabase 접속 정보 설정 (최초 1회)
cp supabase-config.example.js supabase-config.js
# supabase-config.js 에 실제 URL/키 입력
```

### 로컬 개발

```bash
# 정적 파일만 서빙 (api/ 서버리스 함수 미포함)
npm run dev          # npx serve . -p 3000 → localhost:3000

# api/ 서버리스 함수까지 포함한 풀스택 실행 (Vercel CLI 필요)
npx vercel dev       # → localhost:3000
```

> 이메일 인증 등 `api/` 기능을 테스트하려면 `npx vercel dev`를 사용하세요.

## 초기 DB 세팅

- **최초 세팅**: Supabase 대시보드 → **SQL Editor**에서 `seed.sql` 전체 실행 (테이블 생성 + 시드 데이터)
- **스키마 변경만 반영**: `supabase-schema.sql`의 마이그레이션 전용 섹션만 실행 (기존 데이터 유지)
- **A/S 사진 첨부**: Supabase Storage에 **`as-photos`** 버킷을 퍼블릭으로 생성

## 환경 변수 (Vercel)

| 변수 | 설명 |
|------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | Supabase anon public 키 |
| `RESEND_API_KEY` | Resend 이메일 API 키 |
| `MAIL_FROM` | 발신자 이름·주소 (선택) |

로컬 개발 시에는 `supabase-config.js`에 URL과 키를 직접 입력합니다 (`.gitignore` 적용 — **절대 커밋 금지**).

## 프로젝트 구조

```
├── index.html                   # 진입점 — CDN 로드 후 .jsx를 순서대로 삽입
├── styles.css                   # 전역 스타일 (CSS 변수 테마, 다크/라이트, 반응형)
│
│  # 코어
├── app.jsx                      # React 앱 루트 (부팅·라우팅·테마 주입)
├── shell.jsx                    # 레이아웃 + 전역 상태 (window.__pm_store__, actions)
├── auth.jsx                     # 로그인 / 이메일 인증 / 역할별 라우팅 (ROLE_TABS)
├── db.js                        # 데이터 레이어 (window.PMDB — 캐시 + Supabase 동기화)
│
│  # 화면 (Views)
├── sales-input.jsx              # 영업 입력
├── production-waiting.jsx       # 생산 대기 (테이블·카드·칸반·타임라인)
├── production-mapping.jsx       # 생산 입력
├── quality-AwaitPickup.jsx      # 출하대기
├── order-lookup.jsx             # 통합 조회 + 구형 A/S 이력
├── admin-users.jsx              # 사용자 관리 (관리자 전용)
├── as-components.jsx            # A/S 공용 컴포넌트·상수 (FAULT_TYPES, AS_STATUS_LIST 등)
├── as-receipt.jsx               # A/S 접수
├── as-processing.jsx            # A/S 처리
│
│  # 유틸리티
├── icons.jsx                    # 아이콘 컴포넌트
├── tweaks-panel.jsx             # 실시간 테마 변경 패널 (localStorage 영속)
│
│  # Vercel Serverless
├── api/config.js                # GET /supabase-config.js — 환경변수 → 브라우저 주입
├── api/send-code.js             # POST /api/send-code — 이메일 인증코드 발송
│
│  # 설정·DB
├── supabase-config.example.js   # Supabase 설정 템플릿 (실제 키는 .gitignore)
├── seed.sql                     # DB 초기화 (테이블 생성 + 시드 데이터)
├── supabase-schema.sql          # 스키마 마이그레이션 (기존 DB에 변경분만 적용)
├── vercel.json                  # Vercel 배포 설정
└── package.json
```

> **새 JSX 파일 추가 시**: 모든 파일이 동일한 전역 스코프에 로드되므로, React 훅을 파일별 고유 접미사로 별칭해야 합니다 (예: `const { useState: useStateAREC } = React;`). 자세한 규칙은 `CLAUDE.md` 참고.

## 역할별 접근 권한

| 역할 | 접근 가능 화면 |
|------|--------------|
| `admin` (관리자) | 전체 화면 + 사용자 관리 |
| `sales` (영업) | 영업 입력 · 생산 대기 · 통합 조회 |
| `production` (생산) | 생산 대기 · 생산 입력 · 출하대기 · 통합 조회 |
| `quality` (품질) | 출하대기 · 통합 조회 |
| `as` (A/S) | 통합 조회 · A/S 접수 · A/S 처리 |

`ROLE_TABS`에 정의되지 않은 역할은 통합 조회만 접근 가능합니다.

## Supabase 테이블 구조

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 계정 및 역할 |
| `tb_sales_order` | 발주 정보 (고객사·모델·납품일·케이블·주소 등) |
| `tb_production_info` | 생산 실적 (시리얼·로트·SW버전·검사일·문서번호) |
| `tb_customer_manager` | 고객사별 담당자 목록 |
| `tb_order_history` | 오더 변경 이력 |
| `tb_as_reception` | A/S 접수 |
| `tb_as_log` | A/S 처리 상태 변경 이력 |
| `tb_as_photo` | A/S 첨부 사진 메타데이터 (파일은 Storage `as-photos` 버킷) |
| `tb_as_history` | 구형 A/S 이력 (통합 조회 화면) |
| `tb_master_customer` | 고객사 마스터 (드롭다운) |
| `tb_master_cpo` | CPO 운영사 마스터 |
| `tb_master_model` | 충전기 모델 마스터 |
| `tb_master_sw_version` | SW 버전 마스터 |
| `tb_master_cable_length` | 케이블 길이 마스터 |

오더 상태는 `PENDING`(생산대기) → `IN_PROGRESS`(생산중) → `AWAIT_PICKUP`(출하대기) → `COMPLETED`(생산완료) 순으로 전환되며, 각 전환마다 `tb_order_history`에 이력이 기록됩니다. 생산 입력 완료 시 `AWAIT_PICKUP`이 되고, 출하대기 화면에서 출하 완료 처리하면 `COMPLETED`가 됩니다.

## 트러블슈팅

**Supabase 연결 오류**
- Vercel 환경변수에 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 등록 여부 확인
- 로컬: `supabase-config.js` 파일 존재 여부 확인 (`supabase-config.example.js` 참고)

**마스터 데이터 없음 (드롭다운 비어 있음)**
- `seed.sql`을 Supabase SQL 에디터에서 실행

**이메일 인증 오류**
- Vercel 환경변수에 `RESEND_API_KEY` 등록 여부 확인
- `npm run dev`(정적 서빙)에서는 `api/`가 동작하지 않음 — `npx vercel dev` 사용

**A/S 사진 업로드 실패**
- Supabase Storage에 `as-photos` 버킷이 퍼블릭으로 생성되어 있는지 확인

**DB 동작 디버깅**
- 브라우저 콘솔에서 `window.pmdbLogs()` 또는 `window.pmdbLogs('ERROR')`로 DB 작업 로그 조회
