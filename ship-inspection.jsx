// 출하·기능 검사 성적서 컴포넌트 — production-mapping / quality-AwaitPickup / order-lookup 공용
// production-mapping.jsx보다 먼저 로드되어야 함 (index.html 로드 순서 참조)

/* ────────── 기본 체크리스트 (JSON 파일 없을 때 폴백) ────────── */
const SHIP_CHECKLIST_DEFAULT = [
  { key: 'exterior_ok',   label: '외관 손상 없음',           type: 'checkbox' },
  { key: 'label_ok',      label: '제품 라벨 부착 상태 양호', type: 'checkbox' },
  { key: 'cable_ok',      label: '케이블 단선·손상 없음',    type: 'checkbox' },
  { key: 'connector_ok',  label: '커넥터 체결 상태 양호',    type: 'checkbox' },
  { key: 'bolt_ok',       label: '볼트·나사 체결 완료',      type: 'checkbox' },
  { key: 'package_ok',    label: '포장재 이상 없음',         type: 'checkbox' },
  { key: 'accessory_ok',  label: '부속품·문서 동봉 확인',    type: 'checkbox' },
  { key: 'ship_label_ok', label: '출하 라벨 부착 완료',      type: 'checkbox' },
];

const FUNC_CHECKLIST_DEFAULT = [
  { key: 'power_ok',        label: '전원 공급 정상 동작',        type: 'checkbox' },
  { key: 'display_ok',      label: '디스플레이 화면 정상 표시',  type: 'checkbox' },
  { key: 'rfid_ok',         label: 'RFID 카드 인식 정상',       type: 'checkbox' },
  { key: 'ocpp_ok',         label: 'OCPP 서버 통신 연결 정상',  type: 'checkbox' },
  { key: 'charge_start_ok', label: '충전 시작 동작 확인',        type: 'checkbox' },
  { key: 'charge_stop_ok',  label: '충전 중단·완료 동작 확인',  type: 'checkbox' },
  { key: 'overcurrent_ok',  label: '과전류 보호 기능 정상',      type: 'checkbox' },
  { key: 'ground_ok',       label: '접지 이상 감지 기능 정상',   type: 'checkbox' },
  { key: 'meter_ok',        label: '전력량계 계측 정상',         type: 'checkbox' },
  { key: 'fw_ok',           label: 'F/W·S/W 버전 확인 완료',   type: 'checkbox' },
];

/* ────────── 체크리스트 JSON 로더 ────────── */
// docs/ship/{model}.json 또는 docs/func/{model}.json 에서 모델별 체크리스트 로드
// 파일이 없으면 null 반환 → 호출 측에서 DEFAULT로 폴백

const _clCache = new Map();
async function loadChecklist(type, modelKey) {
  const slug = (modelKey || '').toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_]|[-_]$/g, '');
  if (!slug) return null;
  const cacheKey = `${type}:${slug}`;
  if (_clCache.has(cacheKey)) return _clCache.get(cacheKey);
  try {
    const res = await fetch(`docs/${type}/${slug}.json`);
    if (res.ok) {
      const data = await res.json();
      _clCache.set(cacheKey, data);
      return data;
    }
  } catch (_) {}
  _clCache.set(cacheKey, null); // 404/오류도 캐시 — 재진입마다 중복 요청 방지
  return null;
}

/* ────────── 체크리스트 헬퍼 ────────── */
function initChecks(checklist, existingData) {
  return Object.fromEntries(checklist.map(c => {
    const v = existingData?.checks?.[c.key];
    if (v === undefined) return [c.key, (!c.type || c.type === 'checkbox') ? false : ''];
    // 구형 데이터: input 항목에 boolean이 저장된 경우 빈 문자열로 초기화
    if (c.type === 'input' && typeof v === 'boolean') return [c.key, ''];
    return [c.key, v];
  }));
}

function isItemComplete(item, value) {
  // !item.type: 이전 포맷(type 필드 없음)은 checkbox로 취급
  if (!item.type || item.type === 'checkbox') return value === true;
  // input 타입: 구형 bool 값(ground_ok=true/false) 안전 처리
  return String(value || '').trim() !== '';
}

/* ────────── 체크리스트 항목 행 컴포넌트 ────────── */
// type: 'checkbox' → 체크박스 / type: 'input' → 텍스트 입력
function ChecklistItemRow({ item, value, onChange }) {
  const complete = isItemComplete(item, value);

  if (item.type !== 'checkbox') {
    return (
      <label htmlFor={`cl-${item.key}`} className="checklist-row" style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        background: complete ? 'var(--success-50)' : 'var(--surface)',
        border: `1px solid ${complete ? 'var(--success)' : 'var(--border-1)'}`,
        borderRadius: 'var(--r-sm)', transition: 'background 120ms, border-color 120ms',
        cursor: 'text',
      }}>
        <span style={{ fontSize: 13.5, color: 'var(--ink-3)', flexShrink: 0 }}>{item.label}</span>
        <input
          id={`cl-${item.key}`}
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={item.placeholder || '입력'}
          style={{
            flex: 1, border: 'none',
            borderBottom: `1px solid ${complete ? 'var(--success)' : 'var(--border-1)'}`,
            background: 'transparent', fontSize: 13.5, outline: 'none', padding: '0 4px',
            color: complete ? 'var(--success-700)' : 'var(--ink-1)',
            fontWeight: complete ? 600 : 400, textAlign: 'right', minWidth: 60,
          }}
        />
      </label>
    );
  }

  return (
    <label className="checklist-row" style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      background: value ? 'var(--success-50)' : 'var(--surface)',
      border: `1px solid ${value ? 'var(--success)' : 'var(--border-1)'}`,
      borderRadius: 'var(--r-sm)', cursor: 'pointer',
      transition: 'background 120ms, border-color 120ms',
    }}>
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
        style={{ accentColor: 'var(--success-700)', width: 15, height: 15, flexShrink: 0 }}/>
      <span style={{ fontSize: 13.5, color: value ? 'var(--success-700)' : 'var(--ink-2)', fontWeight: value ? 600 : 400 }}>
        {item.label}
      </span>
    </label>
  );
}

/* ────────── 성적서 테이블 셀 값 렌더 (checkbox→합격/불합격, input→입력값) ────────── */
function renderCheckCell(val) {
  if (typeof val === 'boolean') {
    return { text: val ? '합격' : '불합격', color: val ? 'var(--success-700)' : 'var(--danger-700)' };
  }
  const filled = (val || '').trim() !== '';
  return { text: val || '—', color: filled ? 'var(--ink-1)' : 'var(--ink-4)' };
}

/* ────────── 출하 전 사진 탭 ────────── */
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
          background: 'var(--danger-50)', border: '1px solid var(--danger)', color: 'var(--danger-700)',
        }}>
          {uploadErr}
        </div>
      )}

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
          {photos.map((photo, idx) => (
            <div key={photo.storage_path} className="photo-thumb">
              <button type="button" className="photo-thumb__view"
                aria-label={`${photo.filename} 크게 보기`}
                onClick={() => setLightbox(idx)}>
                <img src={photo.url} alt="" loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
              </button>
              {confirmDel === photo.storage_path ? (
                <div className="photo-thumb__confirm">
                  <span>삭제할까요?</span>
                  <div className="photo-thumb__confirm-btns">
                    <button className="btn-ok" onClick={() => handleDelete(photo.storage_path)}>삭제</button>
                    <button className="btn-cancel" onClick={() => setConfirmDel(null)}>취소</button>
                  </div>
                </div>
              ) : (
                <button aria-label="사진 삭제" className="photo-thumb__del"
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
          role="dialog" aria-modal="true" aria-label="사진 라이트박스"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            zIndex: 'var(--z-lightbox)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setLightbox(null)}
          onKeyDown={e => {
            e.stopPropagation(); // 뒤의 드로어·다이얼로그 Escape 핸들러로 전파 방지
            if (e.key === 'Escape') setLightbox(null);
            if (e.key === 'ArrowLeft' && lightbox > 0) setLightbox(lightbox - 1);
            if (e.key === 'ArrowRight' && lightbox < photos.length - 1) setLightbox(lightbox + 1);
          }}>
          <img src={photos[lightbox]?.url} alt={photos[lightbox]?.filename}
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', pointerEvents: 'none' }}/>
          <button aria-label="닫기"
            style={{
              position: 'absolute', top: 16, right: 16, width: 44, height: 44,
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
              color: 'var(--ink-inv)', fontSize: 20, cursor: 'pointer',
            }}
            onClick={() => setLightbox(null)}>×</button>
          {lightbox > 0 && (
            <button aria-label="이전 사진"
              style={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: '50%', color: 'var(--ink-inv)', fontSize: 20, cursor: 'pointer',
              }}
              onClick={e => { e.stopPropagation(); setLightbox(lightbox - 1); }}>‹</button>
          )}
          {lightbox < photos.length - 1 && (
            <button aria-label="다음 사진"
              style={{
                position: 'absolute', right: 64, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: '50%', color: 'var(--ink-inv)', fontSize: 20, cursor: 'pointer',
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

/* ────────── 출하 검사 성적서 Drawer ────────── */
function ShipInspectionDrawer({ order, existingData, modelInfo, onSave, onClose }) {
  const [closing, setClosing] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [inspDate, setInspDate] = React.useState(existingData?.insp_date || today);
  const [inspector, setInspector] = React.useState(() => {
    if (existingData?.inspector) return existingData.inspector;
    const user = window.__pm_store__?.currentUser;
    return user?.name || '';
  });
  const [checklist, setChecklist] = React.useState(
    existingData?._checklist || SHIP_CHECKLIST_DEFAULT
  );
  const [checks, setChecks] = React.useState(() =>
    initChecks(existingData?._checklist || SHIP_CHECKLIST_DEFAULT, existingData)
  );
  const [notes, setNotes] = React.useState(existingData?.notes || '');
  const [photoCount, setPhotoCount] = React.useState(() => {
    try { return (window.PMDB?.getShipPhotos?.(order.order_id) || []).length; } catch (_) { return 0; }
  });

  // 모델별 JSON 로드 (existingData에 _checklist가 없을 때만)
  React.useEffect(() => {
    if (existingData?._checklist) return;
    const modelKey = modelInfo?.model || order.model_name;
    loadChecklist('ship', modelKey).then(cl => {
      if (!cl) return;
      setChecklist(cl);
      setChecks(prev => Object.fromEntries(cl.map(c => [
        c.key,
        prev[c.key] !== undefined ? prev[c.key]
          : (existingData?.checks?.[c.key] !== undefined ? existingData.checks[c.key]
          : (c.type === 'checkbox' ? false : '')),
      ])));
    });
  }, []);

  const handleClose = React.useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Escape 닫기 + Tab 포커스 트랩 + 닫힘 시 트리거로 포커스 복원
  const dialogRef = window.useModalKeyboard(handleClose);

  window.useLockScroll();

  const completedCount = checklist.filter(c => isItemComplete(c, checks[c.key])).length;
  const allChecked = completedCount === checklist.length;
  const checkboxItems = checklist.filter(c => c.type === 'checkbox');
  const allCheckboxesChecked = checkboxItems.length > 0 && checkboxItems.every(c => checks[c.key] === true);
  const canSave = !!(inspDate && inspector.trim());

  const handleSave = () => {
    onSave({
      insp_date: inspDate, inspector: inspector.trim(), checks, notes,
      saved_at: new Date().toISOString(), _checklist: checklist,
    });
    handleClose();
  };

  return ReactDOM.createPortal(
    <>
      <div className={`drawer-backdrop${closing ? ' drawer-backdrop--closing' : ''}`} onClick={handleClose}/>
      <aside ref={dialogRef} className={`drawer${closing ? ' drawer--closing' : ''}`} role="dialog" aria-modal="true" aria-label="출하 검사 성적서">
        <div className="drawer__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="drawer__eyebrow">{order.customer_name} · 오더 #{order.order_id}</div>
            <div className="drawer__title" style={{ margin: '5px 0 10px' }}>출하 검사 성적서</div>
            <span className="badge badge--neutral">{modelInfo?.model || order.model_name}</span>
          </div>
          <button className="drawer__close" onClick={handleClose} aria-label="닫기"><Icon name="x" size={16}/></button>
        </div>

        <div className="drawer__body">
          <section style={{ background: 'var(--primary-50)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
                  <Icon name="doc" size={16} style={{ color: 'var(--primary-600)' }}/>
                </div>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>기본 정보</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label className="field__label" htmlFor="si-date">검사일자 <span className="field__req">*</span></label>
                  <input id="si-date" type="date" className="input" value={inspDate} onChange={e => setInspDate(e.target.value)}/>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="si-inspector">검사자 <span className="field__req">*</span></label>
                  <input id="si-inspector" type="text" className="input" placeholder="검사자 이름" value={inspector} onChange={e => setInspector(e.target.value)}/>
                </div>
              </div>
            </section>

            <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
              <button type="button"
                style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer', userSelect: 'none', background: 'none', border: 'none', padding: 0, width: '100%', textAlign: 'left' }}
                onClick={() => {
                  const newVal = !allCheckboxesChecked;
                  setChecks(prev => ({ ...prev, ...Object.fromEntries(checkboxItems.map(c => [c.key, newVal])) }));
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
                  <Icon name="check" size={16} style={{ color: allChecked ? 'var(--success-700)' : 'var(--ink-2)' }}/>
                </div>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>출하 검사 체크리스트</span>
                <span style={{ fontSize: 12.5, color: allChecked ? 'var(--success-700)' : 'var(--ink-4)', fontWeight: 500 }}>
                  {completedCount}/{checklist.length}
                </span>
                {checkboxItems.length > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-4)' }}>
                    {allCheckboxesChecked ? '체크 전체 해제 ▲' : '체크 전체 선택 ▼'}
                  </span>
                )}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {checklist.map(item => (
                  <ChecklistItemRow key={item.key} item={item} value={checks[item.key]}
                    onChange={val => setChecks(prev => ({ ...prev, [item.key]: val }))}/>
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
                    {allChecked ? '전 항목 확인 완료 · 출하 가능 상태' : `${checklist.length - completedCount}개 항목 미확인`}
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

            <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
                  <Icon name="plus" size={16} style={{ color: 'var(--primary-600)' }}/>
                </div>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>
                  사진 첨부{photoCount > 0 ? ` (${photoCount}장)` : ''}
                </span>
              </div>
              <ShipPhotoTab
                orderId={order.order_id}
                hasInspRow={!!window.PMDB?.getShipInspectionDB?.(order.order_id)}
                onCountChange={setPhotoCount}
              />
            </section>
        </div>

        <div className="drawer__foot">
          <button className="btn btn--ghost" onClick={handleClose}>취소</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={!canSave}
            title={!canSave ? '검사일자와 검사자를 입력해 주세요' : ''}>
            <Icon name="check" size={13}/> 검사 완료 저장
          </button>
        </div>
      </aside>
    </>,
    document.body
  );
}

/* ────────── 기능 검사 체크리스트 ────────── */

/* 기능 검사 데이터 헬퍼 — DB 우선, localStorage 폴백 */
window.getFuncInspection = function(orderId) {
  try {
    if (window.PMDB?.backend) {
      const dbData = window.PMDB.getFuncInspection(orderId);
      if (dbData) return dbData;
    }
    return new Map(JSON.parse(localStorage.getItem('pm_func_inspections') || '[]')).get(orderId) || null;
  } catch(_) { return null; }
};
window.setFuncInspection = function(orderId, data) {
  try {
    if (window.PMDB?.backend) {
      if (data == null) window.PMDB.deleteFuncInspection(orderId);
      else window.PMDB.saveFuncInspection(orderId, data);
    }
    const m = new Map(JSON.parse(localStorage.getItem('pm_func_inspections') || '[]'));
    if (data == null) m.delete(orderId); else m.set(orderId, data);
    localStorage.setItem('pm_func_inspections', JSON.stringify([...m]));
  } catch(_) {}
};

/* 출하 검사 데이터 헬퍼 — DB 우선, localStorage 폴백 */
window.getShipInspection = function(orderId) {
  try {
    if (window.PMDB?.backend) {
      const dbData = window.PMDB.getShipInspectionDB(orderId);
      if (dbData) return dbData;
    }
    return new Map(JSON.parse(localStorage.getItem('pm_ship_inspections') || '[]')).get(orderId) || null;
  } catch(_) { return null; }
};
window.setShipInspection = function(orderId, data) {
  try {
    if (window.PMDB?.backend) window.PMDB.saveShipInspection(orderId, data);
    const m = new Map(JSON.parse(localStorage.getItem('pm_ship_inspections') || '[]'));
    if (data == null) m.delete(orderId); else m.set(orderId, data);
    localStorage.setItem('pm_ship_inspections', JSON.stringify([...m]));
  } catch(_) {}
};

/* ────────── 기능 검사 성적서 Drawer ────────── */
function FuncInspectionDrawer({ order, existingData, modelInfo: modelInfoProp, onSave, onClose }) {
  const [closing, setClosing] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const p = order.production || {};
  const modelInfo = modelInfoProp || window.findModelInfo(order.model_name);

  const [inspDate, setInspDate] = React.useState(
    existingData?.insp_date || p.inspection_date || today
  );
  const [inspector, setInspector] = React.useState(() => {
    if (existingData?.inspector) return existingData.inspector;
    const user = window.__pm_store__?.currentUser;
    return user?.name || '';
  });
  const [checklist, setChecklist] = React.useState(
    existingData?._checklist || FUNC_CHECKLIST_DEFAULT
  );
  const [checks, setChecks] = React.useState(() =>
    initChecks(existingData?._checklist || FUNC_CHECKLIST_DEFAULT, existingData)
  );
  const [notes, setNotes] = React.useState(existingData?.notes || '');

  // 모델별 JSON 로드 (existingData에 _checklist가 없을 때만)
  React.useEffect(() => {
    if (existingData?._checklist) return;
    loadChecklist('func', modelInfo?.model || order.model_name).then(cl => {
      if (!cl) return;
      setChecklist(cl);
      setChecks(prev => Object.fromEntries(cl.map(c => [
        c.key,
        prev[c.key] !== undefined ? prev[c.key]
          : (existingData?.checks?.[c.key] !== undefined ? existingData.checks[c.key]
          : (c.type === 'checkbox' ? false : '')),
      ])));
    });
  }, []);

  const handleClose = React.useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Escape 닫기 + Tab 포커스 트랩 + 닫힘 시 트리거로 포커스 복원
  const dialogRef = window.useModalKeyboard(handleClose);

  window.useLockScroll();

  const completedCount = checklist.filter(c => isItemComplete(c, checks[c.key])).length;
  const allChecked = completedCount === checklist.length;
  const checkboxItems = checklist.filter(c => c.type === 'checkbox');
  const allCheckboxesChecked = checkboxItems.length > 0 && checkboxItems.every(c => checks[c.key] === true);
  const canSave = !!(inspDate && inspector.trim());

  const handleSave = () => {
    onSave({
      insp_date: inspDate, inspector: inspector.trim(), checks, notes,
      saved_at: new Date().toISOString(), _checklist: checklist,
    });
    handleClose();
  };

  return ReactDOM.createPortal(
    <>
      <div className={`drawer-backdrop${closing ? ' drawer-backdrop--closing' : ''}`} onClick={handleClose}/>
      <aside ref={dialogRef} className={`drawer${closing ? ' drawer--closing' : ''}`} role="dialog" aria-modal="true" aria-label="기능 검사 성적서 입력">
        <div className="drawer__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="drawer__eyebrow">{order.customer_name} · 오더 #{order.order_id}</div>
            <div className="drawer__title" style={{ margin: '5px 0 10px' }}>기능 검사 성적서</div>
            <span className="badge badge--progress">{modelInfo?.model || order.model_name}</span>
          </div>
          <button className="drawer__close" onClick={handleClose} aria-label="닫기"><Icon name="x" size={16}/></button>
        </div>

        <div className="drawer__body">
          {/* 기본 정보 */}
          <section style={{ background: 'var(--indigo-50)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
                <Icon name="shield" size={16} style={{ color: 'var(--indigo-700)' }}/>
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>기본 정보</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="field__label" htmlFor="fi-date">검정일자 <span className="field__req">*</span></label>
                <input id="fi-date" type="date" className="input" value={inspDate} onChange={e => setInspDate(e.target.value)}/>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="fi-inspector">검사자 <span className="field__req">*</span></label>
                <input id="fi-inspector" type="text" className="input" placeholder="검사자 이름"
                  value={inspector} onChange={e => setInspector(e.target.value)}/>
              </div>
            </div>
          </section>

          {/* 생산 정보 요약 */}
          {p.serial_no && (
            <section>
              <div className="dsec__title"><Icon name="factory" size={13}/>생산 정보</div>
              <div className="dgrid">
                <div className="dgrid__cell">
                  <span className="dgrid__k">시리얼</span>
                  <span className="dgrid__v dgrid__v--mono">{p.serial_no}</span>
                </div>
                <div className="dgrid__cell">
                  <span className="dgrid__k">로트번호</span>
                  <span className="dgrid__v dgrid__v--mono">{p.lot_no}</span>
                </div>
                <div className="dgrid__cell">
                  <span className="dgrid__k">S/W 버전</span>
                  <span className="dgrid__v dgrid__v--mono">{p.sw_version || '—'}</span>
                </div>
                <div className="dgrid__cell">
                  <span className="dgrid__k">F/W 버전</span>
                  <span className="dgrid__v dgrid__v--mono">{p.fw_version || '—'}</span>
                </div>
              </div>
            </section>
          )}

          {/* 기능 검사 체크리스트 */}
          <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <button type="button"
              style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer', userSelect: 'none', background: 'none', border: 'none', padding: 0, width: '100%', textAlign: 'left' }}
              onClick={() => {
                const newVal = !allCheckboxesChecked;
                setChecks(prev => ({ ...prev, ...Object.fromEntries(checkboxItems.map(c => [c.key, newVal])) }));
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
                <Icon name="check" size={16} style={{ color: allChecked ? 'var(--success-700)' : 'var(--ink-2)' }}/>
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>기능 검사 항목</span>
              <span style={{ fontSize: 12.5, color: allChecked ? 'var(--success-700)' : 'var(--ink-4)', fontWeight: 500 }}>
                {completedCount}/{checklist.length}
              </span>
              {checkboxItems.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-4)' }}>
                  {allCheckboxesChecked ? '체크 전체 해제 ▲' : '체크 전체 선택 ▼'}
                </span>
              )}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {checklist.map(item => (
                <ChecklistItemRow key={item.key} item={item} value={checks[item.key]}
                  onChange={val => setChecks(prev => ({ ...prev, [item.key]: val }))}/>
              ))}
            </div>
          </section>

          {/* 종합 판정 */}
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
                  {allChecked ? '전 항목 확인 완료 · 성적서 발급 가능' : `${checklist.length - completedCount}개 항목 미확인`}
                </div>
              </div>
            </div>
          </section>

          {/* 비고 */}
          <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <div className="field">
              <label className="field__label" htmlFor="fi-notes">비고</label>
              <textarea id="fi-notes" className="textarea" rows={3} placeholder="특이사항 기입 (선택)"
                value={notes} onChange={e => setNotes(e.target.value)}/>
            </div>
          </section>
        </div>

        <div className="drawer__foot">
          <button className="btn btn--ghost" onClick={handleClose}>취소</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={!canSave}
            title={!canSave ? '검정일자와 검사자를 입력해 주세요' : ''}>
            <Icon name="check" size={13}/> 검사 완료 저장
          </button>
        </div>
      </aside>
    </>,
    document.body
  );
}

/* ────────── 기능 검사 성적서 (printable document) ────────── */
function InspectionReport({ order, inspectionData, onClose }) {
  const p = order.production;
  const modelInfo = window.findModelInfo(order.model_name);

  // inspectionData prop이 없으면 DB / localStorage 캐시에서 로드
  const funcData = inspectionData || window.getFuncInspection?.(order.order_id) || null;

  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);

  const displayChecklist = funcData?._checklist || FUNC_CHECKLIST_DEFAULT;

  const validUntil = React.useMemo(() => {
    const dateStr = funcData?.insp_date || p.inspection_date;
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setFullYear(d.getFullYear() + 7);
    return d.toISOString().slice(0, 10);
  }, [order, funcData]);

  const inspDateDisplay = funcData?.insp_date || p.inspection_date || '—';
  const funcAllPassed = !!funcData && displayChecklist.every(item => isItemComplete(item, funcData.checks?.[item.key]));

  return ReactDOM.createPortal(
    <div className="modal-backdrop" ref={dialogRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="report" role="dialog" aria-modal="true" aria-label="기능 검사 성적서 미리보기">
        <div className="report__bar">
          <span className="report__bar__label"><Icon name="doc" size={14}/> 기능 검사 성적서 미리보기</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--secondary btn--sm" onClick={() => window.print()}>
              <Icon name="printer" size={13}/> 인쇄 / PDF
            </button>
            <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose} aria-label="닫기"><Icon name="x" size={15}/></button>
          </div>
        </div>
        <div className="report__scroll">
          <div className="report__doc">
            <div className="report__hd">
              <div>
                <h2 className="report__hd__title">기능 검사 성적서</h2>
                <div className="report__hd__sub">FUNCTIONAL INSPECTION CERTIFICATE · EV CHARGER</div>
              </div>

            </div>

            <table className="report__table">
              <tbody>
                <tr>
                  <th>고객사</th>
                  <td>{order.customer_name}</td>
                  <th>오더번호</th>
                  <td className="report__mono">#{order.order_id}</td>
                </tr>
                <tr>
                  <th>모델명</th>
                  <td>{modelInfo?.model || order.model_name}</td>
                  <th>충전소 ID</th>
                  <td className="report__mono">{order.station_id}</td>
                </tr>
                <tr>
                  <th>시리얼 번호</th>
                  <td className="report__mono">{p.serial_no}</td>
                  <th>로트 번호</th>
                  <td className="report__mono">{p.lot_no}</td>
                </tr>
                <tr>
                  <th>생산일자</th>
                  <td>{p.prod_date}</td>
                  <th>검정일자</th>
                  <td>{inspDateDisplay}</td>
                </tr>
                <tr>
                  <th>S/W 버전</th>
                  <td className="report__mono">{p.sw_version}</td>
                  <th>F/W 버전</th>
                  <td className="report__mono">{p.fw_version}</td>
                </tr>
                <tr>
                  <th>케이블 길이</th>
                  <td>{order.cable_length}</td>
                  <th>검사자</th>
                  <td>{funcData?.inspector || <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                </tr>
                <tr>
                  <th>라우터 S/N</th>
                  <td className="report__mono">{order.router_no}</td>
                  <th>USIM (ICCID)</th>
                  <td className="report__mono" style={{ fontSize: 11 }}>{order.usim_no}</td>
                </tr>
                <tr>
                  <th>설치 주소</th>
                  <td colSpan={3}>{order.install_address}</td>
                </tr>
                <tr>
                  <th>검정 유효기간</th>
                  <td>{validUntil ? `${validUntil}까지` : <span style={{ color: 'var(--ink-4)' }}>비공용 — 해당없음</span>}</td>
                  <th>종합 판정</th>
                  <td>{funcAllPassed
                    ? <span className="report__pass"><Icon name="check" size={13}/> 합격 (PASS)</span>
                    : <span style={{ color: 'var(--danger-700)', fontWeight: 700 }}>미완료</span>}
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: 13 }}>
              <tbody>
                <tr style={{ background: 'var(--indigo-50,#eef2ff)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--indigo-700,#4338ca)', width: 32, textAlign: 'center' }}>#</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--indigo-700,#4338ca)' }}>검사 항목</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--indigo-700,#4338ca)', width: 80, textAlign: 'center' }}>결과</td>
                </tr>
                {displayChecklist.map((item, idx) => {
                  const cell = renderCheckCell(funcData?.checks?.[item.key]);
                  return (
                    <tr key={item.key} style={{ borderTop: '1px solid var(--border-1)', background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--ink-4)' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--ink-1)' }}>{item.label}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: funcData ? cell.color : 'var(--ink-4)' }}>
                        {funcData ? cell.text : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {funcData?.notes && (
              <table className="report__table" style={{ marginTop: 14 }}>
                <tbody>
                  <tr>
                    <th>비고</th>
                    <td colSpan={3}>{funcData.notes}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {funcAllPassed && (
              <div className="report__seal">
                <div className="report__seal__txt">
                  위 충전기는 사내 출하 검사 규정 및 공인기관 형식승인 기준에 따라<br/>
                  검사를 시행하였으며, 그 결과 <strong style={{ color: 'var(--ink-1)' }}>적합</strong>함을 증명합니다.<br/>
                  <span style={{ color: 'var(--ink-4)' }}>발급일 {new Date().toISOString().slice(0, 10)} · 제조생산팀</span>
                </div>
                <div className="report__stamp">검사<br/>합격</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ────────── 출하 검사 성적서 미리보기 ────────── */
function ShipInspectionReport({ order, inspectionData: d, modelInfo, onClose }) {
  const p = order.production;
  const displayChecklist = d._checklist || SHIP_CHECKLIST_DEFAULT;
  const shipAllPassed = displayChecklist.every(item => isItemComplete(item, d.checks?.[item.key]));
  const [lightbox, setLightbox] = React.useState(null);
  const [includePhotos, setIncludePhotos] = React.useState(true);
  const lightboxRef = React.useRef(null);

  const photos = React.useMemo(() => {
    try { return window.PMDB?.getShipPhotos?.(order.order_id) || []; } catch(_) { return []; }
  }, [order.order_id]);

  React.useEffect(() => {
    if (lightbox !== null && lightboxRef.current) lightboxRef.current.focus();
  }, [lightbox]);

  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);

  return ReactDOM.createPortal(
    <div className="modal-backdrop" ref={dialogRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="report" role="dialog" aria-modal="true" aria-label="출하 검사 성적서 미리보기">
        <div className="report__bar">
          <span className="report__bar__label"><Icon name="doc" size={14}/> 출하 검사 성적서 미리보기</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {photos.length > 0 && (
              <label className="switch" style={{ marginRight: 4 }}>
                <input type="checkbox" className="switch__input"
                  checked={includePhotos} onChange={e => setIncludePhotos(e.target.checked)}
                  role="switch" aria-checked={includePhotos}/>
                <span className="switch__track" aria-hidden="true"/>
                <span className="switch__label" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                  첨부사진 출력 ({photos.length}장)
                </span>
              </label>
            )}
            <button className="btn btn--secondary btn--sm" onClick={() => window.print()}>
              <Icon name="printer" size={13}/> 인쇄 / PDF
            </button>
            <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose} aria-label="닫기"><Icon name="x" size={15}/></button>
          </div>
        </div>
        <div className="report__scroll">
          <div className="report__doc">
            <div className="report__hd">
              <div>
                <h2 className="report__hd__title">출하 전 검사 성적서</h2>
                <div className="report__hd__sub">Pre-shipment INSPECTION CERTIFICATE · EV CHARGER</div>
              </div>
              <div className="report__hd__no">
                검사일자
                <strong>{d.insp_date}</strong>
              </div>
            </div>

            <table className="report__table">
              <tbody>
                <tr>
                  <th>고객사</th>
                  <td>{order.customer_name}</td>
                  <th>오더번호</th>
                  <td className="report__mono">#{order.order_id}</td>
                </tr>
                <tr>
                  <th>모델명</th>
                  <td>{modelInfo?.model || order.model_name}</td>
                  <th>충전소 ID</th>
                  <td className="report__mono">{order.station_id || '—'}</td>
                </tr>
                {p && (
                  <tr>
                    <th>시리얼 번호</th>
                    <td className="report__mono">{p.serial_no}</td>
                    <th>로트 번호</th>
                    <td className="report__mono">{p.lot_no}</td>
                  </tr>
                )}
                <tr>
                  <th>검사일자</th>
                  <td>{d.insp_date}</td>
                  <th>검사자</th>
                  <td>{d.inspector}</td>
                </tr>
                <tr>
                  <th>종합 판정</th>
                  <td colSpan={3}>{shipAllPassed
                    ? <span className="report__pass"><Icon name="check" size={13}/> 합격 (PASS)</span>
                    : <span style={{ color: 'var(--danger-700)', fontWeight: 700 }}>미완료</span>}
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: 13 }}>
              <tbody>
                <tr style={{ background: 'var(--primary-50)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--primary-600)', width: 32, textAlign: 'center' }}>#</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--primary-600)' }}>검사 항목</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--primary-600)', width: 80, textAlign: 'center' }}>결과</td>
                </tr>
                {displayChecklist.map((item, idx) => {
                  const cell = renderCheckCell(d.checks[item.key]);
                  return (
                    <tr key={item.key} style={{ borderTop: '1px solid var(--border-1)', background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--ink-4)' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--ink-1)' }}>{item.label}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: cell.color }}>
                        {cell.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {d.notes && (
              <table className="report__table" style={{ marginTop: 14 }}>
                <tbody>
                  <tr>
                    <th>비고</th>
                    <td colSpan={3}>{d.notes}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {includePhotos && photos.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{
                  padding: '8px 12px', fontWeight: 700, fontSize: 13,
                  color: 'var(--primary-600)', background: 'var(--primary-50)',
                  borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
                  border: '1px solid var(--border-1)', borderBottom: 'none',
                }}>
                  첨부 사진 ({photos.length}장)
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 8, padding: 12,
                  border: '1px solid var(--border-1)', borderRadius: '0 0 var(--r-sm) var(--r-sm)',
                }}>
                  {photos.map((photo, idx) => (
                    <button type="button" key={photo.storage_path} className="photo-thumb__view"
                      aria-label={`${photo.filename} 크게 보기`}
                      style={{
                        aspectRatio: '1', borderRadius: 'var(--r-sm)', overflow: 'hidden',
                        background: 'var(--surface-2)',
                      }}
                      onClick={() => setLightbox(idx)}>
                      <img src={photo.url} alt="" loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {shipAllPassed && (
              <div className="report__seal">
                <div className="report__seal__txt">
                  위 충전기는 사내 출하 검사 규정에 따라 전 항목을 점검하였으며,<br/>
                  그 결과 <strong style={{ color: 'var(--ink-1)' }}>이상 없음</strong>을 확인합니다.<br/>
                  <span style={{ color: 'var(--ink-4)' }}>발급일 {new Date().toISOString().slice(0, 10)} · 품질관리본부</span>
                </div>
                <div className="report__stamp">출하<br/>합격</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {lightbox !== null && (
        <div ref={lightboxRef} tabIndex={-1}
          role="dialog" aria-modal="true" aria-label="사진 라이트박스"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            zIndex: 'var(--z-lightbox)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setLightbox(null)}
          onKeyDown={e => {
            e.stopPropagation(); // 뒤의 드로어·다이얼로그 Escape 핸들러로 전파 방지
            if (e.key === 'Escape') setLightbox(null);
            if (e.key === 'ArrowLeft' && lightbox > 0) setLightbox(lightbox - 1);
            if (e.key === 'ArrowRight' && lightbox < photos.length - 1) setLightbox(lightbox + 1);
          }}>
          <img src={photos[lightbox]?.url} alt={photos[lightbox]?.filename}
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', pointerEvents: 'none' }}/>
          <button aria-label="닫기"
            style={{
              position: 'absolute', top: 16, right: 16, width: 44, height: 44,
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
              color: 'var(--ink-inv)', fontSize: 20, cursor: 'pointer',
            }}
            onClick={() => setLightbox(null)}>×</button>
          {lightbox > 0 && (
            <button aria-label="이전 사진"
              style={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: '50%', color: 'var(--ink-inv)', fontSize: 20, cursor: 'pointer',
              }}
              onClick={e => { e.stopPropagation(); setLightbox(lightbox - 1); }}>‹</button>
          )}
          {lightbox < photos.length - 1 && (
            <button aria-label="다음 사진"
              style={{
                position: 'absolute', right: 64, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: '50%', color: 'var(--ink-inv)', fontSize: 20, cursor: 'pointer',
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
    </div>,
    document.body
  );
}

/* ────────── 기능 검사 성적서 미리보기 ────────── */
function FuncInspectionReport({ order, inspectionData: d, onClose, onEdit }) {
  const p = order.production;
  const modelInfo = window.findModelInfo(order.model_name);
  const displayChecklist = d._checklist || FUNC_CHECKLIST_DEFAULT;
  const funcAllPassed = displayChecklist.every(item => isItemComplete(item, d.checks?.[item.key]));

  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);

  return (
    <div className="modal-backdrop" ref={dialogRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="report" role="dialog" aria-modal="true" aria-label="기능 검사 성적서 미리보기">
        <div className="report__bar">
          <span className="report__bar__label"><Icon name="shield" size={14}/> 기능 검사 성적서 미리보기</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--secondary btn--sm" onClick={() => window.print()}>
              <Icon name="printer" size={13}/> 인쇄 / PDF
            </button>
            <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose} aria-label="닫기"><Icon name="x" size={15}/></button>
          </div>
        </div>
        <div className="report__scroll">
          <div className="report__doc">
            <div className="report__hd">
              <div>
                <h2 className="report__hd__title">기능 검사 성적서</h2>
                <div className="report__hd__sub">FUNCTIONAL TEST CERTIFICATE · EV CHARGER</div>
              </div>
              <div className="report__hd__no">
                검사일자
                <strong>{d.insp_date}</strong>
              </div>
            </div>

            <table className="report__table">
              <tbody>
                <tr>
                  <th>고객사</th>
                  <td>{order.customer_name}</td>
                  <th>오더번호</th>
                  <td className="report__mono">#{order.order_id}</td>
                </tr>
                <tr>
                  <th>모델명</th>
                  <td>{modelInfo?.model || order.model_name}</td>
                  <th>충전소 ID</th>
                  <td className="report__mono">{order.station_id || '—'}</td>
                </tr>
                {p && (
                  <>
                    <tr>
                      <th>시리얼 번호</th>
                      <td className="report__mono">{p.serial_no}</td>
                      <th>로트 번호</th>
                      <td className="report__mono">{p.lot_no}</td>
                    </tr>
                    <tr>
                      <th>S/W 버전</th>
                      <td className="report__mono">{p.sw_version || '—'}</td>
                      <th>F/W 버전</th>
                      <td className="report__mono">{p.fw_version || '—'}</td>
                    </tr>
                  </>
                )}
                <tr>
                  <th>검사일자</th>
                  <td>{d.insp_date}</td>
                  <th>검사자</th>
                  <td>{d.inspector}</td>
                </tr>
                <tr>
                  <th>종합 판정</th>
                  <td colSpan={3}>{funcAllPassed
                    ? <span className="report__pass"><Icon name="check" size={13}/> 합격 (PASS)</span>
                    : <span style={{ color: 'var(--danger-700)', fontWeight: 700 }}>미완료</span>}
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: 13 }}>
              <tbody>
                <tr style={{ background: 'var(--indigo-50,#eef2ff)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--indigo-700,#4338ca)', width: 32, textAlign: 'center' }}>#</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--indigo-700,#4338ca)' }}>검사 항목</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--indigo-700,#4338ca)', width: 80, textAlign: 'center' }}>결과</td>
                </tr>
                {displayChecklist.map((item, idx) => {
                  const cell = renderCheckCell(d.checks?.[item.key]);
                  return (
                    <tr key={item.key} style={{ borderTop: '1px solid var(--border-1)', background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--ink-4)' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--ink-1)' }}>{item.label}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: cell.color }}>
                        {cell.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {d.notes && (
              <table className="report__table" style={{ marginTop: 14 }}>
                <tbody>
                  <tr>
                    <th>비고</th>
                    <td colSpan={3}>{d.notes}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {funcAllPassed && (
              <div className="report__seal">
                <div className="report__seal__txt">
                  위 충전기는 사내 기능 검사 규정에 따라 전 항목을 점검하였으며,<br/>
                  그 결과 <strong style={{ color: 'var(--ink-1)' }}>이상 없음</strong>을 확인합니다.<br/>
                  <span style={{ color: 'var(--ink-4)' }}>발급일 {new Date().toISOString().slice(0, 10)} · 제조생산팀</span>
                </div>
                <div className="report__stamp">기능<br/>합격</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
