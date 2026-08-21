import fs from 'node:fs';

function replaceRequired(source, label, before, after) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`fix-v7: trecho não encontrado: ${label}`);
  return source.replace(before, after);
}

const operationsPath = new URL('../src/OperationsPanels.tsx', import.meta.url);
let operations = fs.readFileSync(operationsPath, 'utf8');

operations = replaceRequired(
  operations,
  'meta diaria por cliente unico query',
  "supabase.from('followup_actions').select('id', { count: 'exact', head: true }).eq('created_by', profileId).gte('created_at', start.toISOString())",
  "supabase.from('followup_actions').select('client_name').eq('created_by', profileId).eq('activity_date', new Date().toISOString().slice(0, 10))",
);

operations = replaceRequired(
  operations,
  'meta diaria por cliente unico count',
  "setTodayCount(todayResponse.count || 0);",
  "setTodayCount(new Set(((todayResponse.data || []) as any[]).map((row) => normalizeKey(row.client_name))).size);",
);

operations = replaceRequired(
  operations,
  'ultimo tipo g4',
  "<small>Último: {shortDate.format(parseIso(row.last_service_date))} · {row.days_since_service} dias · Série {row.last_serial || '—'}</small>",
  "<small>Último: {shortDate.format(parseIso(row.last_service_date))} · {row.days_since_service} dias · Série {row.last_serial || '—'}</small><small>Tipo G4: {row.last_operation_type || 'Não informado'}</small>",
);

fs.writeFileSync(operationsPath, operations);

const contactPath = new URL('../src/ContactUpdatesPanel.tsx', import.meta.url);
let contact = fs.readFileSync(contactPath, 'utf8');

contact = replaceRequired(
  contact,
  'funil somente ultimo status',
  "    const stages = [\n      { key: 'contato', label: 'Contatados', test: (r: ActionRow) => ['contato_realizado', 'oportunidade', 'retorno_agendado', 'agendamento_criado', 'convertido'].includes(r.followup_status) },\n      { key: 'oportunidade', label: 'Oportunidades', test: (r: ActionRow) => ['oportunidade', 'retorno_agendado', 'agendamento_criado', 'convertido'].includes(r.followup_status) },\n      { key: 'retorno', label: 'Retornos', test: (r: ActionRow) => ['retorno_agendado', 'agendamento_criado', 'convertido'].includes(r.followup_status) },\n      { key: 'agenda', label: 'Agendamentos', test: (r: ActionRow) => ['agendamento_criado', 'convertido'].includes(r.followup_status) },\n      { key: 'convertido', label: 'Convertidos', test: (r: ActionRow) => r.followup_status === 'convertido' },\n    ];",
  "    const stages = [\n      { key: 'contato', label: 'Contatados', test: (r: ActionRow) => r.followup_status === 'contato_realizado' },\n      { key: 'oportunidade', label: 'Oportunidades', test: (r: ActionRow) => r.followup_status === 'oportunidade' },\n      { key: 'retorno', label: 'Retornos', test: (r: ActionRow) => r.followup_status === 'retorno_agendado' },\n      { key: 'agenda', label: 'Agendamentos', test: (r: ActionRow) => r.followup_status === 'agendamento_criado' },\n      { key: 'convertido', label: 'Convertidos', test: (r: ActionRow) => r.followup_status === 'convertido' },\n    ];",
);

contact = replaceRequired(
  contact,
  'descricao funil atual',
  "<div className='panel-heading'><div><h2>Funil de serviços</h2><p>Da tratativa inicial até a conversão em serviço.</p></div></div>",
  "<div className='panel-heading'><div><h2>Funil de serviços</h2><p>Cada cliente aparece somente na etapa do seu último status.</p></div></div>",
);

fs.writeFileSync(contactPath, contact);
console.log('fix-v7 aplicado');
