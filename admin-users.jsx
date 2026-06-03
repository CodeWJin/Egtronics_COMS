// 관리자 사용자 관리 화면

const { useState: useStateAM, useEffect: useEffectAM, useRef: useRefAM } = React;

const ROLE_OPTIONS = [
  { value: 'admin',      label: '관리자' },
  { value: 'sales',      label: '영업' },
  { value: 'production', label: '생산' },
];

const EMPTY_FORM = { user_id: '', password: '', name: '', role: 'sales', dept: '', phone: '', email: '' };

function UserFormModal({ mode, initial, onSave, onClose }) {
  const [form, setForm] = useStateAM(initial || EMPTY_FORM);
  const [errors, setErrors] = useStateAM({});
  const [showPw, setShowPw] = useStateAM(false);
  const isEdit = mode === 'edit';

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); }

  function validate() {
    const e = {};
    if (!isEdit && !form.user_id.trim()) e.user_id = '아이디를 입력하세요';
    if (!isEdit && !form.password.trim()) e.password = '초기 비밀번호를 입력하세요';
    if (!form.name.trim()) e.name = '이름을 입력하세요';
    if (!form.role) e.role = '역할을 선택하세요';
    return e;
  }

  function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave(form);
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="modal__title">{isEdit ? '사용자 수정' : '사용자 추가'}</span>
          <button className="btn btn--ghost btn--icon" onClick={onClose}><Icon name="x" size={18}/></button>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isEdit && (
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="field">
                <label className="field__label">아이디 <span className="field__req">*</span></label>
                <input className={`input ${errors.user_id ? 'input--error' : ''}`} value={form.user_id}
                  onChange={e => set('user_id', e.target.value)} placeholder="영문+숫자"/>
                {errors.user_id && <span className="field__err">{errors.user_id}</span>}
              </div>
              <div className="field">
                <label className="field__label">초기 비밀번호 <span className="field__req">*</span></label>
                <div className="input-group">
                  <input className={`input ${errors.password ? 'input--error' : ''}`}
                    type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={e => set('password', e.target.value)} placeholder="초기 비밀번호"/>
                  <button className="input-group__btn" type="button" onClick={() => setShowPw(v => !v)}>
                    {showPw ? '숨김' : '표시'}
                  </button>
                </div>
                {errors.password && <span className="field__err">{errors.password}</span>}
              </div>
            </div>
          )}
          {isEdit && (
            <div className="field">
              <label className="field__label">비밀번호 재설정 <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>(비워두면 변경 안함)</span></label>
              <div className="input-group">
                <input className="input" type={showPw ? 'text' : 'password'} value={form.password || ''}
                  onChange={e => set('password', e.target.value)} placeholder="새 비밀번호"/>
                <button className="input-group__btn" type="button" onClick={() => setShowPw(v => !v)}>
                  {showPw ? '숨김' : '표시'}
                </button>
              </div>
            </div>
          )}
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field">
              <label className="field__label">이름 <span className="field__req">*</span></label>
              <input className={`input ${errors.name ? 'input--error' : ''}`} value={form.name}
                onChange={e => set('name', e.target.value)} placeholder="홍길동"/>
              {errors.name && <span className="field__err">{errors.name}</span>}
            </div>
            <div className="field">
              <label className="field__label">역할 <span className="field__req">*</span></label>
              <select className={`select ${errors.role ? 'input--error' : ''}`} value={form.role}
                onChange={e => set('role', e.target.value)}>
                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {errors.role && <span className="field__err">{errors.role}</span>}
            </div>
          </div>
          <div className="field">
            <label className="field__label">부서</label>
            <input className="input" value={form.dept} onChange={e => set('dept', e.target.value)} placeholder="예) 영업부"/>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field">
              <label className="field__label">전화번호</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="010-0000-0000"/>
            </div>
            <div className="field">
              <label className="field__label">이메일</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="user@example.com"/>
            </div>
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>취소</button>
          <button className="btn btn--primary" onClick={handleSave}>
            <Icon name="check" size={14}/> {isEdit ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ user, onConfirm, onClose }) {
  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="modal__title">사용자 삭제</span>
          <button className="btn btn--ghost btn--icon" onClick={onClose}><Icon name="x" size={18}/></button>
        </div>
        <div className="modal__body">
          <p style={{ margin: 0, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--ink-1)' }}>{user.name}</strong> (@{user.user_id}) 계정을 삭제하시겠습니까?<br/>
            <span style={{ fontSize: 12.5, color: 'var(--danger)' }}>이 작업은 되돌릴 수 없습니다.</span>
          </p>
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={onClose}>취소</button>
          <button className="btn" style={{ background: 'var(--danger)', color: 'white', border: 'none' }} onClick={onConfirm}>
            <Icon name="alert" size={14}/> 삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminUsersScreen() {
  const s = window.useStore();
  const [users, setUsers] = useStateAM([]);
  const [modal, setModal] = useStateAM(null); // null | { mode: 'add' } | { mode: 'edit', user } | { mode: 'delete', user }
  const [search, setSearch] = useStateAM('');

  function reload() { setUsers(window.PMDB.getAllUsers()); }
  useEffectAM(() => { reload(); }, []);

  const filtered = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (u.name || '').toLowerCase().includes(q)
      || (u.user_id || '').toLowerCase().includes(q)
      || (u.dept || '').toLowerCase().includes(q)
      || (u.role || '').toLowerCase().includes(q);
  });

  function handleAdd(form) {
    const res = window.PMDB.addUser(form);
    if (!res.ok) { window.actions.flashToast(res.msg, 'error'); return; }
    window.actions.flashToast(`${form.name} 사용자가 추가되었습니다`);
    reload();
    setModal(null);
  }

  function handleEdit(form) {
    const res = window.PMDB.updateUser(modal.user.user_id, form);
    if (!res.ok) { window.actions.flashToast(res.msg, 'error'); return; }
    window.actions.flashToast(`${form.name} 정보가 수정되었습니다`);
    reload();
    setModal(null);
  }

  function handleDelete() {
    const res = window.PMDB.deleteUser(modal.user.user_id);
    if (!res.ok) { window.actions.flashToast(res.msg, 'error'); return; }
    window.actions.flashToast(`${modal.user.name} 계정이 삭제되었습니다`);
    reload();
    setModal(null);
  }

  const currentUserId = s.currentUser?.user_id;

  return (
    <div className="screen">
      <div className="screen__head">
        <div>
          <h1 className="screen__title">사용자 관리</h1>
          <p className="screen__sub">시스템 계정을 추가하고 역할·권한을 설정합니다</p>
        </div>
        <button className="btn btn--primary" onClick={() => setModal({ mode: 'add' })}>
          <Icon name="plus" size={14}/> 사용자 추가
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div className="toolbar">
          <div className="toolbar__search">
            <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)' }}/>
            <input className="input" style={{ paddingLeft: 32, height: 34 }} placeholder="이름·아이디·부서 검색"
              value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <span style={{ fontSize: 12.5, color: 'var(--ink-4)', marginLeft: 'auto' }}>총 {users.length}명</span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>이름</th>
                <th>아이디</th>
                <th>역할</th>
                <th>부서</th>
                <th>전화번호</th>
                <th>이메일</th>
                <th style={{ width: 96 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--ink-4)' }}>
                  {search ? '검색 결과가 없습니다' : '등록된 사용자가 없습니다'}
                </td></tr>
              )}
              {filtered.map(u => (
                <tr key={u.user_id} className="row--clickable" onClick={() => setModal({ mode: 'edit', user: u })}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-3)', border: '1px solid var(--border-1)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', flexShrink: 0 }}>
                        {(u.name || '?').slice(0, 1)}
                      </div>
                      <span className="cell-strong">{u.name}</span>
                      {u.user_id === currentUserId && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'var(--primary-50)', color: 'var(--primary-600)', fontWeight: 600 }}>본인</span>}
                    </div>
                  </td>
                  <td><span className="cell-mono">@{u.user_id}</span></td>
                  <td>
                    <span className="usermenu__role" data-role={u.role} style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 600 }}>
                      {window.ROLE_LABEL[u.role] || u.role}
                    </span>
                  </td>
                  <td className="cell-muted">{u.dept || '—'}</td>
                  <td className="cell-muted">{u.phone || '—'}</td>
                  <td className="cell-muted">{u.email || '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => setModal({ mode: 'edit', user: u })}>
                        <Icon name="edit" size={13}/>
                      </button>
                      <button className="btn btn--ghost btn--sm"
                        style={{ color: u.user_id === currentUserId ? 'var(--ink-5)' : 'var(--danger)' }}
                        disabled={u.user_id === currentUserId}
                        title={u.user_id === currentUserId ? '본인 계정은 삭제할 수 없습니다' : '삭제'}
                        onClick={() => setModal({ mode: 'delete', user: u })}>
                        <Icon name="trash" size={13}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 역할 안내 카드 */}
      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {ROLE_OPTIONS.map(r => (
          <div key={r.value} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="usermenu__role" data-role={r.value} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{r.label}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.6 }}>
              {r.value === 'admin' && '모든 탭 + 사용자 관리'}
              {r.value === 'sales' && '영업 입력 · 생산 대기 · 조회'}
              {r.value === 'production' && '생산 대기 · 생산 매핑 · 생산 완료 · 조회'}
            </div>
            <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500 }}>
              {users.filter(u => u.role === r.value).length}명
            </div>
          </div>
        ))}
      </div>

      {modal?.mode === 'add' && (
        <UserFormModal mode="add" initial={EMPTY_FORM} onSave={handleAdd} onClose={() => setModal(null)}/>
      )}
      {modal?.mode === 'edit' && (
        <UserFormModal mode="edit" initial={{ ...modal.user, password: '' }} onSave={handleEdit} onClose={() => setModal(null)}/>
      )}
      {modal?.mode === 'delete' && (
        <DeleteConfirmModal user={modal.user} onConfirm={handleDelete} onClose={() => setModal(null)}/>
      )}
    </div>
  );
}

window.AdminUsersScreen = AdminUsersScreen;
