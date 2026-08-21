import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { supabase } from './lib/supabase';

type CaretrackRow = {
  serial: string;
  client_name: string | null;
  model: string | null;
  sale_branch: string | null;
  location: string | null;
  current_hourmeter: number | null;
  hourmeter_date: string | null;
  caretrack_status: string | null;
  last_service_os: string | null;
  last_service_type: string | null;
  last_service_date: string | null;
  last_service_updated_at: string | null;
};
type CareDraft = { serial: string; clientName: string; os: string; serviceType: string; date: string };

type FollowupRow = {
  client_name: string;
  city: string | null;
  state: string | null;
  branch: string | null;
  last_service_date: string;
  first_service_date: string | null;
  last_serial: string | null;
  last_operation_type: string | null;
  last_description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  phones: string | null;
  service_count: number;
  machine_count: number;
  days_since_service: number;
  aging_bucket: string;
  priority_classification: string;
  priority_rank: number;
  last_treatment_type: string | null;
  last_followup_status: string | null;
  last_classification: string | null;
  last_estimated_value: number | null;
  next_followup_date: string | null;
  last_followup_notes: string | null;
  last_followup_by: string | null;
  last_followup_at: string | null;
  next_appointment_date: string | null;
  has_future_appointment: boolean;
};

type FollowupDraft = {
  clientName: string;
  city: string;
  serial: string;
  branchName: string;
  lastServiceDate: string;
  treatmentType: string;
  followupStatus: string;
  classification: string;
  estimatedValue: string;
  nextFollowupDate: string;
  notes: string;
};

type Props = { profileId: string; branchNames: string[]; allBranchCount: number; canEdit: boolean; scopeLabel: string };

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function parseIso(value: string) { return new Date(`${value}T12:00:00`); }
function saleBranchKey(name: string) { return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); }
function caretrackColor(status?: string | null) {
  const value = (status || '').toLowerCase();
  if (value === 'verde') return '#58c84b';
  if (value === 'amarelo') return '#ffd400';
  if (value === 'vermelho') return '#f11';
  if (value === 'cinza') return '#a8a8a8';
  return '#cbd5e1';
}
function followupStatusLabel(value?: string | null) {
  if (value === 'contato_realizado') return 'Contato realizado';
  if (value === 'sem_resposta') return 'Sem resposta';
  if (value === 'retorno_agendado') return 'Retorno agendado';
  if (value === 'oportunidade') return 'Oportunidade';
  if (value === 'agendamento_criado') return 'Agendamento criado';
  if (value === 'convertido') return 'Convertido';
  if (value === 'sem_interesse') return 'Sem interesse';
  if (value === 'perdido') return 'Perdido';
  return 'Sem tratativa';
}
function treatmentTypeLabel(value?: string | null) {
  if (value === 'atendimento') return 'Atendimento';
  if (value === 'venda_pecas') return 'Venda de peças';
  if (value === 'venda_servicos') return 'Venda de serviços';
  if (value === 'visita') return 'Visita';
  if (value === 'retorno') return 'Retorno';
  if (value === 'sem_resposta') return 'Sem resposta';
  if (value === 'outro') return 'Outro';
  return 'Não definido';
}
function classificationLabel(value?: string | null) {
  if (value === 'quente') return 'Quente';
  if (value === 'morno') return 'Morno';
  if (value === 'frio') return 'Frio';
  return 'Sem classificação';
}
function priorityClass(value?: string | null) {
  if (value === 'Crítico') return 'priority-critical';
  if (value === 'Muito alto') return 'priority-very-high';
  if (value === 'Alto') return 'priority-high';
  if (value === 'Médio') return 'priority-medium';
  return 'priority-recent';
}
function moneyToNumber(raw: string) {
  const clean = raw.trim().replace(/\s/g, '');
  if (!clean) return null;
  if (clean.includes(',')) return Number(clean.replace(/\./g, '').replace(',', '.')) || null;
  return Number(clean) || null;
}

export function CareTrackPanel({ profileId, branchNames, allBranchCount, canEdit, scopeLabel }: Props) {
  const [rows, setRows] = useState<CaretrackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [draft, setDraft] = useState<CareDraft | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let request: any = supabase.from('caretrack_equipment')
      .select('serial,client_name,model,sale_branch,location,current_hourmeter,hourmeter_date,caretrack_status,last_service_os,last_service_type,last_service_date,last_service_updated_at')
      .limit(400);
    if (branchNames.length > 0 && branchNames.length < allBranchCount) request = request.in('sale_branch', branchNames.map(saleBranchKey));
    const { data, error: loadError } = await request.order('client_name');
    setRows((data || []) as CaretrackRow[]);
    setError(loadError?.message || '');
    setLoading(false);
  }, [branchNames, allBranchCount]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((row) => {
    const term = query.trim().toLowerCase();
    const textMatch = !term || `${row.serial} ${row.client_name || ''} ${row.location || ''}`.toLowerCase().includes(term);
    const statusMatch = statusFilter === 'todos' || (row.caretrack_status || '').toLowerCase() === statusFilter;
    return textMatch && statusMatch;
  }), [rows, query, statusFilter]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !canEdit) return;
    setError('');
    const { error: updateError } = await supabase.from('caretrack_equipment').update({
      last_service_os: draft.os.trim() || null,
      last_service_type: draft.serviceType.trim() || null,
      last_service_date: draft.date || null,
      last_service_updated_by: profileId,
      last_service_updated_at: new Date().toISOString(),
    }).eq('serial', draft.serial);
    if (updateError) { setError(updateError.message); return; }
    setDraft(null);
    await load();
  }

  return <section className='clean-panel operations-panel'>
    <div className='panel-heading operations-heading'><div><h2>Atualização CareTrack · {scopeLabel}</h2><p>Horímetro, cor e PMP são automáticos. Atualize apenas os campos do último serviço.</p></div></div>
    <div className='operations-filters'>
      <div className='inline-search'><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Série, cliente ou cidade' /></div>
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value='todos'>Todos os status</option><option value='verde'>Verde</option><option value='amarelo'>Amarelo</option><option value='vermelho'>Vermelho</option><option value='cinza'>Cinza</option></select>
    </div>
    {error && <div className='form-error operation-error'>{error}</div>}
    {loading ? <div className='empty-state'>Carregando CareTrack...</div> : filtered.length === 0 ? <div className='empty-state'>Nenhum equipamento encontrado para este filtro.</div> : <div className='care-table'>
      <div className='care-table-head'><span>Equipamento</span><span>CareTrack / Horímetro</span><span>Último serviço</span><span></span></div>
      {filtered.map((row) => <div className='care-row' key={row.serial}>
        <div><strong>{row.serial}</strong><span>{row.client_name || 'Cliente não informado'} · {row.location || 'Sem local'}</span></div>
        <div><strong className='care-status-inline'><i style={{ background: caretrackColor(row.caretrack_status) }} />{row.caretrack_status || 'Sem status'}</strong><span>{row.current_hourmeter ?? '—'}{row.hourmeter_date ? ` · ${shortDate.format(parseIso(row.hourmeter_date))}` : ''}</span></div>
        <div><strong>{row.last_service_os || 'OS não informada'}</strong><span>{row.last_service_type || 'Tipo não informado'}{row.last_service_date ? ` · ${shortDate.format(parseIso(row.last_service_date))}` : ''}</span></div>
        <div>{canEdit ? <button className='secondary-button compact-button' onClick={() => setDraft({ serial: row.serial, clientName: row.client_name || '', os: row.last_service_os || '', serviceType: row.last_service_type || '', date: row.last_service_date || '' })}>Atualizar</button> : <span className='readonly-label'>Somente leitura</span>}</div>
      </div>)}
    </div>}
    {draft && <div className='modal-layer' onMouseDown={() => setDraft(null)}><form className='small-modal operation-modal' onSubmit={save} onMouseDown={(event) => event.stopPropagation()}><div className='quick-modal-head'><div><h2>Atualizar último serviço</h2><p>{draft.serial} · {draft.clientName}</p></div><button type='button' onClick={() => setDraft(null)}><X /></button></div><div className='operation-form'><label>Último Serviço OS<input value={draft.os} onChange={(event) => setDraft({ ...draft, os: event.target.value })} placeholder='Número da OS' /></label><label>Tipo da OS<input value={draft.serviceType} onChange={(event) => setDraft({ ...draft, serviceType: event.target.value })} placeholder='Ex.: Preventiva, corretiva...' /></label><label>Data<input type='date' value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label></div><div className='quick-actions'><span /><span /><button type='button' className='secondary-button' onClick={() => setDraft(null)}>Cancelar</button><button className='primary-button'>Salvar</button></div></form></div>}
  </section>;
}

export function RetentionPanel({ profileId, branchNames, canEdit, scopeLabel }: Props) {
  const [rows, setRows] = useState<FollowupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [agingFilter, setAgingFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [sortMode, setSortMode] = useState('antigos');
  const [draft, setDraft] = useState<FollowupDraft | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [queueResponse, todayResponse] = await Promise.all([
      supabase.from('v_followup_queue').select('*').eq('has_future_appointment', false).order('last_service_date', { ascending: true }).limit(500),
      supabase.from('followup_actions').select('id', { count: 'exact', head: true }).eq('created_by', profileId).gte('created_at', start.toISOString()),
    ]);
    setRows((queueResponse.data || []) as FollowupRow[]);
    setTodayCount(todayResponse.count || 0);
    setError(queueResponse.error?.message || todayResponse.error?.message || '');
    setLoading(false);
  }, [profileId]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const critical = rows.filter((row) => row.priority_classification === 'Crítico').length;
    const opportunities = rows.filter((row) => ['oportunidade', 'agendamento_criado', 'convertido'].includes(row.last_followup_status || '')).length;
    const pipeline = rows.reduce((sum, row) => sum + Number(row.last_estimated_value || 0), 0);
    return { critical, opportunities, pipeline };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const result = rows.filter((row) => {
      const text = `${row.client_name} ${row.city || ''} ${row.state || ''} ${row.last_serial || ''} ${row.contact_name || ''}`.toLowerCase();
      const textMatch = !term || text.includes(term);
      const agingMatch = agingFilter === 'todos' || row.aging_bucket === agingFilter;
      const statusMatch = statusFilter === 'todos' || (statusFilter === 'sem_tratativa' ? !row.last_followup_status : row.last_followup_status === statusFilter);
      const typeMatch = typeFilter === 'todos' || row.last_treatment_type === typeFilter;
      return textMatch && agingMatch && statusMatch && typeMatch;
    });
    return [...result].sort((a, b) => {
      if (sortMode === 'recentes') return b.last_service_date.localeCompare(a.last_service_date);
      if (sortMode === 'prioridade') return b.priority_rank - a.priority_rank || a.last_service_date.localeCompare(b.last_service_date);
      return a.last_service_date.localeCompare(b.last_service_date);
    });
  }, [rows, query, agingFilter, statusFilter, typeFilter, sortMode]);

  function openFollowup(row: FollowupRow) {
    const defaultBranch = branchNames.length === 1 ? branchNames[0] : '';
    setDraft({
      clientName: row.client_name,
      city: row.city || '',
      serial: row.last_serial || '',
      branchName: defaultBranch,
      lastServiceDate: row.last_service_date,
      treatmentType: 'atendimento',
      followupStatus: 'contato_realizado',
      classification: '',
      estimatedValue: '',
      nextFollowupDate: '',
      notes: '',
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !canEdit) return;
    if (branchNames.length > 1 && !draft.branchName) { setError('Selecione a filial responsável pela tratativa.'); return; }
    setError('');
    const { error: insertError } = await supabase.from('followup_actions').insert({
      client_name: draft.clientName,
      city: draft.city || null,
      serial: draft.serial || null,
      branch_name: draft.branchName || (branchNames[0] || null),
      last_service_date_snapshot: draft.lastServiceDate || null,
      treatment_type: draft.treatmentType,
      followup_status: draft.followupStatus,
      classification: draft.classification || null,
      estimated_value: moneyToNumber(draft.estimatedValue),
      next_followup_date: draft.nextFollowupDate || null,
      notes: draft.notes.trim() || null,
      created_by: profileId,
    });
    if (insertError) { setError(insertError.message); return; }
    setDraft(null);
    await load();
  }

  return <section className='clean-panel operations-panel followup-panel'>
    <div className='retention-top followup-heading'>
      <div><h2>Follow-up de clientes · {scopeLabel}</h2><p>Base G4 ordenada pela última data de atendimento. Priorize os clientes mais antigos e registre a oportunidade encontrada.</p></div>
      <div className={`retention-goal ${todayCount >= 3 ? 'goal-done' : ''}`}><span>Meta diária</span><strong>{todayCount}/3</strong><small>{todayCount >= 3 ? 'Meta atingida' : `Faltam ${Math.max(3 - todayCount, 0)}`}</small></div>
    </div>

    <div className='followup-kpis'>
      <div><span>Sem atendimento futuro</span><strong>{rows.length}</strong><small>clientes na fila</small></div>
      <div><span>Críticos</span><strong>{stats.critical}</strong><small>12+ meses sem atendimento</small></div>
      <div><span>Oportunidades</span><strong>{stats.opportunities}</strong><small>última tratativa</small></div>
      <div><span>Pipeline estimado</span><strong>{brl.format(stats.pipeline)}</strong><small>valores informados</small></div>
    </div>

    <div className='operations-filters followup-filters'>
      <div className='inline-search'><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Cliente, cidade, série ou contato' /></div>
      <select value={agingFilter} onChange={(event) => setAgingFilter(event.target.value)}><option value='todos'>Todas as idades</option><option value='12+ meses'>12+ meses · Crítico</option><option value='9-12 meses'>9–12 meses · Muito alto</option><option value='6-9 meses'>6–9 meses · Alto</option><option value='3-6 meses'>3–6 meses · Médio</option><option value='<3 meses'>Menos de 3 meses</option></select>
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value='todos'>Todos os status</option><option value='sem_tratativa'>Sem tratativa</option><option value='contato_realizado'>Contato realizado</option><option value='oportunidade'>Oportunidade</option><option value='retorno_agendado'>Retorno agendado</option><option value='agendamento_criado'>Agendamento criado</option><option value='convertido'>Convertido</option><option value='sem_resposta'>Sem resposta</option><option value='sem_interesse'>Sem interesse</option><option value='perdido'>Perdido</option></select>
      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value='todos'>Todos os objetivos</option><option value='atendimento'>Atendimento</option><option value='venda_pecas'>Venda de peças</option><option value='venda_servicos'>Venda de serviços</option><option value='visita'>Visita</option><option value='retorno'>Retorno</option></select>
      <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}><option value='antigos'>Mais antigos primeiro</option><option value='prioridade'>Maior prioridade</option><option value='recentes'>Mais recentes primeiro</option></select>
    </div>

    {error && <div className='form-error operation-error'>{error}</div>}
    <div className='followup-result-bar'><strong>{filtered.length}</strong><span> cliente(s) no filtro atual</span></div>
    {loading ? <div className='empty-state'>Montando fila de follow-up...</div> : filtered.length === 0 ? <div className='empty-state'>Nenhum cliente encontrado para este filtro.</div> : <div className='followup-table'>
      <div className='followup-table-head'><span>Cliente / último atendimento</span><span>Classificação</span><span>Última tratativa</span><span>Contato</span><span></span></div>
      {filtered.map((row) => <div className='followup-row' key={row.client_name}>
        <div className='followup-client'><strong>{row.client_name}</strong><span>{row.city || 'Cidade não informada'}{row.state ? `/${row.state}` : ''} · {row.machine_count} máquina(s) · {row.service_count} atendimento(s)</span><small>Último: {shortDate.format(parseIso(row.last_service_date))} · {row.days_since_service} dias · Série {row.last_serial || '—'}</small></div>
        <div><span className={`priority-pill ${priorityClass(row.priority_classification)}`}>{row.priority_classification}</span><small className='aging-small'>{row.aging_bucket}</small></div>
        <div className='followup-last'><strong>{followupStatusLabel(row.last_followup_status)}</strong><span>{treatmentTypeLabel(row.last_treatment_type)}{row.last_classification ? ` · ${classificationLabel(row.last_classification)}` : ''}</span><small>{row.last_followup_at ? shortDate.format(new Date(row.last_followup_at)) : 'Nunca trabalhado'}{row.next_followup_date ? ` · Próximo: ${shortDate.format(parseIso(row.next_followup_date))}` : ''}</small></div>
        <div className='followup-contact'><strong>{row.contact_name || 'Contato não informado'}</strong><span>{row.contact_email || 'Sem e-mail'}</span>{row.phones && <small>{row.phones}</small>}</div>
        <div>{canEdit ? <button className='primary-button compact-button' onClick={() => openFollowup(row)}>Registrar follow-up</button> : <span className='readonly-label'>Somente leitura</span>}</div>
      </div>)}
    </div>}

    {draft && <div className='modal-layer' onMouseDown={() => setDraft(null)}><form className='small-modal operation-modal followup-modal' onSubmit={save} onMouseDown={(event) => event.stopPropagation()}><div className='quick-modal-head'><div><h2>Registrar follow-up</h2><p>{draft.clientName} · último atendimento {shortDate.format(parseIso(draft.lastServiceDate))}</p></div><button type='button' onClick={() => setDraft(null)}><X /></button></div><div className='operation-form followup-form'>
      {branchNames.length > 1 && <label>Filial responsável<select required value={draft.branchName} onChange={(event) => setDraft({ ...draft, branchName: event.target.value })}><option value=''>Selecione</option>{branchNames.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label>}
      <label>Objetivo da tratativa<select value={draft.treatmentType} onChange={(event) => setDraft({ ...draft, treatmentType: event.target.value })}><option value='atendimento'>Prospectar atendimento</option><option value='venda_pecas'>Venda de peças</option><option value='venda_servicos'>Venda de serviços</option><option value='visita'>Visita ao cliente</option><option value='retorno'>Retorno / acompanhamento</option><option value='sem_resposta'>Tentativa sem resposta</option><option value='outro'>Outro</option></select></label>
      <label>Status<select value={draft.followupStatus} onChange={(event) => setDraft({ ...draft, followupStatus: event.target.value })}><option value='contato_realizado'>Contato realizado</option><option value='oportunidade'>Oportunidade identificada</option><option value='retorno_agendado'>Retorno agendado</option><option value='agendamento_criado'>Agendamento criado</option><option value='convertido'>Convertido</option><option value='sem_resposta'>Sem resposta</option><option value='sem_interesse'>Sem interesse</option><option value='perdido'>Perdido</option></select></label>
      <label>Classificação comercial<select value={draft.classification} onChange={(event) => setDraft({ ...draft, classification: event.target.value })}><option value=''>Sem classificação</option><option value='quente'>Quente</option><option value='morno'>Morno</option><option value='frio'>Frio</option></select></label>
      <label>Valor estimado<input inputMode='decimal' value={draft.estimatedValue} onChange={(event) => setDraft({ ...draft, estimatedValue: event.target.value })} placeholder='0,00' /></label>
      <label>Próximo follow-up<input type='date' value={draft.nextFollowupDate} onChange={(event) => setDraft({ ...draft, nextFollowupDate: event.target.value })} /></label>
      <label>Observação<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder='O que foi tratado com o cliente? O que pode virar oportunidade?' /></label>
    </div><div className='quick-actions'><span /><span /><button type='button' className='secondary-button' onClick={() => setDraft(null)}>Cancelar</button><button className='primary-button'>Salvar follow-up</button></div></form></div>}
  </section>;
}
