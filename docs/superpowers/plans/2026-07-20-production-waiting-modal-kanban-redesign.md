# 생산대기 칸반/모달 재구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `production-waiting.jsx`의 칸반 카드에 시리얼번호·단계별 입력 완료율을 추가하고, `ProductionEntryModal`/`SalesCompletionModal`의 필드를 기존 Drawer 섹션 패턴(아이콘 배지+제목)으로 그룹화한다.

**Architecture:** 순수 함수 `stageProgress`/`progressColor`로 카드 진행율을 계산해 `ViewKanban`의 카드 렌더링에 반영하고, 두 모달은 필드 구성·검증·액션 로직을 그대로 둔 채 `<section>` 래퍼로만 재그룹화한다. 새 컴포넌트는 `PWSectionHead`(섹션 제목 바) 하나뿐이며 파일 로컬 함수로 추가한다.

**Tech Stack:** React 18(전역 스코프, Babel Standalone 실시간 트랜스파일), 빌드 스텝 없음, 기존 `styles.css` CSS 변수/클래스 재사용.

## Global Constraints

- 이 저장소는 빌드 스텝이 없고 JSX 컴포넌트에 대한 자동화 테스트가 존재하지 않는다(자동화 테스트는 `tests/role-permissions.test.js` 하나뿐이며 이 작업과 무관). 따라서 아래 각 태스크의 "테스트" 단계는 **브라우저 수동 확인**으로 대체한다 — 이는 프로젝트 CLAUDE.md의 명시된 검증 절차(자동화된 컴파일 에러가 없어 실수가 런타임에 조용히 깨짐 → 매 변경마다 수동 확인 필수)를 따른 것이다.
- 모든 파일 수정 전 대상 파일 전체를 Read로 먼저 읽는다(검색 스니펫만으로 편집 금지) — CLAUDE.md 필수 절차.
- 요청 범위 밖 리팩토링·리네이밍 금지. 필드 구성·검증(`errors`)·제출/임시저장/되돌리기 액션 로직은 절대 변경하지 않는다 — 레이아웃(그룹화)과 칸반 카드 표시 정보만 바꾼다.
- React 훅은 이미 `useStatePW`/`useMemoPW`/`useRefPW`로 별칭되어 있다 — 새 코드에서도 이 별칭만 사용하고 별도로 `useState` 등을 임포트하지 않는다.
- 새 `.jsx` 파일은 만들지 않는다 — 모든 변경은 기존 `production-waiting.jsx`, `styles.css` 안에서 이뤄진다.
- 각 태스크 완료 후 다음을 반드시 실행: `npm test`, `grep -n "const { useState }" *.jsx`(결과 없어야 함), `grep -n "supabase\.from" *.jsx`(결과 없어야 함, 이번 작업은 `db.js` 밖에서 supabase를 호출하지 않으므로 원래도 결과 없음 — 회귀 확인용).

---

## Task 1: 칸반 카드 — 시리얼번호 + 단계별 진행율 표시

**Files:**
- Modify: `production-waiting.jsx:37`(직후) — `stageProgress`/`progressColor` 헬퍼 추가
- Modify: `production-waiting.jsx:308-343` — `ViewKanban`의 카드 렌더링에 시리얼·진행율 추가
- Modify: `styles.css:1207-1217` — 컨테이너 쿼리 말줄임 대상에 `.kanban__card__serial` 추가
- Modify: `styles.css:1250`(직후) — `.kanban__card__serial`/`.kanban__card__progress*` 클래스 추가

**Interfaces:**
- Produces: `stageProgress(order)` → `{ done: number, total: number } | null` (module-scope 함수, `production-waiting.jsx` 파일 내에서만 사용). `progressColor(prog)` → CSS color 문자열.
- Consumes: 없음(이 태스크가 최초 진입점). 전역 `window.getFuncInspection`(ship-inspection.jsx 정의, 이미 로드됨), `window.isSalesInfoComplete`(shell.jsx 정의, 이미 `KANBAN_COLS`에서 쓰이고 있음).

- [ ] **Step 1: `production-waiting.jsx` 전체를 Read로 읽는다**

프로젝트 CLAUDE.md 필수 절차. 이후 단계의 `old_string`은 이 결과를 기준으로 정확히 맞춘다(파일이 브레인스토밍 이후 바뀌지 않았다면 아래 라인 번호와 동일할 것).

- [ ] **Step 2: `styles.css`에 카드 진행율/시리얼 CSS 클래스 추가**

`.kanban__card__meta { ... }` 블록(1244~1250행) 바로 뒤, `/* Card grid (variant) */` 주석 앞에 삽입:

```css
.kanban__card__serial {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--ink-3);
  margin-bottom: 6px;
  letter-spacing: -0.2px;
}
.kanban__card__progress {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.kanban__card__progress-track {
  flex: 1;
  height: 5px;
  background: var(--border-1);
  border-radius: 999px;
  overflow: hidden;
}
.kanban__card__progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 200ms ease;
}
.kanban__card__progress-text {
  font-size: 11px;
  color: var(--ink-3);
  font-weight: 600;
  white-space: nowrap;
}
```

- [ ] **Step 3: 컨테이너 쿼리 말줄임 대상에 시리얼 클래스 추가**

`styles.css:1207-1217`의 기존 규칙:

```css
@container (max-width: 157px) {
  .kanban__card__title,
  .kanban__card__sub,
  .kanban__card__id,
  .kanban__card__meta span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kanban__card__meta { flex-wrap: nowrap; }
}
```

`.kanban__card__id,` 다음 줄에 `.kanban__card__serial,`을 추가(선택자 목록에 한 줄 삽입):

```css
@container (max-width: 157px) {
  .kanban__card__title,
  .kanban__card__sub,
  .kanban__card__id,
  .kanban__card__serial,
  .kanban__card__meta span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kanban__card__meta { flex-wrap: nowrap; }
}
```

- [ ] **Step 4: `production-waiting.jsx`에 `stageProgress`/`progressColor` 헬퍼 추가**

`KANBAN_COLS` 정의(31~37행) 바로 뒤, `function ProductionWaitingScreen() {` 앞에 삽입:

```js
// 칸반 카드 진행율 — 생산착수(progress)/생산완료(done) 컬럼에서만 값을 반환한다.
// 분모 필드 목록은 ProductionEntryModal·SalesCompletionModal의 errors 객체와 동일하게 유지할 것.
function stageProgress(order) {
  const isPublic = (order.usage_type || '공용') === '공용';

  if (order.status === 'IN_PROGRESS') {
    const p = order.production || {};
    const funcData = window.getFuncInspection?.(order.order_id) ?? null;
    const funcDone = funcData != null && Object.keys(funcData.checks || {}).length > 0 &&
      Object.values(funcData.checks || {}).every(v => v === true || (typeof v === 'string' && v.trim() !== ''));
    const items = [
      !!p.prod_date, !!p.serial_no, !!p.sw_version, !!p.fw_version,
      ...(isPublic ? [!!p.inspection_date] : []),
      funcDone,
    ];
    return { done: items.filter(Boolean).length, total: items.length };
  }

  if (order.status === 'AWAIT_PICKUP' && !window.isSalesInfoComplete(order)) {
    const items = [
      order.cable_length, order.customer_name, order.customer_manager,
      order.field_manager_phone, order.install_address, order.delivery_date,
      ...(isPublic ? [order.station_id, order.charger_no, order.router_no, order.usim_no] : []),
    ];
    return { done: items.filter(Boolean).length, total: items.length };
  }

  return null;
}

function progressColor(prog) {
  const ratio = prog.done / prog.total;
  if (ratio >= 0.8) return 'var(--success)';
  if (ratio >= 0.4) return 'var(--primary)';
  return 'var(--warning, #f59e0b)';
}
```

- [ ] **Step 5: 카드 렌더링에 시리얼·진행율 반영**

`production-waiting.jsx:308-343`(`ViewKanban` 내부 `{items.map((o, idx) => { ... })}`)를 다음으로 교체:

```jsx
            {items.map((o, idx) => {
              const d = deliveryHint(o.delivery_date);
              const prog = stageProgress(o);
              const serial = o.production?.serial_no;
              const checked = selectable && col.id === 'request' && !!selectedIds?.has(o.order_id);
              const selDisabled = col.id === 'request' && selectable && !checked && canSelect && !canSelect(o);
              return (
                <div key={o.order_id}
                     style={{ '--i': idx, ...(checked ? { outline: '2px solid var(--primary)', outlineOffset: -2 } : {}) }}
                     className="kanban__card"
                     role="button" tabIndex={0}
                     onClick={() => onPick(o, col.id)}
                     onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(o, col.id); } }}>
                  <div className="kanban__card__top" style={{ justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {col.id === 'request' && selectable && (
                        <span onClick={e => e.stopPropagation()}>
                          <input type="checkbox" aria-label={`오더 #${o.order_id} 선택`}
                            checked={checked} disabled={selDisabled}
                            title={selDisabled ? '같은 모델·용도만 함께 선택 가능' : ''}
                            onChange={() => onToggleSelect(o)}
                            style={{ width: 13, height: 13, accentColor: 'var(--primary)', cursor: selDisabled ? 'not-allowed' : 'pointer' }}/>
                        </span>
                      )}
                      {editedIds.has(o.order_id) && <span className="badge badge--info" style={{ fontSize: 10.5 }}>수정됨</span>}
                    </div>
                  </div>
                  <div className="kanban__card__title">{o.model_name}</div>
                  {serial && <div className="kanban__card__serial">{serial}</div>}
                  <div className="kanban__card__sub">{o.customer_name || (o.requested_by ? `요청자: ${o.requested_by}` : '발주정보 미입력')}</div>
                  <div className="kanban__card__meta">
                    <span className="badge badge--neutral" style={{ fontSize: 10.5 }}>{o.usage_type || '공용'}</span>
                    {col.id === 'ready' && (
                      <span className="dday-badge" style={{ '--dday-color': d.color, '--dday-bg': d.bg }}>{d.text}</span>
                    )}
                  </div>
                  {prog && (
                    <div className="kanban__card__progress">
                      <div className="kanban__card__progress-track">
                        <div className="kanban__card__progress-fill" style={{ width: `${(prog.done / prog.total) * 100}%`, background: progressColor(prog) }}/>
                      </div>
                      <span className="kanban__card__progress-text">{prog.done}/{prog.total}</span>
                    </div>
                  )}
                </div>
              );
            })}
```

- [ ] **Step 6: 브라우저 수동 확인**

`npx vercel dev`(또는 `npm run dev`, api/ 없이도 이 화면 확인엔 충분)로 로컬 서버를 띄우고 생산 관련 역할(production/admin)로 로그인 후 "생산 대기 목록"(`waiting` 뷰) 진입:

1. "생산착수" 컬럼 카드에 시리얼번호(모노폰트)와 진행율 바(`n/5` 또는 `n/6`, 공용 여부에 따라 분모가 다름)가 보이는지 확인.
2. 카드를 클릭해 `ProductionEntryModal`에서 SW/FW 버전 중 하나를 새로 선택하고 "임시저장" → 칸반으로 돌아왔을 때 해당 카드의 진행율 분자가 +1 되는지 확인.
3. "생산완료" 컬럼 카드에 발주처 정보 입력 진행율이 표시되는지, 공용 오더는 분모 10, 비공용 오더는 분모 6으로 다르게 계산되는지 확인.
4. 진행율 0%~39%는 주황, 40%~79%는 파랑, 80%~100%는 초록으로 바뀌는지 확인(예: `SalesCompletionModal`에서 필드를 하나씩 채워가며 관찰).
5. "생산요청"/"출하대기" 컬럼 카드는 기존과 동일하게 진행율 바 없이 표시되는지(출하대기는 기존 D-day 배지만 유지) 확인.
6. 브라우저 폭을 좁혀(또는 개발자도구 반응형 모드로 태블릿 폭) 컬럼이 4개 다 보이는 좁은 상태에서 시리얼·진행율 텍스트가 카드 밖으로 넘치지 않고 말줄임 처리되는지 확인.

- [ ] **Step 7: 회귀 검증 명령 실행**

```bash
npm test
grep -n "const { useState }" *.jsx
grep -n "supabase\.from" *.jsx
```

세 명령 모두 프로젝트 CLAUDE.md 기준 통과(테스트 그린, 두 grep 모두 결과 없음)해야 한다.

- [ ] **Step 8: 커밋**

```bash
git add production-waiting.jsx styles.css
git commit -m "feat: 칸반 카드에 시리얼·단계별 진행율 표시 추가"
```

---

## Task 2: `ProductionEntryModal` 섹션 그룹화

**Files:**
- Modify: `production-waiting.jsx:356`(직전) — `PWSectionHead` 컴포넌트 추가
- Modify: `production-waiting.jsx:488-619` — `modal__body` 내부를 3개 섹션으로 재구성

**Interfaces:**
- Produces: `PWSectionHead({ icon, title, extra })` — module-scope 함수 컴포넌트. `icon`: `Icon` 컴포넌트에 넘길 이름 문자열, `title`: 섹션 제목 문자열, `extra`: 제목 옆에 붙는 선택적 ReactNode(뱃지 등). Task 3에서 그대로 재사용한다.
- Consumes: Task 1에서 만든 헬퍼 없음(독립). 기존 `Icon` 컴포넌트(icons.jsx, 전역 로드됨), `window.HelpDot`(shell.jsx).

- [ ] **Step 1: `production-waiting.jsx` 전체를 Read로 다시 읽는다**

Task 1 커밋으로 라인 번호가 밀렸을 수 있으므로 반드시 재확인 후 아래 `old_string` 위치를 현재 파일 기준으로 맞춘다.

- [ ] **Step 2: `PWSectionHead` 컴포넌트 추가**

`/* ════ 생산착수 모달 ════ */` 주석과 `function ProductionEntryModal({ order, onClose }) {` 사이(원래 356행 부근)에 삽입:

```jsx
function PWSectionHead({ icon, title, extra }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'var(--surface)', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>
        <Icon name={icon} size={16} style={{ color: 'var(--primary-600)' }}/>
      </div>
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>{title}</span>
      {extra}
    </div>
  );
}
```

- [ ] **Step 3: `ProductionEntryModal`의 `modal__body`를 3개 섹션으로 재구성**

`production-waiting.jsx:488`(`<div className="modal__body" style={{ overflow: 'auto', flex: 1 }}>`)부터 `619`(그 블록을 닫는 `</div>`)까지 전체를 다음으로 교체:

```jsx
        <div className="modal__body" style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <PWSectionHead icon="calendar" title="기본 정보"/>
            <div className="form-grid form-grid--3">
              <div className="field">
                <label className="field__label" htmlFor="pem-prod-date"><Icon name="calendar" size={11}/>생산일자 <span className="field__req">*</span></label>
                <input id="pem-prod-date" type="date"
                       className={`input ${showErr('prod_date') ? 'input--error' : ''}`}
                       value={form.prod_date}
                       onChange={(e) => { update('prod_date', e.target.value); setTouched(t => ({ ...t, prod_date: 1 })); }}/>
                {showErr('prod_date') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.prod_date}</div>}
              </div>

              <div className="field">
                <label className="field__label" htmlFor="pem-serial-no">
                  <Icon name="cpu" size={11}/>시리얼 <span className="field__req">*</span>
                  <window.HelpDot text="생산착수 시 자동 채번됩니다. 필요 시 직접 수정 후 중복 확인하세요."/>
                </label>
                <div className="input-group">
                  <input id="pem-serial-no"
                         className={`input ${showErr('serial_no') ? 'input--error' : ''}`}
                         style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}
                         value={form.serial_no}
                         onChange={(e) => { update('serial_no', e.target.value.toUpperCase()); setTouched(t => ({ ...t, serial_no: 1 })); setDupState(null); }}/>
                  <button type="button" className="input-group__btn" onClick={checkDup} disabled={!form.serial_no}>중복 확인</button>
                </div>
                <div className="field__hint" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {dupState === 'ok' && <span style={{ color: 'var(--success-700)' }}><Icon name="check" size={11}/> 사용 가능</span>}
                  {dupState === 'dup' && <span style={{ color: 'var(--danger-700)' }}><Icon name="alert" size={11}/> 중복 — 다른 번호 필요</span>}
                  <button type="button" onClick={useSuggestion}
                          style={{ background: 'transparent', border: 0, color: 'var(--primary-600)', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 500, textDecoration: 'underline' }}>
                    재생성: {suggestSerial}
                  </button>
                </div>
                {showErr('serial_no') && dupState !== 'dup' && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.serial_no}</div>}
              </div>

              {isPublic && (
                <div className="field">
                  <label className="field__label" htmlFor="pem-inspection-date"><Icon name="shield" size={11}/>검정일자 <span className="field__req">*</span></label>
                  <input id="pem-inspection-date" type="date"
                         className={`input ${showErr('inspection_date') ? 'input--error' : ''}`}
                         value={form.inspection_date}
                         onChange={(e) => { update('inspection_date', e.target.value); setTouched(t => ({ ...t, inspection_date: 1 })); }}/>
                  {showErr('inspection_date') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.inspection_date}</div>}
                </div>
              )}
            </div>
          </section>

          <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <PWSectionHead icon="bolt" title="버전 정보"/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div className="field__label" id="pem-sw-label"><Icon name="bolt" size={11}/>S/W 버전 <span className="field__req">*</span></div>
                <div className="tagpicker" role="group" aria-labelledby="pem-sw-label">
                  {swVersions.map(v => (
                    <button key={v.tag} type="button"
                            className={`tagpicker__item ${form.sw_version === v.tag ? 'tagpicker__item--active' : ''} ${!v.stable && form.sw_version !== v.tag ? 'tagpicker__item--beta' : ''}`}
                            onClick={() => { update('sw_version', v.tag); setTouched(t => ({ ...t, sw_version: 1 })); }}>
                      <Icon name="tag" size={10}/>{v.tag}{!v.stable && <span style={{ fontSize: 11, opacity: 0.8 }}>BETA</span>}
                    </button>
                  ))}
                  <button type="button" className={`tagpicker__item tagpicker__item--add ${addingSwVer ? 'tagpicker__item--active' : ''}`}
                          onClick={() => { setAddingSwVer(v => !v); setNewSwVerTag(''); }}>
                    <Icon name="plus" size={10}/> 버전 추가
                  </button>
                </div>
                {addingSwVer && (
                  <div className="ver-add-row">
                    <input className="input" style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5 }}
                      placeholder="예: v1.8.0-core" value={newSwVerTag}
                      onChange={e => setNewSwVerTag(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addVersionSW(); if (e.key === 'Escape') setAddingSwVer(false); }} autoFocus/>
                    <label className="ver-add-row__toggle">
                      <input type="checkbox" checked={newSwVerStable} onChange={e => setNewSwVerStable(e.target.checked)}/>정식(stable)
                    </label>
                    <button type="button" className="btn btn--primary btn--sm" onClick={addVersionSW} disabled={!newSwVerTag.trim()}><Icon name="plus" size={12}/> 추가</button>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setAddingSwVer(false); setNewSwVerTag(''); }}>취소</button>
                  </div>
                )}
                {showErr('sw_version') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.sw_version}</div>}
              </div>

              <div>
                <div className="field__label" id="pem-fw-label"><Icon name="bolt" size={11}/>F/W 버전 <span className="field__req">*</span></div>
                <div className="tagpicker" role="group" aria-labelledby="pem-fw-label">
                  {fwVersions.map(v => (
                    <button key={v.tag} type="button"
                            className={`tagpicker__item ${form.fw_version === v.tag ? 'tagpicker__item--active' : ''} ${!v.stable && form.fw_version !== v.tag ? 'tagpicker__item--beta' : ''}`}
                            onClick={() => { update('fw_version', v.tag); setTouched(t => ({ ...t, fw_version: 1 })); }}>
                      <Icon name="tag" size={10}/>{v.tag}{!v.stable && <span style={{ fontSize: 11, opacity: 0.8 }}>BETA</span>}
                    </button>
                  ))}
                  <button type="button" className={`tagpicker__item tagpicker__item--add ${addingFwVer ? 'tagpicker__item--active' : ''}`}
                          onClick={() => { setAddingFwVer(v => !v); setNewFwVerTag(''); }}>
                    <Icon name="plus" size={10}/> 버전 추가
                  </button>
                </div>
                {addingFwVer && (
                  <div className="ver-add-row">
                    <input className="input" style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5 }}
                      placeholder="예: v1.8.0-core" value={newFwVerTag}
                      onChange={e => setNewFwVerTag(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addVersionFW(); if (e.key === 'Escape') setAddingFwVer(false); }} autoFocus/>
                    <label className="ver-add-row__toggle">
                      <input type="checkbox" checked={newFwVerStable} onChange={e => setNewFwVerStable(e.target.checked)}/>정식(stable)
                    </label>
                    <button type="button" className="btn btn--primary btn--sm" onClick={addVersionFW} disabled={!newFwVerTag.trim()}><Icon name="plus" size={12}/> 추가</button>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setAddingFwVer(false); setNewFwVerTag(''); }}>취소</button>
                  </div>
                )}
                {showErr('fw_version') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.fw_version}</div>}
              </div>
            </div>
          </section>

          <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <PWSectionHead icon="doc" title="기능검사 성적서"/>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: funcAllDone ? 'var(--success-50)' : funcInspectionData ? 'var(--warning-50,#fffbeb)' : 'var(--surface)',
              border: `1px solid ${funcAllDone ? 'var(--success)' : funcInspectionData ? 'var(--warning,#f59e0b)' : 'var(--border-1)'}`,
              borderRadius: 'var(--r-md)',
            }}>
              <Icon name={funcAllDone ? 'check' : funcInspectionData ? 'clock' : 'doc'} size={16}
                style={{ color: funcAllDone ? 'var(--success-700)' : funcInspectionData ? 'var(--warning-700,#b45309)' : 'var(--ink-4)', flexShrink: 0 }}/>
              <div style={{ flex: 1 }}>
                {funcAllDone
                  ? <span style={{ fontSize: 13.5, color: 'var(--success-700)', fontWeight: 600 }}>검사 완료 · 검사자: {funcInspectionData.inspector} · {funcInspectionData.insp_date}</span>
                  : funcInspectionData
                    ? <span style={{ fontSize: 13.5, color: 'var(--warning-700,#b45309)', fontWeight: 600 }}>검사 미완료 · 검사자: {funcInspectionData.inspector} · {funcInspectionData.insp_date}</span>
                    : <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>기능 검사 성적서를 작성해야 출하대기 등록이 가능합니다</span>}
              </div>
              <button type="button" className={`btn btn--sm ${funcInspectionData ? 'btn--secondary' : 'btn--primary'}`} onClick={() => setOpenFuncInspect(true)}>
                <Icon name="doc" size={12}/> {funcInspectionData ? '수정' : '작성하기'}
              </button>
            </div>
          </section>
        </div>
```

주의: 기능검사 성적서 상태 배너의 "미작성" 배경을 원래의 `var(--surface-2)`에서 `var(--surface)`(흰색)로 바꿨다 — 이제 섹션 자체가 `var(--surface-2)` 배경이라 원래 값 그대로면 배너가 섹션과 구분되지 않기 때문. 이 변경은 의도적이다.

- [ ] **Step 4: 브라우저 수동 확인**

생산착수 카드를 클릭해 `ProductionEntryModal`을 연다:

1. "기본 정보"/"버전 정보"/"기능검사 성적서" 3개 카드형 섹션으로 나뉘어 보이는지 확인.
2. 필수값을 비워둔 채 "생산완료 처리"를 누르면 기존과 동일하게 각 필드 옆에 에러 메시지가 뜨는지 확인(섹션으로 옮긴 뒤에도 `showErr` 로직이 그대로 동작하는지).
3. 시리얼 "중복 확인"/"재생성", SW/FW "버전 추가" 인라인 폼이 기존과 동일하게 동작하는지 확인.
4. 기능검사 미작성 상태에서 배너가 섹션 배경과 시각적으로 구분되는지(흰색 배경) 확인.
5. "임시저장"/"닫기"/"대기로 되돌리기" 버튼이 기존과 동일하게 동작하는지 확인.
6. 태블릿 폭(900px 이하)에서 "기본 정보" 섹션 내부 `form-grid--3`가 1열로 접히는지(기존 반응형 규칙 그대로 적용되는지) 확인.

- [ ] **Step 5: 회귀 검증 명령 실행**

```bash
npm test
grep -n "const { useState }" *.jsx
grep -n "supabase\.from" *.jsx
```

- [ ] **Step 6: 커밋**

```bash
git add production-waiting.jsx
git commit -m "feat: 생산착수 모달 필드를 섹션으로 그룹화"
```

---

## Task 3: `SalesCompletionModal` 섹션 그룹화

**Files:**
- Modify: `production-waiting.jsx:798-921`(Task 1·2 반영 후 라인 번호는 재확인 필요) — `modal__body` 내부를 3개 섹션으로 재구성

**Interfaces:**
- Consumes: Task 2에서 만든 `PWSectionHead({ icon, title, extra })`(같은 파일 내 module-scope 함수 — import 불필요, 선언 순서 무관하게 호출 가능).
- Produces: 없음(다른 태스크가 의존하지 않는 최종 태스크).

- [ ] **Step 1: `production-waiting.jsx` 전체를 Read로 다시 읽는다**

Task 2 커밋으로 라인 번호가 밀렸으므로 반드시 재확인 후 아래 `old_string` 위치를 현재 파일 기준으로 맞춘다.

- [ ] **Step 2: `SalesCompletionModal`의 `modal__body`를 3개 섹션으로 재구성**

`<div className="modal__body" style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>`로 시작해 `<div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>` 하나로 모든 필드를 담고 있는 기존 블록(원래 798~921행) 전체를 다음으로 교체:

```jsx
        <div className="modal__body" style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <PWSectionHead icon="building" title="발주처 정보"/>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <div className="field__label"><label>발주처 <span className="field__req">*</span></label></div>
                <div className="mgr-field">
                  <ComboField
                    value={form.customer_name}
                    onChange={(v) => { update('customer_name', v); update('customer_manager', ''); refreshManagers(v); }}
                    options={masterCustomers}
                    placeholder="고객사명 입력 또는 선택"
                    ariaLabel="발주처"
                    error={showErr('customer_name')}
                    metaKey="last"/>
                  <button type="button" className="btn btn--secondary mgr-field__manage"
                          onClick={() => setModal('add-customer')} title="신규 고객사 등록">
                    <Icon name="plus" size={13}/>
                  </button>
                </div>
                {showErr('customer_name') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.customer_name}</div>}
              </div>

              <div className="field">
                <div className="field__label"><label>발주처 담당자 <span className="field__req">*</span></label></div>
                <div className="mgr-field">
                  <ComboField
                    value={form.customer_manager}
                    onChange={(v) => update('customer_manager', v)}
                    options={managers}
                    placeholder={form.customer_name ? '담당자 선택 또는 입력' : '발주처를 먼저 선택하세요'}
                    ariaLabel="발주처 담당자"
                    error={showErr('customer_manager')}
                    displayKey="display"/>
                  <button type="button" className="btn btn--secondary mgr-field__manage"
                          onClick={() => {
                            if (!form.customer_name) { window.actions.flashToast('발주처를 먼저 선택해 주세요', 'error'); return; }
                            setModal('mgr');
                          }} title="담당자 관리">
                    <Icon name="user" size={13}/>
                  </button>
                </div>
                {showErr('customer_manager') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.customer_manager}</div>}
              </div>

              <div className="field">
                <label className="field__label" htmlFor="scm-mgr-phone">발주처 담당자 전화번호 <span className="field__req">*</span></label>
                <input id="scm-mgr-phone" type="tel" className={`input ${showErr('field_manager_phone') ? 'input--error' : ''}`}
                       style={{ fontFamily: 'var(--font-mono)' }} placeholder="010-0000-0000" autoComplete="tel"
                       value={form.field_manager_phone}
                       onChange={(e) => {
                         const d = String(e.target.value).replace(/\D/g, '').slice(0, 11);
                         const fmt = d.length < 4 ? d : d.length < 8 ? d.slice(0,3)+'-'+d.slice(3) : d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7);
                         update('field_manager_phone', fmt);
                       }}/>
                {showErr('field_manager_phone') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.field_manager_phone}</div>}
              </div>
            </div>
          </section>

          <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <PWSectionHead icon="truck" title="납품 정보"/>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="field">
                <label className="field__label" htmlFor="scm-cable">케이블 길이(m) <span className="field__req">*</span></label>
                <input id="scm-cable" className={`input ${showErr('cable_length') ? 'input--error' : ''}`}
                       list="scm-cable-options" inputMode="numeric"
                       value={form.cable_length}
                       onChange={(e) => update('cable_length', e.target.value.replace(/[^\d.]/g, ''))}/>
                <datalist id="scm-cable-options">
                  {CABLE_LENGTH_OPTIONS.map(v => <option key={v} value={v}/>)}
                </datalist>
                {showErr('cable_length') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.cable_length}</div>}
              </div>

              <div className="field">
                <label className="field__label" htmlFor="scm-delivery">납품일자 <span className="field__req">*</span></label>
                <input id="scm-delivery" type="date" className={`input ${showErr('delivery_date') ? 'input--error' : ''}`}
                       value={form.delivery_date} onChange={(e) => update('delivery_date', e.target.value)}/>
                {showErr('delivery_date') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.delivery_date}</div>}
              </div>

              {isPublic && (
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label className="field__label" htmlFor="scm-cpo">CPO 운영사</label>
                  <BulkInlineCombo value={form.cpo_name} onChange={(v) => update('cpo_name', v)}
                    options={masterCpos.map(c => c.name)} placeholder="CPO 운영사"/>
                </div>
              )}

              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="field__label" htmlFor="scm-address">납품장소 (설치주소) <span className="field__req">*</span></label>
                <AddressField id="scm-address" value={form.install_address}
                  onChange={(v) => update('install_address', v)} error={showErr('install_address')}/>
                <input className="input" style={{ marginTop: 6 }} placeholder="상세주소 (동·호수, 층수 등)"
                  value={form.install_address_detail} onChange={(e) => update('install_address_detail', e.target.value)}/>
                {showErr('install_address') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.install_address}</div>}
              </div>
            </div>
          </section>

          {isPublic && (
            <section style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
              <PWSectionHead icon="wifi" title="통신 정보"
                extra={<span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500 }}>(공용 전용)</span>}/>
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div className="field">
                  <label className="field__label" htmlFor="scm-station">충전소 ID <span className="field__req">*</span></label>
                  <input id="scm-station" className={`input ${showErr('station_id') ? 'input--error' : ''}`}
                         style={{ fontFamily: 'var(--font-mono)' }} placeholder="예: CT3006"
                         value={form.station_id} onChange={(e) => update('station_id', e.target.value)}/>
                  {showErr('station_id') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.station_id}</div>}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="scm-charger">충전기 ID <span className="field__req">*</span></label>
                  <input id="scm-charger" className={`input ${showErr('charger_no') ? 'input--error' : ''}`}
                         style={{ fontFamily: 'var(--font-mono)' }} placeholder="예: 01"
                         value={form.charger_no} onChange={(e) => update('charger_no', e.target.value)}/>
                  {showErr('charger_no') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.charger_no}</div>}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="scm-router">라우터 번호 <span className="field__req">*</span></label>
                  <input id="scm-router" className={`input ${showErr('router_no') ? 'input--error' : ''}`}
                         style={{ fontFamily: 'var(--font-mono)' }} placeholder="RTR-2024-00001"
                         value={form.router_no} onChange={(e) => update('router_no', e.target.value)}/>
                  {showErr('router_no') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.router_no}</div>}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="scm-usim">USIM 번호 <span className="field__req">*</span></label>
                  <input id="scm-usim" className={`input ${showErr('usim_no') ? 'input--error' : ''}`}
                         style={{ fontFamily: 'var(--font-mono)' }} placeholder="ICCID 19~20자리" maxLength={20} inputMode="numeric"
                         value={form.usim_no} onChange={(e) => update('usim_no', e.target.value.replace(/\D/g, ''))}/>
                  {showErr('usim_no') && <div role="alert" className="field__err"><Icon name="alert" size={12}/>{errors.usim_no}</div>}
                </div>
              </div>
            </section>
          )}
        </div>
```

- [ ] **Step 3: 브라우저 수동 확인**

"생산완료" 컬럼 카드를 클릭해 `SalesCompletionModal`을 연다(sales/admin 역할):

1. 공용 오더로 열었을 때 "발주처 정보"/"납품 정보"/"통신 정보(공용 전용)" 3개 섹션이 보이는지 확인.
2. 비공용 오더로 열었을 때 "통신 정보" 섹션 자체가 렌더링되지 않는지(CPO 운영사 필드도 함께 숨김) 확인.
3. 필수값을 비워둔 채 "저장"을 누르면 각 필드 옆에 기존과 동일하게 에러가 뜨는지 확인.
4. 발주처 콤보에서 신규 고객사 등록(+버튼) → `AddCustomerModal`이 기존과 동일하게 뜨고, 등록 후 발주처 필드에 값이 채워지는지 확인.
5. 발주처 선택 후 담당자 관리(사람 아이콘 버튼) → `ManagerManageModal`이 기존과 동일하게 동작하는지 확인.
6. 저장 후 `window.actions.updateOrder`가 정상 호출되어 모달이 닫히고 칸반 카드가 갱신되는지(Task 1의 진행율 바가 늘어나는지) 확인.

- [ ] **Step 4: 회귀 검증 명령 실행**

```bash
npm test
grep -n "const { useState }" *.jsx
grep -n "supabase\.from" *.jsx
```

- [ ] **Step 5: 커밋**

```bash
git add production-waiting.jsx
git commit -m "feat: 생산완료 모달 필드를 섹션으로 그룹화"
```
