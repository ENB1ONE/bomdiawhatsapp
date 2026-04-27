// WPP Auto Sender - Interface Premium v2
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
  const [expandedLogId, setExpandedLogId] = useState(null);

  const API_BASE = settings.apiUrl || 'https://api.servicesbr.duckdns.org';

  const getAuthHeader = () => {
    const auth = sessionStorage.getItem('whatsapp_auth');
    return auth ? { Authorization: `Basic ${auth}` } : {};
  };

  useEffect(() => {
    const savedApiUrl = localStorage.getItem('whatsapp_api_url');
    if (savedApiUrl) {
      setSettings(s => ({ ...s, apiUrl: savedApiUrl }));
    }

    const savedAuth = sessionStorage.getItem('whatsapp_auth');
    if (savedAuth) {
      setIsLoggedIn(true);
    }
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
      localStorage.setItem('whatsapp_api_url', settings.apiUrl);
      
      const authString = btoa(`${loginForm.username}:${loginForm.password}`);
      const res = await axios.post(`${settings.apiUrl}/login`, loginForm);
      
      if (res.data.success) {
        sessionStorage.setItem('whatsapp_auth', authString);
        setIsLoggedIn(true);
      }
    } catch (err) {
      console.error('Login error:', err);
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
      console.error('Error fetching data:', err);
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

  const clearCache = async () => {
    if (!confirm('Limpar cache de hoje?')) return;
    try {
      setLoading(true);
      await axios.post(`${API_BASE}/clear-cache`, {}, { headers: getAuthHeader() });
      alert('Cache limpo!');
    } catch (err) {
      alert('Erro ao limpar cache');
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
            <p style={{ color: 'var(--text-secondary)' }}>Controle de Automação</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Usuário</label>
              <input 
                type="text" 
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label>Senha</label>
              <input 
                type="password" 
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '54px' }} disabled={loading}>
              {loading ? 'Acessando...' : 'Entrar no Sistema'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {/* Mobile Header Toggle */}
      <div style={{ 
        position: 'fixed', top: '1.5rem', left: '1.5rem', zIndex: 200, display: 'none'
      }} className="mobile-only">
        <button className="btn btn-outline" onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ padding: '0.75rem' }}>
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      <aside className={isSidebarOpen ? 'open' : ''}>
        <div className="logo">
          <img src={logoImg} alt="WPP Auto Sender" />
          WPP Auto Sender
        </div>
        
        <nav>
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}>
            <LayoutDashboard size={20} /> Dashboard
          </div>
          <div className={`nav-item ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => { setActiveTab('contacts'); setIsSidebarOpen(false); }}>
            <Users size={20} /> Contatos
          </div>
          <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}>
            <Settings size={20} /> Configurações
          </div>
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <div className="status-card">
            <div className={`status-badge ${status.isReady ? 'online' : 'offline'}`}>
              <div className="indicator" /> {status.isReady ? 'Online' : 'Aguardando QR'}
            </div>
            <button onClick={handleLogout} className="btn-outline" style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
               <LogOut size={14} /> Sair do Sistema
            </button>
          </div>
        </div>
      </aside>

      <main>
        <header className="animate-in">
          <div>
            <h1>
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'contacts' && 'Contatos'}
              {activeTab === 'settings' && 'Ajustes'}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {activeTab === 'dashboard' && 'Visão geral da sua automação diária.'}
              {activeTab === 'contacts' && 'Gerencie os destinatários das mensagens.'}
              {activeTab === 'settings' && 'Configure horários e prompts da IA.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-outline"><Bell size={20} /></button>
            <button className="btn btn-primary" onClick={() => document.getElementById('envio-imediato-section')?.scrollIntoView({ behavior: 'smooth' })}>
              <Play size={18} /> Envio Imediato
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="content-grid animate-in">
            <div className="col-8">
              <section className="glass-card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                <div className="card-header">
                  <h2><Smartphone className="text-accent" /> Status da Instância</h2>
                </div>
                {!status.isReady ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {status.qrCodeData ? (
                      <div className="qr-frame" style={{ background: 'white', padding: '1.5rem', borderRadius: '1.5rem' }}>
                        <QRCodeSVG value={status.qrCodeData} size={240} level="H" />
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <RefreshCw className="animate-spin" size={48} style={{ opacity: 0.2, marginBottom: '1.5rem' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>Conectando ao WhatsApp...</p>
                      </div>
                    )}
                    <p style={{ marginTop: '2rem', opacity: 0.7, maxWidth: '280px', textAlign: 'center', fontSize: '0.9rem' }}>
                      Abra o WhatsApp no celular, vá em Aparelhos Conectados e escaneie o QR Code.
                    </p>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ 
                      width: '100px', height: '100px', borderRadius: '50%', 
                      background: 'rgba(16, 185, 129, 0.1)', display: 'flex', 
                      alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem'
                    }}>
                      <CheckCircle2 size={50} color="var(--accent-primary)" />
                    </div>
                    <h3>WhatsApp Conectado</h3>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Sua automação está em execução.</p>
                  </div>
                )}
              </section>
            </div>
            
            <div className="col-4">
              <section id="envio-imediato-section" className="glass-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                  <h2><PlayCircle /> Envio Agora</h2>
                </div>
                <div className="form-group">
                  <label>Selecione um contato (opcional)</label>
                  <select value={selectedTestContact} onChange={(e) => setSelectedTestContact(e.target.value)}>
                    <option value="">Enviar para todos</option>
                    {contacts.map(c => <option key={c.phone} value={c.phone}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button className="btn btn-primary" onClick={() => triggerTest('morning', selectedTestContact)} style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                    <Sun size={16} /> Bom Dia
                  </button>
                  <button className="btn btn-primary" onClick={() => triggerTest('night', selectedTestContact)} style={{ padding: '0.75rem', fontSize: '0.85rem', background: 'var(--accent-secondary)' }}>
                    <Moon size={16} /> Boa Noite
                  </button>
                </div>
              </section>

              <section className="glass-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                  <h2><Clock /> Agenda</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="contact-row" style={{ background: 'rgba(245, 158, 11, 0.08)', border: 'none' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <Sun size={20} color="var(--warning)" />
                      <div><p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Bom Dia</p><p style={{ fontSize: '0.75rem', opacity: 0.6 }}>{settings.morningTime}</p></div>
                    </div>
                  </div>
                  <div className="contact-row" style={{ background: 'rgba(14, 165, 233, 0.08)', border: 'none' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <Moon size={20} color="var(--accent-secondary)" />
                      <div><p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Boa Noite</p><p style={{ fontSize: '0.75rem', opacity: 0.6 }}>{settings.nightTime}</p></div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="glass-card">
                <div className="card-header">
                  <h2><Users /> Audiência</h2>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ fontSize: '3rem', margin: '0.5rem 0' }}>{contacts.length}</h2>
                  <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Contatos cadastrados</p>
                </div>
              </section>
            </div>

            <div className="col-12">
              <section className="glass-card">
                <div className="card-header">
                  <h2><LayoutDashboard /> Histórico Recente</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {logs.length > 0 ? logs.map(log => (
                    <div key={log.id} className="contact-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                      <div 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          {log.status === 'success' ? <CheckCircle2 size={18} color="var(--success)" /> : <XCircle size={18} color="var(--danger)" />}
                          <div>
                            <p style={{ fontWeight: 600 }}>{log.type === 'morning' ? 'Bom Dia' : 'Boa Noite'}</p>
                            <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>{new Date(log.timestamp).toLocaleString('pt-BR')}</p>
                          </div>
                        </div>
                        <ChevronRight size={18} style={{ transform: expandedLogId === log.id ? 'rotate(90deg)' : 'none', transition: '0.3s' }} />
                      </div>
                      {expandedLogId === log.id && (
                        <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: 'rgba(0,0,0,0.15)', borderRadius: '1rem' }}>
                           <p style={{ fontSize: '0.85rem' }}>{typeof log.details === 'string' ? log.details : log.details?.summary}</p>
                           {log.details?.successes?.length > 0 && (
                             <p style={{ marginTop: '0.5rem', color: 'var(--success)', fontSize: '0.8rem' }}>Enviado com sucesso para {log.details.successes.length} contatos.</p>
                           )}
                        </div>
                      )}
                    </div>
                  )) : <p style={{ opacity: 0.4, textAlign: 'center' }}>Sem logs registrados.</p>}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="animate-in">
            <section className="glass-card" style={{ marginBottom: '2rem' }}>
              <div className="card-header"><h2><Plus /> Novo Contato</h2></div>
              <form onSubmit={addContact} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1.25rem', alignItems: 'end' }}>
                <div><label>Nome</label><input value={newContact.name} onChange={(e) => setNewContact({...newContact, name: e.target.value})} required placeholder="Ex: João" /></div>
                <div><label>WhatsApp</label><input value={newContact.phone} onChange={(e) => setNewContact({...newContact, phone: e.target.value})} required placeholder="55..." /></div>
                <button type="submit" className="btn btn-primary" style={{ height: '54px' }}>Adicionar</button>
              </form>
            </section>

            <section className="glass-card">
              <div className="card-header"><h2><Users /> Lista Atual ({contacts.length})</h2></div>
              <div className="contact-list">
                {contacts.map(c => (
                  <div key={c.phone} className="contact-row">
                    <div><p style={{ fontWeight: 700 }}>{c.name}</p><p style={{ fontSize: '0.8rem', opacity: 0.6 }}>{c.phone}</p></div>
                    <button onClick={() => removeContact(c.phone)} className="btn-outline" style={{ padding: '0.6rem', color: 'var(--danger)', borderRadius: '0.75rem' }}><Trash2 size={18} /></button>
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
                <div className="card-header"><h2><Settings /> IA Prompts</h2></div>
                <div className="form-group">
                  <label>Mensagem de Bom Dia</label>
                  <textarea rows="4" value={settings.morningPrompt} onChange={(e) => setSettings({...settings, morningPrompt: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Mensagem de Boa Noite</label>
                  <textarea rows="4" value={settings.nightPrompt} onChange={(e) => setSettings({...settings, nightPrompt: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                  <div><label>Horário Manhã</label><input type="time" value={settings.morningTime} onChange={(e) => setSettings({...settings, morningTime: e.target.value})} /></div>
                  <div><label>Horário Noite</label><input type="time" value={settings.nightTime} onChange={(e) => setSettings({...settings, nightTime: e.target.value})} /></div>
                </div>
                <button className="btn btn-primary" onClick={saveSettings} disabled={loading} style={{ width: '100%' }}>Salvar Alterações</button>
              </section>
            </div>
            <div className="col-4">
              <section className="glass-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header"><h2><Globe /> Endpoint</h2></div>
                <input value={settings.apiUrl} onChange={(e) => { setSettings({...settings, apiUrl: e.target.value}); localStorage.setItem('whatsapp_api_url', e.target.value); }} />
              </section>
              <section className="glass-card">
                <div className="card-header"><h2><Trash2 color="var(--danger)" /> Cache</h2></div>
                <button onClick={clearCache} className="btn-outline" style={{ width: '100%', color: 'var(--danger)' }}><RefreshCw size={14} style={{ marginRight: 8 }} /> Limpar Agora</button>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
