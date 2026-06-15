# order-lookup 화면 개편 설계

**날짜:** 2026-06-12  
**파일:** `order-lookup.jsx`

---

## 목적

생산 완료(COMPLETED) 오더만을 대상으로 하는 통합 조회 화면으로 재구성.
검색·필터 UI를 단순화하고, 상세 드로어에서 오더에 연관된 모든 정보(오더 이력, A/S 접수, A/S 처리 이력)를 확인할 수 있도록 한다.

---

## 변경 범위

### 1. 상태 필터 고정

- `fStatus` 초기값을 `'COMPLETED'`로 고정하고 상태 필터 드롭다운 UI를 제거한다.
- 필터 로직에서 `fStatus` 조건은 유지(항상 `'COMPLETED'`).

### 2. 필터 패널

제거: 상태(status) 드롭다운

유지:
- 통합 검색 (col-span-2)
- 모델 드롭다운
- 고객사 드롭다운
- 기간 기준(납품일/생산일) 드롭다운
- 시작일 / 종료일 date 입력

### 3. 테이블

제거: 상태(status) 열 — 항상 COMPLETED이므로 불필요

유지:
- 오더 # (sortable)
- 고객사 (sortable)
- 모델
- 충전소 ID
- 납품일 (sortable)
- 생산일
- chevron (>)

### 4. 드로어 섹션 확장

| 순서 | 섹션명 | 데이터 소스 | 신규여부 |
|------|--------|------------|---------|
| 1 | 영업 입력 정보 | `order` 필드 | 기존 |
| 2 | 생산 실적 정보 | `order.production` | 기존 |
| 3 | 오더 변경 이력 | `PMDB.getHistory(order_id)` | **신규** |
| 4 | A/S 접수 현황 | `PMDB.loadAsReceptions()` → `order_id` 필터 | **신규** |

#### 섹션 3 — 오더 변경 이력

- `PMDB.getHistory(order_id)` 결과를 최신순으로 나열
- 표시 필드: `changed_at`, `changed_by`, `action`, `changed_fields`
- 이력 없으면 "변경 이력이 없습니다" 안내 메시지

#### 섹션 4 — A/S 접수 현황

- `PMDB.loadAsReceptions()`에서 `order_id`가 일치하는 레코드만 필터
- 각 접수건을 카드 형태로 표시:
  - 헤더: 접수번호(`reception_no`), 상태 배지, 우선순위
  - 본문: 고장유형, 접수일시, 신고자, 담당자, 출동일, 처리유형, 처리내용, 비용
  - 하단: 처리 이력 로그 (`PMDB.getAsLogs(reception_id)`) — 상태 변경 타임라인
- 접수 없으면 "등록된 A/S 접수가 없습니다" 안내


## 컴포넌트 구조

```
OrderLookupScreen         ← 메인 화면 (필터 + 테이블)
  └─ OrderDrawer          ← 우측 드로어
       ├─ Section: 영업 입력 정보
       ├─ Section: 생산 실적 정보
       ├─ OrderHistorySection   ← 신규
       └─ AsReceptionSection    ← 신규
```

### 신규 컴포넌트

**`OrderHistorySection({ orderId })`**
- `PMDB.getHistory(orderId)` 호출
- `orderId` 변경 시 재로드 (`React.useEffect`)

**`AsReceptionSection({ orderId })`**
- `PMDB.loadAsReceptions()`에서 `order_id === orderId` 필터
- 각 접수에 대해 `PMDB.getAsLogs(reception.id)` 로 처리 이력 표시

---

## 데이터 흐름

```
오더 클릭
  → setSelId(order_id)
  → OrderDrawer 마운트
       → OrderHistorySection: PMDB.getHistory(order_id)
       → AsReceptionSection: PMDB.loadAsReceptions() 필터
            → 각 접수별 PMDB.getAsLogs(reception_id)
       → AsHistorySection: PMDB.getAsHistory(order_id)
```

모든 읽기는 메모리 캐시에서 동기 반환 — 별도 로딩 상태 불필요.

---

## 제약 / 비변경 사항

- `window.PMDB.*` 및 `window.actions.*` 인터페이스 변경 없음
- React 훅 별칭 패턴 유지: `useStateOL`, `useMemoOL` 등
- 기존 드로어 푸터 버튼(영업 수정, 생산대기 변경, 생산 입력) 유지
- CSS 클래스(`card`, `btn`, `badge`, `dgrid`, `dsec__title` 등) 그대로 사용
