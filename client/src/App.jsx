// WPP Auto Sender - Interface Estável v6
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Users, 
  Settings, 
  Play, 
  PlayCircle,
  Plus, 
  Trash2, 
  Smartphone, 
  Sun, 
  Moon,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LayoutDashboard,
  Clock,
  Globe,
  Bell,
  Menu,
  X,
  LogOut,
  ChevronDown,
  ChevronUp,
  Calendar
} from 'lucide-react';
import logoImg from './assets/logo.png';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [status, setStatus] = useState({ isReady: false, qrCodeData: null });
  const [contacts, setContacts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [selectedTestContact, setSelectedTestContact] = useState('');
  const [settings, setSettings] = useState({
    morningPrompt: "",
    nightPrompt: "",
    morningTime: '08:00',
    nightTime: '20:00',
    apiUrl: 'https://api.servicesbr.duckdns.org'
  });
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const API_BASE = settings?.apiUrl || 'https://api.servicesbr.duckdns.org';

  const getAuthHeader = () => {
    try {
      const auth = sessionStorage.getItem('whatsapp_auth');
      return auth ? { Authorization: `Basic ${auth}` } : {};
    } catch (e) { return {}; }
  };

  useEffect(() => {
    const savedApiUrl = localStorage.getItem('whatsapp_api_url');
    if (savedApiUrl) setSettings(s => ({ ...s, apiUrl: savedApiUrl }));
    const savedAuth = sessionStorage.getItem('whatsapp_auth');
    if (savedAuth) setIsLoggedIn(true);
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchData();
      const interval = setInterval(() => {
        fetchStatus();
        fetchLogs();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, settings.apiUrl]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await axios.post(`${settings.apiUrl}/login`, loginForm);
      if (res.data?.success) {
        const authString = btoa(`${loginForm.username}:${loginForm.password}`);
        sessionStorage.setItem('whatsapp_auth', authString);
        setIsLoggedIn(true);
      } else {
        alert('Credenciais inválidas.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('whatsapp_auth');
    setIsLoggedIn(false);
  };

  const fetchData = async () => {
    try {
      const config = { headers: getAuthHeader() };
      const [contactsRes, settingsRes, logsRes] = await Promise.all([
        axios.get(`${API_BASE}/contacts`, config).catch(e => ({ data: [] })),
        axios.get(`${API_BASE}/settings`, config).catch(e => ({ data: null })),
        axios.get(`${API_BASE}/logs`, config).catch(e => ({ data: [] }))
      ]);

      if (contactsRes.status === 401 || settingsRes.status === 401 || logsRes.status === 401) {
         handleLogout();
         return;
      }

      setContacts(Array.isArray(contactsRes.data) ? contactsRes.data : []);
      if (settingsRes.data) setSettings(prev => ({ ...prev, ...settingsRes.data }));
      setLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
    } catch (err) {}
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/status`, { headers: getAuthHeader() });
      if (res.data) setStatus(res.data);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/logs`, { headers: getAuthHeader() });
      if (Array.isArray(res.data)) setLogs(res.data);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
    }
  };

  const addContact = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/contacts`, newContact, { headers: getAuthHeader() });
      setNewContact({ name: '', phone: '' });
      fetchData();
    } catch (err) { alert('Erro'); }
  };

  const removeContact = async (phone) => {
    if (!confirm('Excluir?')) return;
    try {
      await axios.delete(`${API_BASE}/contacts/${phone}`, { headers: getAuthHeader() });
      fetchData();
    } catch (err) { alert('Erro'); }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE}/settings`, settings, { headers: getAuthHeader() });
      alert('Salvo');
    } catch (err) { alert('Erro'); }
    finally { setLoading(false); }
  };

  const triggerTest = async (type, contactPhone = null) => {
    try {
      await axios.post(`${API_BASE}/test-now`, { type, contactPhone }, { headers: getAuthHeader() });
      alert(`Solicitado!`);
    } catch (err) { alert('Erro'); }
  };

  const clearCache = async () => {
    if (!confirm('Deseja realmente limpar o cache de imagens e textos?')) return;
    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE}/clear-cache`, {}, { headers: getAuthHeader() });
      alert(res.data?.message || 'Cache limpo!');
    } catch (err) {
      alert('Erro ao limpar cache.');
    } finally {
      setLoading(false);
    }
  };

  const toggleLog = (id) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  if (!isLoggedIn) {
    return (
      <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="glass-card animate-in" style={{ width: '100%', maxWidth: '440px', padding: '3rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <img src={logoImg} alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '22px', marginBottom: '1.5rem', boxShadow: '0 12px 30px rgba(0,0,0,0.4)' }} />
            <h1 style={{ fontSize: '1.8rem' }}>WPP Auto Sender</h1>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group"><label>Usuário</label><input type="text" value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} required /></div>
            <div className="form-group" style={{ marginBottom: '2.25rem' }}><label>Senha</label><input type="password" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} required /></div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '54px' }} disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {isSidebarOpen && <div className="mobile-backdrop" onClick={() => setIsSidebarOpen(false)} />}
      <div className="mobile-toggle mobile-only"><button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>{isSidebarOpen ? <X /> : <Menu />}</button></div>

      <aside className={isSidebarOpen ? 'open' : ''}>
        <div className="logo"><img src={logoImg} alt="Logo" /> WPP Sender</div>
        <nav>
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}><LayoutDashboard size={18} /> Dashboard</div>
          <div className={`nav-item ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => { setActiveTab('contacts'); setIsSidebarOpen(false); }}><Users size={18} /> Contatos</div>
          <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}><Settings size={18} /> Ajustes</div>
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <div className="status-card">
            <div className={`status-badge ${status?.isReady ? 'online' : 'offline'}`}><div className="indicator" /> {status?.isReady ? 'Conectado' : 'Aguardando'}</div>
            <button onClick={handleLogout} className="logout-btn"><LogOut size={14} /> Sair</button>
          </div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <h1>{activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'contacts' ? 'Contatos' : 'Ajustes'}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {activeTab === 'dashboard' ? 'Gestão de envios.' : activeTab === 'contacts' ? 'Gerencie seus contatos.' : 'Configurações do sistema.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-outline"><Bell size={18} /></button>
            <button className="btn btn-primary" onClick={() => triggerTest('morning')}><Play size={16} /> Envio Imediato</button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="content-grid animate-in">
            <div className="col-8">
              <section className="glass-card compact-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header" style={{ marginBottom: status?.isReady && !status?.qrCodeData ? '0' : '1.5rem' }}>
                  <h2><Smartphone size={18} /> Instância</h2>
                  {status?.isReady && <div className="status-badge online" style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem' }}><div className="indicator" /> Online</div>}
                </div>
                {!status?.isReady && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem' }}>
                    {status?.qrCodeData ? (
                      <div className="qr-frame" style={{ background: 'white', padding: '1rem', borderRadius: '1rem', marginBottom: '1rem' }}><QRCodeSVG value={status.qrCodeData} size={160} level="H" /></div>
                    ) : <RefreshCw className="animate-spin" style={{ opacity: 0.2 }} />}
                    <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Escaneie o QR Code</p>
                  </div>
                )}
              </section>

              <section className="glass-card" style={{ padding: '1.5rem' }}>
                <div className="card-header" style={{ marginBottom: '1.5rem' }}><h2><Clock size={18} /> Histórico Recente</h2></div>
                <div className="compact-log-list">
                  {Array.isArray(logs) && logs.slice(0, 8).map(log => (
                    <div key={log.id} style={{ marginBottom: '0.5rem' }}>
                      <div className={`log-item ${expandedLogId === log.id ? 'active' : ''}`} onClick={() => toggleLog(log.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className={`dot ${log.status === 'success' ? 'success' : 'danger'}`} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{log.type === 'morning' ? 'Manhã' : 'Noite'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                          {expandedLogId === log.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                      {expandedLogId === log.id && (
                        <div className="log-expand-area animate-in">
                           <div className="detail-frame" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
                             {typeof log.details === 'string' ? log.details : log.details?.summary || 'Sem detalhes.'}
                           </div>
                           {Array.isArray(log.details?.successes) && log.details.successes.length > 0 && (
                             <div className="success-tag-grid">
                               {log.details.successes.map((s, idx) => <span key={idx} className="success-tag">{s.name || s.phone || 'Contato'}</span>)}
                             </div>
                           )}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!logs || logs.length === 0) && <p style={{ textAlign: 'center', opacity: 0.4, padding: '2rem' }}>Nenhum registro.</p>}
                </div>
              </section>
            </div>

            <div className="col-4">
              <section className="glass-card compact-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header"><h2><PlayCircle size={18} /> Envio Agora</h2></div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <select value={selectedTestContact} onChange={(e) => setSelectedTestContact(e.target.value)}>
                    <option value="">Todos</option>
                    {Array.isArray(contacts) && contacts.map(c => <option key={c.phone} value={c.phone}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button className="btn btn-primary" onClick={() => triggerTest('morning', selectedTestContact)}><Sun size={14} /> Manhã</button>
                  <button className="btn btn-primary" onClick={() => triggerTest('night', selectedTestContact)} style={{ background: 'var(--accent-secondary)' }}><Moon size={14} /> Noite</button>
                </div>
              </section>
              <section className="glass-card compact-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header"><h2><Calendar size={18} /> Agenda</h2></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="schedule-box"><span>{settings?.morningTime || '--:--'}</span></div>
                  <div className="schedule-box"><span>{settings?.nightTime || '--:--'}</span></div>
                </div>
              </section>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{contacts?.length || 0}</div>
              </section>

              <section className="glass-card compact-card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header"><h2><Trash2 size={18} /> Manutenção</h2></div>
                <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '1rem' }}>Limpar cache de imagens e mensagens.</p>
                <button className="btn btn-outline" onClick={clearCache} style={{ width: '100%', borderColor: 'rgba(255,100,100,0.2)', color: '#ff6b6b', padding: '0.5rem' }} disabled={loading}>
                  {loading ? 'Limpando...' : 'Limpar Cache'}
                </button>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="animate-in">
            <section className="glass-card" style={{ marginBottom: '2rem' }}>
              <div className="card-header"><h2><Plus size={18} /> Novo Contato</h2></div>
              <form onSubmit={addContact} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                <div><label>Nome</label><input value={newContact.name} onChange={(e) => setNewContact({...newContact, name: e.target.value})} required /></div>
                <div><label>WhatsApp</label><input value={newContact.phone} onChange={(e) => setNewContact({...newContact, phone: e.target.value})} required /></div>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </form>
            </section>
            <section className="glass-card">
              <div className="card-header"><h2><Users size={18} /> Lista ({contacts?.length || 0})</h2></div>
              <div className="contact-list">
                {Array.isArray(contacts) && contacts.map(c => (
                  <div key={c.phone} className="contact-row">
                    <div><p style={{ fontWeight: 700 }}>{c.name}</p><p style={{ fontSize: '0.8rem', opacity: 0.5 }}>{c.phone}</p></div>
                    <button onClick={() => removeContact(c.phone)} className="delete-btn"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="content-grid animate-in">
            <div className="col-8">
              <section className="glass-card">
                <div className="card-header"><h2><Settings size={18} /> Configurações</h2></div>
                <div className="form-group"><label>Prompt Manhã</label><textarea rows="3" value={settings?.morningPrompt || ''} onChange={(e) => setSettings({...settings, morningPrompt: e.target.value})} /></div>
                <div className="form-group"><label>Prompt Noite</label><textarea rows="3" value={settings?.nightPrompt || ''} onChange={(e) => setSettings({...settings, nightPrompt: e.target.value})} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div><label>Hora Manhã</label><input type="time" value={settings?.morningTime || ''} onChange={(e) => setSettings({...settings, morningTime: e.target.value})} /></div>
                  <div><label>Hora Noite</label><input type="time" value={settings?.nightTime || ''} onChange={(e) => setSettings({...settings, nightTime: e.target.value})} /></div>
                </div>
                <button className="btn btn-primary" onClick={saveSettings} style={{ width: '100%', marginTop: '2rem' }}>Salvar Tudo</button>
              </section>
            </div>
            <div className="col-4">
              <section className="glass-card"><div className="card-header"><h2><Globe size={18} /> Servidor</h2></div><input value={settings?.apiUrl || ''} onChange={(e) => setSettings({...settings, apiUrl: e.target.value})} /></section>
              
              <section className="glass-card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header"><h2><Trash2 size={18} /> Manutenção</h2></div>
                <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1rem' }}>Limpa o cache de imagens e mensagens geradas pela IA.</p>
                <button className="btn btn-outline" onClick={clearCache} style={{ width: '100%', borderColor: 'rgba(255,100,100,0.3)', color: '#ff6b6b' }} disabled={loading}>
                  {loading ? 'Limpando...' : 'Limpar Cache'}
                </button>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
