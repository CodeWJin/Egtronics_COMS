// Egtronics COMS — 클라이언트 참조 데이터 (드롭다운용 마스터)
// 주문·담당자·사용자 데이터는 Supabase에서 관리합니다.

window.MASTER = {
  CUSTOMERS: [
    { name: '카스', code: 'CAS', last: '2026-05-18' },
    { name: '마이크로', code: 'MICRO', last: '2026-05-20' },
    { name: 'LG', code: 'LG', last: '2026-05-21' },
    { name: '삼성', code: 'SAMSUNG', last: '2026-04-30' },
  ],
  MODELS: [
    { name: '7kW Wallbox', spec: '완속 · 벽부착', power: '7kW' },
    { name: '7kW Pedestal', spec: '완속 · 스탠드형', power: '7kW' },
    { name: '11kW Wallbox', spec: '완속 · 벽부착', power: '11kW' },
    { name: '11kW Pedestal', spec: '완속 · 스탠드형', power: '11kW' },
    { name: '50kW 1ch', spec: 'DC 콤보 · 단일포트', power: '50kW' },
    { name: '50kW 2ch', spec: 'DC 콤보 · 듀얼포트', power: '50kW' },
    { name: '100kW 1ch', spec: 'DC 콤보 · 단일포트', power: '100kW' },
    { name: '100kW 2ch', spec: 'DC 콤보 · 듀얼포트', power: '100kW' },
    { name: '200kW 1ch', spec: 'DC 콤보 · 단일포트', power: '200kW' },
    { name: '200kW 2ch', spec: 'DC 콤보 · 단일포트', power: '100kW' },
  ],
  SW_VERSIONS: [
    { tag: 'v1.6.2-core', released: '2026-05-14', stable: true },
    { tag: 'v1.6.1-core', released: '2026-04-02', stable: true },
    { tag: 'v1.5.8-core', released: '2026-02-18', stable: true },
    { tag: 'v1.7.0-beta', released: '2026-05-22', stable: false },
  ],
  CABLE_LENGTHS: ['3m', '5m', '7m', '10m'],
};
