// 생산 부서 입력 화면 (Production Mapping Dashboard)

const { useState: useStatePM, useMemo: useMemoPM } = React;

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

  if (order.status === 'COMPLETED') return <CompletedView order={order}/>;
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">입력 완료</div>
          <h1 className="screen__title">
            오더 #{order.order_id} · <span style={{ color: 'var(--success-700)' }}>생산완료</span>
          </h1>
          <p className="screen__sub">이미 생산이 완료된 오더입니다. 출하 검사 성적서가 발급되었습니다.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--secondary" onClick={() => {
            if (confirm(`오더 #${order.order_id}을(를) 생산대기 상태로 되돌릴까요?\n생산 실적은 보존되며 다시 수정할 수 있습니다.`)) {
              window.actions.revertOrder(order.order_id);
              window.actions.setView('waiting');
            }
          }}>
            <Icon name="refresh" size={13}/> 생산대기로 변경
          </button>
          <button className="btn btn--secondary" onClick={() => window.actions.setView('waiting')}>
            <Icon name="arrow-left" size={13}/> 목록으로
          </button>
        </div>
      </div>
      <SalesReadOnly order={order}/>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__head">
          <h3 className="card__title">
            <Icon name="factory" size={14}/> 생산 실적 (tb_production_info)
          </h3>
          <span className="badge badge--complete"><Icon name="check" size={10}/>저장됨</span>
        </div>
        <div className="card__body">
          <div className="form-grid form-grid--3">
            <KvCell k="생산일자" v={order.production.prod_date} icon="calendar"/>
            <KvCell k="로트" v={order.production.lot_no} mono icon="package"/>
            <KvCell k="시리얼" v={order.production.serial_no} mono icon="cpu"/>
            <KvCell k="검정일자" v={order.production.inspection_date} icon="shield"/>
            <KvCell k="S/W 버전" v={order.production.sw_version} mono icon="bolt"/>
            <KvCell k="케이블 길이" v={order.production.cable_length} icon="cable"/>
            <KvCell k="문서번호" v={order.production.doc_no} mono icon="doc"/>
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
      <div className="input input--readonly" style={{ display: 'flex', alignItems: 'center', fontFamily: mono ? 'var(--font-mono)' : 'inherit', fontSize: mono ? 12.5 : 13.5 }}>
        {v}
      </div>
    </div>
  );
}

function SalesReadOnly({ order }) {
  return (
    <div className="readonly-strip">
      <div className="readonly-strip__hd">
        <div className="readonly-strip__lbl">
          <Icon name="cart" size={12}/> 영업 입력 정보 · 읽기 전용
        </div>
      </div>
      <div className="readonly-strip__grid">
        <Cell k="고객사" v={order.customer_name}/>
        <Cell k="모델" v={order.model_name}/>
        <Cell k="납품일자" v={order.delivery_date} mono/>
        <Cell k="충전소 ID" v={order.station_id} mono/>
        <Cell k="라우터 S/N" v={order.router_no} mono/>
        <Cell k="USIM (ICCID)" v={order.usim_no} mono/>
        <div className="readonly-strip__cell" style={{ gridColumn: 'span 2' }}>
          <div className="readonly-strip__cell__k">설치주소</div>
          <div className="readonly-strip__cell__v">{order.install_address}</div>
        </div>
      </div>
    </div>
  );
}

function Cell({ k, v, mono }) {
  return (
    <div className="readonly-strip__cell">
      <div className="readonly-strip__cell__k">{k}</div>
      <div className={`readonly-strip__cell__v ${mono ? 'readonly-strip__cell__v--mono' : ''}`}>{v}</div>
    </div>
  );
}

function MappingForm({ order }) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const suggestSerial = useMemoPM(() => {
    // SGT + power code + YYMMDD + 2-digit seq + letter
    const power = (order.model_name.match(/(\d+)kW/) || ['', '050'])[1].padStart(3, '0');
    const ymd = todayISO.replace(/-/g, '').slice(2);
    return `SGT${power}K-${ymd}01A`;
  }, [order]);

  const [form, setForm] = useStatePM(() => {
    const ex = order.production || {};
    return {
      prod_date: ex.prod_date || todayISO,
      lot_no: ex.lot_no || '',
      serial_no: ex.serial_no || '',
      inspection_date: ex.inspection_date || '',
      sw_version: ex.sw_version || '',
      cable_length: ex.cable_length || '',
      doc_no: ex.doc_no || '',
    };
  });
  const [touched, setTouched] = useStatePM({});
  const [showAll, setShowAll] = useStatePM(false);
  const [dupState, setDupState] = useStatePM(order.production ? 'ok' : null); // null | 'checking' | 'ok' | 'dup'
  const [swVersions, setSwVersions] = useStatePM(() => {
    try { const s = localStorage.getItem('pm_sw_versions'); if (s) return JSON.parse(s); } catch {}
    return window.MASTER.SW_VERSIONS;
  });
  const [addingVer, setAddingVer] = useStatePM(false);
  const [newVerTag, setNewVerTag] = useStatePM('');
  const [newVerStable, setNewVerStable] = useStatePM(true);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
      const dup = window.EXISTING_SERIALS.has(form.serial_no) || window.PMDB.serialExists(form.serial_no);
      setDupState(dup ? 'dup' : 'ok');
    }, 600);
  };

  const useSuggestion = () => {
    update('serial_no', suggestSerial);
    setDupState(null);
  };

  const addVersion = () => {
    const tag = newVerTag.trim();
    if (!tag) return;
    const ver = { tag, released: todayISO, stable: newVerStable };
    const next = [ver, ...swVersions];
    window.MASTER.SW_VERSIONS = next;
    setSwVersions(next);
    localStorage.setItem('pm_sw_versions', JSON.stringify(next));
    update('sw_version', tag);
    setTouched(t => ({ ...t, sw_version: 1 }));
    setAddingVer(false);
    setNewVerTag('');
  };

  const errors = {
    prod_date: !form.prod_date && '생산일자를 선택하세요',
    lot_no: !form.lot_no && '로트번호를 입력하세요',
    serial_no: !form.serial_no ? '시리얼을 입력하세요' : (dupState === 'dup' ? '이미 사용된 시리얼입니다' : null),
    inspection_date: !form.inspection_date && '검정일자를 선택하세요',
    sw_version: !form.sw_version && 'S/W 버전을 선택하세요',
    cable_length: !form.cable_length && '케이블 길이를 선택하세요',
    doc_no: !form.doc_no && '문서번호를 입력하세요',
  };
  const hasErr = Object.values(errors).some(Boolean);
  const filled = Object.values(form).filter(Boolean).length;

  const submit = () => {
    setShowAll(true);
    setTouched({ prod_date: 1, lot_no: 1, serial_no: 1, inspection_date: 1, sw_version: 1, cable_length: 1, doc_no: 1 });
    if (hasErr) return;
    if (dupState === null && form.serial_no) {
      // Force check if not yet done
      if (window.EXISTING_SERIALS.has(form.serial_no) || window.PMDB.serialExists(form.serial_no)) {
        setDupState('dup');
        return;
      }
    }
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
          <p className="screen__sub">상단의 영업 정보를 확인 후 하단 7개 항목을 채워주세요. 완료 시 자동으로 <strong>생산완료</strong> 상태로 전환됩니다.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
            <span style={{ fontWeight: 600, color: 'var(--ink-1)' }}>{filled}</span>/7 항목 입력
          </span>
          <button className="btn btn--ghost btn--sm" onClick={() => {
            if (confirm(`오더 #${order.order_id}을(를) 생산대기로 되돌릴까요?`)) {
              window.actions.revertOrder(order.order_id);
            }
          }}>
            <Icon name="refresh" size={12}/> 대기로
          </button>
          <button className="btn btn--secondary" onClick={() => window.actions.setView('waiting')}>
            <Icon name="arrow-left" size={13}/> 목록
          </button>
          <button className="btn btn--success btn--lg" onClick={submit}>
            <Icon name="check" size={14}/> 생산완료 등록
          </button>
        </div>
      </div>

      <SalesReadOnly order={order}/>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__head">
          <h3 className="card__title">
            <Icon name="factory" size={14}/> 생산 실적 입력
          </h3>
          <span className="card__sub">tb_production_info · 7 columns</span>
        </div>
        <div className="card__body">
          <div className="form-grid form-grid--3">
            {/* 생산일자 */}
            <div className="field">
              <label className="field__label"><Icon name="calendar" size={11}/>생산일자 <span className="field__req">*</span></label>
              <input type="date"
                     className={`input ${showErr('prod_date') ? 'input--error' : ''}`}
                     value={form.prod_date}
                     onChange={(e) => { update('prod_date', e.target.value); setTouched(t => ({ ...t, prod_date: 1 })); update('lot_no', ''); }}/>
              <div className="field__hint">공장 조립 및 최종 자체 검사 완료일</div>
              {showErr('prod_date') && <div className="field__err"><Icon name="alert" size={12}/>{errors.prod_date}</div>}
            </div>

            {/* 로트 */}
            <div className="field">
              <label className="field__label"><Icon name="package" size={11}/>로트번호 <span className="field__req">*</span></label>
              <input className={`input ${showErr('lot_no') ? 'input--error' : ''}`}
                     style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                     placeholder="예: L26-W22-A"
                     value={form.lot_no}
                     onChange={(e) => { update('lot_no', e.target.value); setTouched(t => ({ ...t, lot_no: 1 })); }}/>
              <div className="field__hint">생산일자 기준 자동 제안 · 수정 가능</div>
              {showErr('lot_no') && <div className="field__err"><Icon name="alert" size={12}/>{errors.lot_no}</div>}
            </div>

            {/* 시리얼 */}
            <div className="field">
              <label className="field__label"><Icon name="cpu" size={11}/>시리얼 <span className="field__req">*</span></label>
              <div className="input-group">
                <input className={`input ${showErr('serial_no') ? 'input--error' : ''}`}
                       style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}
                       placeholder="예: SGT100K-26052801A"
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
                        style={{ background: 'transparent', border: 0, color: 'var(--primary-600)', cursor: 'pointer', padding: 0, fontSize: 11.5, fontWeight: 500, textDecoration: 'underline' }}>
                  추천: {suggestSerial}
                </button>
              </div>
              {showErr('serial_no') && dupState !== 'dup' && <div className="field__err"><Icon name="alert" size={12}/>{errors.serial_no}</div>}
            </div>

            {/* 검정일자 */}
            <div className="field">
              <label className="field__label"><Icon name="shield" size={11}/>검정일자 <span className="field__req">*</span></label>
              <input type="date"
                     className={`input ${showErr('inspection_date') ? 'input--error' : ''}`}
                     value={form.inspection_date}
                     onChange={(e) => { update('inspection_date', e.target.value); setTouched(t => ({ ...t, inspection_date: 1 })); }}/>
              <div className="field__hint">KTC 등 공인기관 형식승인 · 검정 완료일</div>
              {showErr('inspection_date') && <div className="field__err"><Icon name="alert" size={12}/>{errors.inspection_date}</div>}
            </div>

            {/* S/W 버전 */}
            <div className="field col-span-2">
              <label className="field__label"><Icon name="bolt" size={11}/>S/W 버전 <span className="field__req">*</span></label>
              <div className="tagpicker">
                {swVersions.map(v => (
                  <button key={v.tag}
                          type="button"
                          className={`tagpicker__item ${form.sw_version === v.tag ? 'tagpicker__item--active' : ''} ${!v.stable && form.sw_version !== v.tag ? 'tagpicker__item--beta' : ''}`}
                          onClick={() => { update('sw_version', v.tag); setTouched(t => ({ ...t, sw_version: 1 })); }}>
                    <Icon name="tag" size={10}/>{v.tag}
                    {!v.stable && <span style={{ fontSize: 9.5, opacity: 0.8 }}>BETA</span>}
                  </button>
                ))}
                <button type="button"
                        className={`tagpicker__item tagpicker__item--add ${addingVer ? 'tagpicker__item--active' : ''}`}
                        onClick={() => { setAddingVer(v => !v); setNewVerTag(''); }}>
                  <Icon name="plus" size={10}/> 버전 추가
                </button>
              </div>
              {addingVer && (
                <div className="ver-add-row">
                  <input
                    className="input"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}
                    placeholder="예: v1.8.0-core"
                    value={newVerTag}
                    onChange={e => setNewVerTag(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addVersion(); if (e.key === 'Escape') setAddingVer(false); }}
                    autoFocus
                  />
                  <label className="ver-add-row__toggle">
                    <input type="checkbox" checked={newVerStable} onChange={e => setNewVerStable(e.target.checked)}/>
                    정식(stable)
                  </label>
                  <button type="button" className="btn btn--primary btn--sm" onClick={addVersion} disabled={!newVerTag.trim()}>
                    <Icon name="plus" size={12}/> 추가
                  </button>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setAddingVer(false); setNewVerTag(''); }}>
                    취소
                  </button>
                </div>
              )}
              <div className="field__hint">목록에서 선택하거나 <strong>버전 추가</strong>로 직접 등록 (localStorage 저장)</div>
              {showErr('sw_version') && <div className="field__err"><Icon name="alert" size={12}/>{errors.sw_version}</div>}
            </div>

            {/* 케이블 길이 */}
            <div className="field">
              <label className="field__label"><Icon name="cable" size={11}/>케이블 길이 <span className="field__req">*</span></label>
              <div className="chips">
                {window.MASTER.CABLE_LENGTHS.map(c => (
                  <button key={c}
                          type="button"
                          className={`chip ${form.cable_length === c ? 'chip--active' : ''}`}
                          onClick={() => { update('cable_length', c); setTouched(t => ({ ...t, cable_length: 1 })); }}>
                    {c}
                  </button>
                ))}
              </div>
              {showErr('cable_length') && <div className="field__err"><Icon name="alert" size={12}/>{errors.cable_length}</div>}
            </div>

            {/* 문서번호 */}
            <div className="field col-span-2">
              <label className="field__label"><Icon name="doc" size={11}/>문서번호 (출하 검사 성적서) <span className="field__req">*</span></label>
              <input className={`input ${showErr('doc_no') ? 'input--error' : ''}`}
                     style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                     placeholder="예: QC-26-0528-A"
                     value={form.doc_no}
                     onChange={(e) => { update('doc_no', e.target.value); setTouched(t => ({ ...t, doc_no: 1 })); }}/>
              <div className="field__hint">출하 검사 성적서 · 공장인도증서 관리 번호</div>
              {showErr('doc_no') && <div className="field__err"><Icon name="alert" size={12}/>{errors.doc_no}</div>}
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink-3)' }}>
              <Icon name="lock" size={13}/>
              저장 시 시리얼 번호 Unique 제약 검증 · 검정 유효기간 자동 계산
            </div>
            <button className="btn btn--success btn--lg" onClick={submit}>
              <Icon name="check" size={14}/> 생산완료 등록 · 출하 큐로 이동
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ProductionMappingScreen = ProductionMappingScreen;
