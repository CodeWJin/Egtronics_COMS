// 영업 부서 입력 화면 (Sales Input Dashboard)
const { useState: useStateSI, useRef: useRefSI, useEffect: useEffectSI, useMemo: useMemoSI } = React;

function ComboField({ value, onChange, options, placeholder, error, displayKey = 'name', metaKey = 'description', ariaLabel, id }) {
  const [open, setOpen] = useStateSI(false);
  const [highlight, setHighlight] = useStateSI(0);
  const [showAll, setShowAll] = useStateSI(false);
  const ref = useRefSI(null);
  const menuIdRef = useRefSI(null);
  if (menuIdRef.current === null) menuIdRef.current = `combo-menu-${Math.random().toString(36).slice(2, 7)}`;
  const menuId = menuIdRef.current;

  useEffectSI(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setShowAll(false); } };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const opts = options || [];
  const filtered = showAll
    ? opts
    : opts.filter(o => {
        if (!value) return true;
        const q = value.toLowerCase();
        return (o[displayKey] || '').toLowerCase().includes(q)
            || (o[metaKey]    || '').toLowerCase().includes(q);
      });
  const activeDescendant = open && filtered[highlight] ? `${menuId}-opt-${highlight}` : undefined;
  return (
    <div className="combo" ref={ref}>
      <div className="input-group">
        <input id={id}
               className={`input ${error ? 'input--error' : ''}`}
               placeholder={placeholder}
               aria-label={ariaLabel}
               aria-invalid={!!error}
               role="combobox"
               aria-expanded={open}
               aria-haspopup="listbox"
               aria-autocomplete="list"
               aria-controls={menuId}
               aria-activedescendant={activeDescendant}
               value={value || ''}
               onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); setShowAll(false); }}
               onFocus={() => { setOpen(true); setShowAll(true); }}
               onKeyDown={(e) => {
                 if (e.key === 'ArrowDown') { setHighlight((h) => Math.min(h + 1, filtered.length - 1)); e.preventDefault(); }
                 if (e.key === 'ArrowUp')   { setHighlight((h) => Math.max(h - 1, 0)); e.preventDefault(); }
                 if (e.key === 'Enter' && open && filtered[highlight]) { onChange(filtered[highlight][displayKey]); setOpen(false); setShowAll(false); e.preventDefault(); }
                 if (e.key === 'Escape')    { setOpen(false); setShowAll(false); }
               }}/>
        <button type="button" className="input-group__btn" aria-label="목록 열기" onClick={() => { setShowAll(true); setOpen((v) => !v); }}>
          <Icon name="chevron-down" size={12} />
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div className="combo__menu" role="listbox" id={menuId} aria-label={ariaLabel}>
          {filtered.map((o, i) => (
            <div key={o[displayKey]}
                 id={`${menuId}-opt-${i}`}
                 role="option"
                 aria-selected={i === highlight}
                 className={`combo__item ${i === highlight ? 'combo__item--active' : ''}`}
                 onMouseEnter={() => setHighlight(i)}
                 onMouseDown={(e) => { e.preventDefault(); onChange(o[displayKey]); setOpen(false); }}>
              <span>{o[displayKey]}</span>
              <span className="combo__item__meta">{o[metaKey] || (o.last ? `최근 ${o.last}` : '')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddressField({ value, onChange, error, id }) {
  const openPostcode = () => {
    const open = () => new window.daum.Postcode({
      oncomplete(data) {
        const addr = data.roadAddress || data.jibunAddress;
        onChange(`[${data.zonecode}] ${addr} `);
      },
    }).open();
    if (window.daum && window.daum.Postcode) {
      open();
    } else {
      const s = document.createElement('script');
      s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      s.onload = open;
      document.head.appendChild(s);
    }
  };

  return (
    <div className="input-group">
      <input id={id} className={`input input--readonly ${error ? 'input--error' : ''}`}
             placeholder="우편번호 검색 버튼을 눌러 주소를 선택하세요"
             readOnly
             aria-readonly="true"
             value={value || ''}
             onChange={(e) => onChange(e.target.value)}/>
      <button type="button" className="input-group__btn" onClick={openPostcode}>
        <Icon name="search" size={12} style={{ marginRight: 4 }}/> 우편번호
      </button>
    </div>
  );
}

function SalesInputScreen() {
  const s = window.useStore();
  const editing = s.editingOrderId ? s.orders.find(o => o.order_id === s.editingOrderId) : null;
  const isEdit = !!editing;

  const nextRowIdRef = useRefSI(1);
  const clampQty = (v, max = 500) => Math.max(1, Math.min(max, parseInt(v) || 1));

  const makeRow = () => ({
    _id: nextRowIdRef.current++,
    _power: '',
    model_name: '', usage_type: '공용',
    qty: 1,
  });

  const [rows, setRows] = useStateSI([makeRow()]);
  const [submitted, setSubmitted] = useStateSI(false);
  const [masterModels, setMasterModels] = useStateSI([]);
  const [modal, setModal] = useStateSI(null);
  const [modelModalRow, setModelModalRow] = useStateSI(null);
  const [selectedRowIds, setSelectedRowIds] = useStateSI(() => new Set());
  const [addRowCount, setAddRowCount] = useStateSI(1);
  const selectAllRef = useRefSI(null);

  const updateRow = (i, k, v) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  const addRow = (count = 1) => setRows(r => {
    const last = r[r.length - 1];
    const isNonPublic = last && last.usage_type === '비공용';
    const added = [];
    for (let k = 0; k < count; k++) {
      const row = makeRow();
      if (isNonPublic) row.usage_type = '비공용';
      added.push(row);
    }
    return [...r, ...added];
  });
  const removeRow = (i) => {
    const removedId = rows[i]?._id;
    setRows(r => r.filter((_, idx) => idx !== i));
    if (removedId !== undefined) {
      setSelectedRowIds(prev => {
        if (!prev.has(removedId)) return prev;
        const next = new Set(prev);
        next.delete(removedId);
        return next;
      });
    }
  };
  const duplicateRow = (i) => setRows(r => [...r.slice(0, i + 1), { ...r[i], _id: nextRowIdRef.current++ }, ...r.slice(i + 1)]);

  const allRowIds = useMemoSI(() => rows.map(r => r._id), [rows]);
  const allRowsSelected = allRowIds.length > 0 && allRowIds.every(id => selectedRowIds.has(id));
  const someRowsSelected = !allRowsSelected && allRowIds.some(id => selectedRowIds.has(id));
  useEffectSI(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someRowsSelected;
  }, [someRowsSelected]);
  const toggleRowSelect = (id) => setSelectedRowIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllRows = () => setSelectedRowIds(allRowsSelected ? new Set() : new Set(allRowIds));
  const applyBulkUsageType = (t) => setRows(r => r.map(rw => selectedRowIds.has(rw._id) ? { ...rw, usage_type: t } : rw));
  const allSelected = allRowIds.length > 0 && selectedRowIds.size === allRowIds.length;
  const bulkDeleteRows = () => {
    window.actions.showConfirm(`선택한 ${selectedRowIds.size}행을 삭제할까요?`, () => {
      setRows(r => r.filter(rw => !selectedRowIds.has(rw._id)));
      setSelectedRowIds(new Set());
    });
  };

  useEffectSI(() => {
    setMasterModels(window.PMDB.getModels());
  }, []);

  useEffectSI(() => {
    if (editing) {
      setRows([{
        _id: nextRowIdRef.current++,
        _power: '',
        model_name: editing.model_name || '',
        usage_type: editing.usage_type || '공용',
        qty: 1,
      }]);
    } else {
      setRows([makeRow()]);
    }
    setSelectedRowIds(new Set());
    setSubmitted(false);
  }, [s.editingOrderId]);

  const modelCodes = useMemoSI(() => new Set(masterModels.map(m => m.model)), [masterModels]);
  const powerOptions = useMemoSI(() => {
    const unique = [...new Set(masterModels.map(m => m.power).filter(Boolean))];
    return unique.sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      return isNaN(na) || isNaN(nb) ? String(a).localeCompare(String(b)) : na - nb;
    });
  }, [masterModels]);
  const modelsByPower = useMemoSI(() => {
    const map = {};
    masterModels.forEach(m => { if (!map[m.power]) map[m.power] = []; map[m.power].push(m); });
    return map;
  }, [masterModels]);

  const rowErrors = rows.map(row => {
    const e = {};
    if (!row.model_name) e.model_name = '모델 필수';
    else if (!modelCodes.has(row.model_name)) e.model_name = '미등록 모델';
    return e;
  });

  const validRows = rows.filter((row, i) => row.model_name && Object.keys(rowErrors[i]).length === 0);
  const errorRowCount = rows.filter((row, i) => row.model_name && Object.keys(rowErrors[i]).length > 0).length;
  const totalValidQty = validRows.reduce((sum, row) => sum + clampQty(row.qty), 0);

  const isDirty = useMemoSI(() => {
    if (!isEdit || !editing || !rows[0]) return false;
    const row = rows[0];
    return ['model_name', 'usage_type'].some(k => (row[k] || '') !== (editing[k] || ''));
  }, [isEdit, editing, rows]);

  const submittingRef = useRefSI(false);

  const submit = () => {
    if (submittingRef.current) return;
    setSubmitted(true);
    if (isEdit) {
      const row = rows[0] || {};
      if (!row.model_name) return;
      submittingRef.current = true;
      window.actions.updateOrder(editing.order_id, { model_name: row.model_name, usage_type: row.usage_type });
      submittingRef.current = false;
      window.actions.setView('waiting');
      return;
    }
    if (validRows.length === 0) return;
    submittingRef.current = true;
    const requestedBy = s.currentUser?.name || '';
    validRows.forEach(({ model_name, usage_type, qty }) => {
      const count = clampQty(qty);
      for (let q = 0; q < count; q++) window.actions.addOrder({ model_name, usage_type, requested_by: requestedBy });
    });
    setRows([makeRow()]);
    setSelectedRowIds(new Set());
    setSubmitted(false);
    submittingRef.current = false;
  };

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <div className="screen__crumbs">영업 부서 · {isEdit ? `오더 #${editing.order_id} 수정` : '신규 생산요청'}</div>
          <h1 className="screen__title">
            {isEdit ? '생산요청 수정' : '생산 요청'}
            {isDirty && <span className="badge badge--info" style={{ marginLeft: 10, verticalAlign: 'middle', fontSize: 12, fontWeight: 500 }}>수정됨</span>}
          </h1>
          <p className="screen__sub">
            {isEdit
              ? <>생산대기 상태의 오더만 수정할 수 있습니다. 변경 후 <strong>수정 저장</strong>을 누르세요.</>
              : <>모델과 수량만으로 생산요청이 등록됩니다. 발주처·납품정보 등 상세 정보는 <strong>생산완료</strong> 단계에서 입력합니다.</>}
          </p>
        </div>
        <div className="sales-buttons">
          {isEdit && (
            <button className="btn btn--secondary" onClick={() => setModal('history')}>
              <Icon name="clock" size={13}/> 수정 이력
            </button>
          )}
          {isEdit ? (
            <button className="btn btn--secondary" onClick={() => { window.actions.cancelEdit(); window.actions.setView('waiting'); }}>
              <Icon name="arrow-left" size={13}/> 취소
            </button>
          ) : (
            <button className="btn btn--secondary" onClick={() => { setRows([makeRow()]); setSelectedRowIds(new Set()); setSubmitted(false); }}>
              <Icon name="refresh" size={13}/> 초기화
            </button>
          )}
          <button className="btn btn--primary btn--lg" onClick={submit}>
            <Icon name={isEdit ? 'check' : 'save'} size={14}/>
            {' '}{isEdit ? '수정 저장' : totalValidQty > 0 ? `${totalValidQty}건 생산요청 등록` : '생산요청 등록'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── 제품 선택 ── */}
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">제품 선택</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {validRows.length > 0 ? (
                <span style={{ fontSize: 13, color: 'var(--success-700)', fontWeight: 600 }}>
                  {totalValidQty}건 등록 예정
                  {totalValidQty !== validRows.length && (
                    <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> ({validRows.length}행)</span>
                  )}
                  {errorRowCount > 0 && <span style={{ color: 'var(--danger-700)', fontWeight: 400 }}> · 오류 {errorRowCount}건 제외</span>}
                </span>
              ) : (
                <span className="card__sub">모델을 입력한 행이 등록됩니다</span>
              )}
              {!isEdit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" min={1} max={50} value={addRowCount}
                         aria-label="추가할 행 개수"
                         onChange={(e) => {
                           const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
                           setAddRowCount(digits === '' ? '' : Math.min(50, parseInt(digits, 10)));
                         }}
                         onBlur={() => setAddRowCount(v => Math.max(1, Math.min(50, parseInt(v, 10) || 1)))}
                         style={{ width: 44, fontFamily: 'var(--font-mono)', fontSize: 12.5, textAlign: 'center', padding: '5px 4px', border: '1px solid var(--border-1)', borderRadius: 'var(--r-md)', background: 'var(--surface-1)' }}/>
                  <button type="button" className="btn btn--secondary btn--sm"
                          onClick={() => addRow(Math.max(1, Math.min(50, parseInt(addRowCount, 10) || 1)))}>
                    <Icon name="plus" size={12}/> 행 추가
                  </button>
                </div>
              )}
              {s.currentUser?.role === 'admin' && (<>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setModal('add-model')} title="신규 모델 등록">
                  <Icon name="plus" size={12}/> 모델
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setModal('model-mgr')} title="모델 목록 관리">
                  <Icon name="settings" size={12}/> 모델 관리
                </button>
              </>)}
            </div>
          </div>
          <div className="card__body" style={{ padding: 0 }}>
            {!isEdit && selectedRowIds.size > 0 && (
              <div className="toolbar" style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)', margin: '12px 16px 0' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-700, var(--primary))' }}>
                  <Icon name="check" size={13}/> {selectedRowIds.size}행 선택됨
                </span>
                <div style={{ flex: 1 }}/>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setModelModalRow('bulk')}>
                  모델 일괄 지정
                </button>
                <div className="chips" style={{ gap: 4 }}>
                  {['공용', '비공용'].map(t => (
                    <button key={t} type="button" className="btn btn--tag btn--ghost" onClick={() => applyBulkUsageType(t)}>{t}로 일괄 지정</button>
                  ))}
                </div>
                <button type="button" className="btn btn--ghost btn--sm" style={{ color: 'var(--danger-700)' }}
                        disabled={allSelected}
                        title={allSelected ? '최소 1개 행은 남아야 합니다' : ''}
                        onClick={bulkDeleteRows}>
                  선택 삭제
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelectedRowIds(new Set())}>선택 해제</button>
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    {!isEdit && (
                      <th scope="col" style={{ width: 34, textAlign: 'center', paddingLeft: 12 }}>
                        <input ref={selectAllRef} type="checkbox" aria-label="전체 행 선택/해제"
                               checked={allRowsSelected} onChange={toggleAllRows}/>
                      </th>
                    )}
                    <th style={{ width: 32, textAlign: 'center' }}>#</th>
                    <th style={{ minWidth: 170 }}>충전속도 (모델) <span className="field__req">*</span></th>
                    <th style={{ minWidth: 120 }}>충전기 용도</th>
                    <th style={{ minWidth: 140 }}>수량</th>
                    {!isEdit && <th style={{ width: 44 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const errs = submitted ? rowErrors[i] : {};
                    return (
                      <tr key={row._id} style={errs.model_name ? { background: 'var(--danger-50)' } : (row.qty || 1) > 1 ? { background: 'var(--primary-50)' } : {}}>
                        {!isEdit && (
                          <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', paddingLeft: 12 }}>
                            <input type="checkbox" aria-label={`${i + 1}번째 행 선택`}
                                   checked={selectedRowIds.has(row._id)} onChange={() => toggleRowSelect(row._id)}/>
                          </td>
                        )}
                        <td style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: 12, paddingLeft: 12 }}>{i + 1}</td>

                        <td style={{ padding: 4, minWidth: 170 }}>
                          <button
                            type="button"
                            onClick={() => setModelModalRow(i)}
                            className={`input ${submitted && errs.model_name ? 'input--error' : ''}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between', cursor: 'pointer', padding: '6px 10px' }}>
                            <span style={{ fontFamily: row.model_name ? 'var(--font-mono)' : undefined, fontSize: 12, color: row.model_name ? 'var(--ink-1)' : 'var(--ink-4)' }}>
                              {row.model_name || '모델 선택...'}
                            </span>
                            <Icon name="chevron-down" size={11} style={{ color: 'var(--ink-4)', flexShrink: 0 }}/>
                          </button>
                          {submitted && errs.model_name && (
                            <div role="alert" className="field__err" style={{ padding: '2px 6px', marginTop: 0 }}>{errs.model_name}</div>
                          )}
                        </td>

                        <td style={{ padding: '4px 8px' }}>
                          <div className="chips" style={{ gap: 4, flexWrap: 'nowrap' }}>
                            {['공용', '비공용'].map(t => (
                              <button key={t} type="button"
                                      className={`btn btn--tag ${row.usage_type === t ? 'btn--primary' : 'btn--ghost'}`}
                                      onClick={() => updateRow(i, 'usage_type', t)}>
                                {t}
                              </button>
                            ))}
                          </div>
                        </td>

                        <td style={{ padding: 4 }}>
                          {!isEdit ? (
                            <div style={{ display: 'flex', alignItems: 'stretch' }}>
                              {(() => {
                                const stepBtn = { background: 'var(--surface-2)', border: '1px solid var(--border-1)', padding: '4px 9px', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1, minWidth: 28 };
                                return (
                                <>
                                  <button type="button"
                                    style={{ ...stepBtn, borderRight: 'none', borderRadius: 'var(--r-md) 0 0 var(--r-md)' }}
                                    onClick={(e) => { e.stopPropagation(); updateRow(i, 'qty', clampQty((row.qty || 1) - 1)); }}>−</button>
                                  <input type="number"
                                    style={{ width: 52, fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'center', padding: '5px 4px', border: '1px solid var(--border-1)', borderRadius: 0, background: 'var(--surface-1)', outline: 'none', MozAppearance: 'textfield', WebkitAppearance: 'none' }}
                                    min={1} max={500} value={row.qty === '' ? '' : (row.qty || 1)}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      if (raw === '') { updateRow(i, 'qty', ''); return; }
                                      const digits = raw.replace(/\D/g, '').slice(0, 3);
                                      updateRow(i, 'qty', digits === '' ? '' : Math.min(500, parseInt(digits, 10)));
                                    }}
                                    onBlur={() => updateRow(i, 'qty', clampQty(row.qty))}/>
                                  <button type="button"
                                    style={{ ...stepBtn, borderLeft: 'none', borderRadius: '0 var(--r-md) var(--r-md) 0' }}
                                    onClick={(e) => { e.stopPropagation(); updateRow(i, 'qty', clampQty((row.qty || 1) + 1)); }}>+</button>
                                </>
                                );
                              })()}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--ink-4)', fontSize: 12, padding: '0 8px', display: 'block' }}>—</span>
                          )}
                        </td>

                        {!isEdit && (
                          <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                              <button type="button" className="btn btn--ghost btn--sm"
                                      style={{ padding: '4px 6px', color: 'var(--ink-4)' }}
                                      onClick={() => duplicateRow(i)} title="행 복제 (같은 모델·용도로 한 행 더 추가)">
                                <Icon name="copy" size={13}/>
                              </button>
                              {rows.length > 1 && (
                                <button type="button" className="btn btn--ghost btn--sm"
                                        style={{ padding: '4px 6px', color: 'var(--ink-4)' }}
                                        onClick={() => removeRow(i)} title="행 삭제">
                                  <Icon name="x" size={13}/>
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>


      </div>

      {modal === 'history' && isEdit && (
        <OrderHistoryModal orderId={editing.order_id} onClose={() => setModal(null)}/>
      )}
      {modal === 'add-model' && (
        <AddModelModal
          onClose={() => setModal(null)}
          onAdded={() => { setMasterModels(window.PMDB.getModels()); setModal(null); }}/>
      )}
      {modal === 'model-mgr' && (
        <ModelManageModal
          onClose={() => setModal(null)}
          onChanged={() => setMasterModels(window.PMDB.getModels())}/>
      )}
      {(modelModalRow === 'bulk' || (modelModalRow !== null && rows[modelModalRow])) && (
        <ModelSelectModal
          onClose={() => setModelModalRow(null)}
          onSelect={(model, power) => {
            if (modelModalRow === 'bulk') {
              setRows(r => r.map(rw => selectedRowIds.has(rw._id) ? { ...rw, model_name: model, _power: power || rw._power } : rw));
            } else {
              setRows(r => r.map((rw, idx) => idx === modelModalRow ? { ...rw, model_name: model, _power: power || rw._power } : rw));
            }
            setModelModalRow(null);
          }}
          powerOptions={powerOptions}
          modelsByPower={modelsByPower}
          currentModel={modelModalRow === 'bulk' ? '' : rows[modelModalRow]?.model_name}
          currentPower={modelModalRow === 'bulk' ? '' : (rows[modelModalRow]?._power || masterModels.find(m => m.model === rows[modelModalRow]?.model_name)?.power || '')}
        />
      )}
    </div>
  );
}

/* ────────── 고객사 담당자 관리 모달 (DB: tb_customer_manager) ────────── */
function ManagerManageModal({ customerName, onClose, onChanged }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const [list, setList] = useStateSI([]);
  const [draft, setDraft] = useStateSI(null); // { manager_id?, name, phone, is_primary }
  const [err, setErr] = useStateSI('');

  const reload = () => setList(window.PMDB.getManagers(customerName));
  useEffectSI(() => { reload(); }, [customerName]);

  const startAdd = () => { setErr(''); setDraft({ name: '', phone: '', is_primary: list.length === 0 }); };
  const startEdit = (m) => { setErr(''); setDraft({ ...m }); };

  const fmtPhone = (v) => {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return d.slice(0, 3) + '-' + d.slice(3);
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  };

  const saveDraft = () => {
    if (!draft.name.trim()) { setErr('담당자 이름을 입력하세요'); return; }
    if (draft.manager_id) {
      window.PMDB.updateManager(draft.manager_id, draft);
    } else {
      window.PMDB.addManager({ ...draft, customer_name: customerName });
    }
    reload();
    onChanged && onChanged(draft.name);
    setDraft(null);
  };

  const remove = (m) => {
    window.PMDB.deleteManager(m.manager_id);
    reload();
    onChanged && onChanged(null);
  };

  const makePrimary = (m) => {
    window.PMDB.updateManager(m.manager_id, { ...m, is_primary: 1 });
    reload();
    onChanged && onChanged(m.name);
  };

  return (
    <div className="modal-backdrop" ref={dialogRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-customer-mgr-title" style={{ width: 520, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h2 id="modal-customer-mgr-title" className="modal__title">고객사 담당자 관리</h2>
          <p className="modal__sub"><strong style={{ color: 'var(--ink-1)' }}>{customerName}</strong></p>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="mgr-list">
            {list.length === 0 && (
              <div className="emptystate" style={{ padding: '20px 0' }}>
                <div className="emptystate__title">등록된 담당자가 없습니다</div>
                <div className="emptystate__sub">아래 ‘담당자 추가’로 등록하세요</div>
              </div>
            )}
            {list.map(m => (
              <div key={m.manager_id} className="mgr-row">
                <div className="mgr-row__main">
                  <div className="mgr-row__name">
                    {m.name}
                    {!!m.is_primary && <span className="badge badge--info" style={{ marginLeft: 6 }}>대표</span>}
                  </div>
                  <div className="mgr-row__meta">
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{m.phone || '—'}</span>
                  </div>
                </div>
                <div className="mgr-row__actions">
                  {!m.is_primary && <button className="btn btn--ghost btn--sm" onClick={() => makePrimary(m)}>대표 지정</button>}
                  <button className="btn btn--secondary btn--sm" onClick={() => startEdit(m)}>수정</button>
                  <button className="btn btn--ghost btn--sm btn--icon" aria-label="삭제" onClick={() => remove(m)}><Icon name="x" size={14}/></button>
                </div>
              </div>
            ))}
          </div>

          {draft ? (
            <div className="mgr-edit">
              <div className="mgr-edit__title">{draft.manager_id ? '담당자 수정' : '담당자 추가'}</div>
              <div className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="si-mgr-name">이름 <span className="field__req">*</span></label>
                  <input id="si-mgr-name" className="input" autoFocus value={draft.name}
                         onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}/>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="si-mgr-phone">휴대폰</label>
                  <input id="si-mgr-phone" className="input" style={{ fontFamily: 'var(--font-mono)' }} placeholder="010-0000-0000"
                         value={draft.phone}
                         onChange={(e) => setDraft(d => ({ ...d, phone: fmtPhone(e.target.value) }))}/>
                </div>
              </div>
              <label className="mgr-edit__primary">
                <input type="checkbox" checked={!!draft.is_primary}
                       onChange={(e) => setDraft(d => ({ ...d, is_primary: e.target.checked }))}/>
                대표 담당자로 지정
              </label>
              {err && <div role="alert" className="field__err"><Icon name="alert" size={12}/> {err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn btn--secondary btn--sm" onClick={() => { setDraft(null); setErr(''); }}>취소</button>
                <button className="btn btn--primary btn--sm" onClick={saveDraft}><Icon name="check" size={13}/> 저장</button>
              </div>
            </div>
          ) : (
            <button className="btn btn--secondary" style={{ alignSelf: 'flex-start' }} onClick={startAdd}>
              <Icon name="plus" size={13}/> 담당자 추가
            </button>
          )}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ────────── 수정 이력 모달 (DB: tb_order_history) ────────── */
function OrderHistoryModal({ orderId, onClose }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const [history, setHistory] = useStateSI([]);

  useEffectSI(() => {
    if (orderId) setHistory(window.PMDB.getHistory(orderId));
  }, [orderId]);

  return (
    <div className="modal-backdrop" ref={dialogRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-order-history-title" style={{ width: 560, maxWidth: '96vw' }}>
        <div className="modal__head">
          <h2 id="modal-order-history-title" className="modal__title"><Icon name="clock" size={14}/> 수정 이력</h2>
          <p className="modal__sub">오더 #{orderId} · {history.length}건</p>
        </div>
        <div className="modal__body" style={{ maxHeight: 440, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {history.length === 0 && (
            <div className="emptystate" style={{ padding: '24px 0' }}>
              <div className="emptystate__title">수정 이력이 없습니다</div>
              <div className="emptystate__sub">이 오더에 대한 변경 이력이 아직 없습니다</div>
            </div>
          )}
          {history.map((h, i) => (
            <div key={h.history_id} style={{ padding: '14px 0', borderBottom: i < history.length - 1 ? '1px solid var(--border-1)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${h.action === 'create' ? 'badge--info' : 'badge--pending'}`}>
                    <span className="badge__dot"/>
                    {h.action === 'create' ? '최초 등록' : '수정'}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--ink-1)', fontSize: 13 }}>{h.changed_by}</span>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>{h.changed_at}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
                {(h.changed_fields || []).map((f) => (
                  <div key={f.field} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, alignItems: 'start', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--ink-3)', paddingTop: 1 }}>{f.label}</span>
                    {h.action === 'create' ? (
                      <span style={{ color: 'var(--ink-1)', wordBreak: 'break-all' }}>{f.after || '—'}</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--danger)', textDecoration: 'line-through', wordBreak: 'break-all' }}>{f.before || '—'}</span>
                        <span style={{ color: 'var(--ink-4)' }}>→</span>
                        <span style={{ color: 'var(--success-700)', wordBreak: 'break-all' }}>{f.after || '—'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ────────── 고객사 추가 모달 ────────── */
function AddCustomerModal({ onClose, onAdded }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const [name, setName] = useStateSI('');
  const [isAddress, setIsAddress] = useStateSI(false);
  const [err, setErr] = useStateSI('');

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setErr('고객사명을 입력하세요'); return; }
    const result = window.PMDB.addMasterCustomer(trimmedName, isAddress);
    if (!result.ok) { setErr(result.msg); return; }
    onAdded && onAdded(trimmedName);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" ref={dialogRef} aria-labelledby="modal-add-customer-title" style={{ width: 400, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h2 id="modal-add-customer-title" className="modal__title">고객사 추가</h2>
          <p className="modal__sub">신규 고객사를 마스터 목록에 등록합니다</p>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field__label" htmlFor="si-add-cust-name">고객사명 <span className="field__req">*</span></label>
            <input id="si-add-cust-name" className="input" autoFocus value={name}
                   onChange={(e) => { setName(e.target.value); setErr(''); }}
                   placeholder="예: (주)에이비씨"
                   onKeyDown={(e) => e.key === 'Enter' && save()}/>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={isAddress}
                   onChange={(e) => setIsAddress(e.target.checked)}
                   style={{ width: 15, height: 15, accentColor: 'var(--primary)' }}/>
            주소지 고객사 (is_address)
          </label>
          {err && <div role="alert" className="field__err"><Icon name="alert" size={12}/> {err}</div>}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>취소</button>
          <button className="btn btn--primary" onClick={save}><Icon name="check" size={13}/> 추가</button>
        </div>
      </div>
    </div>
  );
}

/* ────────── 고객사 마스터 관리 모달 ────────── */
function CustomerManageModal({ onClose, onChanged }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const [list, setList] = useStateSI(() => window.PMDB.getCustomers());
  const [draft, setDraft] = useStateSI(null); // { idx, name, is_address }
  const [err, setErr] = useStateSI('');

  const reload = () => setList(window.PMDB.getCustomers());

  const startEdit = (c, idx) => { setErr(''); setDraft({ idx, name: c.name, is_address: !!c.is_address }); };

  const saveDraft = () => {
    const trimmedName = draft.name.trim();
    if (!trimmedName) { setErr('고객사명을 입력하세요'); return; }
    const result = window.PMDB.updateMasterCustomer(draft.idx, trimmedName, draft.is_address);
    if (!result.ok) { setErr(result.msg); return; }
    reload();
    onChanged && onChanged();
    setDraft(null);
  };

  const remove = (idx) => {
    window.PMDB.deleteMasterCustomer(idx);
    reload();
    onChanged && onChanged();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" ref={dialogRef} aria-labelledby="modal-manage-customer-title" style={{ width: 520, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h2 id="modal-manage-customer-title" className="modal__title">고객사 관리</h2>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="mgr-list">
            {list.length === 0 && (
              <div className="emptystate" style={{ padding: '20px 0' }}>
                <div className="emptystate__title">등록된 고객사가 없습니다</div>
              </div>
            )}
            {list.map((c, idx) => (
              <div key={c.name || idx} className="mgr-row">
                <div className="mgr-row__main">
                  <div className="mgr-row__name">{c.name}</div>
                  <div className="mgr-row__meta">
                    {c.is_address && <span className="badge badge--info" style={{ marginRight: 4 }}>주소지</span>}
                    {c.last && <span style={{ color: 'var(--ink-4)' }}>{c.last}</span>}
                  </div>
                </div>
                <div className="mgr-row__actions">
                  <button className="btn btn--secondary btn--sm" onClick={() => startEdit(c, idx)}>수정</button>
                </div>
              </div>
            ))}
          </div>

          {draft && (
            <div className="mgr-edit">
              <div className="mgr-edit__title">고객사 수정</div>
              <div className="form-grid">
                <div className="field col-span-2">
                  <label className="field__label" htmlFor="si-edit-cust-name">고객사명 <span className="field__req">*</span></label>
                  <input id="si-edit-cust-name" className="input" autoFocus value={draft.name}
                         onChange={(e) => { setDraft(d => ({ ...d, name: e.target.value })); setErr(''); }}/>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
                <input type="checkbox" checked={!!draft.is_address}
                       onChange={(e) => setDraft(d => ({ ...d, is_address: e.target.checked }))}
                       style={{ width: 15, height: 15, accentColor: 'var(--primary)' }}/>
                주소지 고객사 (is_address)
              </label>
              {err && <div role="alert" className="field__err"><Icon name="alert" size={12}/> {err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn btn--secondary btn--sm" onClick={() => { setDraft(null); setErr(''); }}>취소</button>
                <button className="btn btn--primary btn--sm" onClick={saveDraft}><Icon name="check" size={13}/> 저장</button>
              </div>
            </div>
          )}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ────────── 모델 추가 모달 ────────── */
function AddModelModal({ onClose, onAdded }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const [model, setModel] = useStateSI('');
  const [description, setDescription] = useStateSI('');
  const [power, setPower] = useStateSI('');
  const [err, setErr] = useStateSI('');

  const save = () => {
    const m = model.trim();
    if (!m) { setErr('모델 코드를 입력하세요'); return; }
    const result = window.PMDB.addMasterModel(m, description.trim(), power.trim());
    if (!result.ok) { setErr(result.msg); return; }
    onAdded && onAdded(m);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" ref={dialogRef} aria-labelledby="modal-add-model-title" style={{ width: 420, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h2 id="modal-add-model-title" className="modal__title">모델 추가</h2>
          <p className="modal__sub">신규 모델을 마스터 목록에 등록합니다</p>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field__label" htmlFor="si-add-model-code">모델 코드 <span className="field__req">*</span></label>
            <input id="si-add-model-code" className="input" autoFocus value={model}
                   onChange={(e) => { setModel(e.target.value); setErr(''); }}
                   placeholder="예: EGMI105001"/>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="si-add-model-desc">설명</label>
            <input id="si-add-model-desc" className="input" value={description}
                   onChange={(e) => { setDescription(e.target.value); setErr(''); }}
                   placeholder="예: 중속 · 1채널 · CCS1 단일"/>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="si-add-model-power">출력</label>
            <input id="si-add-model-power" className="input" value={power}
                   onChange={(e) => { setPower(e.target.value); setErr(''); }}
                   placeholder="예: 50kW"
                   onKeyDown={(e) => e.key === 'Enter' && save()}/>
          </div>
          {err && <div role="alert" className="field__err"><Icon name="alert" size={12}/> {err}</div>}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>취소</button>
          <button className="btn btn--primary" onClick={save}><Icon name="check" size={13}/> 추가</button>
        </div>
      </div>
    </div>
  );
}

/* ────────── 모델 관리 모달 ────────── */
function ModelManageModal({ onClose, onChanged }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const [list, setList] = useStateSI(() => window.PMDB.getModels());
  const [draft, setDraft] = useStateSI(null); // { idx, model, description, power }
  const [err, setErr] = useStateSI('');

  const reload = () => setList(window.PMDB.getModels());

  const startEdit = (m, idx) => { setErr(''); setDraft({ idx, model: m.model || '', description: m.description || '', power: m.power || '' }); };

  const saveDraft = () => {
    const mc = draft.model.trim();
    if (!mc) { setErr('모델 코드를 입력하세요'); return; }
    const result = window.PMDB.updateMasterModel(draft.idx, mc, draft.description.trim(), draft.power.trim());
    if (!result.ok) { setErr(result.msg); return; }
    reload();
    onChanged && onChanged();
    setDraft(null);
  };

  const remove = (idx) => {
    window.PMDB.deleteMasterModel(idx);
    reload();
    onChanged && onChanged();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" ref={dialogRef} aria-labelledby="modal-manage-model-title" style={{ width: 560, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h2 id="modal-manage-model-title" className="modal__title">모델 관리</h2>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="mgr-list">
            {list.length === 0 && (
              <div className="emptystate" style={{ padding: '20px 0' }}>
                <div className="emptystate__title">등록된 모델이 없습니다</div>
              </div>
            )}
            {list.map((m, idx) => (
              <div key={m.model + idx} className="mgr-row">
                <div className="mgr-row__main">
                  <div className="mgr-row__name">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{m.model}</span>
                    {m.power && <span style={{ marginLeft: 8, color: 'var(--ink-3)', fontSize: 12 }}>{m.power}</span>}
                  </div>
                  <div className="mgr-row__meta">
                    <span>{m.description || '—'}</span>
                    {m.power && <span style={{ color: 'var(--ink-4)' }}> · {m.power}</span>}
                  </div>
                </div>
                <div className="mgr-row__actions">
                  <button className="btn btn--secondary btn--sm" onClick={() => startEdit(m, idx)}>수정</button>
                  <button className="btn btn--ghost btn--sm btn--icon" aria-label="삭제" onClick={() => remove(idx)}><Icon name="x" size={14}/></button>
                </div>
              </div>
            ))}
          </div>
          {draft && (
            <div className="mgr-edit">
              <div className="mgr-edit__title">모델 수정</div>
              <div className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="si-edit-model-code">모델 코드 <span className="field__req">*</span></label>
                  <input id="si-edit-model-code" className="input" autoFocus value={draft.model}
                         onChange={(e) => { setDraft(d => ({ ...d, model: e.target.value })); setErr(''); }}/>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="si-edit-model-power">출력</label>
                  <input id="si-edit-model-power" className="input" value={draft.power}
                         onChange={(e) => { setDraft(d => ({ ...d, power: e.target.value })); setErr(''); }}/>
                </div>
                <div className="field col-span-2">
                  <label className="field__label" htmlFor="si-edit-model-desc">설명</label>
                  <input id="si-edit-model-desc" className="input" value={draft.description}
                         onChange={(e) => { setDraft(d => ({ ...d, description: e.target.value })); setErr(''); }}/>
                </div>
              </div>
              {err && <div role="alert" className="field__err"><Icon name="alert" size={12}/> {err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn btn--secondary btn--sm" onClick={() => { setDraft(null); setErr(''); }}>취소</button>
                <button className="btn btn--primary btn--sm" onClick={saveDraft}><Icon name="check" size={13}/> 저장</button>
              </div>
            </div>
          )}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ────────── CPO 운영사 추가 모달 ────────── */
function AddCpoModal({ onClose, onAdded }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const [name, setName] = useStateSI('');
  const [code, setCode] = useStateSI('');
  const [err, setErr] = useStateSI('');

  const save = () => {
    const n = name.trim();
    const c = code.trim().toUpperCase();
    if (!n) { setErr('CPO 운영사명을 입력하세요'); return; }
    if (!c) { setErr('코드를 입력하세요'); return; }
    const result = window.PMDB.addMasterCpo(n, c);
    if (!result.ok) { setErr(result.msg); return; }
    onAdded && onAdded(n);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" ref={dialogRef} aria-labelledby="modal-add-cpo-title" style={{ width: 400, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h2 id="modal-add-cpo-title" className="modal__title">CPO 운영사 추가</h2>
          <p className="modal__sub">신규 CPO 운영사를 마스터 목록에 등록합니다</p>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field__label" htmlFor="si-add-cpo-name">CPO 운영사명 <span className="field__req">*</span></label>
            <input id="si-add-cpo-name" className="input" autoFocus value={name}
                   onChange={(e) => { setName(e.target.value); setErr(''); }}
                   placeholder="예: 한국전력공사"/>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="si-add-cpo-code">코드 <span className="field__req">*</span></label>
            <input id="si-add-cpo-code" className="input" style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                   value={code}
                   onChange={(e) => { setCode(e.target.value); setErr(''); }}
                   placeholder="예: KEPCO"
                   onKeyDown={(e) => e.key === 'Enter' && save()}/>
          </div>
          {err && <div role="alert" className="field__err"><Icon name="alert" size={12}/> {err}</div>}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>취소</button>
          <button className="btn btn--primary" onClick={save}><Icon name="check" size={13}/> 추가</button>
        </div>
      </div>
    </div>
  );
}

/* ────────── CPO 운영사 관리 모달 ────────── */
function CpoManageModal({ onClose, onChanged }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const [list, setList] = useStateSI(() => window.PMDB.getCpos());
  const [draft, setDraft] = useStateSI(null);
  const [err, setErr] = useStateSI('');

  const reload = () => setList(window.PMDB.getCpos());
  const startEdit = (c, idx) => { setErr(''); setDraft({ idx, name: c.name, code: c.code }); };

  const saveDraft = () => {
    const n = draft.name.trim();
    const c = draft.code.trim().toUpperCase();
    if (!n) { setErr('CPO 운영사명을 입력하세요'); return; }
    if (!c) { setErr('코드를 입력하세요'); return; }
    const result = window.PMDB.updateMasterCpo(draft.idx, n, c);
    if (!result.ok) { setErr(result.msg); return; }
    reload();
    onChanged && onChanged();
    setDraft(null);
  };

  const remove = (idx) => {
    window.PMDB.deleteMasterCpo(idx);
    reload();
    onChanged && onChanged();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" ref={dialogRef} aria-labelledby="modal-manage-cpo-title" style={{ width: 520, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h2 id="modal-manage-cpo-title" className="modal__title">CPO 운영사 관리</h2>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="mgr-list">
            {list.length === 0 && (
              <div className="emptystate" style={{ padding: '20px 0' }}>
                <div className="emptystate__title">등록된 CPO 운영사가 없습니다</div>
              </div>
            )}
            {list.map((c, idx) => (
              <div key={c.code || idx} className="mgr-row">
                <div className="mgr-row__main">
                  <div className="mgr-row__name">{c.name}</div>
                  <div className="mgr-row__meta">
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{c.code}</span>
                  </div>
                </div>
                <div className="mgr-row__actions">
                  <button className="btn btn--secondary btn--sm" onClick={() => startEdit(c, idx)}>수정</button>
                  <button className="btn btn--ghost btn--sm btn--icon" aria-label="삭제" onClick={() => remove(idx)}><Icon name="x" size={14}/></button>
                </div>
              </div>
            ))}
          </div>
          {draft && (
            <div className="mgr-edit">
              <div className="mgr-edit__title">CPO 운영사 수정</div>
              <div className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="si-edit-cpo-name">CPO 운영사명 <span className="field__req">*</span></label>
                  <input id="si-edit-cpo-name" className="input" autoFocus value={draft.name}
                         onChange={(e) => { setDraft(d => ({ ...d, name: e.target.value })); setErr(''); }}/>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="si-edit-cpo-code">코드 <span className="field__req">*</span></label>
                  <input id="si-edit-cpo-code" className="input" style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                         value={draft.code}
                         onChange={(e) => { setDraft(d => ({ ...d, code: e.target.value })); setErr(''); }}/>
                </div>
              </div>
              {err && <div role="alert" className="field__err"><Icon name="alert" size={12}/> {err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn btn--secondary btn--sm" onClick={() => { setDraft(null); setErr(''); }}>취소</button>
                <button className="btn btn--primary btn--sm" onClick={saveDraft}><Icon name="check" size={13}/> 저장</button>
              </div>
            </div>
          )}
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ────────── 모델 선택 콤보 (충전속도 → 모델 2단계) ────────── */
function ModelInlineCombo({ value, onChange, options, placeholder, error }) {
  const [open, setOpen] = useStateSI(false);
  const [query, setQuery] = useStateSI('');
  const [highlight, setHighlight] = useStateSI(0);
  const ref = useRefSI(null);
  const menuIdRef = useRefSI(null);
  if (menuIdRef.current === null) menuIdRef.current = `model-combo-${Math.random().toString(36).slice(2, 7)}`;
  const menuId = menuIdRef.current;
  useEffectSI(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const filtered = query
    ? options.filter(o =>
        o.model.toLowerCase().includes(query.toLowerCase()) ||
        (o.description || '').toLowerCase().includes(query.toLowerCase()))
    : options;
  const selected = value ? options.find(o => o.model === value) : null;
  const displayLabel = open ? query : (selected ? `${selected.model}${selected.description ? ` — ${selected.description}` : ''}` : '');
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={displayLabel}
        onChange={(e) => { setQuery(e.target.value); setHighlight(0); if (!open) setOpen(true); }}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { setHighlight(h => Math.min(h + 1, filtered.length - 1)); e.preventDefault(); }
          if (e.key === 'ArrowUp')   { setHighlight(h => Math.max(h - 1, 0)); e.preventDefault(); }
          if (e.key === 'Enter' && open && filtered[highlight]) { onChange(filtered[highlight].model); setOpen(false); setQuery(''); e.preventDefault(); }
          if (e.key === 'Escape') { setOpen(false); setQuery(''); }
        }}
        placeholder={placeholder}
        style={{
          width: '100%', border: 'none', background: 'transparent',
          fontSize: 12, padding: '5px 8px', outline: 'none', boxSizing: 'border-box',
          color: error ? 'var(--danger-700)' : undefined,
        }}/>
      {open && filtered.length > 0 && (
        <div role="listbox" id={menuId} className="combo__menu"
             style={{ position: 'absolute', top: '100%', left: 0, minWidth: 260, zIndex: 'var(--z-lightbox)' }}>
          {filtered.map((o, idx) => (
            <div key={o.model} role="option" aria-selected={idx === highlight}
                 className={`combo__item${idx === highlight ? ' combo__item--active' : ''}`}
                 onMouseDown={(e) => { e.preventDefault(); onChange(o.model); setOpen(false); setQuery(''); }}
                 onMouseEnter={() => setHighlight(idx)}>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono, monospace)' }}>{o.model}</span>
              {o.description && <span className="combo__item__meta"> {o.description}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────── 다량 등록 테이블 셀 인라인 콤보 ────────── */
function BulkInlineCombo({ value, onChange, options, placeholder, error, ariaLabel }) {
  const [open, setOpen] = useStateSI(false);
  const [highlight, setHighlight] = useStateSI(0);
  const ref = useRefSI(null);
  const menuIdRef = useRefSI(null);
  if (menuIdRef.current === null) menuIdRef.current = `bulk-combo-${Math.random().toString(36).slice(2, 7)}`;
  const menuId = menuIdRef.current;
  useEffectSI(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const opts = options || [];
  const filtered = value
    ? opts.filter(o => String(o).toLowerCase().includes(String(value).toLowerCase()))
    : opts;
  const visible = filtered.slice(0, 8);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        role="combobox" aria-label={ariaLabel} aria-expanded={open}
        aria-haspopup="listbox" aria-controls={menuId}
        aria-activedescendant={open && visible[highlight] !== undefined ? `${menuId}-${highlight}` : undefined}
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); setHighlight(0); setOpen(true); }}
        onFocus={() => opts.length && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { setHighlight(h => Math.min(h + 1, visible.length - 1)); e.preventDefault(); }
          if (e.key === 'ArrowUp')   { setHighlight(h => Math.max(h - 1, 0)); e.preventDefault(); }
          if (e.key === 'Enter' && open && visible[highlight] !== undefined) { onChange(String(visible[highlight])); setOpen(false); e.preventDefault(); }
          if (e.key === 'Escape')    setOpen(false);
        }}
        placeholder={placeholder}
        style={{
          width: '100%', border: 'none', background: 'transparent',
          fontFamily: 'var(--font-mono)', fontSize: 12,
          padding: '7px 8px', outline: 'none', boxSizing: 'border-box',
          color: error ? 'var(--danger-700)' : undefined,
        }}
      />
      {open && visible.length > 0 && (
        <div role="listbox" id={menuId} className="combo__menu"
             style={{ position: 'absolute', top: '100%', left: 0, minWidth: 160, zIndex: 'var(--z-lightbox)' }}>
          {visible.map((o, i) => (
            <div key={String(o) + i} id={`${menuId}-${i}`} role="option" aria-selected={i === highlight}
                 className={`combo__item${i === highlight ? ' combo__item--active' : ''}`}
                 onMouseDown={(e) => { e.preventDefault(); onChange(String(o)); setOpen(false); }}
                 onMouseEnter={() => setHighlight(i)}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────── 모델 선택 모달 (충전속도 → 모델 코드 + 설명) ────────── */
function ModelSelectModal({ onClose, onSelect, powerOptions, modelsByPower, currentModel, currentPower }) {
  window.useLockScroll();
  const dialogRef = window.useModalKeyboard(onClose);
  const [selectedPower, setSelectedPower] = useStateSI(currentPower || '');

  const models = selectedPower ? (modelsByPower[selectedPower] || []) : [];

  return (
    <div className="modal-backdrop" ref={dialogRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-model-select-title" style={{ width: 480, maxWidth: '94vw' }}>
        <div className="modal__head">
          <h2 id="modal-model-select-title" className="modal__title">모델 선택</h2>
          <p className="modal__sub">충전속도를 선택한 후 모델을 클릭하세요</p>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="chips" style={{ flexWrap: 'wrap', gap: 6 }}>
            {powerOptions.map(p => (
              <button key={p} type="button"
                      className={`chip ${selectedPower === p ? 'chip--active' : ''}`}
                      onClick={() => setSelectedPower(p)}>
                {p}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 360, overflowY: 'auto' }}>
            {!selectedPower ? (
              <div className="emptystate" style={{ padding: '20px 0' }}>
                <div className="emptystate__title">충전속도를 선택하세요</div>
                <div className="emptystate__sub">선택한 충전속도에 해당하는 모델 목록이 표시됩니다</div>
              </div>
            ) : models.length === 0 ? (
              <div className="emptystate" style={{ padding: '20px 0' }}>
                <div className="emptystate__title">해당 충전속도의 모델이 없습니다</div>
              </div>
            ) : models.map(m => (
              <button key={m.model} type="button"
                      onClick={() => onSelect(m.model, selectedPower)}
                      className={`model-select-item ${currentModel === m.model ? 'model-select-item--active' : ''}`}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13, color: 'var(--ink-1)' }}>{m.model}</div>
                  {m.description && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{m.description}</div>}
                </div>
                {currentModel === m.model && <Icon name="check" size={14} style={{ color: 'var(--primary)', flexShrink: 0 }}/>}
              </button>
            ))}
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

window.SalesInputScreen = SalesInputScreen;
