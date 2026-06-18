// 출하·기능 검사 성적서 컴포넌트 — production-mapping / quality-AwaitPickup / order-lookup 공용
// production-mapping.jsx보다 먼저 로드되어야 함 (index.html 로드 순서 참조)

const SHIP_CHECKLIST = [
  { key: 'exterior_ok',   label: '외관 손상 없음' },
  { key: 'label_ok',      label: '제품 라벨 부착 상태 양호' },
  { key: 'cable_ok',      label: '케이블 단선·손상 없음' },
  { key: 'connector_ok',  label: '커넥터 체결 상태 양호' },
  { key: 'bolt_ok',       label: '볼트·나사 체결 완료' },
  { key: 'package_ok',    label: '포장재 이상 없음' },
  { key: 'accessory_ok',  label: '부속품·문서 동봉 확인' },
  { key: 'ship_label_ok', label: '출하 라벨 부착 완료' },
];

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
  const [checks, setChecks] = React.useState(() =>
    Object.fromEntries(SHIP_CHECKLIST.map(c => [c.key, existingData?.checks?.[c.key] || false]))
  );
  const [notes, setNotes] = React.useState(existingData?.notes || '');

  const handleClose = React.useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  React.useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [handleClose]);

  window.useLockScroll();

  const checkedCount = Object.values(checks).filter(Boolean).length;
  const allChecked = checkedCount === SHIP_CHECKLIST.length;
  const canSave = !!(inspDate && inspector.trim() && allChecked);

  const handleSave = () => {
    onSave({ insp_date: inspDate, inspector: inspector.trim(), checks, notes, saved_at: new Date().toISOString() });
    handleClose();
  };

  return ReactDOM.createPortal(
    <>
      <div className={`drawer-backdrop${closing ? ' drawer-backdrop--closing' : ''}`} onClick={handleClose}/>
      <aside className={`drawer${closing ? ' drawer--closing' : ''}`}>
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
        </div>

        <div className="drawer__foot">
          <button className="btn btn--ghost" onClick={handleClose}>취소</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={!canSave}
            title={!canSave ? '검사일자, 검사자, 전 체크리스트 항목을 완료해 주세요' : ''}>
            <Icon name="check" size={13}/> 검사 완료 저장
          </button>
        </div>
      </aside>
    </>,
    document.body
  );
}

/* ────────── 기능 검사 체크리스트 ────────── */
const FUNC_CHECKLIST = [
  { key: 'power_ok',        label: '전원 공급 정상 동작' },
  { key: 'display_ok',      label: '디스플레이 화면 정상 표시' },
  { key: 'rfid_ok',         label: 'RFID 카드 인식 정상' },
  { key: 'ocpp_ok',         label: 'OCPP 서버 통신 연결 정상' },
  { key: 'charge_start_ok', label: '충전 시작 동작 확인' },
  { key: 'charge_stop_ok',  label: '충전 중단·완료 동작 확인' },
  { key: 'overcurrent_ok',  label: '과전류 보호 기능 정상' },
  { key: 'ground_ok',       label: '접지 이상 감지 기능 정상' },
  { key: 'meter_ok',        label: '전력량계 계측 정상' },
  { key: 'fw_ok',           label: 'F/W·S/W 버전 확인 완료' },
];

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
function FuncInspectionDrawer({ order, existingData, onSave, onClose }) {
  const [closing, setClosing] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const p = order.production || {};

  const [inspDate, setInspDate] = React.useState(
    existingData?.insp_date || p.inspection_date || today
  );
  const [inspector, setInspector] = React.useState(() => {
    if (existingData?.inspector) return existingData.inspector;
    const user = window.__pm_store__?.currentUser;
    return user?.name || '';
  });
  const [checks, setChecks] = React.useState(() =>
    Object.fromEntries(FUNC_CHECKLIST.map(c => [c.key, existingData?.checks?.[c.key] ?? false]))
  );
  const [notes, setNotes] = React.useState(existingData?.notes || '');

  const handleClose = React.useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  React.useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [handleClose]);

  window.useLockScroll();

  const checkedCount = Object.values(checks).filter(Boolean).length;
  const allChecked = checkedCount === FUNC_CHECKLIST.length;
  const canSave = !!(inspDate && inspector.trim() && allChecked);

  const handleSave = () => {
    onSave({ insp_date: inspDate, inspector: inspector.trim(), checks, notes, saved_at: new Date().toISOString() });
    handleClose();
  };

  return ReactDOM.createPortal(
    <>
      <div className={`drawer-backdrop${closing ? ' drawer-backdrop--closing' : ''}`} onClick={handleClose}/>
      <aside className={`drawer${closing ? ' drawer--closing' : ''}`} role="dialog" aria-modal="true" aria-label="기능 검사 성적서 입력">
        <div className="drawer__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="drawer__eyebrow">{order.customer_name} · 오더 #{order.order_id}</div>
            <div className="drawer__title" style={{ margin: '5px 0 10px' }}>기능 검사 성적서</div>
            <span className="badge badge--progress">{order.model_name}</span>
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
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setChecks(Object.fromEntries(FUNC_CHECKLIST.map(c => [c.key, !allChecked])))}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
                <Icon name="check" size={16} style={{ color: allChecked ? 'var(--success-700)' : 'var(--ink-2)' }}/>
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>기능 검사 항목</span>
              <span style={{ fontSize: 12.5, color: allChecked ? 'var(--success-700)' : 'var(--ink-4)', fontWeight: 500 }}>
                {checkedCount}/{FUNC_CHECKLIST.length}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-4)' }}>
                {allChecked ? '전체 해제 ▲' : '전체 선택 ▼'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FUNC_CHECKLIST.map(item => (
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
                  {allChecked ? '전 항목 확인 완료 · 성적서 발급 가능' : `${FUNC_CHECKLIST.length - checkedCount}개 항목 미확인`}
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
            title={!canSave ? '검정일자, 검사자, 전 체크리스트 항목을 완료해 주세요' : ''}>
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

  // inspectionData prop이 없으면 DB / localStorage 캐시에서 로드
  const funcData = inspectionData || window.getFuncInspection?.(order.order_id) || null;

  window.useLockScroll();

  const validUntil = React.useMemo(() => {
    const dateStr = funcData?.insp_date || p.inspection_date;
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setFullYear(d.getFullYear() + 7);
    return d.toISOString().slice(0, 10);
  }, [order, funcData]);

  const inspDateDisplay = funcData?.insp_date || p.inspection_date || '—';

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
                  <td>{order.model_name}</td>
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
                  <td>{p.cable_length}</td>
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
                  <td><span className="report__pass"><Icon name="check" size={13}/> 합격 (PASS)</span></td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: 13 }}>
              <tbody>
                <tr style={{ background: 'var(--indigo-50,#eef2ff)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--indigo-700,#4338ca)', width: 32, textAlign: 'center' }}>#</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--indigo-700,#4338ca)' }}>검사 항목</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--indigo-700,#4338ca)', width: 64, textAlign: 'center' }}>결과</td>
                </tr>
                {FUNC_CHECKLIST.map((item, idx) => (
                  <tr key={item.key} style={{ borderTop: '1px solid var(--border-1)', background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--ink-4)' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--ink-1)' }}>{item.label}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700,
                      color: funcData?.checks?.[item.key] ? 'var(--success-700)' : (funcData ? '#dc2626' : 'var(--ink-4)') }}>
                      {funcData ? (funcData.checks?.[item.key] ? '합격' : '불합격') : '—'}
                    </td>
                  </tr>
                ))}
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

            <div className="report__seal">
              <div className="report__seal__txt">
                위 충전기는 사내 출하 검사 규정 및 공인기관 형식승인 기준에 따라<br/>
                검사를 시행하였으며, 그 결과 <strong style={{ color: 'var(--ink-1)' }}>적합</strong>함을 증명합니다.<br/>
                <span style={{ color: 'var(--ink-4)' }}>발급일 {new Date().toISOString().slice(0, 10)} · 제조생산팀</span>
              </div>
              <div className="report__stamp">검사<br/>합격</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────── 출하 검사 성적서 미리보기 ────────── */
function ShipInspectionReport({ order, inspectionData: d, modelInfo, onClose }) {
  const p = order.production;

  window.useLockScroll();

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="report" role="dialog" aria-modal="true" aria-label="출하 검사 성적서 미리보기">
        <div className="report__bar">
          <span className="report__bar__label"><Icon name="doc" size={14}/> 출하 검사 성적서 미리보기</span>
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
                  <td colSpan={3}><span className="report__pass"><Icon name="check" size={13}/> 합격 (PASS)</span></td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: 13 }}>
              <tbody>
                <tr style={{ background: 'var(--primary-50)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--primary-600)', width: 32, textAlign: 'center' }}>#</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--primary-600)' }}>검사 항목</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--primary-600)', width: 64, textAlign: 'center' }}>결과</td>
                </tr>
                {SHIP_CHECKLIST.map((item, idx) => (
                  <tr key={item.key} style={{ borderTop: '1px solid var(--border-1)', background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--ink-4)' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--ink-1)' }}>{item.label}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: d.checks[item.key] ? 'var(--success-700)' : '#dc2626' }}>
                      {d.checks[item.key] ? '합격' : '불합격'}
                    </td>
                  </tr>
                ))}
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

            <div className="report__seal">
              <div className="report__seal__txt">
                위 충전기는 사내 출하 검사 규정에 따라 전 항목을 점검하였으며,<br/>
                그 결과 <strong style={{ color: 'var(--ink-1)' }}>이상 없음</strong>을 확인합니다.<br/>
                <span style={{ color: 'var(--ink-4)' }}>발급일 {new Date().toISOString().slice(0, 10)} · 품질관리본부</span>
              </div>
              <div className="report__stamp">출하<br/>합격</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────── 기능 검사 성적서 미리보기 ────────── */
function FuncInspectionReport({ order, inspectionData: d, onClose, onEdit }) {
  const p = order.production;

  window.useLockScroll();

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
                  <td>{order.model_name}</td>
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
                  <td colSpan={3}><span className="report__pass"><Icon name="check" size={13}/> 합격 (PASS)</span></td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: 13 }}>
              <tbody>
                <tr style={{ background: 'var(--indigo-50,#eef2ff)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--indigo-700,#4338ca)', width: 32, textAlign: 'center' }}>#</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--indigo-700,#4338ca)' }}>검사 항목</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--indigo-700,#4338ca)', width: 64, textAlign: 'center' }}>결과</td>
                </tr>
                {FUNC_CHECKLIST.map((item, idx) => (
                  <tr key={item.key} style={{ borderTop: '1px solid var(--border-1)', background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--ink-4)' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--ink-1)' }}>{item.label}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: d.checks?.[item.key] ? 'var(--success-700)' : '#dc2626' }}>
                      {d.checks?.[item.key] ? '합격' : '불합격'}
                    </td>
                  </tr>
                ))}
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

            <div className="report__seal">
              <div className="report__seal__txt">
                위 충전기는 사내 기능 검사 규정에 따라 전 항목을 점검하였으며,<br/>
                그 결과 <strong style={{ color: 'var(--ink-1)' }}>이상 없음</strong>을 확인합니다.<br/>
                <span style={{ color: 'var(--ink-4)' }}>발급일 {new Date().toISOString().slice(0, 10)} · 제조생산팀</span>
              </div>
              <div className="report__stamp">기능<br/>합격</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
