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
          aria-label="AS 접수 검색 — 접수번호, 고객사, 충전소 ID"
          placeholder="접수번호, 고객사, 충전소 ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* 접수 목록 */}
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 1000 }}>
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
                    {search || statusFilter !== '전체' ? '검색 조건에 맞는 접수가 없습니다 — 필터나 검색어를 변경해 보세요' : '아직 접수된 AS가 없습니다 — 우측 상단 [새 AS 접수] 버튼으로 등록하세요'}
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
    serial_no:      '',
    fault_type:     '',
    fault_detail:   '',
    priority:       '일반',
    reporter_name:  '',
    reporter_phone: '',
    received_at:    nowStr(),
  });
  const [err, setErr] = useStateAREC({});
  const [isSubmitting, setIsSubmitting] = useStateAREC(false);
  const [query, setQuery] = useStateAREC('');
  const [selectedOrder, setSelectedOrder] = useStateAREC(null);

  // ── 시리얼번호로 충전기 조회 (tb_chargepoint_infor) ──────────────
  const [cpQuery, setCpQuery] = useStateAREC('');
  const [cpResult, setCpResult] = useStateAREC(null);   // null | 충전기 row | 'notfound'
  const [showAddCp, setShowAddCp] = useStateAREC(false);

  const searchChargepoint = () => {
    const q = cpQuery.trim();
    if (!q) return;
    const found = window.PMDB ? window.PMDB.getChargepointBySerial(q) : null;
    if (found) {
      setCpResult(found);
      set('serial_no', found.serial_no);
    } else {
      setCpResult('notfound');
    }
  };

  const clearChargepoint = () => {
    setCpResult(null);
    setCpQuery('');
    set('serial_no', '');
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const clrErr = (key) => setErr(e => ({ ...e, [key]: '' }));

  const orders = useMemoAREC(() => window.PMDB ? window.PMDB.loadOrders() : [], []);
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
    if (isSubmitting) return;
    const e = validate();
    if (Object.keys(e).length) { setErr(e); return; }
    setIsSubmitting(true);
    try {
      onSubmit({ ...form, received_at: form.received_at.replace('T', ' ') });
    } finally {
      setIsSubmitting(false);
    }
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
          <h2 id="modal-as-receipt-title" className="modal__title">새 AS 접수</h2>
          <p className="modal__sub">고장 충전기 정보와 증상을 입력하세요</p>
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>

          {/* 시리얼번호로 충전기 조회 (tb_chargepoint_infor) */}
          <div>
            <div className="field__label" style={{ marginBottom: 8 }}>
              시리얼번호 조회
              <span style={{ color: 'var(--ink-4)', fontWeight: 400, fontSize: 13 }}> (선택)</span>
            </div>
            {cpResult && cpResult !== 'notfound' ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px',
                background: 'var(--success-50)',
                border: '1px solid var(--success)',
                borderRadius: 'var(--r-sm)',
              }}>
                <Icon name="check" size={13} style={{ color: 'var(--success-700)', flexShrink: 0 }}/>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{cpResult.serial_no}</span>
                  {cpResult.model_name ? <span style={{ color: 'var(--ink-4)' }}> · {cpResult.model_name}</span> : null}
                  {cpResult.install_address ? <span style={{ color: 'var(--ink-4)' }}> · {cpResult.install_address}</span> : null}
                </span>
                <button type="button" className="btn btn--sm btn--ghost"
                        style={{ padding: '2px 8px', fontSize: 12 }} onClick={clearChargepoint}>
                  해제
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="input-group">
                  <input
                    className="input"
                    style={{ fontFamily: 'var(--font-mono)' }}
                    aria-label="시리얼번호로 충전기 조회"
                    placeholder="시리얼번호 입력 후 조회"
                    value={cpQuery}
                    onChange={(e) => { setCpQuery(e.target.value); setCpResult(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchChargepoint())}
                  />
                  <button type="button" className="input-group__btn" onClick={searchChargepoint} disabled={!cpQuery.trim()}>
                    조회
                  </button>
                </div>
                {cpResult === 'notfound' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    padding: '9px 12px', background: 'var(--surface-2)',
                    border: '1px solid var(--border-1)', borderRadius: 'var(--r-sm)',
                  }}>
                    <Icon name="alert" size={13} style={{ color: 'var(--ink-4)', flexShrink: 0 }}/>
                    <span style={{ fontSize: 13, color: 'var(--ink-3)', flex: 1 }}>
                      등록된 충전기 정보가 없습니다
                    </span>
                    <button type="button" className="btn btn--sm btn--secondary" onClick={() => setShowAddCp(true)}>
                      <Icon name="plus" size={12}/> 신규 충전기 등록
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

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
                          <th scope="col">고객사</th>
                          <th scope="col">충전소 ID</th>
                          <th scope="col">시리얼 번호</th>
                          <th scope="col">설치 주소</th>
                          <th scope="col">모델</th>
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
                            <td>{(o.model_name && (window.findModelInfo(o.model_name)?.model || o.model_name)) || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 고객사 — 필수. 충전기 검색 선택 시 자동 입력 */}
          <div className="field">
            <label className="field__label" htmlFor="ar-customer-name">
              고객사 <span className="field__req">*</span>
            </label>
            <input
              id="ar-customer-name"
              className={`input ${err.customer_name ? 'input--error' : ''}`}
              required
              aria-required="true"
              aria-invalid={!!err.customer_name}
              placeholder="고객사명 입력 — 충전기 검색으로 선택하면 자동 입력됩니다"
              value={form.customer_name}
              onChange={(e) => { set('customer_name', e.target.value); clrErr('customer_name'); }}
            />
            {err.customer_name && <div className="field__err" role="alert">{err.customer_name}</div>}
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
              {err.fault_type && <div className="field__err" role="alert">{err.fault_type}</div>}
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
            {err.fault_detail && <div className="field__err" role="alert">{err.fault_detail}</div>}
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
                  type="tel"
                  className="input"
                  placeholder="010-0000-0000"
                  autoComplete="tel"
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
          <button className="btn btn--primary" onClick={handleSubmit} disabled={isSubmitting}>
            <Icon name="check" size={13}/> {isSubmitting ? '등록 중…' : '접수 등록'}
          </button>
        </div>
      </div>
      {showAddCp && (
        <AddChargepointModal
          serialNo={cpQuery.trim()}
          onClose={() => setShowAddCp(false)}
          onAdded={(row) => {
            setCpResult(row);
            set('serial_no', row.serial_no);
            setShowAddCp(false);
          }}
        />
      )}
    </div>
  );
}

// ── 신규 충전기 등록 모달 (DB: tb_chargepoint_infor) ────────────────
function AddChargepointModal({ serialNo, onClose, onAdded }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const [modelName, setModelName] = useStateAREC('');
  const [installAddress, setInstallAddress] = useStateAREC('');
  const [orderId, setOrderId] = useStateAREC('');
  const [err, setErr] = useStateAREC({});
  const [isSaving, setIsSaving] = useStateAREC(false);

  const models = useMemoAREC(() => window.PMDB ? window.PMDB.getModels() : [], []);

  const save = () => {
    if (isSaving) return;
    const e = {};
    if (!modelName) e.model_name = '모델을 선택하세요';
    if (!installAddress.trim()) e.install_address = '설치 주소를 입력하세요';
    if (Object.keys(e).length) { setErr(e); return; }
    setIsSaving(true);
    const result = window.PMDB.addChargepoint({
      serial_no: serialNo,
      model_name: modelName,
      install_address: installAddress.trim(),
      order_id: orderId.trim() ? Number(orderId.trim()) : null,
    });
    setIsSaving(false);
    if (!result.ok) { setErr({ serial_no: result.msg }); return; }
    onAdded({ serial_no: serialNo, model_name: modelName, install_address: installAddress.trim(), order_id: orderId.trim() ? Number(orderId.trim()) : null });
  };

  return (
    <div className="modal-backdrop" ref={dialogRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-add-cp-title" style={{ width: 460, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h2 id="modal-add-cp-title" className="modal__title">신규 충전기 등록</h2>
          <p className="modal__sub">tb_chargepoint_infor에 시리얼번호 <strong style={{ color: 'var(--ink-1)' }}>{serialNo}</strong>를 등록합니다</p>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field__label">시리얼번호</label>
            <input className="input input--readonly" style={{ fontFamily: 'var(--font-mono)' }} readOnly value={serialNo}/>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="cp-model">모델 <span className="field__req">*</span></label>
            <select id="cp-model" className={`select ${err.model_name ? 'input--error' : ''}`}
                    value={modelName}
                    onChange={(e) => { setModelName(e.target.value); setErr(er => ({ ...er, model_name: '' })); }}>
              <option value="">선택하세요</option>
              {models.map(m => <option key={m.model} value={m.model}>{m.model}{m.description ? ` — ${m.description}` : ''}</option>)}
            </select>
            {err.model_name && <div className="field__err" role="alert">{err.model_name}</div>}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="cp-address">설치 주소 <span className="field__req">*</span></label>
            <input id="cp-address" className={`input ${err.install_address ? 'input--error' : ''}`}
                   placeholder="설치 주소 입력"
                   value={installAddress}
                   onChange={(e) => { setInstallAddress(e.target.value); setErr(er => ({ ...er, install_address: '' })); }}/>
            {err.install_address && <div className="field__err" role="alert">{err.install_address}</div>}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="cp-order-id">
              연결 오더 ID <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(선택)</span>
            </label>
            <input id="cp-order-id" className="input" style={{ fontFamily: 'var(--font-mono)' }}
                   placeholder="예: 25001" inputMode="numeric"
                   value={orderId}
                   onChange={(e) => setOrderId(e.target.value.replace(/\D/g, ''))}/>
          </div>
          {err.serial_no && <div className="field__err" role="alert">{err.serial_no}</div>}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>취소</button>
          <button className="btn btn--primary" onClick={save} disabled={isSaving}>
            <Icon name="check" size={13}/> {isSaving ? '등록 중…' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

window.AsReceiptScreen = AsReceiptScreen;
