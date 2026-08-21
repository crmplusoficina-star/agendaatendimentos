import fs from 'node:fs';

const operationsPath = new URL('../src/OperationsPanels.tsx', import.meta.url);
let operations = fs.readFileSync(operationsPath, 'utf8');

// Retenção é consolidada por cliente; mostra apenas as filiais realmente existentes na origem G4.
operations = operations.replace(
  "  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));\n  const pagedRows = filtered.slice((page - 1) * pageSize, page * pageSize);",
  "  const availableOriginBranches = useMemo(() => {\n    const values = [...new Set(rows.map((row) => row.branch).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR'));\n    if (branchNames.length === 0 || branchNames.length >= allBranchCount) return values;\n    return values.filter((value) => branchNames.some((allowed) => normalizeKey(allowed) === normalizeKey(value)));\n  }, [rows, branchNames, allBranchCount]);\n  useEffect(() => { if (branchFilter !== 'todas' && !availableOriginBranches.some((value) => normalizeKey(value) === normalizeKey(branchFilter))) setBranchFilter('todas'); }, [availableOriginBranches, branchFilter]);\n  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));\n  const pagedRows = filtered.slice((page - 1) * pageSize, page * pageSize);"
);
operations = operations.replace(
  "<select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}><option value='todas'>Todas as filiais</option>{branchNames.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select>",
  "<select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}><option value='todas'>Todas as filiais de origem</option>{availableOriginBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select>"
);
operations = operations.replace(
  "<small>Tipo atendimento: {row.last_os_type || 'Não informado'}</small><small>Tipo OS: {row.last_operation_type || 'Não informado'}</small>",
  "<small>Tipo OS: {row.last_operation_type || 'Não informado'}</small>"
);
operations = operations.replace(
  "<p>Base G4 ordenada pela última data de atendimento. Priorize os clientes mais antigos e registre a oportunidade encontrada.</p>",
  "<p>Base G4 consolidada por cliente e pelo último atendimento de cada máquina. Atendimentos repetidos não viram novos clientes.</p>"
);
fs.writeFileSync(operationsPath, operations);

// Equipamentos: não exibe o campo genérico 'Ordem de Serviço Externa/Interna'; mantém o tipo de operação útil.
const enhancementsPath = new URL('../src/AgendaEnhancements.tsx', import.meta.url);
let enhancements = fs.readFileSync(enhancementsPath, 'utf8');
enhancements = enhancements.replace(
  "<small>G4: {item.g4_operation_type}{item.g4_os_type ? ` · ${item.g4_os_type}` : ''}</small>",
  "<small>G4: {item.g4_operation_type}</small>"
);
fs.writeFileSync(enhancementsPath, enhancements);

// Acompanhamentos: mostra apenas o Tipo OS/Operação relevante no resumo G4.
const contactPath = new URL('../src/ContactUpdatesPanel.tsx', import.meta.url);
let contact = fs.readFileSync(contactPath, 'utf8');
contact = contact.replace(
  "<small>{g4Detail.last_os_type || 'Tipo atendimento não informado'} · {g4Detail.last_service_date ? dateFmt.format(parseIso(g4Detail.last_service_date)) : ''}</small>",
  "<small>{g4Detail.last_service_date ? dateFmt.format(parseIso(g4Detail.last_service_date)) : ''}</small>"
);
fs.writeFileSync(contactPath, contact);
console.log('fix-v10 aplicado');
