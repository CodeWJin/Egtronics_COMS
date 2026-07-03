// 통합 조회 화면 — 전체 오더 검색 + 우측 상세 드로어

const { useState: useStateOL, useMemo: useMemoOL } = React;

function safeLoadAsReceptions() {
  try { return window.PMDB.loadAsReceptions() || []; } catch(_) { return []; }
}

function statusBadge(o) {
  if (o.status === 'COMPLETED')    return <span className="badge badge--complete"><Icon name="check" size={10}/>출하완료</span>;
  if (o.status === 'AWAIT_PICKUP') return <span className="badge badge--progress"><Icon name="truck" size={10}/>출하대기</span>;
  if (o.status === 'IN_PROGRESS')  return <span className="badge badge--info"><span className="badge__dot"/>생산진행중</span>;
  return <span className="badge badge--pending"><span className="badge__dot"/>생산대기</span>;
}

function OrderLookupScreen() {
  const s = window.useStore();
  const [search, setSearch] = useStateOL('');
  const fStatus = 'COMPLETED';
  const [fModel, setFModel] = useStateOL('all');
  const [models, setModels] = useStateOL(() => window.PMDB.getModels());

  React.useEffect(() => {
    const sync = () => setModels(window.PMDB.getModels());
    window.addEventListener('masterLoaded', sync);
    return () => window.removeEventListener('masterLoaded', sync);
  }, []);
  const [fCustomer, setFCustomer] = useStateOL('all');
  const [dateField, setDateField] = useStateOL('delivery'); // 'delivery' | 'prod'
  const [dateFrom, setDateFrom] = useStateOL('');
  const [dateTo, setDateTo] = useStateOL('');
  const [selId, setSelId] = useStateOL(null);
  const [sortKey, setSortKey] = useStateOL('order_id');
  const [sortDir, setSortDir] = useStateOL('desc');
  const [fAsOnly, setFAsOnly] = useStateOL(false);
  const [showAdvanced, setShowAdvanced] = useStateOL(false);

  const customers = useMemoOL(() => [...new Set(s.orders.map(o => o.customer_name))], [s.orders]);
  const modelMap  = useMemoOL(() => { const m = {}; models.forEach(mdl => { m[mdl.name] = mdl; }); return m; }, [models]);

  const dateRangeErr = dateFrom && dateTo && dateTo < dateFrom;
  const activeFilters = (fModel !== 'all') + (fCustomer !== 'all') + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (search ? 1 : 0) + (fAsOnly ? 1 : 0);

  const filtered = useMemoOL(() => {
    const allReceptions = fAsOnly ? safeLoadAsReceptions() : [];
    let list = s.orders.filter(o => {
      if (fStatus !== 'all' && o.status !== fStatus) return false;
      if (fModel !== 'all' && o.model_name !== fModel) return false;
      if (fCustomer !== 'all' && o.customer_name !== fCustomer) return false;
      const dv = dateField === 'prod' ? (o.production && o.production.prod_date) : o.delivery_date;
      if (dateFrom && (!dv || dv < dateFrom)) return false;
      if (dateTo && (!dv || dv > dateTo)) return false;
      if (fAsOnly && !allReceptions.some(r => r.order_id === o.order_id)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [o.customer_name, o.model_name, o.station_id, o.router_no, o.usim_no, o.install_address, String(o.order_id),
          o.production && o.production.serial_no, o.production && o.production.lot_no, o.production && o.production.doc_no,
          o.production && o.production.doc_no && '기능검사성적서',
          o.production && o.production.doc_no && '출하검사성적서']
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      let av, bv;
      if (sortKey === 'order_id') { av = a.order_id; bv = b.order_id; }
      else if (sortKey === 'delivery_date') { av = a.delivery_date; bv = b.delivery_date; }
      else if (sortKey === 'customer_name') { av = a.customer_name; bv = b.customer_name; }
      else { av = a.status; bv = b.status; }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [s.orders, search, fStatus, fModel, fCustomer, dateField, dateFrom, dateTo, sortKey, sortDir, fAsOnly]);

  const reset = () => {
    setSearch(''); setFModel('all'); setFCustomer('all');
    setDateFrom(''); setDateTo(''); setDateField('delivery'); setFAsOnly(false);
  };

  const toggleSort = (k) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  const sortArrow = (k) => sortKey === k
    ? <Icon name={sortDir === 'asc' ? 'chevron-up' : 'chevron-down'} size={11} aria-hidden="true"/>
    : null;

  const selected = s.orders.find(o => o.order_id === selId);

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">통합 조회 · 전체 오더</div>
          <h1 className="screen__title">오더 통합 조회</h1>
          <p className="screen__sub">영업·생산 전 과정의 오더를 한 곳에서 검색합니다. 행을 선택하면 우측에 전체 상세가 열립니다.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span className="badge badge--complete" style={{ fontSize: 11 }}><Icon name="check" size={10}/>출하완료 오더만 표시</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            총 <strong style={{ color: 'var(--success-700)' }}>{s.orders.filter(o => o.status === 'COMPLETED').length}</strong>건
          </span>
        </div>
      </div>

      {/* Filter panel */}
      <div className="card" style={{ marginBottom: 16, borderRadius: 'var(--r-xl)' }}>
        <div className="card__body" style={{ padding: '16px 18px' }}>
          {/* 헤더 행 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Icon name="search" size={14} style={{ color: 'var(--ink-3)' }}/>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>검색</span>
            {activeFilters > 0 && (
              <span className="badge badge--info" style={{ marginLeft: 2 }}>{activeFilters}개 필터 적용</span>
            )}
            <div style={{ flex: 1 }}/>
            <button
              className="btn btn--ghost btn--sm"
              style={{ fontSize: 12 }}
              onClick={() => setShowAdvanced(v => !v)}
              aria-expanded={showAdvanced}
              aria-controls="ol-advanced-filters"
            >
              <Icon name={showAdvanced ? 'chevron-up' : 'sliders'} size={12}/>
              {showAdvanced ? '필터 접기' : `고급 필터${activeFilters > 0 ? ` (${activeFilters})` : ''}`}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={reset} disabled={activeFilters === 0}
                    style={{ fontSize: 12 }}>
              <Icon name="refresh" size={12}/> 초기화
            </button>
          </div>

          {/* 항상 표시: 통합 검색 */}
          <input id="ol-search" className="input" placeholder="고객사 · 충전소ID · 시리얼 · 주소 · 납품일 …"
                 value={search} onChange={(e) => setSearch(e.target.value)}
                 aria-label="통합 검색"/>

          {/* 고급 필터 — 접기/펼치기 */}
          {showAdvanced && (
            <div id="ol-advanced-filters" style={{ marginTop: 14 }}>
              <div className="filter-grid">
                <div className="field">
                  <label className="field__label" htmlFor="ol-model">모델</label>
                  <select id="ol-model" className="select" value={fModel} onChange={(e) => setFModel(e.target.value)}>
                    <option value="all">모델 전체</option>
                    {models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="ol-customer">고객사</label>
                  <select id="ol-customer" className="select" value={fCustomer} onChange={(e) => setFCustomer(e.target.value)}>
                    <option value="all">고객사 전체</option>
                    {customers.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="ol-date-field">기간 기준</label>
                  <select id="ol-date-field" className="select" value={dateField} onChange={(e) => setDateField(e.target.value)}>
                    <option value="delivery">납품일자</option>
                    <option value="prod">생산일자</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="ol-date-from">시작일</label>
                  <input id="ol-date-from" type="date" className="input"
                         style={dateRangeErr ? { borderColor: 'var(--danger)' } : {}}
                         value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}/>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="ol-date-to">종료일</label>
                  <input id="ol-date-to" type="date" className="input"
                         style={dateRangeErr ? { borderColor: 'var(--danger)' } : {}}
                         value={dateTo} onChange={(e) => setDateTo(e.target.value)}/>
                  {dateRangeErr && (
                    <span className="field__err" role="alert"><Icon name="x" size={11}/>종료일이 시작일보다 앞입니다</span>
                  )}
                </div>
                <div className="field" style={{ justifyContent: 'flex-end' }}>
                  <div className="field__label">A/S 필터</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, cursor: 'pointer',
                                  padding: '0 12px', border: '1px solid var(--border-1)', borderRadius: 'var(--r-md)',
                                  background: fAsOnly ? 'var(--warning-50)' : 'var(--surface)',
                                  color: fAsOnly ? 'var(--warning-700)' : 'var(--ink-2)', fontSize: 13.5 }}>
                    <input type="checkbox" checked={fAsOnly} onChange={e => setFAsOnly(e.target.checked)}
                           style={{ accentColor: 'var(--warning-700)', width: 15, height: 15 }}/>
                    A/S 이력 있는 오더만
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 활성 필터 칩 — 검색어 제외 고급 필터가 적용된 경우 */}
          {(fModel !== 'all' || fCustomer !== 'all' || dateFrom || dateTo || fAsOnly) && (
            <div className="chips" style={{ marginTop: 10 }}>
              {fModel !== 'all' && (
                <button type="button" className="chip chip--active" onClick={() => setFModel('all')}
                        style={{ fontSize: 12, padding: '4px 10px' }}>
                  모델: {fModel} <span style={{ marginLeft: 4, opacity: 0.7 }}>×</span>
                </button>
              )}
              {fCustomer !== 'all' && (
                <button type="button" className="chip chip--active" onClick={() => setFCustomer('all')}
                        style={{ fontSize: 12, padding: '4px 10px' }}>
                  고객사: {fCustomer} <span style={{ marginLeft: 4, opacity: 0.7 }}>×</span>
                </button>
              )}
              {(dateFrom || dateTo) && (
                <button type="button" className="chip chip--active"
                        onClick={() => { setDateFrom(''); setDateTo(''); }}
                        style={{ fontSize: 12, padding: '4px 10px' }}>
                  {dateField === 'delivery' ? '납품일' : '생산일'}: {dateFrom || '—'} ~ {dateTo || '—'} <span style={{ marginLeft: 4, opacity: 0.7 }}>×</span>
                </button>
              )}
              {fAsOnly && (
                <button type="button" className="chip chip--active" onClick={() => setFAsOnly(false)}
                        style={{ fontSize: 12, padding: '4px 10px' }}>
                  A/S 이력 있는 오더 <span style={{ marginLeft: 4, opacity: 0.7 }}>×</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="toolbar" style={{ borderRadius: 'var(--r-xl) var(--r-xl) 0 0' }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
          검색 결과 <strong style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{filtered.length}</strong>건
        </span>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>행을 클릭하면 상세 정보가 열립니다</span>
      </div>

      {filtered.length === 0 ? (
        <div className="table-wrap">
          <div className="emptystate">
            <Icon name="search" size={28} stroke={1.2} style={{ color: 'var(--ink-5)' }}/>
            <div className="emptystate__title">조건에 맞는 오더가 없습니다</div>
            <div className="emptystate__sub">검색어 또는 필터를 조정해 보세요</div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table" style={{ tableLayout: 'fixed', width: '100%', minWidth: 860, textAlign: 'left', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: 76 }}/>
              <col style={{ width: 130 }}/>
              <col style={{ width: 220 }}/>
              <col style={{ width: 150 }}/>
              <col style={{ width: 100 }}/>
              <col style={{ width: 100 }}/>
              <col style={{ width: 40 }}/>
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="th--sort"
                    aria-sort={sortKey === 'order_id' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => toggleSort('order_id')}>오더 #{sortArrow('order_id')}</th>
                <th scope="col" className="th--sort"
                    aria-sort={sortKey === 'customer_name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => toggleSort('customer_name')}>고객사{sortArrow('customer_name')}</th>
                <th scope="col">모델</th>
                <th scope="col">충전소 ID</th>
                <th scope="col" className="th--sort"
                    aria-sort={sortKey === 'delivery_date' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => toggleSort('delivery_date')}>납품일{sortArrow('delivery_date')}</th>
                <th scope="col">생산일</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.order_id}
                    className={`row--clickable ${o.order_id === selId ? 'row--selected' : ''}`}
                    tabIndex={0}
                    onClick={() => setSelId(o.order_id)}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelId(o.order_id)}>
                  <td className="cell-mono">#{o.order_id}</td>
                  <td>
                    <div className="cell-strong">{o.customer_name}</div>
                    <div className="cell-muted">접수 {o.created}</div>
                  </td>
                  <td>
                    <span className="badge badge--neutral" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.3px' }}>
                      {modelMap[o.model_name]?.model || o.model_name}
                    </span>
                    {modelMap[o.model_name]?.model && (
                      <div className="cell-muted" style={{ fontSize: 11, marginTop: 2 }}>{o.model_name}</div>
                    )}
                  </td>
                  <td className="cell-mono">{o.station_id}</td>
                  <td style={{ textAlign: 'left', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{o.delivery_date}</td>
                  <td style={{ textAlign: 'left', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--ink-3)' }}>
                    {o.production ? o.production.prod_date : <span style={{ color: 'var(--ink-5)' }}>—</span>}
                  </td>
                  <td><Icon name="chevron-right" size={14} style={{ color: 'var(--ink-4)' }}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <OrderDrawer order={selected} onClose={() => setSelId(null)}/>}
    </div>
  );
}

function OrderHistorySection({ orderId }) {
  const list = React.useMemo(() => {
    try { return window.PMDB.getHistory(orderId) || []; } catch(_) { return []; }
  }, [orderId]);

  return (
    <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
          <Icon name="timeline" size={16} style={{ color: 'var(--ink-2)' }}/>
        </div>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>오더 변경 이력</span>
        {list.length > 0 && <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{list.length}건</span>}
      </div>
      {list.length === 0 ? (
        <div className="emptystate" style={{ padding: '14px 0' }}>
          <div className="emptystate__title" style={{ fontSize: 13 }}>변경 이력이 없습니다</div>
        </div>
      ) : list.map((r, i) => (
        <div key={r.history_id} style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary-600)', flexShrink: 0 }}/>
            {i < list.length - 1 && (
              <div style={{ width: 1, flex: 1, minHeight: 18, background: 'var(--border-1)', margin: '4px 0' }}/>
            )}
          </div>
          <div style={{ flex: 1, paddingBottom: i < list.length - 1 ? 10 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="badge badge--info" style={{ fontSize: 11 }}>{r.action || 'update'}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{r.changed_at}</span>
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{r.changed_by}</span>
            </div>
            {Array.isArray(r.changed_fields) && r.changed_fields.length > 0 && (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-sm)', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid var(--border-1)' }}>
                {r.changed_fields.map((f, fi) => (
                  <div key={fi} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--ink-3)', flexShrink: 0, minWidth: 80 }}>{f.label || f.field}</span>
                    {r.action === 'create' ? (
                      <span style={{ color: 'var(--ink-1)', fontWeight: 500 }}>{f.after || '—'}</span>
                    ) : (
                      <>
                        <span style={{ color: 'var(--ink-4)', textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>{f.before || '—'}</span>
                        <span style={{ color: 'var(--ink-4)' }}>→</span>
                        <span style={{ color: 'var(--ink-1)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{f.after || '—'}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

function AsReceptionCard({ reception: r }) {
  const logs = React.useMemo(() => window.PMDB.getAsLogs(r.id), [r.id]);

  const statusStyle = {
    '접수대기':   { bg: 'var(--surface-2)',  fg: 'var(--ink-3)',       cls: 'badge--neutral' },
    '담당자배정': { bg: 'var(--primary-50)', fg: 'var(--primary-600)', cls: 'badge--info' },
    '처리중':     { bg: 'var(--warning-50)', fg: 'var(--warning-700)', cls: 'badge--pending' },
    '처리완료':   { bg: 'var(--success-50)', fg: 'var(--success-700)', cls: 'badge--complete' },
  }[r.status] || { bg: 'var(--surface-2)', fg: 'var(--ink-3)', cls: 'badge--neutral' };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-1)', borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ background: statusStyle.bg, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.2px' }}>{r.reception_no}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {r.priority && r.priority !== '일반' && (
            <span className="badge badge--pending">{r.priority}</span>
          )}
          <span className={`badge ${statusStyle.cls}`}>{r.status}</span>
        </div>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px' }}>
          {r.fault_type && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>고장유형</div>
              <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>{r.fault_type}</div>
            </div>
          )}
          {r.received_at && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>접수일</div>
              <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{r.received_at.slice(0, 10)}</div>
            </div>
          )}
          {r.reporter_name && (
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>신고자</div>
              <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>{r.reporter_name}{r.reporter_phone ? ` · ${r.reporter_phone}` : ''}</div>
            </div>
          )}
          {r.assignee && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>담당자</div>
              <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>{r.assignee}</div>
            </div>
          )}
          {r.dispatch_date && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>출동일</div>
              <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{r.dispatch_date}</div>
            </div>
          )}
          {r.action_type && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>처리유형</div>
              <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>{r.action_type}</div>
            </div>
          )}
          {r.cost && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>비용</div>
              <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>{r.cost}</div>
            </div>
          )}
          {r.action_detail && (
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>처리내용</div>
              <div style={{ fontSize: 13, color: 'var(--ink-1)' }}>{r.action_detail}</div>
            </div>
          )}
          {r.notes && (
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>비고</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{r.notes}</div>
            </div>
          )}
        </div>
        {logs.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: 8, marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6 }}>처리 이력</div>
            {logs.map(l => (
              <div key={l.id} style={{ display: 'flex', gap: 8, fontSize: 11.5, padding: '3px 0', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', flexShrink: 0, minWidth: 72 }}>{(l.changed_at || '').slice(0, 10)}</span>
                <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{l.from_status || '—'} → {l.to_status || '—'}</span>
                {l.memo && <span style={{ color: 'var(--ink-2)' }}>{l.memo}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AsReceptionSection({ orderId }) {
  const receptions = React.useMemo(
    () => safeLoadAsReceptions().filter(r => r.order_id === orderId),
    [orderId]
  );

  return (
    <section style={{ background: 'var(--warning-50)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
          <Icon name="list" size={16} style={{ color: 'var(--warning-700)' }}/>
        </div>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>A/S 접수 현황</span>
        {receptions.length > 0 && <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{receptions.length}건</span>}
      </div>
      {receptions.length === 0 ? (
        <div className="emptystate" style={{ padding: '14px 0' }}>
          <div className="emptystate__title" style={{ fontSize: 13 }}>등록된 A/S 접수가 없습니다</div>
        </div>
      ) : (
        receptions.map(r => <AsReceptionCard key={r.id} reception={r}/>)
      )}
    </section>
  );
}

/* ────────── Right detail drawer ────────── */
function OrderDrawer({ order, onClose }) {
  const [closing, setClosing] = React.useState(false);
  const [funcInspection, setFuncInspectionState] = React.useState(() => window.getFuncInspection?.(order.order_id) ?? null);
  const [shipInspection, setShipInspectionState] = React.useState(() => window.getShipInspection?.(order.order_id) ?? null);
  const [shipPhotos, setShipPhotosState] = React.useState(() => {
    try { return window.PMDB?.getShipPhotos?.(order.order_id) || []; } catch (_) { return []; }
  });
  const [shipPhotoLightbox, setShipPhotoLightbox] = React.useState(null);
  const shipPhotoLightboxRef = React.useRef(null);
  React.useEffect(() => {
    if (shipPhotoLightbox !== null && shipPhotoLightboxRef.current) {
      shipPhotoLightboxRef.current.focus();
    }
  }, [shipPhotoLightbox]);

  // DB 로드 완료 후 검사 데이터 재조회 (loadAll 비동기 완료 전 마운트 시 초기값이 null일 수 있음)
  React.useEffect(() => {
    const sync = () => {
      setFuncInspectionState(window.getFuncInspection?.(order.order_id) ?? null);
      setShipInspectionState(window.getShipInspection?.(order.order_id) ?? null);
      setShipPhotosState(window.PMDB?.getShipPhotos?.(order.order_id) || []);
    };
    sync();
    window.addEventListener('masterLoaded', sync);
    return () => window.removeEventListener('masterLoaded', sync);
  }, [order.order_id]);

  const [funcDrawerOpen, setFuncDrawerOpen] = React.useState(false);
  const [funcReportVisible, setFuncReportVisible] = React.useState(false);
  const [shipDrawerOpen, setShipDrawerOpen] = React.useState(false);
  const [shipReportVisible, setShipReportVisible] = React.useState(false);
  const handleClose = React.useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  window.useLockScroll();

  React.useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [handleClose]);

  const p = order.production;
  const modelObj = React.useMemo(() => {
    const ms = window.PMDB?.getModels?.() || [];
    return ms.find(m => m.name === order.model_name) || null;
  }, [order.model_name]);
  const s = window.useStore();
  const role = s.currentUser ? s.currentUser.role : null;

  const managerDisplay = React.useMemo(() => {
    const name = order.customer_manager;
    if (!name) return '—';
    if (name.includes('(')) return name; // 이미 "이름 (전화번호)" 형식
    const mgrs = window.PMDB.getManagers ? window.PMDB.getManagers(order.customer_name) : [];
    const mgr = mgrs.find(m => m.name === name);
    return mgr && mgr.phone ? `${mgr.name} (${mgr.phone})` : name;
  }, [order.customer_manager, order.customer_name]);
  const canMap = role === 'production' || role === 'admin';
  const canEditSales = (role === 'sales' || role === 'admin') && order.status === 'PENDING';
  const goMapping = () => { window.actions.selectOrder(order.order_id); window.actions.setView('mapping'); };
  const goEdit = () => { window.actions.editOrder(order.order_id); handleClose(); };
  return ReactDOM.createPortal(
    <>
      <div className={`drawer-backdrop${closing ? ' drawer-backdrop--closing' : ''}`} onClick={handleClose}/>
      <aside className={`drawer${closing ? ' drawer--closing' : ''}`} role="dialog" aria-modal="true" aria-label="오더 상세">
        <div className="drawer__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="drawer__eyebrow">{order.customer_name} · 접수 {order.created}</div>
            <div className="drawer__title" style={{ margin: '5px 0 10px' }}>오더 #{order.order_id}</div>
            {statusBadge(order)}
          </div>
          <button className="drawer__close" onClick={handleClose} aria-label="닫기"><Icon name="x" size={16}/></button>
        </div>

        <div className="drawer__body">
          <section style={{ background: 'var(--primary-50)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
                <Icon name="cart" size={16} style={{ color: 'var(--primary-600)' }}/>
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>영업 입력 정보</span>
            </div>
            <div className="dgrid">
              <Field k="모델 코드" v={modelObj?.model || '—'} mono/>
              <Field k="모델명" v={order.model_name}/>
              <Field k="케이블 길이" v={order.cable_length}/>
              <Field k="담당자" v={managerDisplay}/>
              <Field k="납품일자" v={order.delivery_date} mono/>
              <Field k="충전소 ID" v={order.station_id} mono/>
              <Field k="라우터 S/N" v={order.router_no} mono/>
              <Field k="USIM (ICCID)" v={order.usim_no} mono full/>
              <Field k="설치주소" v={order.install_address} full/>
              {(order.field_manager_name || order.field_manager_phone) && (
                <Field k="현장담당자"
                       v={[order.field_manager_name, order.field_manager_phone].filter(Boolean).join(' · ')}
                       full/>
              )}
            </div>
          </section>

          <section style={{ background: 'var(--success-50)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
                <Icon name="factory" size={16} style={{ color: 'var(--success-700)' }}/>
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>생산 실적 정보</span>
            </div>
            {p ? (
              <div className="dgrid">
                <Field k="생산일자" v={p.prod_date}/>
                <Field k="검정일자" v={p.inspection_date}/>
                <Field k="로트번호" v={p.lot_no} mono/>
                <Field k="시리얼" v={p.serial_no} mono/>
                <Field k="S/W 버전" v={p.sw_version} mono/>
                <Field k="F/W 버전" v={p.fw_version} mono/>
              </div>
            ) : (
              <div style={{ padding: '16px', background: 'var(--warning-50)', border: '1px solid var(--warning)', borderRadius: 'var(--r-lg)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Icon name="clock" size={15} style={{ color: 'var(--warning-700)', flexShrink: 0, marginTop: 2 }}/>
                <div style={{ fontSize: 13, color: 'var(--warning-700)', lineHeight: 1.5 }}>
                  아직 생산이 완료되지 않은 오더입니다. 생산 입력 화면에서 실적을 입력하면 이 영역이 채워집니다.
                </div>
              </div>
            )}
          </section>

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

          <OrderHistorySection orderId={order.order_id}/>
          <AsReceptionSection orderId={order.order_id}/>
        </div>

        <div className="drawer__foot">
          {p && (
            <button className="btn btn--secondary" onClick={() => setFuncReportVisible(true)}>
              <Icon name="doc" size={13}/> 기능검사성적서
            </button>
          )}
          {p && (
            <button className="btn btn--secondary" onClick={() => setShipReportVisible(true)}>
              <Icon name="doc" size={13}/> 출하검사성적서
            </button>
          )}
          {canEditSales && (
            <button className="btn btn--primary" onClick={goEdit}>
              <Icon name="save" size={13}/> 영업 정보 수정
            </button>
          )}
          {canMap && (
            p ? (
              <button className="btn btn--secondary" onClick={goMapping}>
                <Icon name="doc" size={13}/> 생산 기록 열기
              </button>
            ) : (
              <button className="btn btn--primary" onClick={goMapping}>
                <Icon name="factory" size={13}/> 생산 입력으로 이동
              </button>
            )
          )}
          <button className="btn btn--ghost" onClick={handleClose}>닫기</button>
        </div>
      </aside>
      {funcDrawerOpen && (
        <FuncInspectionDrawer
          order={order}
          existingData={funcInspection}
          modelInfo={modelObj}
          onSave={(data) => {
            window.setFuncInspection(order.order_id, data);
            setFuncInspectionState(data);
            setFuncDrawerOpen(false);
            setFuncReportVisible(true);
          }}
          onClose={() => setFuncDrawerOpen(false)}
        />
      )}
      {funcReportVisible && funcInspection && (
        <FuncInspectionReport
          order={order}
          inspectionData={funcInspection}
          onClose={() => setFuncReportVisible(false)}
          onEdit={() => { setFuncReportVisible(false); setFuncDrawerOpen(true); }}
        />
      )}
      {shipDrawerOpen && (
        <ShipInspectionDrawer
          order={order}
          existingData={shipInspection}
          modelInfo={modelObj}
          onSave={(data) => {
            window.setShipInspection(order.order_id, data);
            setShipInspectionState(data);
            setShipDrawerOpen(false);
            setShipReportVisible(true);
          }}
          onClose={() => setShipDrawerOpen(false)}
        />
      )}
      {shipReportVisible && shipInspection && (
        <ShipInspectionReport
        order={order}
        inspectionData={shipInspection}
        onClose={() => setShipReportVisible(false)}
        onEdit={() => { setShipReportVisible(false); setShipDrawerOpen(true); }}
        />
      )}
      {shipPhotoLightbox !== null && (
        <div ref={shipPhotoLightboxRef} tabIndex={-1}
          role="dialog" aria-modal="true" aria-label="출하 전 사진 라이트박스"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            zIndex: 'var(--z-lightbox)', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
            style={{ position: 'absolute', top: 16, right: 16, width: 44, height: 44, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', color: 'var(--ink-inv)', fontSize: 20, cursor: 'pointer' }}
            onClick={() => setShipPhotoLightbox(null)}>×</button>
          {shipPhotoLightbox > 0 && (
            <button aria-label="이전 사진"
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', color: 'var(--ink-inv)', fontSize: 20, cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); setShipPhotoLightbox(shipPhotoLightbox - 1); }}>‹</button>
          )}
          {shipPhotoLightbox < shipPhotos.length - 1 && (
            <button aria-label="다음 사진"
              style={{ position: 'absolute', right: 64, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', color: 'var(--ink-inv)', fontSize: 20, cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); setShipPhotoLightbox(shipPhotoLightbox + 1); }}>›</button>
          )}
          <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
            {shipPhotoLightbox + 1} / {shipPhotos.length}
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

function Field({ k, v, mono, full }) {
  return (
    <div className={`dgrid__cell ${full ? 'dgrid__cell--full' : ''}`}>
      <span className="dgrid__k">{k}</span>
      <span className={`dgrid__v ${mono ? 'dgrid__v--mono' : ''}`} style={{ wordBreak: mono ? 'break-all' : 'normal' }}>{v}</span>
    </div>
  );
}

window.OrderLookupScreen = OrderLookupScreen;
