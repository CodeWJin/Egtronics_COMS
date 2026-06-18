# 출하 전 사진 등록 기능 설계

**날짜**: 2026-06-18  
**상태**: 승인됨

---

## 개요

출하대기(AWAIT_PICKUP) 단계의 오더에 사진을 선택적으로 첨부할 수 있는 기능을 추가한다.
`tb_ship_inspection` 테이블에 `photos` 컬럼(JSON)을 추가하고, Supabase Storage `ship-photos` 버킷에 파일을 저장한다.
등록된 사진은 출하대기 화면(quality-AwaitPickup)과 오더 조회 화면(order-lookup) 양쪽에서 접근할 수 있다.

---

## 제약 조건

- 사진 첨부는 **선택 사항**. 사진 없이도 출하 완료 가능.
- 사진 등록은 **출하대기(AWAIT_PICKUP) 단계부터** 가능.
- `tb_ship_inspection` 행이 없는 상태(출하검사 미작성)에서는 사진 업로드 불가. "출하검사를 먼저 저장하세요" 안내 표시.

---

## 1. 데이터 구조

### DB 스키마 변경

```sql
ALTER TABLE tb_ship_inspection ADD COLUMN photos TEXT DEFAULT '[]';
```

`photos` 컬럼은 JSON 문자열 배열. 기존 `checks` 컬럼과 동일한 직렬화 방식.

```json
[
  {
    "filename": "front.jpg",
    "url": "https://...",
    "storage_path": "order/42/1718000000_front.jpg",
    "uploaded_by": "prod",
    "uploaded_at": "2025-06-18 14:30:00"
  }
]
```

### Supabase Storage

- 버킷: `ship-photos` (퍼블릭, 사전 생성됨)
- 경로: `order/{order_id}/{timestamp}_{filename}`

---

## 2. UI 구조

### `ship-inspection.jsx` — ShipInspectionDrawer

현재: 헤더 → 체크리스트 → 저장 버튼

변경 후:

```
헤더
탭 바 [ 체크리스트 | 사진 (N) ]
탭 콘텐츠
  - 체크리스트 탭: 기존 로직 그대로
  - 사진 탭: 업로드 버튼 + 썸네일 그리드 + 라이트박스
             (AsPhotoTab과 동일 패턴, 훅 별칭 ShipInsp 접미사 사용)
저장 버튼 (체크리스트 탭에서만 표시)
```

- 사진 탭은 저장 전후 모두 접근 가능 (단, `tb_ship_inspection` 행이 없으면 업로드 비활성)
- 사진은 업로드 즉시 DB 반영 (체크리스트 저장과 독립적)

### `quality-AwaitPickup.jsx` — 출하대기 목록

- "출하검사" 버튼에 사진 수 뱃지 추가
  - 사진 0장: 기존 버튼 그대로
  - 사진 1장 이상: `출하검사 📷3` 형태로 카운트 표시

### `order-lookup.jsx` — 오더 조회

- 출하검사 성적서 섹션에 사진 읽기 전용 썸네일 그리드 추가
- 라이트박스는 동일하게 지원, 삭제 버튼은 표시하지 않음

---

## 3. 데이터 흐름

### `db.js` 변경

**기존 `saveShipInspection` 수정**
- `data` 객체에 `photos` 배열을 포함하여 저장하도록 확장 (하위 호환 — `photos` 없으면 `[]` 유지)

**신규 메서드 3개 추가**

```js
getShipPhotos(orderId)
// cache.ship_inspections에서 해당 order_id 행의 photos 배열 반환

async addShipPhoto(orderId, file, by)
// 1. ship-photos 버킷에 파일 업로드
// 2. cache.ship_inspections[orderId].photos 배열에 추가
// 3. tb_ship_inspection UPDATE photos WHERE order_id = orderId

async deleteShipPhoto(orderId, storagePath)
// 1. ship-photos 버킷에서 파일 삭제
// 2. cache에서 storage_path 일치 항목 제거
// 3. tb_ship_inspection UPDATE photos WHERE order_id = orderId
```

### 저장 시점

| 데이터 | 저장 시점 |
|---|---|
| 체크리스트 (checks, insp_date, inspector, notes) | "저장" 버튼 클릭 |
| 사진 (photos) | 업로드/삭제 즉시 |

두 흐름은 독립적으로 동작한다.

---

## 4. 변경 파일 목록

| 파일 | 변경 유형 |
|---|---|
| `db.js` | `saveShipInspection` 수정 + `getShipPhotos` / `addShipPhoto` / `deleteShipPhoto` 추가 |
| `ship-inspection.jsx` | `ShipInspectionDrawer`에 탭 구조 + 사진 탭 컴포넌트 추가 |
| `quality-AwaitPickup.jsx` | 출하검사 버튼 사진 카운트 뱃지 추가, `getShipPhotos` 반영 |
| `order-lookup.jsx` | 출하검사 성적서 뷰에 사진 읽기 전용 섹션 추가 |
| `supabase-schema.sql` | `tb_ship_inspection` ALTER TABLE 마이그레이션 추가 |

---

## 5. 엣지 케이스

- `tb_ship_inspection` 행 없음 → 사진 탭에 "출하검사를 먼저 저장하세요" 안내, 업로드 버튼 비활성
- 업로드 중 Storage 실패 → 에러 메시지 표시, 캐시/DB 반영 안 함
- 사진 0장인 출하검사 성적서 → order-lookup 사진 섹션 "첨부된 사진이 없습니다" 표시
- `revertOrder` 실행 시 → `tb_ship_inspection` 삭제와 함께 Storage 파일도 일괄 삭제 (기존 `revertOrder`에 cleanup 추가)
