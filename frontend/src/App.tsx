import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  Activity,
  Server,
  Settings as SettingsIcon,
  Users,
  Code,
  Box,
  Cpu,
  RefreshCcw,
  Zap,
  Save,
  CheckCircle,
  Copy,
  Terminal,
  XCircle
} from 'lucide-react';
import './index.css';

// System Status Dashboard Component
const Dashboard = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    initialized: false,
    queueLength: 0,
    browserActive: false,
    pageActive: false,
    error: null as string | null
  });

  const fetchStats = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/admin/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      setStats({ ...data, error: null });
    } catch (err: any) {
      setStats(prev => ({ ...prev, error: err.message }));
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const isHealthy = stats.initialized && stats.browserActive && !stats.error;

  return (
    <div className="container slide-up">
      <div className="flex justify-between items-center mb-4 mt-8">
        <div>
          <h1 className="text-3xl font-bold header-title">System Overview</h1>
          <p className="text-secondary mt-4">Real-time metrics and administration controls</p>
        </div>
        <button className="btn btn-outline" onClick={fetchStats} disabled={isRefreshing}>
          <RefreshCcw className={`w - 4 h - 4 ${isRefreshing ? 'animate-spin' : ''} `} />
          Refresh Data
        </button>
      </div>

      {stats.error && (
        <div className="glass-panel" style={{ borderColor: 'var(--error)', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)' }}>
          <p className="text-error flex items-center gap-2">
            <XCircle className="w-5 h-5" /> {stats.error} - Is the backend running?
          </p>
        </div>
      )}

      <div className="dashboard-grid mt-8">
        {/* API Status Card */}
        <div className="glass-panel stat-card delay-100">
          <div className="flex justify-between items-center mb-4">
            <div className="stat-icon">
              <Activity className="w-6 h-6" />
            </div>
            <span className={`badge ${isHealthy ? 'badge-success' : ''} `} style={!isHealthy ? { background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)' } : {}}>
              <span className="status-indicator" style={!isHealthy ? { background: 'var(--error)', boxShadow: '0 0 8px var(--error)' } : { marginRight: '6px' }}></span>
              {isHealthy ? 'Operational' : 'Issues Detected'}
            </span>
          </div>
          <span className="stat-label">Browser Status</span>
          <span className="stat-value">{stats.browserActive ? 'Active' : 'Inactive'}</span>
          <p className={`${isHealthy ? 'text-success' : 'text-error'} text - sm flex items - center gap - 2 mt - 4`}>
            {isHealthy ? <Zap className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {stats.initialized ? 'System Initialized' : 'System Not Initialized'}
          </p>
        </div>

        {/* Requests Card */}
        <div className="glass-panel stat-card delay-200">
          <div className="flex justify-between items-center mb-4">
            <div className="stat-icon">
              <Server className="w-6 h-6" />
            </div>
          </div>
          <span className="stat-label">Page Status</span>
          <span className="stat-value">{stats.pageActive ? 'Ready' : 'Not Ready'}</span>
          <p className="text-success text-sm flex items-center gap-2 mt-4">
            Listening for prompts
          </p>
        </div>

        {/* Queue Card */}
        <div className="glass-panel stat-card delay-300">
          <div className="flex justify-between items-center mb-4">
            <div className="stat-icon">
              <Box className="w-6 h-6" />
            </div>
            {stats.queueLength > 0 && <span className="badge badge-success" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>Processing</span>}
          </div>
          <span className="stat-label">Current Queue</span>
          <span className="stat-value">{stats.queueLength}</span>
          <p className="text-secondary text-sm mt-4">
            Active pending jobs
          </p>
        </div>
      </div>
    </div>
  );
};

// Layout with Navigation
const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  return (
    <>
      <nav className="navbar">
        <div className="container flex justify-between items-center">
          <div className="logo-container">
            <Cpu className="w-8 h-8 logo-icon" />
            <span className="font-bold text-xl header-title">PromptBridge</span>
          </div>
          <div className="flex gap-2">
            <Link to="/" className={`nav - link ${location.pathname === '/' ? 'active' : ''} `}>Dashboard</Link>
            <Link to="/users" className={`nav - link ${location.pathname === '/users' ? 'active' : ''} `}>Users</Link>
            <Link to="/settings" className={`nav - link ${location.pathname === '/settings' ? 'active' : ''} `}>Settings</Link>
          </div>
          <div>
            <button className="btn btn-primary">
              Admin Console
            </button>
          </div>
        </div>
      </nav>
      <main className="fade-in">
        {children}
      </main>
    </>
  );
};

// Mock components for other routes
const UsersPage = () => (
  <div className="container mt-8 slide-up">
    <h1 className="text-3xl font-bold header-title mb-4">User Management</h1>
    <div className="glass-panel flex items-center justify-center p-8 text-secondary" style={{ minHeight: '300px' }}>
      <div className="text-center">
        <Users className="w-12 h-12 mx-auto mb-4" />
        <p>User administration module under construction</p>
      </div>
    </div>
  </div>
);

const SettingsPage = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ title: string, type: 'success' | 'error' } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const apiKey = "pb_test_8f92jkl31m0n4b5v6c7x8z9"; // Placeholder standard API key example

  const showToast = (title: string, type: 'success' | 'error') => {
    setToastMessage({ title, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveSession = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/admin/save-session', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to save session');

      showToast('Session Saved Successfully', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string, isKey = false) => {
    navigator.clipboard.writeText(text);
    if (isKey) {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      showToast('Copied to clipboard', 'success');
    }
  };

  return (
    <div className="container mt-8 slide-up relative">
      <h1 className="text-3xl font-bold header-title mb-4">System Settings</h1>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 1000,
          background: toastMessage.type === 'success' ? 'var(--success)' : 'var(--error)',
          color: 'white', padding: '1rem', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          animation: 'slideUp 0.3s ease forwards'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {toastMessage.title}
        </div>
      )}

      <div className="dashboard-grid mt-8">
        {/* Session Management */}
        <div className="glass-panel delay-100 flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Save className="w-5 h-5 text-accent-primary" />
              <h2 className="text-xl font-bold">Session Management</h2>
            </div>
            <p className="text-secondary text-sm mb-6">
              Manually save the current browser session state (Cookies and LocalStorage) to `session.json`.
              This will overwrite the existing file and allow the headful browser to stay logged in.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSaveSession}
            disabled={isSaving}
          >
            {isSaving ? (
              <><RefreshCcw className="w-4 h-4 animate-spin" /> Saving Session...</>
            ) : (
              <><Save className="w-4 h-4" /> Save Current Session</>
            )}
          </button>
        </div>

        {/* API Key Management */}
        <div className="glass-panel delay-200">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="w-5 h-5 text-accent-primary" />
            <h2 className="text-xl font-bold">API Key</h2>
          </div>
          <p className="text-secondary text-sm mb-4">
            Your current active API key for programmatic requests. Keep this secret.
          </p>
          <div className="flex items-center gap-2 p-3 bg-bg-primary rounded-lg border border-border-color">
            <code className="text-sm flex-1 text-text-primary" style={{ userSelect: 'all' }}>
              {apiKey}
            </code>
            <button
              className="btn btn-outline"
              style={{ padding: '0.25rem 0.5rem' }}
              onClick={() => copyToClipboard(apiKey, true)}
              title="Copy API Key"
            >
              {copiedKey ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Developer Integration */}
      <div className="glass-panel delay-300 mt-8 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="w-5 h-5 text-accent-primary" />
          <h2 className="text-xl font-bold">Integration Examples</h2>
        </div>
        <p className="text-secondary text-sm mb-6">
          How to integrate and call the `PromptBridge` API programmatically.
        </p>

        <div className="bg-bg-primary rounded-lg border border-border-color overflow-hidden">
          <div className="flex bg-bg-secondary border-b border-border-color p-2">
            <span className="text-sm font-bold ml-2">cURL</span>
          </div>
          <div className="p-4 relative hover-group">
            <pre className="text-sm text-text-secondary overflow-x-auto whitespace-pre-wrap">
              {`curl - X POST http://localhost:3000/chat \\
-H "Content-Type: application/json" \\
-d '{"prompt": "Hello! What is your purpose?"}'`}
            </pre>
            <button
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors"
              onClick={() => copyToClipboard(`curl - X POST http://localhost:3000/chat -H "Content-Type: application/json" -d '{"prompt": "Hello! What is your purpose?"}'`)}
            >
              <Copy className="w-4 h-4" />
            </button >
          </div >
        </div >

        <div className="bg-bg-primary rounded-lg border border-border-color overflow-hidden mt-4">
          <div className="flex bg-bg-secondary border-b border-border-color p-2">
            <span className="text-sm font-bold ml-2">Python (Requests)</span>
          </div>
          <div className="p-4 relative">
            <pre className="text-sm text-text-secondary overflow-x-auto whitespace-pre-wrap">
              {`import requests

response = requests.post(
    "http://localhost:3000/chat",
    json={"prompt": "Write a poem about the sea"}
)

print(response.json())`}
            </pre>
            <button
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors"
              onClick={() => copyToClipboard(`import requests\n\nresponse = requests.post(\n    "http://localhost:3000/chat",\n    json={"prompt": "Write a poem about the sea"}\n)\n\nprint(response.json())`)}
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div >
    </div >
  );
};


function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
