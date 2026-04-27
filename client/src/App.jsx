// WhatsApp AutoGreetings - Interface Premium de Gerenciamento
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
  MoreVertical
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [status, setStatus] = useState({ isReady: false, qrCodeData: null });
  const [contacts, setContacts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedTestContact, setSelectedTestContact] = useState('');
  const [settings, setSettings] = useState({
    morningPrompt: 'Aja como uma tia ou avó carinhosa, otimista e de muita fé. Gere uma mensagem de "Bom Dia" calorosa para o WhatsApp com palavras de encorajamento, saúde e esperança (use emojis). Além do texto, crie a descrição detalhada (em inglês) de uma imagem matinal vibrante, iluminada e realista que traga paz. A imagem DEVE conter o texto "Bom Dia" de forma legível e artística.',
    nightPrompt: 'Aja como uma tia ou avó carinhosa e de muita fé. Gere uma mensagem de "Boa Noite" serena para o WhatsApp com palavras de gratidão pelo dia, proteção e descanso (use emojis). Além do texto, crie a descrição detalhada (em inglês) de uma imagem noturna aconchegante, com estrelas ou luz suave que traga tranquilidade. A imagem DEVE conter o texto "Boa Noite" de forma legível.',
    morningTime: '08:00',
    nightTime: '20:00',
    apiUrl: 'https://api.servicesbr.duckdns.org'
  });
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const API_BASE = settings.apiUrl || 'https://api.servicesbr.duckdns.org';

  // Helper para cabeçalho de autenticação
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
      // Primeiro salvar a URL da API caso tenha sido alterada na tela de login
      localStorage.setItem('whatsapp_api_url', settings.apiUrl);
      
      const authString = btoa(`${loginForm.username}:${loginForm.password}`);
      const res = await axios.post(`${settings.apiUrl}/login`, loginForm);
      
      if (res.data.success) {
        sessionStorage.setItem('whatsapp_auth', authString);
        setIsLoggedIn(true);
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Falha na conexão ou credenciais inválidas. Verifique a URL da API e os dados de acesso.');
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

  const handleApiUrlChange = (url) => {
    setSettings({ ...settings, apiUrl: url });
    localStorage.setItem('whatsapp_api_url', url);
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
    if (!confirm('Deseja realmente limpar o cache de imagens e textos? Isso forçará a geração de novo conteúdo no próximo envio.')) return;
    try {
      setLoading(true);
      await axios.post(`${API_BASE}/clear-cache`, {}, { headers: getAuthHeader() });
      alert('Cache limpo com sucesso!');
    } catch (err) {
      alert('Erro ao limpar cache');
    } finally {
      setLoading(false);
    }
  };

  const triggerTest = async (type, contactPhone = null) => {
    try {
      await axios.post(`${API_BASE}/test-now`, { type, contactPhone }, { headers: getAuthHeader() });
      alert(`Teste de ${type === 'morning' ? 'Bom dia' : 'Boa noite'} solicitado${contactPhone ? ` para o contato selecionado` : ' para toda a lista'}!`);
    } catch (err) {
      alert('Erro ao iniciar teste');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center', background: 'var(--bg-dark)' }}>
        <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ 
              width: '64px', height: '64px', background: 'var(--accent-primary)', borderRadius: '16px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' 
            }}>
              <Globe size={32} color="white" />
            </div>
            <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Acesso Restrito</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Configure e gerencie sua automação</p>
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
            <div className="form-group">
              <label>Senha</label>
              <input 
                type="password" 
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '48px', marginTop: '1rem' }} disabled={loading}>
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {/* Sidebar Navigation */}
      <aside>
        <div className="logo">
          <Globe size={28} />
          AutoGreet Pro
        </div>
        
        <nav>
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20} /> Dashboard
          </div>
          <div 
            className={`nav-item ${activeTab === 'contacts' ? 'active' : ''}`}
            onClick={() => setActiveTab('contacts')}
          >
            <Users size={20} /> Contatos
          </div>
          <div 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} /> Configurações
          </div>
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <div className="status-card">
            <div className={`indicator ${status.isReady ? 'online' : 'offline'}`} />
            {status.isReady ? 'Conectado' : 'Aguardando QR'}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main>
        <header>
          <div>
            <h1 style={{ background: 'none', webkitTextFillColor: 'white', color: 'white' }}>
              {activeTab === 'dashboard' && 'Visão Geral'}
              {activeTab === 'contacts' && 'Gerenciar Contatos'}
              {activeTab === 'settings' && 'Preferências do Sistema'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
              {activeTab === 'dashboard' && 'Monitore o status das suas automações diárias.'}
              {activeTab === 'contacts' && 'Adicione ou remova destinatários das mensagens.'}
              {activeTab === 'settings' && 'Configure os horários e os prompts da IA Gemini.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-outline" style={{ padding: '0.5rem' }}>
              <Bell size={20} />
            </button>
            <button className="btn btn-primary" onClick={() => triggerTest('morning')}>
              <Play size={16} /> Teste Rápido
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="content-grid fade-in">
            <div className="col-8">
              <section className="glass-card" style={{ height: '100%' }}>
                <div className="card-header">
                  <h2><Smartphone className="text-accent" /> Conexão WhatsApp</h2>
                </div>
                {!status.isReady ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    {status.qrCodeData ? (
                      <div className="qr-frame">
                        <QRCodeSVG value={status.qrCodeData} size={250} level="H" />
                      </div>
                    ) : (
                      <div style={{ padding: '4rem' }}>
                        <RefreshCw className="animate-spin" size={48} style={{ opacity: 0.3 }} />
                        <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)' }}>
                          Sincronizando com o servidor...
                        </p>
                      </div>
                    )}
                    <p style={{ marginTop: '2rem', maxWidth: '300px', margin: '2rem auto 0' }}>
                      Escaneie o código acima com o seu celular para ativar a automação.
                    </p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <div style={{ 
                      width: '80px', 
                      height: '80px', 
                      borderRadius: '50%', 
                      background: 'rgba(16, 185, 129, 0.1)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      margin: '0 auto 1.5rem'
                    }}>
                      <CheckCircle2 size={48} color="var(--accent-primary)" />
                    </div>
                    <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Conexão Ativa</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      O sistema está pronto e monitorando os agendamentos.
                    </p>
                  </div>
                )}
              </section>
            </div>
            
            <div className="col-4">
              <section className="glass-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                  <h2><PlayCircle /> Teste Rápido</h2>
                </div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem' }}>Enviar teste para:</label>
                  <select 
                    value={selectedTestContact} 
                    onChange={(e) => setSelectedTestContact(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.625rem', 
                      borderRadius: '0.5rem', 
                      background: '#1f2937', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="" style={{ background: '#1f2937', color: 'white' }}>Toda a Lista</option>
                    {contacts.map(c => (
                      <option key={c.phone} value={c.phone} style={{ background: '#1f2937', color: 'white' }}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button className="btn btn-primary" onClick={() => triggerTest('morning', selectedTestContact)} style={{ padding: '0.5rem', fontSize: '0.8125rem' }}>
                    <Sun size={14} /> Teste Bom Dia
                  </button>
                  <button className="btn btn-primary" onClick={() => triggerTest('night', selectedTestContact)} style={{ padding: '0.5rem', fontSize: '0.8125rem', background: '#6366f1' }}>
                    <Moon size={14} /> Teste Boa Noite
                  </button>
                </div>
              </section>

              <section className="glass-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                  <h2><Clock /> Próximos Envios</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="contact-row" style={{ background: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Sun size={18} color="#f59e0b" />
                      <div>
                        <p style={{ fontWeight: 600 }}>Bom Dia</p>
                        <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>Agendado para {settings.morningTime}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>PENDENTE</span>
                  </div>
                  <div className="contact-row" style={{ background: 'rgba(99, 102, 241, 0.05)', borderColor: 'rgba(99, 102, 241, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Moon size={18} color="#6366f1" />
                      <div>
                        <p style={{ fontWeight: 600 }}>Boa Noite</p>
                        <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>Agendado para {settings.nightTime}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1' }}>PENDENTE</span>
                  </div>
                </div>
              </section>

              <section className="glass-card">
                <div className="card-header">
                  <h2><Users /> Audiência</h2>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <p style={{ fontSize: '3rem', fontWeight: 700 }}>{contacts.length}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Contatos Ativos</p>
                </div>
              </section>
            </div>

            {/* Logs Section */}
            <div className="col-12">
              <section className="glass-card">
                <div className="card-header">
                  <h2><LayoutDashboard /> Histórico de Envios</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {logs.length > 0 ? logs.map(log => (
                    <div key={log.id} className="contact-row" style={{ padding: '0.75rem 1.25rem', flexDirection: 'column', alignItems: 'stretch' }}>
                      <div 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', width: '100%' }}
                        onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          {log.status === 'success' ? (
                            <CheckCircle2 size={18} color="var(--success)" />
                          ) : (
                            <XCircle size={18} color="var(--danger)" />
                          )}
                          <div>
                            <p style={{ fontSize: '0.9375rem', fontWeight: 500 }}>
                              Automação de {log.type === 'morning' ? 'Bom Dia' : 'Boa Noite'}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {new Date(log.timestamp).toLocaleString('pt-BR')} • {typeof log.details === 'string' ? log.details : log.details?.summary}
                            </p>
                          </div>
                        </div>
                        <span style={{ 
                          fontSize: '0.6875rem', 
                          fontWeight: 700, 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px',
                          background: log.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: log.status === 'success' ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {log.status.toUpperCase()}
                        </span>
                      </div>

                      {expandedLogId === log.id && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                          {log.details?.successes && log.details.successes.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                              <p style={{ color: 'var(--success)', fontWeight: 600, marginBottom: '0.5rem' }}>✅ Entregues ({log.details.successes.length}):</p>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                                {log.details.successes.map((c, i) => (
                                  <div key={i} style={{ opacity: 0.8 }}>• {c.name} ({c.phone})</div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {log.details?.failures && log.details.failures.length > 0 && (
                            <div style={{ marginBottom: '0.5rem' }}>
                              <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: '0.5rem' }}>❌ Falhas ({log.details.failures.length}):</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {log.details.failures.map((f, i) => (
                                  <div key={i} style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '0.5rem', borderRadius: '4px' }}>
                                    <strong>{f.name} ({f.phone})</strong>: <span style={{ opacity: 0.8 }}>{f.error}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {log.details?.error && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '0.5rem', borderRadius: '4px', color: 'var(--danger)' }}>
                              <p style={{ fontWeight: 600 }}>Erro Crítico:</p>
                              <p style={{ opacity: 0.8 }}>{log.details.error}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )) : (
                    <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                      <p>Nenhum envio registrado ainda.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="fade-in">
            <section className="glass-card">
              <div className="card-header">
                <h2>Adicionar Novo Destinatário</h2>
              </div>
              <form onSubmit={addContact} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Nome Completo</label>
                  <input 
                    placeholder="Ex: João Silva" 
                    value={newContact.name}
                    onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>WhatsApp (com DDD)</label>
                  <input 
                    placeholder="Ex: 5511999999999" 
                    value={newContact.phone}
                    onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ height: '48px' }}>
                  <Plus size={20} /> Adicionar
                </button>
              </form>
            </section>

            <section className="glass-card" style={{ marginTop: '2rem' }}>
              <div className="card-header">
                <h2>Lista de Transmissão</h2>
              </div>
              <div className="contact-list">
                {contacts.map(contact => (
                  <div key={contact.phone} className="contact-row">
                    <div>
                      <p style={{ fontWeight: 600 }}>{contact.name}</p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{contact.phone}</p>
                    </div>
                    <button 
                      className="btn-outline"
                      onClick={() => removeContact(contact.phone)}
                      style={{ padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--danger)' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                {contacts.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                    <Users size={48} style={{ margin: '0 auto 1rem' }} />
                    <p>Sua lista de contatos está vazia.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="content-grid fade-in">
            <div className="col-8">
              <section className="glass-card">
                <div className="card-header">
                  <h2><Settings /> Prompts da IA</h2>
                </div>
                <div className="form-group">
                  <label><Sun size={14} style={{ marginRight: 8 }} /> Contexto para Mensagem de Bom Dia</label>
                  <textarea 
                    rows="4" 
                    value={settings.morningPrompt}
                    onChange={(e) => setSettings({...settings, morningPrompt: e.target.value})}
                    placeholder="Descreva o estilo e elementos da imagem..."
                  />
                </div>
                <div className="form-group">
                  <label><Moon size={14} style={{ marginRight: 8 }} /> Contexto para Mensagem de Boa Noite</label>
                  <textarea 
                    rows="4" 
                    value={settings.nightPrompt}
                    onChange={(e) => setSettings({...settings, nightPrompt: e.target.value})}
                    placeholder="Descreva o estilo e elementos da imagem..."
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div className="form-group">
                    <label>Horário Bom Dia</label>
                    <input 
                      type="time" 
                      value={settings.morningTime}
                      onChange={(e) => setSettings({...settings, morningTime: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Horário Boa Noite</label>
                    <input 
                      type="time" 
                      value={settings.nightTime}
                      onChange={(e) => setSettings({...settings, nightTime: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  className="btn btn-primary" 
                  onClick={saveSettings} 
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Sincronizando...' : 'Salvar Alterações'}
                </button>
              </section>
            </div>

            <div className="col-4">
              <section className="glass-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                  <h2><Globe /> Servidor Backend</h2>
                </div>
                <div className="form-group">
                  <label>URL da API</label>
                  <input 
                    type="url" 
                    value={settings.apiUrl}
                    onChange={(e) => handleApiUrlChange(e.target.value)}
                    placeholder="http://localhost:3001"
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                    Altere esta URL se estiver usando um túnel (Ngrok/LocalTunnel) para acessar o servidor local via GitHub Pages.
                  </p>
                </div>
              </section>

              <section className="glass-card" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                <div className="card-header">
                  <h2><Trash2 className="text-danger" /> Manutenção</h2>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Limpe o cache para forçar a IA a gerar uma nova imagem e texto no próximo envio.
                </p>
                <button 
                  className="btn-outline" 
                  onClick={clearCache}
                  disabled={loading}
                  style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--danger)' }}
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ marginRight: '8px' }} /> Limpar Cache de Conteúdo
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
