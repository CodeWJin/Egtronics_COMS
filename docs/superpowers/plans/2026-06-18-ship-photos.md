# 출하 전 사진 등록 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `tb_ship_inspection` 테이블에 `photos` 컬럼을 추가하고, `ShipInspectionDrawer`에 사진 탭을 구현해 출하대기(AWAIT_PICKUP) 단계의 오더에 사진을 선택적으로 첨부할 수 있게 한다.

**Architecture:** DB 스키마에 `photos TEXT DEFAULT '[]'` 컬럼을 추가하고, `db.js`에 `getShipPhotos` / `addShipPhoto` / `deleteShipPhoto` 3개 메서드를 추가한다. `ship-inspection.jsx`의 `ShipInspectionDrawer`에 탭 구조를 추가하고 `ShipPhotoTab` 컴포넌트를 파일 상단에 인라인으로 정의한다. 체크리스트 저장과 사진 업로드/삭제는 독립적 흐름이다 — 체크리스트는 저장 버튼, 사진은 업로드/삭제 즉시 DB 반영.

**Tech Stack:** Supabase (PostgreSQL + Storage bucket: `ship-photos`), React 18 (browser-side Babel, `React.useState` 전역 네임스페이스 직접 접근), `window.PMDB` 캐시+비동기 쓰기 패턴

---

## 파일 변경 목록

| 파일 | 변경 유형 |
|---|---|
| `supabase-schema.sql` | 마이그레이션 섹션 + ship-photos RLS 정책 추가 |
| `db.js` | `getShipInspectionDB` 수정, `saveShipInspection` 수정, `revertOrder` 수정, `getShipPhotos`/`addShipPhoto`/`deleteShipPhoto` 신규, PMDB 퍼사드 3개 추가 |
| `ship-inspection.jsx` | `ShipPhotoTab` 컴포넌트 추가, `ShipInspectionDrawer`에 탭 구조 |
| `quality-AwaitPickup.jsx` | 출하검사 버튼에 사진 카운트 배지 |
| `order-lookup.jsx` | `OrderDrawer`에 사진 읽기 전용 그리드 섹션 |

---

## Task 1: DB 스키마 마이그레이션

**Files:**
- Modify: `supabase-schema.sql`

- [ ] **Step 1: 마이그레이션 전용 섹션에 `photos` 컬럼 추가**

`supabase-schema.sql`의 마이그레이션 전용 섹션(`-- tb_master_model 스키마 변경` 블록 바로 위)에 삽입:

```sql
-- 출하 검사 사진 컬럼 (ship-photos 버킷 연동)
ALTER TABLE tb_ship_inspection ADD COLUMN IF NOT EXISTS photos TEXT DEFAULT '[]';
```

- [ ] **Step 2: ship-photos 버킷 RLS 정책 추가**

파일 맨 끝 (`as-photos` DELETE 정책 이후)에 추가:

```sql
-- ┌─────────────────────────────────────────────────────────┐
-- │  Supabase Storage — ship-photos 버킷 RLS 정책            │
-- │  anon key로 업로드·조회·삭제 허용                         │
-- └─────────────────────────────────────────────────────────┘

INSERT INTO storage.buckets (id, name, public)
VALUES ('ship-photos', 'ship-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "ship_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "ship_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "ship_photos_delete" ON storage.objects;

CREATE POLICY "ship_photos_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'ship-photos');

CREATE POLICY "ship_photos_select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'ship-photos');

CREATE POLICY "ship_photos_delete" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'ship-photos');
```

- [ ] **Step 3: Supabase SQL 에디터에서 마이그레이션 실행**

Supabase 대시보드 → SQL Editor에서 다음 구문 실행:
```sql
ALTER TABLE tb_ship_inspection ADD COLUMN IF NOT EXISTS photos TEXT DEFAULT '[]';
```

ship-photos 버킷은 사전 생성됨. RLS 정책 구문도 함께 실행. (`INSERT INTO storage.buckets ... ON CONFLICT DO UPDATE`는 버킷이 이미 있어도 안전하게 실행됨)

- [ ] **Step 4: 커밋**

```bash
git add supabase-schema.sql
git commit -m "feat: tb_ship_inspection photos 컬럼 + ship-photos 버킷 RLS 정책"
```

---

## Task 2: db.js 데이터 레이어

**Files:**
- Modify: `db.js`

- [ ] **Step 1: `getShipInspectionDB` 수정 — `photos` 필드 반환 추가**

`db.js` 718~722행의 `getShipInspectionDB` 함수를 다음으로 교체:

```js
getShipInspectionDB(order_id) {
  const r = cache.ship_inspections.find(x => x.order_id === order_id);
  if (!r) return null;
  return {
    insp_date: r.insp_date,
    inspector: r.inspector,
    checks: JSON.parse(r.checks || '{}'),
    notes: r.notes || '',
    saved_at: r.saved_at,
    photos: JSON.parse(r.photos || '[]'),
  };
},
```

- [ ] **Step 2: `saveShipInspection` 수정 — 신규 캐시 행에 `photos: '[]'` 포함, DB upsert에서는 photos 제외**

`db.js` 724~743행의 `saveShipInspection` 함수를 다음으로 교체:

```js
saveShipInspection(order_id, data) {
  if (data == null) {
    cache.ship_inspections = cache.ship_inspections.filter(x => x.order_id !== order_id);
    dbLog('INFO', 'write:tb_ship_inspection', `출하 검사 성적서 삭제 — order_id=${order_id}`);
    dbWrite('tb_ship_inspection', 'delete', () => client.from('tb_ship_inspection').delete().eq('order_id', order_id));
    return;
  }
  const checks = JSON.stringify(data.checks || {});
  const existing = cache.ship_inspections.find(x => x.order_id === order_id);
  if (existing) {
    Object.assign(existing, { insp_date: data.insp_date, inspector: data.inspector, checks, notes: data.notes || '', saved_at: data.saved_at });
    // photos 필드는 건드리지 않음 — addShipPhoto/deleteShipPhoto로만 변경
  } else {
    cache.ship_inspections.push({ order_id, insp_date: data.insp_date, inspector: data.inspector, checks, notes: data.notes || '', saved_at: data.saved_at, photos: '[]' });
  }
  dbLog('INFO', 'write:tb_ship_inspection', `출하 검사 성적서 저장 — order_id=${order_id}`);
  dbWrite('tb_ship_inspection', 'upsert', () => client.from('tb_ship_inspection').upsert(
    { order_id, insp_date: data.insp_date, inspector: data.inspector, checks, notes: data.notes || '', saved_at: data.saved_at },
    { onConflict: 'order_id' }
  ));
  // photos 컬럼을 upsert payload에 포함하지 않음:
  //   INSERT 시 → DB DEFAULT '[]' 적용
  //   UPDATE 시 → 기존 photos 값 유지 (Supabase upsert는 payload에 없는 컬럼을 덮어쓰지 않음)
},
```

- [ ] **Step 3: `revertOrder` 수정 — Storage 파일 일괄 삭제 추가**

`db.js` 277~291행의 `revertOrder` 함수를 다음으로 교체:

```js
revertOrder(order_id) {
  const o = cache.orders.find(x => x.order_id === order_id);
  if (o) o.status = 'PENDING';
  const prod = cache.production.find(x => x.order_id === order_id);
  if (prod) prod.serial_no = null;
  // 출하 사진 경로를 캐시에서 수집 (삭제 전에)
  const shipRow = cache.ship_inspections.find(x => x.order_id === order_id);
  const shipPhotoPaths = shipRow
    ? JSON.parse(shipRow.photos || '[]').map(p => p.storage_path).filter(Boolean)
    : [];
  cache.func_inspections = cache.func_inspections.filter(x => x.order_id !== order_id);
  cache.ship_inspections = cache.ship_inspections.filter(x => x.order_id !== order_id);
  dbLog('INFO', 'write:revert', `생산대기로 변경 — serial 초기화·검사 삭제, order_id=${order_id}`);
  dbWrite('tb_sales_order', 'revert', async () => {
    await client.from('tb_sales_order').update({ status: 'PENDING' }).eq('order_id', order_id);
    await client.from('tb_production_info').update({ serial_no: null }).eq('order_id', order_id);
    await client.from('tb_func_inspection').delete().eq('order_id', order_id);
    await client.from('tb_ship_inspection').delete().eq('order_id', order_id);
    if (shipPhotoPaths.length > 0) {
      try { await client.storage.from('ship-photos').remove(shipPhotoPaths); } catch (_) {}
    }
    return { error: null };
  });
},
```

- [ ] **Step 4: `saveShipInspection` 직후에 사진 3개 메서드 추가**

`db.js`의 `saveShipInspection` 함수 닫는 `},` 바로 뒤에 삽입:

```js
getShipPhotos(order_id) {
  const r = cache.ship_inspections.find(x => x.order_id === order_id);
  if (!r) return [];
  try { return JSON.parse(r.photos || '[]'); } catch (_) { return []; }
},

async addShipPhoto(order_id, file, by) {
  const existing = cache.ship_inspections.find(x => x.order_id === order_id);
  if (!existing) throw new Error('출하검사 성적서를 먼저 저장하세요');
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const storagePath = `order/${order_id}/${Date.now()}_${file.name}`;
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

- [ ] **Step 5: PMDB 퍼사드에 3개 메서드 추가**

`db.js`의 `getShipInspectionDB` 퍼사드 라인(`getShipInspectionDB(id)`) 바로 다음 줄에 삽입:

```js
getShipPhotos(id)                    { return this.backend.getShipPhotos(id); },
addShipPhoto(id, file, by)           { return this.backend.addShipPhoto(id, file, by); },
deleteShipPhoto(id, path)            { return this.backend.deleteShipPhoto(id, path); },
```

- [ ] **Step 6: 커밋**

```bash
git add db.js
git commit -m "feat: db.js — getShipPhotos/addShipPhoto/deleteShipPhoto 추가, revertOrder Storage 정리"
```

---

## Task 3: ShipInspectionDrawer 탭 구조 + ShipPhotoTab

**Files:**
- Modify: `ship-inspection.jsx`

- [ ] **Step 1: `ShipPhotoTab` 컴포넌트를 `ShipInspectionDrawer` 선언 바로 앞에 삽입**

`ship-inspection.jsx`의 `/* ────────── 출하 검사 성적서 Drawer ────────── */` 주석 바로 위(line 15 앞)에 다음 컴포넌트 전체를 삽입:

```jsx
function ShipPhotoTab({ orderId, hasInspRow, onCountChange }) {
  const [photos, setPhotos] = React.useState(() => {
    try { return window.PMDB?.getShipPhotos?.(orderId) || []; } catch (_) { return []; }
  });
  const [uploading, setUploading] = React.useState(false);
  const [uploadErr, setUploadErr] = React.useState('');
  const [lightbox, setLightbox] = React.useState(null);
  const [confirmDel, setConfirmDel] = React.useState(null);
  const fileInputRef = React.useRef(null);
  const lightboxRef = React.useRef(null);

  React.useEffect(() => {
    if (lightbox !== null && lightboxRef.current) lightboxRef.current.focus();
  }, [lightbox]);

  const currentUser = window.__pm_store__?.currentUser;

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

  if (!hasInspRow) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
        <Icon name="doc" size={28} style={{ color: 'var(--ink-5)', marginBottom: 12 }}/>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>
          출하검사 성적서를 먼저 저장하세요
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>
          체크리스트 탭에서 검사 정보를 입력하고 저장하면<br/>사진을 첨부할 수 있습니다.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment"
        style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)}/>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn--primary" disabled={uploading}
          onClick={() => fileInputRef.current?.click()}>
          <Icon name="plus" size={13}/> {uploading ? '업로드 중…' : '사진 첨부'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>
          {photos.length > 0 ? `${photos.length}장 첨부됨` : '첨부된 사진이 없습니다'}
        </span>
      </div>

      {uploadErr && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--r-sm)', fontSize: 13,
          background: '#fef2f2', border: '1px solid #ef4444', color: '#dc2626',
        }}>
          {uploadErr}
        </div>
      )}

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
          {photos.map((photo, idx) => (
            <div key={photo.storage_path} style={{
              position: 'relative', borderRadius: 'var(--r-sm)', overflow: 'hidden',
              aspectRatio: '1', background: 'var(--surface-2)',
            }}>
              <img src={photo.url} alt={photo.filename}
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                onClick={() => setLightbox(idx)}/>
              {confirmDel === photo.storage_path ? (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 4, padding: 6,
                }}>
                  <span style={{ fontSize: 11, color: '#fff', textAlign: 'center', marginBottom: 2 }}>삭제할까요?</span>
                  <button onClick={() => handleDelete(photo.storage_path)}
                    style={{ width: '100%', height: 44, background: '#dc2626', border: 'none', borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    삭제
                  </button>
                  <button onClick={() => setConfirmDel(null)}
                    style={{ width: '100%', height: 44, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 4, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                    취소
                  </button>
                </div>
              ) : (
                <button aria-label="사진 삭제"
                  style={{
                    position: 'absolute', top: 4, right: 4, width: 28, height: 28,
                    background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%',
                    color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onClick={() => setConfirmDel(photo.storage_path)}>
                  <Icon name="x" size={12}/>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox !== null && (
        <div ref={lightboxRef} tabIndex={-1}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setLightbox(null)}
          onKeyDown={e => {
            if (e.key === 'Escape') setLightbox(null);
            if (e.key === 'ArrowLeft' && lightbox > 0) setLightbox(lightbox - 1);
            if (e.key === 'ArrowRight' && lightbox < photos.length - 1) setLightbox(lightbox + 1);
          }}>
          <img src={photos[lightbox]?.url} alt={photos[lightbox]?.filename}
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', pointerEvents: 'none' }}/>
          <button aria-label="닫기"
            style={{
              position: 'absolute', top: 16, right: 16, width: 40, height: 40,
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
              color: '#fff', fontSize: 20, cursor: 'pointer',
            }}
            onClick={() => setLightbox(null)}>×</button>
          {lightbox > 0 && (
            <button aria-label="이전 사진"
              style={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                width: 40, height: 40, background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: '50%', color: '#fff', fontSize: 20, cursor: 'pointer',
              }}
              onClick={e => { e.stopPropagation(); setLightbox(lightbox - 1); }}>‹</button>
          )}
          {lightbox < photos.length - 1 && (
            <button aria-label="다음 사진"
              style={{
                position: 'absolute', right: 64, top: '50%', transform: 'translateY(-50%)',
                width: 40, height: 40, background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: '50%', color: '#fff', fontSize: 20, cursor: 'pointer',
              }}
              onClick={e => { e.stopPropagation(); setLightbox(lightbox + 1); }}>›</button>
          )}
          <div style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.6)', fontSize: 12,
          }}>
            {lightbox + 1} / {photos.length}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `ShipInspectionDrawer` 함수 상단 상태 선언부에 탭 상태 추가**

`ship-inspection.jsx` 17~29행의 상태 선언 블록 끝에 추가 (기존 `const [notes, ...]` 직후):

```js
const [activeTab, setActiveTab] = React.useState('checklist');
const [photoCount, setPhotoCount] = React.useState(() => {
  try { return (window.PMDB?.getShipPhotos?.(order.order_id) || []).length; } catch (_) { return 0; }
});
```

- [ ] **Step 3: `ShipInspectionDrawer`의 `return ReactDOM.createPortal(...)` 블록 전체를 교체**

`ship-inspection.jsx` 52~158행(portal 렌더 전체)을 다음으로 교체:

```jsx
return ReactDOM.createPortal(
  <>
    <div className={`drawer-backdrop${closing ? ' drawer-backdrop--closing' : ''}`} onClick={handleClose}/>
    <aside className={`drawer${closing ? ' drawer--closing' : ''}`} role="dialog" aria-modal="true" aria-label="출하 검사 성적서">
      <div className="drawer__head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="drawer__eyebrow">{order.customer_name} · 오더 #{order.order_id}</div>
          <div className="drawer__title" style={{ margin: '5px 0 10px' }}>출하 검사 성적서</div>
          <span className="badge badge--neutral">{modelInfo?.model || order.model_name}</span>
        </div>
        <button className="drawer__close" onClick={handleClose} aria-label="닫기"><Icon name="x" size={16}/></button>
      </div>

      {/* 탭 바 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-1)', background: 'var(--surface)', flexShrink: 0 }}>
        {[
          { key: 'checklist', label: '체크리스트' },
          { key: 'photos',    label: photoCount > 0 ? `사진 (${photoCount})` : '사진' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, height: 44, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? 'var(--primary-600)' : 'var(--ink-3)',
              borderBottom: activeTab === tab.key ? '2px solid var(--primary-600)' : '2px solid transparent',
              transition: 'color 120ms, border-color 120ms',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="drawer__body">
        {activeTab === 'checklist' && (<>
          <section style={{ background: 'var(--primary-50)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
                <Icon name="doc" size={16} style={{ color: 'var(--primary-600)' }}/>
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>기본 정보</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="field__label">검사일자 <span className="field__req">*</span></label>
                <input type="date" className="input" value={inspDate} onChange={e => setInspDate(e.target.value)}/>
              </div>
              <div className="field">
                <label className="field__label">검사자 <span className="field__req">*</span></label>
                <input type="text" className="input" placeholder="검사자 이름" value={inspector} onChange={e => setInspector(e.target.value)}/>
              </div>
            </div>
          </section>

          <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer', userSelect: 'none' }}
                 onClick={() => setChecks(Object.fromEntries(SHIP_CHECKLIST.map(c => [c.key, !allChecked])))}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
                <Icon name="check" size={16} style={{ color: allChecked ? 'var(--success-700)' : 'var(--ink-2)' }}/>
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>출하 검사 체크리스트</span>
              <span style={{ fontSize: 12.5, color: allChecked ? 'var(--success-700)' : 'var(--ink-4)', fontWeight: 500 }}>
                {checkedCount}/{SHIP_CHECKLIST.length}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-4)' }}>
                {allChecked ? '전체 해제 ▲' : '전체 선택 ▼'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SHIP_CHECKLIST.map(item => (
                <label key={item.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: checks[item.key] ? 'var(--success-50)' : 'var(--surface)',
                  border: `1px solid ${checks[item.key] ? 'var(--success)' : 'var(--border-1)'}`,
                  borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  transition: 'background 120ms, border-color 120ms',
                }}>
                  <input type="checkbox" checked={checks[item.key]}
                    onChange={e => setChecks(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    style={{ accentColor: 'var(--success-700)', width: 15, height: 15, flexShrink: 0 }}/>
                  <span style={{ fontSize: 13.5, color: checks[item.key] ? 'var(--success-700)' : 'var(--ink-2)', fontWeight: checks[item.key] ? 600 : 400 }}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section style={{
            borderRadius: 'var(--r-lg)', padding: '14px 16px',
            background: allChecked ? 'var(--success-50)' : 'var(--surface-2)',
            border: `1px solid ${allChecked ? 'var(--success)' : 'var(--border-1)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name={allChecked ? 'check' : 'clock'} size={18}
                style={{ color: allChecked ? 'var(--success-700)' : 'var(--ink-4)', flexShrink: 0 }}/>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: allChecked ? 'var(--success-700)' : 'var(--ink-3)' }}>
                  종합 판정: {allChecked ? '합격 (PASS)' : '검사 미완료'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                  {allChecked ? '전 항목 확인 완료 · 출하 가능 상태' : `${SHIP_CHECKLIST.length - checkedCount}개 항목 미확인`}
                </div>
              </div>
            </div>
          </section>

          <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <div className="field">
              <label className="field__label">비고</label>
              <textarea className="textarea" rows={3} placeholder="특이사항 기입 (선택)"
                value={notes} onChange={e => setNotes(e.target.value)}/>
            </div>
          </section>
        </>)}

        {activeTab === 'photos' && (
          <ShipPhotoTab
            orderId={order.order_id}
            hasInspRow={!!window.PMDB?.getShipInspectionDB?.(order.order_id)}
            onCountChange={setPhotoCount}
          />
        )}
      </div>

      <div className="drawer__foot">
        <button className="btn btn--ghost" onClick={handleClose}>
          {activeTab === 'checklist' ? '취소' : '닫기'}
        </button>
        {activeTab === 'checklist' && (
          <button className="btn btn--primary" onClick={handleSave} disabled={!canSave}
            title={!canSave ? '검사일자와 검사자를 입력해 주세요' : ''}>
            <Icon name="check" size={13}/> 검사 완료 저장
          </button>
        )}
      </div>
    </aside>
  </>,
  document.body
);
```

- [ ] **Step 4: 브라우저 수동 테스트**

1. 출하대기 오더의 "출하검사" 버튼 클릭 → Drawer 오픈
2. 탭 바 "체크리스트 | 사진" 표시 확인
3. 사진 탭 클릭 → 출하검사 미저장 상태이면 "먼저 저장하세요" 안내 표시
4. 체크리스트 탭에서 검사 정보 입력 후 저장 → Drawer 닫힘
5. 출하검사 버튼 재클릭 → 사진 탭 클릭 → 업로드 버튼 활성 확인
6. 이미지 파일 1~3장 업로드 → 썸네일 그리드 표시, 탭 배지 카운트 업데이트 확인
7. 썸네일 클릭 → 라이트박스 표시, Esc·화살표 키 동작 확인
8. 삭제 버튼 → 2단계 확인 UI → 삭제 후 그리드에서 제거 확인

- [ ] **Step 5: 커밋**

```bash
git add ship-inspection.jsx
git commit -m "feat: ShipInspectionDrawer에 탭 구조 + 사진 탭 추가"
```

---

## Task 4: 출하검사 버튼 사진 카운트 배지

**Files:**
- Modify: `quality-AwaitPickup.jsx`

- [ ] **Step 1: 출하검사 버튼에 사진 카운트 배지 추가**

`quality-AwaitPickup.jsx` 241~251행의 출하검사 버튼을 다음으로 교체:

```jsx
<button
  className={`btn btn--sm ${shipAllDone ? 'btn--success' : shipInsp ? 'btn--warning' : 'btn--secondary'}`}
  onClick={(e) => {
    e.stopPropagation();
    if (shipAllDone) {
      setShipReport({ order: o, inspectionData: shipInsp });
    } else {
      setShipInspectOrder(o);
    }
  }}>
  <Icon name={shipAllDone ? 'check' : 'doc'} size={12}/>
  {' '}출하검사
  {(() => {
    const cnt = window.PMDB?.getShipPhotos?.(o.order_id)?.length || 0;
    return cnt > 0 ? (
      <span style={{ marginLeft: 4, background: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: '1px 6px', fontSize: 10.5 }}>
        {cnt}장
      </span>
    ) : null;
  })()}
</button>
```

> **왜 PMDB를 렌더타임에 직접 읽는가:** 사진 업로드는 Drawer 안에서 일어나고, Drawer가 닫힐 때(`setShipInspectOrder(null)`) ProductionCompleteScreen이 재렌더링된다. 그 시점에 cache가 이미 업데이트되어 있으므로 별도 상태 추적 없이 최신값이 반영된다.

- [ ] **Step 2: 브라우저 수동 테스트**

1. 출하대기 목록에서 사진이 있는 오더 확인 → "출하검사 3장" 형태 배지 표시 확인
2. 사진 없는 오더 → 배지 미표시 확인

- [ ] **Step 3: 커밋**

```bash
git add quality-AwaitPickup.jsx
git commit -m "feat: 출하대기 화면 출하검사 버튼에 사진 카운트 배지 추가"
```

---

## Task 5: 오더 조회 화면 읽기 전용 사진 섹션

**Files:**
- Modify: `order-lookup.jsx`

- [ ] **Step 1: `OrderDrawer`에 `shipPhotos` 상태 추가**

`order-lookup.jsx` 428행 (`const [shipInspection, ...]` 선언) 바로 다음에 삽입:

```js
const [shipPhotos, setShipPhotosState] = React.useState(() => {
  try { return window.PMDB?.getShipPhotos?.(order.order_id) || []; } catch (_) { return []; }
});
const [shipPhotoLightbox, setShipPhotoLightbox] = React.useState(null);
```

- [ ] **Step 2: `sync` 콜백에 `shipPhotos` 재조회 추가**

`order-lookup.jsx` 432~434행의 `sync` 함수를 다음으로 교체:

```js
const sync = () => {
  setFuncInspectionState(window.getFuncInspection?.(order.order_id) ?? null);
  setShipInspectionState(window.getShipInspection?.(order.order_id) ?? null);
  setShipPhotosState(window.PMDB?.getShipPhotos?.(order.order_id) || []);
};
```

- [ ] **Step 3: `drawer__body` 내부에 사진 섹션 삽입**

`order-lookup.jsx` 540행(`<OrderHistorySection orderId={order.order_id}/>`) 바로 위에 삽입:

```jsx
{shipInspection && shipPhotos.length > 0 && (
  <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <Icon name="doc" size={16} style={{ color: 'var(--ink-3)' }}/>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }}>출하 전 사진</span>
      <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{shipPhotos.length}장</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
      {shipPhotos.map((photo, idx) => (
        <div key={photo.storage_path}
          style={{ borderRadius: 'var(--r-sm)', overflow: 'hidden', aspectRatio: '1', background: 'var(--surface-2)', cursor: 'zoom-in' }}>
          <img src={photo.url} alt={photo.filename}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onClick={() => setShipPhotoLightbox(idx)}/>
        </div>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 4: 라이트박스 렌더링 추가**

`order-lookup.jsx` 포탈 내부 닫는 `</>` 바로 위(`{shipReportVisible && shipInspection && ...}` 블록 다음)에 삽입:

```jsx
{shipPhotoLightbox !== null && (
  <div tabIndex={-1}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
    onClick={() => setShipPhotoLightbox(null)}
    onKeyDown={e => {
      if (e.key === 'Escape') setShipPhotoLightbox(null);
      if (e.key === 'ArrowLeft' && shipPhotoLightbox > 0) setShipPhotoLightbox(shipPhotoLightbox - 1);
      if (e.key === 'ArrowRight' && shipPhotoLightbox < shipPhotos.length - 1) setShipPhotoLightbox(shipPhotoLightbox + 1);
    }}>
    <img src={shipPhotos[shipPhotoLightbox]?.url} alt={shipPhotos[shipPhotoLightbox]?.filename}
      style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', pointerEvents: 'none' }}/>
    <button aria-label="닫기"
      style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', color: '#fff', fontSize: 20, cursor: 'pointer' }}
      onClick={() => setShipPhotoLightbox(null)}>×</button>
    {shipPhotoLightbox > 0 && (
      <button aria-label="이전 사진"
        style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', color: '#fff', fontSize: 20, cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); setShipPhotoLightbox(shipPhotoLightbox - 1); }}>‹</button>
    )}
    {shipPhotoLightbox < shipPhotos.length - 1 && (
      <button aria-label="다음 사진"
        style={{ position: 'absolute', right: 64, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', color: '#fff', fontSize: 20, cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); setShipPhotoLightbox(shipPhotoLightbox + 1); }}>›</button>
    )}
    <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
      {shipPhotoLightbox + 1} / {shipPhotos.length}
    </div>
  </div>
)}
```

- [ ] **Step 5: 브라우저 수동 테스트**

1. 사진이 첨부된 출하대기 오더를 오더 조회 화면에서 검색
2. 오더 클릭 → Drawer 열기 → "출하 전 사진" 섹션에 썸네일 그리드 표시 확인
3. 썸네일 클릭 → 라이트박스 표시, Esc·화살표 키 동작 확인
4. 삭제 버튼 없음 확인 (읽기 전용)
5. 사진 없는 오더 → 사진 섹션 미표시 확인

- [ ] **Step 6: 커밋**

```bash
git add order-lookup.jsx
git commit -m "feat: 오더 조회 화면에 출하 전 사진 읽기 전용 섹션 추가"
```

---

## Task 6: 전체 통합 검증

- [ ] **Step 1: 전체 플로우 테스트**

1. 출하대기 오더에서 출하검사 Drawer 오픈 → 체크리스트 작성 후 저장
2. 출하검사 Drawer 재오픈 → 사진 탭 → 이미지 파일 2~3장 업로드
3. 탭 배지 카운트 업데이트 확인 (예: "사진 (3)")
4. Drawer 닫기 → 테이블 버튼 "출하검사 3장" 배지 확인
5. 오더 조회 화면에서 해당 오더 Drawer → "출하 전 사진" 섹션 그리드 표시 확인
6. 브라우저 콘솔 `window.pmdbLogs()` → write:tb_ship_inspection update-photos 로그 확인

- [ ] **Step 2: revertOrder 사진 정리 테스트**

1. 사진이 있는 출하대기 오더를 생산 입력 화면에서 복원 처리
2. 콘솔 `window.pmdbLogs()` → revert 로그에서 Storage 삭제 시도 확인
3. Supabase Storage → ship-photos 버킷에서 해당 파일 삭제됨 확인

- [ ] **Step 3: 엣지 케이스 테스트**

- 비이미지 파일(`.txt`, `.pdf`) 업로드 시도 → "이미지 파일만 업로드할 수 있습니다." 에러 표시
- 출하검사 미저장 오더에서 사진 탭 클릭 → "먼저 저장하세요" 안내 표시
- 사진 0장인 오더의 조회 Drawer → "출하 전 사진" 섹션 미표시

---

## Self-Review

### Spec Coverage

| 요구사항 | 구현 위치 |
|---|---|
| `photos TEXT DEFAULT '[]'` 컬럼 | Task 1 Step 1 |
| ship-photos 버킷 RLS 정책 | Task 1 Step 2 |
| `getShipInspectionDB` photos 필드 | Task 2 Step 1 |
| `saveShipInspection` 하위호환 (photos 미포함 시 `'[]'` 유지) | Task 2 Step 2 |
| `revertOrder` Storage 파일 일괄 삭제 | Task 2 Step 3 |
| `getShipPhotos` / `addShipPhoto` / `deleteShipPhoto` | Task 2 Step 4 |
| PMDB 퍼사드 3개 메서드 | Task 2 Step 5 |
| ShipInspectionDrawer 탭 구조 | Task 3 Step 3 |
| ShipPhotoTab 컴포넌트 (업로드, 삭제, 라이트박스) | Task 3 Step 1 |
| 출하검사 행 없을 때 안내 메시지 | Task 3 Step 1 (`hasInspRow` 체크) |
| quality-AwaitPickup 사진 카운트 배지 | Task 4 Step 1 |
| order-lookup 읽기 전용 그리드 | Task 5 Step 3 |
| order-lookup 라이트박스 | Task 5 Step 4 |

모든 요구사항 커버됨.

### Type Consistency

- `ShipPhotoTab` props: `{ orderId, hasInspRow, onCountChange }` — Task 3 Step 3 호출부와 Task 3 Step 1 정의부 일치
- `photos` 배열 항목: `{ filename, url, storage_path, uploaded_by, uploaded_at }` — `db.js` `addShipPhoto`와 `ShipPhotoTab` 렌더 일치
- `deleteShipPhoto(order_id, storagePath)` — db.js 정의와 `ShipPhotoTab` 호출부 (`handleDelete(storagePath)` → `PMDB.deleteShipPhoto(orderId, storagePath)`) 일치
