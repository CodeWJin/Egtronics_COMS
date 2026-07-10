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
function MetricPanel({ title, subtitle, color, dates, granularity, icon }) {
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
        datasets: [{ label: title, data: counts, backgroundColor: color, borderRadius: 4, maxBarThickness: 36 }],
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
  }, [buckets, counts, color, title]);

  return (
    <div className="card">
      <div className="card__head">
        <h2 className="card__title">{icon && <Icon name={icon} size={14}/>} {title}</h2>
        <span className="card__sub">{subtitle}</span>
      </div>
      <div className="card__body">
        <div className="statrow" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div className="stat" style={{ '--stat-accent': color }}>
            <div className="stat__top">
              <span className="stat__label">{granularity === 'week' ? '이번 주' : '이번 달'}</span>
              <span className="stat__icon stat__icon--primary"><Icon name="calendar" size={15}/></span>
            </div>
            <div className="stat__value">{current}<small>건</small></div>
            <div className="stat__foot">
              {delta === 0 ? '직전 대비 변동 없음' : delta > 0 ? `직전 대비 +${delta}건` : `직전 대비 ${delta}건`}
            </div>
          </div>
          <div className="stat" style={{ '--stat-accent': color }}>
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

  const salesDates = useMemoDASH(() => s.orders.map(o => o.created).filter(Boolean), [s.orders]);
  const prodDates = useMemoDASH(() => s.orders.map(o => o.production?.prod_date).filter(Boolean), [s.orders]);
  const asDates = useMemoDASH(() => (s.asReceptions || [])
    .filter(r => r.status === '처리완료' && r.completed_at)
    .map(r => String(r.completed_at).slice(0, 10)), [s.asReceptions]);

  const METRICS = {
    sales:      { key: 'sales', title: '영업 · 발주수량', subtitle: '오더 등록일 기준', color: '#2563EB', icon: 'cart', dates: salesDates },
    production: { key: 'production', title: '생산 · 생산수량', subtitle: '생산일자 기준 · 출하대기 진입 전 생산 실적', color: '#0E7490', icon: 'factory', dates: prodDates },
    quality:    { key: 'quality', title: '품질 · AS건수', subtitle: 'AS 처리완료 시점 기준', color: '#DC2626', icon: 'shield', dates: asDates },
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
          <h1 className="screen__title">주간·월간 수량 현황</h1>
          <p className="screen__sub">
            {isAdmin ? '영업·생산·품질 전체 지표를 확인하고, 버튼으로 지표를 전환할 수 있습니다.' : `${window.ROLE_LABEL?.[role] || ''} 담당 지표를 확인합니다.`}
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

      {isAdmin && (
        <div className="statrow" style={{ marginBottom: 16, gridTemplateColumns: `repeat(${visibleKeys.length}, minmax(0, 1fr))` }}>
          {visibleKeys.map(k => {
            const mm = METRICS[k];
            const active = shownMetric === k;
            return (
              <button key={k} type="button"
                      className={`stat stat--btn ${active ? 'stat--active' : ''}`}
                      style={{ '--stat-accent': mm.color }}
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
        color={m.color}
        icon={m.icon}
        dates={m.dates}
        granularity={granularity}
      />
    </div>
  );
}

window.DashboardScreen = DashboardScreen;
