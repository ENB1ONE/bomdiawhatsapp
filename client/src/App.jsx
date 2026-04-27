// WPP Auto Sender - Interface Liquid Glass v5 (Final Hardening)
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
  Info,
  Calendar,
  ChevronRight
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
  const [selectedLog, setSelectedLog] = useState(null);
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
    try {
      const savedApiUrl = localStorage.getItem('whatsapp_api_url');
      if (savedApiUrl) setSettings(s => ({ ...s, apiUrl: savedApiUrl }));
      const savedAuth = sessionStorage.getItem('whatsapp_auth');
      if (savedAuth) setIsLoggedIn(true);
    } catch (e) { console.error("Load state error", e); }
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
        alert(res.data?.error || 'Usuário ou senha incorretos.');
      }
    } catch (err) {
      alert('Falha na conexão com o servidor. Verifique a URL da API.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('whatsapp_auth');
    setIsLoggedIn(false);
    setSelectedLog(null);
  };

  const fetchData = async () => {
    try {
      const config = { headers: getAuthHeader() };
      const [contactsRes, settingsRes, logsRes] = await Promise.all([
        axios.get(`${API_BASE}/contacts`, config).catch(e => ({ data: [], status: e.response?.status })),
        axios.get(`${API_BASE}/settings`, config).catch(e => ({ data: null, status: e.response?.status })),
        axios.get(`${API_BASE}/logs`, config).catch(e => ({ data: [], status: e.response?.status }))
      ]);

      if (contactsRes.status === 401 || settingsRes.status === 401 || logsRes.status === 401) {
         handleLogout();
         return;
      }

      setContacts(Array.isArray(contactsRes.data) ? contactsRes.data : []);
      if (settingsRes.data) setSettings(prev => ({ ...prev, ...settingsRes.data }));
      setLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
    } catch (err) {
      console.error("Fetch error", err);
    }
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
    } catch (err) { alert('Erro ao adicionar'); }
  };

  const removeContact = async (phone) => {
    if (!confirm('Excluir?')) return;
    try {
      await axios.delete(`${API_BASE}/contacts/${phone}`, { headers: getAuthHeader() });
      fetchData();
    } catch (err) { alert('Erro ao remover'); }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE}/settings`, settings, { headers: getAuthHeader() });
      alert('Salvo!');
    } catch (err) { alert('Erro ao salvar'); }
    finally { setLoading(false); }
  };

  const triggerTest = async (type, contactPhone = null) => {
    try {
      await axios.post(`${API_BASE}/test-now`, { type, contactPhone }, { headers: getAuthHeader() });
      alert(`Envio solicitado!`);
    } catch (err) { alert('Erro ao iniciar'); }
  };

  if (!isLoggedIn) {
    return (
      <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="glass-card animate-in" style={{ width: '100%', maxWidth: '440px', padding: '3rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <img src={logoImg} alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '22px', marginBottom: '1.5rem', boxShadow: '0 12px 30px rgba(0,0,0,0.4)' }} />
            <h1 style={{ fontSize: '1.8rem' }}>WPP Auto Sender</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Acesso ao Painel</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group"><label>Usuário</label><input type="text" value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} required /></div>
            <div className="form-group" style={{ marginBottom: '2.25rem' }}><label>Senha</label><input type="password" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} required /></div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '54px' }} disabled={loading}>{loading ? 'Entrando...' : 'Acessar Agora'}</button>
          </form>
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
             <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Versão 5.0 - Hardened Build</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="glass-card modal-content animate-in" onClick={e => e.stopPropagation()}>
            <div className="card-header" style={{ marginBottom: '1.5rem' }}>
              <h2><Info size={20} color="var(--accent-primary)" /> Detalhes do Envio</h2>
              <button className="close-btn" onClick={() => setSelectedLog(null)}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '1rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '0.75rem', background: selectedLog?.type === 'morning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(14, 165, 233, 0.1)' }}>
                    {selectedLog?.type === 'morning' ? <Sun size={24} color="var(--warning)" /> : <Moon size={24} color="var(--accent-secondary)" />}
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>{selectedLog?.type === 'morning' ? 'Bom Dia' : 'Boa Noite'}</p>
                    <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>{selectedLog?.timestamp ? new Date(selectedLog.timestamp).toLocaleString('pt-BR') : '-'}</p>
                  </div>
               </div>
               <div className="detail-frame" style={{ maxHeight: '200px' }}>
                 <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Conteúdo Gerado</p>
                 {typeof selectedLog?.details === 'string' ? selectedLog.details : selectedLog?.details?.summary || 'Sem detalhes.'}
               </div>
               {Array.isArray(selectedLog?.details?.successes) && selectedLog.details.successes.length > 0 && (
                 <div>
                   <p style={{ fontWeight: 700, fontSize: '0.75rem', marginBottom: '0.75rem', textTransform: 'uppercase', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <CheckCircle2 size={14} /> Enviado para {selectedLog.details.successes.length} contatos:
                   </p>
                   <div className="success-tag-grid">
                     {selectedLog.details.successes.map((s, idx) => <span key={idx} className="success-tag">{s}</span>)}
                   </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

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
            <button onClick={handleLogout} className="logout-btn"><LogOut size={14} /> Sair do Painel</button>
          </div>
        </div>
      </aside>

      <main>
        <header>
          <div><h1>Dashboard</h1><p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Controle central.</p></div>
          <div style={{ display: 'flex', gap: '0.75rem' }}><button className="btn btn-outline"><Bell size={18} /></button><button className="btn btn-primary" onClick={() => triggerTest('morning')}><Play size={16} /> Forçar Envio</button></div>
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
                    <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Aponte a câmera do WhatsApp</p>
                  </div>
                )}
              </section>

              <section className="glass-card" style={{ padding: '1.5rem' }}>
                <div className="card-header" style={{ marginBottom: '1.5rem' }}><h2><Clock size={18} /> Histórico</h2><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Últimos 6</span></div>
                <div className="compact-log-list">
                  {(logs || []).slice(0, 6).map(log => (
                    <div key={log.id} className="log-item" onClick={() => setSelectedLog(log)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><div className={`dot ${log.status === 'success' ? 'success' : 'danger'}`} /><span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{log.type === 'morning' ? 'Envio Matinal' : 'Envio Noturno'}</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><span style={{ fontSize: '0.75rem', opacity: 0.4 }}>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</span><ChevronRight size={14} opacity={0.3} /></div>
                    </div>
                  ))}
                  {(!logs || logs.length === 0) && <p style={{ textAlign: 'center', opacity: 0.4, padding: '2rem' }}>Nenhum registro.</p>}
                </div>
              </section>
            </div>

            <div className="col-4">
              <section className="glass-card compact-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header"><h2><PlayCircle size={18} /> Envio Imediato</h2></div>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <select value={selectedTestContact} onChange={(e) => setSelectedTestContact(e.target.value)}>
                    <option value="">Todos os Contatos</option>
                    {Array.isArray(contacts) && contacts.map(c => <option key={c.phone} value={c.phone}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button className="btn btn-primary" onClick={() => triggerTest('morning', selectedTestContact)} style={{ background: 'linear-gradient(135deg, var(--warning), #d97706)', color: 'white' }}><Sun size={14} /> Manhã</button>
                  <button className="btn btn-primary" onClick={() => triggerTest('night', selectedTestContact)} style={{ background: 'linear-gradient(135deg, var(--accent-secondary), #0284c7)', color: 'white' }}><Moon size={14} /> Noite</button>
                </div>
              </section>
              <section className="glass-card compact-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header"><h2><Calendar size={18} /> Agenda</h2></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="schedule-box"><Sun size={14} color="var(--warning)" /> <span>{settings?.morningTime || '--:--'}</span></div>
                  <div className="schedule-box"><Moon size={14} color="var(--accent-secondary)" /> <span>{settings?.nightTime || '--:--'}</span></div>
                </div>
              </section>
              <section className="glass-card compact-card">
                <div className="card-header"><h2><Users size={18} /> Base</h2></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><h2 style={{ fontSize: '2.5rem', fontWeight: 800 }}>{contacts?.length || 0}</h2><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.2 }}>Ativos</div></div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="animate-in">
            <section className="glass-card" style={{ marginBottom: '2rem' }}>
              <div className="card-header"><h2><Plus size={18} /> Novo</h2></div>
              <form onSubmit={addContact} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                <div><label>Nome</label><input value={newContact.name} onChange={(e) => setNewContact({...newContact, name: e.target.value})} required /></div>
                <div><label>WhatsApp</label><input value={newContact.phone} onChange={(e) => setNewContact({...newContact, phone: e.target.value})} required placeholder="55..." /></div>
                <button type="submit" className="btn btn-primary" style={{ height: '48px' }}>Salvar</button>
              </form>
            </section>
            <section className="glass-card">
              <div className="card-header"><h2><Users size={18} /> Lista ({contacts?.length || 0})</h2></div>
              <div className="contact-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {Array.isArray(contacts) && contacts.map(c => (
                  <div key={c.phone} className="contact-row" style={{ padding: '0.85rem 1rem' }}>
                    <div><p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.name}</p><p style={{ fontSize: '0.75rem', opacity: 0.5 }}>{c.phone}</p></div>
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
                <div className="card-header"><h2><Settings size={18} /> Ajustes AI</h2></div>
                <div className="form-group"><label>Manhã</label><textarea rows="3" value={settings?.morningPrompt || ''} onChange={(e) => setSettings({...settings, morningPrompt: e.target.value})} /></div>
                <div className="form-group" style={{ marginTop: '1rem' }}><label>Noite</label><textarea rows="3" value={settings?.nightPrompt || ''} onChange={(e) => setSettings({...settings, nightPrompt: e.target.value})} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem', marginBottom: '2rem' }}>
                  <div><label>Hora (Manhã)</label><input type="time" value={settings?.morningTime || ''} onChange={(e) => setSettings({...settings, morningTime: e.target.value})} /></div>
                  <div><label>Hora (Noite)</label><input type="time" value={settings?.nightTime || ''} onChange={(e) => setSettings({...settings, nightTime: e.target.value})} /></div>
                </div>
                <button className="btn btn-primary" onClick={saveSettings} style={{ width: '100%', height: '50px' }}>Salvar</button>
              </section>
            </div>
            <div className="col-4">
              <section className="glass-card"><div className="card-header"><h2><Globe size={18} /> Servidor</h2></div><input value={settings?.apiUrl || ''} onChange={(e) => setSettings({...settings, apiUrl: e.target.value})} /></section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
