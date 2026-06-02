-- ============================================================
-- E-COMS Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에서 아래 전체를 실행하세요
-- ============================================================

-- 기존 테이블 초기화 (처음 설정 시에만 실행)
DROP TABLE IF EXISTS tb_order_history;
DROP TABLE IF EXISTS tb_production_info;
DROP TABLE IF EXISTS tb_sales_order;
DROP TABLE IF EXISTS tb_customer_manager;
DROP TABLE IF EXISTS users;

-- 사용자 테이블
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  dept TEXT,
  phone TEXT,
  email TEXT
);

-- 영업 주문 테이블
CREATE TABLE tb_sales_order (
  order_id INTEGER PRIMARY KEY,
  customer_name TEXT,
  customer_manager TEXT,
  model_name TEXT,
  delivery_date TEXT,
  station_id TEXT,
  router_no TEXT,
  usim_no TEXT,
  install_address TEXT,
  status TEXT DEFAULT 'PENDING',
  created TEXT
);

-- 생산 실적 테이블
CREATE TABLE tb_production_info (
  order_id INTEGER PRIMARY KEY REFERENCES tb_sales_order(order_id) ON DELETE CASCADE,
  prod_date TEXT,
  lot_no TEXT,
  serial_no TEXT,
  inspection_date TEXT,
  sw_version TEXT,
  cable_length TEXT,
  doc_no TEXT
);

-- 고객사 담당자 테이블
CREATE TABLE tb_customer_manager (
  manager_id INTEGER PRIMARY KEY,
  customer_name TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  is_primary INTEGER DEFAULT 0
);

-- 변경 이력 테이블
CREATE TABLE tb_order_history (
  history_id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  action TEXT DEFAULT 'update',
  changed_fields TEXT NOT NULL
);

-- RLS 비활성화 (앱 레벨에서 인증 처리)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_sales_order DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_production_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_customer_manager DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_order_history DISABLE ROW LEVEL SECURITY;
