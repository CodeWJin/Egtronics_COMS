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
ALTER TABLE tb_sales_order ADD COLUMN IF NOT EXISTS charger_no          TEXT DEFAULT '';

-- 기능 검사 성적서 저장
CREATE TABLE IF NOT EXISTS tb_func_inspection (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL UNIQUE,
  insp_date   TEXT NOT NULL,
  inspector   TEXT DEFAULT '',
  checks      TEXT DEFAULT '{}',
  notes       TEXT DEFAULT '',
  saved_at    TEXT NOT NULL
);
ALTER TABLE tb_func_inspection DISABLE ROW LEVEL SECURITY;

-- 출하 검사 성적서 저장
CREATE TABLE IF NOT EXISTS tb_ship_inspection (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL UNIQUE,
  insp_date   TEXT NOT NULL,
  inspector   TEXT DEFAULT '',
  checks      TEXT DEFAULT '{}',
  notes       TEXT DEFAULT '',
  saved_at    TEXT NOT NULL
);
ALTER TABLE tb_ship_inspection DISABLE ROW LEVEL SECURITY;

-- 출하 검사 사진 컬럼 (ship-photos 버킷 연동)
ALTER TABLE tb_ship_inspection ADD COLUMN IF NOT EXISTS photos TEXT DEFAULT '[]';

-- tb_master_model 스키마 변경 (model 코드 컬럼 추가, spec → description 전환)
ALTER TABLE tb_master_model ADD COLUMN IF NOT EXISTS model       TEXT DEFAULT '';
ALTER TABLE tb_master_model ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE tb_master_model ALTER COLUMN name DROP NOT NULL;
ALTER TABLE tb_master_model ALTER COLUMN name SET DEFAULT '';

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
    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'AWAIT_PICKUP', 'COMPLETED'));

-- 사용자 역할: 허용 값 외 삽입·수정 거부
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS chk_role,
  ADD  CONSTRAINT chk_role
    CHECK (role IN ('admin', 'sales', 'production', 'quality'));



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
  id          SERIAL PRIMARY KEY,
  model       TEXT NOT NULL,
  description TEXT DEFAULT '',
  name        TEXT DEFAULT '',
  power       TEXT DEFAULT ''
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