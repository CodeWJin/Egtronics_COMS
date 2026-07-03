// 생산 부서 입력 화면 (Production Mapping Dashboard)

const { useState: useStatePM, useMemo: useMemoPM } = React;

const SERIAL_MODEL_CODES = {
  'EGSW101101':    ['G00', '00S'],
  'EGMI205001':    ['G01', '00P'],
  'EGMI105001':    ['G01', '01P'],
  'EGMI104001':    ['G01', '02P'],
  'EGMI103001':    ['G01', '03P'],
  'EGFA210001':    ['G02', '00P'],
  'EGFA110001':    ['G02', '01P'],
  'EGSW100701':    ['G03', '00S'],
  'EGSW101102':    ['G04', '00H'],
  'EGSW100702':    ['G05', '00H'],
  'EGSW101103':    ['G07', '00P'],
  'EGSW101103P':   ['G07', '01S'],
  'EGSW101103I':   ['G07', '02P'],
  'EGSW101103PI':  ['G07', '03P'],
  'EGSW101103N':   ['G07', '04S'],
  'EGSW100703':    ['G08', '00P'],
  'EGSW100703P':   ['G08', '01S'],
  'EGSW100703I':   ['G08', '02P'],
  'EGSW100703PI':  ['G08', '03P'],
  'EGSW100703N':   ['G08', '04S'],
  'EGFA220001':    ['G09', '00P'],
  'EGFA120001':    ['G09', '01P'],
};

function makeSerialDateCode(dateISO) {
  const d = new Date(dateISO);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const yearCode = String.fromCharCode('A'.charCodeAt(0) + (year - 2023) % 20);
  const monthCode = month <= 9 ? String(month) : String.fromCharCode('A'.charCodeAt(0) + month - 10);
  return yearCode + monthCode;
}

function changeStatus(orderId, from, to) {
  const key = `${from}->${to}`;
  const MAP = {
    'AWAIT_PICKUP->COMPLETED': {
      message: `오더 #${orderId}을(를) 출하 완료 처리할까요?\n생산완료 상태로 전환됩니다.`,
      confirmLabel: '출하 완료',
      action: () => window.actions.shipOrder(orderId),
    },
    'AWAIT_PICKUP->IN_PROGRESS': {
      message: `오더 #${orderId}을(를) 작업중 상태로 되돌릴까요?\n출하대기가 취소되며 생산 실적을 수정할 수 있습니다.`,
      action: () => { window.actions.awaitToInProgress(orderId); window.actions.setView('mapping'); },
    },
    'COMPLETED->AWAIT_PICKUP': {
      message: `오더 #${orderId}을(를) 출하대기 상태로 되돌릴까요?\n출하 처리가 취소되며 출하 검사를 다시 진행할 수 있습니다.`,
      action: () => window.actions.revertToAwaitPickup(orderId),
    },
    'COMPLETED->IN_PROGRESS': {
      message: `오더 #${orderId}을(를) 생산진행중 상태로 되돌릴까요?\n출하 처리가 취소되며 생산 실적을 수정할 수 있습니다.`,
      action: () => window.actions.revertToInProgress(orderId),
    },
    'COMPLETED->PENDING': {
      message: `오더 #${orderId}을(를) 생산대기 상태로 되돌릴까요?\n시리얼·기능검사·출하검사·사진이 모두 삭제됩니다.`,
      confirmLabel: '삭제 후 변경',
      danger: true,
      action: () => { window.actions.revertOrder(orderId); window.actions.setView('waiting'); },
    },
    'IN_PROGRESS->PENDING': {
      message: `오더 #${orderId}을(를) 생산대기로 되돌릴까요?\n입력 중인 내용은 저장되지 않습니다.`,
      confirmLabel: '되돌리기',
      danger: true,
      action: () => window.actions.revertOrder(orderId),
    },
  };
  const c = MAP[key];
  if (!c) return;
  window.actions.showConfirm(c.message, c.action, { danger: c.danger, confirmLabel: c.confirmLabel });
}

function ProductionMappingScreen() {
  const s = window.useStore();
  const order = s.orders.find(o => o.order_id === s.selectedOrderId);

  if (!order) {
    return (
      <div className="screen">
        <div className="screen__head">
          <div>
            <div className="screen__crumbs">제조,생산 부서 입력 페이지</div>
            <h1 className="screen__title">오더를 먼저 선택해 주세요</h1>
            <p className="screen__sub">생산 대기 목록에서 매핑할 오더를 클릭하면 이 화면에 로드됩니다.</p>
          </div>
        </div>
        <div className="card">
          <div className="card__body">
            <div className="emptystate">
              <Icon name="factory" size={32} stroke={1.2} style={{ color: 'var(--ink-5)' }}/>
              <div className="emptystate__title">선택된 오더가 없습니다</div>
              <div className="emptystate__sub">생산 대기 목록으로 이동하여 오더를 선택하세요</div>
              <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => window.actions.setView('waiting')}>
                <Icon name="list" size={13}/> 생산 대기 목록 열기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (order.status === 'AWAIT_PICKUP' || order.status === 'COMPLETED') return <CompletedView order={order}/>;
  if (order.status === 'IN_PROGRESS') return <MappingForm order={order}/>;
  return <PendingView order={order}/>;
}

function PendingView({ order }) {
  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">제조생산 · 생산대기</div>
          <h1 className="screen__title">
            오더 #{order.order_id}
            <span className="badge badge--pending" style={{ marginLeft: 10, fontSize: 13, verticalAlign: 'middle' }}>
              <span className="badge__dot"/>생산대기
            </span>
          </h1>
          <p className="screen__sub">영업 정보를 확인하고 <strong>생산 시작</strong>을 눌러주세요. 시작 후 생산 실적 7개 항목을 입력합니다.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn--secondary" onClick={() => window.actions.setView('waiting')}>
            <Icon name="arrow-left" size={13}/> 목록
          </button>
          <button className="btn btn--primary btn--lg" onClick={() => window.actions.startProduction(order.order_id)}>
            <Icon name="bolt" size={14}/> 생산 시작
          </button>
        </div>
      </div>
      <SalesReadOnly order={order}/>
    </div>
  );
}

function CompletedView({ order }) {
  const shipInsp = React.useMemo(
    () => window.PMDB.getShipInspectionDB(order.order_id),
    [order.order_id]
  );
  const shipAllDone = !!shipInsp &&
    Object.keys(shipInsp.checks || {}).length > 0 &&
    Object.values(shipInsp.checks || {}).every(v => v === true || (typeof v === 'string' && v.trim() !== ''));

  const isAwait = order.status === 'AWAIT_PICKUP';

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">{isAwait ? '품질 · 출하대기' : '입력 완료'}</div>
          <h1 className="screen__title">
            오더 #{order.order_id}
            {isAwait
              ? <span className="badge badge--pending" style={{ marginLeft: 10, fontSize: 13, verticalAlign: 'middle' }}><span className="badge__dot"/>출하대기</span>
              : <span className="badge badge--complete" style={{ marginLeft: 10, fontSize: 13, verticalAlign: 'middle' }}><Icon name="check" size={10}/>출하완료</span>
            }
          </h1>
          <p className="screen__sub">
            {isAwait
              ? '출하 검사 성적서 작성 후 출하 완료 처리하세요.'
              : '출하가 완료된 오더입니다. 필요 시 이전 상태로 되돌릴 수 있습니다.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isAwait && (
            <button
              className="btn btn--primary"
              disabled={!shipAllDone}
              title={!shipInsp ? '출하 검사 성적서를 먼저 작성해 주세요' : !shipAllDone ? '출하 검사 전 항목을 완료해 주세요' : ''}
              onClick={() => changeStatus(order.order_id, 'AWAIT_PICKUP', 'COMPLETED')}>
              <Icon name="truck" size={13}/> 출하 완료
            </button>
          )}
          {isAwait && (
            <button className="btn btn--secondary"
              onClick={() => changeStatus(order.order_id, 'AWAIT_PICKUP', 'IN_PROGRESS')}>
              <Icon name="refresh" size={13}/> 작업중으로 변경
            </button>
          )}
          {order.status === 'COMPLETED' && (
            <button className="btn btn--secondary"
              onClick={() => changeStatus(order.order_id, 'COMPLETED', 'AWAIT_PICKUP')}>
              <Icon name="refresh" size={13}/> 출하대기로 변경
            </button>
          )}
          <button className="btn btn--secondary" onClick={() => window.actions.setView('AwaitPickup')}>
            <Icon name="arrow-left" size={13}/> 목록으로
          </button>
        </div>
      </div>
      <SalesReadOnly order={order}/>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__head">
          <h2 className="card__title">
            <Icon name="factory" size={14}/> 생산 실적
          </h2>
          <span className="badge badge--complete"><Icon name="check" size={10}/>저장됨</span>
        </div>
        <div className="card__body">
          <div className="form-grid form-grid--3">
            <KvCell k="생산일자" v={order.production?.prod_date} icon="calendar"/>
            <KvCell k="로트" v={order.production?.lot_no} mono icon="package"/>
            <KvCell k="시리얼" v={order.production?.serial_no} mono icon="cpu"/>
            <KvCell k="검정일자" v={order.production?.inspection_date} icon="shield"/>
            <KvCell k="S/W 버전" v={order.production?.sw_version} mono icon="bolt"/>
            <KvCell k="F/W 버전" v={order.production?.fw_version} mono icon="bolt"/>
          </div>
        </div>
      </div>
    </div>
  );
}

function KvCell({ k, v, mono, icon }) {
  return (
    <div className="field">
      <label className="field__label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <Icon name={icon} size={11}/>}{k}
      </label>
      <div className="input input--readonly" style={{ display: 'flex', alignItems: 'center', fontFamily: mono ? 'var(--font-mono)' : 'inherit', fontSize: mono ? 14 : 15 }}>
        {v}
      </div>
    </div>
  );
}

function SalesReadOnly({ order }) {
  const [prevMap, setPrevMap] = React.useState({});
  const [history, setHistory] = React.useState([]);
  const [showHist, setShowHist] = React.useState(false);
  const modelCode = React.useMemo(
    () => window.PMDB.getModels().find(m => m.name === order.model_name)?.model || order.model_name,
    [order.model_name]
  );

  React.useEffect(() => {
    const hist = window.PMDB.getHistory(order.order_id) || [];
    const map = {};
    hist.filter(h => h.action !== 'create').forEach(h => {
      (h.changed_fields || []).forEach(f => {
        if (!(f.field in map)) map[f.field] = f.before;
      });
    });
    setPrevMap(map);
    setHistory(hist.filter(h => h.action !== 'create'));
  }, [order.order_id]);

  const changedCount = Object.keys(prevMap).length;

  return (
    <div className="readonly-strip">
      <div className="readonly-strip__hd">
        <div className="readonly-strip__lbl">
          <Icon name="cart" size={12}/> 영업 입력 정보 · 읽기 전용
          {changedCount > 0 && (
            <span className="badge badge--info" style={{ marginLeft: 8 }}>{changedCount}개 수정됨</span>
          )}
        </div>
        {history.length > 0 && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setShowHist(v => !v)}
            style={{ marginLeft: 'auto', fontSize: 12 }}>
            <Icon name="clock" size={12}/> 수정이력 {history.length}건 {showHist ? '▲' : '▼'}
          </button>
        )}
      </div>

      <div className="readonly-strip__grid">
        <Cell k="고객사" v={order.customer_name} prev={prevMap.customer_name}/>
        <Cell k="충전기 용도" v={order.usage_type || '공용'} prev={prevMap.usage_type}/>
        {order.cpo_name && <Cell k="CPO 운영사" v={order.cpo_name} prev={prevMap.cpo_name}/>}
        <Cell k="모델" v={modelCode} prev={prevMap.model_name}/>
        <Cell k="케이블 길이" v={order.cable_length} prev={prevMap.cable_length}/>
        <Cell k="납품일자" v={order.delivery_date} mono prev={prevMap.delivery_date}/>
        <Cell k="충전소 ID" v={order.station_id} mono prev={prevMap.station_id}/>
        <Cell k="라우터 S/N" v={order.router_no} mono prev={prevMap.router_no}/>
        <Cell k="USIM (ICCID)" v={order.usim_no} mono prev={prevMap.usim_no}/>
        <div className="readonly-strip__cell" style={{ gridColumn: 'span 2' }}>
          <div className="readonly-strip__cell__k">설치주소</div>
          <div className="readonly-strip__cell__v">
            {prevMap.install_address && prevMap.install_address !== order.install_address ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ textDecoration: 'line-through', color: 'var(--ink-4)', fontSize: '0.88em' }}>{prevMap.install_address}</span>
                <span style={{ color: 'var(--primary-600)' }}>{order.install_address}</span>
              </div>
            ) : order.install_address}
          </div>
        </div>
      </div>

      {showHist && (
        <div style={{ borderTop: '1px solid var(--border-1)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.map((h, i) => (
            <div key={h.history_id || i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge--pending" style={{ fontSize: 11 }}>
                  <span className="badge__dot"/>수정
                </span>
                <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink-1)' }}>{h.changed_by}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{h.changed_at}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
                {(h.changed_fields || []).map(f => (
                  <div key={f.field} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8, fontSize: 13, alignItems: 'start' }}>
                    <span style={{ color: 'var(--ink-3)' }}>{f.label}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--danger-700)', textDecoration: 'line-through', fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>{f.before || '—'}</span>
                      <span style={{ color: 'var(--ink-4)' }}>→</span>
                      <span style={{ color: 'var(--success-700)', fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>{f.after || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Cell({ k, v, mono, prev }) {
  const changed = prev !== undefined && prev !== null && prev !== '' && prev !== (v || '');
  return (
    <div className="readonly-strip__cell">
      <div className="readonly-strip__cell__k">{k}</div>
      <div className={`readonly-strip__cell__v ${mono ? 'readonly-strip__cell__v--mono' : ''}`}>
        {changed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ textDecoration: 'line-through', color: 'var(--ink-4)', fontSize: '0.88em' }}>{prev || '—'}</span>
            <span style={{ color: 'var(--primary-600)' }}>{v}</span>
          </div>
        ) : v}
      </div>
    </div>
  );
}

function MappingForm({ order }) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const isPublic = (order.usage_type || '공용') === '공용';

  const [form, setForm] = useStatePM(() => {
    const ex = order.production || {};
    return {
      prod_date: ex.prod_date || todayISO,
      lot_no: ex.lot_no || '',
      serial_no: ex.serial_no || '',
      inspection_date: ex.inspection_date || '',
      sw_version: ex.sw_version || '',
      fw_version: ex.fw_version || '',
    };
  });
  const [touched, setTouched] = useStatePM({});
  const [showAll, setShowAll] = useStatePM(false);
  const [dupState, setDupState] = useStatePM(order.production ? 'ok' : null); // null | 'checking' | 'ok' | 'dup'
  const [swVersions, setSwVersions] = useStatePM(() => window.PMDB.getSwVersions());
  const [addingSwVer, setAddingSwVer] = useStatePM(false);
  const [newSwVerTag, setNewSwVerTag] = useStatePM('');
  const [newSwVerStable, setNewSwVerStable] = useStatePM(true);
  const [fwVersions, setFwVersions] = useStatePM(() => window.PMDB.getFwVersions());
  const [addingFwVer, setAddingFwVer] = useStatePM(false);
  const [newFwVerTag, setNewFwVerTag] = useStatePM('');
  const [newFwVerStable, setNewFwVerStable] = useStatePM(true);
  const [funcInspectionData, setfuncInspectionData] = useStatePM(null);
  const [openFuncInspect, setOpenFuncInspect] = useStatePM(false);

  const funcAllDone = funcInspectionData != null &&
    Object.keys(funcInspectionData.checks || {}).length > 0 &&
    Object.values(funcInspectionData.checks || {}).every(v => v === true || (typeof v === 'string' && v.trim() !== ''));

  const modelInfo = useMemoPM(
    () => window.PMDB.getModels().find(m => m.name === order.model_name),
    [order.model_name]
  );

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const suggestSerial = useMemoPM(() => {
    const models = window.PMDB.getModels();
    const entry = models.find(m => m.name === order.model_name);
    const modelCode = entry ? entry.model : order.model_name;
    const codes = SERIAL_MODEL_CODES[modelCode];
    if (!codes) return 'G00-00S-D1-0001';
    const dateCode = makeSerialDateCode(form.prod_date || todayISO);
    const base = `${codes[0]}-${codes[1]}-${dateCode}`;
    let idx = 1;
    let candidate;
    do {
      candidate = `${base}-${String(idx).padStart(4, '0')}`;
      idx++;
    } while (window.PMDB.serialExists(candidate, order.order_id) && idx <= 9999);
    return candidate;
  }, [order.model_name, form.prod_date]);

  // Auto lot from prod_date
  React.useEffect(() => {
    if (form.prod_date && !form.lot_no) {
      const d = new Date(form.prod_date);
      const week = String(Math.ceil(((d - new Date(d.getFullYear(), 0, 1)) / 86400000 + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7)).padStart(2, '0');
      update('lot_no', `L${String(d.getFullYear()).slice(2)}-W${week}-A`);
    }
  }, [form.prod_date]);

  const checkDup = () => {
    if (!form.serial_no) return;
    setDupState('checking');
    setTimeout(() => {
      const dup = window.PMDB.serialExists(form.serial_no, order.order_id);
      setDupState(dup ? 'dup' : 'ok');
    }, 600);
  };

  const useSuggestion = () => {
    update('serial_no', suggestSerial);
    setDupState(null);
  };

  const addVersionSW = () => {
    const tag = newSwVerTag.trim();
    if (!tag) return;
    const ver = { tag, released: todayISO, stable: newSwVerStable };
    window.PMDB.addMasterSwVersion(ver);
    setSwVersions(prev => [ver, ...prev]);
    update('sw_version', tag);
    setTouched(t => ({ ...t, sw_version: 1 }));
    setAddingSwVer(false);
    setNewSwVerTag('');
  };

  const addVersionFW = () => {
    const tag = newFwVerTag.trim();
    if (!tag) return;
    const ver = { tag, released: todayISO, stable: newFwVerStable };
    window.PMDB.addMasterFwVersion(ver);
    setFwVersions(prev => [ver, ...prev]);
    update('fw_version', tag);
    setTouched(t => ({ ...t, fw_version: 1 }));
    setAddingFwVer(false);
    setNewFwVerTag('');
  };

  const errors = {
    prod_date: !form.prod_date && '생산일자를 선택하세요',
    lot_no: !form.lot_no && '로트번호를 입력하세요',
    serial_no: !form.serial_no ? '시리얼을 입력하세요' : (dupState === 'dup' ? '이미 사용된 시리얼입니다' : null),
    inspection_date: isPublic && !form.inspection_date && '검정일자를 선택하세요',
    sw_version: !form.sw_version && 'S/W 버전을 선택하세요',
    fw_version: !form.fw_version && 'F/W 버전을 선택하세요',
  };
  const hasErr = Object.values(errors).some(Boolean);
  const filled = Object.values(form).filter(Boolean).length + (funcInspectionData ? 1 : 0);

  const submit = () => {
    setShowAll(true);
    setTouched({ prod_date: 1, lot_no: 1, serial_no: 1, ...(isPublic ? { inspection_date: 1 } : {}), sw_version: 1, fw_version: 1 });
    if (hasErr) return;
    if (dupState === null && form.serial_no) {
      if (window.PMDB.serialExists(form.serial_no, order.order_id)) {
        setDupState('dup');
        return;
      }
    }
    window.setFuncInspection(order.order_id, funcInspectionData);
    window.actions.completeOrder(order.order_id, form);
  };

  const showErr = (k) => (showAll || touched[k]) && errors[k];

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">제조생산 입력 · 생산진행중</div>
          <h1 className="screen__title">
            오더 #{order.order_id} 생산 실적 입력
            <span className="badge badge--info" style={{ marginLeft: 10, fontSize: 13, verticalAlign: 'middle' }}>
              <span className="badge__dot"/>생산진행중
            </span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>
            <span style={{ fontWeight: 600, color: 'var(--ink-1)' }}>{filled}</span>/{isPublic ? 7 : 6} 항목 입력
          </span>
          <button className="btn btn--ghost btn--sm"
            onClick={() => changeStatus(order.order_id, 'IN_PROGRESS', 'PENDING')}>
            <Icon name="refresh" size={12}/> 대기로
          </button>
          <button className="btn btn--secondary" onClick={() => {
            window.PMDB.saveProduction(order.order_id, form);
            window.actions.refreshOrders();
            window.actions.flashToast('입력 내용이 임시 저장되었습니다', 'success');
            window.actions.setView('waiting');
          }}>
            <Icon name="arrow-left" size={13}/> 목록
          </button>
        </div>
      </div>

      <SalesReadOnly order={order}/>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__head">
          <h2 className="card__title">
            <Icon name="factory" size={14}/> 생산 실적 입력
          </h2>
          <span className="card__sub">tb_production_info · 7 columns</span>
        </div>
        <div className="card__body">
          <div className="form-grid form-grid--3">
            {/* 생산일자 */}
            <div className="field">
              <label className="field__label" htmlFor="pm-prod-date"><Icon name="calendar" size={11}/>생산일자 <span className="field__req">*</span></label>
              <input id="pm-prod-date" type="date"
                     className={`input ${showErr('prod_date') ? 'input--error' : ''}`}
                     aria-invalid={showErr('prod_date')}
                     value={form.prod_date}
                     onChange={(e) => { update('prod_date', e.target.value); setTouched(t => ({ ...t, prod_date: 1 })); update('lot_no', ''); }}/>
              <div className="field__hint">공장 조립 및 최종 자체 검사 완료일</div>
              {showErr('prod_date') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.prod_date}</div>}
            </div>

            {/* 로트 */}
            <div className="field">
              <label className="field__label" htmlFor="pm-lot-no"><Icon name="package" size={11}/>로트번호 <span className="field__req">*</span></label>
              <input id="pm-lot-no"
                     className={`input ${showErr('lot_no') ? 'input--error' : ''}`}
                     aria-invalid={showErr('lot_no')}
                     style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}
                     placeholder="예: L26-W22-A"
                     value={form.lot_no}
                     onChange={(e) => { update('lot_no', e.target.value); setTouched(t => ({ ...t, lot_no: 1 })); }}/>
              <div className="field__hint">생산일자 기준 자동 제안 · 수정 가능</div>
              {showErr('lot_no') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.lot_no}</div>}
            </div>

            {/* 시리얼 */}
            <div className="field">
              <label className="field__label" htmlFor="pm-serial-no">
                <Icon name="cpu" size={11}/>시리얼 <span className="field__req">*</span>
                <button type="button" className="helpdot" title="형식: 그룹코드-타입코드-연월코드-순번 (예: G00-00S-D6-0001). 연도는 A=2023·B=2024…, 월은 1-9·A=10·B=11·C=12. 자동 제안 버튼으로 채번하거나 직접 입력 후 중복 확인.">?</button>
              </label>
              <div className="input-group">
                <input id="pm-serial-no"
                       className={`input ${showErr('serial_no') ? 'input--error' : ''}`}
                       aria-invalid={showErr('serial_no')}
                       style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}
                       placeholder="예: G00-00S-D6-0001"
                       value={form.serial_no}
                       onChange={(e) => { update('serial_no', e.target.value.toUpperCase()); setTouched(t => ({ ...t, serial_no: 1 })); setDupState(null); }}/>
                <button type="button" className="input-group__btn" onClick={checkDup} disabled={!form.serial_no || dupState === 'checking'}>
                  {dupState === 'checking' ? '확인 중…' : '중복 확인'}
                </button>
              </div>
              <div className="field__hint" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {dupState === 'ok' && <span style={{ color: 'var(--success-700)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="check" size={11}/> 사용 가능</span>}
                {dupState === 'dup' && <span style={{ color: 'var(--danger-700)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="alert" size={11}/> 중복 — 다른 번호 사용 필요</span>}
                {!dupState && <span>외함/메인보드 고유 식별자 · </span>}
                <button type="button"
                        onClick={useSuggestion}
                        style={{ background: 'transparent', border: 0, color: 'var(--primary-600)', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 500, textDecoration: 'underline' }}>
                  추천: {suggestSerial}
                </button>
              </div>
              {showErr('serial_no') && dupState !== 'dup' && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.serial_no}</div>}
            </div>

            {/* 검정일자 — 공용 충전기만 표시 */}
            {isPublic && (
              <div className="field">
                <label className="field__label" htmlFor="pm-inspection-date"><Icon name="shield" size={11}/>검정일자 <span className="field__req">*</span></label>
                <input id="pm-inspection-date" type="date"
                       className={`input ${showErr('inspection_date') ? 'input--error' : ''}`}
                       aria-invalid={showErr('inspection_date')}
                       value={form.inspection_date}
                       onChange={(e) => { update('inspection_date', e.target.value); setTouched(t => ({ ...t, inspection_date: 1 })); }}/>
                <div className="field__hint">KTC 등 공인기관 형식승인 · 검정 완료일 · 유효기간 7년</div>
                {showErr('inspection_date') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.inspection_date}</div>}
              </div>
            )}

            {/* S/W 버전 */}  
            <div className="field col-span-2">
              <div className="field__label"><Icon name="bolt" size={11}/>S/W 버전 <span className="field__req">*</span></div>
              <div className="tagpicker">
                {swVersions.map(v => (
                  <button key={v.tag}
                          type="button"
                          className={`tagpicker__item ${form.sw_version === v.tag ? 'tagpicker__item--active' : ''} ${!v.stable && form.sw_version !== v.tag ? 'tagpicker__item--beta' : ''}`}
                          onClick={() => { update('sw_version', v.tag); setTouched(t => ({ ...t, sw_version: 1 })); }}>
                    <Icon name="tag" size={10}/>{v.tag}
                    {!v.stable && <span style={{ fontSize: 11, opacity: 0.8 }}>BETA</span>}
                  </button>
                ))}
                <button type="button"
                        className={`tagpicker__item tagpicker__item--add ${addingSwVer ? 'tagpicker__item--active' : ''}`}
                        onClick={() => { setAddingSwVer(v => !v); setNewSwVerTag(''); }}>
                  <Icon name="plus" size={10}/> 버전 추가
                </button>
              </div>
              {addingSwVer && (
                <div className="ver-add-row">
                  <input
                    className="input"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5 }}
                    placeholder="예: v1.8.0-core"
                    value={newSwVerTag}
                    onChange={e => setNewSwVerTag(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addVersionSW(); if (e.key === 'Escape') setAddingSwVer(false); }}
                    autoFocus
                  />
                  <label className="ver-add-row__toggle">
                    <input type="checkbox" checked={newSwVerStable} onChange={e => setNewSwVerStable(e.target.checked)}/>
                    정식(stable)
                  </label>
                  <button type="button" className="btn btn--primary btn--sm" onClick={addVersionSW} disabled={!newSwVerTag.trim()}>
                    <Icon name="plus" size={12}/> 추가
                  </button>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setAddingSwVer(false); setNewSwVerTag(''); }}>
                    취소
                  </button>
                </div>
              )}
              <div className="field__hint">목록에서 선택하거나 <strong>버전 추가</strong>로 직접 등록 </div>
              {showErr('sw_version') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.sw_version}</div>}
            </div>

            {/* F/W 버전 */}  
            <div className="field col-span-2">
              <div className="field__label"><Icon name="bolt" size={11}/>F/W 버전 <span className="field__req">*</span></div>
              <div className="tagpicker">
                {fwVersions.map(v => (
                  <button key={v.tag}
                          type="button"
                          className={`tagpicker__item ${form.fw_version === v.tag ? 'tagpicker__item--active' : ''} ${!v.stable && form.fw_version !== v.tag ? 'tagpicker__item--beta' : ''}`}
                          onClick={() => { update('fw_version', v.tag); setTouched(t => ({ ...t, fw_version: 1 })); }}>
                    <Icon name="tag" size={10}/>{v.tag}
                    {!v.stable && <span style={{ fontSize: 11, opacity: 0.8 }}>BETA</span>}
                  </button>
                ))}
                <button type="button"
                        className={`tagpicker__item tagpicker__item--add ${addingFwVer ? 'tagpicker__item--active' : ''}`}
                        onClick={() => { setAddingFwVer(v => !v); setNewFwVerTag(''); }}>
                  <Icon name="plus" size={10}/> 버전 추가
                </button>
              </div>
              {addingFwVer && (
                <div className="ver-add-row">
                  <input
                    className="input"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5 }}
                    placeholder="예: v1.8.0-core"
                    value={newFwVerTag}
                    onChange={e => setNewFwVerTag(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addVersionFW(); if (e.key === 'Escape') setAddingFwVer(false); }}
                    autoFocus
                  />
                  <label className="ver-add-row__toggle">
                    <input type="checkbox" checked={newFwVerStable} onChange={e => setNewFwVerStable(e.target.checked)}/>
                    정식(stable)
                  </label>
                  <button type="button" className="btn btn--primary btn--sm" onClick={addVersionFW} disabled={!newFwVerTag.trim()}>
                    <Icon name="plus" size={12}/> 추가
                  </button>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setAddingFwVer(false); setNewFwVerTag(''); }}>
                    취소
                  </button>
                </div>
              )}
              <div className="field__hint">목록에서 선택하거나 <strong>버전 추가</strong>로 직접 등록 </div>
              {showErr('fw_version') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.fw_version}</div>}
            </div>

            {/* 기능 검사 성적서 */}
            <div className="field col-span-2">
              <div className="field__label"><Icon name="doc" size={11}/>기능 검사 성적서 <span className="field__req">*</span></div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: funcAllDone ? 'var(--success-50)' : funcInspectionData ? 'var(--warning-50,#fffbeb)' : 'var(--surface-2)',
                border: `1px solid ${funcAllDone ? 'var(--success)' : funcInspectionData ? 'var(--warning,#f59e0b)' : 'var(--border-1)'}`,
                borderRadius: 'var(--r-md)',
              }}>
                <Icon name={funcAllDone ? 'check' : funcInspectionData ? 'clock' : 'doc'} size={16}
                  style={{ color: funcAllDone ? 'var(--success-700)' : funcInspectionData ? 'var(--warning-700,#b45309)' : 'var(--ink-4)', flexShrink: 0 }}/>
                <div style={{ flex: 1 }}>
                  {funcAllDone
                    ? <span style={{ fontSize: 13.5, color: 'var(--success-700)', fontWeight: 600 }}>검사 완료 · 검사자: {funcInspectionData.inspector} · {funcInspectionData.insp_date}</span>
                    : funcInspectionData
                      ? <span style={{ fontSize: 13.5, color: 'var(--warning-700,#b45309)', fontWeight: 600 }}>검사 미완료 · 검사자: {funcInspectionData.inspector} · {funcInspectionData.insp_date}</span>
                      : <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>기능 검사 성적서를 작성해야 출하대기 등록이 가능합니다</span>
                  }
                </div>
                <button type="button"
                  className={`btn btn--sm ${funcInspectionData ? 'btn--secondary' : 'btn--primary'}`}
                  onClick={() => setOpenFuncInspect(true)}>
                  <Icon name="doc" size={12}/> {funcInspectionData ? '수정' : '작성하기'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--ink-3)' }}>
              <Icon name="lock" size={13}/>
              저장 시 시리얼 번호 Unique 제약 검증 · 검정 유효기간 자동 계산
            </div>
            <button className="btn btn--success btn--lg" onClick={submit}
              disabled={!funcAllDone}
              title={!funcInspectionData ? '기능검사 성적서를 먼저 작성해 주세요' : !funcAllDone ? '기능검사 전 항목을 완료해 주세요' : ''}>
              <Icon name="check" size={14}/> 출하대기 등록
            </button>
          </div>
        </div>
      </div>
      {openFuncInspect && (
        <FuncInspectionDrawer
          order={order}
          existingData={funcInspectionData}
          modelInfo={modelInfo}
          onSave={(data) => setfuncInspectionData(data)}
          onClose={() => setOpenFuncInspect(false)}
        />
      )}
    </div>
  );
}

window.ProductionMappingScreen = ProductionMappingScreen;
