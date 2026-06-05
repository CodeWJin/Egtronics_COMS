# Egtronics COMS - 충전기 관리 웹 애플리케이션

Egtronics COMS(Charger Operation Management System)는 이지트로닉스의 EV 충전기 영업·생산 관리를 위한 웹 애플리케이션입니다.

## 주요 기능

- **영업 입력**: 신규 발주 데이터 입력 (우편번호 실검색, 케이블 길이, 현장담당자)
- **생산 대기/완료**: 생산 상태별 테이블·카드·칸반·타임라인 뷰
- **생산 매핑**: 생산 실적 입력 (시리얼·로트·SW 버전·검사일)
- **주문 조회**: 전체 오더 검색·필터·정렬 및 드로어 상세 조회
- **A/S 이력**: A/S 역할 계정으로 오더별 유지보수 이력 등록·조회
- **사용자 관리**: 역할(영업·생산·A/S·관리자) 기반 접근 제어

## 기술 스택

- **Frontend**: React 18.3.1, JSX, Vanilla CSS, Babel Standalone
- **Backend**: Supabase (PostgreSQL)
- **Serverless**: Vercel Functions (설정 주입, 이메일 발송)
- **이메일**: Resend API
- **주소 검색**: 카카오(Daum) 우편번호 서비스
- **배포**: Vercel

## 설치 및 실행

```bash
git clone https://github.com/CodeWJin/Egtronics_COMS.git
cd Egtronics_COMS
npm install
```

### 로컬 개발

```bash
# supabase-config.example.js 를 복사해 실제 키 입력
cp supabase-config.example.js supabase-config.js

npm run dev   # vercel dev → localhost:3000
```

> `vercel dev` 는 Vercel CLI(`npm i -g vercel`) 설치 후 사용 가능합니다.  
> 서버리스 함수(`api/`)도 로컬에서 동작합니다.

## 환경 변수

| 변수 | 설명 | 위치 |
|------|------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL | Vercel 환경변수 |
| `SUPABASE_ANON_KEY` | Supabase anon public 키 | Vercel 환경변수 |
| `RESEND_API_KEY` | Resend 이메일 API 키 | Vercel 환경변수 |
| `MAIL_FROM` | 발신자 이름·주소 | Vercel 환경변수 (선택) |

로컬 개발 시에는 `supabase-config.js` 파일에 URL과 키를 직접 입력합니다 (`.gitignore` 적용).

## 초기 DB 세팅

Supabase SQL 에디터에서 `seed.sql` 전체 실행:

1. Supabase 대시보드 → **SQL Editor**
2. `seed.sql` 내용 붙여넣기 후 **Run**

포함 내용: 테이블 마이그레이션, 사용자·고객사·주문·생산·마스터 초기 데이터

## 프로젝트 구조

```
├── index.html                   # 메인 HTML 진입점
├── app.jsx                      # React 앱 (상태·라우팅·부팅)
├── auth.jsx                     # 로그인 / 이메일 인증
├── shell.jsx                    # 레이아웃 (TopNav, 화면 전환)
│
├── Views
├── sales-input.jsx              # 영업 입력 (발주·고객·담당자·주소)
├── production-waiting.jsx       # 생산 대기 (테이블·카드·칸반·타임라인)
├── production-mapping.jsx       # 생산 매핑 (실적 입력)
├── production-complete.jsx      # 생산 완료 목록
├── order-lookup.jsx             # 통합 조회 + A/S 이력
├── admin-users.jsx              # 사용자 관리 (관리자 전용)
│
├── Utilities
├── db.js                        # Supabase 데이터 레이어 (캐시 + 비동기 쓰기)
├── icons.jsx                    # 아이콘 컴포넌트
├── tweaks-panel.jsx             # 실시간 테마 변경 패널
│
├── Vercel Serverless (api/)
├── api/config.js                # Supabase 접속 정보 주입 (/supabase-config.js)
├── api/send-code.js             # 이메일 인증번호 발송 (/api/send-code)
│
├── Configuration
├── supabase-config.example.js   # Supabase 설정 템플릿 (실제 키는 .gitignore)
├── seed.sql                     # DB 초기화 SQL (테이블 생성 + 시드 데이터)
├── styles.css                   # 전역 스타일 (다크/라이트 테마, 반응형)
├── vercel.json                  # Vercel 배포 설정
└── package.json
```

## 역할별 접근 권한

| 역할 | 접근 가능 화면 |
|------|--------------|
| `admin` (관리자) | 전체 + 사용자 관리 |
| `sales` (영업) | 영업 입력 · 생산 대기 · 통합 조회 |
| `production` (생산) | 생산 대기 · 생산 매핑 · 생산 완료 · 통합 조회 |
| `as` (A/S) | 통합 조회 · A/S 이력 등록·삭제 |

## Supabase 테이블 구조

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 계정 및 역할 |
| `tb_sales_order` | 발주 정보 (고객사·모델·납품일·케이블·주소 등) |
| `tb_production_info` | 생산 실적 (시리얼·로트·SW버전·검사일·문서번호) |
| `tb_customer_manager` | 고객사별 담당자 목록 |
| `tb_order_history` | 오더 변경 이력 |
| `tb_as_history` | A/S 이력 (접수·출동·조치내용) |
| `tb_master_customer` | 고객사 마스터 (드롭다운) |
| `tb_master_model` | 모델 마스터 (드롭다운) |
| `tb_master_sw_version` | SW 버전 마스터 |
| `tb_master_cable_length` | 케이블 길이 마스터 |

## 트러블슈팅

**Supabase 연결 오류**
- Vercel 환경변수에 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 등록 여부 확인
- 로컬: `supabase-config.js` 파일 존재 여부 확인 (`supabase-config.example.js` 참고)

**마스터 데이터 없음 (드롭다운 비어 있음)**
- `seed.sql`을 Supabase SQL 에디터에서 실행

**이메일 인증 오류**
- Vercel 환경변수에 `RESEND_API_KEY` 등록 여부 확인

**우편번호 팝업이 열리지 않음**
- 브라우저 팝업 차단 해제 후 재시도

---

마지막 업데이트: 2026년 6월
