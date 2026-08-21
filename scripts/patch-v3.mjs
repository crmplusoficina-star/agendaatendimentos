import fs from 'node:fs';

const appPath = new URL('../src/AppNoAuthV3.tsx', import.meta.url);
let source = fs.readFileSync(appPath, 'utf8');

function replaceOnce(label, before, after) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`patch-v3: trecho não encontrado: ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import operations panels',
  "import { supabase } from './lib/supabase';\nimport type { AppointmentStatus, Branch, Profile, Technician } from './types';",
  "import { supabase } from './lib/supabase';\nimport { CareTrackPanel, RetentionPanel } from './OperationsPanels';\nimport type { AppointmentStatus, Branch, Profile, Technician } from './types';",
);

replaceOnce(
  'allow own all branches editing',
  "const canEdit = Boolean(baseCanEdit && currentSpecificBranchId && !isOtherAgenda);",
  "const canEdit = Boolean(baseCanEdit && !isOtherAgenda);",
);

replaceOnce(
  'resolve branch by technician when saving',
  "if (!draft || !profile || !currentSpecificBranchId) return;\n    if (!draft.date || !draft.technicianId || !draft.statusId) { setSaveError('Preencha data, técnico e status.'); return; }\n    const payload = {\n      branch_id: currentSpecificBranchId,",
  "if (!draft || !profile || !canEdit) return;\n    const selectedTech = technicians.find((tech) => tech.id === draft.technicianId);\n    const targetBranchId = selectedTech?.branch_id || currentSpecificBranchId;\n    if (!targetBranchId || !draft.date || !draft.technicianId || !draft.statusId) { setSaveError('Preencha data, técnico e status.'); return; }\n    if (profile.role === 'consultor' && !ownBranches.some((branch) => branch.id === targetBranchId)) { setSaveError('Esse técnico não pertence a uma filial liberada para sua matrícula.'); return; }\n    const payload = {\n      branch_id: targetBranchId,",
);

replaceOnce(
  'technician selector for all own branches',
  "{technicians.filter((tech) => tech.branch_id === currentSpecificBranchId).map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}",
  "{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.name}{branchId === ALL_BRANCHES && tech.branch?.name ? ` · ${tech.branch.name}` : ''}</option>)}",
);

replaceOnce(
  'all own branches not readonly',
  "readOnly={view === 'outras' || branchId === ALL_BRANCHES}",
  "readOnly={view === 'outras' || !canEdit}",
);

replaceOnce(
  'hide add technician when multiple branches',
  "{canEdit && <button className='secondary-button' onClick={onAddTech}><Plus /> Técnico adicional</button>}",
  "{canEdit && !showBranch && <button className='secondary-button' onClick={onAddTech}><Plus /> Técnico adicional</button>}",
);

replaceOnce(
  'remove billing status from quick modal',
  "      <label>Status faturamento<select value={draft.billingStatus} onChange={(event) => setDraft({ ...draft, billingStatus: event.target.value })}><option value='nao_precificado'>Não precificado</option><option value='precificado'>Precificado</option><option value='aguardando_faturamento'>Aguardando faturamento</option><option value='faturado'>Faturado</option><option value='perdido'>Perdido</option></select></label>\n",
  '',
);

replaceOnce(
  'billing badge on agenda chip class',
  "className='appointment-chip appointment-chip-v3'",
  "className='appointment-chip appointment-chip-v4'",
);
replaceOnce(
  'billing badge on agenda chip',
  "><strong>{item.status?.name || 'Atendimento'}</strong>{item.client_name_manual && <span>{item.client_name_manual}</span>}",
  "><span className={`billing-badge billing-${item.billing_status}`}>{billingLabel(item.billing_status)}</span><strong>{item.status?.name || 'Atendimento'}</strong>{item.client_name_manual && <span className='chip-client'>{item.client_name_manual}</span>}",
);

replaceOnce(
  'retention module',
  "{view === 'retencao' && <ModulePlaceholder title='Retenção' text='Aqui ficará o fluxo de contato, retorno do cliente, retenção e motivo de perda.' />}",
  "{view === 'retencao' && <RetentionPanel profileId={profile.id} branchNames={selectedBranchIds.map((id) => allBranches.find((branch) => branch.id === id)?.name).filter(Boolean) as string[]} allBranchCount={allBranches.length} canEdit={Boolean(baseCanEdit)} scopeLabel={selectedScopeLabel} />}",
);
replaceOnce(
  'caretrack module',
  "{view === 'caretrack' && <ModulePlaceholder title='CareTrack' text='A agenda já consulta o status atual da máquina e o PMP pela série.' />}",
  "{view === 'caretrack' && <CareTrackPanel profileId={profile.id} branchNames={selectedBranchIds.map((id) => allBranches.find((branch) => branch.id === id)?.name).filter(Boolean) as string[]} allBranchCount={allBranches.length} canEdit={Boolean(baseCanEdit)} scopeLabel={selectedScopeLabel} />}",
);

replaceOnce(
  'agenda guidance',
  "<p>{view === 'agenda' ? 'Clique, escolha a máquina e salve. A visão semanal continua igual.' : view === 'outras' ? 'Consulte qualquer outra filial em modo leitura.' : 'Controle rápido por filial.'}</p>",
  "<p>{view === 'agenda' ? 'Clique, escolha a máquina e salve. Em Todas as minhas filiais, a filial é definida pelo técnico.' : view === 'outras' ? 'Consulte qualquer outra filial em modo leitura.' : view === 'retencao' ? 'Clientes sem atendimento futuro: trate pelo menos 3 por dia.' : view === 'caretrack' ? 'Atualize o último serviço sem alterar os dados automáticos.' : 'Controle rápido por filial.'}</p>",
);

// Copiloto de IA: tipos e campos persistidos no atendimento.
replaceOnce(
  'ai appointment fields',
  "  has_pmp_snapshot: boolean | null;\n  status?: AppointmentStatus | null;",
  "  has_pmp_snapshot: boolean | null;\n  service_reason: string | null;\n  reported_hourmeter: number | null;\n  status?: AppointmentStatus | null;",
);

replaceOnce(
  'ai draft fields',
  "  currentHourmeter: number | null;\n  hourmeterDate: string | null;\n};\ntype Bucket",
  "  currentHourmeter: number | null;\n  hourmeterDate: string | null;\n  serviceReason: string;\n  reportedHourmeter: string;\n};\ntype AIInsight = { id: string; appointment_id: string | null; technician_id: string | null; branch_id: string | null; insight_type: string; priority: string; presentation_level: number; title: string; message: string; rationale: Record<string, unknown>; status: string; generated_by: string; created_at: string; };\ntype Bucket",
);

replaceOnce(
  'ai empty draft',
  "currentHourmeter: null, hourmeterDate: null }",
  "currentHourmeter: null, hourmeterDate: null, serviceReason: '', reportedHourmeter: '' }",
);

replaceOnce(
  'ai appointment select',
  "caretrack_status_snapshot,has_pmp_snapshot,status:appointment_statuses",
  "caretrack_status_snapshot,has_pmp_snapshot,service_reason,reported_hourmeter,status:appointment_statuses",
);

replaceOnce(
  'ai edit draft',
  "currentHourmeter: null, hourmeterDate: null };",
  "currentHourmeter: null, hourmeterDate: null, serviceReason: item.service_reason || '', reportedHourmeter: item.reported_hourmeter == null ? '' : String(item.reported_hourmeter) };",
);

replaceOnce(
  'ai draft payload',
  "      has_pmp_snapshot: draft.hasPmp,\n      updated_by: profile.id,",
  "      has_pmp_snapshot: draft.hasPmp,\n      service_reason: draft.serviceReason || null,\n      reported_hourmeter: draft.reportedHourmeter.trim() ? Number(draft.reportedHourmeter.replace(',', '.')) : null,\n      updated_by: profile.id,",
);

replaceOnce(
  'ai response id',
  "const response = draft.id ? await supabase.from('appointments').update(payload).eq('id', draft.id) : await supabase.from('appointments').insert({ ...payload, created_by: profile.id });\n    if (response.error) { setSaveError(response.error.message); return; }\n    setDraft(null); await loadAgenda();",
  "const response = draft.id ? await supabase.from('appointments').update(payload).eq('id', draft.id).select('id').single() : await supabase.from('appointments').insert({ ...payload, created_by: profile.id }).select('id').single();\n    if (response.error) { setSaveError(response.error.message); return; }\n    const savedAppointmentId = (response.data as { id?: string } | null)?.id || draft.id;\n    const savedTechnicianId = draft.technicianId;\n    const savedDate = draft.date;\n    setDraft(null); await loadAgenda();\n    if (savedAppointmentId) await reanalyzeAIWindow(savedAppointmentId, savedTechnicianId, savedDate);",
);

replaceOnce(
  'ai state',
  "  const [equipmentLoading, setEquipmentLoading] = useState(false);",
  "  const [equipmentLoading, setEquipmentLoading] = useState(false);\n  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);\n  const [aiOpen, setAiOpen] = useState(false);\n  const [aiLoading, setAiLoading] = useState(false);",
);

replaceOnce(
  'ai callbacks before leave profile',
  "  function leaveProfile() {",
  "  const loadAIInsights = useCallback(async () => {\n    if (!profile || selectedBranchIds.length === 0) { setAiInsights([]); return; }\n    setAiLoading(true);\n    let query: any = supabase.from('ai_insights').select('id,appointment_id,technician_id,branch_id,insight_type,priority,presentation_level,title,message,rationale,status,generated_by,created_at').in('status', ['new','viewed','useful']).order('created_at', { ascending: false }).limit(30);\n    query = selectedBranchIds.length === 1 ? query.eq('branch_id', selectedBranchIds[0]) : query.in('branch_id', selectedBranchIds);\n    const { data } = await query;\n    setAiInsights((data || []) as AIInsight[]);\n    setAiLoading(false);\n  }, [profile, selectedBranchIds]);\n\n  useEffect(() => { loadAIInsights(); }, [loadAIInsights]);\n\n  async function setAIInsightStatus(insight: AIInsight, status: 'viewed' | 'ignored' | 'useful' | 'converted') {\n    await supabase.functions.invoke('ai-agenda-copilot', { body: { operation: 'feedback', insight_id: insight.id, status } });\n    await loadAIInsights();\n  }\n\n  async function reanalyzeAIWindow(appointmentId: string, technicianId: string, anchorDate: string) {\n    const start = isoDate(addDays(parseIso(anchorDate), -7));\n    const end = isoDate(addDays(parseIso(anchorDate), 14));\n    const { data } = await supabase.from('appointments').select('id').eq('technician_id', technicianId).is('deleted_at', null).gte('appointment_date', start).lte('appointment_date', end).order('appointment_date').limit(24);\n    const ids = Array.from(new Set([appointmentId, ...((data || []) as { id: string }[]).map((item) => item.id)]));\n    for (const id of ids) await supabase.functions.invoke('ai-agenda-copilot', { body: { appointment_id: id } });\n    await loadAIInsights();\n  }\n\n  function leaveProfile() {",
);

replaceOnce(
  'ai clear profile',
  "setMatricula(''); setView('dashboard'); setPeriod('week');",
  "setMatricula(''); setView('dashboard'); setPeriod('week'); setAiInsights([]); setAiOpen(false);",
);

replaceOnce(
  'ai bell',
  "        <div className='topbar-right'>\n          {isOtherAgenda ?",
  "        <div className='topbar-right'>\n          <button type='button' className='ai-bell' title='Sugestões da IA' onClick={() => setAiOpen((value) => !value)}><span aria-hidden='true'>🔔</span><span>IA</span>{aiInsights.filter((item) => item.status === 'new').length > 0 && <b>{aiInsights.filter((item) => item.status === 'new').length}</b>}</button>\n          {isOtherAgenda ?",
);

replaceOnce(
  'ai known hourmeter label',
  "<div><span>Horímetro</span><strong>{draft.currentHourmeter ?? '—'}{draft.hourmeterDate ? ` · ${shortDate.format(parseIso(draft.hourmeterDate))}` : ''}</strong></div>",
  "<div><span>Último horímetro conhecido</span><strong>{draft.currentHourmeter ?? '—'}{draft.hourmeterDate ? ` · ${shortDate.format(parseIso(draft.hourmeterDate))}` : ''}</strong></div>",
);

replaceOnce(
  'ai service reason and hourmeter fields',
  "      <label className='full-field'>Status do atendimento<select value={draft.statusId}",
  "      <label className='full-field'>Motivo do atendimento<select value={draft.serviceReason} onChange={(event) => setDraft({ ...draft, serviceReason: event.target.value })}><option value=''>Não informado</option><option value='Garantia'>Garantia</option><option value='Entrega técnica'>Entrega técnica</option><option value='Manutenção preventiva'>Manutenção preventiva</option><option value='Manutenção corretiva'>Manutenção corretiva</option><option value='Diagnóstico'>Diagnóstico</option><option value='Revisão'>Revisão</option><option value='Inspeção'>Inspeção</option><option value='Instalação'>Instalação</option><option value='Treinamento'>Treinamento</option><option value='Visita técnica'>Visita técnica</option><option value='Campanha'>Campanha</option><option value='Outro'>Outro</option></select></label>\n      <label>Horímetro atual da máquina<input inputMode='decimal' value={draft.reportedHourmeter} onChange={(event) => setDraft({ ...draft, reportedHourmeter: event.target.value.replace(/[^0-9,.]/g, '') })} placeholder='Opcional' />{draft.reportedHourmeter && draft.currentHourmeter != null && Number(draft.reportedHourmeter.replace(',', '.')) >= draft.currentHourmeter && <small className='hourmeter-delta'>+{Math.round(Number(draft.reportedHourmeter.replace(',', '.')) - draft.currentHourmeter)} h desde a leitura conhecida</small>}</label>\n      <label className='full-field'>Status do atendimento<select value={draft.statusId}",
);

replaceOnce(
  'ai drawer',
  "    </main>\n\n    {draft &&",
  "    </main>\n\n    {aiOpen && <aside className='ai-drawer'><div className='ai-drawer-head'><div><strong>Copiloto da agenda</strong><span>Sugestões, não ordens.</span></div><button type='button' onClick={() => setAiOpen(false)}>×</button></div>{aiLoading ? <div className='ai-empty'>Analisando contexto...</div> : aiInsights.length === 0 ? <div className='ai-empty'><strong>Nenhum insight agora</strong><span>Isso também é um resultado correto.</span></div> : <div className='ai-insight-list'>{aiInsights.map((insight) => <article className={`ai-insight ai-priority-${insight.priority}`} key={insight.id}><div className='ai-insight-meta'><span>{insight.insight_type}</span><span>{insight.generated_by === 'rules+groq' ? 'IA + dados' : 'Dados'}</span></div><h3>{insight.title}</h3><p>{insight.message}</p><details><summary>Ver base da sugestão</summary><pre>{JSON.stringify(insight.rationale, null, 2)}</pre></details><div className='ai-insight-actions'><button type='button' onClick={() => setAIInsightStatus(insight, 'useful')}>Útil 👍</button><button type='button' onClick={() => setAIInsightStatus(insight, 'ignored')}>Ignorar</button></div></article>)}</div>}</aside>}\n\n    {aiInsights.find((item) => item.presentation_level === 4 && item.status === 'new') && !aiOpen && (() => { const insight = aiInsights.find((item) => item.presentation_level === 4 && item.status === 'new')!; return <div className='ai-popup-layer'><div className='ai-popup'><span className='ai-popup-kicker'>💡 Antes de concluir</span><h3>{insight.title}</h3><p>{insight.message}</p><div><button type='button' className='secondary-button' onClick={() => setAIInsightStatus(insight, 'ignored')}>Ignorar</button><button type='button' className='primary-button' onClick={() => { setAIInsightStatus(insight, 'viewed'); setAiOpen(true); }}>Ver detalhes</button></div></div></div>; })()}\n\n    {draft &&",
);

fs.writeFileSync(appPath, source);
console.log('patch-v3 aplicado');
