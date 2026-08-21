import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Gauge,
  LayoutDashboard,
  LogOut,
  MapPin,
  Plus,
  Search,
  Settings,
  Truck,
  UserRound,
  Users,
  WalletCards,
  Wrench,
  X,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { Appointment, AppointmentStatus, Branch, Equipment, Profile, Technician } from './types';

type View = 'dashboard' | 'agenda' | 'equipamentos' | 'faturamento' | 'retencao' | 'caretrack';
type QuickDraft = {
  id?: string;
  date: string;
  technicianId: string;
  statusId: string;
  amount: string;
  notes: string;
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const fullDateLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const weekdayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfWeek(input: Date) {
  const date = new Date(input);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(input: Date, amount: number) {
  const date = new Date(input);
  date.setDate(date.getDate() + amount);
  return date;
}

function roleLabel(role: Profile['role']) {
  if (role === 'admin') return 'Administrador';
  if (role === 'gestor') return 'Gestor';
  return 'Consultor';
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [statuses, setStatuses] = useState<AppointmentStatus[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<View>('dashboard');
  const [loadingData, setLoadingData] = useState(false);
  const [draft, setDraft] = useState<QuickDraft | null>(null);
  const [saveError, setSaveError] = useState('');
  const [newTechName, setNewTechName] = useState('');
  const [showNewTech, setShowNewTech] = useState(false);
  const [equipmentQuery, setEquipmentQuery] = useState('');
  const [equipmentResults, setEquipmentResults] = useState<Equipment[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setBranches([]);
        setBranchId('');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    async function bootstrap() {
      setProfileError('');
      const { data: profileData, error: profileErr } = await supabase
        .from('app_users')
        .select('id,matricula,full_name,role')
        .eq('auth_user_id', session!.user.id)
        .single();
      if (cancelled) return;
      if (profileErr || !profileData) {
        setProfileError('Seu login existe, mas a matrícula ainda não está vinculada ao cadastro do aplicativo.');
        return;
      }
      const currentProfile = profileData as Profile;
      setProfile(currentProfile);

      const { data: statusData } = await supabase
        .from('appointment_statuses')
        .select('id,name,color_hex,text_color,sort_order')
        .eq('active', true)
        .order('sort_order');
      if (!cancelled) setStatuses((statusData || []) as AppointmentStatus[]);

      if (currentProfile.role === 'consultor') {
        const { data: accessData } = await supabase
          .from('user_branches')
          .select('branch_id,branches(id,name,slug)')
          .eq('user_id', currentProfile.id);
        const allowed = (accessData || [])
          .map((item: any) => item.branches)
          .filter(Boolean) as Branch[];
        if (!cancelled) {
          setBranches(allowed);
          setBranchId((prev) => prev && allowed.some((b) => b.id === prev) ? prev : (allowed[0]?.id || ''));
        }
      } else {
        const { data: branchData } = await supabase.from('branches').select('id,name,slug').eq('active', true).order('name');
        const allBranches = (branchData || []) as Branch[];
        if (!cancelled) {
          setBranches(allBranches);
          setBranchId((prev) => prev && allBranches.some((b) => b.id === prev) ? prev : (allBranches[0]?.id || ''));
        }
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  }, [session]);

  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const weekEnd = weekDays[5];
  const todayIso = isoDate(new Date());
  const canEdit = profile?.role === 'consultor' || profile?.role === 'admin';
  const currentBranch = branches.find((branch) => branch.id === branchId) || null;

  const loadAgenda = useCallback(async () => {
    if (!branchId || !session) return;
    setLoadingData(true);
    const from = isoDate(weekStart);
    const to = isoDate(weekEnd);
    const [techResponse, appointmentResponse] = await Promise.all([
      supabase.from('technicians').select('id,branch_id,name,source').eq('branch_id', branchId).eq('active', true).order('name'),
      supabase
        .from('appointments')
        .select('id,branch_id,appointment_date,technician_id,technician_name_manual,status_id,amount,notes,billing_status,invoice_number,status:appointment_statuses(id,name,color_hex,text_color,sort_order),technician:technicians(id,name)')
        .eq('branch_id', branchId)
        .gte('appointment_date', from)
        .lte('appointment_date', to)
        .order('appointment_date'),
    ]);
    setTechnicians((techResponse.data || []) as Technician[]);
    setAppointments((appointmentResponse.data || []) as unknown as Appointment[]);
    setLoadingData(false);
  }, [branchId, session, weekStart, weekEnd]);

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);

  const todayAppointments = appointments.filter((item) => item.appointment_date === todayIso);
  const weeklyAmount = appointments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const activeTechCount = new Set(appointments.map((item) => item.technician_id || item.technician_name_manual).filter(Boolean)).size;
  const noAgendaStatus = statuses.find((status) => status.name === 'Sem agenda');
  const noAgendaCount = noAgendaStatus ? appointments.filter((item) => item.status_id === noAgendaStatus.id).length : 0;

  function openNew(date: string, technicianId: string) {
    if (!canEdit) return;
    setSaveError('');
    setDraft({ date, technicianId, statusId: statuses[0]?.id || '', amount: '', notes: '' });
  }

  function openEdit(item: Appointment) {
    if (!canEdit) return;
    setSaveError('');
    setDraft({
      id: item.id,
      date: item.appointment_date,
      technicianId: item.technician_id || '',
      statusId: item.status_id,
      amount: item.amount ? String(item.amount) : '',
      notes: item.notes || '',
    });
  }

  async function saveAppointment(event: FormEvent) {
    event.preventDefault();
    if (!draft || !profile || !branchId) return;
    if (!draft.date || !draft.technicianId || !draft.statusId) {
      setSaveError('Preencha data, técnico e status.');
      return;
    }
    const payload = {
      branch_id: branchId,
      appointment_date: draft.date,
      technician_id: draft.technicianId,
      technician_name_manual: null,
      status_id: draft.statusId,
      amount: Number(String(draft.amount || '0').replace(',', '.')) || 0,
      notes: draft.notes.trim() || null,
      updated_by: profile.id,
    };
    const response = draft.id
      ? await supabase.from('appointments').update(payload).eq('id', draft.id)
      : await supabase.from('appointments').insert({ ...payload, created_by: profile.id });
    if (response.error) {
      setSaveError(response.error.message);
      return;
    }
    setDraft(null);
    await loadAgenda();
  }

  async function removeAppointment() {
    if (!draft?.id || !canEdit) return;
    const { error } = await supabase.from('appointments').update({ deleted_at: new Date().toISOString(), updated_by: profile?.id }).eq('id', draft.id);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setDraft(null);
    await loadAgenda();
  }

  async function addTechnician(event: FormEvent) {
    event.preventDefault();
    const cleanName = newTechName.trim();
    if (!cleanName || !branchId || !canEdit) return;
    const { error } = await supabase.from('technicians').insert({ branch_id: branchId, name: cleanName, source: 'adhoc' });
    if (error) {
      setSaveError(error.message.includes('duplicate') ? 'Esse técnico já está cadastrado nesta filial.' : error.message);
      return;
    }
    setNewTechName('');
    setShowNewTech(false);
    await loadAgenda();
  }

  async function searchEquipment(event: FormEvent) {
    event.preventDefault();
    const query = equipmentQuery.trim();
    if (!query || !branchId) return;
    setEquipmentLoading(true);
    const { data } = await supabase
      .from('equipment')
      .select('id,serial,manufacturer,model,city,state,current_hourmeter,hourmeter_date,caretrack_status,client:clients(name)')
      .eq('branch_id', branchId)
      .ilike('serial', `%${query}%`)
      .limit(20);
    setEquipmentResults((data || []) as unknown as Equipment[]);
    setEquipmentLoading(false);
  }

  async function updateBilling(item: Appointment, value: string) {
    if (!canEdit) return;
    await supabase.from('appointments').update({ billing_status: value, updated_by: profile?.id }).eq('id', item.id);
    await loadAgenda();
  }

  if (authLoading) return <div className='center-screen'>Carregando...</div>;
  if (!session) return <Login />;
  if (profileError) return <ProfileProblem message={profileError} onLogout={() => supabase.auth.signOut()} />;
  if (!profile) return <div className='center-screen'>Carregando perfil...</div>;

  return (
    <div className='app-shell'>
      <aside className='sidebar'>
        <div className='brand'>
          <div className='brand-mark'><CalendarDays size={22} /></div>
          <div><strong>Agenda</strong><span>Atendimentos</span></div>
        </div>
        <nav className='side-nav'>
          <NavButton active={view === 'dashboard'} icon={<LayoutDashboard />} label='Visão geral' onClick={() => setView('dashboard')} />
          <NavButton active={view === 'agenda'} icon={<CalendarDays />} label='Agenda' onClick={() => setView('agenda')} />
          <NavButton active={view === 'equipamentos'} icon={<Truck />} label='Equipamentos' onClick={() => setView('equipamentos')} />
          <NavButton active={view === 'faturamento'} icon={<WalletCards />} label='Faturamento' onClick={() => setView('faturamento')} />
          <div className='nav-divider'>CONTROLES</div>
          <NavButton active={view === 'retencao'} icon={<ClipboardCheck />} label='Retenção' onClick={() => setView('retencao')} />
          <NavButton active={view === 'caretrack'} icon={<Gauge />} label='CareTrack' onClick={() => setView('caretrack')} />
          {profile.role === 'admin' && <div className='nav-admin-note'><Settings size={14} /> Administração será concentrada aqui.</div>}
        </nav>
        <div className='sidebar-user'>
          <div className='avatar'>{profile.full_name.charAt(0)}</div>
          <div><strong>{profile.full_name}</strong><span>{profile.matricula} · {roleLabel(profile.role)}</span></div>
          <button title='Sair' onClick={() => supabase.auth.signOut()}><LogOut size={17} /></button>
        </div>
      </aside>

      <main className='main-area'>
        <header className='topbar'>
          <div>
            <h1>{view === 'dashboard' ? 'Visão geral' : view === 'agenda' ? 'Agenda semanal' : view === 'equipamentos' ? 'Equipamentos' : view === 'faturamento' ? 'Faturamento' : view === 'retencao' ? 'Retenção' : 'CareTrack'}</h1>
            <p>{view === 'agenda' ? 'Clique em qualquer célula para apontar um atendimento.' : 'Controle simples, direto e por filial.'}</p>
          </div>
          <div className='topbar-actions'>
            <label className='branch-select'>Filial
              <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            <span className='role-pill'>{roleLabel(profile.role)}</span>
          </div>
        </header>

        <section className='page-content'>
          {view === 'dashboard' && (
            <Dashboard
              branch={currentBranch}
              today={todayAppointments}
              weeklyAmount={weeklyAmount}
              activeTechCount={activeTechCount}
              noAgendaCount={noAgendaCount}
              statuses={statuses}
              onOpenAgenda={() => setView('agenda')}
            />
          )}

          {view === 'agenda' && (
            <AgendaView
              branch={currentBranch}
              days={weekDays}
              technicians={technicians}
              appointments={appointments}
              loading={loadingData}
              canEdit={canEdit}
              onPrevious={() => setWeekStart(addDays(weekStart, -7))}
              onNext={() => setWeekStart(addDays(weekStart, 7))}
              onToday={() => setWeekStart(startOfWeek(new Date()))}
              onNew={openNew}
              onEdit={openEdit}
              onShowNewTech={() => { setSaveError(''); setShowNewTech(true); }}
            />
          )}

          {view === 'equipamentos' && (
            <EquipmentView query={equipmentQuery} setQuery={setEquipmentQuery} onSearch={searchEquipment} loading={equipmentLoading} results={equipmentResults} />
          )}

          {view === 'faturamento' && (
            <BillingView appointments={appointments} canEdit={canEdit} onChange={updateBilling} />
          )}

          {(view === 'retencao' || view === 'caretrack') && (
            <ComingSoon title={view === 'retencao' ? 'Retenção e contato' : 'CareTrack'} icon={view === 'retencao' ? <ClipboardCheck /> : <Gauge />} />
          )}
        </section>
      </main>

      {draft && (
        <QuickEditor
          draft={draft}
          setDraft={setDraft}
          technicians={technicians}
          statuses={statuses}
          error={saveError}
          onSubmit={saveAppointment}
          onRemove={removeAppointment}
          onClose={() => setDraft(null)}
        />
      )}

      {showNewTech && (
        <div className='modal-backdrop' onMouseDown={() => setShowNewTech(false)}>
          <form className='mini-modal' onSubmit={addTechnician} onMouseDown={(event) => event.stopPropagation()}>
            <div className='mini-modal-head'><div><h3>Adicionar técnico</h3><p>Só o nome. Nada de cadastro longo.</p></div><button type='button' onClick={() => setShowNewTech(false)}><X /></button></div>
            <input autoFocus value={newTechName} onChange={(event) => setNewTechName(event.target.value)} placeholder='Nome do técnico' />
            {saveError && <div className='form-error'>{saveError}</div>}
            <div className='modal-actions'><button type='button' className='ghost' onClick={() => setShowNewTech(false)}>Cancelar</button><button className='primary'>Adicionar</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function Login() {
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const clean = matricula.replace(/\D/g, '');
    const { error: authError } = await supabase.auth.signInWithPassword({ email: `${clean}@agenda.local`, password });
    if (authError) setError('Matrícula ou senha inválida.');
    setLoading(false);
  }

  return (
    <div className='login-page'>
      <div className='login-card'>
        <div className='login-logo'><CalendarDays /></div>
        <h1>Agenda de Atendimentos</h1>
        <p>Acesso por matrícula</p>
        <form onSubmit={submit}>
          <label>Matrícula<input inputMode='numeric' autoComplete='username' value={matricula} onChange={(event) => setMatricula(event.target.value)} placeholder='Ex.: 19124' /></label>
          <label>Senha<input type='password' autoComplete='current-password' value={password} onChange={(event) => setPassword(event.target.value)} placeholder='Sua senha' /></label>
          {error && <div className='form-error'>{error}</div>}
          <button className='login-submit' disabled={loading || !matricula || !password}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  );
}

function ProfileProblem({ message, onLogout }: { message: string; onLogout: () => void }) {
  return <div className='login-page'><div className='login-card'><UserRound className='problem-icon' /><h1>Acesso ainda não vinculado</h1><p>{message}</p><button className='login-submit' onClick={onLogout}>Voltar</button></div></div>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function Dashboard({ branch, today, weeklyAmount, activeTechCount, noAgendaCount, statuses, onOpenAgenda }: {
  branch: Branch | null;
  today: Appointment[];
  weeklyAmount: number;
  activeTechCount: number;
  noAgendaCount: number;
  statuses: AppointmentStatus[];
  onOpenAgenda: () => void;
}) {
  return <>
    <div className='welcome-row'>
      <div><span className='eyebrow'>{branch?.name || 'Filial'}</span><h2>Como está a operação agora</h2><p>Sem excesso de informação: o essencial do dia e o que vem pela frente.</p></div>
      <button className='primary action-button' onClick={onOpenAgenda}><CalendarDays size={17} /> Abrir agenda</button>
    </div>
    <div className='summary-grid'>
      <SummaryCard title='Apontamentos hoje' value={String(today.length)} icon={<CalendarDays />} />
      <SummaryCard title='Técnicos na semana' value={String(activeTechCount)} icon={<Users />} />
      <SummaryCard title='Valor da semana' value={brl.format(weeklyAmount)} icon={<CircleDollarSign />} compact />
      <SummaryCard title='Sem agenda' value={String(noAgendaCount)} icon={<Wrench />} />
    </div>
    <div className='home-grid'>
      <section className='card'>
        <div className='card-head'><div><h3>Hoje</h3><p>{fullDateLabel.format(new Date())}</p></div><button className='text-button' onClick={onOpenAgenda}>Ver semana</button></div>
        <div className='today-list'>
          {today.length === 0 && <EmptyState title='Nenhum apontamento hoje' text='A agenda está livre para esta filial.' />}
          {today.map((item) => {
            const status = item.status || statuses.find((s) => s.id === item.status_id);
            return <div className='today-row' key={item.id}><div className='status-strip' style={{ background: status?.color_hex }} /><div><strong>{item.technician?.name || item.technician_name_manual || 'Técnico'}</strong><span>{status?.name || 'Sem status'}</span></div><b>{item.amount ? brl.format(item.amount) : '—'}</b></div>;
          })}
        </div>
      </section>
      <section className='card compact-card'>
        <div className='card-head'><div><h3>Legenda rápida</h3><p>Cores oficiais da agenda</p></div></div>
        <div className='status-legend'>{statuses.map((status) => <div key={status.id}><span style={{ background: status.color_hex }} /><b>{status.name}</b></div>)}</div>
      </section>
    </div>
  </>;
}

function SummaryCard({ title, value, icon, compact }: { title: string; value: string; icon: ReactNode; compact?: boolean }) {
  return <div className='summary-card'><div className='summary-icon'>{icon}</div><div><span>{title}</span><strong className={compact ? 'compact-value' : ''}>{value}</strong></div></div>;
}

function AgendaView({ branch, days, technicians, appointments, loading, canEdit, onPrevious, onNext, onToday, onNew, onEdit, onShowNewTech }: {
  branch: Branch | null;
  days: Date[];
  technicians: Technician[];
  appointments: Appointment[];
  loading: boolean;
  canEdit: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onNew: (date: string, technicianId: string) => void;
  onEdit: (item: Appointment) => void;
  onShowNewTech: () => void;
}) {
  return <section className='card agenda-card'>
    <div className='agenda-toolbar'>
      <div><span className='eyebrow'>{branch?.name || 'Filial'}</span><h2>{dateLabel.format(days[0])} a {dateLabel.format(days[5])}</h2></div>
      <div className='agenda-actions'>
        {canEdit && <button className='secondary-button' onClick={onShowNewTech}><Plus size={16} /> Técnico adicional</button>}
        <button className='icon-button' onClick={onPrevious} aria-label='Semana anterior'><ChevronLeft /></button>
        <button className='secondary-button' onClick={onToday}>Hoje</button>
        <button className='icon-button' onClick={onNext} aria-label='Próxima semana'><ChevronRight /></button>
      </div>
    </div>
    <div className='excel-hint'>{canEdit ? 'Clique em uma célula vazia para preencher. Clique em um apontamento para editar.' : 'Modo visualização: gestor não altera apontamentos.'}</div>
    <div className='agenda-scroll'>
      <div className='agenda-grid'>
        <div className='grid-head tech-head'>Técnico</div>
        {days.map((day) => <div key={isoDate(day)} className={`grid-head ${isoDate(day) === isoDate(new Date()) ? 'today-head' : ''}`}><span>{weekdayLabel.format(day).replace('.', '')}</span><strong>{dateLabel.format(day)}</strong></div>)}
        {loading && <div className='grid-loading'>Carregando agenda...</div>}
        {!loading && technicians.length === 0 && <div className='grid-loading'>Nenhum técnico cadastrado nesta filial.</div>}
        {!loading && technicians.map((tech) => <AgendaRow key={tech.id} tech={tech} days={days} appointments={appointments} canEdit={canEdit} onNew={onNew} onEdit={onEdit} />)}
      </div>
    </div>
  </section>;
}

function AgendaRow({ tech, days, appointments, canEdit, onNew, onEdit }: {
  tech: Technician;
  days: Date[];
  appointments: Appointment[];
  canEdit: boolean;
  onNew: (date: string, technicianId: string) => void;
  onEdit: (item: Appointment) => void;
}) {
  return <>
    <div className='tech-cell'><strong>{tech.name}</strong>{tech.source === 'adhoc' && <span>adicional</span>}</div>
    {days.map((day) => {
      const date = isoDate(day);
      const dayItems = appointments.filter((item) => item.technician_id === tech.id && item.appointment_date === date);
      return <div key={`${tech.id}-${date}`} className={`schedule-cell ${canEdit ? 'editable' : ''}`} onClick={() => dayItems.length === 0 && onNew(date, tech.id)}>
        {dayItems.length === 0 && canEdit && <Plus className='cell-plus' size={16} />}
        {dayItems.map((item) => <button key={item.id} className='appointment-chip' style={{ background: item.status?.color_hex || '#64748b', color: item.status?.text_color || '#fff' }} onClick={(event) => { event.stopPropagation(); onEdit(item); }}><strong>{item.status?.name || 'Atendimento'}</strong>{item.amount > 0 && <span>{brl.format(item.amount)}</span>}</button>)}
      </div>;
    })}
  </>;
}

function QuickEditor({ draft, setDraft, technicians, statuses, error, onSubmit, onRemove, onClose }: {
  draft: QuickDraft;
  setDraft: (draft: QuickDraft) => void;
  technicians: Technician[];
  statuses: AppointmentStatus[];
  error: string;
  onSubmit: (event: FormEvent) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return <div className='modal-backdrop' onMouseDown={onClose}>
    <form className='quick-modal' onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
      <div className='quick-modal-head'><div><span className='eyebrow'>{draft.id ? 'EDITAR' : 'NOVO APONTAMENTO'}</span><h2>Preenchimento rápido</h2><p>Data, técnico, status e valor. Só isso.</p></div><button type='button' onClick={onClose}><X /></button></div>
      <div className='quick-fields'>
        <label>Data<input type='date' value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
        <label>Técnico<select value={draft.technicianId} onChange={(event) => setDraft({ ...draft, technicianId: event.target.value })}><option value=''>Selecione</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}</select></label>
        <label>Valor<input inputMode='decimal' value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder='0,00' /></label>
      </div>
      <div className='status-picker'><span>Status do atendimento</span><div>{statuses.map((status) => <button type='button' key={status.id} className={draft.statusId === status.id ? 'selected' : ''} style={{ background: status.color_hex, color: status.text_color }} onClick={() => setDraft({ ...draft, statusId: status.id })}>{status.name}</button>)}</div></div>
      <label className='optional-note'>Observação <span>(opcional)</span><input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder='Se precisar, escreva uma observação curta' /></label>
      {error && <div className='form-error'>{error}</div>}
      <div className='modal-actions'>{draft.id && <button type='button' className='danger-button' onClick={onRemove}>Excluir</button>}<div className='action-spacer' /><button type='button' className='ghost' onClick={onClose}>Cancelar</button><button className='primary'>Salvar</button></div>
    </form>
  </div>;
}

function EquipmentView({ query, setQuery, onSearch, loading, results }: { query: string; setQuery: (value: string) => void; onSearch: (event: FormEvent) => void; loading: boolean; results: Equipment[] }) {
  return <section className='card equipment-card'>
    <div className='card-head'><div><h2>Consulta por série</h2><p>O PROCX virou busca direta no banco.</p></div></div>
    <form className='equipment-search' onSubmit={onSearch}><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Digite a série do equipamento' /><button className='primary'>Buscar</button></form>
    {loading && <div className='empty-state'>Buscando...</div>}
    {!loading && results.length === 0 && query && <EmptyState title='Nenhum equipamento encontrado' text='Quando a base do Excel for importada, os dados aparecerão aqui.' />}
    <div className='equipment-list'>{results.map((item) => <div className='equipment-row' key={item.id}><div className='equipment-icon'><Truck /></div><div><strong>{item.serial}</strong><span>{item.client?.name || 'Cliente não informado'} · {item.model || 'Modelo não informado'}</span></div><div><span><MapPin size={14} />{[item.city, item.state].filter(Boolean).join(' - ') || 'Local não informado'}</span><span><Gauge size={14} />{item.current_hourmeter ? `${item.current_hourmeter} h` : 'Horímetro não informado'}</span></div><b className={`caretrack caretrack-${item.caretrack_status || 'cinza'}`}>{item.caretrack_status || 'cinza'}</b></div>)}</div>
  </section>;
}

function BillingView({ appointments, canEdit, onChange }: { appointments: Appointment[]; canEdit: boolean; onChange: (item: Appointment, value: string) => void }) {
  const total = appointments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const billed = appointments.filter((item) => item.billing_status === 'faturado').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return <>
    <div className='summary-grid billing-summary'><SummaryCard title='Valor da semana' value={brl.format(total)} icon={<CircleDollarSign />} compact /><SummaryCard title='Faturado' value={brl.format(billed)} icon={<WalletCards />} compact /><SummaryCard title='A faturar' value={brl.format(total - billed)} icon={<ClipboardCheck />} compact /></div>
    <section className='card'><div className='card-head'><div><h2>Status de faturamento</h2><p>Atualização rápida, sem abrir outra tela.</p></div></div><div className='billing-list'>{appointments.length === 0 && <EmptyState title='Nada nesta semana' text='Os apontamentos com valor aparecerão aqui.' />}{appointments.map((item) => <div className='billing-row' key={item.id}><div><strong>{item.technician?.name || item.technician_name_manual || 'Técnico'}</strong><span>{item.status?.name || 'Atendimento'} · {item.appointment_date.split('-').reverse().join('/')}</span></div><b>{brl.format(item.amount || 0)}</b><select disabled={!canEdit} value={item.billing_status} onChange={(event) => onChange(item, event.target.value)}><option value='nao_precificado'>Não precificado</option><option value='precificado'>Precificado</option><option value='aguardando_faturamento'>Aguardando faturamento</option><option value='faturado'>Faturado</option><option value='perdido'>Perdido</option></select></div>)}</div></section>
  </>;
}

function ComingSoon({ title, icon }: { title: string; icon: ReactNode }) {
  return <section className='card coming-card'><div className='coming-icon'>{icon}</div><h2>{title}</h2><p>A estrutura já está preparada no Supabase. Esta tela será montada depois da agenda e da base de equipamentos estarem rodando.</p></section>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className='empty-state'><strong>{title}</strong><span>{text}</span></div>;
}

export default App;
