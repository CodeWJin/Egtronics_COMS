-- ============================================================
-- E-COMS Supabase 스키마
-- ============================================================
-- [A] 기존 테이블이 있는 경우 → 아래 "마이그레이션 전용" 섹션만 실행
-- [B] 처음 세팅하는 경우    → 전체 파일 실행
-- ============================================================

-- ┌─────────────────────────────────────────────────────────┐
-- │  마이그레이션 전용 (기존 데이터 유지, 신규 컬럼·테이블만 추가)  │
-- └─────────────────────────────────────────────────────────┘

-- tb_sales_order 신규 컬럼
ALTER TABLE tb_sales_order ADD COLUMN IF NOT EXISTS cable_length        TEXT DEFAULT '';
ALTER TABLE tb_sales_order ADD COLUMN IF NOT EXISTS field_manager_name  TEXT DEFAULT '';
ALTER TABLE tb_sales_order ADD COLUMN IF NOT EXISTS field_manager_phone TEXT DEFAULT '';
ALTER TABLE tb_sales_order ADD COLUMN IF NOT EXISTS cpo_name            TEXT DEFAULT '';
ALTER TABLE tb_sales_order ADD COLUMN IF NOT EXISTS usage_type          TEXT DEFAULT '공용';

-- CPO 운영사 마스터 테이블
CREATE TABLE IF NOT EXISTS tb_master_cpo (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  code  TEXT NOT NULL
);
ALTER TABLE tb_master_cpo DISABLE ROW LEVEL SECURITY;

-- ┌─────────────────────────────────────────────────────────┐
-- │  CHECK 제약 (npm test 통과에 필요)                        │
-- └─────────────────────────────────────────────────────────┘

-- 주문 상태: 허용 값 외 삽입·수정 거부
ALTER TABLE tb_sales_order
  DROP CONSTRAINT IF EXISTS chk_status,
  ADD  CONSTRAINT chk_status
    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED'));

-- 사용자 역할: 허용 값 외 삽입·수정 거부
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS chk_role,
  ADD  CONSTRAINT chk_role
    CHECK (role IN ('admin', 'sales', 'production', 'as'));

-- ┌─────────────────────────────────────────────────────────┐
-- │  tb_as_history RLS 정책 수정                             │
-- │  (INSERT 차단 오류 해결 — 앱이 anon key로 직접 삽입)      │
-- └─────────────────────────────────────────────────────────┘
ALTER TABLE tb_as_history DISABLE ROW LEVEL SECURITY;

-- ┌─────────────────────────────────────────────────────────┐
-- │  [선택] users 테이블 외부 직접 수정 차단                  │
-- │  앱 외부에서 anon key로 사용자 추가·변경 불가              │
-- │  ⚠️  활성화 시 초기 seed insert는 service role key 필요  │
-- └─────────────────────────────────────────────────────────┘
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS users_select ON users;
-- CREATE POLICY users_select ON users FOR SELECT TO anon USING (true);

-- 마스터 테이블 (없을 때만 생성)
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

-- A/S 이력 테이블 (없을 때만 생성)
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

-- AS 접수 테이블 (독립 AS 관리 모듈)
CREATE TABLE IF NOT EXISTS tb_as_reception (
  id             SERIAL  PRIMARY KEY,
  reception_no   TEXT    UNIQUE NOT NULL,
  customer_name  TEXT    DEFAULT '',
  station_name   TEXT    DEFAULT '',
  station_id     TEXT    DEFAULT '',
  charger_no     TEXT    DEFAULT '',
  order_id       INTEGER,
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

-- AS 처리 이력 테이블 (상태 변경 추적)
CREATE TABLE IF NOT EXISTS tb_as_log (
  id             SERIAL  PRIMARY KEY,
  reception_id   INTEGER NOT NULL,
  changed_at     TEXT    NOT NULL,
  changed_by     TEXT    DEFAULT '',
  from_status    TEXT    DEFAULT '',
  to_status      TEXT    DEFAULT '',
  memo           TEXT    DEFAULT ''
);
ALTER TABLE tb_as_log DISABLE ROW LEVEL SECURITY;

-- AS 첨부 사진 테이블 (Supabase Storage 버킷: as-photos)
CREATE TABLE IF NOT EXISTS tb_as_photo (
  id             SERIAL  PRIMARY KEY,
  reception_id   INTEGER NOT NULL,
  filename       TEXT    NOT NULL,
  url            TEXT    NOT NULL,
  storage_path   TEXT    DEFAULT '',
  uploaded_by    TEXT    DEFAULT '',
  uploaded_at    TEXT    NOT NULL
);
ALTER TABLE tb_as_photo DISABLE ROW LEVEL SECURITY;

-- ================================================================
-- 이하는 처음 세팅 시 사용 (기존 테이블 전체 삭제 후 재생성)
-- 데이터가 있는 경우 절대 실행하지 마세요!
-- ================================================================

/*
DROP TABLE IF EXISTS tb_as_history;
DROP TABLE IF EXISTS tb_order_history;
DROP TABLE IF EXISTS tb_production_info;
DROP TABLE IF EXISTS tb_sales_order;
DROP TABLE IF EXISTS tb_customer_manager;
DROP TABLE IF EXISTS users;

-- 사용자 테이블
CREATE TABLE users (
  user_id  TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  name     TEXT NOT NULL,
  role     TEXT NOT NULL,
  dept     TEXT,
  phone    TEXT,
  email    TEXT
);

-- 영업 주문 테이블
CREATE TABLE tb_sales_order (
  order_id            INTEGER PRIMARY KEY,
  customer_name       TEXT,
  customer_manager    TEXT,
  cpo_name            TEXT    DEFAULT '',
  usage_type          TEXT    DEFAULT '공용',
  model_name          TEXT,
  delivery_date       TEXT,
  cable_length        TEXT    DEFAULT '',
  station_id          TEXT,
  router_no           TEXT,
  usim_no             TEXT,
  install_address     TEXT,
  field_manager_name  TEXT    DEFAULT '',
  field_manager_phone TEXT    DEFAULT '',
  status              TEXT    DEFAULT 'PENDING',
  created             TEXT
);

-- 생산 실적 테이블
CREATE TABLE tb_production_info (
  order_id         INTEGER PRIMARY KEY REFERENCES tb_sales_order(order_id) ON DELETE CASCADE,
  prod_date        TEXT,
  lot_no           TEXT,
  serial_no        TEXT,
  inspection_date  TEXT,
  sw_version       TEXT,
  doc_no           TEXT
);

-- 고객사 담당자 테이블
CREATE TABLE tb_customer_manager (
  manager_id    INTEGER PRIMARY KEY,
  customer_name TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  phone         TEXT,
  email         TEXT,
  is_primary    INTEGER DEFAULT 0
);

-- 변경 이력 테이블
CREATE TABLE tb_order_history (
  history_id     INTEGER PRIMARY KEY,
  order_id       INTEGER NOT NULL,
  changed_at     TEXT    NOT NULL,
  changed_by     TEXT    NOT NULL,
  action         TEXT    DEFAULT 'update',
  changed_fields TEXT    NOT NULL
);

-- A/S 이력 테이블
CREATE TABLE tb_as_history (
  id             INTEGER PRIMARY KEY,
  order_id       INTEGER NOT NULL,
  reception_date TEXT    DEFAULT '',
  dispatch_date  TEXT    DEFAULT '',
  action         TEXT    DEFAULT '',
  notes          TEXT    DEFAULT '',
  field_manager  TEXT    DEFAULT '',
  created_at     TEXT    NOT NULL
);

-- CPO 운영사 마스터 테이블
CREATE TABLE tb_master_cpo (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  code  TEXT NOT NULL
);

-- RLS 비활성화 (앱 레벨 인증 처리)
ALTER TABLE users                DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_sales_order       DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_production_info   DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_customer_manager  DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_order_history     DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_as_history        DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_master_cpo        DISABLE ROW LEVEL SECURITY;
*/
