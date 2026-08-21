import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarClock, ChevronRight, Search, UserRound, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { Profile } from './types';

type ActionRow = {
  id: string;
  client_name: string;
  serial: string | null;
  city: string | null;
  branch_name: string | null;
  last_service_date_snapshot: string | null;
  treatment_type: string;
  followup_status: string;
  classification: string | null;
  estimated_value: number | null;
  next_followup_date: string | null;
  notes: string | null;
  activity_date: string;
  created_by: string | null;
  responsible_user_id: string | null;
  created_at: string;
  responsible?: { id: string; full_name: string; role: string } | null;
  author?: { id: string; full_name: string } | null;
};

type UserOption = { id: string; full_name: string; role: string };
type Draft = {
  clientName: string;
  serial: string;
  city: string;
  branchName: string;
  activityDate: string;
  treatmentType: string;
  status: string;
  classification: string;
  estimatedValue: string;
  nextFollowupDate: string;
  responsibleUserId: string;
  notes: string;
};

type Props = {
  profile: Profile;
  branchNames: string[];
  allBranchCount: number;
  canEdit: boolean;
  scopeLabel: string;
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
function todayIso() { return new Date().toISOString().slice(0, 10); }
function parseIso(value: string) { return new Date(`${value}T12:00:00`); }
function normalize(value?: string | null) { return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim(); }
function moneyToNumber(raw: string) {
  const clean = raw.trim().replace(/\s/g, '');
  if (!clean) return null;
  if (clean.includes(',')) return Number(clean.replace(/\./g, '').replace(',', '.')) || null;
  return Number(clean) || null;
}
function statusLabel(value: string) {
  const labels: Record<string, string> = {
    contato_realizado: 'Contato realizado', oportunidade: 'Oportunidade', retorno_agendado: 'Retorno agendado',
    agendamento_criado: 'Agendamento criado', convertido: 'Convertido', sem_resposta: 'Sem resposta',
    sem_interesse: 'Sem interesse', perdido: 'Perdido',
  };
  return labels[value] || value;
}
function treatmentLabel(value: string) {
  const labels: Record<string, string> = {
    atendimento: 'Atendimento', venda_pecas: 'Venda de peças', venda_servicos: 'Venda de serviços',
    visita: 'Visita', retorno: 'Retorno', sem_resposta: 'Tentativa sem resposta', outro: 'Outro',
  };
  return labels[value] || value;
}

export function ContactUpdatesPanel({ profile, branchNames, allBranchCount, canEdit, scopeLabel }: Props) {
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('todas');
  const [responsibleFilter, setResponsibleFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [dueFilter, setDueFilter] = useState('todos');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [actionsResponse, usersResponse] = await Promise.all([
      supabase.from('followup_actions').select('id,client_name,serial,city,branch_name,last_service_date_snapshot,treatment_type,followup_status,classification,estimated_value,next_followup_date,notes,activity_date,created_by,responsible_user_id,created_at,responsible:app_users!followup_actions_responsible_user_id_fkey(id,full_name,role),author:app_users!followup_actions_created_by_fkey(id,full_name)').order('activity_date', { ascending: false }).order('created_at', { ascending: false }).limit(1200),
      supabase.from('app_users').select('id,full_name,role').eq('active', true).order('full_name'),
    ]);
    let rows = (actionsResponse.data || []) as unknown as ActionRow[];
    if (branchNames.length > 0 && branchNames.length < allBranchCount) {
      const allowed = new Set(branchNames.map(normalize));
      rows = rows.filter((row) => allowed.has(normalize(row.branch_name)));
    }
    setActions(rows);
    setUsers((usersResponse.data || []) as UserOption[]);
    setError(actionsResponse.error?.message || usersResponse.error?.message || '');
    setLoading(false);
  }, [branchNames, allBranchCount]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setBranchFilter('todas'); }, [scopeLabel]);

  const latestByClient = useMemo(() => {
    const map = new Map<string, ActionRow>();
    for (const action of actions) if (!map.has(action.client_name)) map.set(action.client_name, action);
    return [...map.values()];
  }, [actions]);

  const availableBranches = useMemo(() => {
    const fromRows = actions.map((row) => row.branch_name).filter(Boolean) as string[];
    return [...new Set([...branchNames, ...fromRows])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [actions, branchNames]);

  const filtered = useMemo(() => latestByClient.filter((row) => {
    const term = query.trim().toLowerCase();
    const text = `${row.client_name} ${row.city || ''} ${row.serial || ''} ${row.branch_name || ''} ${row.responsible?.full_name || ''}`.toLowerCase();
    const due = row.next_followup_date;
    const today = todayIso();
    return (!term || text.includes(term))
      && (branchFilter === 'todas' || normalize(row.branch_name) === normalize(branchFilter))
      && (responsibleFilter === 'todos' || row.responsible_user_id === responsibleFilter)
      && (statusFilter === 'todos' || row.followup_status === statusFilter)
      && (dueFilter === 'todos' || (dueFilter === 'vencidos' && !!due && due < today) || (dueFilter === 'hoje' && due === today) || (dueFilter === 'futuros' && !!due && due > today) || (dueFilter === 'sem_data' && !due));
  }), [latestByClient, query, branchFilter, responsibleFilter, statusFilter, dueFilter]);

  const kpis = useMemo(() => {
    const today = todayIso();
    const updatesToday = actions.filter((row) => row.activity_date === today).length;
    const overdue = latestByClient.filter((row) => row.next_followup_date && row.next_followup_date < today && !['convertido', 'perdido', 'sem_interesse'].includes(row.followup_status)).length;
    const opportunities = latestByClient.filter((row) => row.followup_status === 'oportunidade').length;
    const pipeline = latestByClient.reduce((sum, row) => sum + Number(row.estimated_value || 0), 0);
    const converted = latestByClient.filter((row) => row.followup_status === 'convertido').length;
    return { updatesToday, overdue, opportunities, pipeline, converted };
  }, [actions, latestByClient]);

  const funnel = useMemo(() => {
    const stages = [
      { key: 'contato', label: 'Contatados', test: (r: ActionRow) => ['contato_realizado', 'oportunidade', 'retorno_agendado', 'agendamento_criado', 'convertido'].includes(r.followup_status) },
      { key: 'oportunidade', label: 'Oportunidades', test: (r: ActionRow) => ['oportunidade', 'retorno_agendado', 'agendamento_criado', 'convertido'].includes(r.followup_status) },
      { key: 'retorno', label: 'Retornos', test: (r: ActionRow) => ['retorno_agendado', 'agendamento_criado', 'convertido'].includes(r.followup_status) },
      { key: 'agenda', label: 'Agendamentos', test: (r: ActionRow) => ['agendamento_criado', 'convertido'].includes(r.followup_status) },
      { key: 'convertido', label: 'Convertidos', test: (r: ActionRow) => r.followup_status === 'convertido' },
    ];
    const result = stages.map((stage) => ({ ...stage, count: latestByClient.filter(stage.test).length }));
    const max = Math.max(result[0]?.count || 0, 1);
    return result.map((stage) => ({ ...stage, pct: Math.max((stage.count / max) * 100, stage.count ? 12 : 4) }));
  }, [latestByClient]);

  const selectedHistory = useMemo(() => selectedClient ? actions.filter((row) => row.client_name === selectedClient) : [], [actions, selectedClient]);

  function openUpdate(row: ActionRow) {
    setDraft({
      clientName: row.client_name,
      serial: row.serial || '',
      city: row.city || '',
      branchName: row.branch_name || (branchNames[0] || ''),
      activityDate: todayIso(),
      treatmentType: 'retorno',
      status: row.followup_status === 'convertido' ? 'convertido' : 'contato_realizado',
      classification: row.classification || '',
      estimatedValue: row.estimated_value ? String(row.estimated_value).replace('.', ',') : '',
      nextFollowupDate: '',
      responsibleUserId: row.responsible_user_id || profile.id,
      notes: '',
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !canEdit) return;
    setError('');
    const { error: insertError } = await supabase.from('followup_actions').insert({
      client_name: draft.clientName,
      serial: draft.serial || null,
      city: draft.city || null,
      branch_name: draft.branchName || null,
      activity_date: draft.activityDate,
      treatment_type: draft.treatmentType,
      followup_status: draft.status,
      classification: draft.classification || null,
      estimated_value: moneyToNumber(draft.estimatedValue),
      next_followup_date: draft.nextFollowupDate || null,
      notes: draft.notes.trim() || null,
      responsible_user_id: draft.responsibleUserId || profile.id,
      created_by: profile.id,
    });
    if (insertError) { setError(insertError.message); return; }
    setDraft(null);
    await load();
  }

  return <section className='contact-updates-page'>
    <div className='contact-kpi-grid'>
      <div><span>Clientes em acompanhamento</span><strong>{latestByClient.length}</strong><small>com histórico registrado</small></div>
      <div><span>Atualizações hoje</span><strong>{kpis.updatesToday}</strong><small>atividades registradas</small></div>
      <div><span>Retornos vencidos</span><strong>{kpis.overdue}</strong><small>precisam de ação</small></div>
      <div><span>Oportunidades</span><strong>{kpis.opportunities}</strong><small>em aberto</small></div>
      <div><span>Pipeline</span><strong>{brl.format(kpis.pipeline)}</strong><small>valor estimado</small></div>
      <div><span>Convertidos</span><strong>{kpis.converted}</strong><small>serviços fechados</small></div>
    </div>

    <div className='contact-dashboard-grid'>
      <section className='clean-panel contact-funnel-panel'>
        <div className='panel-heading'><div><h2>Funil de serviços</h2><p>Da tratativa inicial até a conversão em serviço.</p></div></div>
        <div className='service-funnel'>{funnel.map((stage) => <div className='funnel-stage' key={stage.key}><div className='funnel-label'><span>{stage.label}</span><strong>{stage.count}</strong></div><div className='funnel-track'><i style={{ width: `${stage.pct}%` }} /></div></div>)}</div>
      </section>
      <section className='clean-panel contact-alert-panel'>
        <div className='panel-heading'><div><h2><CalendarClock /> Próximas ações</h2><p>Retornos que exigem atenção.</p></div></div>
        <div className='next-actions-list'>{latestByClient.filter((row) => row.next_followup_date).sort((a, b) => (a.next_followup_date || '').localeCompare(b.next_followup_date || '')).slice(0, 7).map((row) => <button key={row.client_name} onClick={() => setSelectedClient(row.client_name)}><div><strong>{row.client_name}</strong><span>{row.responsible?.full_name || 'Sem responsável'} · {row.branch_name || 'Sem filial'}</span></div><b>{row.next_followup_date ? dateFmt.format(parseIso(row.next_followup_date)) : '—'}</b></button>)}{latestByClient.every((row) => !row.next_followup_date) && <div className='empty-state'>Nenhum retorno programado.</div>}</div>
      </section>
    </div>

    <section className='clean-panel contact-list-panel'>
      <div className='panel-heading'><div><h2>Acompanhamentos · {scopeLabel}</h2><p>Clique em um cliente para abrir todo o histórico de contatos, visitas e próximos passos.</p></div></div>
      <div className='contact-filterbar'>
        <div className='inline-search'><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Cliente, cidade, série ou responsável' /></div>
        <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}><option value='todas'>Todas as filiais</option>{availableBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select>
        <select value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)}><option value='todos'>Todos os responsáveis</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value='todos'>Todos os status</option><option value='contato_realizado'>Contato realizado</option><option value='oportunidade'>Oportunidade</option><option value='retorno_agendado'>Retorno agendado</option><option value='agendamento_criado'>Agendamento criado</option><option value='convertido'>Convertido</option><option value='sem_resposta'>Sem resposta</option><option value='sem_interesse'>Sem interesse</option><option value='perdido'>Perdido</option></select>
        <select value={dueFilter} onChange={(event) => setDueFilter(event.target.value)}><option value='todos'>Todas as datas</option><option value='vencidos'>Retornos vencidos</option><option value='hoje'>Retornos hoje</option><option value='futuros'>Retornos futuros</option><option value='sem_data'>Sem próximo contato</option></select>
      </div>
      {error && <div className='form-error operation-error'>{error}</div>}
      {loading ? <div className='empty-state'>Carregando acompanhamentos...</div> : filtered.length === 0 ? <div className='empty-state'>Nenhum acompanhamento encontrado.</div> : <div className='contact-table'>
        <div className='contact-table-head'><span>Cliente</span><span>Filial / responsável</span><span>Última atividade</span><span>Próximo contato</span><span>Status</span><span></span></div>
        {filtered.map((row) => <div className='contact-row' key={row.client_name} onClick={() => setSelectedClient(row.client_name)}>
          <div><strong>{row.client_name}</strong><span>{row.city || 'Cidade não informada'}{row.serial ? ` · ${row.serial}` : ''}</span></div>
          <div><strong>{row.branch_name || 'Sem filial'}</strong><span><UserRound /> {row.responsible?.full_name || 'Sem responsável'}</span></div>
          <div><strong>{dateFmt.format(parseIso(row.activity_date))}</strong><span>{treatmentLabel(row.treatment_type)}</span></div>
          <div><strong>{row.next_followup_date ? dateFmt.format(parseIso(row.next_followup_date)) : 'Não programado'}</strong><span>{row.next_followup_date && row.next_followup_date < todayIso() ? 'Vencido' : 'Próxima ação'}</span></div>
          <div><span className={`contact-status status-${row.followup_status}`}>{statusLabel(row.followup_status)}</span>{row.estimated_value ? <small>{brl.format(Number(row.estimated_value))}</small> : null}</div>
          <div className='contact-actions'>{canEdit && <button className='secondary-button compact-button' onClick={(event) => { event.stopPropagation(); openUpdate(row); }}>Atualizar</button>}<ChevronRight /></div>
        </div>)}
      </div>}
    </section>

    {selectedClient && <div className='modal-layer' onMouseDown={() => setSelectedClient(null)}><div className='quick-modal quick-modal-wide contact-detail-modal' onMouseDown={(event) => event.stopPropagation()}><div className='quick-modal-head'><div><h2>{selectedClient}</h2><p>Histórico completo de tratativas.</p></div><button onClick={() => setSelectedClient(null)}><X /></button></div><div className='contact-timeline'>{selectedHistory.map((row) => <div className='timeline-item' key={row.id}><i /><div className='timeline-date'><strong>{dateFmt.format(parseIso(row.activity_date))}</strong><span>{row.responsible?.full_name || row.author?.full_name || 'Responsável não informado'}</span></div><div className='timeline-body'><strong>{treatmentLabel(row.treatment_type)} · {statusLabel(row.followup_status)}</strong><span>{row.branch_name || 'Sem filial'}{row.city ? ` · ${row.city}` : ''}</span>{row.notes && <p>{row.notes}</p>}<small>{row.next_followup_date ? `Próximo contato: ${dateFmt.format(parseIso(row.next_followup_date))}` : 'Sem próximo contato programado'}{row.estimated_value ? ` · ${brl.format(Number(row.estimated_value))}` : ''}</small></div></div>)}</div></div></div>}

    {draft && <div className='modal-layer' onMouseDown={() => setDraft(null)}><form className='quick-modal quick-modal-wide contact-update-modal' onSubmit={save} onMouseDown={(event) => event.stopPropagation()}><div className='quick-modal-head'><div><h2>Registrar atualização</h2><p>{draft.clientName}</p></div><button type='button' onClick={() => setDraft(null)}><X /></button></div><div className='contact-update-form'><label>Data da atividade / visita<input type='date' value={draft.activityDate} onChange={(event) => setDraft({ ...draft, activityDate: event.target.value })} /></label><label>Filial<select value={draft.branchName} onChange={(event) => setDraft({ ...draft, branchName: event.target.value })}>{availableBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label><label>Responsável<select value={draft.responsibleUserId} onChange={(event) => setDraft({ ...draft, responsibleUserId: event.target.value })}>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select></label><label>Tipo<select value={draft.treatmentType} onChange={(event) => setDraft({ ...draft, treatmentType: event.target.value })}><option value='visita'>Visita</option><option value='retorno'>Contato / retorno</option><option value='atendimento'>Prospectar atendimento</option><option value='venda_pecas'>Venda de peças</option><option value='venda_servicos'>Venda de serviços</option><option value='sem_resposta'>Tentativa sem resposta</option><option value='outro'>Outro</option></select></label><label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value='contato_realizado'>Contato realizado</option><option value='oportunidade'>Oportunidade</option><option value='retorno_agendado'>Retorno agendado</option><option value='agendamento_criado'>Agendamento criado</option><option value='convertido'>Convertido</option><option value='sem_resposta'>Sem resposta</option><option value='sem_interesse'>Sem interesse</option><option value='perdido'>Perdido</option></select></label><label>Classificação<select value={draft.classification} onChange={(event) => setDraft({ ...draft, classification: event.target.value })}><option value=''>Sem classificação</option><option value='quente'>Quente</option><option value='morno'>Morno</option><option value='frio'>Frio</option></select></label><label>Valor estimado<input value={draft.estimatedValue} inputMode='decimal' onChange={(event) => setDraft({ ...draft, estimatedValue: event.target.value })} placeholder='0,00' /></label><label>Entrar em contato novamente<input type='date' value={draft.nextFollowupDate} onChange={(event) => setDraft({ ...draft, nextFollowupDate: event.target.value })} /></label><label className='full-field'>Observação<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder='Resumo da visita, contato, necessidade do cliente e próximo passo.' /></label></div><div className='quick-actions'><span /><span /><button type='button' className='secondary-button' onClick={() => setDraft(null)}>Cancelar</button><button className='primary-button'>Salvar atualização</button></div></form></div>}
  </section>;
}
