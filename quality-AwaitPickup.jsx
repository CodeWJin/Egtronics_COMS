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
    // tb_ship_inspection DB 캐시 우선 — 기존 pm_ship_inspections(기능검사 혼용)와 분리
    try {
      const dbRows = window.PMDB?.backend?.cache?.ship_inspections || [];
      if (dbRows.length > 0) {
        const m = new Map();
        dbRows.forEach(r => m.set(r.order_id, {
          insp_date: r.insp_date, inspector: r.inspector,
          checks: JSON.parse(r.checks || '{}'), notes: r.notes || '', saved_at: r.saved_at,
        }));
        return m;
      }
    } catch(_) {}
    // DB 데이터 없을 때만 localStorage 폴백
    try { return new Map(JSON.parse(localStorage.getItem('pm_ship_inspections') || '[]')); }
    catch(_) { return new Map(); }
  });
  const [shipInspectOrder, setShipInspectOrder] = useStatePC(null);
  const [shipReport, setShipReport] = useStatePC(null);
  const [models, setModels] = useStatePC(() => window.PMDB.getModels());

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
    if (confirm(`오더 #${orderId}을(를) 출하 완료 처리할까요?\n생산완료 상태로 전환되어 출하대기 목록에서 제외됩니다.`)) {
      window.actions.shipOrder(orderId);
      window.setShipInspection(orderId, null);
      setShipInspections(prev => { const next = new Map(prev); next.delete(orderId); return next; });
    }
  }, []);

  const modelMap = useMemoPC(() => new Map(models.map(m => [m.name, m])), [models]);

  const completed = useMemoPC(
    () => s.orders.filter(o => o.status === 'AWAIT_PICKUP' && o.production?.serial_no),
    [s.orders]
  );

  const filtered = useMemoPC(() => {
    return completed.filter(o => {
      if (filterModel !== 'all' && o.model_name !== filterModel) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [o.customer_name, o.model_name, o.station_id, o.production.serial_no, o.production.lot_no, o.production.doc_no, String(o.order_id)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [completed, search, filterModel]);

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
    const header = ['오더번호', '고객사', '모델', '충전소ID', '생산일자', '로트', '시리얼', '검정일자', 'S/W버전', 'F/W버전', '케이블', '문서번호', '납품일자'];
    const rows = [header, ...filtered.map(o => ([
      o.order_id, o.customer_name, o.model_name, o.station_id,
      o.production.prod_date, o.production.lot_no, o.production.serial_no,
      o.production.inspection_date, o.production.sw_version, o.production.fw_version,
      o.production.cable_length, o.production.doc_no, o.delivery_date,
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
          <p className="screen__sub">생산·검정이 완료되어 출하 대기 중인 오더입니다.
            <br/>기능 검사 성적서를 조회하거나 목록을 내보낼 수 있습니다.
            <br/>출하 검사 성적서를 작성할 수 있습니다.</p>
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
          <input className="input" aria-label="고객사, 시리얼, 로트, 문서번호 검색"
                 placeholder="고객사 · 시리얼 · 로트 · 문서번호 검색"
                 value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <select className="select" aria-label="모델 필터" style={{ width: 160, height: 34 }}
                value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
          <option value="all">모델 전체</option>
          {models.map(m => <option key={m.name} value={m.name}>{m.model || m.name}</option>)}
        </select>
        <button className={`toolbar__filter ${search || filterModel !== 'all' ? 'toolbar__filter--active' : ''}`}
                onClick={() => { setSearch(''); setFilterModel('all'); }}>
          <Icon name="filter" size={12}/> 초기화
        </button>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', marginRight: 4 }}>
          <strong style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{filtered.length}</strong>건
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="table-wrap">
          <div className="emptystate">
            <Icon name="truck" size={28} stroke={1.2} style={{ color: 'var(--ink-5)' }}/>
            <div className="emptystate__title">출하대기 오더가 없습니다</div>
            <div className="emptystate__sub">생산 입력에서 실적을 등록하면 이 목록에 표시됩니다</div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>오더 #</th>
                <th>고객사 / 모델</th>
                <th>시리얼 / 로트</th>
                <th>생산일</th>
                <th>검정일</th>
                <th>성적서</th>
                <th style={{ width: 110 }}>출하</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const modelInfo = modelMap.get(o.model_name);
                return (
                  <tr key={o.order_id} className="row--clickable" onClick={() => setReport(o)}>
                    <td className="cell-mono">#{o.order_id}</td>
                    <td>
                      <div className="cell-strong">{o.customer_name}</div>
                      <div className="cell-muted">{modelInfo?.model || o.model_name}</div>
                    </td>
                    <td>
                      <div className="cell-mono" style={{ color: 'var(--ink-1)', fontSize: 12.5 }}>{o.production.serial_no}</div>
                      <div className="cell-mono" style={{ color: 'var(--ink-4)' }}>{o.production.lot_no}</div>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{o.production.prod_date}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--ink-2)' }}>{o.production.inspection_date}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <button
                          className="btn btn--sm btn--success"
                          onClick={(e) => { e.stopPropagation(); setReport(o); }}>
                          <Icon name="check" size={12}/> 기능검사성적서
                        </button>
                        <button
                          className={`btn btn--sm ${shipInspections.has(o.order_id) ? 'btn--success' : 'btn--secondary'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (shipInspections.has(o.order_id)) {
                              setShipReport({ order: o, inspectionData: shipInspections.get(o.order_id) });
                            } else {
                              setShipInspectOrder(o);
                            }
                          }}>
                          <Icon name={shipInspections.has(o.order_id) ? 'check' : 'doc'} size={12}/> 출하검사
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button
                          className="btn btn--primary btn--sm"
                          disabled={!shipInspections.has(o.order_id)}
                          onClick={(e) => { e.stopPropagation(); handleShipComplete(o.order_id); }}>
                          <Icon name="truck" size={12}/> 출하 완료
                        </button>
                        {!shipInspections.has(o.order_id) && (
                          <span style={{ fontSize: 10.5, color: 'var(--ink-4)', lineHeight: 1.3 }}>
                            출하검사 필요
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
          modelInfo={modelMap.get(shipInspectOrder.model_name)}
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
          modelInfo={modelMap.get(shipReport.order.model_name)}
          onClose={() => setShipReport(null)}
        />
      )}
    </div>
  );
}


window.ProductionCompleteScreen = ProductionCompleteScreen;
