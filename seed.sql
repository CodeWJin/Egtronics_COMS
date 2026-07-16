-- ============================================================
-- E-COMS 초기 스키마 + 시드 데이터 (v3)
-- Supabase SQL 에디터에서 전체 실행 (처음 세팅 또는 재설치 시)
-- ※ 기존 데이터 유지 필요 시 별도 마이그레이션 스크립트 사용
-- ============================================================


-- ┌──────────────────────────────────────────────────────────┐
-- │  0. 핵심 테이블                                           │
-- └──────────────────────────────────────────────────────────┘

-- 사용자 계정 (비밀번호: PBKDF2/SHA-256 해시 또는 평문)
CREATE TABLE IF NOT EXISTS tb_users (
  user_id   TEXT PRIMARY KEY,
  password  TEXT NOT NULL,
  name      TEXT NOT NULL,
  role      TEXT NOT NULL,
  dept      TEXT DEFAULT ''
);
ALTER TABLE tb_users DISABLE ROW LEVEL SECURITY;

-- 영업 오더 (공용 충전기 전용 필드는 tb_usagetype_public으로 분리)
CREATE TABLE IF NOT EXISTS tb_sales_order (
  order_id             TEXT    PRIMARY KEY,
  customer_name        TEXT    DEFAULT '',
  customer_manager     TEXT    DEFAULT '',
  cpo_name             TEXT    DEFAULT '',
  usage_type           TEXT    DEFAULT '공용',
  model_name           TEXT    NOT NULL,
  delivery_date        TEXT    DEFAULT '',
  install_address      TEXT    DEFAULT '',
  field_manager_name   TEXT    DEFAULT '',
  field_manager_phone  TEXT    DEFAULT '',
  status               TEXT    NOT NULL DEFAULT 'PENDING',
  created              TEXT    DEFAULT '',
  cable_length         SMALLINT,
  requested_by         TEXT    DEFAULT ''
);
ALTER TABLE tb_sales_order DISABLE ROW LEVEL SECURITY;

-- 공용 충전기 전용 정보 (usage_type='공용' 오더에 한해 생성)
CREATE TABLE IF NOT EXISTS tb_usagetype_public (
  order_id    TEXT    PRIMARY KEY,
  station_id  TEXT    DEFAULT '',
  charger_no  TEXT    DEFAULT '',
  router_no   TEXT    DEFAULT '',
  usim_no     TEXT    DEFAULT ''
);
ALTER TABLE tb_usagetype_public DISABLE ROW LEVEL SECURITY;

-- 고객사 담당자 (복합 PK: customer_name + name)
CREATE TABLE IF NOT EXISTS tb_customer_manager (
  customer_name TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  phone         TEXT    DEFAULT '',
  is_primary    INTEGER DEFAULT 0,
  PRIMARY KEY (customer_name, name)
);
ALTER TABLE tb_customer_manager DISABLE ROW LEVEL SECURITY;

-- 생산 실적
CREATE TABLE IF NOT EXISTS tb_production_info (
  order_id         TEXT    PRIMARY KEY,
  prod_date        TEXT    DEFAULT '',
  serial_no        TEXT    DEFAULT '',
  inspection_date  TEXT    DEFAULT '',
  sw_version       TEXT    DEFAULT '',
  fw_version       TEXT    DEFAULT ''
);
ALTER TABLE tb_production_info DISABLE ROW LEVEL SECURITY;


-- 충전기 설치 정보
CREATE TABLE IF NOT EXISTS tb_chargepoint_infor (
  id              SERIAL  PRIMARY KEY,
  serial_no       TEXT    NOT NULL,
  model_name      TEXT    NOT NULL,
  order_id        TEXT    DEFAULT '',
  install_address TEXT    DEFAULT '',
  created         TEXT    DEFAULT ''
);
ALTER TABLE tb_chargepoint_infor DISABLE ROW LEVEL SECURITY;


-- ┌──────────────────────────────────────────────────────────┐
-- │  1. 마스터 테이블                                         │
-- └──────────────────────────────────────────────────────────┘

-- 고객사 마스터 (PK: name)
CREATE TABLE IF NOT EXISTS tb_master_customer (
  name       TEXT PRIMARY KEY,
  is_address TEXT DEFAULT '',
  last       TEXT DEFAULT ''
);
ALTER TABLE tb_master_customer DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS tb_master_cpo (
  id    SERIAL PRIMARY KEY,
  name  TEXT   NOT NULL,
  code  TEXT   NOT NULL
);
ALTER TABLE tb_master_cpo DISABLE ROW LEVEL SECURITY;

-- 충전기 모델 마스터 (model_code: 시리얼 채번·체크리스트 파일명에 사용)
CREATE TABLE IF NOT EXISTS tb_master_model (
  id          SERIAL PRIMARY KEY,
  model_code  TEXT   NOT NULL,
  description TEXT   DEFAULT '',
  power       TEXT   DEFAULT ''
);
ALTER TABLE tb_master_model DISABLE ROW LEVEL SECURITY;

-- S/W · F/W 버전 통합 마스터 (type: 'S/W' | 'F/W')
CREATE TABLE IF NOT EXISTS tb_program_version (
  id       SERIAL  PRIMARY KEY,
  type     TEXT    NOT NULL,
  tag      TEXT    NOT NULL,
  released TEXT    DEFAULT '',
  stable   BOOLEAN DEFAULT true
);
ALTER TABLE tb_program_version DISABLE ROW LEVEL SECURITY;


-- ┌──────────────────────────────────────────────────────────┐
-- │  2. 검사 성적서 테이블                                    │
-- └──────────────────────────────────────────────────────────┘

-- 기능 검사 성적서 (order_id UNIQUE)
CREATE TABLE IF NOT EXISTS tb_func_inspection (
  id          SERIAL  PRIMARY KEY,
  serial_no   TEXT    NOT NULL UNIQUE,
  insp_date   TEXT    NOT NULL,
  inspector   TEXT    DEFAULT '',
  checks      TEXT    DEFAULT '{}',
  notes       TEXT    DEFAULT '',
  saved_at    TEXT    NOT NULL
);
ALTER TABLE tb_func_inspection DISABLE ROW LEVEL SECURITY;

-- 출하 검사 성적서 (order_id UNIQUE, photos: JSON 배열)
CREATE TABLE IF NOT EXISTS tb_ship_inspection (
  id          SERIAL  PRIMARY KEY,
  serial_no   TEXT    NOT NULL UNIQUE,
  insp_date   TEXT    NOT NULL,
  inspector   TEXT    DEFAULT '',
  checks      TEXT    DEFAULT '{}',
  notes       TEXT    DEFAULT '',
  saved_at    TEXT    NOT NULL,
  photos      TEXT    DEFAULT '[]'
);
ALTER TABLE tb_ship_inspection DISABLE ROW LEVEL SECURITY;


-- ┌──────────────────────────────────────────────────────────┐
-- │  3. AS 테이블                                            │
-- └──────────────────────────────────────────────────────────┘

-- AS 접수 (접수번호: AS-YYMMDD-NNNN 자동 생성)
CREATE TABLE IF NOT EXISTS tb_as_reception (
  id             SERIAL  PRIMARY KEY,
  reception_no   TEXT    UNIQUE NOT NULL,
  serial_no      TEXT    DEFAULT '',
  fault_type     TEXT    DEFAULT '',
  fault_detail   TEXT    DEFAULT '',
  status         TEXT    DEFAULT '접수대기',
  priority       TEXT    DEFAULT '일반',
  reporter_name  TEXT    DEFAULT '',
  reporter_phone TEXT    DEFAULT '',
  received_at    TEXT    DEFAULT '',
  received_by    TEXT    DEFAULT '',
  assignee       TEXT    DEFAULT '',
  dispatch_date  TEXT    DEFAULT '',
  action_type    TEXT    DEFAULT '',
  action_detail  TEXT    DEFAULT '',
  cost           TEXT    DEFAULT '',
  completed_at   TEXT    DEFAULT '',
  notes          TEXT    DEFAULT '',
  created_at     TEXT    NOT NULL
);
ALTER TABLE tb_as_reception DISABLE ROW LEVEL SECURITY;

-- AS 처리 이력 (상태 변경 시마다 기록)
CREATE TABLE IF NOT EXISTS tb_as_log (
  id            SERIAL  PRIMARY KEY,
  reception_id  INTEGER NOT NULL,
  changed_at    TEXT    NOT NULL,
  changed_by    TEXT    DEFAULT '',
  from_status   TEXT    DEFAULT '',
  to_status     TEXT    DEFAULT '',
  memo          TEXT    DEFAULT ''
);
ALTER TABLE tb_as_log DISABLE ROW LEVEL SECURITY;

-- AS 첨부 사진 메타데이터 (Supabase Storage: as-photos 버킷)
CREATE TABLE IF NOT EXISTS tb_as_photo (
  id            SERIAL  PRIMARY KEY,
  reception_id  INTEGER NOT NULL,
  filename      TEXT    NOT NULL,
  url           TEXT    NOT NULL,
  storage_path  TEXT    DEFAULT '',
  uploaded_by   TEXT    DEFAULT '',
  uploaded_at   TEXT    NOT NULL
);
ALTER TABLE tb_as_photo DISABLE ROW LEVEL SECURITY;


-- ┌──────────────────────────────────────────────────────────┐
-- │  4. CHECK 제약                                           │
-- └──────────────────────────────────────────────────────────┘

ALTER TABLE tb_sales_order
  DROP CONSTRAINT IF EXISTS chk_status,
  ADD  CONSTRAINT chk_status
    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'AWAIT_PICKUP', 'COMPLETED'));

ALTER TABLE tb_users
  DROP CONSTRAINT IF EXISTS chk_role,
  ADD  CONSTRAINT chk_role
    CHECK (role IN ('admin', 'sales', 'production', 'quality'));


-- ┌──────────────────────────────────────────────────────────┐
-- │  5. Supabase Storage 버킷 + RLS 정책                     │
-- └──────────────────────────────────────────────────────────┘

-- as-photos 버킷 (AS 첨부 사진)
INSERT INTO storage.buckets (id, name, public)
VALUES ('as-photos', 'as-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "as_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "as_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "as_photos_delete" ON storage.objects;

CREATE POLICY "as_photos_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'as-photos');
CREATE POLICY "as_photos_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'as-photos');
CREATE POLICY "as_photos_delete" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'as-photos');

-- ship-photos 버킷 (출하 전 첨부 사진)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ship-photos', 'ship-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "ship_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "ship_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "ship_photos_delete" ON storage.objects;

CREATE POLICY "ship_photos_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'ship-photos');
CREATE POLICY "ship_photos_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'ship-photos');
CREATE POLICY "ship_photos_delete" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'ship-photos');


-- ┌──────────────────────────────────────────────────────────┐
-- │  6. 시드 데이터                                          │
-- └──────────────────────────────────────────────────────────┘

-- 6-1. 사용자 (비밀번호는 PBKDF2 해시 또는 평문 '1234')
INSERT INTO tb_users (user_id, password, name, role, dept) VALUES
  ('admin',   'pbkdf2:abecda8d994f73e3eb60b41b70e8eed8:4f1a5cc28550efb5a2a6d46cac23d6e016dfb389505b4d1ea06a1a55a5114431', '박우진', 'admin',      '충전기개발실'),
  ('sales',   'pbkdf2:a99d64e6a893d91450c27648b1987ef6:07f87335c9bbddcb82870a1e2bc73e9a69daa7f139504e43c45489b650889e57', '신정륜', 'sales',      '영업부'),
  ('prod',    'pbkdf2:8f465db994fcc194989b55933cd4124e:0d219653ff7bd171665b7e6f1335f122d13e4f0703f970d81908fcd3a5f4172a', '김태윤', 'production', '생산부'),
  ('quality', '1234',                                                                                                       '민경선', 'quality',    '품질관리본부')
ON CONFLICT (user_id) DO NOTHING;

-- 6-2. 고객사 마스터
INSERT INTO tb_master_customer (name, is_address, last) VALUES
  ('카스',     '', '2026-05-18'),
  ('마이크로', '', '2026-05-20'),
  ('LG',       '', '2026-05-21'),
  ('삼성',     '', '2026-04-30')
ON CONFLICT (name) DO NOTHING;

-- 6-3. 고객사 담당자
INSERT INTO tb_customer_manager (customer_name, name, phone, is_primary) VALUES
  ('카스',     '이XX', '010-2222-4444', 1),
  ('카스',     '최XX', '010-7788-1099', 1),
  ('카스',     '김XX', '010-5555-8888', 0),
  ('마이크로', '조XX', '010-6666-3333', 1),
  ('마이크로', '윤XX', '010-4444-9999', 1),
  ('마이크로', '서XX', '010-1111-7777', 1),
  ('마이크로', '강XX', '010-2222-1111', 1)
ON CONFLICT (customer_name, name) DO NOTHING;

-- 6-4. 영업 오더
INSERT INTO tb_sales_order
  (order_id, customer_name, customer_manager, cpo_name, usage_type,
   model_name, delivery_date, install_address,
   field_manager_name, field_manager_phone,
   status, created)
VALUES
  ('260208001', '카스',     '이XX',                '한국전력공사', '공용',   'EGFA210001',   '2026-06-12',
   '서울특별시 강남구 테헤란로 152, 강남파이낸스센터 지하 2층',
   '', '', 'PENDING', '2026-05-22'),

  ('260208002', '카스',     '이XX',                '환경부',       '공용',   'EGMI105001',   '2026-06-15',
   '인천광역시 연수구 컨벤시아대로 165',
   '', '', 'PENDING', '2026-05-23'),

  ('260208003', '마이크로', '조XX',                '',             '비공용', 'EGSW101102',   '2026-07-02',
   '대구광역시 수성구 동대구로 285',
   '', '', 'PENDING', '2026-05-27'),

  ('260209001', '마이크로', '조XX',                '이지트로닉스', '공용',   'EGFA210001',   '2026-06-05',
   '서울특별시 송파구 올림픽로 300',
   '', '', 'AWAIT_PICKUP', '2026-05-18'),

  ('260209002', '마이크로', '강XX (010-2222-1111)', '',            '비공용', 'EGSW100703PI', '2026-07-24',
   '[01687] 서울 노원구 동일로221길 22',
   '', '', 'PENDING', '2026-07-09'),

  ('260209003', '마이크로', '강XX (010-2222-1111)', '',            '비공용', 'EGMI205001',   '2026-07-24',
   '[01687] 서울 노원구 동일로221길 22',
   '', '', 'PENDING', '2026-07-09'),

  ('260209004', '마이크로', '강XX (010-2222-1111)', '',            '비공용', 'EGSW101103PI', '2026-07-24',
   '[01687] 서울 노원구 동일로221길 22',
   '', '', 'PENDING', '2026-07-09'),

  ('260209005', '마이크로', '서XX (010-1111-7777)', '',            '비공용', 'EGSW101103PI', '2026-07-24',
   '[01687] 서울 노원구 동일로221길 22',
   '', '', 'PENDING', '2026-07-09')
ON CONFLICT (order_id) DO NOTHING;

-- 6-5. 공용 충전기 전용 정보
INSERT INTO tb_usagetype_public (order_id, station_id, charger_no, router_no, usim_no) VALUES
  ('260208001', 'CT9006_01',    '', 'RTR-2024-08172', '8982001234567890123'),
  ('260208002', 'CR1006_01',    '', 'RTR-2024-08183', '8982001234567890238'),
  ('260209001', 'LOT-SEL-0188', '', 'RTR-2024-08105', '8982001234567889921')
ON CONFLICT (order_id) DO NOTHING;

-- 6-6. 생산 실적
INSERT INTO tb_production_info
  (order_id, prod_date, serial_no, inspection_date, sw_version, fw_version)
VALUES
  ('260209001', '2026-05-26', 'SGT100K-26052601A', '2026-05-27',
   'v1.6.2-core', 'v1.6.2-fw')
ON CONFLICT (order_id) DO NOTHING;

-- 6-7. CPO 운영사 마스터
INSERT INTO tb_master_cpo (name, code) VALUES
  ('한국전력공사', 'KEPCO'),
  ('환경부',       'ME'),
  ('이지트로닉스', 'EGT'),
  ('차지비',       'CHEVI')
ON CONFLICT DO NOTHING;

-- 6-8. 충전기 모델 마스터
INSERT INTO tb_master_model (model_code, description, power) VALUES
  ('EGSW100703',   '공용 · IC · PLC · OBD',    '7kW'),
  ('EGSW100703I',  '공용 · IC',                 '7kW'),
  ('EGSW100703PI', '공용 · IC · PLC',           '7kW'),
  ('EGSW100701',   '부분공용',                   '7kW'),
  ('EGSW100703P',  '부분공용 · PLC',             '7kW'),
  ('EGSW100703N',  '부분공용',                   '7kW'),
  ('EGSW100702',   '비공용',                     '7kW'),
  ('EGSW101103I',  '공용 · IC',                 '11kW'),
  ('EGSW101103PI', '공용 · IC · PLC',           '11kW'),
  ('EGSW101103',   '공용 · IC · PLC · OBD',    '11kW'),
  ('EGSW101101',   '부분공용',                   '11kW'),
  ('EGSW101103P',  '부분공용 · PLC',             '11kW'),
  ('EGSW101103N',  '부분공용',                   '11kW'),
  ('EGSW101102',   '비공용',                     '11kW'),
  ('EGMI103001',   '1채널 · CCS1 단일',         '30kW'),
  ('EGMI104001',   '1채널 · CCS1 단일',         '40kW'),
  ('EGMI105001',   '1채널 · CCS1 단일',         '50kW'),
  ('EGMI205001',   '2채널 · CCS1 듀얼',         '50kW'),
  ('EGFA110001',   '1채널 · CCS1 단일',         '100kW'),
  ('EGFA210001',   '2채널 · CCS1 듀얼',         '100kW'),
  ('EGFA120001',   '1채널 · CCS1 단일',         '200kW'),
  ('EGFA220001',   '2채널 · CCS1 듀얼',         '200kW')
ON CONFLICT DO NOTHING;

-- 6-9. S/W · F/W 버전 마스터 (통합)
INSERT INTO tb_program_version (type, tag, released, stable) VALUES
  ('S/W', 'v1.6.2-core',    '2026-05-14', true),
  ('S/W', 'v1.6.1-core',    '2026-04-02', true),
  ('S/W', 'v1.5.8-core',    '2026-02-18', true),
  ('S/W', 'v1.7.0-beta',    '2026-05-22', false),
  ('F/W', 'v1.6.2-fw',      '2026-05-14', true),
  ('F/W', 'v1.6.1-fw',      '2026-04-02', true),
  ('F/W', 'v1.5.8-fw',      '2026-02-18', true),
  ('F/W', 'v1.7.0-fw-beta', '2026-05-22', false)
ON CONFLICT DO NOTHING;
