// 생산완료 / 출하 관리 화면 — 완료 오더 목록 + 성적서 + CSV 내보내기

const { useState: useStatePC, useMemo: useMemoPC } = React;

const TODAY_PC = new Date();

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => {
    const s = String(c == null ? '' : c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
  // BOM for Excel Korean
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ProductionCompleteScreen() {
  const s = window.useStore();
  const [search, setSearch] = useStatePC('');
  const [filterModel, setFilterModel] = useStatePC('all');
  const [report, setReport] = useStatePC(null);
  const [shipInspections, setShipInspections] = useStatePC(() => {
    // tb_ship_inspection DB 캐시만 사용 — localStorage(pm_ship_inspections) 무시
    const m = new Map();
    try {
      (window.PMDB?.backend?.cache?.ship_inspections || []).forEach(r => {
        m.set(r.order_id, {
          insp_date: r.insp_date, inspector: r.inspector,
          checks: JSON.parse(r.checks || '{}'), notes: r.notes || '', saved_at: r.saved_at,
        });
      });
    } catch(_) {}
    return m;
  });
  const [shipInspectOrder, setShipInspectOrder] = useStatePC(null);
  const [shipReport, setShipReport] = useStatePC(null);
  const [models, setModels] = useStatePC(() => window.PMDB.getModels());
  const [selectedIds, setSelectedIds] = useStatePC(() => new Set());

  React.useEffect(() => {
    const sync = () => setModels(window.PMDB.getModels());
    window.addEventListener('masterLoaded', sync);
    return () => window.removeEventListener('masterLoaded', sync);
  }, []);

  const saveShipInspection = React.useCallback((orderId, data) => {
    window.setShipInspection(orderId, data);
    setShipInspections(prev => { const next = new Map(prev); next.set(orderId, data); return next; });
  }, []);

  const handleShipComplete = React.useCallback((orderId) => {
    window.actions.showConfirm(
      `오더 #${orderId}을(를) 출하 완료 처리할까요?\n생산완료 상태로 전환되어 출하대기 목록에서 제외됩니다.`,
      () => {
        const ord = (window.__pm_store__?.orders || []).find(o => o.order_id === orderId);
        window.actions.shipOrder(orderId);
        if (ord?.production?.serial_no) {
          window.PMDB.addChargepoint({
            serial_no:       ord.production.serial_no,
            model_name:      ord.model_name      || '',
            order_id:        String(orderId),
            install_address: ord.install_address || '',
            created:         new Date().toISOString().slice(0, 10),
          });
        }
      },
      { confirmLabel: '출하 완료' }
    );
  }, []);

  const handleBulkShipComplete = React.useCallback((orderIds) => {
    if (!orderIds || orderIds.length === 0) return;
    window.actions.showConfirm(
      `선택한 ${orderIds.length}건을 일괄 출하 완료 처리할까요?\n생산완료 상태로 전환되어 출하대기 목록에서 제외됩니다.`,
      () => {
        const all = window.__pm_store__?.orders || [];
        orderIds.forEach(orderId => {
          const ord = all.find(o => o.order_id === orderId);
          window.actions.shipOrder(orderId);
          if (ord?.production?.serial_no) {
            window.PMDB.addChargepoint({
              serial_no:       ord.production.serial_no,
              model_name:      ord.model_name      || '',
              order_id:        String(orderId),
              install_address: ord.install_address || '',
              created:         new Date().toISOString().slice(0, 10),
            });
          }
        });
        window.actions.flashToast(`${orderIds.length}건 일괄 출하 완료 처리되었습니다`, 'success');
        setSelectedIds(new Set());
      },
      { confirmLabel: `${orderIds.length}건 출하 완료` }
    );
  }, []);

  const completed = useMemoPC(
    () => s.orders.filter(o => o.status === 'AWAIT_PICKUP' && o.production?.serial_no),
    [s.orders]
  );

  // s.orders 변경 시에만 재계산 — search 키 입력마다 getShipPhotos를 다시 부르지 않도록 별도 메모
  const shipPhotoCounts = useMemoPC(() => {
    const map = new Map();
    completed.forEach(o => {
      map.set(o.order_id, window.PMDB?.getShipPhotos?.(o.order_id)?.length || 0);
    });
    return map;
  }, [completed]);

  const filtered = useMemoPC(() => {
    return completed.filter(o => {
      if (filterModel !== 'all') {
        // model_name에 코드가 저장된 오더도 표시명 기준 필터에 매칭
        const mName = window.findModelInfo(o.model_name)?.model || o.model_name;
        if (mName !== filterModel) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay = [o.customer_name, o.model_name, o.station_id, o.production.serial_no, o.production.lot_no, o.production.doc_no, String(o.order_id)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [completed, search, filterModel]);

  // ── 출하검사 완료건 다중선택 → 일괄 출하완료 ──────────────────────
  const isShipAllDone = React.useCallback((o) => {
    const insp = shipInspections.get(o.order_id);
    return !!insp && Object.keys(insp.checks || {}).length > 0 &&
      Object.values(insp.checks || {}).every(v => v === true || (typeof v === 'string' && v.trim() !== ''));
  }, [shipInspections]);

  const eligibleIds = useMemoPC(
    () => filtered.filter(isShipAllDone).map(o => o.order_id),
    [filtered, isShipAllDone]
  );

  const toggleSelect = (orderId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => (prev.size === eligibleIds.length ? new Set() : new Set(eligibleIds)));
  };

  // KPIs
  const weekStart = startOfWeek(TODAY_PC);
  const thisWeek = completed.filter(o => new Date(o.production.prod_date) >= weekStart).length;
  const weekStartLabel = `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일(월)`;
  const avgLead = completed.length
    ? Math.round(completed.reduce((a, o) => a + daysBetween(o.created, o.production.prod_date), 0) / completed.length)
    : 0;
  const inspected = completed.filter(o => o.production.inspection_date);
  const avgQc = inspected.length
    ? (inspected.reduce((a, o) => a + Math.max(0, daysBetween(o.production.prod_date, o.production.inspection_date)), 0) / inspected.length).toFixed(1)
    : 0;

  const exportCSV = () => {
    const header = ['오더번호', '고객사', '모델', '충전소ID', '생산일자', '로트', '시리얼', '검정일자', 'S/W버전', 'F/W버전', '케이블', '납품일자'];
    const rows = [header, ...filtered.map(o => ([
      o.order_id, o.customer_name, o.model_name, o.station_id,
      o.production.prod_date, o.production.lot_no, o.production.serial_no,
      o.production.inspection_date, o.production.sw_version, o.production.fw_version,
      o.cable_length, o.delivery_date,
    ]))];
    downloadCSV(rows, `출하대기_${new Date().toISOString().slice(0, 10)}.csv`);
    window.actions.flashToast?.(`${filtered.length}건 CSV 내보내기 완료`);
  };

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">생산 부서 · 품질 부서</div>
          <h1 className="screen__title">출하대기 목록</h1>
          <p className="screen__sub">생산·검정이 완료되어 출하 대기 중인 오더입니다. 기능·출하 검사 성적서를 조회하거나 출하 처리를 진행할 수 있습니다.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--secondary" onClick={exportCSV} disabled={filtered.length === 0}>
            <Icon name="download" size={14}/> CSV 내보내기
          </button>
        </div>
      </div>

      <div className="statrow">
        <div className="stat">
          <div className="stat__top">
            <span className="stat__label">총 출하대기</span>
            <span className="stat__icon stat__icon--success"><Icon name="check" size={15}/></span>
          </div>
          <div className="stat__value">{completed.length}<small>건</small></div>
          <div className="stat__foot">기능 검사 성적서 발급 완료</div>
        </div>
        <div className="stat">
          <div className="stat__top">
            <span className="stat__label">금주 완료</span>
            <span className="stat__icon stat__icon--primary"><Icon name="calendar" size={15}/></span>
          </div>
          <div className="stat__value">{thisWeek}<small>건</small></div>
          <div className="stat__foot">{weekStartLabel} ~ 오늘 기준</div>
        </div>
        <div className="stat">
          <div className="stat__top">
            <span className="stat__label">평균 리드타임</span>
            <span className="stat__icon"><Icon name="clock" size={15}/></span>
          </div>
          <div className="stat__value">{avgLead}<small>일</small></div>
          <div className="stat__foot">영업 접수 → 생산 완료</div>
        </div>
        <div className="stat">
          <div className="stat__top">
            <span className="stat__label">평균 검정 소요</span>
            <span className="stat__icon stat__icon--warning"><Icon name="shield" size={15}/></span>
          </div>
          <div className="stat__value">{avgQc}<small>일</small></div>
          <div className="stat__foot">생산 → 검정 완료</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar__search">
          <span className="toolbar__search__icon"><Icon name="search" size={14}/></span>
          <input className="input" aria-label="고객사, 시리얼, 로트 검색"
                 placeholder="고객사 · 시리얼 · 로트 검색"
                 value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <select className="select" aria-label="모델 필터" style={{ width: 160 }}
                value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
          <option value="all">모델 전체</option>
          {models.map(m => <option key={m.model} value={m.model}>{m.description || m.model}</option>)}
        </select>
        <button className={`toolbar__filter ${search || filterModel !== 'all' ? 'toolbar__filter--active' : ''}`}
                onClick={() => { setSearch(''); setFilterModel('all'); }}
                aria-label="필터 초기화">
          <Icon name="filter" size={12}/><span aria-hidden="true"> 초기화</span>
        </button>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', marginRight: 4 }}>
          <strong style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{filtered.length}</strong>건
        </span>
      </div>

      {selectedIds.size > 0 && (
        <div className="toolbar" style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-700, var(--primary))' }}>
            <Icon name="check" size={13}/> {selectedIds.size}건 선택됨 · 출하검사 완료건
          </span>
          <div style={{ flex: 1 }}/>
          <button className="btn btn--ghost btn--sm" onClick={() => setSelectedIds(new Set())}>선택 해제</button>
          <button className="btn btn--primary btn--sm" onClick={() => handleBulkShipComplete([...selectedIds])}>
            <Icon name="truck" size={13}/> 선택 {selectedIds.size}건 일괄 출하완료
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="table-wrap">
          <div className="emptystate">
            <Icon name="truck" size={28} stroke={1.2} style={{ color: 'var(--ink-5)' }} aria-hidden="true"/>
            <div className="emptystate__title">출하대기 오더가 없습니다</div>
            <div className="emptystate__sub">생산 입력에서 실적을 등록하면 이 목록에 표시됩니다</div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table qap-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 40 }}>
                  <input type="checkbox" aria-label="출하검사 완료건 전체 선택"
                    checked={eligibleIds.length > 0 && selectedIds.size === eligibleIds.length}
                    disabled={eligibleIds.length === 0}
                    onChange={toggleSelectAll}
                    style={{ width: 17, height: 17, accentColor: 'var(--primary)' }}/>
                </th>
                <th scope="col">고객사 / 모델</th>
                <th scope="col">시리얼 / 로트</th>
                <th scope="col" className="qap-table__col--proddate">생산일</th>
                <th scope="col">기능검사성적서</th>
                <th scope="col">출하 전 검사</th>
                <th scope="col" style={{ width: 110 }}>출하</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const modelInfo = window.findModelInfo(o.model_name);
                const shipInsp = shipInspections.get(o.order_id);
                const shipAllDone = isShipAllDone(o);
                const checked = selectedIds.has(o.order_id);
                const openRow = () => {
                  const role = s.currentUser?.role;
                  if (role === 'admin' || role === 'production') {
                    window.actions.selectOrder(o.order_id);
                    window.actions.setView('mapping');
                  } else {
                    setShipInspectOrder(o);
                  }
                };
                return (
                  <tr key={o.order_id} className="row--clickable"
                    tabIndex={0}
                    aria-label={`오더 #${o.order_id} · ${o.customer_name} 상세 정보 열기`}
                    onClick={openRow}
                    onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openRow(); } }}>
                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <input type="checkbox" aria-label={`오더 #${o.order_id} 일괄 출하완료 선택`}
                          checked={checked} disabled={!shipAllDone}
                          title={!shipAllDone ? '출하검사를 먼저 완료해 주세요' : ''}
                          onChange={() => toggleSelect(o.order_id)}
                          style={{ width: 17, height: 17, accentColor: 'var(--primary)', cursor: shipAllDone ? 'pointer' : 'not-allowed' }}/>
                        {!shipAllDone && <window.HelpDot text="출하검사를 먼저 완료해 주세요"/>}
                      </span>
                    </td>
                    <td>
                      <div className="cell-strong">{o.customer_name}</div>
                      <div className="cell-muted">{modelInfo?.model || o.model_name}</div>
                    </td>
                    <td>
                      <div className="cell-mono" style={{ color: 'var(--ink-1)', fontSize: 12.5 }}>{o.production.serial_no}</div>
                      <div className="cell-mono" style={{ color: 'var(--ink-4)' }}>{o.production.lot_no}</div>
                    </td>
                    <td className="qap-table__col--proddate" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{o.production.prod_date}</td>
                    <td>
                      <button
                          className="btn btn--sm btn--success"
                          onClick={(e) => { e.stopPropagation(); setReport(o); }}>
                          <Icon name="check" size={12}/> 기능검사성적서
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
                        <button
                          className={`btn btn--sm ${shipAllDone ? 'btn--success' : shipInsp ? 'btn--warning' : 'btn--secondary'}`}
                          onClick={(e) => { e.stopPropagation(); setShipInspectOrder(o); }}>
                          <Icon name={shipAllDone ? 'check' : 'doc'} size={12}/> 출하검사
                          {(() => {
                            const cnt = shipPhotoCounts.get(o.order_id) || 0;
                            return cnt > 0 ? (
                              <span style={{ marginLeft: 4, background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--r-pill, 9999px)', padding: '1px 6px', fontSize: 10.5 }}>
                                {cnt}장
                              </span>
                            ) : null;
                          })()}
                        </button>
                        {shipAllDone && (
                          <button className="btn btn--sm btn--ghost"
                            onClick={(e) => { e.stopPropagation(); setShipReport({ order: o, inspectionData: shipInsp }); }}
                            style={{ fontSize: 11 }}>
                            <Icon name="doc" size={11}/> 성적서 보기
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button
                          className="btn btn--primary btn--sm"
                          disabled={!shipAllDone}
                          onClick={(e) => { e.stopPropagation(); handleShipComplete(o.order_id); }}>
                          <Icon name="truck" size={12}/> 출하 완료
                        </button>
                        {!shipAllDone && (
                          <span style={{ fontSize: 10.5, color: 'var(--ink-4)', lineHeight: 1.3 }}>
                            {shipInsp ? '출하검사 미완료' : '출하검사 필요'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {report && <InspectionReport order={report} onClose={() => setReport(null)}/>}
      {shipInspectOrder && (
        <ShipInspectionDrawer
          order={shipInspectOrder}
          existingData={shipInspections.get(shipInspectOrder.order_id)}
          modelInfo={window.findModelInfo(shipInspectOrder.model_name)}
          onSave={(data) => {
            const ord = shipInspectOrder;
            saveShipInspection(ord.order_id, data);
            setTimeout(() => setShipReport({ order: ord, inspectionData: data }), 250);
          }}
          onClose={() => setShipInspectOrder(null)}
        />
      )}
      {shipReport && (
        <ShipInspectionReport
          order={shipReport.order}
          inspectionData={shipReport.inspectionData}
          modelInfo={window.findModelInfo(shipReport.order.model_name)}
          onClose={() => setShipReport(null)}
        />
      )}
    </div>
  );
}


window.ProductionCompleteScreen = ProductionCompleteScreen;
