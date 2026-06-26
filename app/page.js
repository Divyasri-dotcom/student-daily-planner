'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ─── CONSTANTS ─── */
const REACTIONS = [
  { emoji: '✅', label: 'Clear' },
  { emoji: '🚧', label: 'Blocker' },
  { emoji: '🙌', label: 'Support' },
  { emoji: '👀', label: 'Follow up' },
];
const CONFIDENCE_OPTIONS = ['Low', 'Medium', 'High'];
const EMPTY_STANDUP = { yesterday: '', today: '', blockers: '', confidence: 'Medium' };
const AVATAR_COLORS = [
  'avatar-color-0', 'avatar-color-1', 'avatar-color-2',
  'avatar-color-3', 'avatar-color-4',
];
const VIEWS = ['Wall', 'Pulse', 'Actions'];

/* ─── HELPERS ─── */
async function api(url, { method = 'GET', body } = {}) {
  const opts = { method, headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function reactionCount(post, emoji) {
  return post.reactions?.filter((r) => r.emoji === emoji).length || 0;
}

function timeAgo(value) {
  if (!value) return 'Just now';
  try {
    const diff = Date.now() - new Date(value).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
  } catch {
    return 'Just now';
  }
}

function initials(user) {
  const src = user?.name || user?.username || 'SW';
  return src.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function avatarClass(username) {
  if (!username) return AVATAR_COLORS[0];
  let hash = 0;
  for (const ch of String(username)) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function riskClass(risk) {
  const l = String(risk || 'low').toLowerCase();
  if (l.includes('high')) return 'risk-high';
  if (l.includes('medium')) return 'risk-medium';
  return 'risk-low';
}

function blockersFor(post) {
  if (Array.isArray(post.blockers) && post.blockers.length) return post.blockers;
  if (post.blockersText && !/^none|no blocker|nil$/i.test(post.blockersText.trim())) return [post.blockersText];
  return [];
}

function healthClass(health) {
  if (!health) return 'health-healthy';
  const l = health.toLowerCase();
  if (l.includes('risk')) return 'health-risk';
  if (l.includes('attention')) return 'health-attention';
  return 'health-healthy';
}

/* ─── SUB-COMPONENTS ─── */

function Avatar({ user, size = '' }) {
  const name = user?.name || user?.username || '';
  return (
    <div className={`avatar ${size} ${avatarClass(user?.username)}`}>
      {initials(user)}
    </div>
  );
}

function StandupFields({ value, onChange, disabled = false }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="standup-fields">
      <div className="field-wrap">
        <span className="field-label-text">Yesterday — what did you complete?</span>
        <textarea
          className="composer-input"
          maxLength={650}
          disabled={disabled}
          placeholder="e.g. Finished the user auth module, reviewed 2 PRs, fixed the login bug."
          value={value.yesterday}
          onChange={(e) => set('yesterday', e.target.value)}
        />
      </div>
      <div className="field-wrap">
        <span className="field-label-text">Today — what are you working on?</span>
        <textarea
          className="composer-input"
          maxLength={650}
          disabled={disabled}
          placeholder="e.g. Integrate Groq AI analysis, write unit tests, deploy to staging."
          value={value.today}
          onChange={(e) => set('today', e.target.value)}
        />
      </div>
      <div className="field-wrap">
        <span className="field-label-text">Blockers — anything slowing you down?</span>
        <textarea
          className="composer-input short"
          maxLength={650}
          disabled={disabled}
          placeholder="e.g. Waiting for DB credentials. Or type 'None' if clear."
          value={value.blockers}
          onChange={(e) => set('blockers', e.target.value)}
        />
      </div>
      <div className="field-wrap">
        <span className="field-label-text">Confidence level</span>
        <div className="confidence-row">
          {CONFIDENCE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              className={`conf-btn ${value.confidence === opt ? `active-${opt.toLowerCase()}` : ''}`}
              onClick={() => set('confidence', opt)}
            >
              {opt === 'Low' ? '🔴 ' : opt === 'Medium' ? '🟡 ' : '🟢 '}{opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, user, onReact, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(true);
  const canManage = user && String(post.userId) === String(user.id);
  const blockers = blockersFor(post);

  return (
    <article className="post-card">
      {/* Header */}
      <div className="post-head">
        <div className="post-author-wrap">
          <Avatar user={post} size="sm" />
          <div>
            <div className="post-author">{post.name || `@${post.username}`}</div>
            <div className="post-time">@{post.username} · {timeAgo(post.createdAt)} · Confidence: <strong style={{ color: post.confidence === 'High' ? '#4ade80' : post.confidence === 'Low' ? '#f87171' : '#fbbf24' }}>{post.confidence || 'Medium'}</strong></div>
          </div>
        </div>
        <div className="post-badges">
          <span className={`risk-pill ${riskClass(post.riskLevel)}`}>{post.riskLevel || 'Low'} risk</span>
          <span className="score-pill">⭐ {post.clarityScore}/10</span>
          {post.aiMode && post.aiMode !== 'Local fallback' && (
            <span className="ai-badge">✦ {post.aiMode}</span>
          )}
          {canManage && (
            <div className="post-actions">
              <button className="btn-edit" onClick={() => onEdit(post)}>Edit</button>
              <button className="btn-delete" onClick={() => onDelete(post._id)}>Delete</button>
            </div>
          )}
        </div>
      </div>

      {/* Standup Content */}
      <div className="standup-grid">
        <div className="standup-cell">
          <div className="cell-label">Yesterday</div>
          <div className="cell-text">{post.yesterday || '—'}</div>
        </div>
        <div className="standup-cell">
          <div className="cell-label">Today</div>
          <div className="cell-text">{post.today || '—'}</div>
        </div>
        <div className="standup-cell">
          <div className="cell-label">Blockers</div>
          <div className="cell-text">{post.blockersText || 'None'}</div>
        </div>
      </div>

      {/* AI Panel */}
      {post.summary && (
        <div className="ai-panel">
          <div>
            <div className="ai-panel-label">✦ AI Analysis</div>
            <div className="ai-summary">{post.summary}</div>
            {post.nextAction && <div className="ai-detail"><strong>Next action:</strong> {post.nextAction}</div>}
            {post.followUpQuestion && <div className="ai-detail"><strong>Follow-up:</strong> {post.followUpQuestion}</div>}
          </div>
          <div className="blocker-box">
            <div className="cell-label" style={{ marginBottom: 8 }}>Detected Blockers</div>
            {blockers.length > 0 ? (
              <div className="blocker-list">
                {blockers.map((b, i) => <div key={i} className="blocker-tag">{b}</div>)}
              </div>
            ) : (
              <div className="muted-text">✓ No blockers detected</div>
            )}
          </div>
        </div>
      )}

      {/* Reactions */}
      <div className="reaction-row">
        {REACTIONS.map(({ emoji, label }) => (
          <button
            key={emoji}
            className="reaction-btn"
            disabled={!user}
            title={user ? `React with ${label}` : 'Sign in to react'}
            onClick={() => onReact(post._id, emoji)}
          >
            {emoji}
            <span className="reaction-count">{reactionCount(post, emoji) || ''}</span>
            <span className="reaction-label">{label}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

function EditBox({ post, onSave, onCancel, loading }) {
  const [standup, setStandup] = useState({
    yesterday: post.yesterday || '',
    today: post.today || '',
    blockers: post.blockersText || '',
    confidence: post.confidence || 'Medium',
  });

  return (
    <form
      className="edit-box"
      onSubmit={(e) => { e.preventDefault(); onSave(standup); }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>
        ✎ Editing standup — AI will re-analyze on save
      </div>
      <StandupFields value={standup} onChange={setStandup} disabled={loading} />
      <div className="edit-footer">
        <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
        <button
          type="submit"
          className="btn"
          disabled={loading || standup.yesterday.trim().length < 5 || standup.today.trim().length < 5}
        >
          {loading ? <><span className="spinner" /> Analyzing...</> : '💾 Save + Re-analyze'}
        </button>
      </div>
    </form>
  );
}

/* ─── VIEWS ─── */

function PulseView({ posts }) {
  const byUser = useMemo(() => {
    const map = new Map();
    posts.forEach((p) => {
      const key = p.username;
      if (!map.has(key)) map.set(key, { username: p.username, name: p.name, posts: [] });
      map.get(key).posts.push(p);
    });
    return [...map.values()].sort((a, b) => b.posts.length - a.posts.length);
  }, [posts]);

  if (byUser.length === 0) {
    return (
      <div className="empty-state view-section">
        <div className="empty-icon">📊</div>
        <div className="empty-title">No team data yet</div>
        <div className="empty-sub">Post standups to see team pulse analytics.</div>
      </div>
    );
  }

  return (
    <div className="view-section">
      <div className="feed-toolbar" style={{ marginBottom: 16 }}>
        <div className="feed-title">Team Pulse</div>
        <div className="feed-count">{byUser.length} members</div>
      </div>
      <div className="pulse-grid">
        {byUser.map((member) => {
          const avgClarity = Math.round(member.posts.reduce((s, p) => s + (Number(p.clarityScore) || 0), 0) / member.posts.length);
          const highRisk = member.posts.filter((p) => String(p.riskLevel).toLowerCase() === 'high').length;
          const blockerCount = member.posts.reduce((s, p) => s + blockersFor(p).length, 0);
          return (
            <div key={member.username} className="pulse-card">
              <div className="pulse-user">
                <Avatar user={member} size="sm" />
                <div>
                  <div className="pulse-name">{member.name || `@${member.username}`}</div>
                  <div className="pulse-handle">@{member.username}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--muted)' }}>Clarity score</span>
                  <span style={{ color: 'var(--blue2)', fontWeight: 700 }}>{avgClarity}/10</span>
                </div>
                <div className="pulse-score-bar">
                  <div className="pulse-score-fill" style={{ width: `${avgClarity * 10}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--muted)' }}>{member.posts.length} update{member.posts.length !== 1 ? 's' : ''}</span>
                  <span style={{ color: blockerCount > 0 ? '#f87171' : 'var(--muted)' }}>
                    {blockerCount > 0 ? `⚠ ${blockerCount} blocker${blockerCount > 1 ? 's' : ''}` : '✓ Clear'}
                  </span>
                </div>
                {highRisk > 0 && (
                  <div style={{ fontSize: 11, color: '#f87171', padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    🔴 {highRisk} high-risk update{highRisk > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionsView({ posts }) {
  const actions = useMemo(() => {
    const items = [];
    posts.forEach((p) => {
      if (p.nextAction && p.nextAction !== 'No team action yet.') {
        items.push({ type: 'action', icon: '⚡', title: p.nextAction, meta: `From @${p.username} · ${timeAgo(p.createdAt)}`, risk: p.riskLevel });
      }
      blockersFor(p).forEach((b) => {
        items.push({ type: 'blocker', icon: '🚧', title: b, meta: `Blocker from @${p.username}`, risk: 'high' });
      });
      if (p.followUpQuestion) {
        items.push({ type: 'question', icon: '❓', title: p.followUpQuestion, meta: `Follow-up for @${p.username}` });
      }
    });
    return items.slice(0, 20);
  }, [posts]);

  if (actions.length === 0) {
    return (
      <div className="empty-state view-section">
        <div className="empty-icon">⚡</div>
        <div className="empty-title">No actions yet</div>
        <div className="empty-sub">AI will extract actions, blockers and follow-ups from standups.</div>
      </div>
    );
  }

  return (
    <div className="view-section">
      <div className="feed-toolbar" style={{ marginBottom: 16 }}>
        <div className="feed-title">Action Items & Blockers</div>
        <div className="feed-count">{actions.length} items</div>
      </div>
      {actions.map((a, i) => (
        <div key={i} className="action-item">
          <div className="action-icon">{a.icon}</div>
          <div className="action-content">
            <div className="action-title">{a.title}</div>
            <div className="action-meta">{a.meta}</div>
          </div>
          {a.risk && (
            <span className={`risk-pill ${riskClass(a.risk)}`} style={{ flexShrink: 0 }}>{a.risk}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── MAIN PAGE ─── */
export default function Home() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [view, setView] = useState('Wall');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [standup, setStandup] = useState(EMPTY_STANDUP);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [digest, setDigest] = useState(null);
  const searchRef = useRef(null);

  /* ─── DERIVED STATS ─── */
  const totalReactions = useMemo(() => posts.reduce((s, p) => s + (p.reactions?.length || 0), 0), [posts]);
  const avgClarity = useMemo(() => {
    if (!posts.length) return 0;
    return Math.round(posts.reduce((s, p) => s + (Number(p.clarityScore) || 0), 0) / posts.length);
  }, [posts]);
  const openBlockers = useMemo(() => posts.reduce((s, p) => s + blockersFor(p).length, 0), [posts]);
  const highRiskCount = useMemo(() => posts.filter((p) => String(p.riskLevel).toLowerCase() === 'high').length, [posts]);
  const riskiestPost = useMemo(() => {
    const rank = { High: 3, Medium: 2, Low: 1 };
    return posts.reduce((best, p) => {
      if (!best) return p;
      return (rank[p.riskLevel] || 0) > (rank[best.riskLevel] || 0) ? p : best;
    }, null);
  }, [posts]);

  /* ─── FILTERED POSTS ─── */
  const filteredPosts = useMemo(() => {
    if (!search.trim()) return posts;
    const q = search.toLowerCase();
    return posts.filter((p) =>
      [p.username, p.name, p.yesterday, p.today, p.blockersText, p.summary, p.nextAction]
        .some((f) => String(f || '').toLowerCase().includes(q))
    );
  }, [posts, search]);

  /* ─── LOAD DATA ─── */
  const load = useCallback(async () => {
    const [me, data] = await Promise.all([api('/api/auth/me'), api('/api/posts')]);
    setUser(me.user || null);
    setPosts(data.posts || []);
  }, []);

  const loadDigest = useCallback(async () => {
    try {
      const data = await api('/api/digest');
      if (data.digest) setDigest(data.digest);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (active) setErr(e.message);
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => { active = false; };
  }, [load]);

  useEffect(() => {
    if (posts.length > 0) loadDigest();
  }, [posts.length, loadDigest]);

  /* keyboard shortcut: / to focus search */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ─── AUTH ─── */
  async function auth(e) {
    e.preventDefault();
    setErr('');
    if (!form.username.trim() || !form.password.trim()) {
      setErr('Please enter username and password.');
      return;
    }
    setLoading(true);
    try {
      const payload = mode === 'signup'
        ? form
        : { username: form.username, password: form.password };
      const data = await api(`/api/auth/${mode}`, { method: 'POST', body: payload });
      setUser(data.user);
      setForm({ name: '', username: '', password: '' });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setMode('login');
    setErr('');
  }

  /* ─── POSTS ─── */
  async function submit(e) {
    e.preventDefault();
    if (standup.yesterday.trim().length < 5 || standup.today.trim().length < 5) {
      setErr('Fill in Yesterday and Today fields (min 5 chars each).');
      return;
    }
    setErr('');
    setLoading(true);
    try {
      const data = await api('/api/posts', { method: 'POST', body: standup });
      setPosts((prev) => [data.post, ...prev.filter((p) => p._id !== data.post._id)]);
      setStandup(EMPTY_STANDUP);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(id, newStandup) {
    if (newStandup.yesterday.trim().length < 5 || newStandup.today.trim().length < 5) {
      setErr('Fill in Yesterday and Today before saving.');
      return;
    }
    setErr('');
    setLoading(true);
    try {
      const data = await api(`/api/posts/${id}`, { method: 'PUT', body: newStandup });
      setPosts((prev) => prev.map((p) => (p._id === id ? data.post : p)));
      setEditingId(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function removePost(id) {
    if (!confirm('Delete this standup update?')) return;
    setErr('');
    try {
      await api(`/api/posts/${id}`, { method: 'DELETE' });
      setPosts((prev) => prev.filter((p) => p._id !== id));
      if (editingId === id) setEditingId(null);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function react(id, emoji) {
    if (!user) return;
    try {
      const data = await api(`/api/posts/${id}/react`, { method: 'POST', body: { emoji } });
      setPosts((prev) => prev.map((p) => (p._id === id ? data.post : p)));
    } catch (e) {
      setErr(e.message);
    }
  }

  /* ─── RENDER ─── */
  return (
    <main className="app-shell">
      {/* ── TOPBAR ── */}
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-lockup">
            <div className="brand-mark">S</div>
            <div className="brand-name">
              <span className="brand-kicker">Squad Phoenix</span>
              <span className="brand-title">Standup Wall</span>
            </div>
          </div>

          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              ref={searchRef}
              className="search-input"
              placeholder="Search standups, blockers, actions… (press /)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <nav className="quick-nav">
            {VIEWS.map((v) => (
              <button
                key={v}
                className={`nav-chip ${view === v ? 'active' : ''}`}
                onClick={() => setView(v)}
              >
                {v === 'Wall' ? '📋' : v === 'Pulse' ? '📊' : '⚡'} {v}
              </button>
            ))}
          </nav>

          <div className="account-strip">
            <div className="live-badge">
              <div className="live-dot" />
              Groq AI Live
            </div>
            {user ? (
              <button className="btn-ghost danger" onClick={logout}>
                Sign out @{user.username}
              </button>
            ) : (
              <button className="btn-ghost" onClick={() => setMode('login')}>
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN GRID ── */}
      <div className="main-grid">

        {/* ── LEFT RAIL ── */}
        <aside className="side-rail" style={{ display: 'grid', gap: 14 }}>
          {/* Profile */}
          <div className="card">
            <div className="profile-cover" />
            <div className="profile-body">
              <Avatar user={user} />
              <div className="profile-name">{user ? (user.name || `@${user.username}`) : 'Standup Wall'}</div>
              <div className="profile-handle">{user ? `@${user.username}` : 'Sign in to post your standup'}</div>
              <div className="profile-stats">
                <div className="stat-item">
                  <span className="stat-value">{posts.length}</span>
                  <span className="stat-label">Updates</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value" style={{ color: openBlockers > 0 ? '#f87171' : 'var(--blue2)' }}>{openBlockers}</span>
                  <span className="stat-label">Blockers</span>
                </div>
              </div>
            </div>
          </div>

          {/* Auth form */}
          {!user && (
            <div className="card">
              <form className="auth-card" onSubmit={auth}>
                <div className="segmented">
                  <button
                    type="button"
                    className={`seg-btn ${mode === 'login' ? 'active' : ''}`}
                    onClick={() => { setMode('login'); setErr(''); }}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${mode === 'signup' ? 'active' : ''}`}
                    onClick={() => { setMode('signup'); setErr(''); }}
                  >
                    Sign up
                  </button>
                </div>

                {err && <div className="alert">{err}</div>}

                {mode === 'signup' && (
                  <label className="field-label">
                    Full name
                    <input
                      className="input"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your full name"
                    />
                  </label>
                )}
                <label className="field-label">
                  Username
                  <input
                    className="input"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="your_username"
                    autoComplete="username"
                  />
                </label>
                <label className="field-label">
                  Password
                  <input
                    className="input"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                </label>
                <button
                  className="btn w-full"
                  disabled={loading}
                >
                  {loading
                    ? <><span className="spinner" /> Working...</>
                    : mode === 'login' ? '→ Enter Standup Wall' : '✓ Create Account'}
                </button>
              </form>
            </div>
          )}

          {/* Team Pulse mini */}
          <div className="card card-body">
            <div className="section-label">Team pulse</div>
            <div className="metric-grid">
              <div className="metric-tile">
                <span className="metric-val">{avgClarity || '—'}</span>
                <span className="metric-name">Avg clarity</span>
              </div>
              <div className="metric-tile">
                <span className="metric-val" style={{ color: highRiskCount > 0 ? '#f87171' : 'var(--blue2)' }}>{highRiskCount}</span>
                <span className="metric-name">High risk</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── FEED COLUMN ── */}
        <section style={{ minWidth: 0 }}>
          {/* Error (outside auth card) */}
          {err && view === 'Wall' && user && <div className="alert">{err}</div>}
          {booting && <div className="notice">⏳ Loading standup wall…</div>}

          {/* ── WALL VIEW ── */}
          {view === 'Wall' && (
            <div className="view-section">
              {/* Composer or Hero */}
              {user ? (
                <form className="composer-card" onSubmit={submit}>
                  <div className="composer-head">
                    <Avatar user={user} size="sm" />
                    <div className="composer-meta">
                      <h2>Post today&apos;s standup</h2>
                      <p>Groq AI (llama-3.3-70b) will analyze, score clarity, detect blockers and suggest next actions.</p>
                    </div>
                  </div>
                  <StandupFields value={standup} onChange={setStandup} disabled={loading} />
                  <div className="composer-footer">
                    <span className="char-count">
                      {standup.yesterday.length + standup.today.length + standup.blockers.length} / 1950 chars
                    </span>
                    <button
                      className="btn"
                      disabled={loading || standup.yesterday.trim().length < 5 || standup.today.trim().length < 5}
                    >
                      {loading
                        ? <><span className="spinner" /> Analyzing with AI...</>
                        : '✦ Post + Analyze'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="hero-card">
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--blue2)', marginBottom: 8 }}>
                      ✦ AI-Powered Daily Standup Board
                    </div>
                    <div className="hero-title">
                      Turn raw updates into summaries, risk signals & next actions.
                    </div>
                    <div className="hero-sub">Powered by Groq · llama-3.3-70b · Real-time AI</div>
                  </div>
                  <button className="btn" onClick={() => setMode('signup')}>
                    Get started →
                  </button>
                </div>
              )}

              {/* Feed */}
              <div className="feed-toolbar">
                <div className="feed-title">
                  {search ? `Results for "${search}"` : 'Live Feed'}
                </div>
                <div className="feed-count">
                  {filteredPosts.length} {search ? 'found' : 'updates'}
                </div>
              </div>

              {filteredPosts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">{search ? '🔍' : '📋'}</div>
                  <div className="empty-title">{search ? 'No results found' : 'No standup updates yet'}</div>
                  <div className="empty-sub">
                    {search ? `No standups match "${search}". Try a different search.` : 'Post the first standup and let AI create clarity for your team.'}
                  </div>
                </div>
              ) : (
                filteredPosts.map((post) =>
                  editingId === post._id ? (
                    <div key={post._id} className="post-card" style={{ marginBottom: 14 }}>
                      <div className="post-author-wrap" style={{ marginBottom: 12 }}>
                        <Avatar user={post} size="sm" />
                        <div>
                          <div className="post-author">{post.name || `@${post.username}`}</div>
                          <div className="post-time">Editing update…</div>
                        </div>
                      </div>
                      <EditBox
                        post={post}
                        loading={loading}
                        onSave={(s) => saveEdit(post._id, s)}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <PostCard
                      key={post._id}
                      post={post}
                      user={user}
                      onReact={react}
                      onEdit={(p) => setEditingId(p._id)}
                      onDelete={removePost}
                    />
                  )
                )
              )}
            </div>
          )}

          {/* ── PULSE VIEW ── */}
          {view === 'Pulse' && <PulseView posts={posts} />}

          {/* ── ACTIONS VIEW ── */}
          {view === 'Actions' && <ActionsView posts={posts} />}
        </section>

        {/* ── RIGHT RAIL ── */}
        <aside className="right-rail" style={{ display: 'grid', gap: 14 }}>

          {/* AI Team Digest */}
          <div className="card card-body">
            <div className="section-label">✦ Today&apos;s AI Digest</div>
            {digest ? (
              <div className="digest-body">
                <div className={`health-badge ${healthClass(digest.teamHealth)}`}>
                  {digest.teamHealth === 'Healthy' ? '✅' : digest.teamHealth === 'Needs Attention' ? '⚠️' : '🔴'} {digest.teamHealth}
                </div>
                <div className="digest-headline">{digest.headline}</div>
                {digest.topWin && (
                  <div className="digest-row">
                    <span>🏆</span>
                    <div><strong>Win:</strong> {digest.topWin}</div>
                  </div>
                )}
                {digest.topRisk && (
                  <div className="digest-row">
                    <span>⚠️</span>
                    <div><strong>Risk:</strong> {digest.topRisk}</div>
                  </div>
                )}
                {digest.suggestion && (
                  <div className="digest-row">
                    <span>💡</span>
                    <div><strong>Suggestion:</strong> {digest.suggestion}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="muted-text">
                {posts.length === 0
                  ? 'Post standups to generate an AI team digest.'
                  : '⏳ Generating AI digest…'}
              </div>
            )}
          </div>

          {/* Highest attention */}
          <div className="card card-body">
            <div className="section-label">🔴 Highest Attention</div>
            {riskiestPost ? (
              <div className="spotlight-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span className={`risk-pill ${riskClass(riskiestPost.riskLevel)}`}>{riskiestPost.riskLevel} risk</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>@{riskiestPost.username}</span>
                </div>
                <p>{riskiestPost.summary}</p>
                {riskiestPost.nextAction && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', padding: '8px 10px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--ink2)' }}>Action: </strong>{riskiestPost.nextAction}
                  </div>
                )}
              </div>
            ) : (
              <div className="muted-text">No risk signals detected yet.</div>
            )}
          </div>

          {/* Wall Metrics */}
          <div className="card card-body">
            <div className="section-label">Wall Metrics</div>
            {[
              { label: 'Total updates', val: posts.length },
              { label: 'Avg clarity score', val: avgClarity ? `${avgClarity}/10` : '—' },
              { label: 'Open blockers', val: openBlockers, danger: openBlockers > 0 },
              { label: 'Total reactions', val: totalReactions },
              { label: 'High risk updates', val: highRiskCount, danger: highRiskCount > 0 },
            ].map(({ label, val, danger }) => (
              <div key={label} className="wall-metric-row">
                <span className="wall-metric-label">{label}</span>
                <span className="wall-metric-val" style={danger ? { color: '#f87171' } : {}}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
