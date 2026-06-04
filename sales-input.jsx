// 영업 부서 입력 화면 (Sales Input Dashboard)
const { useState: useStateSI, useRef: useRefSI, useEffect: useEffectSI } = React;

function ComboField({ value, onChange, options, placeholder, error, displayKey = 'name', metaKey = 'spec' }) {
  const [open, setOpen] = useStateSI(false);
  const [highlight, setHighlight] = useStateSI(0);
  const [showAll, setShowAll] = useStateSI(false);
  const ref = useRefSI(null);
  useEffectSI(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setShowAll(false); } };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const filtered = showAll
    ? options
    : options.filter(o =>
        !value || (o[displayKey] || '').toLowerCase().includes((value || '').toLowerCase())
      );
  return (
    <div className="combo" ref={ref}>
      <div className="input-group">
        <input className={`input ${error ? 'input--error' : ''}`}
               placeholder={placeholder}
               value={value || ''}
               onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); setShowAll(false); }}
               onFocus={() => setOpen(true)}
               onKeyDown={(e) => {
                 if (e.key === 'ArrowDown') { setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
                 if (e.key === 'ArrowUp')   { setHighlight((h) => Math.max(h - 1, 0)); }
                 if (e.key === 'Enter' && open && filtered[highlight]) { onChange(filtered[highlight][displayKey]); setOpen(false); setShowAll(false); e.preventDefault(); }
                 if (e.key === 'Escape')    { setOpen(false); setShowAll(false); }
               }}/>
        <button type="button" className="input-group__btn" onClick={() => { setShowAll(true); setOpen((v) => !v); }}>
          <Icon name="chevron-down" size={12} />
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div className="combo__menu">
          {filtered.map((o, i) => (
            <div key={o[displayKey]}
                 className={`combo__item ${i === highlight ? 'combo__item--active' : ''}`}
                 onMouseEnter={() => setHighlight(i)}
                 onMouseDown={(e) => { e.preventDefault(); onChange(o[displayKey]); setOpen(false); }}>
              <span>{o[displayKey]}</span>
              <span className="combo__item__meta">{o[metaKey] || (o.last ? `최근 ${o.last}` : '')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScannerInput({ value, onChange, placeholder, error, maxLength, format }) {
  const [scanning, setScanning] = useStateSI(false);
  const ref = useRefSI(null);
  const onFocus = () => {
    setScanning(true);
    setTimeout(() => setScanning(false), 1800);
  };
  // Simulate barcode scan
  const simulate = () => {
    setScanning(true);
    setTimeout(() => {
      onChange(format ? format() : `RTR-2026-${Math.floor(Math.random() * 90000 + 10000)}`);
      setScanning(false);
      if (ref.current) ref.current.blur();
    }, 1200);
  };
  return (
    <div className="input-group">
      <input ref={ref}
             className={`input ${error ? 'input--error' : ''} ${scanning ? 'input--scanning' : ''}`}
             placeholder={scanning ? '스캐너 대기 중…' : placeholder}
             maxLength={maxLength}
             value={value || ''}
             onFocus={onFocus}
             onChange={(e) => onChange(e.target.value)}/>
      <button type="button" className="input-group__btn" onClick={simulate} title="바코드 스캔 시뮬레이션">
        <Icon name="barcode" size={14} />
      </button>
    </div>
  );
}

function AddressField({ value, onChange, error }) {
  const [showSearch, setShowSearch] = useStateSI(false);
  const [query, setQuery] = useStateSI('');
  const mockResults = [
    { zip: '06236', road: '서울특별시 강남구 테헤란로 152', name: '강남파이낸스센터' },
    { zip: '04518', road: '서울특별시 중구 을지로 100', name: '시그니쳐타워' },
    { zip: '13494', road: '경기도 성남시 분당구 판교역로 235', name: 'H스퀘어' },
    { zip: '21984', road: '인천광역시 연수구 컨벤시아대로 165', name: '송도컨벤시아' },
    { zip: '48058', road: '부산광역시 해운대구 센텀남대로 35', name: '센텀시티' },
  ].filter(r => !query || r.road.includes(query) || r.name.includes(query));

  return (
    <>
      <div className="input-group">
        <input className={`input ${error ? 'input--error' : ''}`}
               placeholder="우편번호 검색 후 상세주소 입력"
               value={value || ''}
               onChange={(e) => onChange(e.target.value)}/>
        <button type="button" className="input-group__btn" onClick={() => setShowSearch(true)}>
          <Icon name="search" size={12} style={{ marginRight: 4 }}/> 우편번호
        </button>
      </div>
      {showSearch && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowSearch(false)}>
          <div className="modal">
            <div className="modal__head">
              <h3 className="modal__title">우편번호 / 주소 검색</h3>
              <p className="modal__sub">도로명 주소 또는 건물명을 입력하세요</p>
            </div>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-group">
                <div className="input-group__icon"><Icon name="search" size={14}/></div>
                <input className="input" style={{ paddingLeft: 32 }} autoFocus
                       placeholder="예: 테헤란로 152"
                       value={query}
                       onChange={(e) => setQuery(e.target.value)}/>
              </div>
              <div style={{ maxHeight: 220, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {mockResults.length === 0 && <div className="emptystate"><div className="emptystate__title">결과가 없습니다</div></div>}
                {mockResults.map(r => (
                  <button key={r.zip} className="combo__item" style={{ textAlign: 'left', border: 0, background: 'transparent', cursor: 'pointer' }}
                          onClick={() => { onChange(r.road + ', '); setShowSearch(false); }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 500, color: 'var(--ink-1)' }}>{r.road}</span>
                      <span className="combo__item__meta">({r.name}) · {r.zip}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal__foot">
              <button className="btn btn--secondary" onClick={() => setShowSearch(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SalesInputScreen() {
  const s = window.useStore();
  const editing = s.editingOrderId ? s.orders.find(o => o.order_id === s.editingOrderId) : null;
  const isEdit = !!editing;

  const empty = {
    customer_name: '',
    customer_manager:'',
    model_name: '',
    delivery_date: '',
    cable_length: '',
    station_id: '',
    router_no: '',
    usim_no: '',
    install_address: '',
  };
  const [form, setForm] = useStateSI(empty);
  const [touched, setTouched] = useStateSI({});
  const [showAll, setShowAll] = useStateSI(false);
  const [managers, setManagers] = useStateSI([]);
  const [showMgr, setShowMgr] = useStateSI(false);
  const [showHistory, setShowHistory] = useStateSI(false);
  const [showAddCustomer, setShowAddCustomer] = useStateSI(false);
  const [showCustomerMgr, setShowCustomerMgr] = useStateSI(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // 수정 모드 진입/해제 시 폼 동기화
  useEffectSI(() => {
    if (editing) {
      setForm({
        customer_name: editing.customer_name || '',
        customer_manager: editing.customer_manager || '',
        model_name: editing.model_name || '',
        delivery_date: editing.delivery_date || '',
        cable_length: editing.cable_length || '',
        station_id: editing.station_id || '',
        router_no: editing.router_no || '',
        usim_no: editing.usim_no || '',
        install_address: editing.install_address || '',
      });
      setTouched({}); setShowAll(false);
    } else {
      setForm(empty); setTouched({}); setShowAll(false);
    }
  }, [s.editingOrderId]);

  // 고객사별 담당자 로드 (DB 관리)
  const refreshManagers = useRefSI(null);
  refreshManagers.current = () => {
    if (form.customer_name && window.PMDB.getManagers) {
      const raw = window.PMDB.getManagers(form.customer_name);
      const list = raw.map(m => ({ ...m, display: m.phone ? `${m.name} (${m.phone})` : m.name }));
      setManagers(list);
      return list;
    }
    setManagers([]);
    return [];
  };
  useEffectSI(() => {
    const list = refreshManagers.current();
    // 담당자 미선택 시 대표 담당자 자동 채움
    if (!form.customer_manager && list.length) {
      const primary = list.find(m => m.is_primary) || list[0];
      update('customer_manager', primary.display || primary.name);
    }
  }, [form.customer_name]);

  const errors = {
    customer_name: !form.customer_name && '고객사를 입력해 주세요',
    customer_manager: form.customer_name && !form.customer_manager && '고객사 담당자를 선택해 주세요',
    model_name:    !form.model_name && '모델을 선택해 주세요',
    delivery_date: !form.delivery_date && '납품일자를 선택해 주세요',
    cable_length:  !form.cable_length && '케이블 길이를 선택해 주세요',
    station_id:    false,
    router_no:     false,
    usim_no:       form.usim_no && form.usim_no.length < 19 && 'ICCID는 19~20자리 숫자여야 합니다',
    install_address: false,
  };
  const hasErr = Object.values(errors).some(Boolean);
  const filled = Object.entries(form).filter(([k, v]) => v).length;
  const completionPct = Math.round((filled / 9) * 100);

  const submit = () => {
    setTouched({ customer_name: 1, customer_manager: 1, model_name: 1, delivery_date: 1, cable_length: 1, station_id: 1, router_no: 1, usim_no: 1, install_address: 1 });
    setShowAll(true);
    if (hasErr) return;
    if (isEdit) {
      const ok = window.actions.updateOrder(editing.order_id, form);
      if (ok) window.actions.setView('waiting');
      return;
    }
    window.actions.addOrder(form);
    setForm(empty);
    setTouched({});
    setShowAll(false);
  };

  const showErr = (k) => (showAll || touched[k]) && errors[k];
  const selectedMgr = managers.find(mgr => mgr.display === form.customer_manager || mgr.name === form.customer_manager) || null;

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">영업 부서 · {isEdit ? `오더 #${editing.order_id} 수정` : '신규 오더 등록'}</div>
          <h1 className="screen__title">{isEdit ? '오더 정보 수정' : '신규 오더 입력'}</h1>
          <p className="screen__sub">
            {isEdit
              ? <>생산대기 상태의 오더만 수정할 수 있습니다. 변경 후 <strong>수정 저장</strong>을 누르세요.</>
              : <>발주 정보를 입력하면 즉시 <strong>생산 대기</strong> 큐에 등록됩니다.</>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-3)' }}>
            <span>입력 진행률</span>
            <div style={{ width: 100, height: 6, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${completionPct}%`, height: '100%', background: 'var(--primary)', transition: 'width 240ms' }}/>
            </div>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-1)', fontWeight: 500 }}>{completionPct}%</span>
          </div>
          {isEdit && (
            <button className="btn btn--secondary" onClick={() => setShowHistory(true)}>
              <Icon name="clock" size={13}/> 수정 이력
            </button>
          )}
          {isEdit ? (
            <button className="btn btn--secondary" onClick={() => { window.actions.cancelEdit(); window.actions.setView('waiting'); }}>
              <Icon name="arrow-left" size={13}/> 취소
            </button>
          ) : (
            <button className="btn btn--secondary" onClick={() => { setForm(empty); setTouched({}); setShowAll(false); }}>
              <Icon name="refresh" size={13}/> 초기화
            </button>
          )}
          <button className="btn btn--primary btn--lg" onClick={submit} disabled={hasErr && showAll}>
            <Icon name={isEdit ? 'check' : 'save'} size={14}/> {isEdit ? '수정 저장' : '오더 등록'}
          </button>
        </div>
      </div>

      <div className="sales-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, alignItems: 'start' }}>
        <div className="card-grid">
          {/* Section 1 — 발주 정보 */}
          <div className="card">
            <div className="card__head">
              <h3 className="card__title">
                <span className="section-title__num">1</span>
                발주 정보
              </h3>
              <span className="card__sub">고객사 · 모델 · 납기</span>
            </div>
            <div className="card__body">
              <div className="form-grid">
                <div className="field">
                  <label className="field__label">고객사 <span className="field__req">*</span><span className="helpdot" title="자주 사용하는 고객사는 드롭다운에서 선택">?</span></label>
                  <div className="mgr-field">
                    <ComboField value={form.customer_name}
                                onChange={(v) => { setForm(f => ({ ...f, customer_name: v, customer_manager: '' })); setTouched((t) => ({ ...t, customer_name: 1 })); }}
                                options={window.MASTER.CUSTOMERS}
                                placeholder="고객사명 입력 또는 선택"
                                error={showErr('customer_name')}
                                metaKey="last"/>
                    <button type="button" className="btn btn--secondary mgr-field__manage"
                            onClick={() => setShowAddCustomer(true)}
                            title="신규 고객사 등록">
                      <Icon name="plus" size={13}/> 추가
                    </button>
                    <button type="button" className="btn btn--secondary mgr-field__manage"
                            onClick={() => setShowCustomerMgr(true)}
                            title="고객사 목록 관리">
                      <Icon name="settings" size={13}/> 관리
                    </button>
                  </div>
                  {showErr('customer_name') && <div className="field__err"><Icon name="alert" size={12}/> {errors.customer_name}</div>}
                </div>
                <div className="field">
                  <label className="field__label">고객사 담당자 <span className="field__req">*</span><span className="helpdot" title="고객사별 담당자는 DB(tb_customer_manager)에서 관리됩니다">?</span></label>
                  <div className="mgr-field">
                    <ComboField value={form.customer_manager}
                                onChange={(v) => { update('customer_manager', v); setTouched((t) => ({ ...t, customer_manager: 1 })); }}
                                options={managers}
                                placeholder={form.customer_name ? '담당자 선택 또는 입력' : '고객사를 먼저 선택하세요'}
                                error={showErr('customer_manager')}
                                displayKey="display"
                                metaKey="email"/>
                    <button type="button" className="btn btn--secondary mgr-field__manage"
                            onClick={() => {
                              if (!form.customer_name) { window.actions.flashToast('고객사를 먼저 선택해 주세요', 'error'); return; }
                              setShowMgr(true);
                            }}
                            title="고객사 담당자 관리">
                      <Icon name="user" size={13}/> 관리
                    </button>
                  </div>
                  {showErr('customer_manager') && <div className="field__err"><Icon name="alert" size={12}/> {errors.customer_manager}</div>}
                  {!showErr('customer_manager') && form.customer_name && (
                    <div className="field__hint" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span><Icon name="info" size={11}/> {managers.length}명 등록됨 · 관리에서 담당자를 추가·수정할 수 있습니다</span>
                    </div>
                  )}
                </div>
                <div className="field">
                  <label className="field__label">모델 <span className="field__req">*</span></label>
                  <ComboField value={form.model_name}
                              onChange={(v) => { update('model_name', v); setTouched((t) => ({ ...t, model_name: 1 })); }}
                              options={window.MASTER.MODELS}
                              placeholder="충전기 라인업 선택"
                              error={showErr('model_name')}/>
                  {showErr('model_name') && <div className="field__err"><Icon name="alert" size={12}/> {errors.model_name}</div>}
                </div>
                <div className="field">
                  <label className="field__label">케이블 길이 <span className="field__req">*</span></label>
                  <div className="chips">
                    {window.MASTER.CABLE_LENGTHS.map(c => (
                      <button key={c}
                              type="button"
                              className={`chip ${form.cable_length === c ? 'chip--active' : ''}`}
                              onClick={() => { update('cable_length', c); setTouched((t) => ({ ...t, cable_length: 1 })); }}>
                        {c}
                      </button>
                    ))}
                  </div>
                  {showErr('cable_length') && <div className="field__err"><Icon name="alert" size={12}/> {errors.cable_length}</div>}
                </div>
                <div className="field">
                  <label className="field__label">납품일자 <span className="field__req">*</span></label>
                  <div className="input-group">
                    <input type="date"
                           className={`input ${showErr('delivery_date') ? 'input--error' : ''}`}
                           value={form.delivery_date}
                           onChange={(e) => { update('delivery_date', e.target.value); setTouched((t) => ({ ...t, delivery_date: 1 })); }}/>
                  </div>
                  {showErr('delivery_date') && <div className="field__err"><Icon name="alert" size={12}/> {errors.delivery_date}</div>}
                </div>
                <div className="field">
                  <label className="field__label">충전소 ID <span className="helpdot" title="환경부 또는 자체 관제용 충전소 고유 식별자">?</span></label>
                  <input className={`input ${showErr('station_id') ? 'input--error' : ''}`}
                         placeholder="예: CT3006"
                         style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                         value={form.station_id}
                         onChange={(e) => { update('station_id', e.target.value); setTouched((t) => ({ ...t, station_id: 1 })); }}/>
                  {showErr('station_id') && <div className="field__err"><Icon name="alert" size={12}/> {errors.station_id}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 — 통신 모듈 */}
          <div className="card">
            <div className="card__head">
              <h3 className="card__title">
                <span className="section-title__num">2</span>
                통신 모듈
              </h3>
              <span className="card__sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="wifi" size={12}/> LTE 라우터 · USIM
              </span>
            </div>
            <div className="card__body">
              <div className="form-grid">
                <div className="field">
                  <label className="field__label">라우터번호 (S/N)</label>
                  <input className={`input ${showErr('router_no') ? 'input--error' : ''}`}
                         style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                         value={form.router_no}
                         onChange={(e) => { update('router_no', e.target.value); setTouched((t) => ({ ...t, router_no: 1 })); }}/>
                </div>
                <div className="field">
                  <label className="field__label">USIM번호 (ICCID)</label>
                  <input className={`input ${showErr('usim_no') ? 'input--error' : ''}`}
                         style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                         value={form.usim_no}
                         onChange={(e) => { update('usim_no', e.target.value); setTouched((t) => ({ ...t, usim_no: 1 })); }}/>
                  {showErr('usim_no') && <div className="field__err"><Icon name="alert" size={12}/> {errors.usim_no}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3 — 설치 정보 */}
          <div className="card">
            <div className="card__head">
              <h3 className="card__title">
                <span className="section-title__num">3</span>
                설치 정보
              </h3>
              <span className="card__sub">현장 설치 주소</span>
            </div>
            <div className="card__body">
              <div className="field">
                <label className="field__label">설치주소</label>
                <AddressField value={form.install_address}
                              onChange={(v) => { update('install_address', v); setTouched((t) => ({ ...t, install_address: 1 })); }}
                              error={showErr('install_address')}/>
                <div className="field__hint"><Icon name="map-pin" size={11}/> 우편번호 검색 API 연동 — 표준화된 도로명 주소 사용</div>
                {showErr('install_address') && <div className="field__err"><Icon name="alert" size={12}/> {errors.install_address}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Side preview */}
        <aside className="sales-preview" style={{ position: 'sticky', top: 0 }}>
          <div className="card">
            <div className="card__head">
              <h3 className="card__title"><Icon name="eye" size={14}/> 입력 미리보기</h3>
            </div>
            <div className="card__body">
              <dl className="kv">
                <dt>order_id</dt>
                <dd style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>auto</dd>
                <dt>고객사</dt>
                <dd>{form.customer_name || <span style={{ color: 'var(--ink-4)' }}>—</span>}</dd>
                <dt>담당자</dt>
                <dd>{form.customer_manager || <span style={{ color: 'var(--ink-4)' }}>—</span>}</dd>
                <dt>모델</dt>
                <dd>{form.model_name || <span style={{ color: 'var(--ink-4)' }}>—</span>}</dd>
                <dt>케이블 길이</dt>
                <dd>{form.cable_length || <span style={{ color: 'var(--ink-4)' }}>—</span>}</dd>
                <dt>납품일자</dt>
                <dd style={{ fontVariantNumeric: 'tabular-nums' }}>{form.delivery_date || <span style={{ color: 'var(--ink-4)' }}>—</span>}</dd>
                <dt>충전소 ID</dt>
                <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{form.station_id || <span style={{ color: 'var(--ink-4)', fontFamily: 'inherit' }}>—</span>}</dd>
                <dt>라우터 S/N</dt>
                <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, wordBreak: 'break-all' }}>{form.router_no || <span style={{ color: 'var(--ink-4)', fontFamily: 'inherit' }}>—</span>}</dd>
                <dt>USIM</dt>
                <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, wordBreak: 'break-all' }}>{form.usim_no || <span style={{ color: 'var(--ink-4)', fontFamily: 'inherit' }}>—</span>}</dd>
                <dt>설치주소</dt>
                <dd style={{ fontSize: 12.5 }}>{form.install_address || <span style={{ color: 'var(--ink-4)' }}>—</span>}</dd>
                <dt>상태</dt>
                <dd><span className="badge badge--pending"><span className="badge__dot"/>PENDING</span></dd>
              </dl>
            </div>
          </div>
        </aside>
      </div>

      {showHistory && isEdit && (
        <OrderHistoryModal
          orderId={editing.order_id}
          onClose={() => setShowHistory(false)}/>
      )}
      {showMgr && (
        <ManagerManageModal
          customerName={form.customer_name}
          onClose={() => setShowMgr(false)}
          onChanged={(picked) => {
            const list = refreshManagers.current();
            if (picked) {
              const mgr = list.find(m => m.name === picked);
              update('customer_manager', mgr ? (mgr.display || mgr.name) : picked);
            } else if (form.customer_manager) {
              const baseName = form.customer_manager.split(' (')[0];
              if (!list.some(m => m.name === baseName || m.display === form.customer_manager)) {
                update('customer_manager', list[0] ? (list[0].display || list[0].name) : '');
              }
            }
          }}/>
      )}
      {showAddCustomer && (
        <AddCustomerModal
          onClose={() => setShowAddCustomer(false)}
          onAdded={(name) => {
            setForm(f => ({ ...f, customer_name: name, customer_manager: '' }));
            setShowAddCustomer(false);
          }}/>
      )}
      {showCustomerMgr && (
        <CustomerManageModal
          onClose={() => setShowCustomerMgr(false)}
          onChanged={() => {
            const current = window.MASTER.CUSTOMERS.find(c => c.name === form.customer_name);
            if (!current) update('customer_name', '');
          }}/>
      )}
    </div>
  );
}

/* ────────── 고객사 담당자 관리 모달 (DB: tb_customer_manager) ────────── */
function ManagerManageModal({ customerName, onClose, onChanged }) {
  const [list, setList] = useStateSI([]);
  const [draft, setDraft] = useStateSI(null); // { manager_id?, name, phone, email, is_primary }
  const [err, setErr] = useStateSI('');

  const reload = () => setList(window.PMDB.getManagers(customerName));
  useEffectSI(() => { reload(); }, [customerName]);

  const startAdd = () => { setErr(''); setDraft({ name: '', phone: '', email: '', is_primary: list.length === 0 }); };
  const startEdit = (m) => { setErr(''); setDraft({ ...m }); };

  const fmtPhone = (v) => {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return d.slice(0, 3) + '-' + d.slice(3);
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  };

  const saveDraft = () => {
    if (!draft.name.trim()) { setErr('담당자 이름을 입력하세요'); return; }
    if (draft.manager_id) {
      window.PMDB.updateManager(draft.manager_id, draft);
    } else {
      window.PMDB.addManager({ ...draft, customer_name: customerName });
    }
    reload();
    onChanged && onChanged(draft.name);
    setDraft(null);
  };

  const remove = (m) => {
    window.PMDB.deleteManager(m.manager_id);
    reload();
    onChanged && onChanged(null);
  };

  const makePrimary = (m) => {
    window.PMDB.updateManager(m.manager_id, { ...m, is_primary: 1 });
    reload();
    onChanged && onChanged(m.name);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 520, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h3 className="modal__title">고객사 담당자 관리</h3>
          <p className="modal__sub"><strong style={{ color: 'var(--ink-1)' }}>{customerName}</strong> · tb_customer_manager</p>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="mgr-list">
            {list.length === 0 && (
              <div className="emptystate" style={{ padding: '20px 0' }}>
                <div className="emptystate__title">등록된 담당자가 없습니다</div>
                <div className="emptystate__sub">아래 ‘담당자 추가’로 등록하세요</div>
              </div>
            )}
            {list.map(m => (
              <div key={m.manager_id} className="mgr-row">
                <div className="mgr-row__main">
                  <div className="mgr-row__name">
                    {m.name}
                    {!!m.is_primary && <span className="badge badge--info" style={{ marginLeft: 6 }}>대표</span>}
                  </div>
                  <div className="mgr-row__meta">
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{m.phone || '—'}</span>
                    {m.email && <span style={{ color: 'var(--ink-4)' }}> · {m.email}</span>}
                  </div>
                </div>
                <div className="mgr-row__actions">
                  {!m.is_primary && <button className="btn btn--ghost btn--sm" onClick={() => makePrimary(m)}>대표 지정</button>}
                  <button className="btn btn--secondary btn--sm" onClick={() => startEdit(m)}>수정</button>
                  <button className="btn btn--ghost btn--sm btn--icon" aria-label="삭제" onClick={() => remove(m)}><Icon name="x" size={14}/></button>
                </div>
              </div>
            ))}
          </div>

          {draft ? (
            <div className="mgr-edit">
              <div className="mgr-edit__title">{draft.manager_id ? '담당자 수정' : '담당자 추가'}</div>
              <div className="form-grid">
                <div className="field">
                  <label className="field__label">이름 <span className="field__req">*</span></label>
                  <input className="input" autoFocus value={draft.name}
                         onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}/>
                </div>
                <div className="field">
                  <label className="field__label">휴대폰</label>
                  <input className="input" style={{ fontFamily: 'var(--font-mono)' }} placeholder="010-0000-0000"
                         value={draft.phone}
                         onChange={(e) => setDraft(d => ({ ...d, phone: fmtPhone(e.target.value) }))}/>
                </div>
                <div className="field col-span-2">
                  <label className="field__label">이메일</label>
                  <input className="input" placeholder="name@company.com" value={draft.email}
                         onChange={(e) => setDraft(d => ({ ...d, email: e.target.value }))}/>
                </div>
              </div>
              <label className="mgr-edit__primary">
                <input type="checkbox" checked={!!draft.is_primary}
                       onChange={(e) => setDraft(d => ({ ...d, is_primary: e.target.checked }))}/>
                대표 담당자로 지정
              </label>
              {err && <div className="field__err"><Icon name="alert" size={12}/> {err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn btn--secondary btn--sm" onClick={() => { setDraft(null); setErr(''); }}>취소</button>
                <button className="btn btn--primary btn--sm" onClick={saveDraft}><Icon name="check" size={13}/> 저장</button>
              </div>
            </div>
          ) : (
            <button className="btn btn--secondary" style={{ alignSelf: 'flex-start' }} onClick={startAdd}>
              <Icon name="plus" size={13}/> 담당자 추가
            </button>
          )}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ────────── 수정 이력 모달 (DB: tb_order_history) ────────── */
function OrderHistoryModal({ orderId, onClose }) {
  const [history, setHistory] = useStateSI([]);

  useEffectSI(() => {
    if (orderId) setHistory(window.PMDB.getHistory(orderId));
  }, [orderId]);

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 560, maxWidth: '96vw' }}>
        <div className="modal__head">
          <h3 className="modal__title"><Icon name="clock" size={14}/> 수정 이력</h3>
          <p className="modal__sub">오더 #{orderId} · tb_order_history · {history.length}건</p>
        </div>
        <div className="modal__body" style={{ maxHeight: 440, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {history.length === 0 && (
            <div className="emptystate" style={{ padding: '24px 0' }}>
              <div className="emptystate__title">수정 이력이 없습니다</div>
              <div className="emptystate__sub">이 오더에 대한 변경 이력이 아직 없습니다</div>
            </div>
          )}
          {history.map((h, i) => (
            <div key={h.history_id} style={{ padding: '14px 0', borderBottom: i < history.length - 1 ? '1px solid var(--border-1)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${h.action === 'create' ? 'badge--info' : 'badge--pending'}`}>
                    <span className="badge__dot"/>
                    {h.action === 'create' ? '최초 등록' : '수정'}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--ink-1)', fontSize: 13 }}>{h.changed_by}</span>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>{h.changed_at}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
                {(h.changed_fields || []).map((f) => (
                  <div key={f.field} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, alignItems: 'start', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--ink-3)', paddingTop: 1 }}>{f.label}</span>
                    {h.action === 'create' ? (
                      <span style={{ color: 'var(--ink-1)', wordBreak: 'break-all' }}>{f.after || '—'}</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: '#DC2626', textDecoration: 'line-through', wordBreak: 'break-all' }}>{f.before || '—'}</span>
                        <span style={{ color: 'var(--ink-4)' }}>→</span>
                        <span style={{ color: 'var(--success-700)', wordBreak: 'break-all' }}>{f.after || '—'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ────────── 고객사 추가 모달 ────────── */
function AddCustomerModal({ onClose, onAdded }) {
  const [name, setName] = useStateSI('');
  const [code, setCode] = useStateSI('');
  const [err, setErr] = useStateSI('');

  const save = () => {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedName) { setErr('고객사명을 입력하세요'); return; }
    if (!trimmedCode) { setErr('코드를 입력하세요'); return; }
    if (window.MASTER.CUSTOMERS.find(c => c.name === trimmedName)) {
      setErr('이미 등록된 고객사명입니다'); return;
    }
    if (window.MASTER.CUSTOMERS.find(c => c.code === trimmedCode)) {
      setErr('이미 사용 중인 코드입니다'); return;
    }
    const today = new Date().toISOString().slice(0, 10);
    window.MASTER.CUSTOMERS.push({ name: trimmedName, code: trimmedCode, last: today });
    onAdded && onAdded(trimmedName);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 400, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h3 className="modal__title">고객사 추가</h3>
          <p className="modal__sub">신규 고객사를 마스터 목록에 등록합니다</p>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field__label">고객사명 <span className="field__req">*</span></label>
            <input className="input" autoFocus value={name}
                   onChange={(e) => { setName(e.target.value); setErr(''); }}
                   placeholder="예: (주)에이비씨"/>
          </div>
          <div className="field">
            <label className="field__label">코드 <span className="field__req">*</span></label>
            <input className="input" style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                   value={code}
                   onChange={(e) => { setCode(e.target.value); setErr(''); }}
                   placeholder="예: CASTPRO"
                   onKeyDown={(e) => e.key === 'Enter' && save()}/>
          </div>
          {err && <div className="field__err"><Icon name="alert" size={12}/> {err}</div>}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>취소</button>
          <button className="btn btn--primary" onClick={save}><Icon name="check" size={13}/> 추가</button>
        </div>
      </div>
    </div>
  );
}

/* ────────── 고객사 마스터 관리 모달 ────────── */
function CustomerManageModal({ onClose, onChanged }) {
  const [list, setList] = useStateSI([...window.MASTER.CUSTOMERS]);
  const [draft, setDraft] = useStateSI(null); // { idx, name, code }
  const [err, setErr] = useStateSI('');

  const reload = () => setList([...window.MASTER.CUSTOMERS]);

  const startEdit = (c, idx) => { setErr(''); setDraft({ idx, name: c.name, code: c.code }); };

  const saveDraft = () => {
    const trimmedName = draft.name.trim();
    const trimmedCode = draft.code.trim().toUpperCase();
    if (!trimmedName) { setErr('고객사명을 입력하세요'); return; }
    if (!trimmedCode) { setErr('코드를 입력하세요'); return; }
    const dupName = window.MASTER.CUSTOMERS.findIndex(c => c.name === trimmedName);
    if (dupName !== -1 && dupName !== draft.idx) { setErr('이미 등록된 고객사명입니다'); return; }
    const dupCode = window.MASTER.CUSTOMERS.findIndex(c => c.code === trimmedCode);
    if (dupCode !== -1 && dupCode !== draft.idx) { setErr('이미 사용 중인 코드입니다'); return; }
    window.MASTER.CUSTOMERS[draft.idx] = { ...window.MASTER.CUSTOMERS[draft.idx], name: trimmedName, code: trimmedCode };
    reload();
    onChanged && onChanged();
    setDraft(null);
  };

  const remove = (idx) => {
    window.MASTER.CUSTOMERS.splice(idx, 1);
    reload();
    onChanged && onChanged();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 520, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h3 className="modal__title">고객사 관리</h3>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="mgr-list">
            {list.length === 0 && (
              <div className="emptystate" style={{ padding: '20px 0' }}>
                <div className="emptystate__title">등록된 고객사가 없습니다</div>
              </div>
            )}
            {list.map((c, idx) => (
              <div key={c.code || idx} className="mgr-row">
                <div className="mgr-row__main">
                  <div className="mgr-row__name">{c.name}</div>
                  <div className="mgr-row__meta">
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{c.code}</span>
                    {c.last && <span style={{ color: 'var(--ink-4)' }}> · {c.last}</span>}
                  </div>
                </div>
                <div className="mgr-row__actions">
                  <button className="btn btn--secondary btn--sm" onClick={() => startEdit(c, idx)}>수정</button>
                </div>
              </div>
            ))}
          </div>

          {draft && (
            <div className="mgr-edit">
              <div className="mgr-edit__title">고객사 수정</div>
              <div className="form-grid">
                <div className="field">
                  <label className="field__label">고객사명 <span className="field__req">*</span></label>
                  <input className="input" autoFocus value={draft.name}
                         onChange={(e) => { setDraft(d => ({ ...d, name: e.target.value })); setErr(''); }}/>
                </div>
                <div className="field">
                  <label className="field__label">코드 <span className="field__req">*</span></label>
                  <input className="input" style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                         value={draft.code}
                         onChange={(e) => { setDraft(d => ({ ...d, code: e.target.value })); setErr(''); }}/>
                </div>
              </div>
              {err && <div className="field__err"><Icon name="alert" size={12}/> {err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn btn--secondary btn--sm" onClick={() => { setDraft(null); setErr(''); }}>취소</button>
                <button className="btn btn--primary btn--sm" onClick={saveDraft}><Icon name="check" size={13}/> 저장</button>
              </div>
            </div>
          )}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

window.SalesInputScreen = SalesInputScreen;
