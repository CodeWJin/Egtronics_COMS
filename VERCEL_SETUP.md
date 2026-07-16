# Vercel 배포 가이드

> 이 프로젝트는 **빌드 스텝이 없는 정적 사이트**입니다. React/Babel Standalone이 브라우저에서 직접 JSX를 트랜스파일하고, 데이터는 Supabase에 직접 접속합니다. Vercel에는 서버리스 함수가 `api/config.js` 하나만 있으며, 역할은 Supabase 접속 정보를 브라우저에 주입하는 것뿐입니다(이메일 발송 등 별도 백엔드 없음).

## 1단계: Vercel 계정 생성 및 로그인

### 온라인에서 (권장)
1. https://vercel.com 방문
2. 'Sign Up' 클릭
3. GitHub 계정으로 로그인 (권장)
4. 이메일로 확인

### CLI를 통한 로그인
```bash
npm install -g vercel
vercel login
```

---

## 2단계: Vercel CLI 설정 (선택사항)

로컬에서 `api/config.js`까지 포함해 실제 배포 환경과 동일하게 테스트하려면 Vercel CLI가 필요합니다 (`npx serve`는 정적 파일만 서빙하고 `api/`는 동작하지 않음).

```bash
# Vercel CLI 전역 설치
npm install -g vercel

# 이미 이 프로젝트에 연결되어 있음 (.vercel/project.json 존재)
# 최초 1회만 필요:
vercel link

# 로컬에서 api/ 포함 풀스택 실행
vercel dev
```

---

## 3단계: GitHub을 통한 배포 (권장)

### 가장 간단한 방법:

1. **Vercel 대시보드 접속**
   - https://vercel.com/dashboard

2. **'Add New...' → 'Project' 클릭**

3. **GitHub 저장소 선택**
   - "Import Git Repository" 클릭
   - `CodeWJin/Egtronics_COMS` 검색 및 선택

4. **프로젝트 설정**
   - Framework Preset: `Other`
   - Root Directory: `./` (기본값)
   - Build Command: 비워둠 (빌드 스텝 없음 — `package.json`에 `build` 스크립트 없음)
   - Output Directory: 비워둠 (프로젝트 루트가 곧 배포 루트)

5. **환경 변수 설정** — 4단계 참고 (필수: `SUPABASE_URL`, `SUPABASE_ANON_KEY`)

6. **'Deploy' 클릭**

---

## 4단계: 환경 변수 설정 (중요)

### 필수 — Supabase 접속 정보

`api/config.js`가 아래 두 값을 읽어 `/supabase-config.js` 응답으로 브라우저에 내려줍니다(`window.SUPABASE_URL`, `window.SUPABASE_ANON_KEY`). **이 값이 없으면 앱이 로그인 화면조차 정상 동작하지 않습니다.**

| 변수명 | 값 | 환경 |
|--------|-------|--------|
| `SUPABASE_URL` | Supabase 대시보드 → Settings → API에서 복사 | Production, Preview |
| `SUPABASE_ANON_KEY` | 위와 동일 위치의 `anon public` 키 | Production, Preview |

Vercel 대시보드에서:
1. 프로젝트 선택 → **Settings** → **Environment Variables**
2. **Add New** 클릭하고 위 두 변수 추가
3. 로컬 개발 중인 Preview 배포도 확인하려면 "Production"뿐 아니라 **Preview** 환경도 체크

---

## 5단계: 프로젝트 구조 (Vercel 배포 대상)

```
Egtronics COMS Web/
├── index.html              ← 진입점 (React/Babel Standalone/Supabase JS를 CDN에서 로드)
├── *.jsx                    ← React 컴포넌트 (index.html의 <script type="text/babel"> 순서대로 로드)
├── db.js                    ← window.PMDB — Supabase 캐시+동기화 레이어
├── styles.css
├── docs/                    ← 검사 성적서 체크리스트 JSON (ship/, func/)
├── api/
│   └── config.js            ← GET /supabase-config.js 로 리라이트, env var를 window.* 로 주입
├── package.json             ← 빌드 스크립트 없음 (dev: npx serve, test만 존재)
└── vercel.json              ← rewrites 설정 (routes 아님)
```

`vercel.json` 실제 내용:
```json
{
  "functions": {
    "api/config.js": { "maxDuration": 10 }
  },
  "rewrites": [
    { "source": "/supabase-config.js", "destination": "/api/config" }
  ]
}
```

---

## 6단계: 로컬 개발과 프로덕션의 차이

- **로컬**: `supabase-config.example.js`를 `supabase-config.js`로 복사 후 실제 URL/키 입력 (`.gitignore` 대상, 커밋 금지). `index.html`이 이 파일을 직접 로드.
- **프로덕션(Vercel)**: `supabase-config.js` 파일은 배포되지 않는 대신, `index.html`이 `/supabase-config.js`를 요청 → `vercel.json`의 rewrite가 `api/config.js`로 라우팅 → 환경 변수 값을 스크립트로 응답.

즉 로컬/프로덕션 모두 브라우저 입장에서는 동일하게 `/supabase-config.js`를 로드하지만, 실체는 로컬은 정적 파일, 프로덕션은 서버리스 함수 응답이라는 점만 다릅니다. 별도로 API 도메인을 하드코딩하거나 수정할 코드는 없습니다.

---

## 7단계: 배포 확인

### Vercel 대시보드:
1. **Deployments** 탭 확인
2. 초록색 ✓ 표시 = 배포 성공
3. 제공된 URL 클릭하여 확인

### 실제 프로젝트 URL:
```
https://egtronics-coms.vercel.app
```
(`.vercel/project.json`에 연결된 projectName 기준)

---

## 자동 배포 설정

### GitHub 연동 시:
- `main` 브랜치에 푸시 → 자동 배포
- Pull Request 생성 → Preview 배포
- **Settings** → **Git** → 기본 설정 확인

---

## 커스텀 도메인 설정 (선택사항)

1. Vercel 대시보드 → 프로젝트 선택
2. **Settings** → **Domains**
3. **Add Domain** 클릭
4. 도메인 입력 (예: `coms.egtronics.com`)
5. DNS 설정 지시사항 따르기

---

## 트러블슈팅

### 문제: 로그인 후 데이터가 안 보이거나 화면이 비어 있음
**원인**: `SUPABASE_URL` / `SUPABASE_ANON_KEY` 환경 변수 누락이 대부분의 원인입니다.
**해결책:**
- 브라우저 콘솔에서 `window.SUPABASE_URL` 값이 비어 있는지 확인
- Vercel 대시보드 → **Settings** → **Environment Variables**에 두 값이 등록되어 있는지, Production/Preview 둘 다 체크되어 있는지 확인
- 재배포 (환경 변수는 재배포 전까지 반영 안 됨)

### 문제: 빌드/배포 실패
**해결책:**
- Vercel 대시보드 → **Deployments** → 실패한 배포 클릭 → **Build Logs** 확인
- 이 프로젝트는 빌드 스텝이 없으므로, 실패한다면 대부분 `api/config.js` 문법 오류이거나 `vercel.json` 설정 오류

### 문제: 정적 파일 404 에러
**해결책:**
- `vercel.json`의 `rewrites` 설정 확인 (`routes` 아님 — 이 프로젝트는 `rewrites`만 사용)
- 새 `.jsx` 파일 추가 시 `index.html`에 `<script type="text/babel" src="...">` 태그를 로드 순서(의존성 순서)에 맞게 추가했는지 확인

### 문제: `/supabase-config.js`가 404 또는 빈 응답
**해결책:**
- `api/config.js` 파일이 저장소에 그대로 존재하는지 확인
- `vercel.json`의 rewrite 경로(`/supabase-config.js` → `/api/config`)가 그대로인지 확인

---

## 성능 최적화

### 권장 사항:

1. **빌드 캐시 활용**
   - `package-lock.json` 커밋 (이미 완료)

2. **정적 자산 캐싱**
   - `*.jsx`는 브라우저에서 매번 Babel로 트랜스파일되므로, 파일 수·크기가 늘어날수록 초기 로드가 느려짐 — 화면 단위로 파일을 쪼개고 불필요한 코드는 정리
   - `api/config.js`는 `Cache-Control: no-store`로 응답하므로(코드에 명시) 캐싱되지 않음 — 의도된 동작(환경 변수 변경이 바로 반영되어야 함)

3. **콜드 스타트 시간 단축**
   - `api/config.js`는 로직이 거의 없어 콜드 스타트 영향이 미미함 — 별도 최적화 불필요

---

## 모니터링

### Vercel Analytics (무료):
1. **Settings** → **Analytics**
2. 자동 수집됨
- 페이지 로드 시간
- 서버 응답 시간
- 에러율 추적

---

## 예산 관리

### Vercel 무료 플랜:
- ✅ 무제한 배포
- ✅ 자동 확장
- ✅ SSL/HTTPS (무료)
- ⚠️ 월 1000시간 함수 실행 시간 (이 프로젝트는 함수가 `api/config.js` 하나뿐이라 사실상 걱정 불필요)

### 비용 확인:
- **Settings** → **Billing** → 사용량 확인

---

## 배포 후 확인 체크리스트

- [ ] 웹사이트가 정상 로드됨
- [ ] `window.SUPABASE_URL` / `window.SUPABASE_ANON_KEY`가 콘솔에서 정상 값으로 확인됨
- [ ] 로그인 및 역할별 화면 라우팅 정상 동작
- [ ] Supabase 테이블(오더, 생산, AS 등) 데이터 조회/저장 정상 동작
- [ ] 모바일/태블릿 반응형 확인 (터치 타깃 44×44px 이상)

---

## 다음 단계

1. **커스텀 도메인** 연결
2. **모니터링** 설정 (에러 추적)
3. **백업** 및 **롤백** 계획 수립 (Supabase 쪽 백업 포함)

---

## 지원 및 문서

- Vercel 공식 문서: https://vercel.com/docs
- Vercel 서버리스 함수: https://vercel.com/docs/functions/serverless-functions
- Supabase 문서: https://supabase.com/docs
