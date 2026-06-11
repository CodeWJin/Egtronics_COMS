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
  const [models, setModels] = useStatePC(() => window.PMDB.getModels());

  React.useEffect(() => {
    const sync = () => setModels(window.PMDB.getModels());
    window.addEventListener('masterLoaded', sync);
    return () => window.removeEventListener('masterLoaded', sync);
  }, []);

  const completed = useMemoPC(
    () => s.orders.filter(o => o.status === 'COMPLETED' && o.production),
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
  const avgLead = completed.length
    ? Math.round(completed.reduce((a, o) => a + daysBetween(o.created, o.production.prod_date), 0) / completed.length)
    : 0;
  const avgQc = completed.length
    ? (completed.reduce((a, o) => a + Math.max(0, daysBetween(o.production.prod_date, o.production.inspection_date)), 0) / completed.length).toFixed(1)
    : 0;

  const exportCSV = () => {
    const header = ['오더번호', '고객사', '모델', '충전소ID', '생산일자', '로트', '시리얼', '검정일자', 'S/W버전', '케이블', '문서번호', '납품일자'];
    const rows = [header, ...filtered.map(o => ([
      o.order_id, o.customer_name, o.model_name, o.station_id,
      o.production.prod_date, o.production.lot_no, o.production.serial_no,
      o.production.inspection_date, o.production.sw_version, o.production.cable_length,
      o.production.doc_no, o.delivery_date,
    ]))];
    downloadCSV(rows, `생산완료_${new Date().toISOString().slice(0, 10)}.csv`);
    window.actions.flashToast?.(`${filtered.length}건 CSV 내보내기 완료`);
  };

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">생산 부서 · 출하/완료 관리</div>
          <h1 className="screen__title">생산 완료 목록</h1>
          <p className="screen__sub">생산·검정이 완료되어 출하 가능한 오더입니다. 출하 검사 성적서를 조회하거나 목록을 내보낼 수 있습니다.</p>
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
            <span className="stat__label">총 생산완료</span>
            <span className="stat__icon stat__icon--success"><Icon name="check" size={15}/></span>
          </div>
          <div className="stat__value">{completed.length}<small>건</small></div>
          <div className="stat__foot">출하 검사 성적서 발급 완료</div>
        </div>
        <div className="stat">
          <div className="stat__top">
            <span className="stat__label">금주 완료</span>
            <span className="stat__icon stat__icon--primary"><Icon name="calendar" size={15}/></span>
          </div>
          <div className="stat__value">{thisWeek}<small>건</small></div>
          <div className="stat__foot">5월 25일(월) ~ 오늘 기준</div>
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
          <input className="input" placeholder="고객사 · 시리얼 · 로트 · 문서번호 검색"
                 value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <select className="select" style={{ width: 160, height: 34 }}
                value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
          <option value="all">모델 전체</option>
          {models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
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
            <div className="emptystate__title">완료된 생산 오더가 없습니다</div>
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
                <th>S/W</th>
                <th>리드타임</th>
                <th>성적서</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const lead = daysBetween(o.created, o.production.prod_date);
                return (
                  <tr key={o.order_id} className="row--clickable" onClick={() => setReport(o)}>
                    <td className="cell-mono">#{o.order_id}</td>
                    <td>
                      <div className="cell-strong">{o.customer_name}</div>
                      <div className="cell-muted">{o.model_name}</div>
                    </td>
                    <td>
                      <div className="cell-mono" style={{ color: 'var(--ink-1)', fontSize: 12.5 }}>{o.production.serial_no}</div>
                      <div className="cell-mono" style={{ color: 'var(--ink-4)' }}>{o.production.lot_no}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{o.production.prod_date}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--ink-2)' }}>{o.production.inspection_date}</td>
                    <td><span className="badge badge--neutral" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{o.production.sw_version}</span></td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)' }}>{lead}일</td>
                    <td>
                      <button className="btn btn--secondary btn--sm" onClick={(e) => { e.stopPropagation(); setReport(o); }}>
                        <Icon name="doc" size={12}/> 성적서 보기
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {report && <InspectionReport order={report} onClose={() => setReport(null)}/>}
    </div>
  );
}

/* ────────── 출하 검사 성적서 (printable document) ────────── */
function InspectionReport({ order, onClose }) {
  const p = order.production;
  const validUntil = useMemoPC(() => {
    const d = new Date(p.inspection_date);
    d.setFullYear(d.getFullYear() + 7);
    return d.toISOString().slice(0, 10);
  }, [order]);

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="report">
        <div className="report__bar">
          <span className="report__bar__label"><Icon name="doc" size={14}/> 출하 검사 성적서 미리보기</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--secondary btn--sm" onClick={() => {
              if (confirm(`오더 #${order.order_id}을(를) 생산대기 상태로 되돌릴까요?\n생산 실적은 보존되며 생산 입력에서 다시 수정할 수 있습니다.`)) {
                window.actions.revertOrder(order.order_id);
                onClose();
              }
            }}>
              <Icon name="refresh" size={13}/> 생산대기로 변경
            </button>
            <button className="btn btn--secondary btn--sm" onClick={() => window.print()}>
              <Icon name="printer" size={13}/> 인쇄 / PDF
            </button>
            <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose} aria-label="닫기"><Icon name="x" size={15}/></button>
          </div>
        </div>
        <div className="report__scroll">
          <div className="report__doc">
            <div className="report__hd">
              <div>
                <h2 className="report__hd__title">출하 검사 성적서</h2>
                <div className="report__hd__sub">SHIPMENT INSPECTION CERTIFICATE · EV CHARGER</div>
              </div>
              <div className="report__hd__no">
                문서번호
                <strong>{p.doc_no}</strong>
              </div>
            </div>

            <table className="report__table">
              <tbody>
                <tr>
                  <th>고객사</th>
                  <td>{order.customer_name}</td>
                  <th>오더번호</th>
                  <td className="report__mono">#{order.order_id}</td>
                </tr>
                <tr>
                  <th>모델명</th>
                  <td>{order.model_name}</td>
                  <th>충전소 ID</th>
                  <td className="report__mono">{order.station_id}</td>
                </tr>
                <tr>
                  <th>시리얼 번호</th>
                  <td className="report__mono">{p.serial_no}</td>
                  <th>로트 번호</th>
                  <td className="report__mono">{p.lot_no}</td>
                </tr>
                <tr>
                  <th>생산일자</th>
                  <td>{p.prod_date}</td>
                  <th>검정일자</th>
                  <td>{p.inspection_date}</td>
                </tr>
                <tr>
                  <th>S/W 버전</th>
                  <td className="report__mono">{p.sw_version}</td>
                  <th>케이블 길이</th>
                  <td>{p.cable_length}</td>
                </tr>
                <tr>
                  <th>라우터 S/N</th>
                  <td className="report__mono">{order.router_no}</td>
                  <th>USIM (ICCID)</th>
                  <td className="report__mono" style={{ fontSize: 11 }}>{order.usim_no}</td>
                </tr>
                <tr>
                  <th>설치 주소</th>
                  <td colSpan={3}>{order.install_address}</td>
                </tr>
                <tr>
                  <th>검정 유효기간</th>
                  <td>{validUntil} 까지</td>
                  <th>종합 판정</th>
                  <td><span className="report__pass"><Icon name="check" size={13}/> 합격 (PASS)</span></td>
                </tr>
              </tbody>
            </table>

            <div className="report__seal">
              <div className="report__seal__txt">
                위 충전기는 사내 출하 검사 규정 및 공인기관 형식승인 기준에 따라<br/>
                검사를 시행하였으며, 그 결과 <strong style={{ color: 'var(--ink-1)' }}>적합</strong>함을 증명합니다.<br/>
                <span style={{ color: 'var(--ink-4)' }}>발급일 {new Date().toISOString().slice(0, 10)} · 품질보증팀(QA)</span>
              </div>
              <div className="report__stamp">검사<br/>합격</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ProductionCompleteScreen = ProductionCompleteScreen;
