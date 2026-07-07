// AS 모듈 공통 상수 및 컴포넌트

window.FAULT_TYPES = [
  '통신 장애',
  '결제/인증 오류',
  '하드웨어 파손',
  '커넥터 인식 불량',
  'SW/펌웨어 오류',
  '기타',
];

window.AS_STATUS_LIST = ['접수대기', '담당자배정', '처리중', '처리완료'];

window.AS_ACTION_TYPE_GROUPS = [
  { label: '하드웨어(HW) 및 부품 관리', items: ['부품 교체 (냉땜 등)', '배선 교체', '외함 교체', '하드웨어 교체', '제품교체'] },
  { label: '소프트웨어(SW) 및 설정 관리', items: ['펌웨어 업데이트', 'HMI 업데이트', '설정 변경', '원격 리셋'] },
  { label: '통신 및 네트워크',             items: ['통신연결불량', '무선모뎀 문제'] },
  { label: '인프라 설치 및 외부 요인',     items: ['충전기 설치 문제 / 시공문제', '차량 이상 진단', '사용자 사용 문제'] },
  { label: '원인 분석 및 기타',             items: ['원인분석', '특이사항없음'] },
];
window.AS_ACTION_TYPES = window.AS_ACTION_TYPE_GROUPS.flatMap(g => g.items);

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
