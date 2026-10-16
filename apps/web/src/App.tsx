import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { api, type Document, type User } from './api';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<User>('/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  if (loading) return <main className="center">Loading workspace...</main>;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login onLogin={setUser} />} />
      <Route path="/*" element={user ? <Workspace user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('alice');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { onLogin(await api<User>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })); }
    catch (err) { setError(err instanceof Error ? err.message : 'Login failed'); }
    finally { setBusy(false); }
  };
  return <main className="login-screen">
    <div className="login-card">
      <div className="logo">M</div>
      <span className="eyebrow">NETWORK SECURITY LAB</span>
      <h1>Mini Office</h1><p className="muted">Sign in to access your workspace.</p>
      <form onSubmit={submit}>
        <label htmlFor="username">Username</label>
        <input id="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <p role="alert" className="error">{error}</p>}
        <button disabled={busy}>{busy ? 'Signing in...' : 'Sign in →'}</button>
      </form>
      <small>Isolated lab only · Demo users: alice / bob</small>
    </div>
  </main>;
}

function Workspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const logout = async () => {
    try { await api<void>('/auth/logout', { method: 'POST' }); onLogout(); navigate('/login', { replace: true }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Logout failed'); }
  };
  return <div className="shell">
    <aside className="sidebar">
      <Link className="brand" to="/dashboard"><span className="logo small">M</span> Mini Office</Link>
      <div className="nav-caption">WORKSPACE</div>
      <Link to="/dashboard" className="nav-link">⌂ &nbsp; Dashboard</Link>
      <Link to="/documents" className="nav-link">▤ &nbsp; My documents</Link>
      <div className="sidebar-bottom"><span className="avatar">{user.displayName[0]}</span><div><strong>{user.displayName}</strong><small>@{user.username}</small></div></div>
    </aside>
    <main className="content">
      <header className="topbar"><span>Lab workspace</span><button className="secondary" onClick={logout}>Sign out</button></header>
      {error && <p role="alert" className="error">{error}</p>}
      <Routes>
        <Route path="/dashboard" element={<Dashboard user={user} />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/:id" element={<DocumentEditor />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </main>
  </div>;
}

function Dashboard({ user }: { user: User }) {
  return <section className="page"><span className="eyebrow">YOUR WORKSPACE</span><h1>Welcome back, {user.displayName}</h1>
    <p className="muted">Your account has access to its own private documents.</p>
    <div className="cards"><div className="card"><h3>Private documents</h3><p>Read and edit files owned by your account.</p><Link className="inline-link" to="/documents">Open documents →</Link></div>
    <div className="card"><h3>Authenticated session</h3><p>This page requires a valid server-side session. Session policy changes belong to the defender.</p></div></div>
  </section>;
}

function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { api<Document[]>('/documents').then(setDocuments).catch(err => setError(String(err))); }, []);
  return <section className="page"><span className="eyebrow">FILES</span><h1>My documents</h1>
    <p className="muted">Only documents owned by the current account appear here.</p>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="card document-list">{documents.map(doc => <Link key={doc.id} className="document-row" to={`/documents/${doc.id}`}><span>▤ &nbsp; {doc.title}</span><span className="muted">Edit →</span></Link>)}
    {documents.length === 0 && !error && <p className="muted">No documents yet.</p>}</div>
  </section>;
}

function DocumentEditor() {
  const { id } = useParams();
  const [document, setDocument] = useState<Document | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!id) return;
    api<Document>(`/documents/${id}`).then(doc => { setDocument(doc); setTitle(doc.title); setContent(doc.content); }).catch(err => setMessage(String(err)));
  }, [id]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const updated = await api<Document>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify({ title, content }) });
      setDocument(updated); setMessage('Changes saved.');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Save failed'); }
    finally { setBusy(false); }
  };
  return <section className="page"><Link className="inline-link" to="/documents">← Back to documents</Link>
    <h1>{document?.title ?? 'Document'}</h1>
    {document && <form className="card editor" onSubmit={save}>
      <label htmlFor="doc-title">Title</label><input id="doc-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required />
      <label htmlFor="doc-content">Content</label><textarea id="doc-content" value={content} onChange={e => setContent(e.target.value)} rows={10} maxLength={10000} />
      <button disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
    </form>}
    {message && <p role="status" className="muted">{message}</p>}
  </section>;
}
