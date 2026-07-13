# 출하검사 일괄등록 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 출하대기 목록(`quality-AwaitPickup.jsx`)에서 같은 모델의 여러 오더를 선택해 출하검사 성적서(체크리스트 + 사진)를 한 번에 등록할 수 있게 한다.

**Architecture:** 체크리스트는 대표 오더 하나로 `ShipInspectionDrawer`를 열어 작성한 뒤 선택된 모든 오더에 동일한 데이터를 저장한다(`window.PMDB.saveShipInspection` 반복 호출, 값 복사). 사진은 오더별로 별도 storage 파일이므로 업로드 시 공통 `batch_id`를 함께 기록해 두고, 이 `batch_id`로 "같은 사진"임을 추적해 일괄 첨부·연계 삭제한다.

**Tech Stack:** React 18(전역 스크립트, Babel Standalone 트랜스파일), Supabase JS(Storage + Postgres), 빌드 스텝 없음.

## Global Constraints

- DB 스키마 변경 없음 — `tb_ship_inspection.photos` JSON 배열의 개별 항목에 `batch_id` 필드만 추가(기존 항목은 필드 없이 그대로 유효).
- 기존 단일 오더 출하검사 흐름(체크리스트 작성, 사진 첨부·삭제)은 새 prop을 넘기지 않으면 지금과 완전히 동일하게 동작해야 한다(하위호환).
- `handleBulkShipComplete`(기존 일괄 출하완료 로직)는 내용을 바꾸지 않는다 — 버튼 활성화 조건만 추가한다.
- 헤더의 "전체 선택" 체크박스(`toggleSelectAll`, `eligibleIds` 기반)는 변경하지 않는다.
- 사진 삭제 연계는 "일괄 드로어가 열려 있는 동안"(즉 `extraOrderIds`가 실제로 넘어온 세션)으로만 한정한다. 개별 오더를 단독으로 열어 삭제할 때는 연계하지 않는다.
- 새 `.jsx` 파일을 추가하지 않는다(기존 파일만 수정) — `index.html`의 스크립트 로드 순서를 바꿀 필요 없음.
- CLAUDE.md 필수 검증: `npm test`, `grep -n "const { useState }" *.jsx`(결과 없어야 함), `grep -n "supabase\.from" *.jsx`(db.js 외에는 결과 없어야 함).
- 참조 스펙: `docs/superpowers/specs/2026-07-13-ship-inspection-bulk-register-design.md`

---

### Task 1: db.js — `addShipPhoto`/`deleteShipPhoto`에 `batch_id` 연계 추가

**Files:**
- Modify: `db.js:943-987` (`addShipPhoto`, `deleteShipPhoto` 백엔드 구현)
- Modify: `db.js:1151-1153` (`window.PMDB` 퍼사드 래퍼)

**Interfaces:**
- Consumes: 없음(최하위 레이어).
- Produces:
  - `window.PMDB.addShipPhoto(order_id, file, by, batchId)` → `Promise<{filename, url, storage_path, uploaded_by, uploaded_at, batch_id}>`. `batchId` 생략 시 `batch_id: null`(기존 동작과 동일한 photoEntry 모양 + 필드 하나 추가).
  - `window.PMDB.deleteShipPhoto(order_id, storagePath, siblingOrderIds)` → `Promise<void>`. `siblingOrderIds` 생략 시 기존과 완전히 동일(연계 없음). 넘기면: 삭제 대상 항목의 `batch_id`를 구해, 같은 `batch_id`를 가진 항목이 있는 `siblingOrderIds`의 오더에서도 photos 배열과 storage 파일을 함께 제거.

- [ ] **Step 1: `addShipPhoto`에 `batchId` 파라미터 추가**

`db.js:943-969`의 기존 코드:

```js
      async addShipPhoto(order_id, file, by) {
        const existing = cache.ship_inspections.find(x => x.order_id === order_id);
        if (!existing) throw new Error('출하검사 성적서를 먼저 저장하세요');
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
        const storagePath = `order/${order_id}/${Date.now()}${ext}`;
        let url = '';
        try {
          const { error: upErr } = await client.storage.from('ship-photos').upload(storagePath, file, { upsert: false });
          if (upErr) throw upErr;
          const { data: urlData } = client.storage.from('ship-photos').getPublicUrl(storagePath);
          url = urlData.publicUrl || '';
        } catch (e) {
          dbLog('ERROR', 'addShipPhoto', 'Storage 업로드 실패 — ' + e.message);
          throw e;
        }
        const photoEntry = { filename: file.name, url, storage_path: storagePath, uploaded_by: by || '', uploaded_at: now };
        const currentPhotos = JSON.parse(existing.photos || '[]');
        currentPhotos.push(photoEntry);
        existing.photos = JSON.stringify(currentPhotos);
        dbLog('INFO', 'write:tb_ship_inspection', `출하 사진 추가 — order_id=${order_id}, path=${storagePath}`);
        const photosJson = existing.photos;
        dbWrite('tb_ship_inspection', 'update-photos', () =>
          client.from('tb_ship_inspection').update({ photos: photosJson }).eq('order_id', order_id)
        );
        return photoEntry;
      },
```

다음으로 교체(파라미터 추가 + `photoEntry`에 `batch_id` 필드 추가, 나머지는 동일):

```js
      async addShipPhoto(order_id, file, by, batchId) {
        const existing = cache.ship_inspections.find(x => x.order_id === order_id);
        if (!existing) throw new Error('출하검사 성적서를 먼저 저장하세요');
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
        const storagePath = `order/${order_id}/${Date.now()}${ext}`;
        let url = '';
        try {
          const { error: upErr } = await client.storage.from('ship-photos').upload(storagePath, file, { upsert: false });
          if (upErr) throw upErr;
          const { data: urlData } = client.storage.from('ship-photos').getPublicUrl(storagePath);
          url = urlData.publicUrl || '';
        } catch (e) {
          dbLog('ERROR', 'addShipPhoto', 'Storage 업로드 실패 — ' + e.message);
          throw e;
        }
        const photoEntry = { filename: file.name, url, storage_path: storagePath, uploaded_by: by || '', uploaded_at: now, batch_id: batchId || null };
        const currentPhotos = JSON.parse(existing.photos || '[]');
        currentPhotos.push(photoEntry);
        existing.photos = JSON.stringify(currentPhotos);
        dbLog('INFO', 'write:tb_ship_inspection', `출하 사진 추가 — order_id=${order_id}, path=${storagePath}`);
        const photosJson = existing.photos;
        dbWrite('tb_ship_inspection', 'update-photos', () =>
          client.from('tb_ship_inspection').update({ photos: photosJson }).eq('order_id', order_id)
        );
        return photoEntry;
      },
```

- [ ] **Step 2: `deleteShipPhoto`에 `siblingOrderIds` 연계 삭제 추가**

`db.js:971-984`의 기존 코드:

```js
      async deleteShipPhoto(order_id, storagePath) {
        const existing = cache.ship_inspections.find(x => x.order_id === order_id);
        if (!existing) return;
        const currentPhotos = JSON.parse(existing.photos || '[]');
        existing.photos = JSON.stringify(currentPhotos.filter(p => p.storage_path !== storagePath));
        dbLog('INFO', 'write:tb_ship_inspection', `출하 사진 삭제 — order_id=${order_id}, path=${storagePath}`);
        if (storagePath) {
          try { await client.storage.from('ship-photos').remove([storagePath]); } catch (_) {}
        }
        const photosJson = existing.photos;
        dbWrite('tb_ship_inspection', 'update-photos', () =>
          client.from('tb_ship_inspection').update({ photos: photosJson }).eq('order_id', order_id)
        );
      },
```

다음으로 교체:

```js
      async deleteShipPhoto(order_id, storagePath, siblingOrderIds) {
        const existing = cache.ship_inspections.find(x => x.order_id === order_id);
        if (!existing) return;
        const currentPhotos = JSON.parse(existing.photos || '[]');
        const target = currentPhotos.find(p => p.storage_path === storagePath);
        existing.photos = JSON.stringify(currentPhotos.filter(p => p.storage_path !== storagePath));
        dbLog('INFO', 'write:tb_ship_inspection', `출하 사진 삭제 — order_id=${order_id}, path=${storagePath}`);
        if (storagePath) {
          try { await client.storage.from('ship-photos').remove([storagePath]); } catch (_) {}
        }
        const photosJson = existing.photos;
        dbWrite('tb_ship_inspection', 'update-photos', () =>
          client.from('tb_ship_inspection').update({ photos: photosJson }).eq('order_id', order_id)
        );

        const batchId = target?.batch_id;
        if (batchId && siblingOrderIds && siblingOrderIds.length) {
          for (const sid of siblingOrderIds) {
            if (sid === order_id) continue;
            const sib = cache.ship_inspections.find(x => x.order_id === sid);
            if (!sib) continue;
            const sibPhotos = JSON.parse(sib.photos || '[]');
            const match = sibPhotos.find(p => p.batch_id === batchId);
            if (!match) continue;
            sib.photos = JSON.stringify(sibPhotos.filter(p => p.batch_id !== batchId));
            dbLog('INFO', 'write:tb_ship_inspection', `출하 사진 연계 삭제 — order_id=${sid}, path=${match.storage_path}`);
            try { await client.storage.from('ship-photos').remove([match.storage_path]); } catch (_) {}
            const sibPhotosJson = sib.photos;
            dbWrite('tb_ship_inspection', 'update-photos', () =>
              client.from('tb_ship_inspection').update({ photos: sibPhotosJson }).eq('order_id', sid)
            );
          }
        }
      },
```

- [ ] **Step 3: 퍼사드 래퍼 시그니처 갱신**

`db.js:1151-1153`의 기존 코드:

```js
    getShipPhotos(id)                 { return this.backend.getShipPhotos(id); },
    addShipPhoto(id, file, by)        { return this.backend.addShipPhoto(id, file, by); },
    deleteShipPhoto(id, path)         { return this.backend.deleteShipPhoto(id, path); },
```

다음으로 교체:

```js
    getShipPhotos(id)                 { return this.backend.getShipPhotos(id); },
    addShipPhoto(id, file, by, batchId) { return this.backend.addShipPhoto(id, file, by, batchId); },
    deleteShipPhoto(id, path, siblingOrderIds) { return this.backend.deleteShipPhoto(id, path, siblingOrderIds); },
```

- [ ] **Step 4: 정적 검증**

Run: `node -e "new Function(require('fs').readFileSync('db.js','utf8').replace(/^const \{.*$/m,''))" 2>&1 | head -5`

이 명령은 문법 오류만 대략 잡아내기 위한 것이다(파일이 브라우저 전역 스코프를 가정하므로 완전한 실행은 안 됨). `SyntaxError`가 없으면 통과로 간주한다. 실제 신뢰할 수 있는 검증은 Task 7의 브라우저 확인이다.

- [ ] **Step 5: Commit**

```bash
git add db.js
git commit -m "$(cat <<'EOF'
feat: link ship photos across bulk-registered orders via batch_id

addShipPhoto/deleteShipPhoto accept an optional batchId/siblingOrderIds
so a photo uploaded once can be mirrored to and deleted from every order
in an active bulk ship-inspection session.
EOF
)"
```

---

### Task 2: ship-inspection.jsx — `ShipPhotoTab`이 `extraOrderIds`를 받아 업로드/삭제를 미러링

**Files:**
- Modify: `ship-inspection.jsx:133-187` (`ShipPhotoTab` 함수 시그니처, `handleFiles`, `handleDelete`)

**Interfaces:**
- Consumes: Task 1의 `window.PMDB.addShipPhoto(order_id, file, by, batchId)` / `window.PMDB.deleteShipPhoto(order_id, storagePath, siblingOrderIds)`.
- Produces: `<ShipPhotoTab orderId hasInspRow onCountChange extraOrderIds />` — `extraOrderIds`(선택, `string[]`)를 넘기면 업로드·삭제가 그 오더들에도 미러링된다. 생략 시 기존과 동일.

- [ ] **Step 1: 함수 시그니처에 `extraOrderIds` 추가**

`ship-inspection.jsx:133`의 기존 코드:

```js
function ShipPhotoTab({ orderId, hasInspRow, onCountChange }) {
```

다음으로 교체:

```js
function ShipPhotoTab({ orderId, hasInspRow, onCountChange, extraOrderIds }) {
```

- [ ] **Step 2: `handleFiles`가 업로드 시 `batchId`를 생성해 나머지 오더에도 미러링**

`ship-inspection.jsx:150-173`의 기존 코드:

```js
  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploadErr('');
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        setUploadErr('이미지 파일만 업로드할 수 있습니다.');
        continue;
      }
      setUploading(true);
      try {
        const entry = await window.PMDB.addShipPhoto(orderId, file, currentUser?.user_id || '');
        setPhotos(prev => {
          const next = [...prev, entry];
          onCountChange(next.length);
          return next;
        });
      } catch (e) {
        setUploadErr('업로드 실패: ' + e.message);
      } finally {
        setUploading(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
```

다음으로 교체:

```js
  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploadErr('');
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        setUploadErr('이미지 파일만 업로드할 수 있습니다.');
        continue;
      }
      setUploading(true);
      try {
        const batchId = (extraOrderIds && extraOrderIds.length)
          ? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          : null;
        const entry = await window.PMDB.addShipPhoto(orderId, file, currentUser?.user_id || '', batchId);
        setPhotos(prev => {
          const next = [...prev, entry];
          onCountChange(next.length);
          return next;
        });
        if (batchId) {
          const results = await Promise.all(
            extraOrderIds.map(id =>
              window.PMDB.addShipPhoto(id, file, currentUser?.user_id || '', batchId).then(() => true).catch(() => false)
            )
          );
          const mirroredCount = results.filter(Boolean).length;
          if (mirroredCount > 0) {
            window.actions.flashToast(`사진이 ${mirroredCount + 1}건 오더에 함께 첨부되었습니다`, 'success');
          }
        }
      } catch (e) {
        setUploadErr('업로드 실패: ' + e.message);
      } finally {
        setUploading(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
```

- [ ] **Step 3: `handleDelete`가 `extraOrderIds`를 연계 삭제 대상으로 전달**

`ship-inspection.jsx:175-187`의 기존 코드:

```js
  const handleDelete = async (storagePath) => {
    try {
      await window.PMDB.deleteShipPhoto(orderId, storagePath);
      setPhotos(prev => {
        const next = prev.filter(p => p.storage_path !== storagePath);
        onCountChange(next.length);
        return next;
      });
    } catch (e) {
      setUploadErr('삭제 실패: ' + e.message);
    }
    setConfirmDel(null);
  };
```

다음으로 교체:

```js
  const handleDelete = async (storagePath) => {
    try {
      await window.PMDB.deleteShipPhoto(orderId, storagePath, extraOrderIds);
      setPhotos(prev => {
        const next = prev.filter(p => p.storage_path !== storagePath);
        onCountChange(next.length);
        return next;
      });
      if (extraOrderIds && extraOrderIds.length) {
        window.actions.flashToast('연계된 오더에서도 함께 삭제되었습니다', 'success');
      }
    } catch (e) {
      setUploadErr('삭제 실패: ' + e.message);
    }
    setConfirmDel(null);
  };
```

- [ ] **Step 4: `grep`으로 별칭 규칙·직접 supabase 호출 위반 없는지 확인**

Run:
```bash
grep -n "const { useState }" ship-inspection.jsx
grep -n "supabase\.from" ship-inspection.jsx
```
Expected: 둘 다 결과 없음(exit code 1).

- [ ] **Step 5: Commit**

```bash
git add ship-inspection.jsx
git commit -m "$(cat <<'EOF'
feat: mirror ship-photo upload/delete to sibling orders when provided

ShipPhotoTab accepts an optional extraOrderIds prop; when present, an
uploaded photo is copied (with a shared batch_id) to every listed order,
and deleting it removes the batch_id-matched copy from each of them too.
Omitting the prop leaves single-order behavior unchanged.
EOF
)"
```

---

### Task 3: ship-inspection.jsx — `ShipInspectionDrawer`가 `extraOrderIds`를 `ShipPhotoTab`으로 전달

**Files:**
- Modify: `ship-inspection.jsx:310` (`ShipInspectionDrawer` 함수 시그니처)
- Modify: `ship-inspection.jsx:468-472` (`<ShipPhotoTab .../>` 호출부)

**Interfaces:**
- Consumes: Task 2의 `<ShipPhotoTab extraOrderIds />`.
- Produces: `<ShipInspectionDrawer order existingData modelInfo onSave onClose extraOrderIds />` — `extraOrderIds`(선택)를 넘기면 사진첨부 탭에서 그대로 `ShipPhotoTab`에 전달된다.

- [ ] **Step 1: 함수 시그니처에 `extraOrderIds` 추가**

`ship-inspection.jsx:310`의 기존 코드:

```js
function ShipInspectionDrawer({ order, existingData, modelInfo, onSave, onClose }) {
```

다음으로 교체:

```js
function ShipInspectionDrawer({ order, existingData, modelInfo, onSave, onClose, extraOrderIds }) {
```

- [ ] **Step 2: `ShipPhotoTab` 호출부에 prop 전달**

`ship-inspection.jsx:468-472`의 기존 코드:

```js
              <ShipPhotoTab
                orderId={order.order_id}
                hasInspRow={!!window.PMDB?.getShipInspectionDB?.(order.order_id)}
                onCountChange={setPhotoCount}
              />
```

다음으로 교체:

```js
              <ShipPhotoTab
                orderId={order.order_id}
                hasInspRow={!!window.PMDB?.getShipInspectionDB?.(order.order_id)}
                onCountChange={setPhotoCount}
                extraOrderIds={extraOrderIds}
              />
```

- [ ] **Step 3: `grep`으로 별칭 규칙 위반 없는지 재확인**

Run: `grep -n "const { useState }" ship-inspection.jsx`
Expected: 결과 없음.

- [ ] **Step 4: Commit**

```bash
git add ship-inspection.jsx
git commit -m "$(cat <<'EOF'
feat: thread extraOrderIds through ShipInspectionDrawer to ShipPhotoTab
EOF
)"
```

---

### Task 4: quality-AwaitPickup.jsx — 행 선택 기준을 "이미 검사완료"에서 "같은 모델"로 변경

**Files:**
- Modify: `quality-AwaitPickup.jsx:317-347` (`filtered.map` 내부 — 체크박스 렌더링)

**Interfaces:**
- Consumes: 없음(같은 파일 내 `filtered`, `selectedIds`만 사용).
- Produces: `selectionModel`(현재 선택된 오더들의 공통 `model_name`, 없으면 `null`), `canSelect(o)`(해당 오더를 선택 가능한지) — Task 6에서 버튼 가드에 재사용.

- [ ] **Step 1: `filtered.map` 콜백 진입부에 `selectionModel`/`canSelect` 계산 추가**

`quality-AwaitPickup.jsx:317-322`의 기존 코드:

```js
            <tbody>
              {filtered.map(o => {
                const modelInfo = window.findModelInfo(o.model_name);
                const shipInsp = shipInspections.get(o.order_id);
                const shipAllDone = isShipAllDone(o);
                const checked = selectedIds.has(o.order_id);
```

다음으로 교체:

```js
            <tbody>
              {(() => {
                const selectedOrders = filtered.filter(o => selectedIds.has(o.order_id));
                const selectionModel = selectedOrders[0]?.model_name || null;
                const canSelect = (o) => !selectionModel || o.model_name === selectionModel;
                return filtered.map(o => {
                const modelInfo = window.findModelInfo(o.model_name);
                const shipInsp = shipInspections.get(o.order_id);
                const shipAllDone = isShipAllDone(o);
                const checked = selectedIds.has(o.order_id);
```

`filtered.map(o => { ... })`을 IIFE로 감싸 `selectionModel`/`canSelect`를 매 행에서 재사용할 수 있게 한다. 닫는 괄호는 Step 3에서 함께 맞춘다.

- [ ] **Step 2: 체크박스의 `disabled`/`title`을 `shipAllDone` 대신 `canSelect`로 교체**

`quality-AwaitPickup.jsx:338-347`의 기존 코드:

```js
                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <input type="checkbox" aria-label={`오더 #${o.order_id} 일괄 출하완료 선택`}
                          checked={checked} disabled={!shipAllDone}
                          title={!shipAllDone ? '출하검사를 먼저 완료해 주세요' : ''}
                          onChange={() => toggleSelect(o.order_id)}
                          style={{ width: 17, height: 17, accentColor: 'var(--primary)', cursor: shipAllDone ? 'pointer' : 'not-allowed' }}/>
                        {!shipAllDone && <window.HelpDot text="출하검사를 먼저 완료해 주세요"/>}
                      </span>
                    </td>
```

다음으로 교체:

```js
                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <input type="checkbox" aria-label={`오더 #${o.order_id} 일괄 처리 선택`}
                          checked={checked} disabled={!checked && !canSelect(o)}
                          title={!checked && !canSelect(o) ? '다른 모델과는 함께 선택할 수 없습니다' : ''}
                          onChange={() => toggleSelect(o.order_id)}
                          style={{ width: 17, height: 17, accentColor: 'var(--primary)', cursor: (checked || canSelect(o)) ? 'pointer' : 'not-allowed' }}/>
                      </span>
                    </td>
```

- [ ] **Step 3: IIFE 닫기 — `filtered.map`의 콜백/배열 종료부 수정**

`quality-AwaitPickup.jsx:399-402`의 기존 코드(Step 1~2 적용 후에도 이 부분은 원본 그대로 남아있음):

```js
                );
              })}
            </tbody>
          </table>
```

다음으로 교체:

```js
                );
              });
              })()}
            </tbody>
          </table>
```

이 파일은 Babel Standalone이 브라우저에서 직접 트랜스파일하므로 로컬 문법 검사기가 없다 — IIFE 괄호 짝이 정확한지는 Task 7에서 `npm run dev` 후 실제로 화면을 렌더링해 콘솔에 `SyntaxError`가 없는지로 최종 확인한다.

- [ ] **Step 4: `grep`으로 별칭 규칙·직접 supabase 호출 위반 없는지 확인**

Run:
```bash
grep -n "const { useState }" quality-AwaitPickup.jsx
grep -n "supabase\.from" quality-AwaitPickup.jsx
```
Expected: 둘 다 결과 없음.

- [ ] **Step 5: Commit**

```bash
git add quality-AwaitPickup.jsx
git commit -m "$(cat <<'EOF'
refactor: gate ship-inspection row selection by model instead of ship-done

Any row can now be selected for bulk actions as long as it shares the
model of already-selected rows, mirroring production-waiting.jsx's
canSelect pattern. Per-action eligibility (ship-done vs not-yet-inspected)
moves to the bulk toolbar buttons in a later task.
EOF
)"
```

---

### Task 5: quality-AwaitPickup.jsx — 일괄 출하검사 등록 상태·드로어 분기 배선

**Files:**
- Modify: `quality-AwaitPickup.jsx:55-58` (상태 선언부, `bulkTargetIds` 추가)
- Modify: `quality-AwaitPickup.jsx:408-420` (`ShipInspectionDrawer` 렌더 + `onSave`/`onClose`)

**Interfaces:**
- Consumes: Task 3의 `<ShipInspectionDrawer extraOrderIds />`, 같은 파일의 `saveShipInspection`(기존, `quality-AwaitPickup.jsx:66-69`), `filtered`/`selectedIds`(기존).
- Produces: `bulkTargetIds`(`string[] | null`), `openBulkShipInspect()` — Task 6의 버튼 `onClick`에서 사용.

- [ ] **Step 1: `bulkTargetIds` 상태 추가**

`quality-AwaitPickup.jsx:55-58`의 기존 코드:

```js
  const [shipInspectOrder, setShipInspectOrder] = useStatePC(null);
  const [shipReport, setShipReport] = useStatePC(null);
  const [models, setModels] = useStatePC(() => window.PMDB.getModels());
  const [selectedIds, setSelectedIds] = useStatePC(() => new Set());
```

다음으로 교체:

```js
  const [shipInspectOrder, setShipInspectOrder] = useStatePC(null);
  const [shipReport, setShipReport] = useStatePC(null);
  const [models, setModels] = useStatePC(() => window.PMDB.getModels());
  const [selectedIds, setSelectedIds] = useStatePC(() => new Set());
  const [bulkTargetIds, setBulkTargetIds] = useStatePC(null);
```

- [ ] **Step 2: `openBulkShipInspect` 헬퍼 추가**

`quality-AwaitPickup.jsx:115` (`handleBulkShipComplete` 정의 바로 다음, `const completed = ...` 바로 앞)에 삽입. 기존 코드:

```js
  }, []);

  const completed = useMemoPC(
```

다음으로 교체:

```js
  }, []);

  const openBulkShipInspect = React.useCallback(() => {
    const anchor = filtered.find(o => selectedIds.has(o.order_id));
    if (!anchor) return;
    setBulkTargetIds([...selectedIds]);
    setShipInspectOrder(anchor);
  }, [filtered, selectedIds]);

  const completed = useMemoPC(
```

- [ ] **Step 3: 드로어 `onSave`/`onClose`를 일괄/단일 분기로 교체**

`quality-AwaitPickup.jsx:408-420`의 기존 코드:

```js
      {shipInspectOrder && (
        <ShipInspectionDrawer
          order={shipInspectOrder}
          existingData={shipInspections.get(shipInspectOrder.order_id)}
          modelInfo={window.findModelInfo(shipInspectOrder.model_name)}
          onSave={(data) => {
            const ord = shipInspectOrder;
            saveShipInspection(ord.order_id, data);
            setTimeout(() => setShipReport({ order: ord, inspectionData: data }), 250);
          }}
          onClose={() => setShipInspectOrder(null)}
        />
      )}
```

다음으로 교체:

```js
      {shipInspectOrder && (
        <ShipInspectionDrawer
          order={shipInspectOrder}
          existingData={shipInspections.get(shipInspectOrder.order_id)}
          modelInfo={window.findModelInfo(shipInspectOrder.model_name)}
          extraOrderIds={bulkTargetIds ? bulkTargetIds.filter(id => id !== shipInspectOrder.order_id) : undefined}
          onSave={(data) => {
            if (bulkTargetIds) {
              bulkTargetIds.forEach(id => saveShipInspection(id, JSON.parse(JSON.stringify(data))));
              window.actions.flashToast(`${bulkTargetIds.length}건 출하검사 일괄 등록 완료`, 'success');
            } else {
              const ord = shipInspectOrder;
              saveShipInspection(ord.order_id, data);
              setTimeout(() => setShipReport({ order: ord, inspectionData: data }), 250);
            }
          }}
          onClose={() => { setShipInspectOrder(null); setBulkTargetIds(null); }}
        />
      )}
```

주의: `onSave`가 호출되는 시점엔 아직 `shipInspectOrder`/`bulkTargetIds`가 살아있다(드로어 내부 `handleSave`가 `onSave` 호출 뒤 `onClose`를 트리거하는 구조 — `ship-inspection.jsx:362-368` 참고). 따라서 `onSave` 안에서 `bulkTargetIds`를 참조해도 안전하다.

- [ ] **Step 4: `grep`으로 별칭 규칙·직접 supabase 호출 위반 없는지 확인**

Run:
```bash
grep -n "const { useState }" quality-AwaitPickup.jsx
grep -n "supabase\.from" quality-AwaitPickup.jsx
```
Expected: 둘 다 결과 없음.

- [ ] **Step 5: Commit**

```bash
git add quality-AwaitPickup.jsx
git commit -m "$(cat <<'EOF'
feat: wire bulk ship-inspection drawer state and save fan-out

openBulkShipInspect picks the first selected order as the drawer anchor;
saving in bulk mode writes the same checklist data to every selected
order and skips the single-order auto-report. extraOrderIds threads
through to ShipPhotoTab so a second bulk-drawer visit can mirror photos.
EOF
)"
```

---

### Task 6: quality-AwaitPickup.jsx — 선택 툴바에 일괄 등록 버튼 추가 + 출하완료 버튼 가드

**Files:**
- Modify: `quality-AwaitPickup.jsx:276-287` (선택 툴바)

**Interfaces:**
- Consumes: Task 4의 `canSelect`/`selectionModel`(단, 이 스코프는 툴바 바깥이므로 별도로 `selectedOrders`를 계산), Task 5의 `openBulkShipInspect`/`bulkTargetIds`, 기존 `isShipAllDone`/`handleBulkShipComplete`.
- Produces: 없음(최상위 UI).

- [ ] **Step 1: 선택 툴바에 일괄 등록 버튼 추가, 출하완료 버튼에 가드 추가**

`quality-AwaitPickup.jsx:276-287`의 기존 코드:

```js
      {selectedIds.size > 0 && (
        <div className="toolbar" style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-700, var(--primary))' }}>
            <Icon name="check" size={13}/> {selectedIds.size}건 선택됨 · 출하검사 완료건
          </span>
          <div style={{ flex: 1 }}/>
          <button className="btn btn--ghost btn--sm" onClick={() => setSelectedIds(new Set())}>선택 해제</button>
          <button className="btn btn--primary btn--sm" onClick={() => handleBulkShipComplete([...selectedIds])}>
            <Icon name="truck" size={13}/> 선택 {selectedIds.size}건 일괄 출하완료
          </button>
        </div>
      )}
```

다음으로 교체:

```js
      {selectedIds.size > 0 && (() => {
        const selectedOrders = filtered.filter(o => selectedIds.has(o.order_id));
        const allNotInspected = selectedOrders.every(o => !isShipAllDone(o));
        const allInspected = selectedOrders.every(isShipAllDone);
        return (
          <div className="toolbar" style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-700, var(--primary))' }}>
              <Icon name="check" size={13}/> {selectedIds.size}건 선택됨
            </span>
            <div style={{ flex: 1 }}/>
            <button className="btn btn--ghost btn--sm" onClick={() => setSelectedIds(new Set())}>선택 해제</button>
            <button className="btn btn--secondary btn--sm" onClick={openBulkShipInspect}
              disabled={!allNotInspected}
              title={!allNotInspected ? '이미 검사 완료된 건이 포함되어 있습니다' : ''}>
              <Icon name="doc" size={13}/> 선택 {selectedIds.size}건 일괄 출하검사 등록
            </button>
            <button className="btn btn--primary btn--sm" onClick={() => handleBulkShipComplete([...selectedIds])}
              disabled={!allInspected}
              title={!allInspected ? '출하검사가 완료되지 않은 오더가 있습니다' : ''}>
              <Icon name="truck" size={13}/> 선택 {selectedIds.size}건 일괄 출하완료
            </button>
          </div>
        );
      })()}
```

- [ ] **Step 2: `grep`으로 별칭 규칙·직접 supabase 호출 위반 없는지 확인**

Run:
```bash
grep -n "const { useState }" quality-AwaitPickup.jsx
grep -n "supabase\.from" quality-AwaitPickup.jsx
```
Expected: 둘 다 결과 없음.

- [ ] **Step 3: Commit**

```bash
git add quality-AwaitPickup.jsx
git commit -m "$(cat <<'EOF'
feat: add bulk ship-inspection registration button to selection toolbar

Enabled only when none of the selected orders already have a completed
ship inspection; the existing bulk ship-complete button now requires the
opposite (all selected must be inspection-complete) since row selection
is no longer gated by inspection status.
EOF
)"
```

---

### Task 7: 전체 검증

**Files:** 없음(검증 전용 태스크).

**Interfaces:** 없음.

- [ ] **Step 1: 필수 자동 검증**

Run:
```bash
npm test
grep -n "const { useState }" *.jsx
grep -n "supabase\.from" *.jsx
node .claude/skills/impeccable/scripts/detect.mjs --json quality-AwaitPickup.jsx ship-inspection.jsx db.js
```
Expected: `npm test` 13건 전체 통과, 두 `grep`은 결과 없음(db.js는 `supabase.from` 대상에서 애초에 제외 — 이 파일이 db.js 자신이므로 grep 대상은 `*.jsx`만), 디텍터는 `[]`.

- [ ] **Step 2: 로컬 서버 기동**

Run(백그라운드): `npm run dev`

주의: 이전 세션에서 브라우저로 배치 폼을 검증하다가 실수로 실제 Supabase 데이터를 변경한 사고가 있었다. 이번엔 다음 원칙을 지킨다 — **제출/삭제류 버튼은 uid 기반 `click`으로 누르지 말고, 검증 가능한 만큼은 `evaluate_script`로 상태를 직접 읽어 확인**하고, 실제 클릭이 꼭 필요한 스텝(사진 업로드처럼 evaluate_script로 흉내내기 어려운 것)만 최소한으로, 실행 전후 `window.__pm_store__.orders`/`window.PMDB.getShipPhotos(...)` 상태를 caller가 직접 비교해 의도한 오더 외에는 바뀌지 않았는지 매번 확인한다.

- [ ] **Step 3: 모델 제한 확인**

브라우저에서 admin/quality 역할로 로그인 후 출하대기 화면 진입. `window.__pm_store__.orders`에서 서로 다른 모델의 `AWAIT_PICKUP` 오더 2건의 `order_id`를 찾는다. 한쪽을 체크 → 다른 모델 행의 체크박스가 비활성화되고 `title="다른 모델과는 함께 선택할 수 없습니다"`인지 `evaluate_script`로 DOM 속성을 읽어 확인한다(클릭하지 않고 속성만 확인).

- [ ] **Step 4: 이미 검사완료 건 포함 시 버튼 비활성화 확인**

같은 모델의 미검사 오더 2건 + 이미 `isShipAllDone`인 오더 1건(존재하면)을 함께 선택 → "일괄 출하검사 등록" 버튼이 `disabled`인지 DOM에서 확인. 셋 다 미검사 건으로만 바꿔 선택 → 버튼이 `disabled`가 아닌지 확인.

- [ ] **Step 5: 일괄 등록 저장 결과 확인**

미검사 같은 모델 오더 2~3건 선택 → "일괄 출하검사 등록" 클릭(이건 파괴적이지 않은 읽기용 모달 오픈이므로 클릭 가능) → 드로어에서 검사일자·검사자만 최소 입력 후 저장 버튼 클릭. 저장 후 `window.PMDB.getShipInspectionDB(orderId)`를 선택했던 각 `order_id`에 대해 호출해 모두 동일한 `checks`/`inspector`/`insp_date`가 들어갔는지 확인. `ShipInspectionReport`(성적서 모달)가 자동으로 뜨지 않았는지(토스트만 떴는지) 육안 확인.

- [ ] **Step 6: 사진 일괄 첨부/연계 삭제 확인**

같은 선택이 유지된 상태에서 "일괄 출하검사 등록"을 다시 클릭 → 사진첨부 탭에서 실제 이미지 파일 1장 업로드(파일 입력은 클릭이 필요하므로 이 스텝만 예외적으로 실제 UI 조작) → 업로드 후 선택했던 모든 `order_id`에 대해 `window.PMDB.getShipPhotos(orderId)`를 호출해 사진이 1장씩 있고 `batch_id`가 동일한지 확인. 그중 하나에서 그 사진을 삭제(같은 드로어 세션 안에서) → 나머지 오더들의 `getShipPhotos` 결과에서도 해당 `batch_id` 항목이 사라졌는지 확인.

- [ ] **Step 7: 개별 오더 삭제는 연계 안 됨 확인**

드로어를 완전히 닫는다(`bulkTargetIds`가 `null`이 됨). 남은 사진이 있는 오더 하나를 행의 "출하검사" 버튼으로 **개별** 오픈(이때 `ShipInspectionDrawer`에 `extraOrderIds`가 전달되지 않음) → 사진을 삭제 → 다른 오더들의 `getShipPhotos` 결과가 영향받지 않았는지 확인.

- [ ] **Step 8: 기존 흐름 회귀 확인**

기존 단일 오더 "출하검사" 버튼 → 체크리스트 작성 → 저장 → 성적서 미리보기가 정상적으로 뜨는지(변경 전과 동일한 UX). "일괄 출하완료" 버튼이 전부 검사완료 상태에서만 활성화되고, 클릭 시 기존과 동일하게 `shipOrder` + `addChargepoint`가 호출되는지(코드를 건드리지 않았으므로 회귀 위험은 낮지만, 활성화 조건이 새로 생겼으므로 실제로 눌러본다).

- [ ] **Step 9: 정리**

Run: 로컬 dev 서버 프로세스 종료(`TaskStop` 또는 해당 터미널 종료). 브라우저 탭 닫기.

- [ ] **Step 10: 최종 커밋(필요 시)**

Step 3~8에서 발견된 버그를 고쳤다면 각각 별도 커밋으로 정리한다. 문제가 없었다면 이 태스크는 커밋 없이 종료.