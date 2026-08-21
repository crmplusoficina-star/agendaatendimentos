import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Gauge,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Truck,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import type { Appointment, AppointmentStatus, Branch, Equipment, Profile, Technician } from './types';

type View = 'dashboard' | 'agenda' | 'outras' | 'equipamentos' | 'faturamento' | 'retencao' | 'caretrack';
type Period = 'week' | 'month' | '3m' | '6m' | '9m' | '12m';
type QuickDraft = { id?: string; date: string; technicianId: string; statusId: string; amount: string; notes: string };
type TechnicianExt = Technician & { branch?: Branch | null };
type AppointmentExt = Appointment & { branch?: Branch | null };
type EquipmentExt = Equipment & { branch?: { name: string } | null };
type Bucket = { key: string; start: Date; end: Date; title: string; subtitle?: string };

const ALL_BRANCHES = '__all__';
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const longDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const monthTitle = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' });
const monthLong = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function parseIso(value: string) { return new Date(`${value}T12:00:00`); }
function startOfWeek(input: Date) {
  const date = new Date(input);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(input: Date, amount: number) { const date = new Date(input); date.setDate(date.getDate() + amount); return date; }
function startOfMonth(input: Date) { return new Date(input.getFullYear(), input.getMonth(), 1, 12, 0, 0, 0); }
function addMonths(input: Date, amount: number) { return new Date(input.getFullYear(), input.getMonth() + amount, 1, 12, 0, 0, 0); }
function endOfMonth(input: Date) { return new Date(input.getFullYear(), input.getMonth() + 1, 0, 12, 0, 0, 0); }
function roleLabel(role: Profile['role']) { return role === 'admin' ? 'Administrador' : role === 'gestor' ? 'Gestor' : 'Consultor'; }
function viewTitle(view: View) {
  if (view === 'dashboard') return 'Visão geral';
  if (view === 'agenda') return 'Agenda';
  if (view === 'outras') return 'Outras agendas';
  if (view === 'equipamentos') return 'Equipamentos';
  if (view === 'faturamento') return 'Faturamento';
  if (view === 'retencao') return 'Retenção';
  return 'CareTrack';
}
function periodMonths(period: Period) { return period === '3m' ? 3 : period === '6m' ? 6 : period === '9m' ? 9 : period === '12m' ? 12 : 1; }
function monthInputValue(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
function dateRangeFor(period: Period, weekStart: Date, anchor: Date) {
  if (period === 'week') return { start: weekStart, end: addDays(weekStart, 5) };
  const start = startOfMonth(anchor);
  const end = endOfMonth(addMonths(start, periodMonths(period) - 1));
  return { start, end };
}
function buildBuckets(period: Period, anchor: Date): Bucket[] {
  if (period === 'month') {
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);
    let cursor = startOfWeek(monthStart);
    const result: Bucket[] = [];
    while (cursor <= monthEnd) {
      const rawEnd = addDays(cursor, 5);
      if (rawEnd < monthStart) { cursor = addDays(cursor, 7); continue; }
      const visibleStart = cursor < monthStart ? monthStart : cursor;
      const visibleEnd = rawEnd > monthEnd ? monthEnd : rawEnd;
      result.push({
        key: isoDate(cursor),
        start: new Date(cursor),
        end: rawEnd,
        title: `${String(visibleStart.getDate()).padStart(2, '0')}–${String(visibleEnd.getDate()).padStart(2, '0')}`,
        subtitle: monthTitle.format(monthStart).replace('.', ''),
      });
      cursor = addDays(cursor, 7);
    }
    return result;
  }
  const count = periodMonths(period);
  const start = startOfMonth(anchor);
  return Array.from({ length: count }, (_, index) => {
    const month = addMonths(start, index);
    return {
      key: `${month.getFullYear()}-${month.getMonth()}`,
      start: month,
      end: endOfMonth(month),
      title: monthTitle.format(month).replace('.', ''),
    };
  });
}
function appointmentInBucket(item: AppointmentExt, bucket: Bucket) {
  const date = parseIso(item.appointment_date);
  return date >= bucket.start && date <= bucket.end;
}

export default function AppNoAuthV2() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matricula, setMatricula] = useState(() => localStorage.getItem('agenda_matricula') || '');
  const [entering, setEntering] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [ownBranches, setOwnBranches] = useState<Branch[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [browseBranchId, setBrowseBranchId] = useState('');
  const [statuses, setStatuses] = useState<AppointmentStatus[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianExt[]>([]);
  const [appointments, setAppointments] = useState<AppointmentExt[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [period, setPeriod] = useState<Period>('week');
  const [periodAnchor, setPeriodAnchor] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<View>('dashboard');
  const [loadingData, setLoadingData] = useState(false);
  const [draft, setDraft] = useState<QuickDraft | null>(null);
  const [saveError, setSaveError] = useState('');
  const [newTechName, setNewTechName] = useState('');
  const [showNewTech, setShowNewTech] = useState(false);
  const [equipmentQuery, setEquipmentQuery] = useState('');
  const [equipmentResults, setEquipmentResults] = useState<EquipmentExt[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(false);

  const enterByMatricula = useCallback(async (raw: string, silent = false) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) return;
    if (!silent) setEntering(true);
    setEntryError('');

    const { data: userData, error: userError } = await supabase
      .from('app_users')
      .select('id,matricula,full_name,role')
      .eq('matricula', clean)
      .eq('active', true)
      .maybeSingle();

    if (userError || !userData) {
      localStorage.removeItem('agenda_matricula');
      setProfile(null);
      setEntryError('Matrícula não encontrada.');
      setEntering(false);
      return;
    }

    const currentProfile = userData as Profile;
    const [statusResponse, branchResponse] = await Promise.all([
      supabase.from('appointment_statuses').select('id,name,color_hex,text_color,sort_order').eq('active', true).order('sort_order'),
      supabase.from('branches').select('id,name,slug').eq('active', true).order('name'),
    ]);
    const companyBranches = (branchResponse.data || []) as Branch[];
    setStatuses((statusResponse.data || []) as AppointmentStatus[]);
    setAllBranches(companyBranches);

    let allowed: Branch[] = companyBranches;
    if (currentProfile.role === 'consultor') {
      const { data: accessData } = await supabase
        .from('user_branches')
        .select('branches(id,name,slug)')
        .eq('user_id', currentProfile.id);
      allowed = (accessData || []).map((item: any) => item.branches).filter(Boolean) as Branch[];
      allowed.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }

    const allowedIds = new Set(allowed.map((branch) => branch.id));
    const firstOutside = companyBranches.find((branch) => !allowedIds.has(branch.id));
    setProfile(currentProfile);
    setOwnBranches(allowed);
    setBranchId(allowed.length > 1 ? ALL_BRANCHES : (allowed[0]?.id || ''));
    setBrowseBranchId(firstOutside?.id || companyBranches[0]?.id || '');
    localStorage.setItem('agenda_matricula', clean);
    setEntering(false);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('agenda_matricula');
    if (saved) enterByMatricula(saved, true);
  }, [enterByMatricula]);

  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = weekDays[5];
  const todayIso = isoDate(new Date());
  const isOtherAgenda = view === 'outras';
  const selectedBranchIds = useMemo(() => {
    if (isOtherAgenda) return browseBranchId ? [browseBranchId] : [];
    if (branchId === ALL_BRANCHES) return ownBranches.map((branch) => branch.id);
    return branchId ? [branchId] : [];
  }, [isOtherAgenda, browseBranchId, branchId, ownBranches]);
  const selectedScopeLabel = useMemo(() => {
    if (isOtherAgenda) return allBranches.find((branch) => branch.id === browseBranchId)?.name || 'Filial';
    if (branchId === ALL_BRANCHES) return profile?.role === 'consultor' ? 'Todas as minhas filiais' : 'Todas as filiais';
    return ownBranches.find((branch) => branch.id === branchId)?.name || 'Filial';
  }, [isOtherAgenda, allBranches, browseBranchId, branchId, ownBranches, profile]);
  const currentSpecificBranchId = !isOtherAgenda && branchId !== ALL_BRANCHES ? branchId : '';
  const baseCanEdit = profile?.role === 'consultor' || profile?.role === 'admin';
  const canEdit = Boolean(baseCanEdit && !isOtherAgenda && currentSpecificBranchId);
  const periodRange = useMemo(() => dateRangeFor(period, weekStart, periodAnchor), [period, weekStart, periodAnchor]);

  const loadAgenda = useCallback(async () => {
    if (!profile || selectedBranchIds.length === 0) {
      setTechnicians([]);
      setAppointments([]);
      return;
    }
    setLoadingData(true);
    const useExtendedPeriod = view === 'agenda' || view === 'outras';
    const currentWeekStart = startOfWeek(new Date());
    const range = useExtendedPeriod ? periodRange : view === 'dashboard' ? { start: currentWeekStart, end: addDays(currentWeekStart, 5) } : { start: weekStart, end: weekEnd };

    let techQuery: any = supabase
      .from('technicians')
      .select('id,branch_id,name,source,branch:branches(id,name,slug)')
      .eq('active', true);
    let appointmentQuery: any = supabase
      .from('appointments')
      .select('id,branch_id,appointment_date,technician_id,technician_name_manual,status_id,amount,notes,billing_status,invoice_number,status:appointment_statuses(id,name,color_hex,text_color,sort_order),technician:technicians(id,name),branch:branches(id,name,slug)')
      .is('deleted_at', null)
      .gte('appointment_date', isoDate(range.start))
      .lte('appointment_date', isoDate(range.end));

    if (selectedBranchIds.length === 1) {
      techQuery = techQuery.eq('branch_id', selectedBranchIds[0]);
      appointmentQuery = appointmentQuery.eq('branch_id', selectedBranchIds[0]);
    } else {
      techQuery = techQuery.in('branch_id', selectedBranchIds);
      appointmentQuery = appointmentQuery.in('branch_id', selectedBranchIds);
    }

    const [techResponse, appointmentResponse] = await Promise.all([
      techQuery.order('name'),
      appointmentQuery.order('appointment_date'),
    ]);
    const loadedTechnicians = ((techResponse.data || []) as unknown as TechnicianExt[]).sort((a, b) => {
      const branchCompare = (a.branch?.name || '').localeCompare(b.branch?.name || '', 'pt-BR');
      return branchCompare || a.name.localeCompare(b.name, 'pt-BR');
    });
    setTechnicians(loadedTechnicians);
    setAppointments((appointmentResponse.data || []) as unknown as AppointmentExt[]);
    setLoadingData(false);
  }, [profile, selectedBranchIds, view, periodRange, weekStart, weekEnd]);

  useEffect(() => { loadAgenda(); }, [loadAgenda]);

  function leaveProfile() {
    localStorage.removeItem('agenda_matricula');
    setProfile(null);
    setOwnBranches([]);
    setAllBranches([]);
    setBranchId('');
    setBrowseBranchId('');
    setAppointments([]);
    setTechnicians([]);
    setMatricula('');
    setView('dashboard');
    setPeriod('week');
  }
  function openNew(date: string, technicianId: string) {
    if (!canEdit) return;
    setSaveError('');
    setDraft({ date, technicianId, statusId: statuses[0]?.id || '', amount: '', notes: '' });
  }
  function openEdit(item: AppointmentExt) {
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
    if (!draft || !profile || !currentSpecificBranchId) return;
    if (!draft.date || !draft.technicianId || !draft.statusId) {
      setSaveError('Preencha data, técnico e status.');
      return;
    }
    const payload = {
      branch_id: currentSpecificBranchId,
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
    if (!draft?.id || !profile || !canEdit) return;
    const { error } = await supabase
      .from('appointments')
      .update({ deleted_at: new Date().toISOString(), updated_by: profile.id })
      .eq('id', draft.id);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setDraft(null);
    await loadAgenda();
  }
  async function addTechnician(event: FormEvent) {
    event.preventDefault();
    const name = newTechName.trim();
    if (!name || !currentSpecificBranchId || !canEdit) return;
    const { error } = await supabase.from('technicians').insert({ branch_id: currentSpecificBranchId, name, source: 'adhoc' });
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
    if (!query || selectedBranchIds.length === 0) return;
    setEquipmentLoading(true);
    let equipmentQueryBuilder: any = supabase
      .from('equipment')
      .select('id,serial,manufacturer,model,city,state,current_hourmeter,hourmeter_date,caretrack_status,client:clients(name),branch:branches(name)')
      .ilike('serial', `%${query}%`)
      .limit(30);
    if (selectedBranchIds.length === 1) equipmentQueryBuilder = equipmentQueryBuilder.eq('branch_id', selectedBranchIds[0]);
    else equipmentQueryBuilder = equipmentQueryBuilder.in('branch_id', selectedBranchIds);
    const { data } = await equipmentQueryBuilder;
    setEquipmentResults((data || []) as unknown as EquipmentExt[]);
    setEquipmentLoading(false);
  }
  async function updateBilling(item: AppointmentExt, value: string) {
    if (!profile || !canEdit) return;
    await supabase.from('appointments').update({ billing_status: value, updated_by: profile.id }).eq('id', item.id);
    await loadAgenda();
  }
  function changePeriod(next: Period) {
    if (next !== 'week' && period === 'week') setPeriodAnchor(startOfMonth(weekStart));
    setPeriod(next);
  }
  function drillPeriod(bucket: Bucket) {
    if (period === 'month') {
      setWeekStart(startOfWeek(bucket.start));
      setPeriod('week');
    } else {
      setPeriodAnchor(startOfMonth(bucket.start));
      setPeriod('month');
    }
  }

  if (!profile) {
    return (
      <div className='matricula-screen'>
        <form className='matricula-card' onSubmit={(event) => { event.preventDefault(); enterByMatricula(matricula); }}>
          <div className='matricula-icon'><UserRound /></div>
          <h1>Agenda de Atendimentos</h1>
          <p>Digite somente sua matrícula para entrar.</p>
          <label>Matrícula<input autoFocus inputMode='numeric' value={matricula} onChange={(event) => setMatricula(event.target.value.replace(/\D/g, ''))} placeholder='Ex.: 19124' /></label>
          {entryError && <div className='form-error'>{entryError}</div>}
          <button className='primary-button' disabled={entering || !matricula.trim()}>{entering ? 'Entrando...' : 'Entrar'}</button>
          <small>Projeto interno · sem senha</small>
        </form>
      </div>
    );
  }

  const todayAppointments = appointments.filter((item) => item.appointment_date === todayIso);
  const weeklyAmount = appointments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const activeTechCount = new Set(appointments.map((item) => item.technician_id).filter(Boolean)).size;
  const noAgenda = statuses.find((status) => status.name === 'Sem agenda');
  const noAgendaCount = noAgenda ? appointments.filter((item) => item.status_id === noAgenda.id).length : 0;
  const showBranchOnRows = selectedBranchIds.length > 1;

  return (
    <div className='internal-app'>
      <aside className='internal-sidebar'>
        <div className='internal-brand'><div className='brand-square'><CalendarDays /></div><div><strong>Agenda</strong><span>Atendimentos</span></div></div>
        <nav>
          <Nav active={view === 'dashboard'} icon={<LayoutDashboard />} label='Visão geral' onClick={() => setView('dashboard')} />
          <Nav active={view === 'agenda'} icon={<CalendarDays />} label='Agenda' onClick={() => setView('agenda')} />
          <Nav active={view === 'outras'} icon={<Building2 />} label='Outras agendas' onClick={() => setView('outras')} />
          <Nav active={view === 'equipamentos'} icon={<Truck />} label='Equipamentos' onClick={() => setView('equipamentos')} />
          <Nav active={view === 'faturamento'} icon={<WalletCards />} label='Faturamento' onClick={() => setView('faturamento')} />
          <div className='nav-section'>CONTROLES</div>
          <Nav active={view === 'retencao'} icon={<ClipboardCheck />} label='Retenção' onClick={() => setView('retencao')} />
          <Nav active={view === 'caretrack'} icon={<Gauge />} label='CareTrack' onClick={() => setView('caretrack')} />
        </nav>
        <div className='user-block'>
          <div className='user-avatar'>{profile.full_name.charAt(0)}</div>
          <div><strong>{profile.full_name}</strong><span>{profile.matricula} · {roleLabel(profile.role)}</span></div>
          <button title='Trocar matrícula' onClick={leaveProfile}><LogOut /></button>
        </div>
      </aside>

      <main className='internal-main'>
        <header className='internal-topbar'>
          <div>
            <h1>{viewTitle(view)}</h1>
            <p>{view === 'agenda' ? 'A visão semanal continua igual; escolha períodos maiores quando quiser.' : view === 'outras' ? 'Consulte a agenda de qualquer outra filial em modo leitura.' : 'Controle rápido por filial.'}</p>
          </div>
          <div className='topbar-right'>
            {isOtherAgenda ? (
              <label>Filial consultada
                <select value={browseBranchId} onChange={(event) => setBrowseBranchId(event.target.value)}>
                  {allBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
            ) : (
              <label>Filial
                <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                  {ownBranches.length > 1 && <option value={ALL_BRANCHES}>{profile.role === 'consultor' ? 'Todas as minhas filiais' : 'Todas as filiais'}</option>}
                  {ownBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
            )}
            <span className='profile-badge'>{roleLabel(profile.role)}</span>
          </div>
        </header>

        <div className='internal-content'>
          {view === 'dashboard' && (
            <>
              <div className='summary-grid'>
                <Summary label='Hoje' value={String(todayAppointments.length)} detail='atendimentos' />
                <Summary label='Técnicos na semana' value={String(activeTechCount)} detail='com apontamento' />
                <Summary label='Sem agenda' value={String(noAgendaCount)} detail='na semana' />
                <Summary label='Valor da semana' value={brl.format(weeklyAmount)} detail='previsto' />
              </div>
              <section className='clean-panel'>
                <div className='panel-heading'><div><h2>Hoje · {selectedScopeLabel}</h2><p>Resumo operacional do dia</p></div><button className='link-button' onClick={() => setView('agenda')}>Abrir agenda</button></div>
                {todayAppointments.length === 0 ? <Empty text='Nenhum atendimento apontado para hoje.' /> : <div>{todayAppointments.map((item) => <AppointmentLine key={item.id} item={item} showBranch={showBranchOnRows} onClick={canEdit ? () => openEdit(item) : undefined} />)}</div>}
              </section>
              <section className='clean-panel compact-status-panel'>
                <div className='panel-heading'><div><h2>Cores de atendimento</h2><p>Padrão utilizado na agenda</p></div></div>
                <div className='status-legend'>{statuses.map((status) => <span key={status.id}><i style={{ background: status.color_hex }} />{status.name}</span>)}</div>
              </section>
            </>
          )}

          {(view === 'agenda' || view === 'outras') && (
            <AgendaBoard
              scopeLabel={selectedScopeLabel}
              period={period}
              periodAnchor={periodAnchor}
              periodRange={periodRange}
              weekStart={weekStart}
              weekEnd={weekEnd}
              weekDays={weekDays}
              technicians={technicians}
              appointments={appointments}
              statuses={statuses}
              loading={loadingData}
              canEdit={canEdit && view === 'agenda'}
              readOnly={view === 'outras' || branchId === ALL_BRANCHES}
              showBranch={showBranchOnRows}
              onPeriodChange={changePeriod}
              onAnchorChange={setPeriodAnchor}
              onWeekStartChange={setWeekStart}
              onAddTech={() => setShowNewTech(true)}
              onOpenNew={openNew}
              onOpenEdit={openEdit}
              onDrill={drillPeriod}
            />
          )}

          {view === 'equipamentos' && (
            <section className='clean-panel'>
              <div className='panel-heading'><div><h2>Consulta por série · {selectedScopeLabel}</h2><p>Digite a série e o sistema busca os dados do equipamento.</p></div></div>
              <form className='equipment-search' onSubmit={searchEquipment}><Search /><input value={equipmentQuery} onChange={(event) => setEquipmentQuery(event.target.value)} placeholder='Número de série' /><button className='primary-button'>Buscar</button></form>
              {equipmentLoading ? <Empty text='Buscando...' /> : equipmentResults.length === 0 ? <Empty text={equipmentQuery ? 'Nenhum equipamento encontrado.' : 'Digite uma série para consultar.'} /> : <div className='equipment-table'>{equipmentResults.map((item) => <div className='equipment-row' key={item.id}><div><strong>{item.serial}</strong><span>{item.client?.name || 'Cliente não informado'}{item.branch?.name ? ` · ${item.branch.name}` : ''}</span></div><div><span>Modelo</span><strong>{item.model || '—'}</strong></div><div><span>Cidade</span><strong>{[item.city, item.state].filter(Boolean).join(' - ') || '—'}</strong></div><div><span>Horímetro</span><strong>{item.current_hourmeter ?? '—'}</strong></div><div><span>CareTrack</span><strong>{item.caretrack_status || '—'}</strong></div></div>)}</div>}
            </section>
          )}

          {view === 'faturamento' && (
            <section className='clean-panel'>
              <div className='panel-heading'><div><h2>Faturamento da semana · {selectedScopeLabel}</h2><p>Atualize o status sem sair da tela.</p></div></div>
              {appointments.length === 0 ? <Empty text='Nenhum atendimento na semana selecionada.' /> : <div className='billing-list'>{appointments.map((item) => <div className='billing-row' key={item.id}><div><strong>{item.technician?.name || 'Técnico'}{showBranchOnRows && item.branch?.name ? ` · ${item.branch.name}` : ''}</strong><span>{shortDate.format(parseIso(item.appointment_date))} · {item.status?.name || ''}</span></div><strong>{brl.format(Number(item.amount || 0))}</strong><select disabled={!canEdit} value={item.billing_status} onChange={(event) => updateBilling(item, event.target.value)}><option value='nao_precificado'>Não precificado</option><option value='precificado'>Precificado</option><option value='aguardando_faturamento'>Aguardando faturamento</option><option value='faturado'>Faturado</option><option value='perdido'>Perdido</option></select></div>)}</div>}
            </section>
          )}

          {view === 'retencao' && <ModulePlaceholder title='Retenção' text='Aqui ficará o fluxo de contato, retorno do cliente, retenção e motivo de perda.' />}
          {view === 'caretrack' && <ModulePlaceholder title='CareTrack' text='Aqui ficará o histórico de verificação, alertas e ações por equipamento.' />}
        </div>
      </main>

      {draft && (
        <div className='modal-layer' onMouseDown={() => setDraft(null)}>
          <form className='quick-modal' onSubmit={saveAppointment} onMouseDown={(event) => event.stopPropagation()}>
            <div className='quick-modal-head'><div><h2>{draft.id ? 'Editar apontamento' : 'Novo apontamento'}</h2><p>Preenchimento rápido, estilo planilha.</p></div><button type='button' onClick={() => setDraft(null)}><X /></button></div>
            <div className='quick-form'>
              <label>Data<input type='date' value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
              <label>Técnico<select value={draft.technicianId} onChange={(event) => setDraft({ ...draft, technicianId: event.target.value })}>{technicians.filter((tech) => tech.branch_id === currentSpecificBranchId).map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}</select></label>
              <label className='full-field'>Status<select value={draft.statusId} onChange={(event) => setDraft({ ...draft, statusId: event.target.value })}>{statuses.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label>
              <label>Valor<input inputMode='decimal' value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder='0,00' /></label>
              <label>Observação<input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder='Opcional' /></label>
            </div>
            {saveError && <div className='form-error modal-error'>{saveError}</div>}
            <div className='quick-actions'>{draft.id && <button type='button' className='danger-button' onClick={removeAppointment}>Excluir</button>}<span /><button type='button' className='secondary-button' onClick={() => setDraft(null)}>Cancelar</button><button className='primary-button'>Salvar</button></div>
          </form>
        </div>
      )}

      {showNewTech && (
        <div className='modal-layer' onMouseDown={() => setShowNewTech(false)}>
          <form className='small-modal' onSubmit={addTechnician} onMouseDown={(event) => event.stopPropagation()}>
            <div className='quick-modal-head'><div><h2>Técnico adicional</h2><p>Somente o nome. Nada além disso.</p></div><button type='button' onClick={() => setShowNewTech(false)}><X /></button></div>
            <label>Nome<input autoFocus value={newTechName} onChange={(event) => setNewTechName(event.target.value)} placeholder='Nome do técnico' /></label>
            <div className='quick-actions'><span /><span /><button type='button' className='secondary-button' onClick={() => setShowNewTech(false)}>Cancelar</button><button className='primary-button'>Adicionar</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function AgendaBoard({
  scopeLabel,
  period,
  periodAnchor,
  periodRange,
  weekStart,
  weekEnd,
  weekDays,
  technicians,
  appointments,
  statuses,
  loading,
  canEdit,
  readOnly,
  showBranch,
  onPeriodChange,
  onAnchorChange,
  onWeekStartChange,
  onAddTech,
  onOpenNew,
  onOpenEdit,
  onDrill,
}: {
  scopeLabel: string;
  period: Period;
  periodAnchor: Date;
  periodRange: { start: Date; end: Date };
  weekStart: Date;
  weekEnd: Date;
  weekDays: Date[];
  technicians: TechnicianExt[];
  appointments: AppointmentExt[];
  statuses: AppointmentStatus[];
  loading: boolean;
  canEdit: boolean;
  readOnly: boolean;
  showBranch: boolean;
  onPeriodChange: (period: Period) => void;
  onAnchorChange: (date: Date) => void;
  onWeekStartChange: (date: Date) => void;
  onAddTech: () => void;
  onOpenNew: (date: string, technicianId: string) => void;
  onOpenEdit: (item: AppointmentExt) => void;
  onDrill: (bucket: Bucket) => void;
}) {
  const rangeLabel = period === 'week'
    ? `${longDate.format(weekStart)} — ${longDate.format(weekEnd)}`
    : period === 'month'
      ? monthLong.format(periodAnchor)
      : `${longDate.format(periodRange.start)} — ${longDate.format(periodRange.end)}`;
  return (
    <section className='clean-panel agenda-panel'>
      <div className='agenda-toolbar agenda-toolbar-v2'>
        <div><h2>{scopeLabel}</h2><p>{rangeLabel}</p></div>
        <div className='agenda-actions agenda-actions-v2'>
          <label className='period-control'>Período
            <select value={period} onChange={(event) => onPeriodChange(event.target.value as Period)}>
              <option value='week'>Semana</option>
              <option value='month'>Mês</option>
              <option value='3m'>3 meses</option>
              <option value='6m'>6 meses</option>
              <option value='9m'>9 meses</option>
              <option value='12m'>12 meses</option>
            </select>
          </label>
          {period === 'week' ? (
            <>
              {canEdit && <button className='secondary-button' onClick={onAddTech}><Plus /> Técnico adicional</button>}
              <button onClick={() => onWeekStartChange(startOfWeek(new Date()))}>Hoje</button>
              <button aria-label='Semana anterior' onClick={() => onWeekStartChange(addDays(weekStart, -7))}><ChevronLeft /></button>
              <button aria-label='Próxima semana' onClick={() => onWeekStartChange(addDays(weekStart, 7))}><ChevronRight /></button>
            </>
          ) : (
            <>
              <label className='period-control reference-control'>Referência
                <input type='month' value={monthInputValue(periodAnchor)} onChange={(event) => event.target.value && onAnchorChange(new Date(`${event.target.value}-01T12:00:00`))} />
              </label>
              <button onClick={() => onAnchorChange(startOfMonth(new Date()))}>Hoje</button>
            </>
          )}
        </div>
      </div>
      <div className='agenda-hint'>{readOnly ? 'Visualização somente leitura. Escolha uma filial própria para editar.' : period === 'week' ? 'Clique em qualquer espaço da grade para apontar.' : 'Visão consolidada. Clique em um período para detalhar até chegar à semana.'}</div>
      {period === 'week' ? (
        <WeeklySheet
          weekDays={weekDays}
          technicians={technicians}
          appointments={appointments}
          loading={loading}
          canEdit={canEdit}
          showBranch={showBranch}
          onOpenNew={onOpenNew}
          onOpenEdit={onOpenEdit}
        />
      ) : (
        <PeriodOverview
          period={period}
          anchor={periodAnchor}
          technicians={technicians}
          appointments={appointments}
          statuses={statuses}
          loading={loading}
          showBranch={showBranch}
          onDrill={onDrill}
        />
      )}
    </section>
  );
}

function WeeklySheet({ weekDays, technicians, appointments, loading, canEdit, showBranch, onOpenNew, onOpenEdit }: {
  weekDays: Date[];
  technicians: TechnicianExt[];
  appointments: AppointmentExt[];
  loading: boolean;
  canEdit: boolean;
  showBranch: boolean;
  onOpenNew: (date: string, technicianId: string) => void;
  onOpenEdit: (item: AppointmentExt) => void;
}) {
  return (
    <div className='sheet-wrap'>
      <div className='sheet-grid sheet-head'><div className='tech-head'>Técnico</div>{weekDays.map((day) => <div key={isoDate(day)}><strong>{weekday.format(day).replace('.', '')}</strong><span>{shortDate.format(day)}</span></div>)}</div>
      {loading ? <div className='sheet-loading'>Carregando agenda...</div> : technicians.length === 0 ? <Empty text='Nenhum técnico cadastrado nesta filial.' /> : technicians.map((tech) => (
        <div className='sheet-grid sheet-row' key={tech.id}>
          <div className='tech-name'><strong>{tech.name}</strong>{showBranch && tech.branch?.name && <span className='branch-mini'>{tech.branch.name}</span>}{tech.source === 'adhoc' && <span>adicional</span>}</div>
          {weekDays.map((day) => {
            const date = isoDate(day);
            const items = appointments.filter((item) => item.technician_id === tech.id && item.appointment_date === date);
            return (
              <div className={`sheet-cell ${canEdit ? 'clickable' : ''}`} key={date} onClick={() => items.length === 0 && onOpenNew(date, tech.id)}>
                {items.length === 0 && canEdit && <span className='cell-plus'>+</span>}
                {items.map((item) => <button key={item.id} className='appointment-chip' onClick={(event) => { event.stopPropagation(); if (canEdit) onOpenEdit(item); }} style={{ background: item.status?.color_hex || '#64748b', color: item.status?.text_color || '#fff', cursor: canEdit ? 'pointer' : 'default' }}><strong>{item.status?.name || 'Atendimento'}</strong>{Number(item.amount || 0) > 0 && <span>{brl.format(Number(item.amount))}</span>}</button>)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PeriodOverview({ period, anchor, technicians, appointments, statuses, loading, showBranch, onDrill }: {
  period: Period;
  anchor: Date;
  technicians: TechnicianExt[];
  appointments: AppointmentExt[];
  statuses: AppointmentStatus[];
  loading: boolean;
  showBranch: boolean;
  onDrill: (bucket: Bucket) => void;
}) {
  const buckets = useMemo(() => buildBuckets(period, anchor), [period, anchor]);
  const gridStyle = { gridTemplateColumns: `170px repeat(${buckets.length}, minmax(125px, 1fr))`, minWidth: `${170 + buckets.length * 125}px` };
  if (loading) return <div className='sheet-loading'>Carregando período...</div>;
  if (technicians.length === 0) return <Empty text='Nenhum técnico cadastrado para esta seleção.' />;
  return (
    <div className='period-wrap'>
      <div className='period-grid period-head' style={gridStyle}><div className='period-tech-head'>Técnico</div>{buckets.map((bucket) => <div key={bucket.key}><strong>{bucket.title}</strong>{bucket.subtitle && <span>{bucket.subtitle}</span>}</div>)}</div>
      {technicians.map((tech) => (
        <div className='period-grid period-row' style={gridStyle} key={tech.id}>
          <div className='period-tech-name'><strong>{tech.name}</strong>{showBranch && tech.branch?.name && <span>{tech.branch.name}</span>}</div>
          {buckets.map((bucket) => {
            const items = appointments.filter((item) => item.technician_id === tech.id && appointmentInBucket(item, bucket));
            return <PeriodCell key={bucket.key} items={items} statuses={statuses} onClick={() => onDrill(bucket)} />;
          })}
        </div>
      ))}
    </div>
  );
}

function PeriodCell({ items, statuses, onClick }: { items: AppointmentExt[]; statuses: AppointmentStatus[]; onClick: () => void }) {
  if (items.length === 0) return <button className='period-cell empty-period-cell' onClick={onClick}><span>—</span></button>;
  const amount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const counts = statuses
    .map((status) => ({ status, count: items.filter((item) => item.status_id === status.id).length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
  return (
    <button className='period-cell' onClick={onClick}>
      <div className='period-cell-top'><strong>{items.length}</strong><span>apont.</span></div>
      {amount > 0 && <b>{brl.format(amount)}</b>}
      <div className='period-status-mini'>{counts.slice(0, 3).map(({ status, count }) => <span key={status.id} title={status.name}><i style={{ background: status.color_hex }} />{count}</span>)}{counts.length > 3 && <em>+{counts.length - 3}</em>}</div>
    </button>
  );
}

function Nav({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) { return <button className={`side-link ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>; }
function Summary({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className='summary-card'><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function AppointmentLine({ item, showBranch, onClick }: { item: AppointmentExt; showBranch: boolean; onClick?: () => void }) { return <button className='today-row' onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}><i style={{ background: item.status?.color_hex || '#64748b' }} /><div><strong>{item.technician?.name || 'Técnico'}{showBranch && item.branch?.name ? ` · ${item.branch.name}` : ''}</strong><span>{item.status?.name || 'Atendimento'}</span></div><b>{Number(item.amount || 0) > 0 ? brl.format(Number(item.amount)) : '—'}</b></button>; }
function Empty({ text }: { text: string }) { return <div className='empty-state'>{text}</div>; }
function ModulePlaceholder({ title, text }: { title: string; text: string }) { return <section className='clean-panel module-placeholder'><div className='module-icon'><ClipboardCheck /></div><h2>{title}</h2><p>{text}</p><span>Estrutura pronta para a próxima etapa.</span></section>; }
