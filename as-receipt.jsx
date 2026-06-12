// AS 접수 화면 — 접수 목록 조회 + 새 접수 등록

const { useState: useStateAREC, useEffect: useEffectAREC, useMemo: useMemoAREC } = React;

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
          <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 2 }}>
            전체 {receptions.length}건 · 처리 중 {(counts['담당자배정'] || 0) + (counts['처리중'] || 0)}건
          </div>
        </div>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>
          <Icon name="plus" size={14}/> 새 접수 등록
        </button>
      </div>

      {/* 상태 필터 + 검색 */}
      <div className="toolbar" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {['전체', ...window.AS_STATUS_LIST].map(st => (
            <button
              key={st}
              className={`btn btn--sm ${statusFilter === st ? 'btn--primary' : 'btn--ghost'}`}
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
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>접수번호</th>
                <th>고객사</th>
                <th>충전소 ID</th>
                <th>충전기 번호</th>
                <th>고장 유형</th>
                <th>긴급도</th>
                <th>상태</th>
                <th>담당자</th>
                <th>접수일시</th>
                <th></th>
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
                      ? getUserDisplayName(r.assignee)
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
  const [showSearch, setShowSearch] = useStateAREC(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const clrErr = (key) => setErr(e => ({ ...e, [key]: '' }));

  const customers = window.PMDB ? window.PMDB.getCustomers() : [];

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
      customer_name: f.customer_name || order.customer_name || '',
      station_id:    order.station_id || f.station_id,
      order_id:      order.order_id,
    }));
    setShowSearch(false);
  };

  return (
    <>
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ width: 580, maxWidth: '96vw' }}>
          <div className="modal__head">
            <h3 className="modal__title">새 AS 접수</h3>
            <p className="modal__sub">고장 충전기 정보와 증상을 입력하세요</p>
          </div>

          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* 고객 / 충전소 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="field__label">고객사 *</label>
                <input
                  className={`input ${err.customer_name ? 'input--error' : ''}`}
                  list="ar-customers"
                  placeholder="예: 카스"
                  value={form.customer_name}
                  onChange={(e) => { set('customer_name', e.target.value); clrErr('customer_name'); }}
                />
                <datalist id="ar-customers">
                  {customers.map(c => <option key={c.name} value={c.name}/>)}
                </datalist>
                {err.customer_name && <div className="field__err">{err.customer_name}</div>}
              </div>
              <div className="field">
                <label className="field__label">충전소명</label>
                <input
                  className="input"
                  placeholder="예: 강남구청 EV충전소"
                  value={form.station_name}
                  onChange={(e) => set('station_name', e.target.value)}
                />
              </div>
            </div>

            {/* 충전소 ID / 충전기 번호 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="field__label">충전소 ID</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="예: GN-001"
                    value={form.station_id}
                    onChange={(e) => set('station_id', e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    title="주문 목록에서 충전소 검색"
                    onClick={() => setShowSearch(true)}>
                    <Icon name="search" size={13}/>
                  </button>
                </div>
                {form.order_id && (
                  <div className="field__hint"><Icon name="check" size={11}/> 오더 #{form.order_id} 연결됨</div>
                )}
              </div>
              <div className="field">
                <label className="field__label">충전기 번호</label>
                <input
                  className="input"
                  placeholder="예: CH-01"
                  value={form.charger_no}
                  onChange={(e) => set('charger_no', e.target.value)}
                />
              </div>
            </div>

            {/* 고장 유형 / 긴급도 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
              <div className="field">
                <label className="field__label">고장 유형 *</label>
                <select
                  className={`select ${err.fault_type ? 'input--error' : ''}`}
                  value={form.fault_type}
                  onChange={(e) => { set('fault_type', e.target.value); clrErr('fault_type'); }}>
                  <option value="">선택하세요</option>
                  {window.FAULT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {err.fault_type && <div className="field__err">{err.fault_type}</div>}
              </div>
              <div className="field">
                <label className="field__label">긴급도</label>
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
                      {p === '긴급' ? <span style={{ color: 'var(--danger-700)', fontWeight: 600 }}>긴급</span> : '일반'}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 상세 증상 */}
            <div className="field">
              <label className="field__label">상세 증상 *</label>
              <textarea
                className={`textarea ${err.fault_detail ? 'input--error' : ''}`}
                rows={3}
                placeholder="고장 증상을 구체적으로 입력하세요"
                value={form.fault_detail}
                onChange={(e) => { set('fault_detail', e.target.value); clrErr('fault_detail'); }}
              />
              {err.fault_detail && <div className="field__err">{err.fault_detail}</div>}
            </div>

            {/* 신고자 정보 */}
            <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="field__label">신고자</label>
                <input
                  className="input"
                  placeholder="신고자 이름"
                  value={form.reporter_name}
                  onChange={(e) => set('reporter_name', e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field__label">신고자 연락처</label>
                <input
                  className="input"
                  placeholder="010-0000-0000"
                  value={form.reporter_phone}
                  onChange={(e) => set('reporter_phone', e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field__label">접수 일시</label>
                <input
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

      {showSearch && (
        <ChargerSearchModal
          onSelect={handleOrderSelect}
          onClose={() => setShowSearch(false)}
        />
      )}
    </>
  );
}

window.AsReceiptScreen = AsReceiptScreen;
