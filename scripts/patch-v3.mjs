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
  'import agenda enhancements',
  "import { CareTrackPanel, RetentionPanel } from './OperationsPanels';\nimport type { AppointmentStatus, Branch, Profile, Technician } from './types';",
  "import { CareTrackPanel, RetentionPanel } from './OperationsPanels';\nimport { BillingPanel, DashboardMap, EquipmentPanel } from './AgendaEnhancements';\nimport type { AppointmentStatus, Branch, Profile, Technician } from './types';",
);

replaceOnce(
  'allow own all branches editing',
  "const canEdit = Boolean(baseCanEdit && currentSpecificBranchId && !isOtherAgenda);",
  "const canEdit = Boolean(baseCanEdit && !isOtherAgenda);",
);

replaceOnce(
  'dashboard future range',
  "view === 'dashboard' ? { start: currentWeekStart, end: addDays(currentWeekStart, 5) }",
  "view === 'dashboard' ? { start: currentWeekStart, end: addDays(currentWeekStart, 60) }",
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
  'billing label debit internal',
  "value === 'perdido' ? 'Perdido' : 'Não precificado'",
  "value === 'perdido' ? 'Débito interno' : 'Não precificado'",
);

replaceOnce(
  'amount suggestion helper',
  "function billingLabel(value: string) {\n  return value === 'faturado' ? 'Faturado' : value === 'aguardando_faturamento' ? 'Aguardando faturamento' : value === 'precificado' ? 'Precificado' : value === 'perdido' ? 'Débito interno' : 'Não precificado';\n}",
  "function billingLabel(value: string) {\n  return value === 'faturado' ? 'Faturado' : value === 'aguardando_faturamento' ? 'Aguardando faturamento' : value === 'precificado' ? 'Precificado' : value === 'perdido' ? 'Débito interno' : 'Não precificado';\n}\nfunction suggestedAmountForStatus(statusId: string, statuses: AppointmentStatus[]) {\n  const name = (statuses.find((status) => status.id === statusId)?.name || '').toLowerCase();\n  if (name.includes('corret')) return { label: 'Corretivo', amount: 453.20 };\n  if (name.includes('prevent')) return { label: 'Preventivo', amount: 412.01 };\n  return null;\n}",
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
  'copy appointment function',
  "  async function updateBilling(item: AppointmentExt, value: string) {\n    if (!profile || !baseCanEdit) return;\n    await supabase.from('appointments').update({ billing_status: value, updated_by: profile.id }).eq('id', item.id); await loadAgenda();\n  }",
  "  async function updateBilling(item: AppointmentExt, value: string) {\n    if (!profile || !baseCanEdit) return;\n    await supabase.from('appointments').update({ billing_status: value, updated_by: profile.id }).eq('id', item.id); await loadAgenda();\n  }\n  async function copyAppointment(item: AppointmentExt, date: string, technicianId: string) {\n    if (!profile || !canEdit) return;\n    if (item.appointment_date === date && item.technician_id === technicianId) return;\n    const targetTech = technicians.find((tech) => tech.id === technicianId);\n    if (!targetTech?.branch_id) return;\n    if (profile.role === 'consultor' && !ownBranches.some((branch) => branch.id === targetTech.branch_id)) return;\n    const { error } = await supabase.from('appointments').insert({\n      branch_id: targetTech.branch_id, appointment_date: date, technician_id: technicianId, technician_name_manual: null,\n      client_name_manual: item.client_name_manual, equipment_serial: item.equipment_serial, service_city: item.service_city,\n      status_id: item.status_id, amount: Number(item.amount || 0), notes: item.notes, billing_status: item.billing_status,\n      caretrack_status_snapshot: item.caretrack_status_snapshot, has_pmp_snapshot: item.has_pmp_snapshot, created_by: profile.id, updated_by: profile.id,\n    });\n    if (error) { setSaveError(error.message); return; }\n    await loadAgenda();\n  }",
);

replaceOnce(
  'dashboard weekly stats after future load',
  "  const todayAppointments = appointments.filter((item) => item.appointment_date === todayIso);\n  const weeklyAmount = appointments.reduce((sum, item) => sum + Number(item.amount || 0), 0);\n  const activeTechCount = new Set(appointments.map((item) => item.technician_id).filter(Boolean)).size;\n  const noAgenda = statuses.find((status) => status.name === 'Sem agenda');\n  const noAgendaCount = noAgenda ? appointments.filter((item) => item.status_id === noAgenda.id).length : 0;",
  "  const todayAppointments = appointments.filter((item) => item.appointment_date === todayIso);\n  const dashboardWeekStart = isoDate(startOfWeek(new Date()));\n  const dashboardWeekEnd = isoDate(addDays(startOfWeek(new Date()), 5));\n  const dashboardWeekAppointments = appointments.filter((item) => item.appointment_date >= dashboardWeekStart && item.appointment_date <= dashboardWeekEnd);\n  const weeklyAmount = dashboardWeekAppointments.reduce((sum, item) => sum + Number(item.amount || 0), 0);\n  const activeTechCount = new Set(dashboardWeekAppointments.map((item) => item.technician_id).filter(Boolean)).size;\n  const noAgenda = statuses.find((status) => status.name === 'Sem agenda');\n  const noAgendaCount = noAgenda ? dashboardWeekAppointments.filter((item) => item.status_id === noAgenda.id).length : 0;",
);

replaceOnce(
  'dashboard map panel',
  "{view === 'dashboard' && <><div className='summary-grid'><Summary label='Hoje' value={String(todayAppointments.length)} detail='atendimentos' /><Summary label='Técnicos na semana' value={String(activeTechCount)} detail='com apontamento' /><Summary label='Sem agenda' value={String(noAgendaCount)} detail='na semana' /><Summary label='Previsão da semana' value={brl.format(weeklyAmount)} detail='faturamento previsto' /></div><section className='clean-panel'>",
  "{view === 'dashboard' && <><div className='summary-grid'><Summary label='Hoje' value={String(todayAppointments.length)} detail='atendimentos' /><Summary label='Técnicos na semana' value={String(activeTechCount)} detail='com apontamento' /><Summary label='Sem agenda' value={String(noAgendaCount)} detail='na semana' /><Summary label='Previsão da semana' value={brl.format(weeklyAmount)} detail='faturamento previsto' /></div><DashboardMap appointments={appointments} branches={allBranches} scopeLabel={selectedScopeLabel} /><section className='clean-panel'>",
);

replaceOnce(
  'advanced equipment panel',
  "{view === 'equipamentos' && <section className='clean-panel'><div className='panel-heading'><div><h2>Consulta por série</h2><p>Digite qualquer parte da série para localizar cliente e máquina.</p></div></div><form className='equipment-search' onSubmit={searchEquipment}><Search /><input value={equipmentQuery} onChange={(event) => setEquipmentQuery(event.target.value)} placeholder='Ex.: 15597 ou VCE0L60' /><button className='primary-button'>Buscar</button></form>{equipmentLoading ? <Empty text='Buscando...' /> : equipmentResults.length === 0 ? <Empty text={equipmentQuery ? 'Nenhum equipamento encontrado.' : 'Digite uma série para consultar.'} /> : <div className='equipment-table'>{equipmentResults.map((item, index) => <div className='equipment-row' key={`${item.serial}-${item.client_name}-${index}`}><div><strong>{item.serial}</strong><span>{item.client_name || 'Cliente não informado'}</span></div><div><span>Modelo</span><strong>{item.model || '—'}</strong></div><div><span>Cidade</span><strong>{item.city || '—'}</strong></div><div><span>Horímetro</span><strong>{item.current_hourmeter ?? '—'}</strong></div><div><span>CareTrack</span><strong>{item.caretrack_status || '—'}</strong></div></div>)}</div>}</section>}",
  "{view === 'equipamentos' && <EquipmentPanel scopeLabel={selectedScopeLabel} />}",
);

replaceOnce(
  'advanced billing panel',
  "{view === 'faturamento' && <section className='clean-panel'><div className='panel-heading'><div><h2>Faturamento · {selectedScopeLabel}</h2><p>Previsão e situação do faturamento.</p></div></div>{appointments.length === 0 ? <Empty text='Nenhum atendimento no período.' /> : <div className='billing-list'>{appointments.map((item) => <div className='billing-row' key={item.id}><div><strong>{item.client_name_manual || item.technician?.name || 'Atendimento'}</strong><span>{shortDate.format(parseIso(item.appointment_date))} · {item.status?.name || ''}{item.equipment_serial ? ` · ${item.equipment_serial}` : ''}</span></div><strong>{brl.format(Number(item.amount || 0))}</strong><select disabled={!baseCanEdit} value={item.billing_status} onChange={(event) => updateBilling(item, event.target.value)}><option value='nao_precificado'>Não precificado</option><option value='precificado'>Precificado</option><option value='aguardando_faturamento'>Aguardando faturamento</option><option value='faturado'>Faturado</option><option value='perdido'>Perdido</option></select></div>)}</div>}</section>}",
  "{view === 'faturamento' && <BillingPanel appointments={appointments} scopeLabel={selectedScopeLabel} canEdit={Boolean(baseCanEdit)} statuses={statuses} updateBilling={updateBilling} />}",
);

replaceOnce(
  'agenda board callbacks',
  "onDrill={drillPeriod} />",
  "onDrill={drillPeriod} onCopy={copyAppointment} onBilling={updateBilling} />",
);

replaceOnce(
  'agenda board signature',
  "function AgendaBoard({ scopeLabel, period, anchor, range, weekStart, weekEnd, weekDays, technicians, appointments, statuses, loading, canEdit, readOnly, showBranch, onPeriod, onAnchor, onWeek, onAddTech, onOpenNew, onOpenEdit, onDrill }: {",
  "function AgendaBoard({ scopeLabel, period, anchor, range, weekStart, weekEnd, weekDays, technicians, appointments, statuses, loading, canEdit, readOnly, showBranch, onPeriod, onAnchor, onWeek, onAddTech, onOpenNew, onOpenEdit, onDrill, onCopy, onBilling }: {",
);
replaceOnce(
  'agenda board callback types',
  "onOpenEdit: (item: AppointmentExt) => void; onDrill: (bucket: Bucket) => void;",
  "onOpenEdit: (item: AppointmentExt) => void; onDrill: (bucket: Bucket) => void; onCopy: (item: AppointmentExt, date: string, technicianId: string) => void; onBilling: (item: AppointmentExt, value: string) => void;",
);
replaceOnce(
  'weekly sheet callbacks',
  "<WeeklySheet weekDays={weekDays} technicians={technicians} appointments={appointments} loading={loading} canEdit={canEdit} showBranch={showBranch} onOpenNew={onOpenNew} onOpenEdit={onOpenEdit} />",
  "<WeeklySheet weekDays={weekDays} technicians={technicians} appointments={appointments} loading={loading} canEdit={canEdit} showBranch={showBranch} onOpenNew={onOpenNew} onOpenEdit={onOpenEdit} onCopy={onCopy} onBilling={onBilling} />",
);

replaceOnce(
  'weekly sheet drag copy and billing inline',
  "function WeeklySheet({ weekDays, technicians, appointments, loading, canEdit, showBranch, onOpenNew, onOpenEdit }: { weekDays: Date[]; technicians: TechnicianExt[]; appointments: AppointmentExt[]; loading: boolean; canEdit: boolean; showBranch: boolean; onOpenNew: (d: string, t: string) => void; onOpenEdit: (item: AppointmentExt) => void }) {\n  return <div className='sheet-wrap'><div className='sheet-grid sheet-head'><div className='tech-head'>Técnico</div>{weekDays.map((day) => <div key={isoDate(day)}><strong>{weekday.format(day).replace('.', '')}</strong><span>{shortDate.format(day)}</span></div>)}</div>{loading ? <div className='sheet-loading'>Carregando agenda...</div> : technicians.length === 0 ? <Empty text='Nenhum técnico cadastrado nesta filial.' /> : technicians.map((tech) => <div className='sheet-grid sheet-row' key={tech.id}><div className='tech-name'><strong>{tech.name}</strong>{showBranch && tech.branch?.name && <span className='branch-mini'>{tech.branch.name}</span>}{tech.source === 'adhoc' && <span>adicional</span>}</div>{weekDays.map((day) => { const date = isoDate(day); const items = appointments.filter((item) => item.technician_id === tech.id && item.appointment_date === date); return <div className={`sheet-cell ${canEdit ? 'clickable' : ''}`} key={date} onClick={() => items.length === 0 && onOpenNew(date, tech.id)}>{items.length === 0 && canEdit && <span className='cell-plus'>+</span>}{items.map((item) => <button key={item.id} className='appointment-chip appointment-chip-v4' onClick={(event) => { event.stopPropagation(); if (canEdit) onOpenEdit(item); }} style={{ background: item.status?.color_hex || '#64748b', color: item.status?.text_color || '#fff', cursor: canEdit ? 'pointer' : 'default' }}><span className={`billing-badge billing-${item.billing_status}`}>{billingLabel(item.billing_status)}</span><strong>{item.status?.name || 'Atendimento'}</strong>{item.client_name_manual && <span className='chip-client'>{item.client_name_manual}</span>}{Number(item.amount || 0) > 0 && <span>{brl.format(Number(item.amount))}</span>}{item.caretrack_status_snapshot && <i className='chip-caretrack' style={{ background: caretrackColor(item.caretrack_status_snapshot) }} /></button>)}</div>; })}</div>)}</div>;\n}",
  "function WeeklySheet({ weekDays, technicians, appointments, loading, canEdit, showBranch, onOpenNew, onOpenEdit, onCopy, onBilling }: { weekDays: Date[]; technicians: TechnicianExt[]; appointments: AppointmentExt[]; loading: boolean; canEdit: boolean; showBranch: boolean; onOpenNew: (d: string, t: string) => void; onOpenEdit: (item: AppointmentExt) => void; onCopy: (item: AppointmentExt, date: string, technicianId: string) => void; onBilling: (item: AppointmentExt, value: string) => void }) {\n  const [draggingId, setDraggingId] = useState<string | null>(null);\n  const [targetKey, setTargetKey] = useState<string | null>(null);\n  return <div className='sheet-wrap'><div className='sheet-grid sheet-head'><div className='tech-head'>Técnico</div>{weekDays.map((day) => <div key={isoDate(day)}><strong>{weekday.format(day).replace('.', '')}</strong><span>{shortDate.format(day)}</span></div>)}</div>{loading ? <div className='sheet-loading'>Carregando agenda...</div> : technicians.length === 0 ? <Empty text='Nenhum técnico cadastrado nesta filial.' /> : technicians.map((tech) => <div className='sheet-grid sheet-row' key={tech.id}><div className='tech-name'><strong>{tech.name}</strong>{showBranch && tech.branch?.name && <span className='branch-mini'>{tech.branch.name}</span>}{tech.source === 'adhoc' && <span>adicional</span>}</div>{weekDays.map((day) => { const date = isoDate(day); const cellKey = `${tech.id}-${date}`; const items = appointments.filter((item) => item.technician_id === tech.id && item.appointment_date === date); return <div className={`sheet-cell ${canEdit ? 'clickable' : ''} ${targetKey === cellKey ? 'drag-target' : ''}`} key={date} onClick={() => items.length === 0 && onOpenNew(date, tech.id)} onDragOver={(event) => { if (!canEdit || !draggingId) return; event.preventDefault(); setTargetKey(cellKey); }} onDragLeave={() => setTargetKey((current) => current === cellKey ? null : current)} onDrop={(event) => { if (!canEdit) return; event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData('text/appointment-id') || draggingId; const item = appointments.find((entry) => entry.id === id); setTargetKey(null); setDraggingId(null); if (item) onCopy(item, date, tech.id); }}>{items.length === 0 && canEdit && <span className='cell-plus'>+</span>}{items.map((item) => <div key={item.id} role='button' tabIndex={0} draggable={canEdit} className='appointment-chip appointment-chip-v5' onDragStart={(event) => { setDraggingId(item.id); event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('text/appointment-id', item.id); }} onDragEnd={() => { setDraggingId(null); setTargetKey(null); }} onClick={(event) => { event.stopPropagation(); if (canEdit) onOpenEdit(item); }} onKeyDown={(event) => { if (event.key === 'Enter' && canEdit) onOpenEdit(item); }} style={{ background: item.status?.color_hex || '#64748b', color: item.status?.text_color || '#fff', cursor: canEdit ? 'pointer' : 'default' }}><select className='billing-inline-select' disabled={!canEdit} value={item.billing_status} onClick={(event) => event.stopPropagation()} onChange={(event) => { event.stopPropagation(); onBilling(item, event.target.value); }}><option value='nao_precificado'>Não precificado</option><option value='precificado'>Precificado</option><option value='aguardando_faturamento'>Aguardando faturamento</option><option value='faturado'>Faturado</option><option value='perdido'>Débito interno</option></select><strong>{item.status?.name || 'Atendimento'}</strong>{item.client_name_manual && <span className='chip-client'>{item.client_name_manual}</span>}{item.service_city && <span className='chip-city'>{item.service_city}</span>}{Number(item.amount || 0) > 0 && <span>{brl.format(Number(item.amount))}</span>}{item.caretrack_status_snapshot && <i className='chip-caretrack' style={{ background: caretrackColor(item.caretrack_status_snapshot) }} /></div>)}</div>; })}</div>)}</div>;\n}",
);

replaceOnce(
  'status amount suggestion on change',
  "<label className='full-field'>Status do atendimento<select value={draft.statusId} onChange={(event) => setDraft({ ...draft, statusId: event.target.value })}>{statuses.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label>",
  "<label className='full-field'>Status do atendimento<select value={draft.statusId} onChange={(event) => { const nextStatusId = event.target.value; const suggestion = suggestedAmountForStatus(nextStatusId, statuses); setDraft({ ...draft, statusId: nextStatusId, amount: !draft.amount && suggestion ? suggestion.amount.toFixed(2).replace('.', ',') : draft.amount }); }}>{statuses.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label>",
);
replaceOnce(
  'amount suggestion display',
  "      <label>Previsão de faturamento<input inputMode='decimal' value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder='0,00' /></label>",
  "      <label>Previsão de faturamento<input inputMode='decimal' value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder='0,00' /></label>\n      {suggestedAmountForStatus(draft.statusId, statuses) && <div className='full-field amount-suggestion'><span>Sugestão de KM rodado · {suggestedAmountForStatus(draft.statusId, statuses)?.label}: <strong>{brl.format(suggestedAmountForStatus(draft.statusId, statuses)!.amount)}</strong></span><button type='button' onClick={() => { const suggestion = suggestedAmountForStatus(draft.statusId, statuses); if (suggestion) setDraft({ ...draft, amount: suggestion.amount.toFixed(2).replace('.', ',') }); }}>Aplicar valor</button></div>}",
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
  "<p>{view === 'agenda' ? 'Arraste um card para copiar o atendimento para outro dia/técnico. O faturamento pode ser alterado direto no card.' : view === 'outras' ? 'Consulte qualquer outra filial em modo leitura.' : view === 'retencao' ? 'Clientes sem atendimento futuro: trate pelo menos 3 por dia.' : view === 'caretrack' ? 'Atualize o último serviço sem alterar os dados automáticos.' : view === 'faturamento' ? 'Filtre e classifique a lista pelo cabeçalho.' : view === 'equipamentos' ? 'Pesquise e filtre os equipamentos por coluna.' : 'Mapa e próximos atendimentos da operação.'}</p>",
);

fs.writeFileSync(appPath, source);
console.log('patch-v3 aplicado');
