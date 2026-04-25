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
  RefreshCw
} from 'lucide-react';

const API_BASE = 'http://localhost:3001';

function App() {
  const [status, setStatus] = useState({ isReady: false, qrCodeData: null });
  const [contacts, setContacts] = useState([]);
  const [settings, setSettings] = useState({
    morningPrompt: '',
    nightPrompt: '',
    morningTime: '',
    nightTime: ''
  });
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [contactsRes, settingsRes] = await Promise.all([
        axios.get(`${API_BASE}/contacts`),
        axios.get(`${API_BASE}/settings`)
      ]);
      setContacts(contactsRes.data);
      setSettings(settingsRes.data);
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
    <div className="container">
      <header>
        <div>
          <h1>WhatsApp AutoGreetings</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Automação de mensagens com IA Gemini
          </p>
        </div>
        <div className={`status-badge ${status.isReady ? 'status-online' : 'status-offline'}`}>
          {status.isReady ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {status.isReady ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
        </div>
      </header>

      <div className="dashboard-grid">
        {/* WhatsApp Connection */}
        <section className="card">
          <div className="card-title">
            <Smartphone className="text-accent" /> Status do WhatsApp
          </div>
          {!status.isReady ? (
            <div className="qr-container">
              {status.qrCodeData ? (
                <>
                  <div className="qr-code">
                    <QRCodeSVG value={status.qrCodeData} size={250} />
                  </div>
                  <p style={{ textAlign: 'center', fontSize: '0.875rem' }}>
                    Escaneie o código QR com seu WhatsApp para conectar
                  </p>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <RefreshCw className="animate-spin" size={48} style={{ opacity: 0.5 }} />
                  <p style={{ marginTop: '1rem' }}>Iniciando cliente WhatsApp...</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <CheckCircle2 size={64} color="#10b981" />
              <p style={{ marginTop: '1rem', fontWeight: 600 }}>Tudo pronto!</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Seu WhatsApp está autenticado e pronto para enviar mensagens.
              </p>
            </div>
          )}
        </section>

        {/* Settings / Prompts */}
        <section className="card">
          <div className="card-title">
            <Settings className="text-secondary" /> Configurações de IA
          </div>
          <div className="form-group">
            <label><Sun size={14} style={{ marginRight: 4 }} /> Prompt de Bom Dia</label>
            <textarea 
              rows="3" 
              value={settings.morningPrompt}
              onChange={(e) => setSettings({...settings, morningPrompt: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label><Moon size={14} style={{ marginRight: 4 }} /> Prompt de Boa Noite</label>
            <textarea 
              rows="3" 
              value={settings.nightPrompt}
              onChange={(e) => setSettings({...settings, nightPrompt: e.target.value})}
            />
          </div>
          <button 
            className="btn-primary" 
            onClick={saveSettings} 
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Salvando...' : 'Salvar Configurações'}
          </button>

          <div className="test-buttons">
            <button className="btn-outline" onClick={() => triggerTest('morning')} style={{ flex: 1 }}>
              <Play size={14} style={{ marginRight: 4 }} /> Testar Bom Dia
            </button>
            <button className="btn-outline" onClick={() => triggerTest('night')} style={{ flex: 1 }}>
              <Play size={14} style={{ marginRight: 4 }} /> Testar Boa Noite
            </button>
          </div>
        </section>

        {/* Contacts */}
        <section className="card">
          <div className="card-title">
            <Users className="text-accent" /> Lista de Contatos
          </div>
          <form onSubmit={addContact} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input 
              placeholder="Nome" 
              value={newContact.name}
              onChange={(e) => setNewContact({...newContact, name: e.target.value})}
              required
            />
            <input 
              placeholder="55119..." 
              value={newContact.phone}
              onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
              required
            />
            <button type="submit" className="btn-secondary" style={{ padding: '0.75rem' }}>
              <Plus size={20} />
            </button>
          </form>
          
          <div className="contact-list">
            {contacts.map(contact => (
              <div key={contact.phone} className="contact-item">
                <div>
                  <p style={{ fontWeight: 500 }}>{contact.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{contact.phone}</p>
                </div>
                <button 
                  onClick={() => removeContact(contact.phone)}
                  style={{ background: 'transparent', color: '#ef4444', padding: '0.5rem' }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {contacts.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
                Nenhum contato adicionado.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
