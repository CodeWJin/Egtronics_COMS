# Egtronics COMS — 충전기 운영 관리 웹

이지트로닉스의 EV 충전기 **영업 → 생산 → 출하 → A/S** 전 과정을 관리하는 웹 애플리케이션입니다.

빌드/번들 스텝이 없는 정적 웹앱으로, React 18 + Babel Standalone을 CDN에서 로드해 브라우저에서 JSX를 직접 트랜스파일합니다. 데이터는 Supabase(PostgreSQL + Storage)에 저장하고 Vercel에 배포합니다.

## 주요 기능

| 화면 | 접근 역할 | 설명 |
|------|-----------|------|
| 영업 입력 | admin, sales | 신규 발주 등록 (고객사·모델·납품일·케이블·설치주소·현장담당자) |
| 생산 대기 | admin, sales, production | 테이블·카드·칸반·타임라인 뷰, 수정이력 |
| 생산 입력 | admin, production | 시리얼·로트·SW버전·검사일 입력, 시리얼 자동채번 |
| 출하 대기 | admin, production, quality | 출하 검수 체크, CSV 내보내기 |
| 통합 조회 | 전체 | 오더 검색·필터·정렬, 변경이력, A/S 이력 |
| 사용자 관리 | admin | 계정·역할 관리 |
| A/S 접수 | admin, as, sales | 접수번호(`AS-{연도}-{3자리}`) 자동발번, 고장유형·증상 등록 |
| A/S 처리 | admin, as | 상태 흐름 관리, 처리이력 로그, 사진 첨부 |

## 기술 스택

- **Frontend**: React 18.3.1 (CDN) · JSX + Babel Standalone 7.29.0 · Vanilla CSS (Pretendard + JetBrains Mono)
- **Backend**: Supabase (PostgreSQL + Storage)
- **Serverless**: Vercel Functions (`api/`) — 설정 주입, 이메일 인증코드 발송 (Resend)
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

# 풀스택 실행 (이메일 인증 등 api/ 기능 포함)
npx vercel dev     # localhost:3000
```

## 초기 DB 세팅

1. **최초 세팅**: Supabase 대시보드 → SQL Editor에서 `seed.sql` 전체 실행
2. **스키마 변경만 반영**: `supabase-schema.sql`의 마이그레이션 전용 섹션만 실행 (기존 데이터 유지)
3. **A/S 사진 첨부**: Supabase Storage에 `as-photos` 버킷을 퍼블릭으로 생성

## 환경 변수 (Vercel)

| 변수 | 설명 |
|------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | Supabase anon public 키 |
| `RESEND_API_KEY` | Resend 이메일 API 키 |
| `MAIL_FROM` | 발신자 이름·주소 (선택) |

## 프로젝트 구조

```
├── index.html               # 진입점 — CDN 로드 후 .jsx 순서대로 삽입
├── styles.css               # 전역 스타일 (CSS 변수, 다크/라이트, 반응형)
│
│  # 코어
├── app.jsx                  # React 앱 루트 (부팅·테마 주입)
├── shell.jsx                # 레이아웃 + 전역 상태 (window.__pm_store__, actions)
├── auth.jsx                 # 로그인 / 이메일 인증 / 역할 라우팅 (ROLE_TABS)
├── db.js                    # 데이터 레이어 (window.PMDB — 캐시 + Supabase 동기화)
│
│  # 화면
├── sales-input.jsx          # 영업 입력
├── production-waiting.jsx   # 생산 대기 (테이블·카드·칸반·타임라인)
├── production-mapping.jsx   # 생산 입력 (시리얼 채번 포함)
├── quality-AwaitPickup.jsx  # 출하 대기 (검수 체크·CSV 내보내기)
├── order-lookup.jsx         # 통합 조회
├── admin-users.jsx          # 사용자 관리
├── as-components.jsx        # A/S 공용 상수·컴포넌트
├── as-receipt.jsx           # A/S 접수
├── as-processing.jsx        # A/S 처리
│
│  # 유틸리티
├── icons.jsx                # 아이콘 컴포넌트
├── tweaks-panel.jsx         # 실시간 테마 변경 패널
│
│  # Vercel Serverless
├── api/config.js            # GET /supabase-config.js
├── api/send-code.js         # POST /api/send-code
│
│  # DB
├── seed.sql                 # 초기화 (테이블 생성 + 시드 데이터)
└── supabase-schema.sql      # 마이그레이션 (변경분만 적용)
```

## Supabase 테이블 구조

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 계정·역할 |
| `tb_sales_order` | 발주 정보 (고객사·모델·납품일·케이블·설치주소 등) |
| `tb_production_info` | 생산 실적 (시리얼·로트·SW버전·검사일) |
| `tb_customer_manager` | 고객사별 담당자 목록 |
| `tb_order_history` | 오더 변경 이력 |
| `tb_as_reception` | A/S 접수 |
| `tb_as_log` | A/S 상태 변경 이력 |
| `tb_as_photo` | A/S 첨부 사진 메타데이터 |
| `tb_master_customer` | 고객사 마스터 |
| `tb_master_cpo` | CPO 운영사 마스터 |
| `tb_master_model` | 충전기 모델 마스터 |
| `tb_master_sw_version` | SW 버전 마스터 |
| `tb_master_cable_length` | 케이블 길이 마스터 |

**오더 상태 흐름**: `PENDING`(생산대기) → `IN_PROGRESS`(생산중) → `AWAIT_PICKUP`(출하대기) → `COMPLETED`(생산완료). 각 전환마다 `tb_order_history`에 이력 기록.

## 트러블슈팅

| 증상 | 원인·해결 |
|------|-----------|
| Supabase 연결 오류 | Vercel 환경변수 등록 여부 확인 / 로컬은 `supabase-config.js` 확인 |
| 드롭다운 비어 있음 | `seed.sql`을 Supabase SQL 에디터에서 실행 |
| 이메일 인증 오류 | `RESEND_API_KEY` 등록 여부 확인 / `npx vercel dev`로 실행 |
| A/S 사진 업로드 실패 | `as-photos` 버킷이 퍼블릭으로 생성되어 있는지 확인 |
| DB 동작 이상 | 브라우저 콘솔에서 `window.pmdbLogs()` 또는 `window.pmdbLogs('ERROR')` 실행 |

> **새 JSX 파일 추가 시**: 모든 파일이 동일한 전역 스코프에 로드되므로, React 훅을 파일별 고유 접미사로 별칭해야 합니다 (`const { useState: useStateXXX } = React;`). 자세한 규칙은 `CLAUDE.md` 참고.
