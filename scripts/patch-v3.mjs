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

fs.writeFileSync(appPath, source);
console.log('patch-v3 aplicado');
