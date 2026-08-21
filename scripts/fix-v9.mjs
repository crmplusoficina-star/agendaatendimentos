import fs from 'node:fs';

function requiredReplace(source, label, before, after) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`fix-v9: trecho não encontrado: ${label}`);
  return source.replace(before, after);
}
function requiredRegex(source, label, regex, after) {
  if (source.includes(after.slice(0, Math.min(after.length, 120)))) return source;
  if (!regex.test(source)) throw new Error(`fix-v9: regex não encontrou: ${label}`);
  regex.lastIndex = 0;
  return source.replace(regex, after);
}

// Mapa: endereços continuam no popup, mas os cards acima do mapa ficam ocultos.
const mapPath = new URL('../src/MapPanelV2.tsx', import.meta.url);
let map = fs.readFileSync(mapPath, 'utf8');
map = map.replace(/\n\s*<div className='branch-address-strip'>[\s\S]*?<\/div>\n\s*<div className='map-dashboard-grid'>/, "\n    <div className='map-dashboard-grid'>");
fs.writeFileSync(mapPath, map);

// Agenda: ao buscar uma série, G4 passa a ser a fonte prioritária de cliente e cidade.
const appPath = new URL('../src/AppNoAuthV3.tsx', import.meta.url);
let app = fs.readFileSync(appPath, 'utf8');
app = app.replace("source: 'caretrack' | 'directory';", "source: 'caretrack' | 'directory' | 'g4';");

const suggestionBlock = `  useEffect(() => {
    if (!draft) { setSuggestions([]); return; }
    const term = draft.serialQuery.trim();
    if (term.length < 3 || (draft.equipmentSerial && term === draft.equipmentSerial)) { setSuggestions([]); return; }
    const timer = window.setTimeout(async () => {
      setSuggestLoading(true);
      const [directoryResponse, careResponse, g4Response] = await Promise.all([
        supabase.from('equipment_directory').select('serial,client_name,city,state').ilike('serial', \`%\${term}%\`).eq('active', true).limit(8),
        supabase.from('equipment_context').select('serial,client_name,manufacturer,model,city,current_hourmeter,hourmeter_date,caretrack_status,has_pmp').ilike('serial', \`%\${term}%\`).limit(8),
        supabase.from('g4_machine_base').select('serial,client_name,contact_city,service_city,state').ilike('serial', \`%\${term}%\`).limit(8),
      ]);
      const merged = new Map<string, EquipmentSuggestion>();
      for (const item of (directoryResponse.data || []) as any[]) merged.set(item.serial, { serial: item.serial, client_name: item.client_name, city: item.city, state: item.state, source: 'directory' });
      for (const item of (careResponse.data || []) as any[]) merged.set(item.serial, { ...(merged.get(item.serial) || {}), ...item, serial: item.serial, source: 'caretrack' } as EquipmentSuggestion);
      for (const item of (g4Response.data || []) as any[]) {
        const previous = merged.get(item.serial);
        merged.set(item.serial, { ...previous, serial: item.serial, client_name: item.client_name || previous?.client_name || null, city: item.contact_city || item.service_city || previous?.city || null, state: item.state || previous?.state || null, source: 'g4' });
      }
      setSuggestions([...merged.values()].sort((a, b) => Number(!a.serial.toLowerCase().endsWith(term.toLowerCase())) - Number(!b.serial.toLowerCase().endsWith(term.toLowerCase()))).slice(0, 6));
      setSuggestLoading(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [draft?.serialQuery, draft?.equipmentSerial]);`;
app = requiredRegex(app, 'busca de série G4', /  useEffect\(\(\) => \{\n    if \(!draft\) \{ setSuggestions\(\[\]\); return; \}[\s\S]*?\n  \}, \[draft\?\.serialQuery, draft\?\.equipmentSerial\]\);/, suggestionBlock);

const enrichBlock = `  async function enrichSuggestion(item: EquipmentSuggestion) {
    const [careResponse, pmpResponse, g4Response] = await Promise.all([
      supabase.from('caretrack_equipment').select('serial,client_name,manufacturer,model,location,current_hourmeter,hourmeter_date,caretrack_status').eq('serial', item.serial).maybeSingle(),
      supabase.from('pmp_contracts').select('serial').eq('serial', item.serial).eq('contract_validity', 'VIGENTE').limit(1),
      supabase.from('g4_machine_base').select('client_name,contact_city,service_city,state').eq('serial', item.serial).maybeSingle(),
    ]);
    const care: any = careResponse.data;
    const g4: any = g4Response.data;
    const hasPmp = Boolean(pmpResponse.data && pmpResponse.data.length > 0);
    if (!draft) return;
    setDraft({
      ...draft,
      serialQuery: item.serial,
      equipmentSerial: item.serial,
      clientName: g4?.client_name || item.client_name || care?.client_name || '',
      city: g4?.contact_city || g4?.service_city || item.city || care?.location || '',
      caretrackStatus: care?.caretrack_status || item.caretrack_status || null,
      hasPmp,
      currentHourmeter: care?.current_hourmeter ?? item.current_hourmeter ?? null,
      hourmeterDate: care?.hourmeter_date || item.hourmeter_date || null,
    });
    setSuggestions([]);
  }

  async function refreshSerialContext(serial: string) {
    if (!serial || !draft) return;
    const [careResponse, pmpResponse, g4Response] = await Promise.all([
      supabase.from('caretrack_equipment').select('client_name,location,current_hourmeter,hourmeter_date,caretrack_status').eq('serial', serial).maybeSingle(),
      supabase.from('pmp_contracts').select('serial').eq('serial', serial).eq('contract_validity', 'VIGENTE').limit(1),
      supabase.from('g4_machine_base').select('client_name,contact_city,service_city').eq('serial', serial).maybeSingle(),
    ]);
    const care: any = careResponse.data;
    const g4: any = g4Response.data;
    setDraft((current) => current ? { ...current, clientName: g4?.client_name || current.clientName || care?.client_name || '', city: g4?.contact_city || g4?.service_city || current.city || care?.location || '', caretrackStatus: care?.caretrack_status || current.caretrackStatus, hasPmp: Boolean(pmpResponse.data?.length), currentHourmeter: care?.current_hourmeter ?? current.currentHourmeter, hourmeterDate: care?.hourmeter_date || current.hourmeterDate } : current);
  }

  function leaveProfile`;
app = requiredRegex(app, 'enriquecimento G4', /  async function enrichSuggestion\(item: EquipmentSuggestion\) \{[\s\S]*?\n  function leaveProfile/, enrichBlock);
fs.writeFileSync(appPath, app);

// Equipamentos: G4 fornece cliente/cidade/último atendimento; CareTrack complementa dados automáticos.
const enhancementsPath = new URL('../src/AgendaEnhancements.tsx', import.meta.url);
let enhancements = fs.readFileSync(enhancementsPath, 'utf8');
enhancements = requiredReplace(enhancements, 'tipo equipamento G4', "  has_pmp?: boolean | null;\n};", "  has_pmp?: boolean | null;\n  g4_os_type?: string | null;\n  g4_operation_type?: string | null;\n  g4_last_service_at?: string | null;\n  g4_contact_name?: string | null;\n  g4_contact_email?: string | null;\n};");
const equipmentSearch = `  async function searchEquipment() {
    setLoading(true); setSearched(true);
    const term = query.trim();
    let careRequest: any = supabase.from('equipment_context').select('serial,client_name,manufacturer,model,city,current_hourmeter,hourmeter_date,caretrack_status,has_pmp').limit(300);
    let g4Request: any = supabase.from('g4_machine_base').select('serial,client_name,contact_city,service_city,state,last_os_type,last_operation_type,last_service_at,contact_name,contact_email').limit(300);
    if (term) {
      careRequest = careRequest.or(\`serial.ilike.%\${term}%,client_name.ilike.%\${term}%,city.ilike.%\${term}%\`);
      g4Request = g4Request.or(\`serial.ilike.%\${term}%,client_name.ilike.%\${term}%,contact_city.ilike.%\${term}%,service_city.ilike.%\${term}%\`);
    }
    const [careResponse, g4Response] = await Promise.all([careRequest, g4Request]);
    const merged = new Map<string, EquipmentRow>();
    for (const item of (careResponse.data || []) as any[]) merged.set(item.serial, { ...item });
    for (const item of (g4Response.data || []) as any[]) {
      const previous = merged.get(item.serial) || { serial: item.serial, client_name: null, city: null };
      merged.set(item.serial, { ...previous, serial: item.serial, client_name: item.client_name || previous.client_name, city: item.contact_city || item.service_city || previous.city, state: item.state || previous.state, g4_os_type: item.last_os_type, g4_operation_type: item.last_operation_type, g4_last_service_at: item.last_service_at, g4_contact_name: item.contact_name, g4_contact_email: item.contact_email });
    }
    setRows([...merged.values()]); setLoading(false);
  }
  const cities =`;
enhancements = requiredRegex(enhancements, 'consulta equipamentos G4', /  async function searchEquipment\(\) \{[\s\S]*?\n  const cities =/, equipmentSearch);
enhancements = enhancements.replace('Consulta por série, cliente ou cidade com filtros por coluna.', 'G4 é a fonte de cliente, cidade e último atendimento; CareTrack complementa horímetro e PMP.');
enhancements = enhancements.replace("<span>{item.model || item.manufacturer || '—'}</span>", "<span>{item.model || item.manufacturer || '—'}</span>{item.g4_operation_type && <small>G4: {item.g4_operation_type}{item.g4_os_type ? ` · ${item.g4_os_type}` : ''}</small>}");
enhancements = enhancements.replace("<div><strong>{item.client_name || 'Cliente não informado'}</strong></div><div><strong>{item.city || '—'}</strong></div>", "<div><strong>{item.client_name || 'Cliente não informado'}</strong>{item.g4_contact_email && <span>{item.g4_contact_email}</span>}</div><div><strong>{item.city || '—'}</strong>{item.g4_last_service_at && <span>Último G4: {shortDate.format(new Date(item.g4_last_service_at))}</span>}</div>");
fs.writeFileSync(enhancementsPath, enhancements);

// Acompanhamentos: detalhe do cliente mostra o cadastro e último atendimento diretamente do G4.
const contactPath = new URL('../src/ContactUpdatesPanel.tsx', import.meta.url);
let contact = fs.readFileSync(contactPath, 'utf8');
contact = contact.replace("type UserOption = { id: string; full_name: string; role: string };", "type G4Detail = { client_name: string; city: string | null; state: string | null; branch: string | null; last_service_date: string; last_serial: string | null; last_os_type: string | null; last_operation_type: string | null; contact_name: string | null; contact_email: string | null; phones: string | null };\ntype UserOption = { id: string; full_name: string; role: string };");
contact = contact.replace("  const [selectedClient, setSelectedClient] = useState<string | null>(null);", "  const [selectedClient, setSelectedClient] = useState<string | null>(null);\n  const [g4Detail, setG4Detail] = useState<G4Detail | null>(null);");
contact = requiredReplace(contact, 'detalhe g4 efeito', "  const selectedHistory = useMemo(() => selectedClient ? actions.filter((row) => row.client_name === selectedClient) : [], [actions, selectedClient]);", "  const selectedHistory = useMemo(() => selectedClient ? actions.filter((row) => row.client_name === selectedClient) : [], [actions, selectedClient]);\n  useEffect(() => {\n    let active = true;\n    if (!selectedClient) { setG4Detail(null); return; }\n    supabase.from('v_client_last_service').select('client_name,city,state,branch,last_service_date,last_serial,last_os_type,last_operation_type,contact_name,contact_email,phones').eq('client_name', selectedClient).maybeSingle().then(({ data }) => { if (active) setG4Detail((data || null) as G4Detail | null); });\n    return () => { active = false; };\n  }, [selectedClient]);");
contact = contact.replace("<div className='quick-modal-head'><div><h2>{selectedClient}</h2><p>Histórico completo de tratativas.</p></div><button onClick={() => setSelectedClient(null)}><X /></button></div><div className='contact-timeline'>", "<div className='quick-modal-head'><div><h2>{selectedClient}</h2><p>Histórico completo de tratativas.</p></div><button onClick={() => setSelectedClient(null)}><X /></button></div>{g4Detail && <div className='g4-detail-strip'><div><span>Último G4</span><strong>{g4Detail.last_operation_type || 'Tipo OS não informado'}</strong><small>{g4Detail.last_os_type || 'Tipo atendimento não informado'} · {g4Detail.last_service_date ? dateFmt.format(parseIso(g4Detail.last_service_date)) : ''}</small></div><div><span>Equipamento</span><strong>{g4Detail.last_serial || '—'}</strong><small>{g4Detail.city || 'Cidade não informada'}{g4Detail.state ? `/${g4Detail.state}` : ''} · {g4Detail.branch || 'Sem filial'}</small></div><div><span>Contato G4</span><strong>{g4Detail.contact_name || 'Não informado'}</strong><small>{g4Detail.contact_email || 'Sem e-mail'}{g4Detail.phones ? ` · ${g4Detail.phones}` : ''}</small></div></div>}<div className='contact-timeline'>");
fs.writeFileSync(contactPath, contact);

const cssPath = new URL('../src/enhancements.css', import.meta.url);
let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.g4-detail-strip{')) css += "\n.g4-detail-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.g4-detail-strip>div{display:flex;flex-direction:column;gap:3px}.g4-detail-strip span,.g4-detail-strip small{font-size:11px;color:#64748b}.g4-detail-strip strong{font-size:12px;color:#0f172a}@media(max-width:800px){.g4-detail-strip{grid-template-columns:1fr}}\n";
fs.writeFileSync(cssPath, css);
console.log('fix-v9 aplicado');
