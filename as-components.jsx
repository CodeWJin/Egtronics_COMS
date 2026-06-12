// AS 모듈 공통 상수 및 컴포넌트

const { useState: useStateASC, useMemo: useMemoASC } = React;

window.FAULT_TYPES = [
  '통신 장애',
  '결제/인증 오류',
  '하드웨어 파손',
  '커넥터 인식 불량',
  'SW/펌웨어 오류',
  '기타',
];

window.AS_STATUS_LIST = ['접수대기', '담당자배정', '처리중', '처리완료'];

window.AS_ACTION_TYPES = [
  '원격 리셋',
  '현장 출동',
  '보드 교체',
  '커넥터 교체',
  '펌웨어 업데이트',
  '네트워크 점검',
  '기타',
];

// ── 상태 배지 ──────────────────────────────────────────────────────
function AsStatusBadge({ status }) {
  const cls = {
    '접수대기':   'badge--pending',
    '담당자배정': 'badge--info',
    '처리중':     'badge--progress',
    '처리완료':   'badge--complete',
  }[status] || 'badge--neutral';
  return <span className={`badge ${cls}`}>{status || '—'}</span>;
}
window.AsStatusBadge = AsStatusBadge;

function AsPriorityBadge({ priority }) {
  if (priority === '긴급') return <span className="badge badge--danger">긴급</span>;
  return <span className="badge badge--neutral">일반</span>;
}
window.AsPriorityBadge = AsPriorityBadge;

// ── 주문 목록에서 충전소/충전기 검색 모달 ─────────────────────────
function ChargerSearchModal({ onSelect, onClose }) {
  const [query, setQuery] = useStateASC('');

  const orders = useMemoASC(
    () => window.PMDB.loadOrders().filter(o => o.status === 'AWAIT_PICKUP' || o.status === 'COMPLETED'),
    []
  );

  const filtered = useMemoASC(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders.slice(0, 60);
    return orders.filter(o =>
      (o.station_id     || '').toLowerCase().includes(q) ||
      (o.customer_name  || '').toLowerCase().includes(q) ||
      (o.install_address|| '').toLowerCase().includes(q)
    ).slice(0, 60);
  }, [query]);

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-charger-search-title" style={{ width: 620, maxWidth: '96vw' }}>
        <div className="modal__head">
          <h3 id="modal-charger-search-title" className="modal__title">충전소 검색</h3>
          <p className="modal__sub">생산완료된 오더 중 충전소를 검색하여 정보를 자동 입력합니다</p>
        </div>
        <div className="modal__body">
          <input
            className="input"
            autoFocus
            placeholder="충전소 ID, 고객사, 설치주소 검색…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="table-wrap" style={{ maxHeight: 340, marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>오더번호</th>
                  <th>고객사</th>
                  <th>충전소 ID</th>
                  <th>설치 주소</th>
                  <th>모델</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '32px 0' }}>
                      검색 결과 없음
                    </td>
                  </tr>
                ) : filtered.map(o => (
                  <tr key={o.order_id} style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    onClick={() => onSelect(o)}
                    onKeyDown={(e) => e.key === 'Enter' && onSelect(o)}>
                    <td className="cell-mono">#{o.order_id}</td>
                    <td>{o.customer_name || '—'}</td>
                    <td className="cell-mono">{o.station_id || '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.install_address || '—'}
                    </td>
                    <td>{o.model_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
window.ChargerSearchModal = ChargerSearchModal;
