// 역할별 권한 테스트 — auth.jsx의 ROLE_TABS와 동기화하여 유지
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.error(`  ✗ ${description}`);
    failed++;
  }
}

// auth.jsx에서 ROLE_TABS를 직접 파싱
const authSrc = fs.readFileSync(path.join(__dirname, '..', 'auth.jsx'), 'utf8');
const match = authSrc.match(/window\.ROLE_TABS\s*=\s*(\{[\s\S]*?\});/);
if (!match) {
  console.error('ROLE_TABS를 auth.jsx에서 찾을 수 없습니다.');
  process.exit(1);
}
// eslint-disable-next-line no-new-func
const ROLE_TABS = new Function(`return ${match[1]}`)();

const ALL_VIEWS = ['dashboard', 'sales', 'waiting', 'mapping', 'AwaitPickup', 'lookup', 'admin', 'as-receipt', 'as-processing'];
const FALLBACK_VIEWS = ['lookup'];

// 역할별 기대 권한 (CLAUDE.md 및 auth.jsx 기준)
const EXPECTED = {
  admin:      ALL_VIEWS,
  sales:      ['dashboard', 'sales', 'waiting', 'lookup', 'as-receipt', 'as-processing'],
  production: ['dashboard', 'waiting', 'mapping', 'AwaitPickup', 'lookup'],
  quality:    ['dashboard', 'AwaitPickup', 'lookup', 'as-receipt', 'as-processing'],
};

// 미정의 역할 폴백
function getTabsForRole(role) {
  return ROLE_TABS[role] || FALLBACK_VIEWS;
}

console.log('\n[역할 권한 테스트]\n');

// 1. 각 역할 권한 검증
for (const [role, expectedViews] of Object.entries(EXPECTED)) {
  console.log(`  ${role}:`);
  const actual = getTabsForRole(role);
  const sorted = (arr) => [...arr].sort();
  assert(
    `허용 뷰 일치 (기대: [${sorted(expectedViews)}], 실제: [${sorted(actual)}])`,
    JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expectedViews))
  );
  // 허용되면 안 되는 뷰 체크
  for (const view of ALL_VIEWS) {
    const shouldHave = expectedViews.includes(view);
    const hasIt = actual.includes(view);
    if (shouldHave !== hasIt) {
      assert(`'${view}' 접근 ${shouldHave ? '허용' : '차단'}`, false);
    }
  }
}

// 2. 미정의 역할 폴백
console.log('\n  폴백:');
assert(
  "미정의 역할 → ['lookup'] 폴백",
  JSON.stringify(getTabsForRole('unknown_role')) === JSON.stringify(FALLBACK_VIEWS)
);
assert(
  "빈 문자열 역할 → ['lookup'] 폴백",
  JSON.stringify(getTabsForRole('')) === JSON.stringify(FALLBACK_VIEWS)
);

// 3. lookup은 모든 역할 접근 가능
console.log('\n  lookup 전체 접근:');
for (const role of Object.keys(EXPECTED)) {
  assert(`${role} → lookup 포함`, getTabsForRole(role).includes('lookup'));
}

// 4. admin 전용 뷰 검증
console.log('\n  admin 전용 뷰:');
const adminOnlyViews = ['admin'];
for (const view of adminOnlyViews) {
  for (const role of ['sales', 'production', 'quality']) {
    assert(`${role} → '${view}' 접근 불가`, !getTabsForRole(role).includes(view));
  }
}

// 결과 요약
console.log(`\n${'─'.repeat(40)}`);
if (failed === 0) {
  console.log(`✓ 전체 통과: ${passed}건`);
} else {
  console.log(`결과: ${passed}건 통과, ${failed}건 실패`);
  process.exit(1);
}
