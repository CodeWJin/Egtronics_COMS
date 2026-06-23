// AS 접수 화면 — 접수 목록 조회 + 새 접수 등록

const { useState: useStateAREC, useMemo: useMemoAREC } = React;

// ── 헬퍼 ────────────────────────────────────────────────────────
function getUserDisplayName(userId) {
  if (!userId) return '';
  const users = window.PMDB ? window.PMDB.getAllUsers() : [];
  const u = users.find(x => x.user_id === userId);
  return u ? u.name : userId;
}

// ── 메인 화면 ────────────────────────────────────────────────────
function AsReceiptScreen() {
  const s = window.useStore();
  const [statusFilter, setStatusFilter] = useStateAREC('전체');
  const [search, setSearch] = useStateAREC('');
  const [showModal, setShowModal] = useStateAREC(false);

  const receptions = s.asReceptions || [];

  const counts = useMemoAREC(() => {
    const c = { '전체': receptions.length };
    window.AS_STATUS_LIST.forEach(st => { c[st] = receptions.filter(r => r.status === st).length; });
    return c;
  }, [receptions]);

  const filtered = useMemoAREC(() => {
    let list = receptions;
    if (statusFilter !== '전체') list = list.filter(r => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(r =>
      (r.reception_no   || '').toLowerCase().includes(q) ||
      (r.customer_name  || '').toLowerCase().includes(q) ||
      (r.station_id     || '').toLowerCase().includes(q) ||
      (r.charger_no     || '').toLowerCase().includes(q) ||
      (r.fault_type     || '').toLowerCase().includes(q)
    );
    return list;
  }, [receptions, statusFilter, search]);

  const goProcessing = (id) => {
    window.actions.selectAs(id);
    window.actions.setView('as-processing');
  };

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <h1 className="screen__title">AS 접수</h1>
          <p className="screen__sub">전체 {receptions.length}건 · 처리 중 {(counts['담당자배정'] || 0) + (counts['처리중'] || 0)}건</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>
          <Icon name="plus" size={14}/> 새 접수 등록
        </button>
      </div>

      {/* 상태 필터 + 검색 */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div role="group" aria-label="접수 상태 필터" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {['전체', ...window.AS_STATUS_LIST].map(st => (
            <button
              key={st}
              className={`btn btn--tag ${statusFilter === st ? 'btn--primary' : 'btn--ghost'}`}
              aria-pressed={statusFilter === st}
              onClick={() => setStatusFilter(st)}>
              {st}
              <span style={{
                marginLeft: 5,
                padding: '1px 7px',
                borderRadius: 10,
                background: statusFilter === st ? 'rgba(255,255,255,0.22)' : 'var(--surface-2)',
                fontSize: 11,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {counts[st] || 0}
              </span>
            </button>
          ))}
        </div>
        <div className="toolbar__spacer" />
        <input
          className="input toolbar__search"
          style={{ width: 260 }}
          placeholder="접수번호, 고객사, 충전소 ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* 접수 목록 */}
      <div className="table-wrap">
        <table className="table">
            <caption className="sr-only">AS 접수 목록</caption>
            <thead>
              <tr>
                <th scope="col">접수번호</th>
                <th scope="col">고객사</th>
                <th scope="col">충전소 ID</th>
                <th scope="col">충전기 번호</th>
                <th scope="col">고장 유형</th>
                <th scope="col">긴급도</th>
                <th scope="col">상태</th>
                <th scope="col">담당자</th>
                <th scope="col">접수일시</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '52px 0' }}>
                    {search || statusFilter !== '전체' ? '검색 결과가 없습니다' : 'AS 접수 내역이 없습니다'}
                  </td>
                </tr>
              ) : filtered.map(r => (
                <tr key={r.id}>
                  <td className="cell-mono cell-strong">{r.reception_no}</td>
                  <td>{r.customer_name || <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                  <td className="cell-mono">{r.station_id || <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                  <td className="cell-mono">{r.charger_no || <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                  <td>{r.fault_type || <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                  <td><AsPriorityBadge priority={r.priority}/></td>
                  <td><AsStatusBadge status={r.status}/></td>
                  <td>
                    {r.assignee
                      ? r.assignee.split(',').map(id => getUserDisplayName(id.trim())).join(', ')
                      : <span style={{ color: 'var(--ink-4)' }}>미배정</span>}
                  </td>
                  <td className="cell-muted">{(r.received_at || '').slice(0, 16)}</td>
                  <td>
                    <button className="btn btn--sm btn--ghost" onClick={() => goProcessing(r.id)}>
                      처리 <Icon name="arrow-right" size={12}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>

      {showModal && (
        <AsReceiptModal
          onClose={() => setShowModal(false)}
          onSubmit={(form) => {
            window.actions.addAsReception(form);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

// ── 새 접수 등록 모달 ────────────────────────────────────────────
function AsReceiptModal({ onClose, onSubmit }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const nowStr = () => {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const [form, setForm] = useStateAREC({
    customer_name:  '',
    station_name:   '',
    station_id:     '',
    charger_no:     '',
    order_id:       null,
    fault_type:     '',
    fault_detail:   '',
    priority:       '일반',
    reporter_name:  '',
    reporter_phone: '',
    received_at:    nowStr(),
  });
  const [err, setErr] = useStateAREC({});
  const [query, setQuery] = useStateAREC('');
  const [selectedOrder, setSelectedOrder] = useStateAREC(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const clrErr = (key) => setErr(e => ({ ...e, [key]: '' }));

  const orders = useMemoAREC(() => window.PMDB ? window.PMDB.loadOrders() : [], []);
  const modelMap = useMemoAREC(() => {
    const map = {};
    (window.PMDB ? window.PMDB.getModels() : []).forEach(m => { map[m.name] = m.model; });
    return map;
  }, []);
  const filtered = useMemoAREC(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return orders.filter(o =>
      o.status === 'COMPLETED' && (
        (o.station_id                    || '').toLowerCase().includes(q) ||
        (o.customer_name                 || '').toLowerCase().includes(q) ||
        (o.install_address               || '').toLowerCase().includes(q) ||
        (o.production?.serial_no         || '').toLowerCase().includes(q) ||
        (o.model_name                    || '').toLowerCase().includes(q)
      )
    );
  }, [query, orders]);

  const validate = () => {
    const e = {};
    if (!form.customer_name.trim()) e.customer_name = '고객사를 입력하세요';
    if (!form.fault_type)           e.fault_type    = '고장 유형을 선택하세요';
    if (!form.fault_detail.trim())  e.fault_detail  = '상세 증상을 입력하세요';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErr(e); return; }
    onSubmit({ ...form, received_at: form.received_at.replace('T', ' ') });
  };

  const handleOrderSelect = (order) => {
    setForm(f => ({
      ...f,
      customer_name: order.customer_name || f.customer_name,
      station_id:    order.station_id    || f.station_id,
      order_id:      order.order_id,
    }));
    setSelectedOrder(order);
    setQuery('');
    setErr(e => ({ ...e, customer_name: '' }));
  };

  const clearOrder = () => {
    setSelectedOrder(null);
    setForm(f => ({ ...f, order_id: null }));
  };

  return (
    <div className="modal-backdrop" ref={dialogRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-as-receipt-title"
           style={{ width: 580, maxWidth: '96vw', maxHeight: '92dvh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal__head">
          <h3 id="modal-as-receipt-title" className="modal__title">새 AS 접수</h3>
          <p className="modal__sub">고장 충전기 정보와 증상을 입력하세요</p>
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>

          {/* 충전기 검색 */}
          <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: 12 }}>
            <div className="field__label" style={{ marginBottom: 8 }}>
              충전기 검색
              <span style={{ color: 'var(--ink-4)', fontWeight: 400, fontSize: 13 }}> (선택)</span>
            </div>
            {selectedOrder ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px',
                background: 'var(--primary-50)',
                border: '1px solid var(--primary-100)',
                borderRadius: 'var(--r-sm)',
              }}>
                <Icon name="check" size={13} style={{ color: 'var(--primary)', flexShrink: 0 }}/>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>#{selectedOrder.order_id}</span>
                  {' · '}{selectedOrder.customer_name || ''}
                  {selectedOrder.station_id
                    ? <span style={{ color: 'var(--ink-4)' }}> · {selectedOrder.station_id}</span>
                    : null}
                </span>
                <button type="button" className="btn btn--sm btn--ghost"
                        style={{ padding: '2px 8px', fontSize: 12 }} onClick={clearOrder}>
                  해제
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  className="input"
                  aria-label="충전소 ID, 고객사, 모델명, 시리얼 번호, 설치주소로 오더 검색"
                  placeholder="충전소 ID, 고객사, 모델명, 시리얼 번호, 설치주소 검색…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query.trim() && (
                  <div style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--r-sm)', overflow: 'auto' }}>
                    <table className="table" style={{ fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>고객사</th>
                          <th>충전소 ID</th>
                          <th>시리얼 번호</th>
                          <th>설치 주소</th>
                          <th>모델</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '20px 0' }}>
                              검색 결과 없음
                            </td>
                          </tr>
                        ) : filtered.map(o => (
                          <tr key={o.order_id} className="row--clickable"
                            tabIndex={0}
                            onClick={() => handleOrderSelect(o)}
                            onKeyDown={(e) => e.key === 'Enter' && handleOrderSelect(o)}>
                            <td>{o.customer_name || '—'}</td>
                            <td className="cell-mono">{o.station_id || '—'}</td>
                            <td className="cell-mono">{o.production?.serial_no || '—'}</td>
                            <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {o.install_address || '—'}
                            </td>
                            <td>{(o.model_name && (modelMap[o.model_name] || o.model_name)) || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* 고장 유형 / 긴급도 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start',
                        borderTop: '1px solid var(--border-1)', paddingTop: 12 }}>
            <div className="field">
              <label className="field__label" htmlFor="ar-fault-type">
                고장 유형 <span className="field__req">*</span>
              </label>
              <select
                id="ar-fault-type"
                className={`select ${err.fault_type ? 'input--error' : ''}`}
                required
                aria-required="true"
                aria-invalid={!!err.fault_type}
                value={form.fault_type}
                onChange={(e) => { set('fault_type', e.target.value); clrErr('fault_type'); }}>
                <option value="">선택하세요</option>
                {window.FAULT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {err.fault_type && <div className="field__err">{err.fault_type}</div>}
            </div>
            <div className="field">
              <div className="field__label">긴급도</div>
              <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
                {['일반', '긴급'].map(p => (
                  <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      name="ar-priority"
                      value={p}
                      checked={form.priority === p}
                      onChange={() => set('priority', p)}
                    />
                    {p === '긴급'
                      ? <span style={{ color: 'var(--danger-700)', fontWeight: 600 }}>긴급</span>
                      : '일반'}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 상세 증상 */}
          <div className="field">
            <label className="field__label" htmlFor="ar-fault-detail">
              상세 증상 <span className="field__req">*</span>
            </label>
            <textarea
              id="ar-fault-detail"
              className={`textarea ${err.fault_detail ? 'input--error' : ''}`}
              rows={3}
              required
              aria-required="true"
              aria-invalid={!!err.fault_detail}
              placeholder="고장 증상을 구체적으로 입력하세요"
              value={form.fault_detail}
              onChange={(e) => { set('fault_detail', e.target.value); clrErr('fault_detail'); }}
            />
            {err.fault_detail && <div className="field__err">{err.fault_detail}</div>}
          </div>

          {/* 신고자 정보 */}
          <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="field__label" htmlFor="ar-reporter-name">신고자</label>
                <input
                  id="ar-reporter-name"
                  className="input"
                  placeholder="신고자 이름"
                  value={form.reporter_name}
                  onChange={(e) => set('reporter_name', e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="ar-reporter-phone">연락처</label>
                <input
                  id="ar-reporter-phone"
                  className="input"
                  placeholder="010-0000-0000"
                  value={form.reporter_phone}
                  onChange={(e) => set('reporter_phone', e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ar-received-at">접수 일시</label>
              <input
                id="ar-received-at"
                className="input"
                type="datetime-local"
                value={form.received_at}
                onChange={(e) => set('received_at', e.target.value)}
              />
            </div>
          </div>

        </div>

        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>취소</button>
          <button className="btn btn--primary" onClick={handleSubmit}>
            <Icon name="check" size={13}/> 접수 등록
          </button>
        </div>
      </div>
    </div>
  );
}

window.AsReceiptScreen = AsReceiptScreen;
