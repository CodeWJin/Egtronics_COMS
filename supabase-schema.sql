-- ============================================================
-- E-COMS Supabase 스키마 — 마이그레이션 전용
-- ============================================================
-- [A] 기존 테이블이 있는 경우 → 이 파일 전체 실행 (기존 데이터 유지, 신규 컬럼·테이블만 추가)
-- [B] 처음 세팅하는 경우    → seed.sql 전체 실행 (테이블 생성 + 시드 데이터 포함)
--
-- ※ v5(오더/배치·충전기/유닛 분리 리팩터, 2026-07-24) 반영:
--   tb_charge_infor(충전기 유닛 허브), tb_customer/tb_customer_manager,
--   tb_order_history, tb_usagetype_public, tb_inspection_func/tb_inspection_ship,
--   tb_program_version, tb_users 를 이 파일에 새로 추가했다.
--   구 users / tb_master_customer / tb_func_inspection / tb_ship_inspection /
--   tb_master_sw_version / tb_master_cable_length 테이블은 v5에서 폐기됐다 —
--   데이터가 남아있다면 수동으로 이관 후 삭제할 것(자동 이관 스크립트 없음).
-- ============================================================

-- ┌─────────────────────────────────────────────────────────┐
-- │  0. 핵심 테이블 (v5)                                      │
-- └─────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS tb_users (
  user_id   TEXT PRIMARY KEY,
  password  TEXT NOT NULL,
  name      TEXT NOT NULL,
  role      TEXT NOT NULL,
  dept      TEXT DEFAULT ''
);
ALTER TABLE tb_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_users_anon_all ON tb_users;
CREATE POLICY tb_users_anon_all ON tb_users FOR ALL TO anon USING (true) WITH CHECK (true);

-- 영업 오더(배치) — 모델·용도·수량만 보관, 상태 없음(상태는 tb_charge_infor가 유닛 단위로 보유)
CREATE TABLE IF NOT EXISTS tb_sales_order (
  order_id      TEXT     PRIMARY KEY,
  model_name    TEXT     NOT NULL,
  usage_type    TEXT     DEFAULT '공용',
  qty           SMALLINT NOT NULL DEFAULT 1,
  requested_by  TEXT     DEFAULT '',
  created       TEXT     DEFAULT ''
);
ALTER TABLE tb_sales_order ADD COLUMN IF NOT EXISTS usage_type   TEXT DEFAULT '공용';
ALTER TABLE tb_sales_order ADD COLUMN IF NOT EXISTS requested_by TEXT DEFAULT '';
ALTER TABLE tb_sales_order ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_sales_order_anon_all ON tb_sales_order;
CREATE POLICY tb_sales_order_anon_all ON tb_sales_order FOR ALL TO anon USING (true) WITH CHECK (true);

-- 공용충전기 전용 정보 — 위성 테이블(tb_charge_infor가 usage_public_id로 단방향 참조)
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
ALTER TABLE tb_usagetype_public ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_usagetype_public_anon_all ON tb_usagetype_public;
CREATE POLICY tb_usagetype_public_anon_all ON tb_usagetype_public FOR ALL TO anon USING (true) WITH CHECK (true);

-- 고객사 담당자 (복합 PK: customer_name + name)
CREATE TABLE IF NOT EXISTS tb_customer_manager (
  customer_name TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  phone         TEXT    DEFAULT '',
  is_primary    INTEGER DEFAULT 0,
  PRIMARY KEY (customer_name, name)
);
ALTER TABLE tb_customer_manager ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_customer_manager_anon_all ON tb_customer_manager;
CREATE POLICY tb_customer_manager_anon_all ON tb_customer_manager FOR ALL TO anon USING (true) WITH CHECK (true);

-- 고객사 납품장소 (복합 PK: customer_name + label)
CREATE TABLE IF NOT EXISTS tb_customer_address (
  customer_name TEXT    NOT NULL,
  label         TEXT    NOT NULL,
  address       TEXT    NOT NULL DEFAULT '',
  is_primary    INTEGER DEFAULT 0,
  PRIMARY KEY (customer_name, label)
);
ALTER TABLE tb_customer_address ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_customer_address_anon_all ON tb_customer_address;
CREATE POLICY tb_customer_address_anon_all ON tb_customer_address FOR ALL TO anon USING (true) WITH CHECK (true);

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
ALTER TABLE tb_charge_infor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_charge_infor_anon_all ON tb_charge_infor;
CREATE POLICY tb_charge_infor_anon_all ON tb_charge_infor FOR ALL TO anon USING (true) WITH CHECK (true);

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
ALTER TABLE tb_order_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_order_history_anon_all ON tb_order_history;
CREATE POLICY tb_order_history_anon_all ON tb_order_history FOR ALL TO anon USING (true) WITH CHECK (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │  1. 마스터 테이블 (v5)                                    │
-- └─────────────────────────────────────────────────────────┘

-- 고객사(발주처) 마스터 (PK: name) — 구 tb_master_customer 대체
CREATE TABLE IF NOT EXISTS tb_customer (
  name     TEXT PRIMARY KEY,
  address  TEXT DEFAULT ''
);
ALTER TABLE tb_customer ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_customer_anon_all ON tb_customer;
CREATE POLICY tb_customer_anon_all ON tb_customer FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS tb_master_cpo (
  id    SERIAL PRIMARY KEY,
  name  TEXT   NOT NULL,
  code  TEXT   NOT NULL
);
ALTER TABLE tb_master_cpo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_master_cpo_anon_all ON tb_master_cpo;
CREATE POLICY tb_master_cpo_anon_all ON tb_master_cpo FOR ALL TO anon USING (true) WITH CHECK (true);

-- 충전기 모델 마스터 (model_code: 시리얼 채번·체크리스트 파일명에 사용, name 컬럼 없음)
CREATE TABLE IF NOT EXISTS tb_master_model (
  id          SERIAL PRIMARY KEY,
  model_code  TEXT   NOT NULL,
  description TEXT   DEFAULT '',
  power       TEXT   DEFAULT ''
);
ALTER TABLE tb_master_model ADD COLUMN IF NOT EXISTS model_code  TEXT DEFAULT '';
ALTER TABLE tb_master_model ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE tb_master_model ADD COLUMN IF NOT EXISTS power       TEXT DEFAULT '';
ALTER TABLE tb_master_model ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_master_model_anon_all ON tb_master_model;
CREATE POLICY tb_master_model_anon_all ON tb_master_model FOR ALL TO anon USING (true) WITH CHECK (true);

-- S/W · F/W 버전 통합 마스터 (type: 'S/W' | 'F/W') — 구 tb_master_sw_version 대체
CREATE TABLE IF NOT EXISTS tb_program_version (
  id       SERIAL  PRIMARY KEY,
  type     TEXT    NOT NULL,
  tag      TEXT    NOT NULL,
  released TEXT    DEFAULT '',
  stable   BOOLEAN DEFAULT true
);
ALTER TABLE tb_program_version ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_program_version_anon_all ON tb_program_version;
CREATE POLICY tb_program_version_anon_all ON tb_program_version FOR ALL TO anon USING (true) WITH CHECK (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │  2. 검사 성적서 테이블 (v5 — 구 tb_func_inspection/         │
-- │     tb_ship_inspection의 order_id FK 방식을 대체)          │
-- └─────────────────────────────────────────────────────────┘

-- 기능 검사 성적서 — 위성 테이블(tb_charge_infor가 func_inspection_id로 단방향 참조)
CREATE TABLE IF NOT EXISTS tb_inspection_func (
  id          SERIAL  PRIMARY KEY,
  insp_date   TEXT    NOT NULL,
  inspector   TEXT    DEFAULT '',
  checks      TEXT    DEFAULT '{}',
  notes       TEXT    DEFAULT '',
  saved_at    TEXT    NOT NULL
);
ALTER TABLE tb_inspection_func ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_inspection_func_anon_all ON tb_inspection_func;
CREATE POLICY tb_inspection_func_anon_all ON tb_inspection_func FOR ALL TO anon USING (true) WITH CHECK (true);

-- 출하 검사 성적서 — 위성 테이블 (photos: JSON 배열, ship-photos 버킷 연동)
CREATE TABLE IF NOT EXISTS tb_inspection_ship (
  id          SERIAL  PRIMARY KEY,
  insp_date   TEXT    NOT NULL,
  inspector   TEXT    DEFAULT '',
  checks      TEXT    DEFAULT '{}',
  notes       TEXT    DEFAULT '',
  saved_at    TEXT    NOT NULL,
  photos      TEXT    DEFAULT '[]'
);
ALTER TABLE tb_inspection_ship ADD COLUMN IF NOT EXISTS photos TEXT DEFAULT '[]';
ALTER TABLE tb_inspection_ship ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_inspection_ship_anon_all ON tb_inspection_ship;
CREATE POLICY tb_inspection_ship_anon_all ON tb_inspection_ship FOR ALL TO anon USING (true) WITH CHECK (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │  3. AS 테이블 (독립 AS 관리 모듈)                          │
-- └─────────────────────────────────────────────────────────┘

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
ALTER TABLE tb_as_reception ADD COLUMN IF NOT EXISTS serial_no TEXT DEFAULT '';
ALTER TABLE tb_as_reception ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_as_reception_anon_all ON tb_as_reception;
CREATE POLICY tb_as_reception_anon_all ON tb_as_reception FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS tb_as_log (
  id            SERIAL  PRIMARY KEY,
  reception_id  INTEGER NOT NULL,
  changed_at    TEXT    NOT NULL,
  changed_by    TEXT    DEFAULT '',
  from_status   TEXT    DEFAULT '',
  to_status     TEXT    DEFAULT '',
  memo          TEXT    DEFAULT ''
);
ALTER TABLE tb_as_log
  DROP CONSTRAINT IF EXISTS fk_as_log_reception,
  ADD  CONSTRAINT fk_as_log_reception
    FOREIGN KEY (reception_id) REFERENCES tb_as_reception(id) ON DELETE CASCADE;
ALTER TABLE tb_as_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_as_log_anon_all ON tb_as_log;
CREATE POLICY tb_as_log_anon_all ON tb_as_log FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS tb_as_photo (
  id            SERIAL  PRIMARY KEY,
  reception_id  INTEGER NOT NULL,
  filename      TEXT    NOT NULL,
  url           TEXT    NOT NULL,
  storage_path  TEXT    DEFAULT '',
  uploaded_by   TEXT    DEFAULT '',
  uploaded_at   TEXT    NOT NULL
);
ALTER TABLE tb_as_photo
  DROP CONSTRAINT IF EXISTS fk_as_photo_reception,
  ADD  CONSTRAINT fk_as_photo_reception
    FOREIGN KEY (reception_id) REFERENCES tb_as_reception(id) ON DELETE CASCADE;
ALTER TABLE tb_as_photo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_as_photo_anon_all ON tb_as_photo;
CREATE POLICY tb_as_photo_anon_all ON tb_as_photo FOR ALL TO anon USING (true) WITH CHECK (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │  4. CHECK 제약 (npm test 통과에 필요)                      │
-- └─────────────────────────────────────────────────────────┘

-- 충전기 유닛 상태: 허용 값 외 삽입·수정 거부
ALTER TABLE tb_charge_infor
  DROP CONSTRAINT IF EXISTS chk_charge_status,
  ADD  CONSTRAINT chk_charge_status
    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'AWAIT_PICKUP', 'COMPLETED'));

-- 사용자 역할: 허용 값 외 삽입·수정 거부
ALTER TABLE tb_users
  DROP CONSTRAINT IF EXISTS chk_role,
  ADD  CONSTRAINT chk_role
    CHECK (role IN ('admin', 'sales', 'production', 'quality'));

-- ┌─────────────────────────────────────────────────────────┐
-- │  5. FK 제약                                              │
-- └─────────────────────────────────────────────────────────┘

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

-- ┌─────────────────────────────────────────────────────────┐
-- │  5-1. 인덱스                                              │
-- └─────────────────────────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS idx_charge_order_id   ON tb_charge_infor(order_id);
CREATE INDEX IF NOT EXISTS idx_charge_status     ON tb_charge_infor(status);
CREATE INDEX IF NOT EXISTS idx_charge_serial_no  ON tb_charge_infor(serial_no);
CREATE INDEX IF NOT EXISTS idx_history_charge_id ON tb_order_history(charge_id);

-- ┌─────────────────────────────────────────────────────────┐
-- │  [선택] tb_users 테이블 외부 직접 수정 차단               │
-- │  앱 외부에서 anon key로 사용자 추가·변경 불가              │
-- │  ⚠️  활성화 시 초기 seed insert는 service role key 필요  │
-- └─────────────────────────────────────────────────────────┘
-- DROP POLICY IF EXISTS tb_users_anon_all ON tb_users;
-- CREATE POLICY tb_users_select ON tb_users FOR SELECT TO anon USING (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │  Supabase Storage — as-photos 버킷 RLS 정책              │
-- │  anon key로 업로드·조회·삭제 허용                         │
-- └─────────────────────────────────────────────────────────┘

-- 버킷 생성 (이미 있으면 public=true 로 갱신)
INSERT INTO storage.buckets (id, name, public)
VALUES ('as-photos', 'as-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 기존 정책 초기화 후 재생성
DROP POLICY IF EXISTS "as_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "as_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "as_photos_delete" ON storage.objects;

CREATE POLICY "as_photos_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'as-photos');

CREATE POLICY "as_photos_select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'as-photos');

CREATE POLICY "as_photos_delete" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'as-photos');

-- ┌─────────────────────────────────────────────────────────┐
-- │  Supabase Storage — ship-photos 버킷 RLS 정책            │
-- │  anon key로 업로드·조회·삭제 허용                         │
-- └─────────────────────────────────────────────────────────┘

INSERT INTO storage.buckets (id, name, public)
VALUES ('ship-photos', 'ship-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "ship_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "ship_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "ship_photos_delete" ON storage.objects;

CREATE POLICY "ship_photos_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'ship-photos');

CREATE POLICY "ship_photos_select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'ship-photos');

CREATE POLICY "ship_photos_delete" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'ship-photos');
