# Egtronics COMS - 충전기 관리 웹 애플리케이션

Egtronics COMS(Charger Operation Management System)는 이지트로닉스의 충전기 운영 및 관리를 위한 풀스택 웹 애플리케이션입니다.

## 주요 기능

- **주문 관리**: 충전기 주문 현황 추적 및 관리
- **생산 매핑**: 생산 흐름 및 작업 할당 관리
- **영업 입력**: 신규 발주 데이터 입력 및 처리 (우편번호 실검색, 케이블길이, 현장담당자)
- **주문 조회**: 전체 오더 검색·필터·정렬 및 드로어 상세 조회
- **생산 대기/완료**: 생산 상태별 테이블·카드·칸반·타임라인 뷰
- **A/S 이력**: A/S 역할 계정으로 오더별 유지보수 이력 등록·조회
- **사용자 관리**: 역할(영업·생산·A/S·관리자) 기반 접근 제어

## 기술 스택

- **Frontend**: React 18.3.1, JSX, Vanilla CSS
- **Backend**: Supabase (PostgreSQL + Realtime)
- **주소 검색**: 카카오(Daum) 우편번호 서비스
- **Development**: Live Server, Babel Standalone

## 설치

```bash
# 프로젝트 클론
git clone https://github.com/CodeWJin/Egtronics_COMS.git
cd "Egtronics COMS Web"

# 의존성 설치
npm install
```

## 환경 설정

`supabase-config.js` 파일에 Supabase URL 및 anon 키를 입력하세요:

```js
window.SUPABASE_URL = 'https://your-project.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-key';
```

## 실행

### 개발 모드

```bash
npm run dev
```

- Live Server가 포트 3000에서 실행됩니다
- 자동 재로드 지원
- `index.html`이 자동으로 열립니다

## 프로젝트 구조

```
├── index.html                   # 메인 HTML 진입점
├── app.jsx                      # 메인 React 애플리케이션 (상태·라우팅)
├── auth.jsx                     # 로그인 화면
├── shell.jsx                    # 레이아웃 (TopNav, 화면 전환)
│
├── Views (화면별 컴포넌트)
├── sales-input.jsx              # 영업 입력 (발주·고객·담당자·주소)
├── production-waiting.jsx       # 생산 대기 (테이블·카드·칸반·타임라인)
├── production-mapping.jsx       # 생산 매핑 (실적 입력)
├── production-complete.jsx      # 생산 완료 목록
├── order-lookup.jsx             # 통합 조회 + A/S 이력
├── admin-users.jsx              # 사용자 관리 (관리자 전용)
│
├── Utilities
├── db.js                        # Supabase 데이터 레이어 (로컬 캐시 + 비동기 쓰기)
├── data.js                      # 마스터 데이터 (모델·케이블·고객)
├── icons.jsx                    # 아이콘 컴포넌트 (Lucide 계열)
├── tweaks-panel.jsx             # 실시간 테마 변경 패널
│
├── Configuration
├── supabase-config.js           # Supabase 접속 정보 (미포함)
├── styles.css                   # 전역 스타일 (다크/라이트 테마, 반응형)
├── package.json
└── .gitignore
```

## 역할별 접근 권한

| 역할 | 접근 가능 화면 |
|------|--------------|
| `admin` (관리자) | 전체 + 사용자 관리 |
| `sales` (영업) | 영업 입력 · 생산 대기(수정) · 통합 조회 |
| `production` (생산) | 생산 대기 · 생산 매핑 · 생산 완료 · 통합 조회 |
| `as` (A/S) | 통합 조회 · A/S 이력 등록·삭제 |

## Supabase 테이블 구조

| 테이블 | 설명 |
|--------|------|
| `tb_sales_order` | 발주 정보 (고객사, 모델, 납품일, 케이블, 주소 등) |
| `tb_production` | 생산 실적 (시리얼, 로트, 문서번호 등) |
| `tb_customer_manager` | 고객사별 담당자 목록 |
| `tb_order_history` | 오더 수정 이력 |
| `tb_as_history` | A/S 이력 (접수·출동·조치내용) |
| `users` | 사용자 계정 및 역할 |

## 주요 화면 설명

### 영업 입력 (`sales-input.jsx`)
- 고객사 콤보박스 + 신규 고객사 추가·관리
- 고객사별 담당자 DB 관리 (대표 담당자 자동 선택)
- 카카오 우편번호 API 연동 실주소 검색
- 현장담당자(이름·연락처) 입력
- 케이블 길이 칩 선택

### 통합 조회 (`order-lookup.jsx`)
- 상태·모델·고객사·날짜 범위·통합검색 필터
- 컬럼 고정 너비 테이블, 클릭 시 우측 드로어 상세
- A/S 역할 계정에서 이력 추가·삭제 가능

### 생산 대기 (`production-waiting.jsx`)
- 테이블·카드·칸반·타임라인 4가지 뷰 전환
- 칸반: 좁은 화면에서 컬럼 260px 고정 + 가로 스크롤

## 트러블슈팅

### Supabase 연결 오류
- `supabase-config.js`의 URL·키 확인
- Supabase 프로젝트 대시보드에서 RLS 정책 확인

### 우편번호 팝업이 열리지 않음
- 팝업 차단 해제 후 재시도

### A/S 이력 로드 실패
- Supabase에 `tb_as_history` 테이블 생성 여부 확인
- 테이블이 없어도 앱은 정상 동작하며 콘솔에 WARN 로그 출력

---

마지막 업데이트: 2026년 6월
