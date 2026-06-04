// 생산대기 목록 — 4 view variants (Table / Card / Kanban / Timeline)

const { useState: useStatePW, useMemo: useMemoPW } = React;

const priorityBadge = (p) => {
  if (p === 'high') return <span className="badge badge--info"><Icon name="fire" size={10}/>긴급</span>;
  if (p === 'low')  return <span className="badge badge--neutral">낮음</span>;
  return null;
};

function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

function deliveryHint(d) {
  const n = daysUntil(d);
  if (n <= 7) return { text: `D-${n}`, color: 'var(--danger-700)', bg: 'var(--danger-50)' };
  if (n <= 14) return { text: `D-${n}`, color: 'var(--warning-700)', bg: 'var(--warning-50)' };
  return { text: `D-${n}`, color: 'var(--ink-3)', bg: 'var(--surface-3)' };
}

function ProductionWaitingScreen() {
  const s = window.useStore();
  const [search, setSearch] = useStatePW('');
  const [filterModel, setFilterModel] = useStatePW('all');

  const filtered = useMemoPW(() => {
    return s.orders.filter(o => {
      if (filterModel !== 'all' && o.model_name !== filterModel) return false;
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

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">생산 부서 · 생산대기 큐</div>
          <h1 className="screen__title">생산 대기 목록</h1>
          <p className="screen__sub">{isSales
            ? '영업 담당자는 생산대기 상태의 오더를 선택해 발주 정보를 수정할 수 있습니다.'
            : '영업에서 등록한 오더 중 생산 미완료 항목입니다. 카드를 선택하면 생산 매핑 화면으로 이동합니다.'}</p>
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
          <input className="input" placeholder="고객사 · 모델 · 충전소 ID · 오더번호 검색"
                 value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <select className="select" style={{ width: 160, height: 34 }}
                value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
          <option value="all">모델 전체</option>
          {window.MASTER.MODELS.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
        </select>
        <button className={`toolbar__filter ${filterModel !== 'all' || search ? 'toolbar__filter--active' : ''}`}
                onClick={() => { setSearch(''); setFilterModel('all'); }}>
          <Icon name="filter" size={12}/> 초기화
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
                    onClick={() => window.actions.setWaitingView(v.k)}>
              <Icon name={v.icon} size={12}/> {v.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="table-wrap">
          <div className="emptystate">
            <Icon name="package" size={28} stroke={1.2} style={{ color: 'var(--ink-5)' }}/>
            <div className="emptystate__title">조건에 맞는 오더가 없습니다</div>
            <div className="emptystate__sub">검색어 또는 필터를 변경해 보세요</div>
          </div>
        </div>
      ) : (
        <>
          {s.waitingView === 'table' && <ViewTable orders={filtered} onPick={onPick} completingId={s.completingOrderId}/>}
          {s.waitingView === 'card' && <ViewCards orders={filtered} onPick={onPick} completingId={s.completingOrderId}/>}
          {s.waitingView === 'kanban' && <ViewKanban orders={filtered} onPick={onPick} completingId={s.completingOrderId}/>}
          {s.waitingView === 'timeline' && <ViewTimeline orders={filtered} onPick={onPick} completingId={s.completingOrderId}/>}
        </>
      )}
    </div>
  );
}

/* ────────── Table view ────────── */
function ViewTable({ orders, onPick, completingId }) {
  return (
    <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table className="table" style={{ minWidth: 700 }}>
        <thead>
          <tr>
            <th style={{ width: 80 }}>오더 #</th>
            <th>고객사</th>
            <th>모델</th>
            <th>충전소 ID</th>
            <th>설치주소</th>
            <th>납품일</th>
            <th>상태</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => {
            const d = deliveryHint(o.delivery_date);
            const completing = completingId === o.order_id;
            return (
              <tr key={o.order_id}
                  className={`row--clickable ${completing ? 'row--completing' : ''}`}
                  onClick={() => onPick(o.order_id)}>
                <td className="cell-mono">#{o.order_id}</td>
                <td>
                  <div className="cell-strong">{o.customer_name}</div>
                  <div className="cell-muted">접수 {o.created}</div>
                </td>
                <td><span className="badge badge--neutral">{o.model_name}</span></td>
                <td className="cell-mono">{o.station_id}</td>
                <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>{o.install_address}</td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{o.delivery_date}</div>
                  <span style={{ display: 'inline-block', marginTop: 2, fontSize: 11, padding: '1px 7px', borderRadius: 999, color: d.color, background: d.bg, fontWeight: 600 }}>{d.text}</span>
                </td>
                <td>
                  {o.status === 'PENDING' ? (
                    <span className={`badge badge--pending ${completing ? 'badge--statusswap' : ''}`}><span className="badge__dot"/>생산대기</span>
                  ) : o.status === 'IN_PROGRESS' ? (
                    <span className="badge badge--info"><span className="badge__dot"/>생산진행중</span>
                  ) : (
                    <span className="badge badge--complete badge--statusswap"><Icon name="check" size={10}/>생산완료</span>
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
function ViewCards({ orders, onPick, completingId }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="gridcards">
        {orders.map(o => {
          const d = deliveryHint(o.delivery_date);
          const completing = completingId === o.order_id;
          return (
            <div key={o.order_id}
                 className={`ordercard ${completing ? 'row--completing' : ''}`}
                 onClick={() => onPick(o.order_id)}>
              <div className="ordercard__top">
                <span className="ordercard__id">#{o.order_id} · {o.created}</span>
                {priorityBadge(daysUntil(o.delivery_date) <= 7 ? 'high' : 'normal')}
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
                <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 999, color: d.color, background: d.bg, fontWeight: 600 }}>{d.text}</span>
                {o.status === 'PENDING' ? (
                  <span className={`badge badge--pending ${completing ? 'badge--statusswap' : ''}`}><span className="badge__dot"/>생산대기</span>
                ) : o.status === 'IN_PROGRESS' ? (
                  <span className="badge badge--info"><span className="badge__dot"/>생산진행중</span>
                ) : (
                  <span className="badge badge--complete badge--statusswap"><Icon name="check" size={10}/>생산완료</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────── Kanban view ────────── */
function ViewKanban({ orders, onPick, completingId }) {
  const cols = [
    { id: 'fresh',      title: '신규 접수',      dot: 'var(--ink-4)',  filter: (o) => o.status === 'PENDING' && daysUntil(o.delivery_date) > 7 },
    { id: 'urgent',     title: '긴급 (D-7 이내)', dot: 'var(--danger)', filter: (o) => o.status === 'PENDING' && daysUntil(o.delivery_date) <= 7 },
    { id: 'inprogress', title: '작업중',          dot: 'var(--primary)',filter: (o) => o.status === 'IN_PROGRESS' },
    { id: 'done',       title: '생산완료',        dot: 'var(--success)',filter: (o) => o.status === 'COMPLETED' },
  ];
  const hasInProgress = orders.some(o => o.status === 'IN_PROGRESS');
  const hasCompleted = orders.some(o => o.status === 'COMPLETED');
  const visibleCols = [
    cols[0],
    cols[1],
    ...(hasInProgress ? [cols[2]] : []),
    ...(hasCompleted  ? [cols[3]] : []),
  ];

  return (
    <div className="kanban-scroll" style={{ marginTop: 16 }}>
    <div className="kanban" style={{ gridTemplateColumns: `repeat(${visibleCols.length}, 260px)` }}>
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
            {items.map(o => {
              const d = deliveryHint(o.delivery_date);
              const completing = completingId === o.order_id;
              return (
                <div key={o.order_id}
                     className={`kanban__card ${completing ? 'row--completing' : ''}`}
                     onClick={() => onPick(o.order_id)}>
                  <div className="kanban__card__top">
                    <span className="kanban__card__id">#{o.order_id}</span>
                    {priorityBadge(daysUntil(o.delivery_date) <= 7 ? 'high' : 'normal')}
                  </div>
                  <div className="kanban__card__title">{o.model_name}</div>
                  <div className="kanban__card__sub">{o.customer_name}</div>
                  <div className="kanban__card__meta">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="calendar" size={11}/> <span style={{ fontVariantNumeric: 'tabular-nums' }}>{o.delivery_date}</span>
                    </span>
                    <span style={{ padding: '1px 7px', borderRadius: 999, color: d.color, background: d.bg, fontWeight: 600 }}>{d.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
    </div>
  );
}

/* ────────── Timeline view ────────── */
function ViewTimeline({ orders, onPick, completingId }) {
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
              <span style={{ marginTop: 4, fontSize: 11, padding: '1px 7px', borderRadius: 999, color: d.color, background: d.bg, fontWeight: 600, alignSelf: 'flex-start' }}>{d.text}</span>
            </div>
            <div className="timeline__items">
              {items.map(o => {
                const completing = completingId === o.order_id;
                return (
                  <div key={o.order_id}
                       className={`timeline__item ${completing ? 'row--completing' : ''}`}
                       onClick={() => onPick(o.order_id)}>
                    <div className="timeline__item__main">
                      <div className="timeline__item__title">{o.customer_name} · {o.model_name}</div>
                      <div className="timeline__item__sub">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{o.station_id}</span>
                        <span style={{ margin: '0 6px', color: 'var(--ink-5)' }}>·</span>
                        {o.install_address.split(',')[0]}
                      </div>
                    </div>
                    <span className="cell-mono" style={{ color: 'var(--ink-4)' }}>#{o.order_id}</span>
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
