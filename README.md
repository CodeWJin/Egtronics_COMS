# Egtronics COMS - 충전기 관리 웹 애플리케이션

Egtronics COMS(Charger Operation Management System)는 이지트로닉스의 충전기 운영 및 관리를 위한 풀스택 웹 애플리케이션입니다.

## 주요 기능

- **주문 관리**: 충전기 주문 현황 추적 및 관리
- **생산 매핑**: 생산 흐름 및 작업 할당 관리
- **판매 입력**: 신규 판매 데이터 입력 및 처리
- **주문 조회**: 기존 주문 정보 검색 및 조회
- **프로덕션 대기/완료**: 생산 상태별 관리

## 기술 스택

- **Frontend**: React 18.3.1, JSX, Vanilla CSS
- **Backend**: Node.js, Express 5.2.1
- **Database**: SQLite
- **Email**: Resend API (이메일 발송)
- **Development**: Live Server, Babel

## 설치

```bash
# 프로젝트 클론
git clone https://github.com/CodeWJin/Egtronics_COMS.git
cd "Egtronics COMS Web"

# 의존성 설치
npm install
```

## 환경 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 정보를 입력하세요:

```env
# Resend API 키 (이메일 발송용)
RESEND_API_KEY=your_resend_api_key_here

# 이메일 발송자 정보 (선택사항)
MAIL_FROM=이지트로닉스 <evcharger@egtronics.com>

# 서버 포트 (선택사항, 기본값: 4000)
PORT=4000
```

## 실행

### 개발 모드 (Frontend 개발 서버)

```bash
npm run dev
```

- Live Server가 포트 3000에서 실행됩니다
- 자동 재로드 지원
- `Egtronics_COMS.html`이 자동으로 열립니다

### 백엔드 서버

```bash
npm run server
```

- Express 서버가 설정된 포트에서 실행됩니다 (기본값: 4000)
- SQLite 데이터베이스 자동 초기화
- API 엔드포인트 제공

## 프로젝트 구조

```
├── Egtronics_COMS.html      # 메인 HTML 진입점
├── app.jsx                   # 메인 React 애플리케이션
├── auth.jsx                  # 인증 관련 컴포넌트
├── shell.jsx                 # 셸/레이아웃 컴포넌트
│
├── Views (화면별 컴포넌트)
├── order-lookup.jsx          # 주문 조회 화면
├── production-mapping.jsx    # 생산 매핑 화면
├── production-waiting.jsx    # 생산 대기 화면
├── production-complete.jsx   # 생산 완료 화면
├── sales-input.jsx           # 판매 입력 화면
│
├── Utilities (유틸리티)
├── db.js                     # 데이터베이스 작업
├── data.js                   # 데이터 처리 로직
├── icons.jsx                 # 아이콘 컴포넌트
├── tweaks-panel.jsx          # 테마/설정 패널
│
├── Backend
├── server.js                 # Express 서버
│
├── Data & Assets
├── styles.css                # 전역 스타일
├── data/                     # 데이터 저장소 (SQLite, 무시됨)
├── screenshots/              # 스크린샷 (문서용)
│
├── Configuration
├── package.json              # npm 의존성 및 스크립트
├── .env                      # 환경 변수 (미포함)
└── .gitignore               # Git 무시 파일
```

## 주요 파일 설명

| 파일 | 설명 |
|------|------|
| `Egtronics_COMS.html` | 애플리케이션 진입점, React 마운트 포인트 |
| `app.jsx` | 메인 애플리케이션 로직, 상태 관리 |
| `server.js` | Express 백엔드 서버, API 엔드포인트 |
| `db.js` | SQLite 데이터베이스 초기화 및 작업 |
| `data.js` | 비즈니스 로직 및 데이터 처리 |
| `styles.css` | 글로벌 CSS 스타일링 |

## API 엔드포인트 (예)

- `GET /api/orders` - 모든 주문 조회
- `POST /api/orders` - 새 주문 생성
- `POST /api/email/send` - 이메일 발송
- 기타 엔드포인트는 `server.js` 참조

## 개발 가이드

### 새 화면 추가

1. `src/components/views/` 디렉토리에 새 JSX 파일 생성
2. `app.jsx`의 라우팅에 추가
3. 메인 셸에 네비게이션 버튼 추가

### 스타일 커스터마이징

- `styles.css`에서 CSS 변수 수정
- `tweaks-panel.jsx`를 통한 실시간 테마 변경

### 데이터베이스 작업

- `db.js`에서 쿼리 추가/수정
- SQLite 스키마는 `data/` 디렉토리의 db 파일 참조

## 배포

### 프로덕션 빌드

```bash
# 프로덕션용 최적화 라이브러리 사용 권장
npm run build
```

### 호스팅

- HTML/CSS/JS: 정적 웹 호스팅 (Vercel, Netlify 등)
- Backend: Node.js 호스팅 (Heroku, AWS Lambda, Railway 등)

## 트러블슈팅

### 데이터베이스 에러
- `data/` 디렉토리 권한 확인
- SQLite 파일 손상 시 삭제 후 재시작

### 이메일 발송 실패
- `.env` 파일에서 `RESEND_API_KEY` 확인
- Resend 계정의 발송 도메인 설정 확인

### CORS 에러
- `server.js`의 CORS 설정 확인
- 클라이언트와 서버 포트 불일치 확인

## 라이선스

비공개(Private)

## 연락처

이지트로닉스 (Egtronics)  
이메일: evcharger@egtronics.com

---

마지막 업데이트: 2026년 6월
