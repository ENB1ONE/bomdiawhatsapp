// WhatsApp AutoGreetings - Interface Premium de Gerenciamento
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Users, 
  Settings, 
  Play, 
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
  const [status, setStatus] = useState({ isReady: false, qrCodeData: null });
  const [contacts, setContacts] = useState([]);
  const [settings, setSettings] = useState({
    morningPrompt: '',
    nightPrompt: '',
    morningTime: '08:00',
    nightTime: '20:00',
    apiUrl: 'http://localhost:3001'
  });
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const API_BASE = settings.apiUrl || 'http://localhost:3001';

  useEffect(() => {
    // Load API URL from localStorage if available
    const savedApiUrl = localStorage.getItem('whatsapp_api_url');
    if (savedApiUrl) {
      setSettings(s => ({ ...s, apiUrl: savedApiUrl }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [settings.apiUrl]);

  const fetchData = async () => {
    try {
      const [contactsRes, settingsRes] = await Promise.all([
        axios.get(`${API_BASE}/contacts`),
        axios.get(`${API_BASE}/settings`)
      ]);
      setContacts(contactsRes.data);
      setSettings(prev => ({ ...prev, ...settingsRes.data }));
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/status`);
      setStatus(res.data);
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  const handleApiUrlChange = (url) => {
    setSettings({ ...settings, apiUrl: url });
    localStorage.setItem('whatsapp_api_url', url);
  };

  const addContact = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/contacts`, newContact);
      setNewContact({ name: '', phone: '' });
      fetchData();
    } catch (err) {
      alert('Erro ao adicionar contato');
    }
  };

  const removeContact = async (phone) => {
    try {
      await axios.delete(`${API_BASE}/contacts/${phone}`);
      fetchData();
    } catch (err) {
      alert('Erro ao remover contato');
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE}/settings`, settings);
      alert('Configurações salvas!');
    } catch (err) {
      alert('Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  const triggerTest = async (type) => {
    try {
      await axios.post(`${API_BASE}/test-now`, { type });
      alert(`Automação de ${type === 'morning' ? 'Bom dia' : 'Boa noite'} iniciada!`);
    } catch (err) {
      alert('Erro ao iniciar teste');
    }
  };

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
              <section className="glass-card">
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
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
