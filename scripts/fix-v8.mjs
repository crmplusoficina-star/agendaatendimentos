import fs from 'node:fs';

function replaceRequired(source, label, before, after) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`fix-v8: trecho não encontrado: ${label}`);
  return source.replace(before, after);
}

const appPath = new URL('../src/AppNoAuthV3.tsx', import.meta.url);
let app = fs.readFileSync(appPath, 'utf8');

app = app.replace(
  "const [matricula, setMatricula] = useState(() => localStorage.getItem('agenda_matricula') || '');",
  "const [matricula, setMatricula] = useState('');",
);
app = app.replace('Digite somente sua matrícula para entrar.', 'Preencha a sua matrícula para entrar.');
app = app.replace("placeholder='Ex.: 19124'", "placeholder='Preencha a sua matrícula'");
app = app.replace("<span>{profile.matricula} · {roleLabel(profile.role)}</span>", "<span>{roleLabel(profile.role)}</span>");
fs.writeFileSync(appPath, app);

const operationsPath = new URL('../src/OperationsPanels.tsx', import.meta.url);
let operations = fs.readFileSync(operationsPath, 'utf8');

operations = replaceRequired(
  operations,
  'tipo g4 type',
  "  last_operation_type: string | null;\n  last_description: string | null;",
  "  last_operation_type: string | null;\n  last_os_type: string | null;\n  last_description: string | null;",
);

operations = operations.replace(
  "<small>Tipo G4: {row.last_operation_type || 'Não informado'}</small>",
  "<small>Tipo atendimento: {row.last_os_type || 'Não informado'}</small><small>Tipo OS: {row.last_operation_type || 'Não informado'}</small>",
);

const geoStart = operations.indexOf('const geoCache = new Map');
const careStart = operations.indexOf('export function CareTrackPanel');
if (geoStart < 0 || careStart < 0 || careStart <= geoStart) throw new Error('fix-v8: bloco de distância não encontrado');

const geoBlock = `const BRANCH_DISTANCE_COORDS: Record<string, { lat: number; lon: number }> = {
  BALSAS: { lat: -7.5321, lon: -46.0372 },
  IMPERATRIZ: { lat: -5.5264, lon: -47.4917 },
  ITAITINGA: { lat: -3.9694, lon: -38.5298 },
  MANAUS: { lat: -3.0550, lon: -60.0157 },
  MARABA: { lat: -5.3811, lon: -49.1323 },
  MARITUBA: { lat: -1.3618, lon: -48.2506 },
  MIRITITUBA: { lat: -4.2762, lon: -55.9840 },
  'SAO LUIS': { lat: -2.6476, lon: -44.2480 },
  TERESINA: { lat: -5.1705, lon: -42.7942 },
};
const geoCache = new Map<string, Promise<{ lat: number; lon: number } | null>>();
async function geocode(query: string) {
  const key = normalizeKey(query);
  if (!geoCache.has(key)) geoCache.set(key, (async () => {
    try {
      const cached = localStorage.getItem(\`followup_geo_v2_\${key}\`);
      if (cached) return JSON.parse(cached);
      try {
        const photon = await fetch(\`https://photon.komoot.io/api/?limit=1&q=\${encodeURIComponent(query)}\`);
        if (photon.ok) {
          const data = await photon.json();
          const coords = data?.features?.[0]?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            const point = { lat: Number(coords[1]), lon: Number(coords[0]) };
            localStorage.setItem(\`followup_geo_v2_\${key}\`, JSON.stringify(point));
            return point;
          }
        }
      } catch { /* tenta Nominatim */ }
      const response = await fetch(\`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=\${encodeURIComponent(query)}\`);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data?.[0]) return null;
      const point = { lat: Number(data[0].lat), lon: Number(data[0].lon) };
      localStorage.setItem(\`followup_geo_v2_\${key}\`, JSON.stringify(point));
      return point;
    } catch { return null; }
  })());
  return geoCache.get(key)!;
}
function haversineKm(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const r = 6371;
  const dLat = (to.lat - from.lat) * Math.PI / 180;
  const dLon = (to.lon - from.lon) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(a)));
}
async function routeKm(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  try {
    const response = await fetch(\`https://router.project-osrm.org/route/v1/driving/\${from.lon},\${from.lat};\${to.lon},\${to.lat}?overview=false\`);
    if (!response.ok) return null;
    const data = await response.json();
    return data?.routes?.[0]?.distance ? Math.round(data.routes[0].distance / 1000) : null;
  } catch { return null; }
}
function DistanceCell({ row, branches }: { row: FollowupRow; branches: BranchAddress[] }) {
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [estimated, setEstimated] = useState(false);
  const branch = branches.find((item) => normalizeKey(item.name) === normalizeKey(row.branch));
  async function calculate() {
    if (!branch || !row.city) return;
    setLoading(true);
    const clientQuery = [row.city, row.state, 'Brasil'].filter(Boolean).join(', ');
    const branchKey = normalizeKey(branch.name);
    const cacheKey = \`followup_route_v2_\${branchKey}_\${normalizeKey(clientQuery)}\`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setDistance(Number(parsed.km));
        setEstimated(Boolean(parsed.estimated));
        setLoading(false);
        return;
      } catch { /* recalcula */ }
    }
    const fallbackBranch = BRANCH_DISTANCE_COORDS[branchKey] || null;
    const branchQuery = branch.address || [branch.city, branch.state, 'Brasil'].filter(Boolean).join(', ');
    const [resolvedBranch, clientPoint] = await Promise.all([
      fallbackBranch ? Promise.resolve(fallbackBranch) : geocode(branchQuery),
      geocode(clientQuery),
    ]);
    if (resolvedBranch && clientPoint) {
      const road = await routeKm(resolvedBranch, clientPoint);
      const km = road ?? Math.round(haversineKm(resolvedBranch, clientPoint) * 1.2);
      const isEstimated = road === null;
      localStorage.setItem(cacheKey, JSON.stringify({ km, estimated: isEstimated }));
      setDistance(km);
      setEstimated(isEstimated);
    }
    setLoading(false);
  }
  useEffect(() => { setDistance(null); setEstimated(false); if (branch && row.city) calculate(); }, [branch?.name, row.city, row.state]);
  if (!branch) return <div className='distance-cell'><strong>Filial não localizada</strong><span>{row.branch || '—'}</span></div>;
  return <div className='distance-cell'><strong>{distance !== null ? \`≈ \${distance} km\` : loading ? 'Calculando...' : 'Distância indisponível'}</strong><span title={branch.address || ''}>{branch.name} → {row.city || 'cidade'}{distance !== null && estimated ? ' · estimativa' : ''}</span></div>;
}

`;
operations = operations.slice(0, geoStart) + geoBlock + operations.slice(careStart);
fs.writeFileSync(operationsPath, operations);
console.log('fix-v8 aplicado');
