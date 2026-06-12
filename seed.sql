-- ============================================================
-- E-COMS 초기 데이터 시드
-- Supabase SQL 에디터에서 실행 — 중복 시 무시 (CONFLICT DO NOTHING)
-- ============================================================

-- ┌──────────────────────────────────────────────────────────┐
-- │  0. 마이그레이션 — 신규 컬럼 추가 (이미 있으면 무시)      │
-- └──────────────────────────────────────────────────────────┘
ALTER TABLE tb_sales_order ADD COLUMN IF NOT EXISTS cable_length        TEXT DEFAULT '';
ALTER TABLE tb_sales_order ADD COLUMN IF NOT EXISTS field_manager_name  TEXT DEFAULT '';
ALTER TABLE tb_sales_order ADD COLUMN IF NOT EXISTS field_manager_phone TEXT DEFAULT '';
ALTER TABLE tb_sales_order ADD COLUMN IF NOT EXISTS cpo_name            TEXT DEFAULT '';
ALTER TABLE tb_sales_order ADD COLUMN IF NOT EXISTS usage_type          TEXT DEFAULT '공용';

CREATE TABLE IF NOT EXISTS tb_master_cpo (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  code  TEXT NOT NULL
);
ALTER TABLE tb_master_cpo DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS tb_as_history (
  id             INTEGER PRIMARY KEY,
  order_id       INTEGER NOT NULL,
  reception_date TEXT    DEFAULT '',
  dispatch_date  TEXT    DEFAULT '',
  action         TEXT    DEFAULT '',
  notes          TEXT    DEFAULT '',
  field_manager  TEXT    DEFAULT '',
  created_at     TEXT    NOT NULL
);
ALTER TABLE tb_as_history DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS tb_master_customer (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  code  TEXT NOT NULL,
  last  TEXT DEFAULT ''
);
ALTER TABLE tb_master_customer DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS tb_master_model (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  spec  TEXT DEFAULT '',
  power TEXT DEFAULT ''
);
ALTER TABLE tb_master_model DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS tb_master_sw_version (
  id       SERIAL PRIMARY KEY,
  tag      TEXT NOT NULL,
  released TEXT DEFAULT '',
  stable   BOOLEAN DEFAULT true
);
ALTER TABLE tb_master_sw_version DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS tb_master_cable_length (
  id    SERIAL PRIMARY KEY,
  value TEXT NOT NULL
);
ALTER TABLE tb_master_cable_length DISABLE ROW LEVEL SECURITY;

-- ┌──────────────────────┐
-- │  1. 사용자 (users)   │
-- └──────────────────────┘
INSERT INTO users (user_id, password, name, role, dept, phone, email) VALUES
  ('admin', '1234', '박우진', 'admin',      '충전기개발실',  '010-2567-8418', 'wjpark@egtronics.com'),
  ('sales', '1234', '신정륜', 'sales',      '영업부',        '010-3000-4000', 'sales@egtrinocs.com'),
  ('prod',  '1234', '김태윤', 'production', '생산부',        '010-5000-6000', 'prod@egtrinocs.com'),
  ('as',    '1234', '민경선', 'as',         '품질관리본부',  '010-5000-6000', 'as@egtrinocs.com')
ON CONFLICT (user_id) DO NOTHING;

-- ┌──────────────────────────────────┐
-- │  2. 고객사 담당자                │
-- └──────────────────────────────────┘
INSERT INTO tb_customer_manager (manager_id, customer_name, name, phone, email, is_primary) VALUES
  (1, '카스',     '이XX', '010-2222-4444', 'hwjeong@kepco.kr',    1),
  (2, '카스',     '최XX', '010-7788-1099', 'sylee@kepco.kr',      1),
  (3, '카스',     '김XX', '010-5555-8888', 'jhpark@me.go.kr',     0),
  (4, '마이크로', '조XX', '010-6666-3333', 'shoh@everon.co.kr',   1),
  (5, '마이크로', '윤XX', '010-4444-9999', 'gryoon@kdn.com',      1),
  (6, '마이크로', '서XX', '010-1111-7777', 'jhseo@dyc.co.kr',     1),
  (7, '마이크로', '강XX', '010-2222-1111', 'mskang@lotte.net',    1)
ON CONFLICT (manager_id) DO NOTHING;

-- ┌──────────────────────────────────┐
-- │  3. 영업 주문 (tb_sales_order)   │
-- └──────────────────────────────────┘
INSERT INTO tb_sales_order
  (order_id, customer_name, customer_manager, cpo_name, usage_type,
   model_name, delivery_date,
   station_id, router_no, usim_no, install_address,
   cable_length, field_manager_name, field_manager_phone,
   status, created)
VALUES
  (26020801, '카스',     '이XX', '한국전력공사', '공용',   '100kW 2ch',    '2026-06-12',
   'CT9006_01',   'RTR-2024-08172', '8982001234567890123',
   '서울특별시 강남구 테헤란로 152, 강남파이낸스센터 지하 2층',
   '', '', '', 'PENDING',    '2026-05-22'),

  (26020802, '카스',     '이XX', '환경부',       '공용',   '50kW 1ch',     '2026-06-15',
   'CR1006_01',   'RTR-2024-08183', '8982001234567890238',
   '인천광역시 연수구 컨벤시아대로 165',
   '', '', '', 'PENDING',    '2026-05-23'),

  (26020803, '마이크로', '조XX', '',             '비공용', '11kW Wallbox', '2026-07-02',
   'DYC-DGU-0301','RTR-2024-08246', '8982001234567890832',
   '대구광역시 수성구 동대구로 285',
   '', '', '', 'PENDING',    '2026-05-27'),

  (26020901, '마이크로', '조XX', '이지트로닉스', '공용',   '100kW 2ch',    '2026-06-05',
   'LOT-SEL-0188','RTR-2024-08105', '8982001234567889921',
   '서울특별시 송파구 올림픽로 300',
   '7m', '', '', 'AWAIT_PICKUP', '2026-05-18')
ON CONFLICT (order_id) DO NOTHING;

-- ┌──────────────────────────────────────┐
-- │  4. 생산 실적 (tb_production_info)   │
-- └──────────────────────────────────────┘
INSERT INTO tb_production_info
  (order_id, prod_date, lot_no, serial_no, inspection_date, sw_version, doc_no)
VALUES
  (26020901, '2026-05-26', 'L26-W21-A', 'SGT100K-26052601A', '2026-05-27', 'v1.6.2-core', 'QC-26-0521-A')
ON CONFLICT (order_id) DO NOTHING;

-- ┌──────────────────────────────────────────────────────┐
-- │  5. 마스터 — CPO 운영사 (tb_master_cpo)              │
-- └──────────────────────────────────────────────────────┘
INSERT INTO tb_master_cpo (name, code) VALUES
  ('한국전력공사', 'KEPCO'),
  ('환경부',       'ME'),
  ('이지트로닉스', 'EGT'),
  ('차지비',       'CHEVI')
ON CONFLICT DO NOTHING;

-- ┌──────────────────────────────────────────────────────┐
-- │  6. 마스터 — 고객사 (tb_master_customer)             │
-- └──────────────────────────────────────────────────────┘
INSERT INTO tb_master_customer (name, code, last) VALUES
  ('카스',     'CAS',     '2026-05-18'),
  ('마이크로', 'MICRO',   '2026-05-20'),
  ('LG',       'LG',      '2026-05-21'),
  ('삼성',     'SAMSUNG', '2026-04-30')
ON CONFLICT DO NOTHING;

-- ┌──────────────────────────────────────────────────────┐
-- │  7. 마스터 — 모델 (tb_master_model)                  │
-- └──────────────────────────────────────────────────────┘
INSERT INTO tb_master_model (name, spec, power) VALUES
  ('7kW Wallbox',   '완속 · 벽부착',      '7kW'),
  ('7kW Pedestal',  '완속 · 스탠드형',    '7kW'),
  ('11kW Wallbox',  '완속 · 벽부착',      '11kW'),
  ('11kW Pedestal', '완속 · 스탠드형',    '11kW'),
  ('50kW 1ch',      'DC 콤보 · 단일포트', '50kW'),
  ('50kW 2ch',      'DC 콤보 · 듀얼포트', '50kW'),
  ('100kW 1ch',     'DC 콤보 · 단일포트', '100kW'),
  ('100kW 2ch',     'DC 콤보 · 듀얼포트', '100kW'),
  ('200kW 1ch',     'DC 콤보 · 단일포트', '200kW'),
  ('200kW 2ch',     'DC 콤보 · 단일포트', '100kW')
ON CONFLICT DO NOTHING;

-- ┌──────────────────────────────────────────────────────┐
-- │  8. 마스터 — SW 버전 (tb_master_sw_version)          │
-- └──────────────────────────────────────────────────────┘
INSERT INTO tb_master_sw_version (tag, released, stable) VALUES
  ('v1.6.2-core', '2026-05-14', true),
  ('v1.6.1-core', '2026-04-02', true),
  ('v1.5.8-core', '2026-02-18', true),
  ('v1.7.0-beta', '2026-05-22', false)
ON CONFLICT DO NOTHING;

-- ┌──────────────────────────────────────────────────────┐
-- │  9. 마스터 — 케이블 길이 (tb_master_cable_length)    │
-- └──────────────────────────────────────────────────────┘
INSERT INTO tb_master_cable_length (value) VALUES
  ('3m'), ('5m'), ('7m'), ('10m')
ON CONFLICT DO NOTHING;
