-- ============================================================
-- E-COMS 초기 스키마 + 시드 데이터 (v5)
-- Supabase SQL 에디터에서 전체 실행 (처음 세팅 또는 재설치 시)
-- ※ 기존 데이터 유지 필요 시 별도 마이그레이션 스크립트 사용
-- ※ v5: 오더(배치)/충전기(유닛) 분리 구조로 전면 재설계 (2026-07-24)
--   - tb_sales_order: 충전기 1대당 1행이던 구조 → 모델/용도/수량만 담는 "배치 헤더"로 축소
--   - tb_charge_infor 신규: 충전기 유닛 1대 = 1행. 상태(PENDING~COMPLETED)를 오더가 아닌
--     유닛 단위로 보유. 구 tb_production_info + tb_chargepoint_infor를 완전 흡수
--   - tb_usagetype_public / tb_inspection_func / tb_inspection_ship: order_id 대신
--     tb_charge_infor가 id로 단방향 참조하는 위성 테이블로 전환(역방향 FK 제거)
--   - tb_master_customer → tb_customer로 개명, is_address(체크박스 오용 컬럼) → address(주소 문자열)
--     로 의미 정정. 갱신되지 않던 죽은 필드 'last'는 폐기
--   - tb_order_history.order_id → charge_id로 리네임(충전기 유닛 단위 이력임을 명확화)
--   - tb_production_info, tb_chargepoint_infor, tb_master_customer 테이블 폐기
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

-- 영업 오더(배치) — 모델·용도·수량 요청 정보만 보관, 상태 없음
-- order_id: YYMMDD-NNNN 자동 생성 (db.js의 PMDB._genOrderId, 당일 순번 4자리)
CREATE TABLE IF NOT EXISTS tb_sales_order (
  order_id      TEXT     PRIMARY KEY,
  model_name    TEXT     NOT NULL,
  usage_type    TEXT     DEFAULT '공용',
  qty           SMALLINT NOT NULL DEFAULT 1,
  requested_by  TEXT     DEFAULT '',
  created       TEXT     DEFAULT ''
);

-- 공용충전기 전용 정보 — 위성 테이블(부모인 tb_charge_infor가 id로 단방향 참조)
CREATE TABLE IF NOT EXISTS tb_usagetype_public (
  id               SERIAL  PRIMARY KEY,
  inspection_date  TEXT    DEFAULT '',
  station_id       TEXT    DEFAULT '',
  charger_no       TEXT    DEFAULT '',
  router_no        TEXT    DEFAULT '',
  usim_no          TEXT    DEFAULT '',
  cpo_name         TEXT    DEFAULT '',
  created          TEXT    DEFAULT ''
);

-- 고객사 담당자 (복합 PK: customer_name + name)
CREATE TABLE IF NOT EXISTS tb_customer_manager (
  customer_name TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  phone         TEXT    DEFAULT '',
  is_primary    INTEGER DEFAULT 0,
  PRIMARY KEY (customer_name, name)
);

-- 충전기 정보 — 허브 테이블. 충전기 유닛 1대 = 1행.
-- 구 tb_production_info(생산실적) + 구 tb_chargepoint_infor(설치정보)를 완전 흡수.
CREATE TABLE IF NOT EXISTS tb_charge_infor (
  id                    TEXT     PRIMARY KEY,
  order_id              TEXT,
  model_name            TEXT     NOT NULL,
  usage_type            TEXT     DEFAULT '공용',
  serial_no             TEXT     DEFAULT '',
  status                TEXT     NOT NULL DEFAULT 'PENDING',

  usage_public_id       INTEGER,
  func_inspection_id    INTEGER,
  ship_inspection_id    INTEGER,

  sw_version            TEXT     DEFAULT '',
  fw_version            TEXT     DEFAULT '',
  cable_length          SMALLINT,

  prod_date             TEXT     DEFAULT '',
  delivery_date         TEXT     DEFAULT '',
  ship_from_address     TEXT     DEFAULT '',
  install_address       TEXT     DEFAULT '',

  customer_name         TEXT     DEFAULT '',
  customer_manager      TEXT     DEFAULT '',
  field_manager_phone   TEXT     DEFAULT '',

  created               TEXT     DEFAULT ''
);
COMMENT ON COLUMN tb_charge_infor.cable_length IS '케이블 길이';
COMMENT ON COLUMN tb_charge_infor.ship_from_address IS '출하장소(출고지) 주소 - 설치장소와 별도 관리';

-- 오더 변경 이력 (충전기 유닛 단위로 상태 전환·필드 수정 시마다 기록)
-- FK 미설정(의도적): cancelOrder가 유닛 삭제 전 이력을 먼저 남기므로, 유닛이 삭제돼도
-- 이력 레코드는 남아 있어야 한다 — FK를 걸면 ON DELETE 정책에 따라 이력까지 같이 지워질 수 있음
CREATE TABLE IF NOT EXISTS tb_order_history (
  history_id      SERIAL  PRIMARY KEY,
  charge_id       TEXT    NOT NULL,
  serial_no       TEXT    DEFAULT '',
  changed_at      TEXT    NOT NULL,
  changed_by      TEXT    DEFAULT '',
  action          TEXT    DEFAULT 'update',
  changed_fields  TEXT    DEFAULT '[]'
);


-- ┌──────────────────────────────────────────────────────────┐
-- │  1. 마스터 테이블                                         │
-- └──────────────────────────────────────────────────────────┘

-- 고객사(발주처) 마스터 (PK: name)
CREATE TABLE IF NOT EXISTS tb_customer (
  name     TEXT PRIMARY KEY,
  address  TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tb_master_cpo (
  id    SERIAL PRIMARY KEY,
  name  TEXT   NOT NULL,
  code  TEXT   NOT NULL
);

-- 충전기 모델 마스터 (model_code: 시리얼 채번·체크리스트 파일명에 사용)
CREATE TABLE IF NOT EXISTS tb_master_model (
  id          SERIAL PRIMARY KEY,
  model_code  TEXT   NOT NULL,
  description TEXT   DEFAULT '',
  power       TEXT   DEFAULT ''
);

-- S/W · F/W 버전 통합 마스터 (type: 'S/W' | 'F/W')
CREATE TABLE IF NOT EXISTS tb_program_version (
  id       SERIAL  PRIMARY KEY,
  type     TEXT    NOT NULL,
  tag      TEXT    NOT NULL,
  released TEXT    DEFAULT '',
  stable   BOOLEAN DEFAULT true
);


-- ┌──────────────────────────────────────────────────────────┐
-- │  2. 검사 성적서 테이블                                    │
-- └──────────────────────────────────────────────────────────┘

-- 기능 검사 성적서 — 위성 테이블(부모인 tb_charge_infor가 id로 단방향 참조)
CREATE TABLE IF NOT EXISTS tb_inspection_func (
  id          SERIAL  PRIMARY KEY,
  insp_date   TEXT    NOT NULL,
  inspector   TEXT    DEFAULT '',
  checks      TEXT    DEFAULT '{}',
  notes       TEXT    DEFAULT '',
  saved_at    TEXT    NOT NULL
);

-- 출하 검사 성적서 — 위성 테이블 (photos: JSON 배열)
CREATE TABLE IF NOT EXISTS tb_inspection_ship (
  id          SERIAL  PRIMARY KEY,
  insp_date   TEXT    NOT NULL,
  inspector   TEXT    DEFAULT '',
  checks      TEXT    DEFAULT '{}',
  notes       TEXT    DEFAULT '',
  saved_at    TEXT    NOT NULL,
  photos      TEXT    DEFAULT '[]'
);


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


-- ┌──────────────────────────────────────────────────────────┐
-- │  4. CHECK 제약                                           │
-- └──────────────────────────────────────────────────────────┘

ALTER TABLE tb_charge_infor
  DROP CONSTRAINT IF EXISTS chk_charge_status,
  ADD  CONSTRAINT chk_charge_status
    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'AWAIT_PICKUP', 'COMPLETED'));

ALTER TABLE tb_users
  DROP CONSTRAINT IF EXISTS chk_role,
  ADD  CONSTRAINT chk_role
    CHECK (role IN ('admin', 'sales', 'production', 'quality'));


-- ┌──────────────────────────────────────────────────────────┐
-- │  5. FK 제약                                              │
-- └──────────────────────────────────────────────────────────┘

-- order_id는 NULL 허용(AS접수 화면에서 오더 없이 수동 등록하는 실물 충전기 지원)
ALTER TABLE tb_charge_infor
  DROP CONSTRAINT IF EXISTS fk_charge_order,
  ADD  CONSTRAINT fk_charge_order
    FOREIGN KEY (order_id) REFERENCES tb_sales_order(order_id) ON DELETE CASCADE;

ALTER TABLE tb_charge_infor
  DROP CONSTRAINT IF EXISTS fk_charge_usage_public,
  ADD  CONSTRAINT fk_charge_usage_public
    FOREIGN KEY (usage_public_id) REFERENCES tb_usagetype_public(id) ON DELETE SET NULL;

ALTER TABLE tb_charge_infor
  DROP CONSTRAINT IF EXISTS fk_charge_func_inspection,
  ADD  CONSTRAINT fk_charge_func_inspection
    FOREIGN KEY (func_inspection_id) REFERENCES tb_inspection_func(id) ON DELETE SET NULL;

ALTER TABLE tb_charge_infor
  DROP CONSTRAINT IF EXISTS fk_charge_ship_inspection,
  ADD  CONSTRAINT fk_charge_ship_inspection
    FOREIGN KEY (ship_inspection_id) REFERENCES tb_inspection_ship(id) ON DELETE SET NULL;

ALTER TABLE tb_as_log
  DROP CONSTRAINT IF EXISTS fk_as_log_reception,
  ADD  CONSTRAINT fk_as_log_reception
    FOREIGN KEY (reception_id) REFERENCES tb_as_reception(id) ON DELETE CASCADE;

ALTER TABLE tb_as_photo
  DROP CONSTRAINT IF EXISTS fk_as_photo_reception,
  ADD  CONSTRAINT fk_as_photo_reception
    FOREIGN KEY (reception_id) REFERENCES tb_as_reception(id) ON DELETE CASCADE;


-- ┌──────────────────────────────────────────────────────────┐
-- │  5-1. 인덱스                                              │
-- └──────────────────────────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS idx_charge_order_id  ON tb_charge_infor(order_id);
CREATE INDEX IF NOT EXISTS idx_charge_status    ON tb_charge_infor(status);
CREATE INDEX IF NOT EXISTS idx_charge_serial_no ON tb_charge_infor(serial_no);
CREATE INDEX IF NOT EXISTS idx_history_charge_id ON tb_order_history(charge_id);


-- ┌──────────────────────────────────────────────────────────┐
-- │  6. RLS 정책 (테이블)                                     │
-- └──────────────────────────────────────────────────────────┘
-- 프런트엔드가 Supabase anon key로 직접 CRUD하므로, 전 테이블 RLS를 활성화한 뒤
-- anon 역할에 전체 허용(true) 정책을 부여한다 (실제 운영 중인 방식).

ALTER TABLE tb_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_users_anon_all ON tb_users;
CREATE POLICY tb_users_anon_all ON tb_users FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_sales_order ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_sales_order_anon_all ON tb_sales_order;
CREATE POLICY tb_sales_order_anon_all ON tb_sales_order FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_charge_infor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_charge_infor_anon_all ON tb_charge_infor;
CREATE POLICY tb_charge_infor_anon_all ON tb_charge_infor FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_usagetype_public ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_usagetype_public_anon_all ON tb_usagetype_public;
CREATE POLICY tb_usagetype_public_anon_all ON tb_usagetype_public FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_customer_manager ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_customer_manager_anon_all ON tb_customer_manager;
CREATE POLICY tb_customer_manager_anon_all ON tb_customer_manager FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_order_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_order_history_anon_all ON tb_order_history;
CREATE POLICY tb_order_history_anon_all ON tb_order_history FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_customer ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_customer_anon_all ON tb_customer;
CREATE POLICY tb_customer_anon_all ON tb_customer FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_master_cpo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_master_cpo_anon_all ON tb_master_cpo;
CREATE POLICY tb_master_cpo_anon_all ON tb_master_cpo FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_master_model ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_master_model_anon_all ON tb_master_model;
CREATE POLICY tb_master_model_anon_all ON tb_master_model FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_program_version ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_program_version_anon_all ON tb_program_version;
CREATE POLICY tb_program_version_anon_all ON tb_program_version FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_inspection_func ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_inspection_func_anon_all ON tb_inspection_func;
CREATE POLICY tb_inspection_func_anon_all ON tb_inspection_func FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_inspection_ship ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_inspection_ship_anon_all ON tb_inspection_ship;
CREATE POLICY tb_inspection_ship_anon_all ON tb_inspection_ship FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_as_reception ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_as_reception_anon_all ON tb_as_reception;
CREATE POLICY tb_as_reception_anon_all ON tb_as_reception FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_as_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_as_log_anon_all ON tb_as_log;
CREATE POLICY tb_as_log_anon_all ON tb_as_log FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE tb_as_photo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_as_photo_anon_all ON tb_as_photo;
CREATE POLICY tb_as_photo_anon_all ON tb_as_photo FOR ALL TO anon USING (true) WITH CHECK (true);


-- ┌──────────────────────────────────────────────────────────┐
-- │  7. Supabase Storage 버킷 + RLS 정책                     │
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
-- │  8. 시드 데이터                                          │
-- └──────────────────────────────────────────────────────────┘

-- 8-1. 사용자 (비밀번호는 PBKDF2 해시 또는 평문 '1234')
INSERT INTO tb_users (user_id, password, name, role, dept) VALUES
  ('admin',   'pbkdf2:abecda8d994f73e3eb60b41b70e8eed8:4f1a5cc28550efb5a2a6d46cac23d6e016dfb389505b4d1ea06a1a55a5114431', '박우진', 'admin',      '충전기개발실'),
  ('sales',   'pbkdf2:a99d64e6a893d91450c27648b1987ef6:07f87335c9bbddcb82870a1e2bc73e9a69daa7f139504e43c45489b650889e57', '신정륜', 'sales',      '영업부'),
  ('prod',    'pbkdf2:8f465db994fcc194989b55933cd4124e:0d219653ff7bd171665b7e6f1335f122d13e4f0703f970d81908fcd3a5f4172a', '김태윤', 'production', '생산부'),
  ('quality', '1234',                                                                                                       '민경선', 'quality',    '품질관리본부')
ON CONFLICT (user_id) DO NOTHING;

-- 8-2. 고객사 마스터
INSERT INTO tb_customer (name, address) VALUES
  ('카스',     ''),
  ('마이크로', ''),
  ('LG',       ''),
  ('삼성',     '')
ON CONFLICT (name) DO NOTHING;

-- 8-3. 고객사 담당자
INSERT INTO tb_customer_manager (customer_name, name, phone, is_primary) VALUES
  ('카스',     '이XX', '010-2222-4444', 1),
  ('카스',     '최XX', '010-7788-1099', 1),
  ('카스',     '김XX', '010-5555-8888', 0),
  ('마이크로', '조XX', '010-6666-3333', 1),
  ('마이크로', '윤XX', '010-4444-9999', 1),
  ('마이크로', '서XX', '010-1111-7777', 1),
  ('마이크로', '강XX', '010-2222-1111', 1)
ON CONFLICT (customer_name, name) DO NOTHING;

-- 8-4. CPO 운영사 마스터
INSERT INTO tb_master_cpo (name, code) VALUES
  ('한국전력공사', 'KEPCO'),
  ('환경부',       'ME'),
  ('이지트로닉스', 'EGT'),
  ('차지비',       'CHEVI')
ON CONFLICT DO NOTHING;

-- 8-5. 충전기 모델 마스터
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

-- 8-6. S/W · F/W 버전 마스터 (통합)
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

-- 8-7. 영업 오더(배치) — 예시로 2건(공용 2대 배치, 비공용 1대 배치)만 시드
INSERT INTO tb_sales_order (order_id, model_name, usage_type, qty, requested_by, created) VALUES
  ('260208001', 'EGFA210001', '공용',   2, '신정륜', '2026-05-22'),
  ('260208002', 'EGSW101102', '비공용', 1, '신정륜', '2026-05-27')
ON CONFLICT (order_id) DO NOTHING;

-- 8-8. 공용충전기 전용 정보 (배치 260208001의 유닛 1개 몫)
INSERT INTO tb_usagetype_public (id, inspection_date, station_id, charger_no, router_no, usim_no, cpo_name, created) VALUES
  (1, '', 'CT9006', '01', 'RTR-2024-08172', '8982001234567890123', '한국전력공사', '2026-05-22')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('tb_usagetype_public', 'id'), (SELECT MAX(id) FROM tb_usagetype_public));

-- 8-9. 충전기 정보 (배치 260208001 → 유닛 2대, 배치 260208002 → 유닛 1대)
INSERT INTO tb_charge_infor
  (id, order_id, model_name, usage_type, serial_no, status, usage_public_id,
   sw_version, fw_version, cable_length, prod_date, delivery_date, ship_from_address, install_address,
   customer_name, customer_manager, field_manager_phone, created)
VALUES
  ('260208001-01', '260208001', 'EGFA210001', '공용', 'SGT100K-26052601A', 'AWAIT_PICKUP', 1,
   'v1.6.2-core', 'v1.6.2-fw', 5, '2026-05-26', '2026-06-12', '', '서울특별시 강남구 테헤란로 152, 강남파이낸스센터 지하 2층',
   '카스', '이XX', '010-2222-4444', '2026-05-22'),

  ('260208001-02', '260208001', 'EGFA210001', '공용', '', 'PENDING', NULL,
   '', '', NULL, '', '', '', '',
   '', '', '', '2026-05-22'),

  ('260208002-01', '260208002', 'EGSW101102', '비공용', '', 'PENDING', NULL,
   '', '', NULL, '', '', '', '',
   '', '', '', '2026-05-27')
ON CONFLICT (id) DO NOTHING;
