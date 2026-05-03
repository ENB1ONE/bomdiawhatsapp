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
  const [userRole, setUserRole] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [selectedTestContact, setSelectedTestContact] = useState('');
  const [settings, setSettings] = useState({
    morningPrompt: "",
    nightPrompt: "",
    morningTime: '08:00',
    nightTime: '20:00',
    apiUrl: 'https://api.servicesbr.duckdns.org',
    autoSendEnabled: true
  });
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  // Estados do Calendário
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState('');
  const [eventForm, setEventForm] = useState({ time: '10:00', targetId: '', text: '', image: null });

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
    const savedRole = sessionStorage.getItem('whatsapp_role');
    if (savedAuth) {
      setIsLoggedIn(true);
      if (savedRole) setUserRole(savedRole);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchData();
      const interval = setInterval(() => {
        fetchStatus();
        fetchLogs();
      }, 2000); // Reduzido de 5s para 2s para sincronização mais rápida
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
        sessionStorage.setItem('whatsapp_role', res.data.role);
        setUserRole(res.data.role);
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
    sessionStorage.removeItem('whatsapp_role');
    setIsLoggedIn(false);
    setUserRole(null);
  };

  const fetchData = async () => {
    try {
      const config = { headers: getAuthHeader() };
      const role = sessionStorage.getItem('whatsapp_role');
      
      const reqs = [
        axios.get(`${API_BASE}/contacts`, config).catch(e => ({ data: [] })),
        axios.get(`${API_BASE}/settings`, config).catch(e => ({ data: null })),
        axios.get(`${API_BASE}/logs`, config).catch(e => ({ data: [] })),
        axios.get(`${API_BASE}/calendar`, config).catch(e => ({ data: [] }))
      ];

      if (role === 'admin') {
        reqs.push(axios.get(`${API_BASE}/users`, config).catch(e => ({ data: [] })));
        reqs.push(axios.get(`${API_BASE}/groups`, config).catch(e => ({ data: [] })));
      }

      const results = await Promise.all(reqs);

      const [contactsRes, settingsRes, logsRes, calendarRes, usersRes, groupsRes] = results;

      if (contactsRes.status === 401 || settingsRes.status === 401 || logsRes.status === 401) {
         handleLogout();
         return;
      }

      setContacts(Array.isArray(contactsRes.data) ? contactsRes.data : []);
      if (settingsRes.data) setSettings(prev => ({ ...prev, ...settingsRes.data }));
      setLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
      setCalendarEvents(Array.isArray(calendarRes.data) ? calendarRes.data : []);
      
      if (role === 'admin') {
        if (usersRes && Array.isArray(usersRes.data)) setUsersList(usersRes.data);
        if (groupsRes && Array.isArray(groupsRes.data)) setGroupsList(groupsRes.data);
      }

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

  const toggleAutoSend = async (enabled) => {
    try {
      setLoading(true);
      await axios.put(`${API_BASE}/settings/toggle-auto`, { enabled }, { headers: getAuthHeader() });
      setSettings(prev => ({ ...prev, autoSendEnabled: enabled }));
    } catch (err) {
      alert('Erro ao alterar status global.');
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
          <div className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => { setActiveTab('calendar'); setIsSidebarOpen(false); }}><Calendar size={18} /> Calendário</div>
          <div className={`nav-item ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => { setActiveTab('contacts'); setIsSidebarOpen(false); }}><Users size={18} /> Contatos</div>
          {userRole === 'admin' && (
            <div className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }}><Users size={18} /> Usuários</div>
          )}
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
            <h1>{activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'contacts' ? 'Contatos' : activeTab === 'settings' ? 'Ajustes' : activeTab === 'calendar' ? 'Calendário' : 'Usuários'}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {activeTab === 'dashboard' ? 'Gestão de envios.' : activeTab === 'contacts' ? 'Gerencie seus contatos.' : activeTab === 'settings' ? 'Configurações do sistema.' : activeTab === 'calendar' ? 'Agendamentos específicos.' : 'Controle de acesso.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-outline"><Bell size={18} /></button>
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
                <div className="card-header"><h2><Globe size={18} /> Automação Global</h2></div>
                <div style={{ padding: '1rem 0', textAlign: 'center' }}>
                  <div className={`status-badge ${settings?.autoSendEnabled !== false ? 'online' : 'offline'}`} style={{ display: 'inline-flex', padding: '0.5rem 1rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    <div className="indicator" /> {settings?.autoSendEnabled !== false ? 'Automação Ativada' : 'Automação Pausada'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button className="btn btn-outline" style={{ borderColor: 'var(--success-color)', color: 'var(--success-color)' }} onClick={() => toggleAutoSend(true)} disabled={settings?.autoSendEnabled !== false || loading}>
                      Ativar
                    </button>
                    <button className="btn btn-outline" style={{ borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }} onClick={() => toggleAutoSend(false)} disabled={settings?.autoSendEnabled === false || loading}>
                      Pausar
                    </button>
                  </div>
                </div>
              </section>

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
              <section className="glass-card compact-card">
                <div className="card-header"><h2><Users size={18} /> Total</h2></div>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{contacts?.length || 0}</div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'users' && userRole === 'admin' && (
          <div className="animate-in">
            <section className="glass-card" style={{ marginBottom: '2rem' }}>
              <div className="card-header"><h2><Users size={18} /> Cadastrar Usuário</h2></div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                   setLoading(true);
                   await axios.post(`${API_BASE}/users`, { username: e.target.username.value, password: e.target.password.value, role: e.target.role.value }, { headers: getAuthHeader() });
                   alert('Usuário cadastrado');
                   e.target.reset();
                   fetchData();
                } catch(err) { alert('Erro ao cadastrar'); } finally { setLoading(false); }
              }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                <div><label>Usuário</label><input name="username" required /></div>
                <div><label>Senha</label><input name="password" required type="password" /></div>
                <div><label>Nível</label><select name="role"><option value="user">Usuário</option><option value="admin">Admin</option></select></div>
                <button type="submit" className="btn btn-primary" disabled={loading}>Salvar</button>
              </form>
            </section>
            <section className="glass-card">
               <div className="card-header"><h2><Users size={18} /> Lista de Usuários</h2></div>
               <div className="contact-list">
                 {usersList.map(u => (
                    <div key={u.username} className="contact-row">
                      <div><p style={{ fontWeight: 700 }}>{u.username}</p><p style={{ fontSize: '0.8rem', opacity: 0.5 }}>{u.role}</p></div>
                      <button onClick={async () => {
                         if(!confirm('Deletar usuário?')) return;
                         try { await axios.delete(`${API_BASE}/users/${u.username}`, { headers: getAuthHeader() }); fetchData(); } catch(err) { alert('Erro'); }
                      }} className="delete-btn"><Trash2 size={16} /></button>
                    </div>
                 ))}
               </div>
            </section>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="animate-in">
             <section className="glass-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <h2><Calendar size={18} /> Calendário - {currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
                   <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-outline" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>Anterior</button>
                      <button className="btn btn-outline" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>Próximo</button>
                   </div>
                </div>
                <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                   {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} style={{ fontWeight: 'bold', padding: '0.5rem' }}>{d}</div>)}
                   {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
                   {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      
                      // Check for fixed brazilian holidays
                      const isHoliday = ['01-01','21-04','01-05','07-09','12-10','02-11','15-11','25-12'].includes(`${String(day).padStart(2, '0')}-${String(currentDate.getMonth()+1).padStart(2, '0')}`);
                      const dayEvents = calendarEvents.filter(e => e.date === dateStr);
                      
                      return (
                        <div key={day} onClick={() => { setSelectedDateStr(dateStr); setShowEventModal(true); }} style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', background: isHoliday ? 'rgba(255,100,100,0.1)' : 'rgba(255,255,255,0.05)' }}>
                           <div style={{ fontWeight: 'bold', color: isHoliday ? '#ff6b6b' : 'inherit' }}>{day}</div>
                           {dayEvents.length > 0 && <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', color: 'var(--accent-color)' }}>{dayEvents.length} agendado(s)</div>}
                        </div>
                      )
                   })}
                </div>
             </section>

             <section className="glass-card">
               <div className="card-header"><h2>Eventos Agendados</h2></div>
               <div className="compact-log-list">
                 {calendarEvents.length === 0 ? <p style={{opacity:0.5}}>Nenhum evento agendado.</p> : calendarEvents.map(ev => (
                   <div key={ev.id} className="log-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{ev.date} às {ev.time}</strong> - Para: {ev.targetId} <br/>
                        <small style={{ opacity: 0.7 }}>{ev.text}</small>
                        {ev.sent && <span style={{ color: 'var(--success-color)', fontSize: '0.7rem', marginLeft: '10px' }}>(Enviado)</span>}
                      </div>
                      <button className="delete-btn" onClick={async () => {
                         if(!confirm('Cancelar agendamento?')) return;
                         try { await axios.delete(`${API_BASE}/calendar/${ev.id}`, { headers: getAuthHeader() }); fetchData(); } catch(err) { alert('Erro'); }
                      }}><Trash2 size={16} /></button>
                   </div>
                 ))}
               </div>
             </section>

             {showEventModal && (
               <div className="mobile-backdrop" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                 <div className="glass-card animate-in" style={{ width: '100%', maxWidth: '500px' }}>
                   <h2>Agendar Envio: {selectedDateStr}</h2>
                   <form onSubmit={async (e) => {
                     e.preventDefault();
                     try {
                       setLoading(true);
                       const formData = new FormData();
                       formData.append('date', selectedDateStr);
                       formData.append('time', eventForm.time);
                       formData.append('targetId', eventForm.targetId);
                       formData.append('text', eventForm.text);
                       if (eventForm.image) formData.append('image', eventForm.image);

                       await axios.post(`${API_BASE}/calendar`, formData, { headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' } });
                       alert('Agendado com sucesso!');
                       setShowEventModal(false);
                       fetchData();
                     } catch(err) { alert('Erro ao agendar'); } finally { setLoading(false); }
                   }}>
                     <div className="form-group"><label>Horário (HH:MM)</label><input type="time" required value={eventForm.time} onChange={e => setEventForm({...eventForm, time: e.target.value})} /></div>
                     
                     <div className="form-group"><label>Destinatário (Contato ou Grupo)</label>
                       <select required value={eventForm.targetId} onChange={e => setEventForm({...eventForm, targetId: e.target.value})}>
                         <option value="">Selecione...</option>
                         <optgroup label="Grupos do WhatsApp">
                           {groupsList.map(g => <option key={g.id} value={g.id}>{g.name} (Grupo)</option>)}
                         </optgroup>
                         <optgroup label="Meus Contatos">
                           {contacts.map(c => <option key={c.phone} value={c.phone}>{c.name}</option>)}
                         </optgroup>
                       </select>
                     </div>

                     <div className="form-group"><label>Texto Especial</label><textarea rows="3" required value={eventForm.text} onChange={e => setEventForm({...eventForm, text: e.target.value})} /></div>
                     <div className="form-group"><label>Imagem (Opcional)</label><input type="file" accept="image/*" onChange={e => setEventForm({...eventForm, image: e.target.files[0]})} /></div>
                     
                     <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                       <button type="button" className="btn btn-outline" onClick={() => setShowEventModal(false)} style={{ flex: 1 }}>Cancelar</button>
                       <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>Confirmar</button>
                     </div>
                   </form>
                 </div>
               </div>
             )}
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
