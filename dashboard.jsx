// 대시보드 화면 — 역할별 주간/월간 수량 지표 (영업: 발주수량 / 생산: 생산수량 / 품질: AS건수)
// Chart.js(CDN, index.html에서 로드)를 사용한 막대그래프 + KPI 카드

const { useState: useStateDASH, useMemo: useMemoDASH, useRef: useRefDASH, useEffect: useEffectDASH } = React;

/* ────────── 날짜 버킷 유틸 ────────── */
function mondayOfDash(dateInput) {
  const d = new Date(dateInput);
  const day = (d.getDay() + 6) % 7; // 월=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}
function isoDateDash(d) { return d.toISOString().slice(0, 10); }
function addDaysDash(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonthsDash(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }

function buildWeekBuckets(count) {
  const thisMonday = mondayOfDash(new Date());
  const buckets = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = addDaysDash(thisMonday, -7 * i);
    buckets.push({ key: isoDateDash(start), label: `${start.getMonth() + 1}/${start.getDate()}` });
  }
  return buckets;
}
function buildMonthBuckets(count) {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const buckets = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = addMonthsDash(thisMonth, -i);
    buckets.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: `${start.getFullYear()}.${String(start.getMonth() + 1).padStart(2, '0')}`,
    });
  }
  return buckets;
}
// Chart.js는 canvas에 직접 그리므로 var(--x) 문자열을 해석하지 못함 —
// 렌더 시점에 실제 계산된 CSS 변수 값을 읽어와 Tweaks 패널의 accent 변경과 동기화
function resolveCssVarDash(varExpr, fallback) {
  const name = String(varExpr).match(/--[\w-]+/)?.[0];
  const resolved = name && getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return resolved || fallback;
}
function dateToWeekKey(dateStr) { return dateStr ? isoDateDash(mondayOfDash(dateStr)) : null; }
function dateToMonthKey(dateStr) { return dateStr ? String(dateStr).slice(0, 7) : null; }

function countByBucket(dates, buckets, granularity) {
  const keyFn = granularity === 'week' ? dateToWeekKey : dateToMonthKey;
  const map = {};
  buckets.forEach(b => { map[b.key] = 0; });
  dates.forEach(d => {
    const k = keyFn(d);
    if (k != null && k in map) map[k] += 1;
  });
  return buckets.map(b => map[b.key]);
}

/* ────────── 지표 1개 = KPI 카드 + Chart.js 막대그래프 + 표 ────────── */
function MetricPanel({ title, subtitle, accentVar, chartColor, dates, granularity, icon }) {
  const canvasRef = useRefDASH(null);
  const chartRef = useRefDASH(null);
  const bucketCount = granularity === 'week' ? 8 : 6;
  const buckets = useMemoDASH(
    () => (granularity === 'week' ? buildWeekBuckets(bucketCount) : buildMonthBuckets(bucketCount)),
    [granularity]
  );
  const counts = useMemoDASH(() => countByBucket(dates, buckets, granularity), [dates, buckets, granularity]);
  const total = useMemoDASH(() => counts.reduce((a, b) => a + b, 0), [counts]);
  const current = counts[counts.length - 1] || 0;
  const prev = counts[counts.length - 2] || 0;
  const delta = current - prev;

  useEffectDASH(() => {
    if (!window.Chart || !canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: buckets.map(b => b.label),
        datasets: [{ label: title, data: counts, backgroundColor: resolveCssVarDash(accentVar, chartColor), borderRadius: 4, maxBarThickness: 36 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? false : undefined,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}건` } } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [buckets, counts, accentVar, chartColor, title]);

  return (
    <div className="card">
      <div className="card__head">
        <h2 className="card__title">{icon && <Icon name={icon} size={14}/>} {title}</h2>
        <span className="card__sub">{subtitle}</span>
      </div>
      <div className="card__body">
        <div className="statrow" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div className="stat" style={{ '--stat-accent': accentVar }}>
            <div className="stat__top">
              <span className="stat__label">{granularity === 'week' ? '이번 주' : '이번 달'}</span>
              <span className="stat__icon stat__icon--primary"><Icon name="calendar" size={15}/></span>
            </div>
            <div className="stat__value">{current}<small>건</small></div>
            <div className="stat__foot">
              {delta === 0 ? '직전 대비 변동 없음' : delta > 0 ? `직전 대비 +${delta}건` : `직전 대비 ${delta}건`}
            </div>
          </div>
          <div className="stat" style={{ '--stat-accent': accentVar }}>
            <div className="stat__top">
              <span className="stat__label">{granularity === 'week' ? `최근 ${bucketCount}주 합계` : `최근 ${bucketCount}개월 합계`}</span>
              <span className="stat__icon stat__icon--success"><Icon name="check" size={15}/></span>
            </div>
            <div className="stat__value">{total}<small>건</small></div>
            <div className="stat__foot">{subtitle}</div>
          </div>
        </div>

        {total === 0 ? (
          <div className="emptystate" style={{ padding: '24px 0' }}>
            <div className="emptystate__title">표시할 데이터가 없습니다</div>
            <div className="emptystate__sub">해당 기간에 집계된 건수가 없습니다</div>
          </div>
        ) : (
          <div style={{ height: 260 }}>
            <canvas ref={canvasRef} role="img" aria-label={`${title} ${granularity === 'week' ? '주별' : '월별'} 추이 막대그래프`}/>
          </div>
        )}

        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table className="table" style={{ minWidth: 480 }}>
            <thead>
              <tr>{buckets.map(b => <th key={b.key} scope="col" style={{ textAlign: 'center' }}>{b.label}</th>)}</tr>
            </thead>
            <tbody>
              <tr>{counts.map((c, i) => <td key={buckets[i].key} className="cell-mono" style={{ textAlign: 'center' }}>{c}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ────────── 대시보드 화면 ────────── */
function DashboardScreen() {
  const s = window.useStore();
  const role = s.currentUser?.role;
  const isAdmin = role === 'admin';

  const [granularity, setGranularity] = useStateDASH('week');
  const [activeMetric, setActiveMetric] = useStateDASH(
    role === 'production' ? 'production' : role === 'quality' ? 'quality' : 'sales'
  );

  const allowedTabs = window.ROLE_TABS[role] || [];

  // 오더 파이프라인 상태별 건수
  const pipelineCounts = useMemoDASH(() => {
    const c = { PENDING: 0, IN_PROGRESS: 0, AWAIT_PICKUP: 0, COMPLETED: 0 };
    s.orders.forEach(o => {
      if (o.status === 'AWAIT_PICKUP') { if (window.isSalesInfoComplete(o)) c.AWAIT_PICKUP += 1; }
      else if (o.status in c) c[o.status] += 1;
    });
    return c;
  }, [s.orders]);

  // 납품 임박 오더 — D-7 이내(지연 포함), 출하완료 제외
  // daysUntil / deliveryHint / statusBadge 는 production-waiting.jsx · order-lookup.jsx 전역 정의 재사용
  const dueSoon = useMemoDASH(() => s.orders
    .filter(o => o.status !== 'COMPLETED' && o.delivery_date && daysUntil(o.delivery_date) <= 7)
    .sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date))
    .slice(0, 6), [s.orders]);

  // AS 미처리 현황 (AS 화면 접근 권한이 있는 역할만 표시)
  const showAs = allowedTabs.includes('as-receipt');
  const asOpenCounts = useMemoDASH(() => {
    const list = (s.asReceptions || []).filter(r => r.status !== '처리완료');
    const byStatus = {};
    (window.AS_STATUS_LIST || []).filter(st => st !== '처리완료').forEach(st => { byStatus[st] = 0; });
    list.forEach(r => { if (r.status in byStatus) byStatus[r.status] += 1; });
    return { total: list.length, byStatus };
  }, [s.asReceptions]);

  const salesDates = useMemoDASH(() => s.orders.map(o => o.created).filter(Boolean), [s.orders]);
  const prodDates = useMemoDASH(() => s.orders.map(o => o.production?.prod_date).filter(Boolean), [s.orders]);
  const asDates = useMemoDASH(() => (s.asReceptions || [])
    .filter(r => r.status === '처리완료' && r.completed_at)
    .map(r => String(r.completed_at).slice(0, 10)), [s.asReceptions]);

  // chartColor: Chart.js는 canvas에 직접 그리므로 CSS 변수를 해석할 수 없어 리터럴 값 필요 —
  // 각 값은 styles.css :root 토큰(--primary / --indigo-700 / --danger)과 반드시 동일하게 유지
  const METRICS = {
    sales:      { key: 'sales', title: '영업 · 발주수량', subtitle: '오더 등록일 기준', accentVar: 'var(--primary)', chartColor: '#2563EB', icon: 'cart', dates: salesDates },
    production: { key: 'production', title: '생산 · 생산수량', subtitle: '생산일자 기준 · 출하대기 진입 전 생산 실적', accentVar: 'var(--indigo-700)', chartColor: '#4338CA', icon: 'factory', dates: prodDates },
    quality:    { key: 'quality', title: '품질 · AS건수', subtitle: 'AS 처리완료 시점 기준', accentVar: 'var(--danger)', chartColor: '#EF4444', icon: 'shield', dates: asDates },
  };

  const visibleKeys = isAdmin ? ['sales', 'production', 'quality']
    : role === 'sales' ? ['sales']
    : role === 'production' ? ['production']
    : role === 'quality' ? ['quality']
    : [];

  if (visibleKeys.length === 0) {
    return (
      <div className="screen">
        <div className="card"><div className="card__body">
          <div className="emptystate">
            <div className="emptystate__title">이 역할에서는 대시보드를 사용할 수 없습니다</div>
          </div>
        </div></div>
      </div>
    );
  }

  const shownMetric = isAdmin ? activeMetric : visibleKeys[0];
  const m = METRICS[shownMetric];

  const latestCount = (dates) => {
    const buckets = granularity === 'week' ? buildWeekBuckets(1) : buildMonthBuckets(1);
    return countByBucket(dates, buckets, granularity)[0];
  };

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">대시보드</div>
          <h1 className="screen__title">운영 현황</h1>
          <p className="screen__sub">
            {isAdmin ? '오더 파이프라인·납품 일정·AS 현황과 영업·생산·품질 지표를 한 화면에서 확인합니다.' : `오더 현황과 ${window.ROLE_LABEL?.[role] || ''} 담당 지표를 확인합니다.`}
          </p>
        </div>
        <div className="chips" role="group" aria-label="집계 단위">
          {[{ v: 'week', l: '주간' }, { v: 'month', l: '월간' }].map(g => (
            <button key={g.v} type="button"
                    className={`chip ${granularity === g.v ? 'chip--active' : ''}`}
                    aria-pressed={granularity === g.v}
                    onClick={() => setGranularity(g.v)}>
              {g.l}
            </button>
          ))}
        </div>
      </div>

      {/* ── 오더 파이프라인 현황 — 상태 타일 클릭 시 해당 화면으로 이동 (권한 있는 역할만) ── */}
      <div className="statrow" style={{ marginBottom: 16 }}>
        {[
          { key: 'PENDING',      label: '생산대기',   icon: 'package', accent: 'var(--warning)',    view: 'waiting',     foot: '생산 시작 전 오더' },
          { key: 'IN_PROGRESS',  label: '생산진행중', icon: 'factory', accent: 'var(--indigo-700)', view: 'waiting',     foot: '생산 라인 작업중' },
          { key: 'AWAIT_PICKUP', label: '출하대기',   icon: 'truck',   accent: 'var(--primary)',    view: 'AwaitPickup', foot: '검사 완료 · 픽업 대기' },
          { key: 'COMPLETED',    label: '출하완료',   icon: 'check',   accent: 'var(--success)',    view: 'lookup',      foot: '누적 출하 건수' },
        ].map(p => {
          const clickable = allowedTabs.includes(p.view);
          const inner = (
            <>
              <div className="stat__top">
                <span className="stat__label">{p.label}</span>
                <span className="stat__icon" style={{ color: p.accent }}><Icon name={p.icon} size={15}/></span>
              </div>
              <div className="stat__value">{pipelineCounts[p.key]}<small>건</small></div>
              <div className="stat__foot">{p.foot}{clickable ? ' · 클릭해서 이동' : ''}</div>
            </>
          );
          return clickable ? (
            <button key={p.key} type="button" className="stat stat--btn" style={{ '--stat-accent': p.accent }}
                    onClick={() => window.actions.setView(p.view)}>
              {inner}
            </button>
          ) : (
            <div key={p.key} className="stat" style={{ '--stat-accent': p.accent }}>{inner}</div>
          );
        })}
      </div>

      {/* ── 납품 임박 + AS 미처리 ── */}
      <div className="card-grid" style={{ gridTemplateColumns: showAs ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', marginBottom: 16 }}>
        <div className="card">
          <div className="card__head">
            <h2 className="card__title"><Icon name="clock" size={14}/> 납품 임박 오더</h2>
            <span className="card__sub">납품일 D-7 이내 · 지연 포함 · 최대 6건</span>
          </div>
          <div className="card__body" style={{ padding: dueSoon.length ? 0 : undefined }}>
            {dueSoon.length === 0 ? (
              <div className="emptystate" style={{ padding: '20px 0' }}>
                <div className="emptystate__title">납품 임박 오더가 없습니다</div>
                <div className="emptystate__sub">7일 이내 납품 예정이거나 지연된 오더가 여기에 표시됩니다</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th scope="col">오더</th>
                      <th scope="col">고객사</th>
                      <th scope="col">모델</th>
                      <th scope="col">납품일</th>
                      <th scope="col">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueSoon.map(o => {
                      const d = deliveryHint(o.delivery_date);
                      return (
                        <tr key={o.order_id}>
                          <td className="cell-mono">#{o.order_id}</td>
                          <td className="cell-strong">{o.customer_name}</td>
                          <td>{o.model_name}</td>
                          <td>
                            {o.delivery_date}{' '}
                            <span className="dday-badge" style={{ '--dday-color': d.color, '--dday-bg': d.bg }}>{d.text}</span>
                          </td>
                          <td>{statusBadge(o)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {showAs && (
          <div className="card">
            <div className="card__head">
              <h2 className="card__title"><Icon name="shield" size={14}/> AS 미처리 현황</h2>
              <span className="card__sub">처리완료 전 접수 건</span>
            </div>
            <div className="card__body">
              <div className="statrow" style={{ marginBottom: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                <div className="stat" style={{ '--stat-accent': 'var(--danger)' }}>
                  <div className="stat__top"><span className="stat__label">전체 미처리</span></div>
                  <div className="stat__value">{asOpenCounts.total}<small>건</small></div>
                </div>
                {Object.entries(asOpenCounts.byStatus).map(([st, n]) => (
                  <div key={st} className="stat">
                    <div className="stat__top"><span className="stat__label">{st}</span></div>
                    <div className="stat__value">{n}<small>건</small></div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => window.actions.setView('as-receipt')}>
                  <Icon name="bell" size={13}/> AS 접수 화면
                </button>
                {allowedTabs.includes('as-processing') && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => window.actions.setView('as-processing')}>
                    AS 처리 화면 <Icon name="arrow-right" size={13}/>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="statrow" style={{ marginBottom: 16, gridTemplateColumns: `repeat(${visibleKeys.length}, minmax(0, 1fr))` }}>
          {visibleKeys.map(k => {
            const mm = METRICS[k];
            const active = shownMetric === k;
            return (
              <button key={k} type="button"
                      className={`stat stat--btn ${active ? 'stat--active' : ''}`}
                      style={{ '--stat-accent': mm.accentVar }}
                      aria-pressed={active}
                      onClick={() => setActiveMetric(k)}>
                <div className="stat__top">
                  <span className="stat__label">{mm.title}</span>
                  <span className="stat__icon" style={{ color: 'var(--stat-accent)' }}><Icon name={mm.icon} size={15}/></span>
                </div>
                <div className="stat__value">{latestCount(mm.dates)}<small>건</small></div>
                <div className="stat__foot">{granularity === 'week' ? '이번 주' : '이번 달'} · 클릭해서 상세 보기</div>
              </button>
            );
          })}
        </div>
      )}

      <MetricPanel
        title={m.title}
        subtitle={m.subtitle}
        accentVar={m.accentVar}
        chartColor={m.chartColor}
        icon={m.icon}
        dates={m.dates}
        granularity={granularity}
      />
    </div>
  );
}

window.DashboardScreen = DashboardScreen;
