# Vercel 배포 가이드

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

```bash
# Vercel CLI 전역 설치
npm install -g vercel

# 프로젝트 디렉토리에서 Vercel 초기화
vercel
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
   - Build Command: (공백 - HTML/정적 파일만)
   - Output Directory: (공백)

5. **환경 변수 설정**
   ```
   RESEND_API_KEY = [Resend 대시보드에서 복사]
   MAIL_FROM = 이지트로닉스 <evcharger@egtronics.co.kr>
   PORT = 3000
   ```

6. **'Deploy' 클릭**

---

## 4단계: 환경 변수 설정 (중요)

### Vercel 대시보드에서:

1. 프로젝트 선택
2. **Settings** → **Environment Variables** 클릭
3. **Add New** 클릭하고 다음 변수 추가:

| 변수명 | 값 | 환경 |
|--------|-------|--------|
| `RESEND_API_KEY` | `re_xxxxx...` (Resend 대시보드에서 복사) | Production |
| `MAIL_FROM` | `이지트로닉스 <evcharger@egtronics.com>` | Production |
| `NODE_ENV` | `production` | Production |

**⚠️ 각 변수를 추가할 때 반드시 "Production" 환경만 선택하세요**

---

## 5단계: 백엔드 서버 설정

현재 프로젝트는 **정적 HTML + Node.js 백엔드** 구조입니다.

### Vercel에서 자동 감지:
- `package.json`의 `server.js` 스크립트 감지
- Express 서버 자동 배포
- `/api/*` 요청은 `server.js`로 라우팅

### 프로젝트 구조 (Vercel 호환):
```
Egtronics COMS Web/
├── server.js              ← Express 백엔드
├── Egtronics_COMS.html   ← 프론트엔드 진입점
├── *.jsx                  ← React 컴포넌트
├── styles.css
├── package.json
└── vercel.json           ← Vercel 설정
```

---

## 6단계: API 엔드포인트 수정 (중요)

프론트엔드에서 API 호출 시 도메인을 동적으로 설정하세요:

### auth.jsx (또는 API 호출 코드):
```javascript
// Before (개발 환경)
const MAIL_API = 'http://localhost:4000/api/send-code';

// After (프로덕션 호환)
const MAIL_API = `${window.location.origin}/api/send-code`;
```

---

## 7단계: 배포 확인

### Vercel 대시보드:
1. **Deployments** 탭 확인
2. 초록색 ✓ 표시 = 배포 성공
3. 제공된 URL 클릭하여 확인

### 예상 URL:
```
https://egtronics-coms.vercel.app
```

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

### 문제: 빌드 실패
**해결책:**
- Vercel 대시보드 → **Deployments** → 실패한 배포 클릭
- **Build Logs** 확인
- 일반적인 원인:
  - 환경 변수 누락
  - `package.json` 스크립트 오류
  - Node 버전 호환성

### 문제: API 요청 실패
**해결책:**
```javascript
// API 엔드포인트를 상대 경로로 수정
fetch('/api/send-code', { method: 'POST' })
// 대신에 절대 경로 사용하기
```

### 문제: 정적 파일 404 에러
**해결책:**
- `vercel.json`의 `routes` 설정 확인
- 파일이 프로젝트 루트에 있는지 확인

---

## 성능 최적화

### 권장 사항:

1. **빌드 캐시 활용**
   - `package-lock.json` 커밋 (이미 완료)

2. **환경별 설정**
   ```json
   {
     "buildCommand": "npm run build",
     "devCommand": "npm run dev"
   }
   ```

3. **콜드 스타트 시간 단축**
   - 불필요한 의존성 제거
   - Tree-shaking 활용

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
- ⚠️ 월 1000시간 함수 실행 시간

### 비용 확인:
- **Settings** → **Billing** → 사용량 확인

---

## 배포 후 확인 체크리스트

- [ ] 웹사이트가 정상 로드됨
- [ ] API 엔드포인트 응답 확인
- [ ] 환경 변수 올바르게 설정됨
- [ ] 이메일 발송 기능 테스트
- [ ] 데이터베이스 연결 확인
- [ ] 모바일 반응형 확인

---

## 다음 단계

1. **커스텀 도메인** 연결
2. **모니터링** 설정 (에러 추적)
3. **백업** 및 **롤백** 계획 수립
4. **성능 최적화** (이미지 압축, CDN 설정)

---

## 지원 및 문서

- Vercel 공식 문서: https://vercel.com/docs
- Next.js 배포: https://nextjs.org/learn/basics/deploying-nextjs-app
- Node.js 배포: https://vercel.com/docs/functions/serverless-functions
