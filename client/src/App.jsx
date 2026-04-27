// WPP Auto Sender - Interface Ultra-Compact Taste Skill
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
  ChevronRight,
  Info
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
    morningPrompt: "Com fé e otimismo, gere uma mensagem calorosa de 'Bom Dia' para WhatsApp com encorajamento, saúde, esperança e emojis. Crie também um prompt em inglês de uma imagem matinal realista, vibrante e de paz. A imagem DEVE ser 100% visual, estritamente SEM textos ou letras.",
    nightPrompt: "Com fé e otimismo, gere uma mensagem calorosa de 'Boa Noite' para WhatsApp com encorajamento, saúde, esperança e emojis. Crie também um prompt em inglês de uma imagem noturna realista, aconchegante e de paz. A imagem DEVE ser 100% visual, estritamente SEM textos ou letras.",
    morningTime: '08:00',
    nightTime: '20:00',
    apiUrl: 'https://api.servicesbr.duckdns.org'
  });
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const API_BASE = settings.apiUrl || 'https://api.servicesbr.duckdns.org';

  const getAuthHeader = () => {
    const auth = sessionStorage.getItem('whatsapp_auth');
    return auth ? { Authorization: `Basic ${auth}` } : {};
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
  }, [settings.apiUrl, isLoggedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const authString = btoa(`${loginForm.username}:${loginForm.password}`);
      const res = await axios.post(`${settings.apiUrl}/login`, loginForm);
      if (res.data.success) {
        sessionStorage.setItem('whatsapp_auth', authString);
        setIsLoggedIn(true);
      }
    } catch (err) {
      alert('Falha na conexão ou credenciais inválidas.');
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
        axios.get(`${API_BASE}/contacts`, config),
        axios.get(`${API_BASE}/settings`, config),
        axios.get(`${API_BASE}/logs`, config)
      ]);
      setContacts(contactsRes.data);
      setSettings(prev => ({ ...prev, ...settingsRes.data }));
      setLogs(logsRes.data);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/status`, { headers: getAuthHeader() });
      setStatus(res.data);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/logs`, { headers: getAuthHeader() });
      setLogs(res.data);
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
    } catch (err) {
      alert('Erro ao adicionar contato');
    }
  };

  const removeContact = async (phone) => {
    if (!confirm('Excluir este contato?')) return;
    try {
      await axios.delete(`${API_BASE}/contacts/${phone}`, { headers: getAuthHeader() });
      fetchData();
    } catch (err) {
      alert('Erro ao remover contato');
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE}/settings`, settings, { headers: getAuthHeader() });
      alert('Configurações salvas!');
    } catch (err) {
      alert('Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  const triggerTest = async (type, contactPhone = null) => {
    try {
      await axios.post(`${API_BASE}/test-now`, { type, contactPhone }, { headers: getAuthHeader() });
      alert(`Envio de ${type === 'morning' ? 'Bom dia' : 'Boa noite'} solicitado!`);
    } catch (err) {
      alert('Erro ao iniciar envio');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="glass-card animate-in" style={{ width: '100%', maxWidth: '440px', padding: '3rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <img src={logoImg} alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '22px', marginBottom: '1.5rem', boxShadow: '0 12px 30px rgba(0,0,0,0.4)' }} />
            <h1>WPP Auto Sender</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Acesso Restrito</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group"><label>Usuário</label><input type="text" value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} required /></div>
            <div className="form-group" style={{ marginBottom: '2rem' }}><label>Senha</label><input type="password" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} required /></div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '54px' }} disabled={loading}>{loading ? 'Autenticando...' : 'Entrar'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {isSidebarOpen && <div className="mobile-backdrop" onClick={() => setIsSidebarOpen(false)} />}
      <div className="mobile-toggle mobile-only">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>{isSidebarOpen ? <X /> : <Menu />}</button>
      </div>

      <aside className={isSidebarOpen ? 'open' : ''}>
        <div className="logo"><img src={logoImg} alt="Logo" /> WPP Sender</div>
        <nav>
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}><LayoutDashboard size={18} /> Dashboard</div>
          <div className={`nav-item ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => { setActiveTab('contacts'); setIsSidebarOpen(false); }}><Users size={18} /> Contatos</div>
          <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}><Settings size={18} /> Ajustes</div>
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <div className="status-card">
            <div className={`status-badge ${status.isReady ? 'online' : 'offline'}`}><div className="indicator" /> {status.isReady ? 'Online' : 'Aguardando'}</div>
            <button onClick={handleLogout} className="logout-btn"><LogOut size={14} /> Sair</button>
          </div>
        </div>
      </aside>

      <main>
        <header>
          <div><h1>Dashboard</h1><p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Gestão de envios diários.</p></div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
             <button className="btn btn-outline"><Bell size={18} /></button>
             <button className="btn btn-primary" onClick={() => triggerTest('morning')}><Play size={16} /> Envio Manhã</button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="content-grid animate-in">
            {/* Esquerda: Status + Logs (Frame Compacto) */}
            <div className="col-8">
              {/* Status Compacto */}
              <section className="glass-card compact-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header" style={{ marginBottom: status.isReady && !status.qrCodeData ? '0' : '1.5rem' }}>
                  <h2><Smartphone size={18} /> Instância</h2>
                  {status.isReady && <div className="status-badge online" style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem' }}><div className="indicator" /> Conectado</div>}
                </div>
                {!status.isReady && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem' }}>
                    {status.qrCodeData ? (
                      <div className="qr-frame" style={{ background: 'white', padding: '1rem', borderRadius: '1rem', marginBottom: '1rem' }}>
                        <QRCodeSVG value={status.qrCodeData} size={160} level="H" />
                      </div>
                    ) : <RefreshCw className="animate-spin" style={{ opacity: 0.2 }} />}
                    <p style={{ fontSize: '0.8rem', opacity: 0.6, textAlign: 'center' }}>Escaneie para conectar</p>
                  </div>
                )}
              </section>

              {/* Histórico com Frame Lateral de Detalhes */}
              <div style={{ display: 'grid', gridTemplateColumns: selectedLog ? '1fr 1.2fr' : '1fr', gap: '1.5rem', transition: '0.4s ease' }}>
                <section className="glass-card" style={{ padding: '1.5rem' }}>
                  <div className="card-header" style={{ marginBottom: '1.5rem' }}><h2><LayoutDashboard size={18} /> Histórico</h2></div>
                  <div className="compact-log-list">
                    {logs.slice(0, 6).map(log => (
                      <div 
                        key={log.id} 
                        className={`log-item ${selectedLog?.id === log.id ? 'selected' : ''}`}
                        onClick={() => setSelectedLog(log)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {log.status === 'success' ? <CheckCircle2 size={14} color="var(--success)" /> : <XCircle size={14} color="var(--danger)" />}
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{log.type === 'morning' ? 'Manhã' : 'Noite'}</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {selectedLog && (
                  <section className="glass-card animate-in" style={{ padding: '1.5rem', border: '1px solid var(--accent-primary)' }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <h2><Info size={18} /> Detalhes</h2>
                      <X size={18} style={{ cursor: 'pointer' }} onClick={() => setSelectedLog(null)} />
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>{new Date(selectedLog.timestamp).toLocaleString('pt-BR')}</p>
                      <div className="detail-frame">
                        {typeof selectedLog.details === 'string' ? selectedLog.details : selectedLog.details?.summary}
                      </div>
                      {selectedLog.details?.successes?.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                          <p style={{ fontWeight: 700, fontSize: '0.75rem', marginBottom: '0.5rem', textTransform: 'uppercase', color: 'var(--success)' }}>Enviado para:</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {selectedLog.details.successes.slice(0, 10).map((s, idx) => (
                              <span key={idx} style={{ padding: '0.2rem 0.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.4rem', fontSize: '0.65rem' }}>{s}</span>
                            ))}
                            {selectedLog.details.successes.length > 10 && <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>+{selectedLog.details.successes.length - 10} mais</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>

            {/* Direita: Controles e Audiência */}
            <div className="col-4">
              <section className="glass-card compact-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header"><h2><PlayCircle size={18} /> Envio Agora</h2></div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <select value={selectedTestContact} onChange={(e) => setSelectedTestContact(e.target.value)} style={{ padding: '0.7rem', fontSize: '0.85rem' }}>
                    <option value="">Todos Contatos</option>
                    {contacts.map(c => <option key={c.phone} value={c.phone}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button className="btn btn-primary" onClick={() => triggerTest('morning', selectedTestContact)} style={{ padding: '0.6rem', fontSize: '0.8rem' }}><Sun size={14} /> Manhã</button>
                  <button className="btn btn-primary" onClick={() => triggerTest('night', selectedTestContact)} style={{ padding: '0.6rem', fontSize: '0.8rem', background: 'var(--accent-secondary)' }}><Moon size={14} /> Noite</button>
                </div>
              </section>

              <section className="glass-card compact-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header"><h2><Clock size={18} /> Agenda</h2></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="schedule-box"><Sun size={14} color="var(--warning)" /> <span>{settings.morningTime}</span></div>
                  <div className="schedule-box"><Moon size={14} color="var(--accent-secondary)" /> <span>{settings.nightTime}</span></div>
                </div>
              </section>

              <section className="glass-card compact-card">
                <div className="card-header"><h2><Users size={18} /> Audiência</h2></div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '2rem' }}>{contacts.length}</h2>
                  <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>cadastrados</span>
                </div>
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
                <button type="submit" className="btn btn-primary" style={{ height: '48px' }}>Adicionar</button>
              </form>
            </section>
            <section className="glass-card">
              <div className="card-header"><h2><Users size={18} /> Lista Atual ({contacts.length})</h2></div>
              <div className="contact-list">
                {contacts.map(c => (
                  <div key={c.phone} className="contact-row" style={{ padding: '1rem' }}>
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
                <div className="card-header"><h2><Settings size={18} /> IA Prompts</h2></div>
                <div className="form-group"><label>Manhã</label><textarea rows="3" value={settings.morningPrompt} onChange={(e) => setSettings({...settings, morningPrompt: e.target.value})} /></div>
                <div className="form-group"><label>Noite</label><textarea rows="3" value={settings.nightPrompt} onChange={(e) => setSettings({...settings, nightPrompt: e.target.value})} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div><label>Hora Manhã</label><input type="time" value={settings.morningTime} onChange={(e) => setSettings({...settings, morningTime: e.target.value})} /></div>
                  <div><label>Hora Noite</label><input type="time" value={settings.nightTime} onChange={(e) => setSettings({...settings, nightTime: e.target.value})} /></div>
                </div>
                <button className="btn btn-primary" onClick={saveSettings} style={{ width: '100%' }}>Salvar</button>
              </section>
            </div>
            <div className="col-4">
              <section className="glass-card"><div className="card-header"><h2><Globe size={18} /> API</h2></div><input value={settings.apiUrl} onChange={(e) => setSettings({...settings, apiUrl: e.target.value})} /></section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
