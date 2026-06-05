// Egtronics COMS — Mock data
// EV 충전기 영업/생산 도메인

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

window.SEED_ORDERS = [
  {
    order_id: 26020801,
    customer_name: '카스',
    model_name: '100kW 2ch',
    delivery_date: '2026-06-12',
    station_id: 'CT9006_01',
    router_no: 'RTR-2024-08172',
    usim_no: '8982001234567890123',
    install_address: '서울특별시 강남구 테헤란로 152, 강남파이낸스센터 지하 2층',
    status: 'PENDING',
    created: '2026-05-22',
  },
  {
    order_id: 26020802,
    customer_name: '카스',
    model_name: '50kW 1ch',
    delivery_date: '2026-06-15',
    station_id: 'CR1006_01',
    router_no: 'RTR-2024-08183',
    usim_no: '8982001234567890238',
    install_address: '인천광역시 연수구 컨벤시아대로 165',
    status: 'PENDING',
    created: '2026-05-23',
  },
  {
    order_id: 26020803,
    customer_name: '마이크로',
    model_name: '11kW Wallbox',
    delivery_date: '2026-07-02',
    station_id: 'DYC-DGU-0301',
    router_no: 'RTR-2024-08246',
    usim_no: '8982001234567890832',
    install_address: '대구광역시 수성구 동대구로 285',
    status: 'PENDING',
    created: '2026-05-27',
  },
  {
    order_id: 26020901,
    customer_name: '마이크로',
    model_name: '100kW 2ch',
    delivery_date: '2026-06-05',
    station_id: 'LOT-SEL-0188',
    router_no: 'RTR-2024-08105',
    usim_no: '8982001234567889921',
    install_address: '서울특별시 송파구 올림픽로 300',
    status: 'COMPLETED',
    created: '2026-05-18',
    production: {
      prod_date: '2026-05-26',
      lot_no: 'L26-W21-A',
      serial_no: 'SGT100K-26052601A',
      inspection_date: '2026-05-27',
      sw_version: 'v1.6.2-core',
      cable_length: '7m',
      doc_no: 'QC-26-0521-A',
    },
  },
];

// 고객사별 담당자 (tb_customer_manager seed) — customer_name 기준
window.SEED_MANAGERS = [
  { customer_name: '카스',  name: '이XX', phone: '010-2222-4444', email: 'hwjeong@kepco.kr',  is_primary: 1 },
  { customer_name: '카스',  name: '최XX', phone: '010-7788-1099', email: 'sylee@kepco.kr',    is_primary: 1 },
  { customer_name: '카스',  name: '김XX', phone: '010-5555-8888', email: 'jhpark@me.go.kr',   is_primary: 0 },
  { customer_name: '마이크로',  name: '조XX', phone: '010-6666-3333', email: 'shoh@everon.co.kr',  is_primary: 1 },
  { customer_name: '마이크로',  name: '윤XX', phone: '010-4444-9999', email: 'gryoon@kdn.com',     is_primary: 1 },
  { customer_name: '마이크로',  name: '서XX', phone: '010-1111-7777', email: 'jhseo@dyc.co.kr',    is_primary: 1 },
  { customer_name: '마이크로',  name: '강XX', phone: '010-2222-1111', email: 'mskang@lotte.net',   is_primary: 1 },
];

// Existing serials (for duplicate-check demo)
window.EXISTING_SERIALS = new Set([
  'EGT100K-26052601A',
  'EGT050K-26052702B',
  'EGT200K-26052403C',
  'EGT100K-26052305X',
]);
