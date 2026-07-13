# 출하대기 화면 "출하검사" 일괄등록

날짜: 2026-07-13
대상 파일: `quality-AwaitPickup.jsx` (`ProductionCompleteScreen`), `ship-inspection.jsx` (`ShipInspectionDrawer`, `ShipPhotoTab`), `db.js` (`addShipPhoto`, `deleteShipPhoto`)

## 배경

출하대기 목록에서 오더를 다중선택해 "일괄 출하완료"(상태 전환)는 이미 가능하지만, 그 전 단계인 **출하검사 성적서 자체를 여러 오더에 한 번에 등록**하는 기능은 없다. 같은 모델 여러 대를 한 번에 검수·포장하는 실무 흐름에서는 체크리스트 내용(검사자, 검사일자, 항목 체크, 비고, 첨부 사진)이 사실상 동일한 경우가 많아 오더마다 반복 입력하는 건 낭비다.

체크리스트는 모델별로 다르다(`docs/ship/{model_code}.json`)는 제약이 있고, 사진은 `tb_ship_inspection.photos`가 아니라 Supabase Storage(`ship-photos` 버킷)에 오더별 개별 파일로 올라가는 구조라 "동일 적용"이 checklist 텍스트값과 사진 파일 양쪽에서 서로 다른 구현을 요구한다.

## 범위

- 대상: `quality-AwaitPickup.jsx`의 출하대기 목록 다중선택 + `ShipInspectionDrawer`(`ship-inspection.jsx`)의 저장·사진첨부 로직.
- DB 스키마 변경 없음. `tb_ship_inspection.photos` JSON 배열 안의 개별 항목에 `batch_id` 필드 하나만 추가(마이그레이션 불필요, 기존 항목은 `batch_id` 없이 그대로 유효).
- 기존 개별 오더 출하검사 흐름(행의 "출하검사" 버튼 → `ShipInspectionDrawer` 단일 편집)은 완전히 그대로 유지한다. 이번 기능은 대체가 아니라 추가 옵션.
- "일괄 출하완료"(상태 전환, `handleBulkShipComplete`)는 변경하지 않는다. 단, 선택 가능 기준이 바뀌므로 버튼 활성화 조건에 가드를 추가한다.

## 설계

### 1. 행 선택 기준 변경 — "이미 검사완료" 게이트 → "같은 모델" 게이트

현재 체크박스는 `disabled={!shipAllDone}`으로, 이미 출하검사가 끝난 건만 선택 가능하다(일괄 출하완료 전용). 일괄 검사 *등록*은 반대로 아직 검사 안 된 건을 선택해야 하므로 이 게이트를 제거하고, 대신 `production-waiting.jsx`의 `canSelect` 패턴을 그대로 가져와 **같은 모델끼리만 함께 선택** 가능하도록 제한한다.

```js
const selectedOrders = filtered.filter(o => selectedIds.has(o.order_id));
const selectionModel = selectedOrders[0]?.model_name || null;
const canSelect = (o) => !selectionModel || o.model_name === selectionModel;
```

체크박스는 `disabled={!checked && !canSelect(o)}`, 모델이 달라 비활성화된 경우 `title="다른 모델과는 함께 선택할 수 없습니다"`. 기존 "출하검사를 먼저 완료해 주세요" `HelpDot`은 제거한다(더 이상 그 이유로 막지 않으므로).

헤더의 "전체 선택" 체크박스(`toggleSelectAll`, `eligibleIds` 기반)는 **변경하지 않는다** — 기존처럼 "이미 검사 완료된 건 전체 선택"이라는 좁은 용도로 남긴다. 새 기능은 행별 체크박스 수동 선택으로만 접근한다.

### 2. 선택 툴바 — 버튼 두 개, 서로 다른 활성화 조건

`selectedIds.size > 0`일 때 뜨는 기존 툴바에 버튼을 하나 추가한다.

- **"선택 N건 일괄 출하검사 등록"** (신규): `selectedOrders.every(o => !isShipAllDone(o))`일 때만 활성화. 하나라도 이미 검사 완료된 건이 섞여 있으면 비활성화 + `title="이미 검사 완료된 건이 포함되어 있습니다"`. (선택 자체는 막지 않는다 — 검사완료 건도 "일괄 출하완료" 대상으로는 여전히 선택 가능해야 하므로, 버튼 레벨에서만 가드한다.)
- **"선택 N건 일괄 출하완료"** (기존): 지금까지는 체크박스 자체가 `shipAllDone`만 허용해서 암묵적으로 안전했지만, 게이트를 풀었으므로 `selectedOrders.every(isShipAllDone)`가 아니면 명시적으로 비활성화 + `title="출하검사가 완료되지 않은 오더가 있습니다"`를 추가한다.

### 3. 일괄 등록 드로어 — 체크리스트 "한 번 작성 → 전체 적용"

"일괄 출하검사 등록" 클릭 시:

```js
const openBulkShipInspect = () => {
  const anchor = filtered.find(o => selectedIds.has(o.order_id));
  if (!anchor) return;
  setBulkTargetIds([...selectedIds]);
  setShipInspectOrder(anchor);
};
```

- `filtered` 배열 순서상 가장 먼저 나오는 선택된 오더를 대표(anchor)로 삼는다. 등록 대상은 전부 미검사 상태이므로(2번 가드로 보장) `existingData`는 항상 없음 — 드로어는 항상 빈 폼으로 시작한다.
- `ShipInspectionDrawer`는 `modelInfo={window.findModelInfo(anchor.model_name)}`로 anchor 모델의 체크리스트를 로드한다(선택된 오더가 모두 같은 모델이므로 정확).
- 드로어의 `onSave`를 분기한다:

```js
onSave={(data) => {
  if (bulkTargetIds) {
    bulkTargetIds.forEach(id => saveShipInspection(id, JSON.parse(JSON.stringify(data))));
    window.actions.flashToast(`${bulkTargetIds.length}건 출하검사 일괄 등록 완료`, 'success');
  } else {
    saveShipInspection(shipInspectOrder.order_id, data);
    setTimeout(() => setShipReport({ order: shipInspectOrder, inspectionData: data }), 250);
  }
}}
onClose={() => { setShipInspectOrder(null); setBulkTargetIds(null); }}
```

일괄 모드에서는 저장 후 특정 오더 하나를 골라 성적서 미리보기를 띄우는 게 의미가 없으므로 `ShipReport` 자동 오픈은 하지 않는다 — 토스트로만 완료를 알린다. **선택 상태(`selectedIds`)는 저장 후에도 유지**한다 — 이어서 사진을 첨부하거나 "일괄 출하완료"로 바로 넘어갈 수 있도록.

### 4. 사진 일괄 첨부 — `batch_id`로 오더 간 연결

사진은 오더마다 `order/{order_id}/{timestamp}{ext}`라는 별도 storage 경로를 갖는 독립 파일이라, 체크리스트처럼 값을 복사하는 게 아니라 **같은 파일을 각 오더에 각각 업로드**해야 한다. 업로드 시점에 오더 간 "같은 사진"임을 표시하기 위해 `batch_id`를 함께 기록한다.

`ShipInspectionDrawer`에 선택적 prop `extraOrderIds`(대표 오더를 제외한 나머지 대상, 기본값 없음/`undefined`)를 추가하고 `ShipPhotoTab`으로 그대로 전달한다. 일괄 흐름에서는 `quality-AwaitPickup.jsx`가 드로어를 열 때 `extraOrderIds={bulkTargetIds?.filter(id => id !== anchor.order_id)}`를 넘긴다.

체크리스트 저장(3번)과 사진첨부는 같은 드로어 세션에서 동시에 할 수 없다 — `ShipPhotoTab`은 `hasInspRow`(= 해당 오더에 이미 `tb_ship_inspection` 행이 있는지)가 참이어야 열리는데, 신규 등록 시점엔 아직 아무 오더도 행이 없다(드로어가 "검사 완료 저장"과 동시에 닫히는 기존 동작 때문에 체크리스트 저장 → 사진첨부가 한 세션에서 이어지지 않는 건 기존 단일 오더 흐름도 마찬가지). 따라서 사진을 붙이려면: (1) "일괄 출하검사 등록"으로 체크리스트를 먼저 저장(3번, 대상 전원에게 행 생성됨) → (2) 선택 상태 그대로 "일괄 출하검사 등록"을 다시 열면 이번엔 `hasInspRow`가 참이라 사진첨부 탭이 열리고, 여기서 올린 사진이 `extraOrderIds`에도 함께 복제된다.

`db.js` 변경:

```js
// addShipPhoto(order_id, file, by, batchId) — batchId 있으면 photoEntry에 기록
const photoEntry = { filename, url, storage_path, uploaded_by, uploaded_at, batch_id: batchId || null };

// deleteShipPhoto(order_id, storagePath, siblingOrderIds) — siblingOrderIds 있으면
// 삭제 대상의 batch_id를 구해 각 sibling에서 같은 batch_id 항목을 찾아 함께 삭제(storage 파일 포함)
```

`ShipPhotoTab.handleFiles`: `extraOrderIds`가 있을 때만 이번 파일에 `batchId`(`${Date.now()}-${랜덤6자}`)를 생성해 대표 오더 업로드와 나머지 오더 업로드 모두에 동일하게 넘긴다. `extraOrderIds`가 없는(기존 단일 오더) 흐름은 `batchId`를 아예 안 넘기므로 동작 변화 없음. 나머지 오더 업로드는 `Promise.all` + 개별 실패는 무시(대표 오더 업로드만 성공하면 사용자 입장에서 최소한의 기능은 보장), 성공 시 `"사진이 N건 오더에 함께 첨부되었습니다"` 토스트.

`ShipPhotoTab.handleDelete`: `extraOrderIds`가 있을 때만 `deleteShipPhoto(orderId, storagePath, extraOrderIds)`를 호출(연계 삭제 활성화), 없으면 기존과 동일하게 `deleteShipPhoto(orderId, storagePath)`만 호출.

**연계 삭제는 "일괄 드로어가 열려 있는 동안"으로 한정한다.** 드로어를 닫고 나중에 개별 오더를 따로 열어 그 사진을 지우면(그 시점엔 `extraOrderIds`가 없는 단일 편집 세션이므로) 그 오더에서만 삭제되고 다른 오더는 영향받지 않는다 — 며칠/몇 주 뒤 관계없어 보이는 화면에서의 삭제가 다른 오더 데이터에 조용히 영향을 미치는 걸 방지하기 위한 의도적 설계다. `batch_id`가 없는 사진(이 기능 이전 업로드분, 또는 단일 오더에서 올린 사진)은 애초에 연계 대상이 없으므로 항상 해당 오더에서만 삭제된다.

### 5. 기존 로직과의 상호작용

- `bulkTargetIds`는 `ProductionCompleteScreen`의 새 상태(`useStatePC(null)`). 드로어가 열려있지 않을 때/단일 편집 중엔 `null`.
- `shipInspectOrder`(기존 상태)는 일괄 모드에서도 "대표 오더"를 담는 용도로 그대로 재사용한다 — 별도의 새 상태를 만들지 않는다.
- 일괄 등록 완료 후 `window.actions.refreshOrders()`는 필요 없다(주문 상태 자체는 안 바뀜, `shipInspections` 로컬 Map만 각 대상 id에 대해 갱신하면 화면의 "출하검사" 배지가 즉시 갱신됨 — `saveShipInspection` 콜백이 이미 이 Map을 갱신하므로 추가 조치 불필요).
- `handleBulkShipComplete`(기존)는 코드 변경 없음. 버튼 활성화 조건만 2번에서 추가.

## 검증 계획

- `npm test`, 훅 별칭·`supabase.from` 직접호출 grep, 슬롭 디텍터 — 기존 필수 절차 그대로.
- 브라우저 수동 확인(자동화 테스트 없는 코드베이스):
  - 같은 모델 미검사 오더 3건 선택 → "일괄 출하검사 등록" 버튼 활성화 확인, 다른 모델 오더는 체크박스가 비활성화되는지
  - 그중 1건을 개별 "출하검사" 버튼으로 먼저 완료시킨 뒤 셋을 함께 선택 → "일괄 출하검사 등록" 버튼이 비활성화되고 툴팁이 뜨는지
  - 일괄 등록 저장 → 3건 모두 "출하검사 완료" 배지로 바뀌는지, 성적서 미리보기가 자동으로 뜨지 않는지(토스트만)
  - 선택 유지된 상태에서 "일괄 출하검사 등록"을 다시 열어 사진 1장 첨부 → 3건 모두 사진 개수가 올라가는지(개별 오더의 "출하검사" 버튼으로 열어 확인)
  - 그중 한 오더에서 방금 첨부한 사진을 삭제(일괄 드로어를 다시 연 상태에서) → 나머지 두 오더에서도 같은 사진이 사라지는지
  - 드로어를 완전히 닫고 개별 오더 하나를 단독으로 열어 사진을 삭제 → 다른 오더는 영향받지 않는지
  - "일괄 출하완료" 버튼이 미검사 건이 섞인 선택에서는 비활성화되는지, 전부 검사완료 후엔 활성화되는지
  - 기존 단일 오더 "출하검사" 버튼 흐름(체크리스트 작성, 사진첨부, 삭제)이 이번 변경 이전과 동일하게 동작하는지