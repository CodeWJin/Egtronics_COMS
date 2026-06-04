// 통합 조회 화면 — 전체 오더 검색 + 우측 상세 드로어

const { useState: useStateOL, useMemo: useMemoOL } = React;

function statusBadge(o) {
  if (o.status === 'COMPLETED')   return <span className="badge badge--complete"><Icon name="check" size={10}/>생산완료</span>;
  if (o.status === 'IN_PROGRESS') return <span className="badge badge--info"><span className="badge__dot"/>생산진행중</span>;
  return <span className="badge badge--pending"><span className="badge__dot"/>생산대기</span>;
}

function OrderLookupScreen() {
  const s = window.useStore();
  const [search, setSearch] = useStateOL('');
  const [fStatus, setFStatus] = useStateOL('all');
  const [fModel, setFModel] = useStateOL('all');
  const [fCustomer, setFCustomer] = useStateOL('all');
  const [dateField, setDateField] = useStateOL('delivery'); // 'delivery' | 'prod'
  const [dateFrom, setDateFrom] = useStateOL('');
  const [dateTo, setDateTo] = useStateOL('');
  const [selId, setSelId] = useStateOL(null);
  const [sortKey, setSortKey] = useStateOL('order_id');
  const [sortDir, setSortDir] = useStateOL('desc');
  const [fAsOnly, setFAsOnly] = useStateOL(false);
  const [asVer, setAsVer] = useStateOL(0);

  const refreshAsStats = () => setAsVer(v => v + 1);

  const customers = useMemoOL(() => [...new Set(s.orders.map(o => o.customer_name))], [s.orders]);

  const asStats = useMemoOL(() => {
    let totalRecords = 0;
    let ordersWithAs = 0;
    s.orders.forEach(o => {
      const hist = window.PMDB.getAsHistory(o.order_id) || [];
      if (hist.length > 0) { ordersWithAs++; totalRecords += hist.length; }
    });
    return { totalRecords, ordersWithAs };
  }, [s.orders, asVer]);

  const activeFilters = (fStatus !== 'all') + (fModel !== 'all') + (fCustomer !== 'all') + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (search ? 1 : 0) + (fAsOnly ? 1 : 0);

  const filtered = useMemoOL(() => {
    let list = s.orders.filter(o => {
      if (fStatus !== 'all' && o.status !== fStatus) return false;
      if (fModel !== 'all' && o.model_name !== fModel) return false;
      if (fCustomer !== 'all' && o.customer_name !== fCustomer) return false;
      const dv = dateField === 'prod' ? (o.production && o.production.prod_date) : o.delivery_date;
      if (dateFrom && (!dv || dv < dateFrom)) return false;
      if (dateTo && (!dv || dv > dateTo)) return false;
      if (fAsOnly && (window.PMDB.getAsHistory(o.order_id) || []).length === 0) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [o.customer_name, o.model_name, o.station_id, o.router_no, o.usim_no, o.install_address, String(o.order_id),
          o.production && o.production.serial_no, o.production && o.production.lot_no, o.production && o.production.doc_no]
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
  }, [s.orders, search, fStatus, fModel, fCustomer, dateField, dateFrom, dateTo, sortKey, sortDir, fAsOnly, asVer]);

  const reset = () => {
    setSearch(''); setFStatus('all'); setFModel('all'); setFCustomer('all');
    setDateFrom(''); setDateTo(''); setDateField('delivery'); setFAsOnly(false);
  };

  const toggleSort = (k) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  const sortArrow = (k) => sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const selected = s.orders.find(o => o.order_id === selId);

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">통합 조회 · 전체 오더</div>
          <h1 className="screen__title">오더 통합 조회</h1>
          <p className="screen__sub">영업·생산 전 과정의 오더를 한 곳에서 검색합니다. 행을 선택하면 우측에 전체 상세가 열립니다.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: 'var(--ink-3)' }}>
          전체 <strong style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{s.orders.length}</strong>건 ·
          대기 <strong style={{ color: 'var(--warning-700)', fontWeight: 600 }}>{s.orders.filter(o => o.status === 'PENDING').length}</strong> ·
          완료 <strong style={{ color: 'var(--success-700)', fontWeight: 600 }}>{s.orders.filter(o => o.status === 'COMPLETED').length}</strong> ·
          A/S <strong style={{ color: 'var(--primary-600)', fontWeight: 600 }}>{asStats.ordersWithAs}</strong>오더
          <span style={{ color: 'var(--ink-5)' }}>|</span>
          이력 <strong style={{ color: 'var(--primary-600)', fontWeight: 600 }}>{asStats.totalRecords}</strong>건
        </div>
      </div>

      {/* Filter panel */}
      <div className="card" style={{ marginBottom: 16, borderRadius: 'var(--r-xl)' }}>
        <div className="card__body" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Icon name="sliders" size={14} style={{ color: 'var(--ink-3)' }}/>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>검색 조건</span>
            {activeFilters > 0 && <span className="badge badge--info" style={{ marginLeft: 2 }}>{activeFilters}개 적용</span>}
            <div style={{ flex: 1 }}/>
            <button className="btn btn--ghost btn--sm" onClick={reset} disabled={activeFilters === 0}>
              <Icon name="refresh" size={12}/> 조건 초기화
            </button>
          </div>
          <div className="filter-grid">
            <div className="field col-span-2">
              <label className="field__label"><Icon name="search" size={11}/>통합 검색</label>
              <input className="input" placeholder="고객사 · 충전소ID · 시리얼 · 문서번호 · 주소 …"
                     value={search} onChange={(e) => setSearch(e.target.value)}/>
            </div>
            <div className="field">
              <label className="field__label">상태</label>
              <select className="select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="all">전체 상태</option>
                <option value="PENDING">생산대기</option>
                <option value="COMPLETED">생산완료</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label">모델</label>
              <select className="select" value={fModel} onChange={(e) => setFModel(e.target.value)}>
                <option value="all">모델 전체</option>
                {window.MASTER.MODELS.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label">고객사</label>
              <select className="select" value={fCustomer} onChange={(e) => setFCustomer(e.target.value)}>
                <option value="all">고객사 전체</option>
                {customers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label">기간 기준</label>
              <select className="select" value={dateField} onChange={(e) => setDateField(e.target.value)}>
                <option value="delivery">납품일자</option>
                <option value="prod">생산일자</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label">시작일</label>
              <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}/>
            </div>
            <div className="field">
              <label className="field__label">종료일</label>
              <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)}/>
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <label className="field__label">A/S 필터</label>
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
          <table className="table" style={{ tableLayout: 'fixed', width: '100%', textAlign: 'left', borderCollapse: 'collapse', }}>
            <colgroup>
              <col style={{ width: 76 }}/>
              <col style={{ width: 190 }}/>
              <col style={{ width: 150 }}/>
              <col style={{ width: 120 }}/>
              <col style={{ width: 100 }}/>
              <col style={{ width: 100 }}/>
              <col style={{ width: 110 }}/>
              <col style={{ width: 36 }}/>
            </colgroup>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('order_id')}>오더 #{sortArrow('order_id')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('customer_name')}>고객사{sortArrow('customer_name')}</th>
                <th>모델</th>
                <th>충전소 ID</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('delivery_date')}>납품일{sortArrow('delivery_date')}</th>
                <th>생산일</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>상태{sortArrow('status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.order_id}
                    className={`row--clickable ${o.order_id === selId ? 'row--selected' : ''}`}
                    onClick={() => setSelId(o.order_id)}>
                  <td className="cell-mono">#{o.order_id}</td>
                  <td>
                    <div className="cell-strong">{o.customer_name}</div>
                    <div className="cell-muted">접수 {o.created}</div>
                  </td>
                  <td><span className="badge badge--neutral">{o.model_name}</span></td>
                  <td className="cell-mono">{o.station_id}</td>
                  <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{o.delivery_date}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--ink-3)' }}>
                    {o.production ? o.production.prod_date : <span style={{ color: 'var(--ink-5)' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {statusBadge(o)}
                      {(window.PMDB.getAsHistory(o.order_id) || []).length > 0 && (
                        <span className="badge badge--pending" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)', fontSize: 10.5 }}>
                          A/S {(window.PMDB.getAsHistory(o.order_id) || []).length}
                        </span>
                      )}
                    </div>
                  </td>
                  <td><Icon name="chevron-right" size={14} style={{ color: 'var(--ink-4)' }}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <OrderDrawer order={selected} onClose={() => setSelId(null)} onAsChange={refreshAsStats}/>}
    </div>
  );
}

function AsHistorySection({ orderId, canEdit, onAsChange }) {
  const [list, setList] = useStateOL([]);
  const [showForm, setShowForm] = useStateOL(false);
  const [draft, setDraft] = useStateOL(null);

  const reload = () => setList(window.PMDB.getAsHistory(orderId));
  React.useEffect(() => { reload(); }, [orderId]);

  const startAdd = () => {
    setDraft({ reception_date: '', dispatch_date: '', action: '', notes: '', field_manager: '' });
    setShowForm(true);
  };

  const save = () => {
    const today = new Date().toISOString().slice(0, 10);
    window.PMDB.addAsRecord({ order_id: orderId, ...draft, created_at: today });
    reload();
    onAsChange?.();
    setShowForm(false);
    setDraft(null);
  };

  const remove = (id) => { window.PMDB.deleteAsRecord(id); reload(); onAsChange?.(); };

  return (
    <section>
      <div className="dsec__title"><Icon name="clock" size={12}/> A/S 이력</div>
      {list.length === 0 && !showForm && (
        <div className="emptystate" style={{ padding: '14px 0' }}>
          <div className="emptystate__title" style={{ fontSize: 13 }}>등록된 A/S 이력이 없습니다</div>
        </div>
      )}
      {list.map((r, i) => (
        <div key={r.id} style={{ padding: '12px 0', borderBottom: i < list.length - 1 ? '1px solid var(--border-1)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{r.created_at}</span>
            {canEdit && (
              <button className="btn btn--ghost btn--sm btn--icon" aria-label="삭제" onClick={() => remove(r.id)}>
                <Icon name="x" size={12}/>
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12.5 }}>
            {r.reception_date && <div><span style={{ color: 'var(--ink-3)' }}>접수</span> <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.reception_date}</span></div>}
            {r.dispatch_date && <div><span style={{ color: 'var(--ink-3)' }}>출동</span> <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.dispatch_date}</span></div>}
            {r.field_manager && <div style={{ gridColumn: 'span 2' }}><span style={{ color: 'var(--ink-3)' }}>현장 담당자 </span><span>{r.field_manager}</span></div>}
            {r.action && <div style={{ gridColumn: 'span 2' }}><span style={{ color: 'var(--ink-3)' }}>조치내용 </span><span>{r.action}</span></div>}
            {r.notes && <div style={{ gridColumn: 'span 2' }}><span style={{ color: 'var(--ink-3)' }}>비고 </span><span>{r.notes}</span></div>}
          </div>
        </div>
      ))}
      {canEdit && !showForm && (
        <button className="btn btn--secondary btn--sm" style={{ marginTop: 10 }} onClick={startAdd}>
          <Icon name="plus" size={12}/> A/S 이력 추가
        </button>
      )}
      {showForm && draft && (
        <div className="mgr-edit" style={{ marginTop: 10 }}>
          <div className="mgr-edit__title">A/S 이력 추가</div>
          <div className="form-grid">
            <div className="field">
              <label className="field__label">접수일정</label>
              <input type="date" className="input" value={draft.reception_date}
                     onChange={e => setDraft(d => ({ ...d, reception_date: e.target.value }))}/>
            </div>
            <div className="field">
              <label className="field__label">출동일정</label>
              <input type="date" className="input" value={draft.dispatch_date}
                     onChange={e => setDraft(d => ({ ...d, dispatch_date: e.target.value }))}/>
            </div>
            <div className="field">
              <label className="field__label">현장 담당자</label>
              <input className="input" placeholder="담당자명" value={draft.field_manager}
                     onChange={e => setDraft(d => ({ ...d, field_manager: e.target.value }))}/>
            </div>
            <div className="field col-span-2">
              <label className="field__label">조치내용</label>
              <input className="input" placeholder="조치 내용을 입력하세요" value={draft.action}
                     onChange={e => setDraft(d => ({ ...d, action: e.target.value }))}/>
            </div>
            <div className="field col-span-2">
              <label className="field__label">비고</label>
              <input className="input" placeholder="비고" value={draft.notes}
                     onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}/>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="btn btn--secondary btn--sm" onClick={() => { setShowForm(false); setDraft(null); }}>취소</button>
            <button className="btn btn--primary btn--sm" onClick={save}><Icon name="check" size={12}/> 저장</button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ────────── Right detail drawer ────────── */
function OrderDrawer({ order, onClose, onAsChange }) {
  React.useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [order]);

  const p = order.production;
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
  const isAs = role === 'as';
  const canMap = role === 'production' || role === 'admin';
  const canEditSales = (role === 'sales' || role === 'admin') && order.status === 'PENDING';
  const goMapping = () => { window.actions.selectOrder(order.order_id); window.actions.setView('mapping'); };
  const goEdit = () => { window.actions.editOrder(order.order_id); onClose(); };
  const revert = () => { if (confirm(`오더 #${order.order_id}을(를) 생산대기 상태로 변경할까요?`)) { window.actions.revertOrder(order.order_id); onClose(); } };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <aside className="drawer">
        <div className="drawer__head">
          <div>
            <div className="drawer__eyebrow">order_id #{order.order_id} · 접수 {order.created}</div>
            <div style={{ marginTop: 8 }}>{statusBadge(order)}</div>
          </div>
          <button className="drawer__close" onClick={onClose} aria-label="닫기"><Icon name="x" size={16}/></button>
        </div>

        <div className="drawer__body">
          {/* Sales section */}
          <section>
            <div className="dsec__title"><Icon name="cart" size={12}/> 영업 입력 정보</div>
            <div className="dgrid">
              <Field k="모델" v={order.model_name}/>
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

          {/* Production section */}
          <section>
            <div className="dsec__title"><Icon name="factory" size={12}/> 생산 실적 정보</div>
            {p ? (
              <div className="dgrid">
                <Field k="생산일자" v={p.prod_date}/>
                <Field k="검정일자" v={p.inspection_date}/>
                <Field k="로트번호" v={p.lot_no} mono/>
                <Field k="시리얼" v={p.serial_no} mono/>
                <Field k="S/W 버전" v={p.sw_version} mono/>
                <Field k="문서번호 (성적서)" v={p.doc_no} mono full/>
              </div>
            ) : (
              <div style={{ padding: '20px 18px', background: 'var(--warning-50)', border: '1px solid var(--warning)', borderRadius: 'var(--r-lg)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <Icon name="clock" size={16} style={{ color: 'var(--warning-700)', flexShrink: 0, marginTop: 1 }}/>
                <div style={{ fontSize: 12.5, color: 'var(--warning-700)', lineHeight: 1.55 }}>
                  아직 생산이 완료되지 않은 오더입니다. 생산 매핑 화면에서 실적을 입력하면 이 영역이 채워집니다.
                </div>
              </div>
            )}
          </section>

          <AsHistorySection orderId={order.order_id} canEdit={isAs} onAsChange={onAsChange}/>
        </div>

        <div className="drawer__foot">
          {canEditSales && (
            <button className="btn btn--primary" onClick={goEdit}>
              <Icon name="save" size={13}/> 영업 정보 수정
            </button>
          )}
          {p && canMap && (
            <button className="btn btn--secondary" onClick={revert}>
              <Icon name="refresh" size={13}/> 생산대기로 변경
            </button>
          )}
          {canMap && (
            p ? (
              <button className="btn btn--secondary" onClick={goMapping}>
                <Icon name="doc" size={13}/> 생산 기록 열기
              </button>
            ) : (
              <button className="btn btn--primary" onClick={goMapping}>
                <Icon name="factory" size={13}/> 생산 매핑으로 이동
              </button>
            )
          )}
          <button className="btn btn--secondary" onClick={onClose}>닫기</button>
        </div>
      </aside>
    </>
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
