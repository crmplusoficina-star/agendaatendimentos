import fs from 'node:fs';

function replaceRequired(source, label, before, after) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`fix-followup: trecho não encontrado: ${label}`);
  return source.replace(before, after);
}

const appPath = new URL('../src/AppNoAuthV3.tsx', import.meta.url);
let app = fs.readFileSync(appPath, 'utf8');
app = app.replace("select('id,name,slug').eq('active', true).order('name')", "select('id,name,slug,address,city,state,postal_code').eq('active', true).order('name')");
fs.writeFileSync(appPath, app);

const enhancementsPath = new URL('../src/AgendaEnhancements.tsx', import.meta.url);
let enhancements = fs.readFileSync(enhancementsPath, 'utf8');
enhancements = enhancements.replace(
  "const point = await geocode(`Tracbel · ${branch.name}`, `Tracbel ${branch.name}, Brasil`);",
  "const branchQuery = branch.address || [branch.city, branch.state, 'Brasil'].filter(Boolean).join(', ');\n          const point = await geocode(`Tracbel · ${branch.name}`, branchQuery || `Tracbel ${branch.name}, Brasil`);"
);
fs.writeFileSync(enhancementsPath, enhancements);

const operationsPath = new URL('../src/OperationsPanels.tsx', import.meta.url);
let source = fs.readFileSync(operationsPath, 'utf8');

source = replaceRequired(source, 'branch type',
  "type Props = { profileId: string; branchNames: string[]; allBranchCount: number; canEdit: boolean; scopeLabel: string };",
  "type BranchAddress = { name: string; address: string | null; city: string | null; state: string | null; postal_code: string | null };\ntype Props = { profileId: string; branchNames: string[]; allBranchCount: number; canEdit: boolean; scopeLabel: string };"
);

source = replaceRequired(source, 'distance helpers',
  "function moneyToNumber(raw: string) {\n  const clean = raw.trim().replace(/\\s/g, '');\n  if (!clean) return null;\n  if (clean.includes(',')) return Number(clean.replace(/\\./g, '').replace(',', '.')) || null;\n  return Number(clean) || null;\n}\n",
  "function moneyToNumber(raw: string) {\n  const clean = raw.trim().replace(/\\s/g, '');\n  if (!clean) return null;\n  if (clean.includes(',')) return Number(clean.replace(/\\./g, '').replace(',', '.')) || null;\n  return Number(clean) || null;\n}\nfunction normalizeKey(value?: string | null) { return (value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().toUpperCase(); }\nconst geoCache = new Map<string, Promise<{ lat: number; lon: number } | null>>();\nasync function geocode(query: string) {\n  const key = normalizeKey(query);\n  if (!geoCache.has(key)) geoCache.set(key, (async () => {\n    try {\n      const cached = localStorage.getItem(`followup_geo_${key}`);\n      if (cached) return JSON.parse(cached);\n      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`);\n      if (!response.ok) return null;\n      const data = await response.json();\n      if (!data?.[0]) return null;\n      const point = { lat: Number(data[0].lat), lon: Number(data[0].lon) };\n      localStorage.setItem(`followup_geo_${key}`, JSON.stringify(point));\n      return point;\n    } catch { return null; }\n  })());\n  return geoCache.get(key)!;\n}\nasync function routeKm(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {\n  try {\n    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`);\n    if (!response.ok) return null;\n    const data = await response.json();\n    return data?.routes?.[0]?.distance ? Math.round(data.routes[0].distance / 1000) : null;\n  } catch { return null; }\n}\nfunction DistanceCell({ row, branches }: { row: FollowupRow; branches: BranchAddress[] }) {\n  const [distance, setDistance] = useState<number | null>(null);\n  const [loading, setLoading] = useState(false);\n  const branch = branches.find((item) => normalizeKey(item.name) === normalizeKey(row.branch));\n  async function calculate() {\n    if (!branch || !row.city) return;\n    setLoading(true);\n    const branchQuery = branch.address || [branch.city, branch.state, 'Brasil'].filter(Boolean).join(', ');\n    const clientQuery = [row.city, row.state, 'Brasil'].filter(Boolean).join(', ');\n    const cacheKey = `followup_route_${normalizeKey(branchQuery)}_${normalizeKey(clientQuery)}`;\n    const cached = localStorage.getItem(cacheKey);\n    if (cached) { setDistance(Number(cached)); setLoading(false); return; }\n    const [from, to] = await Promise.all([geocode(branchQuery), geocode(clientQuery)]);\n    if (from && to) { const km = await routeKm(from, to); if (km !== null) { localStorage.setItem(cacheKey, String(km)); setDistance(km); } }\n    setLoading(false);\n  }\n  useEffect(() => { if (branch && row.city) calculate(); }, [branch?.name, row.city, row.state]);\n  if (!branch) return <div className='distance-cell'><strong>Filial não localizada</strong><span>{row.branch || '—'}</span></div>;\n  return <div className='distance-cell'><strong>{distance !== null ? `≈ ${distance} km` : loading ? 'Calculando...' : 'Distância indisponível'}</strong><span title={branch.address || ''}>{branch.name} → {row.city || 'cidade'}</span></div>;\n}\n"
);

source = replaceRequired(source, 'retention states',
  "  const [todayCount, setTodayCount] = useState(0);\n  const [error, setError] = useState('');",
  "  const [todayCount, setTodayCount] = useState(0);\n  const [branches, setBranches] = useState<BranchAddress[]>([]);\n  const [page, setPage] = useState(1);\n  const pageSize = 20;\n  const [error, setError] = useState('');"
);

source = replaceRequired(source, 'load branches',
  "    const [queueResponse, todayResponse] = await Promise.all([\n      supabase.from('v_followup_queue').select('*').eq('has_future_appointment', false).order('last_service_date', { ascending: true }).limit(500),\n      supabase.from('followup_actions').select('id', { count: 'exact', head: true }).eq('created_by', profileId).gte('created_at', start.toISOString()),\n    ]);\n    setRows((queueResponse.data || []) as FollowupRow[]);\n    setTodayCount(todayResponse.count || 0);\n    setError(queueResponse.error?.message || todayResponse.error?.message || '');",
  "    const [queueResponse, todayResponse, branchResponse] = await Promise.all([\n      supabase.from('v_followup_queue').select('*').eq('has_future_appointment', false).order('last_service_date', { ascending: true }).limit(500),\n      supabase.from('followup_actions').select('id', { count: 'exact', head: true }).eq('created_by', profileId).gte('created_at', start.toISOString()),\n      supabase.from('branches').select('name,address,city,state,postal_code').eq('active', true).order('name'),\n    ]);\n    setRows((queueResponse.data || []) as FollowupRow[]);\n    setBranches((branchResponse.data || []) as BranchAddress[]);\n    setTodayCount(todayResponse.count || 0);\n    setError(queueResponse.error?.message || todayResponse.error?.message || branchResponse.error?.message || '');"
);

source = replaceRequired(source, 'branch filter',
  "      const typeMatch = typeFilter === 'todos' || row.last_treatment_type === typeFilter;\n      return textMatch && agingMatch && statusMatch && typeMatch;",
  "      const typeMatch = typeFilter === 'todos' || row.last_treatment_type === typeFilter;\n      const branchMatch = branchNames.length === 0 || branchNames.some((branch) => normalizeKey(branch) === normalizeKey(row.branch));\n      return textMatch && agingMatch && statusMatch && typeMatch && branchMatch;"
);

source = source.replace(
  "  }, [rows, query, agingFilter, statusFilter, typeFilter, sortMode]);",
  "  }, [rows, query, agingFilter, statusFilter, typeFilter, sortMode, branchNames]);\n  useEffect(() => { setPage(1); }, [query, agingFilter, statusFilter, typeFilter, sortMode, branchNames]);\n  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));\n  const pagedRows = filtered.slice((page - 1) * pageSize, page * pageSize);"
);

source = source.replace(
  "<div className='followup-table-head'><span>Cliente / último atendimento</span><span>Classificação</span><span>Última tratativa</span><span>Contato</span><span></span></div>",
  "<div className='followup-table-head'><span>Cliente / último atendimento</span><span>Classificação</span><span>Deslocamento</span><span>Última tratativa</span><span>Contato</span><span></span></div>"
);
source = source.replace("{filtered.map((row) => <div className='followup-row' key={row.client_name}>", "{pagedRows.map((row) => <div className='followup-row' key={row.client_name + '-' + (row.last_serial || '')}>");
source = source.replace(
  "        <div><span className={`priority-pill ${priorityClass(row.priority_classification)}`}>{row.priority_classification}</span><small className='aging-small'>{row.aging_bucket}</small></div>\n        <div className='followup-last'>",
  "        <div><span className={`priority-pill ${priorityClass(row.priority_classification)}`}>{row.priority_classification}</span><small className='aging-small'>{row.aging_bucket}</small></div>\n        <DistanceCell row={row} branches={branches} />\n        <div className='followup-last'>"
);
source = source.replace(
  "    </div>}\n\n    {draft &&",
  "    </div>}\n    {filtered.length > pageSize && <div className='followup-pagination'><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button><span>Página {page} de {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Próxima</button></div>}\n\n    {draft &&"
);

fs.writeFileSync(operationsPath, source);
console.log('fix-followup aplicado');
