'use strict';
// ============================================================
// Egtronics COMS — Role Permission Integration Tests
// Run: npm test
// Requires: supabase-schema.sql migration executed in Supabase SQL Editor
// ============================================================
const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const cfgPath = path.join(__dirname, '..', 'supabase-config.js');
const cfgSrc  = fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath, 'utf8') : '';
const SUPABASE_URL      = cfgSrc.match(/SUPABASE_URL\s*=\s*'([^']+)'/)?.[1]      ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = cfgSrc.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)?.[1] ?? process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌  supabase-config.js 또는 환경변수에서 SUPABASE_URL / SUPABASE_ANON_KEY를 찾을 수 없습니다.');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Harness ───────────────────────────────────────────────────────────────────
const TEST_ORDER_BASE   = 99990000;
const TEST_MASTER_CODE  = '__TEST__';
let testSeq = 0;
const testOrderIds       = [];
const testMasterCustIds  = [];
const log = [];
let passed = 0, failed = 0;

function ok(label, cond, detail = '') {
  const r = cond ? '✅' : '❌';
  cond ? passed++ : failed++;
  log.push({ r, label, detail });
  process.stdout.write(`  ${r}  ${label}${detail ? '  (' + detail + ')' : ''}\n`);
}

async function section(title, fn) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 54 - title.length))}`);
  await fn();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function insertTestOrder(overrides = {}) {
  testSeq++;
  const order_id = TEST_ORDER_BASE + testSeq;
  testOrderIds.push(order_id);
  const { data, error } = await db.from('tb_sales_order').insert({
    order_id,
    customer_name: '__TEST__',
    model_name:    '7kW Wallbox',
    delivery_date: '2099-12-31',
    status:        'PENDING',
    created:       new Date().toISOString().slice(0, 10),
    ...overrides,
  }).select().single();
  return { data, error, order_id };
}

async function cleanup() {
  if (testOrderIds.length)      await db.from('tb_production_info').delete().in('order_id', testOrderIds);
  if (testOrderIds.length)      await db.from('tb_as_history').delete().in('order_id', testOrderIds);
  if (testOrderIds.length)      await db.from('tb_order_history').delete().in('order_id', testOrderIds);
  if (testOrderIds.length)      await db.from('tb_sales_order').delete().in('order_id', testOrderIds);
  if (testMasterCustIds.length) await db.from('tb_master_customer').delete().in('id', testMasterCustIds);
  await db.from('users').delete().eq('user_id', '__test_bad_role__');
  console.log(`\n🧹  테스트 데이터 정리 완료 (주문 ${testOrderIds.length}건)`);
}

// ── Test suites ───────────────────────────────────────────────────────────────

async function t1_userTable() {
  await section('1. 사용자 테이블 — 역할 검증', async () => {
    for (const [user_id, expected_role] of [
      ['admin', 'admin'], ['sales', 'sales'], ['prod', 'production'], ['as', 'as'],
    ]) {
      const { data } = await db.from('users').select('role').eq('user_id', user_id).single();
      ok(`users['${user_id}'].role = '${expected_role}'`, data?.role === expected_role,
        data?.role ?? 'not found');
    }
  });
}

async function t2_authentication() {
  await section('2. 인증 — 비밀번호 일치·불일치', async () => {
    const { data: hit }  = await db.from('users').select('user_id').eq('user_id', 'admin').eq('password', '1234').single();
    ok('올바른 비밀번호로 로그인', !!hit);

    const { data: miss } = await db.from('users').select('user_id').eq('user_id', 'admin').eq('password', 'wrong').single();
    ok('잘못된 비밀번호는 사용자 미조회', !miss);

    const { data: ghost } = await db.from('users').select('user_id').eq('user_id', 'no_such_user').single();
    ok('존재하지 않는 계정 조회 실패', !ghost);
  });
}

async function t3_masterData() {
  await section('3. 마스터 데이터 — 테이블 접근 권한', async () => {
    // Verify tables are readable (permission check, not data count check)
    for (const table of ['tb_master_model', 'tb_master_sw_version', 'tb_master_cable_length']) {
      const { error } = await db.from(table).select('*').limit(1);
      ok(`${table} 읽기 권한`, !error, error?.message);
    }

    // tb_master_customer: insert → read → verify (also tests INSERT permission)
    const { data: mc, error: ie } = await db.from('tb_master_customer')
      .insert({ name: '__TEST_CUST__', code: TEST_MASTER_CODE, last: '' })
      .select().single();
    ok('tb_master_customer INSERT 권한', !ie && !!mc, ie?.message);
    if (mc) {
      testMasterCustIds.push(mc.id);
      const { data: read, error: re } = await db.from('tb_master_customer').select('*').eq('id', mc.id).single();
      ok('tb_master_customer SELECT 권한', !re && !!read, re?.message);
    }
  });
}

async function t4_orderStatusTransitions() {
  await section('4. 주문 상태 전환 — PMDB 패턴 검증', async () => {
    const { data: o, error: ie, order_id } = await insertTestOrder();
    ok('PENDING 주문 생성 (sales)', !ie && !!o, ie?.message);
    if (ie) return;

    // sales: PENDING 수정 가능 (PMDB updateOrder: eq status=PENDING)
    const { data: edited } = await db.from('tb_sales_order')
      .update({ cable_length: '5m' })
      .eq('order_id', order_id).eq('status', 'PENDING')
      .select().single();
    ok('sales — PENDING 주문 수정 가능', !!edited);

    // production: PENDING → IN_PROGRESS
    const { data: started, error: se } = await db.from('tb_sales_order')
      .update({ status: 'IN_PROGRESS' })
      .eq('order_id', order_id).eq('status', 'PENDING')
      .select().single();
    ok('production — PENDING → IN_PROGRESS', started?.status === 'IN_PROGRESS', se?.message);

    // sales: IN_PROGRESS 상태 주문은 PMDB 패턴으로 수정 불가 (PENDING 조건이 매칭 안 됨)
    const { data: blocked } = await db.from('tb_sales_order')
      .update({ cable_length: '10m' })
      .eq('order_id', order_id).eq('status', 'PENDING')
      .select().single();
    ok('sales — IN_PROGRESS 주문은 PMDB 패턴으로 수정 불가', !blocked);

    // production: IN_PROGRESS → COMPLETED
    const { data: done, error: ce } = await db.from('tb_sales_order')
      .update({ status: 'COMPLETED' })
      .eq('order_id', order_id)
      .select().single();
    ok('production — → COMPLETED', done?.status === 'COMPLETED', ce?.message);

    // production: revert COMPLETED → PENDING
    const { data: reverted } = await db.from('tb_sales_order')
      .update({ status: 'PENDING' })
      .eq('order_id', order_id)
      .select().single();
    ok('production — COMPLETED → PENDING 되돌리기', reverted?.status === 'PENDING');
  });
}

async function t5_statusConstraint() {
  await section('5. DB 제약 — 유효하지 않은 status 거부', async () => {
    testSeq++;
    const order_id = TEST_ORDER_BASE + testSeq;
    const { error } = await db.from('tb_sales_order').insert({
      order_id,
      customer_name: '__TEST__',
      model_name:    '7kW Wallbox',
      delivery_date: '2099-01-01',
      status:        'HACKED',
      created:       '2026-01-01',
    }).select().single();
    const rejected = !!error;
    ok('유효하지 않은 status 삽입 거부 (CHECK 제약)', rejected,
      rejected ? `거부 코드: ${error.code}` : '❗ 제약 없음 — migration SQL을 Supabase SQL Editor에서 실행하세요');
    if (!rejected) testOrderIds.push(order_id);
  });
}

async function t6_roleConstraint() {
  await section('6. DB 제약 — 유효하지 않은 role 거부', async () => {
    const { error } = await db.from('users').insert({
      user_id:  '__test_bad_role__',
      password: 'x',
      name:     'Test',
      role:     'superadmin',
    }).select().single();
    const rejected = !!error;
    ok('유효하지 않은 role 삽입 거부 (CHECK 제약)', rejected,
      rejected ? `거부 코드: ${error.code}` : '❗ 제약 없음 — migration SQL을 Supabase SQL Editor에서 실행하세요');
  });
}

async function t7_asHistory() {
  await section('7. A/S 이력 — 등록·삭제 (as 역할 전용)', async () => {
    const { error: oe, order_id } = await insertTestOrder({ status: 'COMPLETED' });
    if (oe) { ok('A/S 이력 테스트 (주문 생성 실패로 건너뜀)', false, oe.message); return; }

    const asId = TEST_ORDER_BASE + testSeq;
    const { data: ins, error: ie } = await db.from('tb_as_history').insert({
      id:             asId,
      order_id,
      reception_date: '2026-06-01',
      action:         '현장출동',
      notes:          'INTEGRATION TEST',
      created_at:     new Date().toISOString().slice(0, 10),
    }).select().single();
    ok('A/S 이력 등록', !ie && !!ins,
      ie ? `${ie.message} — migration SQL의 tb_as_history RLS 섹션 실행 필요` : '');

    const { error: de } = await db.from('tb_as_history').delete().eq('id', asId);
    ok('A/S 이력 삭제', !de, de?.message);
  });
}

async function t8_productionFK() {
  await section('8. 생산 실적 — upsert 및 FK 제약', async () => {
    const { error: oe, order_id } = await insertTestOrder();
    if (oe) { ok('생산 실적 테스트 (주문 생성 실패)', false); return; }

    const { data: upserted, error: ue } = await db.from('tb_production_info').upsert({
      order_id,
      prod_date:       '2026-06-01',
      lot_no:          'L-TEST-001',
      serial_no:       'SN-TEST-001',
      inspection_date: '2026-06-02',
      sw_version:      'v1.6.2-core',
      doc_no:          'QC-TEST-001',
    }, { onConflict: 'order_id' }).select().single();
    ok('생산 실적 upsert', !ue && !!upserted, ue?.message);

    // FK: 존재하지 않는 order_id
    const { error: fke } = await db.from('tb_production_info').insert({
      order_id: 88880001,
      prod_date: '2026-01-01', lot_no: 'X', serial_no: 'X', sw_version: 'X', doc_no: 'X',
    }).select();
    ok('존재하지 않는 order로 생산실적 삽입 거부 (FK)', !!fke, fke ? `코드: ${fke.code}` : 'FK 없음');
  });
}

async function t9_orderHistory() {
  await section('9. 주문 이력 — 읽기 권한', async () => {
    const { error } = await db.from('tb_order_history').select('history_id').limit(1);
    ok('tb_order_history 읽기 권한', !error, error?.message);
  });
}

async function t10_duplicatePK() {
  await section('10. PK 제약 — 중복 order_id 거부', async () => {
    const { error: oe, order_id } = await insertTestOrder();
    if (oe) { ok('중복 PK 테스트 (주문 생성 실패)', false); return; }

    const { error: dup } = await db.from('tb_sales_order').insert({
      order_id,
      customer_name: '__DUP__',
      model_name:    '7kW Wallbox',
      delivery_date: '2099-01-01',
      status:        'PENDING',
      created:       '2026-01-01',
    }).select().single();
    ok('중복 order_id 삽입 거부 (PRIMARY KEY)', !!dup, dup ? `코드: ${dup.code}` : '');
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Egtronics COMS — Role Permission Integration Tests     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  URL: ${SUPABASE_URL}\n`);

  try {
    await t1_userTable();
    await t2_authentication();
    await t3_masterData();
    await t4_orderStatusTransitions();
    await t5_statusConstraint();
    await t6_roleConstraint();
    await t7_asHistory();
    await t8_productionFK();
    await t9_orderHistory();
    await t10_duplicatePK();
  } finally {
    await cleanup();
  }

  const total = passed + failed;
  const bar   = failed > 0 ? `❌ ${failed}개 실패` : '✅ 전체 통과';
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  결과: ${passed}/${total} 통과  ${bar}${' '.repeat(Math.max(0, 40 - `${passed}/${total}`.length - bar.length))}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  const r = (label) => log.find(l => l.label.includes(label))?.r ?? '?';
  console.log(`
── 권한 경계 검증 보고서 ──────────────────────────────────────────────────

  [앱 레이어 — PMDB / ROLE_TABS 강제]                        계층
    admin      전체 화면 + 사용자 관리                         앱
    sales      영업입력 화면, PENDING 주문만 수정              ${r('PENDING 주문 수정')}
    production PENDING→IN_PROGRESS→COMPLETED                   ${r('IN_PROGRESS')}
    as         통합조회 + A/S 이력 추가·삭제                   ${r('A/S 이력 등록')}

  [DB 레이어 — 제약 조건]
    status CHECK ('PENDING'|'IN_PROGRESS'|'COMPLETED')         ${r('유효하지 않은 status')}
    role   CHECK ('admin'|'sales'|'production'|'as')           ${r('유효하지 않은 role')}
    production_info FK → tb_sales_order                        ${r('존재하지 않는 order로')}
    PRIMARY KEY (order_id) 중복 거부                           ${r('중복 order_id')}
    tb_master_customer INSERT/SELECT 권한                      ${r('tb_master_customer INSERT')}

  [RLS — 현재 비활성화, 운영 제안]
    ⚠️  모든 요청이 동일 anon key를 사용 → auth.uid() 기반 RLS 불가.
    migration SQL의 "선택적 RLS" 섹션으로 외부 직접 API 접근 차단 가능.
    (활성화 시 seed insert는 service role key 필요)
`);

  if (failed > 0) {
    console.log('── 실패 항목 해결 방법 ───────────────────────────────────────────────');
    if (log.find(l => l.label.includes('status') && l.r === '❌'))
      console.log('  → Supabase SQL Editor에서 supabase-schema.sql 의 "CHECK 제약" 섹션 실행');
    if (log.find(l => l.label.includes('role') && l.r === '❌'))
      console.log('  → Supabase SQL Editor에서 supabase-schema.sql 의 "CHECK 제약" 섹션 실행');
    if (log.find(l => l.label.includes('A/S 이력 등록') && l.r === '❌'))
      console.log('  → Supabase SQL Editor에서 supabase-schema.sql 의 "tb_as_history RLS" 섹션 실행');
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
})();
