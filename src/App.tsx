import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  Activity,
  Server,
  Settings as SettingsIcon,
  Users,
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
  const isTogglingRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    isActive: false, // Default to false until fetched
    initialized: false,
    queueLength: 0,
    browserActive: false,
    pageActive: false,
    totalRequests24h: 0,
    error: null as string | null
  });
  const [logs, setLogs] = useState<any[]>([]);

  const fetchStats = async () => {
    if (isTogglingRef.current) return;
    setIsRefreshing(true);
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetch('/admin/status'),
        fetch('/admin/analytics')
      ]);

      if (!statusRes.ok) throw new Error('Failed to fetch status');

      const statusData = await statusRes.json();
      setStats({ ...statusData, error: null });

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }
    } catch (err: any) {
      setStats(prev => ({ ...prev, isActive: false, error: err.message }));
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleApi = async () => {
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    setIsRefreshing(true);
    try {
      if (stats.isActive) {
        // Active -> Stop -> Kills node process
        await fetch('/admin/stop', { method: 'POST' });
        setStats(prev => ({ ...prev, isActive: false, initialized: false, browserActive: false, pageActive: false, error: null }));
        setIsRefreshing(false);
        isTogglingRef.current = false;
      } else {
        // Dead -> Start -> Spawns node process
        await fetch('/__start-backend', { method: 'POST' });

        // Poll until the server is responsive (10 second timeout)
        let attempts = 0;
        const maxAttempts = 10;
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const res = await fetch('/admin/status');
            if (res.ok) {
              clearInterval(pollInterval);
              await fetchStats(); // Stops refreshing and updates state correctly
              isTogglingRef.current = false;
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setIsRefreshing(false);
              setStats(prev => ({ ...prev, error: 'Backend failed to start in 10 seconds' }));
              isTogglingRef.current = false;
            }
          } catch (e) {
            // Still booting
            if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setIsRefreshing(false);
              setStats(prev => ({ ...prev, error: 'Backend failed to start in 10 seconds' }));
              isTogglingRef.current = false;
            }
          }
        }, 1000); // Check every second for 10 seconds
      }
    } catch (err: any) {
      setStats(prev => ({ ...prev, error: err.message }));
      setIsRefreshing(false);
      isTogglingRef.current = false;
    }
  };

  const isHealthy = stats.initialized && stats.browserActive && !stats.error;

  return (
    <div className="container slide-up">
      <div className="flex justify-between items-center mb-4 mt-8">
        <div>
          <h1 className="text-3xl font-bold header-title">System Overview</h1>
          <p className="text-secondary mt-4">Real-time metrics and administration controls</p>
        </div>
        <div className="flex gap-4 items-center">
          <label className="switch-label cursor-pointer mr-2">
            <span className={isRefreshing ? 'text-secondary animate-pulse' : stats.isActive ? 'text-success' : 'text-secondary'}>
              {isRefreshing ? (stats.isActive ? 'Stopping API...' : 'Starting API...') : (stats.isActive ? 'API Active' : 'API Stopped')}
            </span>
            <div className={`switch ${isRefreshing ? 'loading cursor-not-allowed' : ''}`}>
              <input
                type="checkbox"
                checked={isRefreshing ? !stats.isActive : stats.isActive}
                onChange={toggleApi}
                disabled={isRefreshing}
              />
              <span className="slider"></span>
            </div>
          </label>
          <button className="btn btn-outline" onClick={fetchStats} disabled={isRefreshing}>
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
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
            {stats.pageActive ? (
              <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>Listening</span>
            ) : (
              <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>Idle</span>
            )}
          </div>
          <span className="stat-label">Total Requests (24h)</span>
          <span className="stat-value">{stats.totalRequests24h || 0}</span>
          <p className="text-secondary text-sm flex items-center gap-2 mt-4">
            Processed in last 24 hours
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
      <div className="mt-8 mb-4">
        <h2 className="text-2xl font-bold header-title mb-4">Recent Activity</h2>
        <div className="glass-panel flex-col gap-4">
          {logs.length === 0 ? (
            <p className="text-secondary text-sm text-center py-4">No recent activity detected.</p>
          ) : (
            logs.map((log: any, index: number) => {
              // Parse time 
              const logDate = new Date(log.createdAt);
              const now = new Date();
              const diffMs = now.getTime() - logDate.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              const timeStr = diffMins < 1 ? 'Just now' : diffMins === 1 ? '1 min ago' : diffMins < 60 ? `${diffMins} mins ago` : logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={log.id} className="flex justify-between items-center" style={{ padding: '1rem', borderBottom: index < logs.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                  <div className="flex items-center gap-4">
                    <div className="stat-icon" style={{
                      width: '36px', height: '36px', marginBottom: 0,
                      color: log.status === 'Completed' ? 'var(--success)' : log.status === 'Failed' ? 'var(--error)' : 'var(--accent-primary)',
                      background: log.status === 'Completed' ? 'rgba(16, 185, 129, 0.1)' : log.status === 'Failed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)'
                    }}>
                      {log.status === 'Completed' ? <CheckCircle className="w-4 h-4" /> : log.status === 'Failed' ? <XCircle className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-bold flex items-center gap-2">
                        Request {log.status}
                        {log.durationMs && <span className="text-xs text-secondary font-normal ml-2">({(log.durationMs / 1000).toFixed(1)}s)</span>}
                      </p>
                      <p className="text-sm text-secondary truncate max-w-md">"{log.prompt}"</p>
                    </div>
                  </div>
                  <span className="text-sm text-secondary whitespace-nowrap">{timeStr}</span>
                </div>
              );
            })
          )}
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
