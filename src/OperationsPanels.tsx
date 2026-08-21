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
type RetentionRow = {
  branch_name: string | null;
  client_name: string;
  city: string | null;
  sample_serial: string | null;
  equipment_count: number;
  last_appointment_date: string | null;
  next_appointment_date: string | null;
  last_contact_date: string | null;
  last_treatment_status: string | null;
  last_notes: string | null;
};
type RetentionDraft = { clientName: string; branchName: string; city: string; serial: string; treatmentStatus: string; notes: string };
type Props = { profileId: string; branchNames: string[]; allBranchCount: number; canEdit: boolean; scopeLabel: string };

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
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
function treatmentLabel(value?: string | null) {
  if (value === 'contato_realizado') return 'Contato realizado';
  if (value === 'sem_resposta') return 'Sem resposta';
  if (value === 'retorno_agendado') return 'Retorno agendado';
  if (value === 'oportunidade') return 'Oportunidade';
  if (value === 'agendamento_criado') return 'Agendamento criado';
  if (value === 'nao_interessado') return 'Não interessado';
  if (value === 'perdido') return 'Perdido';
  return 'Sem tratativa';
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

export function RetentionPanel({ profileId, branchNames, allBranchCount, canEdit, scopeLabel }: Props) {
  const [rows, setRows] = useState<RetentionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<RetentionDraft | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let queue: any = supabase.from('retention_queue').select('*').limit(300);
    if (branchNames.length > 0 && branchNames.length < allBranchCount) queue = queue.in('branch_name', branchNames);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [queueResponse, todayResponse] = await Promise.all([
      queue.order('last_contact_date', { ascending: true, nullsFirst: true }),
      supabase.from('retention_actions').select('id', { count: 'exact', head: true }).eq('created_by', profileId).gte('contact_date', start.toISOString()),
    ]);
    setRows((queueResponse.data || []) as RetentionRow[]);
    setTodayCount(todayResponse.count || 0);
    setError(queueResponse.error?.message || todayResponse.error?.message || '');
    setLoading(false);
  }, [profileId, branchNames, allBranchCount]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((row) => !query.trim() || `${row.client_name} ${row.city || ''} ${row.sample_serial || ''}`.toLowerCase().includes(query.trim().toLowerCase())), [rows, query]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !canEdit) return;
    setError('');
    const { error: insertError } = await supabase.from('retention_actions').insert({
      client_name: draft.clientName,
      city: draft.city || null,
      serial: draft.serial || null,
      branch_name: draft.branchName || null,
      treatment_status: draft.treatmentStatus,
      notes: draft.notes.trim() || null,
      created_by: profileId,
    });
    if (insertError) { setError(insertError.message); return; }
    setDraft(null);
    await load();
  }

  return <section className='clean-panel operations-panel'>
    <div className='retention-top'><div><h2>Fila de retenção · {scopeLabel}</h2><p>Clientes sem atendimento futuro agendado. A meta é tratar pelo menos 3 por dia.</p></div><div className={`retention-goal ${todayCount >= 3 ? 'goal-done' : ''}`}><span>Meta diária</span><strong>{Math.min(todayCount, 3)}/3</strong><small>{todayCount >= 3 ? 'Meta atingida' : `Faltam ${3 - todayCount}`}</small></div></div>
    <div className='operations-filters'><div className='inline-search'><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Cliente, cidade ou série' /></div></div>
    {error && <div className='form-error operation-error'>{error}</div>}
    {loading ? <div className='empty-state'>Montando fila de retenção...</div> : filtered.length === 0 ? <div className='empty-state'>Nenhum cliente sem atendimento futuro para este filtro.</div> : <div className='retention-list'>
      {filtered.map((row) => <div className='retention-card' key={`${row.branch_name}-${row.client_name}`}><div className='retention-main'><strong>{row.client_name}</strong><span>{row.city || 'Cidade não informada'} · {row.equipment_count} equipamento(s){row.branch_name ? ` · ${row.branch_name}` : ''}</span><small>{row.last_appointment_date ? `Último atendimento: ${shortDate.format(parseIso(row.last_appointment_date))}` : 'Sem atendimento registrado no app'}</small></div><div className='retention-last'><span>Última tratativa</span><strong>{treatmentLabel(row.last_treatment_status)}</strong><small>{row.last_contact_date ? shortDate.format(new Date(row.last_contact_date)) : 'Nunca contatado'}</small></div><div>{canEdit ? <button className='primary-button compact-button' onClick={() => setDraft({ clientName: row.client_name, branchName: row.branch_name || '', city: row.city || '', serial: row.sample_serial || '', treatmentStatus: 'contato_realizado', notes: '' })}>Registrar tratativa</button> : <span className='readonly-label'>Somente leitura</span>}</div></div>)}
    </div>}
    {draft && <div className='modal-layer' onMouseDown={() => setDraft(null)}><form className='small-modal operation-modal' onSubmit={save} onMouseDown={(event) => event.stopPropagation()}><div className='quick-modal-head'><div><h2>Registrar tratativa</h2><p>{draft.clientName}</p></div><button type='button' onClick={() => setDraft(null)}><X /></button></div><div className='operation-form'><label>Status<select value={draft.treatmentStatus} onChange={(event) => setDraft({ ...draft, treatmentStatus: event.target.value })}><option value='contato_realizado'>Contato realizado</option><option value='sem_resposta'>Sem resposta</option><option value='retorno_agendado'>Retorno agendado</option><option value='oportunidade'>Oportunidade</option><option value='agendamento_criado'>Agendamento criado</option><option value='nao_interessado'>Não interessado</option><option value='perdido'>Perdido</option></select></label><label>Observação<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder='O que foi tratado com o cliente?' /></label></div><div className='quick-actions'><span /><span /><button type='button' className='secondary-button' onClick={() => setDraft(null)}>Cancelar</button><button className='primary-button'>Salvar tratativa</button></div></form></div>}
  </section>;
}
