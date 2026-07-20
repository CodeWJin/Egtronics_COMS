// 생산대기 목록 — 칸반 전용 (생산요청 → 생산착수 → 생산완료 → 출하대기)
// 카드 클릭 시 화면 이동 대신 모달로 입력을 처리한다 (생산착수: ProductionEntryModal, 생산완료: SalesCompletionModal)

const { useState: useStatePW, useMemo: useMemoPW, useRef: useRefPW } = React;

const CABLE_LENGTH_OPTIONS = ['3', '5', '7', '10', '15', '20', '30'];

function priorityBadge(p) {
  if (p === 'high') return <span className="badge badge--info"><Icon name="fire" size={10}/>긴급</span>;
  if (p === 'low')  return <span className="badge badge--neutral">낮음</span>;
  return null;
}

function daysUntil(date) {
  const today = new Date();
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

function deliveryHint(d) {
  if (!d) return { text: '일정 미정', color: 'var(--ink-4)', bg: 'var(--surface-3)' };
  const n = daysUntil(d);
  if (n <= 0) return { text: `D+${Math.abs(n)}`, color: 'var(--danger-700)', bg: 'var(--danger-50)' };
  else if (n <= 7) return { text: `D-${n}`, color: 'var(--danger-700)', bg: 'var(--danger-50)' };
  else if (n <= 14) return { text: `D-${n}`, color: 'var(--warning-700)', bg: 'var(--warning-50)' };
  return { text: `D-${n}`, color: 'var(--ink-3)', bg: 'var(--surface-3)' };
}

// 4단계 칸반 컬럼 — 생산완료/출하대기는 둘 다 AWAIT_PICKUP 상태이며 영업정보 입력완료 여부로만 구분
const KANBAN_COLS = [
  { id: 'request',  title: '생산요청', dot: 'var(--ink-4)',   filter: (o) => o.status === 'PENDING' },
  { id: 'progress', title: '생산착수', dot: 'var(--primary)', filter: (o) => o.status === 'IN_PROGRESS' },
  { id: 'done',     title: '생산완료', dot: 'var(--warning, #f59e0b)', filter: (o) => o.status === 'AWAIT_PICKUP' && !window.isSalesInfoComplete(o) },
  { id: 'ready',    title: '출하대기', dot: 'var(--success)', filter: (o) => o.status === 'AWAIT_PICKUP' && window.isSalesInfoComplete(o) },
];

// 칸반 카드 진행율 — 생산착수(progress)/생산완료(done) 컬럼에서만 값을 반환한다.
// 분모 필드 목록은 ProductionEntryModal·SalesCompletionModal의 errors 객체와 동일하게 유지할 것.
function stageProgress(order) {
  const isPublic = (order.usage_type || '공용') === '공용';

  if (order.status === 'IN_PROGRESS') {
    const p = order.production || {};
    const funcData = window.getFuncInspection?.(order.order_id) ?? null;
    const funcDone = funcData != null && Object.keys(funcData.checks || {}).length > 0 &&
      Object.values(funcData.checks || {}).every(v => v === true || (typeof v === 'string' && v.trim() !== ''));
    const items = [
      !!p.prod_date, !!p.serial_no, !!p.sw_version, !!p.fw_version,
      ...(isPublic ? [!!p.inspection_date] : []),
      funcDone,
    ];
    return { done: items.filter(Boolean).length, total: items.length };
  }

  if (order.status === 'AWAIT_PICKUP' && !window.isSalesInfoComplete(order)) {
    const items = [
      order.cable_length, order.customer_name, order.customer_manager,
      order.field_manager_phone, order.install_address, order.delivery_date,
      ...(isPublic ? [order.station_id, order.charger_no, order.router_no, order.usim_no] : []),
    ];
    return { done: items.filter(Boolean).length, total: items.length };
  }

  return null;
}

function progressColor(prog) {
  const ratio = prog.done / prog.total;
  if (ratio >= 0.8) return 'var(--success)';
  if (ratio >= 0.4) return 'var(--primary)';
  return 'var(--warning, #f59e0b)';
}

function ProductionWaitingScreen() {
  const s = window.useStore();
  const [search, setSearch] = useStatePW('');
  const [filterModel, setFilterModel] = useStatePW('all');
  const [filterUsage, setFilterUsage] = useStatePW('all');
  const [models, setModels] = useStatePW(() => window.PMDB.getModels());
  const [selectedIds, setSelectedIds] = useStatePW(() => new Set());
  const [entryOrder, setEntryOrder] = useStatePW(null);
  const [salesOrder, setSalesOrder] = useStatePW(null);

  React.useEffect(() => {
    const sync = () => setModels(window.PMDB.getModels());
    window.addEventListener('masterLoaded', sync);
    return () => window.removeEventListener('masterLoaded', sync);
  }, []);

  const filtered = useMemoPW(() => {
    return s.orders.filter(o => {
      if (o.status === 'COMPLETED') return false;
      if (filterModel !== 'all') {
        const mName = window.findModelInfo(o.model_name)?.model || o.model_name;
        if (mName !== filterModel) return false;
      }
      if (filterUsage !== 'all' && (o.usage_type || '공용') !== filterUsage) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(o.customer_name || '').toLowerCase().includes(q) &&
            !o.model_name.toLowerCase().includes(q) &&
            !(o.station_id || '').toLowerCase().includes(q) &&
            !String(o.order_id).includes(q)) return false;
      }
      return true;
    });
  }, [s.orders, search, filterModel, filterUsage]);

  const editedIds = useMemoPW(() => {
    const set = new Set();
    s.orders.forEach(o => {
      if (o.status === 'COMPLETED') return;
      const hist = window.PMDB.getHistory(o.order_id) || [];
      if (hist.some(h => h.action !== 'create')) set.add(o.order_id);
    });
    return set;
  }, [s.orders]);

  const role = s.currentUser?.role;
  const isSales = role === 'sales';

  const onPick = (order, colId) => {
    if (colId === 'request') {
      if (isSales) window.actions.editOrder(order.order_id);
      return;
    }
    if (colId === 'progress') {
      if (role === 'production' || role === 'admin') setEntryOrder(order);
      return;
    }
    if (colId === 'done') {
      if (role === 'sales' || role === 'admin') setSalesOrder(order);
      return;
    }
    if (colId === 'ready') {
      const allowed = window.ROLE_TABS[role] || [];
      if (allowed.includes('AwaitPickup')) window.actions.setView('AwaitPickup');
    }
  };

  // ── 다중선택 → 생산 시작(생산요청 → 생산착수) 일괄 처리 (영업 역할 제외) ──
  const selectableStatuses = useMemoPW(() => new Set(['PENDING']), []);
  const selectedOrders = useMemoPW(
    () => [...selectedIds].map(id => s.orders.find(o => o.order_id === id)).filter(Boolean),
    [selectedIds, s.orders]
  );
  const selectionGroup = selectedOrders[0]
    ? { model: selectedOrders[0].model_name, usage: selectedOrders[0].usage_type || '공용' }
    : null;

  const canSelect = (order) => {
    if (!selectableStatuses.has(order.status)) return false;
    if (!selectionGroup) return true;
    return order.model_name === selectionGroup.model && (order.usage_type || '공용') === selectionGroup.usage;
  };

  const toggleSelect = (order) => {
    if (!canSelect(order) && !selectedIds.has(order.order_id)) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(order.order_id)) next.delete(order.order_id); else next.add(order.order_id);
      return next;
    });
  };

  const quickStart = () => {
    if (selectedOrders.length === 0) return;
    window.actions.showConfirm(
      `생산대기 ${selectedOrders.length}건을 생산착수로 전환할까요?\n생산 실적은 이후 카드를 눌러 개별 입력하면 됩니다.`,
      () => {
        selectedOrders.forEach(o => window.PMDB.startProduction(o.order_id));
        window.actions.refreshOrders();
        window.actions.flashToast(`${selectedOrders.length}건 생산착수 처리되었습니다`, 'success');
        setSelectedIds(new Set());
      }
    );
  };

  const toggleAll = (groupOrders) => {
    const selectable = groupOrders.filter(o => canSelect(o) || selectedIds.has(o.order_id));
    const allChecked = selectable.length > 0 && selectable.every(o => selectedIds.has(o.order_id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allChecked) {
        selectable.forEach(o => next.delete(o.order_id));
      } else {
        selectable.forEach(o => { if (canSelect(o)) next.add(o.order_id); });
      }
      return next;
    });
  };

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">생산 부서 · 생산대기 큐</div>
          <h1 className="screen__title">생산 대기 목록</h1>
          <p className="screen__sub">{isSales
            ? '영업 담당자는 생산요청 카드를 선택해 모델·수량을 수정하거나, 생산완료 카드에서 발주 정보를 입력할 수 있습니다.'
            : '카드를 클릭하면 단계별 입력 모달이 열립니다.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--secondary" onClick={() => window.actions.setView('sales')}>
            <Icon name="plus" size={13}/> 신규 생산요청
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar__search">
          <span className="toolbar__search__icon"><Icon name="search" size={14}/></span>
          <input className="input" aria-label="고객사, 모델, 충전소 ID, 오더번호 검색"
                 placeholder="고객사 · 모델 · 충전소 ID · 오더번호 검색"
                 value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <select className="select" aria-label="모델 필터" style={{ width: 160 }}
                value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
          <option value="all">모델 전체</option>
          {models.map(m => <option key={m.model} value={m.model}>{m.model}</option>)}
        </select>
        <button className={`chip ${filterUsage === '비공용' ? 'chip--active' : ''}`}
                style={{ whiteSpace: 'nowrap', fontSize: 12, padding: '5px 10px' }}
                onClick={() => setFilterUsage(v => v === '비공용' ? 'all' : '비공용')}
                aria-pressed={filterUsage === '비공용'}
                title="비공용 오더만 표시">
          비공용만
        </button>
        <button className={`toolbar__filter ${filterModel !== 'all' || filterUsage !== 'all' || search ? 'toolbar__filter--active' : ''}`}
                onClick={() => { setSearch(''); setFilterModel('all'); setFilterUsage('all'); }}
                aria-label="필터 초기화">
          <Icon name="filter" size={12}/><span aria-hidden="true"> 초기화</span>
        </button>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', marginRight: 8 }}>
          <strong style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{filtered.length}</strong>건
        </span>
      </div>

      {!isSales && selectedIds.size > 0 && (
        <div className="toolbar" style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-700, var(--primary))' }}>
            <Icon name="check" size={13}/> {selectedIds.size}건 선택됨
            {selectionGroup && <span style={{ fontWeight: 400, color: 'var(--ink-3)', marginLeft: 6 }}>· {selectionGroup.model} / {selectionGroup.usage}</span>}
          </span>
          <div style={{ flex: 1 }}/>
          <button className="btn btn--ghost btn--sm" onClick={() => setSelectedIds(new Set())}>선택 해제</button>
          <button className="btn btn--secondary btn--sm" onClick={quickStart}>
            <Icon name="bolt" size={13}/> 생산 착수 ({selectedIds.size}건)
          </button>
        </div>
      )}

      <div className="view-enter">
        {filtered.length === 0 ? (
          <div className="table-wrap">
            <div className="emptystate">
              <Icon name="package" size={28} stroke={1.2} style={{ color: 'var(--ink-5)' }} aria-hidden="true"/>
              {s.orders.filter(o => o.status !== 'COMPLETED').length === 0 ? (
                <>
                  <div className="emptystate__title">생산 대기 중인 오더가 없습니다</div>
                  <div className="emptystate__sub">영업 부서에서 생산요청을 등록하면 이 목록에 표시됩니다</div>
                  {isSales && (
                    <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => window.actions.setView('sales')}>
                      <Icon name="plus" size={13}/> 신규 생산요청 등록
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="emptystate__title">조건에 맞는 오더가 없습니다</div>
                  <div className="emptystate__sub">검색어 또는 필터를 변경해 보세요</div>
                  <button className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} onClick={() => { setSearch(''); setFilterModel('all'); setFilterUsage('all'); }}>
                    필터 초기화
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <ViewKanban orders={filtered} onPick={onPick} editedIds={editedIds}
            selectable={!isSales} selectedIds={selectedIds} canSelect={canSelect}
            onToggleSelect={toggleSelect} onToggleAll={toggleAll}/>
        )}
      </div>

      {entryOrder && (
        <ProductionEntryModal order={entryOrder} onClose={() => setEntryOrder(null)}/>
      )}
      {salesOrder && (
        <SalesCompletionModal order={salesOrder} onClose={() => setSalesOrder(null)}/>
      )}
    </div>
  );
}

/* ────────── 칸반 뷰 ────────── */
function ViewKanban({ orders, onPick, editedIds, selectable, selectedIds, canSelect, onToggleSelect, onToggleAll }) {
  const hasProgress = orders.some(o => o.status === 'IN_PROGRESS');
  const hasAwait = orders.some(o => o.status === 'AWAIT_PICKUP');
  const visibleCols = KANBAN_COLS.filter(col => {
    if (col.id === 'progress') return hasProgress;
    if (col.id === 'done' || col.id === 'ready') return hasAwait;
    return true;
  });

  return (
    <div className="view-panel">
    <div className="kanban-scroll">
    <div className="kanban" style={{ gridTemplateColumns: `repeat(${visibleCols.length}, minmax(200px, 1fr))` }}>
      {visibleCols.map(col => {
        const items = orders.filter(col.filter);
        const groupSelectable = selectable && col.id === 'request';
        const selectableInCol = groupSelectable ? items.filter(o => canSelect ? canSelect(o) : true) : [];
        const allChecked = selectableInCol.length > 0 && selectableInCol.every(o => selectedIds?.has(o.order_id));
        return (
          <div key={col.id} className="kanban__col">
            <div className="kanban__colhead">
              <div className="kanban__colhead__title">
                <span className="kanban__dot" style={{ background: col.dot }}/>
                {col.title}
              </div>
              <span className="kanban__count">{items.length}</span>
            </div>
            {groupSelectable && selectableInCol.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-3)', padding: '0 2px 6px' }}>
                <input type="checkbox" checked={allChecked}
                  onChange={() => onToggleAll && onToggleAll(items)}
                  style={{ width: 14, height: 14, accentColor: 'var(--primary)' }}/>
                전체 선택
              </label>
            )}
            {items.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>—</div>
            )}
            {items.map((o, idx) => {
              const d = deliveryHint(o.delivery_date);
              const prog = stageProgress(o);
              const serial = o.production?.serial_no;
              const checked = selectable && col.id === 'request' && !!selectedIds?.has(o.order_id);
              const selDisabled = col.id === 'request' && selectable && !checked && canSelect && !canSelect(o);
              return (
                <div key={o.order_id}
                     style={{ '--i': idx, ...(checked ? { outline: '2px solid var(--primary)', outlineOffset: -2 } : {}) }}
                     className="kanban__card"
                     role="button" tabIndex={0}
                     onClick={() => onPick(o, col.id)}
                     onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(o, col.id); } }}>
                  <div className="kanban__card__top">
                    <span className="kanban__card__id">#{o.order_id}</span>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {col.id === 'request' && selectable && (
                        <span onClick={e => e.stopPropagation()}>
                          <input type="checkbox" aria-label={`오더 #${o.order_id} 선택`}
                            checked={checked} disabled={selDisabled}
                            title={selDisabled ? '같은 모델·용도만 함께 선택 가능' : ''}
                            onChange={() => onToggleSelect(o)}
                            style={{ width: 13, height: 13, accentColor: 'var(--primary)', cursor: selDisabled ? 'not-allowed' : 'pointer' }}/>
                        </span>
                      )}
                      {editedIds.has(o.order_id) && <span className="badge badge--info" style={{ fontSize: 10.5 }}>수정됨</span>}
                    </div>
                  </div>
                  <div className="kanban__card__title">{o.model_name}</div>
                  {serial && <div className="kanban__card__serial">{serial}</div>}
                  <div className="kanban__card__sub">{o.customer_name || (o.requested_by ? `요청자: ${o.requested_by}` : '발주정보 미입력')}</div>
                  <div className="kanban__card__meta">
                    <span className="badge badge--neutral" style={{ fontSize: 10.5 }}>{o.usage_type || '공용'}</span>
                    {col.id === 'ready' && (
                      <span className="dday-badge" style={{ '--dday-color': d.color, '--dday-bg': d.bg }}>{d.text}</span>
                    )}
                  </div>
                  {prog && (
                    <div className="kanban__card__progress">
                      <div className="kanban__card__progress-track">
                        <div className="kanban__card__progress-fill" style={{ width: `${(prog.done / prog.total) * 100}%`, background: progressColor(prog) }}/>
                      </div>
                      <span className="kanban__card__progress-text">{prog.done}/{prog.total}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
    </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   생산착수 모달 — 생산일자·시리얼·검정일자·SW/FW버전·기능검사 성적서
   (기존 production-mapping.jsx의 MappingForm을 모달로 이식)
   ════════════════════════════════════════════════════════════ */
function ProductionEntryModal({ order, onClose }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const todayISO = new Date().toISOString().slice(0, 10);
  const isPublic = (order.usage_type || '공용') === '공용';

  const [form, setForm] = useStatePW(() => {
    const ex = order.production || {};
    return {
      prod_date: ex.prod_date || todayISO,
      serial_no: ex.serial_no || '',
      inspection_date: ex.inspection_date || '',
      sw_version: ex.sw_version || '',
      fw_version: ex.fw_version || '',
    };
  });
  const [touched, setTouched] = useStatePW({});
  const [showAll, setShowAll] = useStatePW(false);
  const [dupState, setDupState] = useStatePW(null); // null | 'ok' | 'dup'
  const [swVersions, setSwVersions] = useStatePW(() => window.PMDB.getSwVersions());
  const [addingSwVer, setAddingSwVer] = useStatePW(false);
  const [newSwVerTag, setNewSwVerTag] = useStatePW('');
  const [newSwVerStable, setNewSwVerStable] = useStatePW(true);
  const [fwVersions, setFwVersions] = useStatePW(() => window.PMDB.getFwVersions());
  const [addingFwVer, setAddingFwVer] = useStatePW(false);
  const [newFwVerTag, setNewFwVerTag] = useStatePW('');
  const [newFwVerStable, setNewFwVerStable] = useStatePW(true);
  const [funcInspectionData, setFuncInspectionData] = useStatePW(
    () => window.getFuncInspection?.(order.order_id) ?? null
  );
  const [openFuncInspect, setOpenFuncInspect] = useStatePW(false);

  const funcAllDone = funcInspectionData != null &&
    Object.keys(funcInspectionData.checks || {}).length > 0 &&
    Object.values(funcInspectionData.checks || {}).every(v => v === true || (typeof v === 'string' && v.trim() !== ''));

  const modelInfo = useMemoPW(() => window.findModelInfo(order.model_name), [order.model_name]);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const suggestSerial = useMemoPW(
    () => window.PMDB.generateSerialSuggestion(order.model_name, order.usage_type, form.prod_date || todayISO, order.order_id) || 'G00-00S-D1-0001',
    [order.model_name, order.usage_type, form.prod_date, order.order_id]
  );

  const checkDup = () => {
    if (!form.serial_no) return;
    const dup = window.PMDB.serialExists(form.serial_no, order.order_id);
    setDupState(dup ? 'dup' : 'ok');
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
    serial_no: !form.serial_no ? '시리얼을 입력하세요' : (dupState === 'dup' ? '이미 사용된 시리얼입니다' : null),
    inspection_date: isPublic && !form.inspection_date && '검정일자를 선택하세요',
    sw_version: !form.sw_version && 'S/W 버전을 선택하세요',
    fw_version: !form.fw_version && 'F/W 버전을 선택하세요',
  };
  const hasErr = Object.values(errors).some(Boolean);

  const submit = () => {
    setShowAll(true);
    setTouched({ prod_date: 1, serial_no: 1, ...(isPublic ? { inspection_date: 1 } : {}), sw_version: 1, fw_version: 1 });
    if (hasErr) return;
    if (form.serial_no && window.PMDB.serialExists(form.serial_no, order.order_id)) {
      setDupState('dup');
      return;
    }
    window.setFuncInspection(order.order_id, funcInspectionData);
    window.actions.completeOrder(order.order_id, form);
    onClose();
  };

  const saveDraft = () => {
    window.PMDB.saveProduction(order.order_id, form);
    window.actions.refreshOrders();
    window.actions.flashToast('입력 내용이 임시 저장되었습니다', 'success');
    onClose();
  };

  const revertToPending = () => {
    window.actions.showConfirm(
      `오더 #${order.order_id}을(를) 생산대기로 되돌릴까요?\n입력 중인 내용은 저장되지 않습니다.`,
      () => { window.actions.revertOrder(order.order_id); onClose(); },
      { confirmLabel: '되돌리기', danger: true }
    );
  };

  const showErr = (k) => (showAll || touched[k]) && errors[k];

  return (
    <div className="modal-backdrop" ref={dialogRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pem-title" style={{ width: 780, maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal__head">
          <h2 id="pem-title" className="modal__title">
            오더 #{order.order_id} 생산착수 입력
            <span className="badge badge--info" style={{ marginLeft: 10, fontSize: 12, verticalAlign: 'middle' }}>
              <span className="badge__dot"/>생산진행중
            </span>
          </h2>
          <p className="modal__sub">{order.model_name} · {order.usage_type || '공용'}</p>
        </div>
        <div className="modal__body" style={{ overflow: 'auto', flex: 1 }}>
          <div className="form-grid form-grid--3">
            <div className="field">
              <label className="field__label" htmlFor="pem-prod-date"><Icon name="calendar" size={11}/>생산일자 <span className="field__req">*</span></label>
              <input id="pem-prod-date" type="date"
                     className={`input ${showErr('prod_date') ? 'input--error' : ''}`}
                     value={form.prod_date}
                     onChange={(e) => { update('prod_date', e.target.value); setTouched(t => ({ ...t, prod_date: 1 })); }}/>
              {showErr('prod_date') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.prod_date}</div>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="pem-serial-no">
                <Icon name="cpu" size={11}/>시리얼 <span className="field__req">*</span>
                <window.HelpDot text="생산착수 시 자동 채번됩니다. 필요 시 직접 수정 후 중복 확인하세요."/>
              </label>
              <div className="input-group">
                <input id="pem-serial-no"
                       className={`input ${showErr('serial_no') ? 'input--error' : ''}`}
                       style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}
                       value={form.serial_no}
                       onChange={(e) => { update('serial_no', e.target.value.toUpperCase()); setTouched(t => ({ ...t, serial_no: 1 })); setDupState(null); }}/>
                <button type="button" className="input-group__btn" onClick={checkDup} disabled={!form.serial_no}>중복 확인</button>
              </div>
              <div className="field__hint" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {dupState === 'ok' && <span style={{ color: 'var(--success-700)' }}><Icon name="check" size={11}/> 사용 가능</span>}
                {dupState === 'dup' && <span style={{ color: 'var(--danger-700)' }}><Icon name="alert" size={11}/> 중복 — 다른 번호 필요</span>}
                <button type="button" onClick={useSuggestion}
                        style={{ background: 'transparent', border: 0, color: 'var(--primary-600)', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 500, textDecoration: 'underline' }}>
                  재생성: {suggestSerial}
                </button>
              </div>
              {showErr('serial_no') && dupState !== 'dup' && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.serial_no}</div>}
            </div>

            {isPublic && (
              <div className="field">
                <label className="field__label" htmlFor="pem-inspection-date"><Icon name="shield" size={11}/>검정일자 <span className="field__req">*</span></label>
                <input id="pem-inspection-date" type="date"
                       className={`input ${showErr('inspection_date') ? 'input--error' : ''}`}
                       value={form.inspection_date}
                       onChange={(e) => { update('inspection_date', e.target.value); setTouched(t => ({ ...t, inspection_date: 1 })); }}/>
                {showErr('inspection_date') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.inspection_date}</div>}
              </div>
            )}

            <div className="field col-span-2">
              <div className="field__label" id="pem-sw-label"><Icon name="bolt" size={11}/>S/W 버전 <span className="field__req">*</span></div>
              <div className="tagpicker" role="group" aria-labelledby="pem-sw-label">
                {swVersions.map(v => (
                  <button key={v.tag} type="button"
                          className={`tagpicker__item ${form.sw_version === v.tag ? 'tagpicker__item--active' : ''} ${!v.stable && form.sw_version !== v.tag ? 'tagpicker__item--beta' : ''}`}
                          onClick={() => { update('sw_version', v.tag); setTouched(t => ({ ...t, sw_version: 1 })); }}>
                    <Icon name="tag" size={10}/>{v.tag}{!v.stable && <span style={{ fontSize: 11, opacity: 0.8 }}>BETA</span>}
                  </button>
                ))}
                <button type="button" className={`tagpicker__item tagpicker__item--add ${addingSwVer ? 'tagpicker__item--active' : ''}`}
                        onClick={() => { setAddingSwVer(v => !v); setNewSwVerTag(''); }}>
                  <Icon name="plus" size={10}/> 버전 추가
                </button>
              </div>
              {addingSwVer && (
                <div className="ver-add-row">
                  <input className="input" style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5 }}
                    placeholder="예: v1.8.0-core" value={newSwVerTag}
                    onChange={e => setNewSwVerTag(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addVersionSW(); if (e.key === 'Escape') setAddingSwVer(false); }} autoFocus/>
                  <label className="ver-add-row__toggle">
                    <input type="checkbox" checked={newSwVerStable} onChange={e => setNewSwVerStable(e.target.checked)}/>정식(stable)
                  </label>
                  <button type="button" className="btn btn--primary btn--sm" onClick={addVersionSW} disabled={!newSwVerTag.trim()}><Icon name="plus" size={12}/> 추가</button>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setAddingSwVer(false); setNewSwVerTag(''); }}>취소</button>
                </div>
              )}
              {showErr('sw_version') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.sw_version}</div>}
            </div>

            <div className="field col-span-2">
              <div className="field__label" id="pem-fw-label"><Icon name="bolt" size={11}/>F/W 버전 <span className="field__req">*</span></div>
              <div className="tagpicker" role="group" aria-labelledby="pem-fw-label">
                {fwVersions.map(v => (
                  <button key={v.tag} type="button"
                          className={`tagpicker__item ${form.fw_version === v.tag ? 'tagpicker__item--active' : ''} ${!v.stable && form.fw_version !== v.tag ? 'tagpicker__item--beta' : ''}`}
                          onClick={() => { update('fw_version', v.tag); setTouched(t => ({ ...t, fw_version: 1 })); }}>
                    <Icon name="tag" size={10}/>{v.tag}{!v.stable && <span style={{ fontSize: 11, opacity: 0.8 }}>BETA</span>}
                  </button>
                ))}
                <button type="button" className={`tagpicker__item tagpicker__item--add ${addingFwVer ? 'tagpicker__item--active' : ''}`}
                        onClick={() => { setAddingFwVer(v => !v); setNewFwVerTag(''); }}>
                  <Icon name="plus" size={10}/> 버전 추가
                </button>
              </div>
              {addingFwVer && (
                <div className="ver-add-row">
                  <input className="input" style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5 }}
                    placeholder="예: v1.8.0-core" value={newFwVerTag}
                    onChange={e => setNewFwVerTag(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addVersionFW(); if (e.key === 'Escape') setAddingFwVer(false); }} autoFocus/>
                  <label className="ver-add-row__toggle">
                    <input type="checkbox" checked={newFwVerStable} onChange={e => setNewFwVerStable(e.target.checked)}/>정식(stable)
                  </label>
                  <button type="button" className="btn btn--primary btn--sm" onClick={addVersionFW} disabled={!newFwVerTag.trim()}><Icon name="plus" size={12}/> 추가</button>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setAddingFwVer(false); setNewFwVerTag(''); }}>취소</button>
                </div>
              )}
              {showErr('fw_version') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.fw_version}</div>}
            </div>

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
                      : <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>기능 검사 성적서를 작성해야 출하대기 등록이 가능합니다</span>}
                </div>
                <button type="button" className={`btn btn--sm ${funcInspectionData ? 'btn--secondary' : 'btn--primary'}`} onClick={() => setOpenFuncInspect(true)}>
                  <Icon name="doc" size={12}/> {funcInspectionData ? '수정' : '작성하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="modal__foot" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn--ghost" onClick={revertToPending}><Icon name="refresh" size={12}/> 대기로 되돌리기</button>
          <div style={{ flex: 1 }}/>
          <button className="btn btn--secondary" onClick={saveDraft}><Icon name="save" size={13}/> 임시저장</button>
          <button className="btn btn--secondary" onClick={onClose}>닫기</button>
          <button className="btn btn--success" onClick={submit}
            disabled={!funcAllDone}
            title={!funcInspectionData ? '기능검사 성적서를 먼저 작성해 주세요' : !funcAllDone ? '기능검사 전 항목을 완료해 주세요' : ''}>
            <Icon name="check" size={14}/> 생산완료 처리
          </button>
        </div>
      </div>
      {openFuncInspect && (
        <FuncInspectionDrawer
          order={order}
          existingData={funcInspectionData}
          modelInfo={modelInfo}
          onSave={(data) => setFuncInspectionData(data)}
          onClose={() => setOpenFuncInspect(false)}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   생산완료 모달 — 발주처·케이블길이·납품정보(+공용 통신정보) 입력
   ════════════════════════════════════════════════════════════ */
function SalesCompletionModal({ order, onClose }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const isPublic = (order.usage_type || '공용') === '공용';

  const [form, setForm] = useStatePW(() => ({
    cable_length: order.cable_length || '',
    customer_name: order.customer_name || '',
    customer_manager: order.customer_manager || '',
    field_manager_phone: order.field_manager_phone || '',
    install_address: order.install_address || '',
    install_address_detail: '',
    delivery_date: order.delivery_date || '',
    cpo_name: order.cpo_name || '',
    station_id: order.station_id || '',
    charger_no: order.charger_no || '',
    router_no: order.router_no || '',
    usim_no: order.usim_no || '',
  }));
  const [submitted, setSubmitted] = useStatePW(false);
  const [masterCustomers, setMasterCustomers] = useStatePW(() => window.PMDB.getCustomers());
  const [masterCpos, setMasterCpos] = useStatePW(() => window.PMDB.getCpos());
  const [managers, setManagers] = useStatePW(() => window.PMDB.getManagers ? window.PMDB.getManagers(order.customer_name) : []);
  const [modal, setModal] = useStatePW(null);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const refreshManagers = (customerName) => {
    if (!customerName || !window.PMDB.getManagers) { setManagers([]); return []; }
    const raw = window.PMDB.getManagers(customerName);
    const list = raw.map(m => ({ ...m, display: m.phone ? `${m.name} (${m.phone})` : m.name }));
    setManagers(list);
    return list;
  };

  const errors = {
    cable_length: !form.cable_length && '케이블 길이를 입력해 주세요',
    customer_name: !form.customer_name && '발주처를 입력해 주세요',
    customer_manager: !form.customer_manager && '발주처 담당자를 입력해 주세요',
    field_manager_phone: !form.field_manager_phone && '발주처 담당자 전화번호를 입력해 주세요',
    install_address: !form.install_address && '납품장소를 입력해 주세요',
    delivery_date: !form.delivery_date && '납품일자를 선택해 주세요',
    station_id: isPublic && !form.station_id && '충전소 ID를 입력해 주세요',
    charger_no: isPublic && !form.charger_no && '충전기 ID를 입력해 주세요',
    router_no: isPublic && !form.router_no && '라우터번호를 입력해 주세요',
    usim_no: isPublic && !form.usim_no ? 'USIM번호를 입력해 주세요' : (isPublic && form.usim_no && form.usim_no.length < 19 ? '19자리 이상' : null),
  };
  const hasErr = Object.values(errors).some(Boolean);
  const showErr = (k) => submitted && errors[k];

  const submit = () => {
    setSubmitted(true);
    if (hasErr) return;
    const addr = [form.install_address.trim(), form.install_address_detail.trim()].filter(Boolean).join(' ');
    const payload = {
      cable_length: form.cable_length,
      customer_name: form.customer_name,
      customer_manager: form.customer_manager,
      field_manager_phone: form.field_manager_phone,
      install_address: addr,
      delivery_date: form.delivery_date,
      cpo_name: form.cpo_name,
      ...(isPublic ? { station_id: form.station_id, charger_no: form.charger_no, router_no: form.router_no, usim_no: form.usim_no } : {}),
    };
    window.actions.updateOrder(order.order_id, payload);
    onClose();
  };

  return (
    <div className="modal-backdrop" ref={dialogRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="scm-title" style={{ width: 680, maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal__head">
          <h2 id="scm-title" className="modal__title">오더 #{order.order_id} 생산완료 · 영업정보 입력</h2>
          <p className="modal__sub">{order.model_name} · {order.usage_type || '공용'}</p>
        </div>
        <div className="modal__body" style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="field">
              <label className="field__label" htmlFor="scm-cable">케이블 길이(m) <span className="field__req">*</span></label>
              <input id="scm-cable" className={`input ${showErr('cable_length') ? 'input--error' : ''}`}
                     list="scm-cable-options" inputMode="numeric"
                     value={form.cable_length}
                     onChange={(e) => update('cable_length', e.target.value.replace(/[^\d.]/g, ''))}/>
              <datalist id="scm-cable-options">
                {CABLE_LENGTH_OPTIONS.map(v => <option key={v} value={v}/>)}
              </datalist>
              {showErr('cable_length') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.cable_length}</div>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="scm-delivery">납품일자 <span className="field__req">*</span></label>
              <input id="scm-delivery" type="date" className={`input ${showErr('delivery_date') ? 'input--error' : ''}`}
                     value={form.delivery_date} onChange={(e) => update('delivery_date', e.target.value)}/>
              {showErr('delivery_date') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.delivery_date}</div>}
            </div>

            <div className="field">
              <div className="field__label"><label>발주처 <span className="field__req">*</span></label></div>
              <div className="mgr-field">
                <ComboField
                  value={form.customer_name}
                  onChange={(v) => { update('customer_name', v); update('customer_manager', ''); refreshManagers(v); }}
                  options={masterCustomers}
                  placeholder="고객사명 입력 또는 선택"
                  ariaLabel="발주처"
                  error={showErr('customer_name')}
                  metaKey="last"/>
                <button type="button" className="btn btn--secondary mgr-field__manage"
                        onClick={() => setModal('add-customer')} title="신규 고객사 등록">
                  <Icon name="plus" size={13}/>
                </button>
              </div>
              {showErr('customer_name') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.customer_name}</div>}
            </div>

            <div className="field">
              <div className="field__label"><label>발주처 담당자 <span className="field__req">*</span></label></div>
              <div className="mgr-field">
                <ComboField
                  value={form.customer_manager}
                  onChange={(v) => update('customer_manager', v)}
                  options={managers}
                  placeholder={form.customer_name ? '담당자 선택 또는 입력' : '발주처를 먼저 선택하세요'}
                  ariaLabel="발주처 담당자"
                  error={showErr('customer_manager')}
                  displayKey="display"/>
                <button type="button" className="btn btn--secondary mgr-field__manage"
                        onClick={() => {
                          if (!form.customer_name) { window.actions.flashToast('발주처를 먼저 선택해 주세요', 'error'); return; }
                          setModal('mgr');
                        }} title="담당자 관리">
                  <Icon name="user" size={13}/>
                </button>
              </div>
              {showErr('customer_manager') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.customer_manager}</div>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="scm-mgr-phone">발주처 담당자 전화번호 <span className="field__req">*</span></label>
              <input id="scm-mgr-phone" type="tel" className={`input ${showErr('field_manager_phone') ? 'input--error' : ''}`}
                     style={{ fontFamily: 'var(--font-mono)' }} placeholder="010-0000-0000" autoComplete="tel"
                     value={form.field_manager_phone}
                     onChange={(e) => {
                       const d = String(e.target.value).replace(/\D/g, '').slice(0, 11);
                       const fmt = d.length < 4 ? d : d.length < 8 ? d.slice(0,3)+'-'+d.slice(3) : d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7);
                       update('field_manager_phone', fmt);
                     }}/>
              {showErr('field_manager_phone') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.field_manager_phone}</div>}
            </div>

            {isPublic && (
              <div className="field">
                <label className="field__label" htmlFor="scm-cpo">CPO 운영사</label>
                <BulkInlineCombo value={form.cpo_name} onChange={(v) => update('cpo_name', v)}
                  options={masterCpos.map(c => c.name)} placeholder="CPO 운영사"/>
              </div>
            )}

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label" htmlFor="scm-address">납품장소 (설치주소) <span className="field__req">*</span></label>
              <AddressField id="scm-address" value={form.install_address}
                onChange={(v) => update('install_address', v)} error={showErr('install_address')}/>
              <input className="input" style={{ marginTop: 6 }} placeholder="상세주소 (동·호수, 층수 등)"
                value={form.install_address_detail} onChange={(e) => update('install_address_detail', e.target.value)}/>
              {showErr('install_address') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.install_address}</div>}
            </div>

            {isPublic && (<>
              <div className="field">
                <label className="field__label" htmlFor="scm-station">충전소 ID <span className="field__req">*</span></label>
                <input id="scm-station" className={`input ${showErr('station_id') ? 'input--error' : ''}`}
                       style={{ fontFamily: 'var(--font-mono)' }} placeholder="예: CT3006"
                       value={form.station_id} onChange={(e) => update('station_id', e.target.value)}/>
                {showErr('station_id') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.station_id}</div>}
              </div>
              <div className="field">
                <label className="field__label" htmlFor="scm-charger">충전기 ID <span className="field__req">*</span></label>
                <input id="scm-charger" className={`input ${showErr('charger_no') ? 'input--error' : ''}`}
                       style={{ fontFamily: 'var(--font-mono)' }} placeholder="예: 01"
                       value={form.charger_no} onChange={(e) => update('charger_no', e.target.value)}/>
                {showErr('charger_no') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.charger_no}</div>}
              </div>
              <div className="field">
                <label className="field__label" htmlFor="scm-router">라우터 번호 <span className="field__req">*</span></label>
                <input id="scm-router" className={`input ${showErr('router_no') ? 'input--error' : ''}`}
                       style={{ fontFamily: 'var(--font-mono)' }} placeholder="RTR-2024-00001"
                       value={form.router_no} onChange={(e) => update('router_no', e.target.value)}/>
                {showErr('router_no') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.router_no}</div>}
              </div>
              <div className="field">
                <label className="field__label" htmlFor="scm-usim">USIM 번호 <span className="field__req">*</span></label>
                <input id="scm-usim" className={`input ${showErr('usim_no') ? 'input--error' : ''}`}
                       style={{ fontFamily: 'var(--font-mono)' }} placeholder="ICCID 19~20자리" maxLength={20} inputMode="numeric"
                       value={form.usim_no} onChange={(e) => update('usim_no', e.target.value.replace(/\D/g, ''))}/>
                {showErr('usim_no') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.usim_no}</div>}
              </div>
            </>)}
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>취소</button>
          <button className="btn btn--primary" onClick={submit}><Icon name="check" size={13}/> 저장</button>
        </div>
      </div>
      {modal === 'add-customer' && (
        <AddCustomerModal
          onClose={() => setModal(null)}
          onAdded={(name) => {
            setMasterCustomers(window.PMDB.getCustomers());
            update('customer_name', name);
            update('customer_manager', '');
            setModal(null);
          }}/>
      )}
      {modal === 'mgr' && (
        <ManagerManageModal
          customerName={form.customer_name}
          onClose={() => setModal(null)}
          onChanged={(picked) => {
            const list = refreshManagers(form.customer_name);
            if (picked) {
              const mgr = list.find(m => m.name === picked);
              update('customer_manager', mgr ? (mgr.display || mgr.name) : picked);
            }
          }}/>
      )}
    </div>
  );
}

window.ProductionWaitingScreen = ProductionWaitingScreen;
