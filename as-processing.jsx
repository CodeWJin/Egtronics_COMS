// AS 처리 화면 — 2패널: 왼쪽 목록 + 오른쪽 상세 처리 패널

const { useState: useStateAP, useEffect: useEffectAP, useMemo: useMemoAP, useRef: useRefAP } = React;

// ── 메인 화면 ────────────────────────────────────────────────────
function AsProcessingScreen() {
  const s = window.useStore();
  const [statusFilter, setStatusFilter] = useStateAP('진행중');
  const [search, setSearch] = useStateAP('');

  const receptions = s.asReceptions || [];
  const selectedId = s.selectedAsId;

  const filtered = useMemoAP(() => {
    let list = receptions;
    if (statusFilter === '진행중') {
      list = list.filter(r => r.status !== '처리완료');
    } else if (statusFilter !== '전체') {
      list = list.filter(r => r.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(r =>
      (r.reception_no  || '').toLowerCase().includes(q) ||
      (r.customer_name || '').toLowerCase().includes(q) ||
      (r.station_id    || '').toLowerCase().includes(q) ||
      (r.fault_type    || '').toLowerCase().includes(q)
    );
    return list;
  }, [receptions, statusFilter, search]);

  const selected = receptions.find(r => r.id === selectedId) || null;

  const filterLabels = ['진행중', '전체', ...window.AS_STATUS_LIST];
  const counts = useMemoAP(() => {
    const c = {};
    c['전체'] = receptions.length;
    c['진행중'] = receptions.filter(r => r.status !== '처리완료').length;
    window.AS_STATUS_LIST.forEach(st => { c[st] = receptions.filter(r => r.status === st).length; });
    return c;
  }, [receptions]);

  return (
    <div className="screen" style={{ paddingBottom: 0 }}>
      <div className="screen__head" style={{ marginBottom: 12 }}>
        <h1 className="screen__title">AS 처리</h1>
        <button className="btn btn--ghost btn--sm" onClick={() => window.actions.setView('as-receipt')}>
          <Icon name="plus" size={13}/> 새 접수 등록
        </button>
      </div>

      <div className="as-split">
        {/* ── 왼쪽: 목록 ── */}
        <div className="as-split__list">
          {/* 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              className="input"
              style={{ fontSize: 13 }}
              placeholder="접수번호, 고객사, 충전소 ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {filterLabels.map(st => (
                <button
                  key={st}
                  className={`btn btn--sm ${statusFilter === st ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ fontSize: 12, padding: '3px 8px' }}
                  onClick={() => setStatusFilter(st)}>
                  {st}
                  <span style={{
                    marginLeft: 4, fontSize: 11, fontVariantNumeric: 'tabular-nums',
                    padding: '0 5px', borderRadius: 8,
                    background: statusFilter === st ? 'rgba(255,255,255,0.22)' : 'var(--surface-2)',
                  }}>
                    {counts[st] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 카드 목록 */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '40px 0', fontSize: 13 }}>
                해당하는 접수 건이 없습니다
              </div>
            ) : filtered.map(r => (
              <AsListCard
                key={r.id}
                r={r}
                active={r.id === selectedId}
                onClick={() => window.actions.selectAs(r.id)}
              />
            ))}
          </div>
        </div>

        {/* ── 오른쪽: 처리 패널 ── */}
        <div className="as-split__panel card" style={{ padding: 0 }}>
          {selected ? (
            <AsDetailPanel key={selected.id} reception={selected}/>
          ) : (
            <div className="as-empty-panel">
              <div className="as-empty-panel__icon" aria-hidden="true">📋</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-2)' }}>접수 건을 선택하세요</div>
              <div style={{ fontSize: 13 }}>왼쪽 목록에서 AS 건을 클릭하면 처리 패널이 열립니다</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 목록 카드 ────────────────────────────────────────────────────
function AsListCard({ r, active, onClick }) {
  return (
    <div
      className={`as-card ${active ? 'as-card--active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
    >
      <div className="as-card__header">
        <span className="as-card__no">{r.reception_no}</span>
        <AsPriorityBadge priority={r.priority}/>
        <AsStatusBadge status={r.status}/>
      </div>
      <div className="as-card__title">
        {r.customer_name || '고객사 미입력'} · {r.fault_type || '유형 미분류'}
      </div>
      <div className="as-card__meta">
        {r.station_id ? `충전소 ${r.station_id}` : '충전소 ID 없음'}
        {r.charger_no ? ` · ${r.charger_no}` : ''}
        {' · '}
        {(r.received_at || '').slice(0, 10)}
      </div>
    </div>
  );
}

// ── 처리 상세 패널 ───────────────────────────────────────────────
function AsDetailPanel({ reception: r }) {
  const s = window.useStore();
  const [tab, setTab] = useStateAP('process'); // 'process' | 'info' | 'log'

  const [form, setForm] = useStateAP({
    assignee:     r.assignee     || '',
    dispatch_date:r.dispatch_date|| '',
    status:       r.status       || '접수대기',
    action_type:  r.action_type  || '',
    action_detail:r.action_detail|| '',
    cost:         r.cost         || '',
    completed_at: r.completed_at || '',
    notes:        r.notes        || '',
  });
  const [memo, setMemo] = useStateAP('');
  const [busy, setBusy] = useStateAP(false);
  const [logs, setLogs] = useStateAP([]);
  const [photos, setPhotos] = useStateAP([]);

  useEffectAP(() => {
    setLogs(window.PMDB.getAsLogs(r.id));
    setPhotos(window.PMDB.getAsPhotos(r.id));
  }, [r.id]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const users = window.PMDB ? window.PMDB.getAllUsers() : [];
  const asUsers = users.filter(u => u.role === 'as' || u.role === 'admin');

  const handleSave = () => {
    setBusy(true);
    setTimeout(() => {
      const updStatus = form.status !== r.status ? form.status : undefined;
      const updCompleted = form.status === '처리완료' && !form.completed_at
        ? new Date().toISOString().replace('T', ' ').slice(0, 19)
        : form.completed_at;

      window.actions.updateAsReception(r.id, {
        ...form,
        completed_at: updCompleted,
      }, memo || '');

      if (updStatus) {
        setLogs(window.PMDB.getAsLogs(r.id));
      }
      setMemo('');
      setBusy(false);
    }, 300);
  };

  const isCompleted = r.status === '처리완료';

  const TABS = [
    { key: 'process', label: '처리 현황' },
    { key: 'info',    label: '접수 정보' },
    { key: 'log',     label: `처리 이력 (${logs.length})` },
    { key: 'photo',   label: `사진 (${photos.length})` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 패널 헤더 */}
      <div style={{
        padding: '14px 20px 0', borderBottom: '1px solid var(--border-1)',
        background: 'var(--surface)',
        borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)' }}>{r.reception_no}</span>
          <AsPriorityBadge priority={r.priority}/>
          <AsStatusBadge status={r.status}/>
          <div style={{ flex: 1 }} />
          <button className="btn btn--ghost btn--sm" onClick={() => window.actions.selectAs(null)} title="패널 닫기">
            <Icon name="x" size={14}/>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '6px 14px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer',
                color: tab === t.key ? 'var(--primary)' : 'var(--ink-3)',
                fontWeight: tab === t.key ? 700 : 400,
                borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -1, transition: 'all 0.14s',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

        {/* ── 처리 현황 탭 ── */}
        {tab === 'process' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {isCompleted && (
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--r-md)',
                background: 'var(--success-50)', border: '1px solid var(--success)',
                color: 'var(--success-700)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center',
              }}>
                <Icon name="check" size={14}/> 처리 완료된 건입니다. {r.completed_at && `(${r.completed_at.slice(0, 16)})`}
              </div>
            )}

            {/* 담당자 / 출동 예정일 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="field__label" htmlFor={`ap-${r.id}-assignee`}>담당자 배정</label>
                <select
                  id={`ap-${r.id}-assignee`}
                  className="select"
                  value={form.assignee}
                  onChange={(e) => set('assignee', e.target.value)}
                  disabled={isCompleted}>
                  <option value="">미배정</option>
                  {asUsers.map(u => (
                    <option key={u.user_id} value={u.user_id}>{u.name} ({window.ROLE_LABEL[u.role]})</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor={`ap-${r.id}-dispatch-date`}>출동 예정일</label>
                <input
                  id={`ap-${r.id}-dispatch-date`}
                  className="input"
                  type="date"
                  value={form.dispatch_date}
                  onChange={(e) => set('dispatch_date', e.target.value)}
                  disabled={isCompleted}
                />
              </div>
            </div>

            {/* 상태 변경 */}
            <div className="field">
              <label className="field__label">처리 상태</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {window.AS_STATUS_LIST.map(st => (
                  <button
                    key={st}
                    type="button"
                    className={`btn btn--sm ${form.status === st ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => !isCompleted && set('status', st)}
                    disabled={isCompleted && st !== '처리완료'}
                    style={{ opacity: isCompleted && st !== form.status ? 0.5 : 1 }}>
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* 조치 내용 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="field__label" htmlFor={`ap-${r.id}-action-type`}>조치 유형</label>
                <select
                  id={`ap-${r.id}-action-type`}
                  className="select"
                  value={form.action_type}
                  onChange={(e) => set('action_type', e.target.value)}
                  disabled={isCompleted}>
                  <option value="">선택</option>
                  {window.AS_ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor={`ap-${r.id}-cost`}>발생 비용 (원)</label>
                <input
                  id={`ap-${r.id}-cost`}
                  className="input"
                  placeholder="예: 150000"
                  value={form.cost}
                  onChange={(e) => set('cost', e.target.value)}
                  disabled={isCompleted}
                />
              </div>
            </div>

            <div className="field">
              <label className="field__label" htmlFor={`ap-${r.id}-action-detail`}>조치 상세 내용</label>
              <textarea
                id={`ap-${r.id}-action-detail`}
                className="textarea"
                rows={3}
                placeholder="조치 내용을 상세히 입력하세요"
                value={form.action_detail}
                onChange={(e) => set('action_detail', e.target.value)}
                disabled={isCompleted}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor={`ap-${r.id}-notes`}>비고</label>
              <textarea
                id={`ap-${r.id}-notes`}
                className="textarea"
                rows={2}
                placeholder="추가 메모"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                disabled={isCompleted}
              />
            </div>

            {!isCompleted && (
              <div className="field">
                <label className="field__label" htmlFor={`ap-${r.id}-memo`}>변경 사유 / 메모</label>
                <input
                  id={`ap-${r.id}-memo`}
                  className="input"
                  placeholder="상태 변경 시 기록할 메모 (선택)"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>
            )}

            {!isCompleted && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                {form.status !== '처리완료' && (
                  <button
                    className="btn btn--success"
                    disabled={busy}
                    onClick={() => {
                      set('status', '처리완료');
                      setBusy(true);
                      setTimeout(() => {
                        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
                        window.actions.updateAsReception(r.id, {
                          ...form,
                          status: '처리완료',
                          completed_at: form.completed_at || now,
                        }, memo || '처리 완료');
                        setLogs(window.PMDB.getAsLogs(r.id));
                        setMemo('');
                        setBusy(false);
                      }, 300);
                    }}>
                    <Icon name="check" size={14}/> 처리 완료
                  </button>
                )}
                <button className="btn btn--primary" disabled={busy} onClick={handleSave}>
                  {busy ? '저장 중…' : <><Icon name="check" size={13}/> 저장</>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 접수 정보 탭 ── */}
        {tab === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <InfoSection title="고객 · 충전기 정보">
              <InfoRow label="고객사"    value={r.customer_name}/>
              <InfoRow label="충전소명"  value={r.station_name}/>
              <InfoRow label="충전소 ID" value={r.station_id} mono/>
              <InfoRow label="충전기 번호" value={r.charger_no} mono/>
              {r.order_id && <InfoRow label="연관 오더" value={`#${r.order_id}`} mono/>}
            </InfoSection>

            <InfoSection title="고장 분류">
              <InfoRow label="고장 유형"  value={r.fault_type}/>
              <InfoRow label="긴급도"     value={<AsPriorityBadge priority={r.priority}/>}/>
              <InfoRow label="상세 증상"  value={r.fault_detail} multiline/>
            </InfoSection>

            <InfoSection title="접수 정보">
              <InfoRow label="신고자"      value={r.reporter_name}/>
              <InfoRow label="신고자 연락처" value={r.reporter_phone} mono/>
              <InfoRow label="접수 일시"   value={(r.received_at || '').slice(0, 16)}/>
              <InfoRow label="접수자"      value={r.received_by ? getUserDisplayNameAP(r.received_by) : ''}/>
            </InfoSection>
          </div>
        )}

        {/* ── 처리 이력 탭 ── */}
        {tab === 'log' && (
          <div>
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '40px 0', fontSize: 13 }}>
                처리 이력이 없습니다
              </div>
            ) : (
              <div className="as-log-timeline">
                {logs.map(log => (
                  <div key={log.id} className="as-log-item">
                    <div className="as-log-item__dot"/>
                    <div className="as-log-item__body">
                      <div className="as-log-item__title">
                        {log.from_status
                          ? <>{log.from_status} → <strong>{log.to_status}</strong></>
                          : <strong>{log.to_status}</strong>
                        }
                        {log.memo ? <span style={{ fontWeight: 400, color: 'var(--ink-2)', marginLeft: 8 }}>— {log.memo}</span> : null}
                      </div>
                      <div className="as-log-item__sub">
                        {log.changed_by && `${log.changed_by} · `}
                        {(log.changed_at || '').slice(0, 16)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 사진 탭 ── */}
        {tab === 'photo' && (
          <AsPhotoTab
            receptionId={r.id}
            photos={photos}
            onPhotosChange={(updated) => setPhotos(updated)}
          />
        )}
      </div>
    </div>
  );
}

function getUserDisplayNameAP(userId) {
  if (!userId) return '';
  const users = window.PMDB ? window.PMDB.getAllUsers() : [];
  const u = users.find(x => x.user_id === userId);
  return u ? u.name : userId;
}

// ── 접수 정보 탭 보조 컴포넌트 ───────────────────────────────────
function InfoSection({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, multiline }) {
  if (!value && value !== 0) value = <span style={{ color: 'var(--ink-5)' }}>—</span>;
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '9px 14px',
      borderBottom: '1px solid var(--border-1)', fontSize: 13,
      alignItems: multiline ? 'flex-start' : 'center',
    }}>
      <span style={{ width: 110, flexShrink: 0, color: 'var(--ink-3)', fontSize: 12 }}>{label}</span>
      <span style={{ fontFamily: mono ? 'var(--font-mono)' : 'inherit', whiteSpace: multiline ? 'pre-wrap' : 'normal' }}>
        {value}
      </span>
    </div>
  );
}

// ── 사진 첨부 탭 ─────────────────────────────────────────────────
function AsPhotoTab({ receptionId, photos, onPhotosChange }) {
  const fileInputRef = useRefAP(null);
  const [uploading, setUploading] = useStateAP(false);
  const [uploadErr, setUploadErr] = useStateAP('');
  const [lightbox, setLightbox] = useStateAP(null);    // { url, filename }
  const [deleteConfirm, setDeleteConfirm] = useStateAP(null); // photo.id

  const currentUserId = (window.__pm_store__ && window.__pm_store__.user)
    ? window.__pm_store__.user.user_id : '';

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setUploadErr('');
    setUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) { setUploadErr('이미지 파일만 업로드할 수 있습니다'); continue; }
        if (file.size > 10 * 1024 * 1024) { setUploadErr(`${file.name}: 10MB 이하 파일만 가능합니다`); continue; }
        await window.PMDB.addAsPhoto(receptionId, file, currentUserId);
        onPhotosChange(window.PMDB.getAsPhotos(receptionId));
      }
    } catch (err) {
      setUploadErr('업로드 실패: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo) => {
    setDeleteConfirm(null);
    try {
      await window.PMDB.deleteAsPhoto(photo.id, photo.storage_path);
      onPhotosChange(window.PMDB.getAsPhotos(receptionId));
    } catch (err) {
      setUploadErr('삭제 실패: ' + (err.message || '알 수 없는 오류'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 업로드 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          aria-hidden="true"
          onChange={handleFileChange}
        />
        <button
          className="btn btn--secondary"
          disabled={uploading}
          aria-label="사진 파일 선택하여 첨부"
          onClick={() => fileInputRef.current && fileInputRef.current.click()}>
          {uploading ? '업로드 중…' : <><Icon name="plus" size={13}/> 사진 첨부</>}
        </button>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          JPG · PNG · GIF 등 · 최대 10MB · 여러 장 선택 가능
        </span>
      </div>

      {uploadErr && (
        <div role="alert" style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', background: 'var(--danger-50)', color: 'var(--danger-700)', fontSize: 13 }}>
          {uploadErr}
        </div>
      )}

      {/* 썸네일 그리드 */}
      {photos.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: '48px 0', fontSize: 13 }}>
          첨부된 사진이 없습니다
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {photos.map(ph => (
            <div key={ph.id} className="photo-thumb"
              onClick={() => deleteConfirm !== ph.id && setLightbox({ url: ph.url, filename: ph.filename })}>
              <img
                src={ph.url}
                alt={`AS 첨부 사진 — ${ph.filename}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="photo-thumb__name">{ph.filename}</div>

              {deleteConfirm === ph.id ? (
                <div className="photo-thumb__confirm" onClick={(e) => e.stopPropagation()}>
                  <span>삭제할까요?</span>
                  <div className="photo-thumb__confirm-btns">
                    <button className="btn-ok" onClick={() => handleDelete(ph)}>확인</button>
                    <button className="btn-cancel" onClick={() => setDeleteConfirm(null)}>취소</button>
                  </div>
                </div>
              ) : (
                <button
                  className="photo-thumb__del"
                  title="삭제"
                  aria-label={`${ph.filename} 삭제`}
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(ph.id); }}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 라이트박스 */}
      {lightbox && (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-label="사진 크게 보기"
          aria-modal="true"
          onClick={() => setLightbox(null)}>
          <img
            className="photo-lightbox__img"
            src={lightbox.url}
            alt={`확대 보기 — ${lightbox.filename}`}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="photo-lightbox__name">{lightbox.filename}</div>
          <button
            className="photo-lightbox__close"
            aria-label="닫기"
            onClick={() => setLightbox(null)}>×</button>
        </div>
      )}
    </div>
  );
}

window.AsProcessingScreen = AsProcessingScreen;
