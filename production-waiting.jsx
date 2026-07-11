// 생산대기 목록 — 4 view variants (Table / Card / Kanban / Timeline)

const { useState: useStatePW, useMemo: useMemoPW } = React;

const priorityBadge = (p) => {
  if (p === 'high') return <span className="badge badge--info"><Icon name="fire" size={10}/>긴급</span>;
  if (p === 'low')  return <span className="badge badge--neutral">낮음</span>;
  return null;
};

function daysUntil(date) {
  const today = new Date();
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

function deliveryHint(d) {
  const n = daysUntil(d);
  if (n <= 0) return { text: `D+${Math.abs(n)}`, color: 'var(--danger-700)', bg: 'var(--danger-50)' };
  else if (n <= 7) return { text: `D-${n}`, color: 'var(--danger-700)', bg: 'var(--danger-50)' };
  else if (n <= 14) return { text: `D-${n}`, color: 'var(--warning-700)', bg: 'var(--warning-50)' };
  return { text: `D-${n}`, color: 'var(--ink-3)', bg: 'var(--surface-3)' };
}

// 테이블·카드 뷰에서 생산대기/작업중/출하대기를 별도 섹션으로 분리 표시하기 위한 그룹 정의
const STATUS_GROUPS = [
  { key: 'PENDING', label: '생산대기', icon: 'package' },
  { key: 'IN_PROGRESS', label: '작업중', icon: 'factory' },
  { key: 'AWAIT_PICKUP', label: '출하대기', icon: 'truck' },
];

function groupOrdersByStatus(orders) {
  return STATUS_GROUPS
    .map(g => ({ ...g, items: orders.filter(o => o.status === g.key) }))
    .filter(g => g.items.length > 0);
}

function StatusGroupHead({ icon, label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span className="card__title" style={{ fontSize: 15 }}>
        <Icon name={icon} size={13}/>{label}
      </span>
      <span className="badge badge--neutral">{count}건</span>
    </div>
  );
}

function ProductionWaitingScreen() {
  const s = window.useStore();
  const [search, setSearch] = useStatePW('');
  const [filterModel, setFilterModel] = useStatePW('all');
  const [models, setModels] = useStatePW(() => window.PMDB.getModels());
  const [selectedIds, setSelectedIds] = useStatePW(() => new Set());

  React.useEffect(() => {
    const sync = () => setModels(window.PMDB.getModels());
    window.addEventListener('masterLoaded', sync);
    return () => window.removeEventListener('masterLoaded', sync);
  }, []);

  const filtered = useMemoPW(() => {
    return s.orders.filter(o => {
      if (o.status === 'COMPLETED') return false;
      if (filterModel !== 'all') {
        // model_name에 코드가 저장된 오더도 표시명 기준 필터에 매칭
        const mName = window.findModelInfo(o.model_name)?.model || o.model_name;
        if (mName !== filterModel) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!o.customer_name.toLowerCase().includes(q) &&
            !o.model_name.toLowerCase().includes(q) &&
            !o.station_id.toLowerCase().includes(q) &&
            !String(o.order_id).includes(q)) return false;
      }
      return true;
    });
  }, [s.orders, search, filterModel]);

  // s.orders에 의존 — search/filterModel 변경(키 입력)마다 재계산되지 않도록 filtered와 분리
  const editedIds = useMemoPW(() => {
    const set = new Set();
    s.orders.forEach(o => {
      if (o.status === 'COMPLETED') return;
      const hist = window.PMDB.getHistory(o.order_id) || [];
      if (hist.some(h => h.action !== 'create')) set.add(o.order_id);
    });
    return set;
  }, [s.orders]);

  const onPick = (id) => {
    const u = s.currentUser;
    if (u && u.role === 'sales') {
      // 영업: 생산대기 상태 오더만 수정 진입
      window.actions.editOrder(id);
      return;
    }
    window.actions.selectOrder(id);
    window.actions.setView('mapping');
  };

  const isSales = s.currentUser && s.currentUser.role === 'sales';

  // ── 다중선택 → 일괄 처리 (영업 역할 제외) ──────────────────────
  const selectableStatuses = useMemoPW(() => new Set(['PENDING', 'IN_PROGRESS']), []);
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

  const startBatch = () => {
    window.actions.startBatchMapping([...selectedIds]);
    setSelectedIds(new Set());
  };

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">생산 부서 · 생산대기 큐</div>
          <h1 className="screen__title">생산 대기 목록</h1>
          <p className="screen__sub">{isSales
            ? '영업 담당자는 생산대기 상태의 오더를 선택해 발주 정보를 수정할 수 있습니다.'
            : '영업에서 등록한 오더 중 생산 미완료 항목입니다. 카드를 선택하면 생산 입력 화면으로 이동합니다.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--secondary" onClick={() => window.actions.setView('sales')}>
            <Icon name="plus" size={13}/> 신규 오더
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
          {models.map(m => <option key={m.model} value={m.model}>{m.description || m.model}</option>)}
        </select>
        <button className={`toolbar__filter ${filterModel !== 'all' || search ? 'toolbar__filter--active' : ''}`}
                onClick={() => { setSearch(''); setFilterModel('all'); }}
                aria-label="필터 초기화">
          <Icon name="filter" size={12}/><span aria-hidden="true"> 초기화</span>
        </button>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', marginRight: 8 }}>
          <strong style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{filtered.length}</strong>건
        </span>
        <div className="toolbar__view">
          {[
            { k: 'kanban', label: '칸반', icon: 'columns' },
            { k: 'card', label: '카드', icon: 'grid' },
            { k: 'timeline', label: '타임라인', icon: 'timeline' },
            { k: 'table', label: '테이블', icon: 'table' },
          ].map((v) => (
            <button key={v.k}
                    className={`toolbar__view__btn ${s.waitingView === v.k ? 'toolbar__view__btn--active' : ''}`}
                    onClick={() => window.actions.setWaitingView(v.k)}
                    aria-label={v.label}
                    aria-pressed={s.waitingView === v.k}>
              <Icon name={v.icon} size={12}/><span aria-hidden="true"> {v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {!isSales && s.waitingView === 'table' && selectedIds.size > 0 && (
        <div className="toolbar" style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-700, var(--primary))' }}>
            <Icon name="check" size={13}/> {selectedIds.size}건 선택됨
            {selectionGroup && <span style={{ fontWeight: 400, color: 'var(--ink-3)', marginLeft: 6 }}>· {selectionGroup.model} / {selectionGroup.usage}</span>}
          </span>
          <div style={{ flex: 1 }}/>
          <button className="btn btn--ghost btn--sm" onClick={() => setSelectedIds(new Set())}>선택 해제</button>
          <button className="btn btn--primary btn--sm" onClick={startBatch}>
            <Icon name="copy" size={13}/> 선택 {selectedIds.size}건 일괄 처리
          </button>
        </div>
      )}

      <div key={s.waitingView} className="view-enter">
        {filtered.length === 0 ? (
          <div className="table-wrap">
            <div className="emptystate">
              <Icon name="package" size={28} stroke={1.2} style={{ color: 'var(--ink-5)' }} aria-hidden="true"/>
              {s.orders.filter(o => o.status !== 'COMPLETED').length === 0 ? (
                <>
                  <div className="emptystate__title">생산 대기 중인 오더가 없습니다</div>
                  <div className="emptystate__sub">영업 부서에서 오더를 등록하면 이 목록에 표시됩니다</div>
                  {isSales && (
                    <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => window.actions.setView('sales')}>
                      <Icon name="plus" size={13}/> 신규 오더 등록
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="emptystate__title">조건에 맞는 오더가 없습니다</div>
                  <div className="emptystate__sub">검색어 또는 필터를 변경해 보세요</div>
                  <button className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} onClick={() => { setSearch(''); setFilterModel('all'); }}>
                    필터 초기화
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {s.waitingView === 'table' && (
              <ViewTable orders={filtered} onPick={onPick} completingId={s.completingOrderId} editedIds={editedIds}
                selectable={!isSales} selectedIds={selectedIds} canSelect={canSelect} onToggleSelect={toggleSelect}/>
            )}
            {s.waitingView === 'card' && <ViewCards orders={filtered} onPick={onPick} completingId={s.completingOrderId} editedIds={editedIds}/>}
            {s.waitingView === 'kanban' && <ViewKanban orders={filtered} onPick={onPick} completingId={s.completingOrderId} editedIds={editedIds}/>}
            {s.waitingView === 'timeline' && <ViewTimeline orders={filtered} onPick={onPick} completingId={s.completingOrderId} editedIds={editedIds}/>}
          </>
        )}
      </div>
    </div>
  );
}

/* ────────── Table view ────────── */
function ViewTable({ orders, onPick, completingId, editedIds, selectable, selectedIds, canSelect, onToggleSelect }) {
  const groups = groupOrdersByStatus(orders);
  return (
    <>
      {groups.map((g, gi) => (
        <div key={g.key} style={{ marginTop: gi === 0 ? 0 : 20 }}>
          <StatusGroupHead icon={g.icon} label={g.label} count={g.items.length}/>
          <TableGroup orders={g.items} onPick={onPick} completingId={completingId} editedIds={editedIds}
            selectable={selectable} selectedIds={selectedIds} canSelect={canSelect} onToggleSelect={onToggleSelect}/>
        </div>
      ))}
    </>
  );
}

function TableGroup({ orders, onPick, completingId, editedIds, selectable, selectedIds, canSelect, onToggleSelect }) {
  return (
    <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table className="table" style={{ whiteSpace: 'nowrap' }}>
        <colgroup>
              {selectable && <col style={{ width: 40 }}/>}
              <col style={{ textAlign: 'left', width: 86 }}/>
              <col style={{ textAlign: 'left', width: 150 }}/>
              <col style={{ textAlign: 'left', width: 150 }}/>
              <col style={{ textAlign: 'left', width: 130 }}/>
              <col style={{ textAlign: 'left', width: 'auto' }}/>
              <col style={{ textAlign: 'left', width: 130 }}/>
              <col style={{ textAlign: 'left', width: 130 }}/>
              <col style={{ textAlign: 'left', width: 40 }}/>
          </colgroup>
        <thead>
          <tr>
            {selectable && <th scope="col"></th>}
            <th scope="col">오더 #</th>
            <th scope="col">고객사</th>
            <th scope="col">모델</th>
            <th scope="col">충전소 ID</th>
            <th scope="col">설치주소</th>
            <th scope="col">납품일</th>
            <th scope="col">상태</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => {
            const d = deliveryHint(o.delivery_date);
            const completing = completingId === o.order_id;
            const checked = selectable && selectedIds?.has(o.order_id);
            const selDisabled = selectable && !checked && canSelect && !canSelect(o);
            return (
              <tr key={o.order_id}
                  className={`row--clickable ${completing ? 'row--completing' : ''}`}
                  tabIndex={0}
                  onClick={() => onPick(o.order_id)}
                  onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick(o.order_id); } }}>
                {selectable && (
                  <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                    <input type="checkbox" aria-label={`오더 #${o.order_id} 일괄 처리 선택`}
                      checked={!!checked} disabled={selDisabled}
                      title={selDisabled ? '같은 모델·용도의 오더만 함께 선택할 수 있습니다' : ''}
                      onChange={() => onToggleSelect(o)}
                      style={{ width: 17, height: 17, accentColor: 'var(--primary)', cursor: selDisabled ? 'not-allowed' : 'pointer' }}/>
                  </td>
                )}
                <td className="cell-mono">#{o.order_id}</td>
                <td>
                  <div className="cell-strong">
                    {o.customer_name}
                    {editedIds.has(o.order_id) && <span className="badge badge--info" style={{ marginLeft: 6, fontSize: 10.5, verticalAlign: 'middle' }}>수정됨</span>}
                  </div>
                  <div className="cell-muted">접수 {o.created}</div>
                </td>
                <td><span className="badge badge--neutral">{o.model_name}</span></td>
                <td className="cell-mono">{o.station_id}</td>
                <td style={{ color: 'var(--ink-2)' }}>{o.install_address}</td>
                <td style={{ width: 130 }}>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{o.delivery_date}</div>
                  <span className="dday-badge" style={{ marginTop: 2, '--dday-color': d.color, '--dday-bg': d.bg }}>{d.text}</span>
                </td>
                <td style={{ width: 130 }}>
                  {o.status === 'PENDING' ? (
                    <span className={`badge badge--pending ${completing ? 'badge--statusswap' : ''}`}><span className="badge__dot"/>생산대기</span>
                  ) : o.status === 'IN_PROGRESS' ? (
                    <span className="badge badge--info"><span className="badge__dot"/>생산진행중</span>
                  ) : (
                    <span className="badge badge--complete badge--statusswap"><Icon name="check" size={10}/>출하대기</span>
                  )}
                </td>
                <td><Icon name="chevron-right" size={14} style={{ color: 'var(--ink-4)' }}/></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ────────── Card view ────────── */
function ViewCards({ orders, onPick, completingId, editedIds }) {
  const groups = groupOrdersByStatus(orders);
  return (
    <>
      {groups.map((g, gi) => (
        <div key={g.key} className="view-panel" style={{ marginTop: gi === 0 ? 0 : 20 }}>
          <StatusGroupHead icon={g.icon} label={g.label} count={g.items.length}/>
          <div className="gridcards">
            {g.items.map((o, idx) => {
              const d = deliveryHint(o.delivery_date);
              const completing = completingId === o.order_id;
              return (
                <div key={o.order_id}
                     style={{ '--i': idx }}
                     className={`ordercard ${completing ? 'row--completing' : ''}`}
                     role="button" tabIndex={0}
                     onClick={() => onPick(o.order_id)}
                     onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(o.order_id); } }}>
                  <div className="ordercard__top">
                    <span className="ordercard__id">#{o.order_id} · {o.created}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {editedIds.has(o.order_id) && <span className="badge badge--info" style={{ fontSize: 10.5 }}>수정됨</span>}
                      {priorityBadge(daysUntil(o.delivery_date) <= 7 ? 'high' : 'normal')}
                    </div>
                  </div>
                  <div>
                    <div className="ordercard__model">{o.model_name}</div>
                    <div className="ordercard__cust">{o.customer_name}</div>
                  </div>
                  <dl className="ordercard__rows">
                    <dt><Icon name="building" size={11}/></dt>
                    <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{o.station_id}</dd>
                    <dt><Icon name="map-pin" size={11}/></dt>
                    <dd style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.install_address}</dd>
                    <dt><Icon name="calendar" size={11}/></dt>
                    <dd style={{ fontVariantNumeric: 'tabular-nums' }}>{o.delivery_date}</dd>
                  </dl>
                  <div className="ordercard__foot">
                    <span className="dday-badge" style={{ '--dday-color': d.color, '--dday-bg': d.bg }}>{d.text}</span>
                    {o.status === 'PENDING' ? (
                      <span className={`badge badge--pending ${completing ? 'badge--statusswap' : ''}`}><span className="badge__dot"/>생산대기</span>
                    ) : o.status === 'IN_PROGRESS' ? (
                      <span className="badge badge--info"><span className="badge__dot"/>생산진행중</span>
                    ) : (
                      <span className="badge badge--complete badge--statusswap"><Icon name="check" size={10}/>출하대기</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/* ────────── Kanban view ────────── */
function ViewKanban({ orders, onPick, completingId, editedIds }) {
  const cols = [
    { id: 'fresh',      title: '신규 접수',      dot: 'var(--ink-4)',  filter: (o) => o.status === 'PENDING' && daysUntil(o.delivery_date) > 7 },
    { id: 'urgent',     title: '긴급 (D-7 이내)', dot: 'var(--danger)', filter: (o) => o.status === 'PENDING' && daysUntil(o.delivery_date) <= 7 },
    { id: 'inprogress', title: '작업중',          dot: 'var(--primary)',filter: (o) => o.status === 'IN_PROGRESS' },
    { id: 'done',       title: '출하대기',        dot: 'var(--success)',filter: (o) => o.status === 'AWAIT_PICKUP' },
  ];
  const hasInProgress = orders.some(o => o.status === 'IN_PROGRESS');
  const hasCompleted = orders.some(o => o.status === 'AWAIT_PICKUP');
  const visibleCols = [
    cols[0],
    cols[1],
    ...(hasInProgress ? [cols[2]] : []),
    ...(hasCompleted  ? [cols[3]] : []),
  ];

  return (
    <div className="view-panel">
    <div className="kanban-scroll">
    <div className="kanban" style={{ gridTemplateColumns: `repeat(${visibleCols.length}, minmax(180px, 1fr))` }}>
      {visibleCols.map(col => {
        const items = orders.filter(col.filter);
        return (
          <div key={col.id} className="kanban__col">
            <div className="kanban__colhead">
              <div className="kanban__colhead__title">
                <span className="kanban__dot" style={{ background: col.dot }}/>
                {col.title}
              </div>
              <span className="kanban__count">{items.length}</span>
            </div>
            {items.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>—</div>
            )}
            {items.map((o, idx) => {
              const d = deliveryHint(o.delivery_date);
              const completing = completingId === o.order_id;
              return (
                <div key={o.order_id}
                     style={{ '--i': idx }}
                     className={`kanban__card ${completing ? 'row--completing' : ''}`}
                     role="button" tabIndex={0}
                     onClick={() => onPick(o.order_id)}
                     onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(o.order_id); } }}>
                  <div className="kanban__card__top">
                    <span className="kanban__card__id">#{o.order_id}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {editedIds.has(o.order_id) && <span className="badge badge--info" style={{ fontSize: 10.5 }}>수정됨</span>}
                      {priorityBadge(daysUntil(o.delivery_date) <= 7 ? 'high' : 'normal')}
                    </div>
                  </div>
                  <div className="kanban__card__title">{o.model_name}</div>
                  <div className="kanban__card__sub">{o.customer_name}</div>
                  <div className="kanban__card__meta">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="calendar" size={11}/> <span style={{ fontVariantNumeric: 'tabular-nums' }}>{o.delivery_date}</span>
                    </span>
                    <span className="dday-badge" style={{ '--dday-color': d.color, '--dday-bg': d.bg }}>{d.text}</span>
                  </div>
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

/* ────────── Timeline view ────────── */
function ViewTimeline({ orders, onPick, completingId, editedIds }) {
  // Group by delivery date
  const groups = useMemoPW(() => {
    const g = {};
    orders.forEach(o => {
      if (!g[o.delivery_date]) g[o.delivery_date] = [];
      g[o.delivery_date].push(o);
    });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [orders]);

  const dayLabel = (d) => {
    const dt = new Date(d);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${days[dt.getDay()]})`;
  };

  return (
    <div className="timeline">
      {groups.map(([date, items]) => {
        const d = deliveryHint(date);
        return (
          <div key={date} className="timeline__day">
            <div className="timeline__date">
              <strong style={{ color: d.color }}>{date.slice(8)}</strong>
              <span>{dayLabel(date)}</span>
              <span className="dday-badge" style={{ marginTop: 4, alignSelf: 'flex-start', '--dday-color': d.color, '--dday-bg': d.bg }}>{d.text}</span>
            </div>
            <div className="timeline__items">
              {items.map((o, idx) => {
                const completing = completingId === o.order_id;
                return (
                  <div key={o.order_id}
                       style={{ '--i': idx }}
                       className={`timeline__item ${completing ? 'row--completing' : ''}`}
                       role="button" tabIndex={0}
                       onClick={() => onPick(o.order_id)}
                       onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(o.order_id); } }}>
                    <div className="timeline__item__main">
                      <div className="timeline__item__title">{o.customer_name} · {o.model_name}</div>
                      <div className="timeline__item__sub">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{o.station_id}</span>
                        <span style={{ margin: '0 6px', color: 'var(--ink-5)' }}>·</span>
                        {o.install_address.split(',')[0]}
                      </div>
                    </div>
                    <span className="cell-mono" style={{ color: 'var(--ink-4)' }}>#{o.order_id}</span>
                    {editedIds.has(o.order_id) && <span className="badge badge--info" style={{ fontSize: 10.5 }}>수정됨</span>}
                    {priorityBadge(daysUntil(o.delivery_date) <= 7 ? 'high' : 'normal') || <span style={{ width: 36 }}/>}
                    {o.status === 'PENDING' ? (
                      <span className={`badge badge--pending ${completing ? 'badge--statusswap' : ''}`}><span className="badge__dot"/>대기</span>
                    ) : o.status === 'IN_PROGRESS' ? (
                      <span className="badge badge--info"><span className="badge__dot"/>진행중</span>
                    ) : (
                      <span className="badge badge--complete badge--statusswap"><Icon name="check" size={10}/>완료</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

window.ProductionWaitingScreen = ProductionWaitingScreen;
