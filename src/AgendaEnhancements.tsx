import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Filter, MapPinned, Search, SlidersHorizontal } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { AppointmentStatus, Branch } from './types';

type AppointmentLike = {
  id: string;
  branch_id: string;
  appointment_date: string;
  technician_id: string | null;
  client_name_manual: string | null;
  equipment_serial: string | null;
  service_city: string | null;
  status_id: string;
  amount: number;
  billing_status: string;
  status?: AppointmentStatus | null;
  technician?: { id: string; name: string } | null;
  branch?: Branch | null;
};

type EquipmentRow = {
  serial: string;
  client_name: string | null;
  city: string | null;
  state?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  current_hourmeter?: number | null;
  hourmeter_date?: string | null;
  caretrack_status?: string | null;
  has_pmp?: boolean | null;
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
function parseIso(value: string) { return new Date(`${value}T12:00:00`); }
function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function billingLabel(value: string) {
  if (value === 'faturado') return 'Faturado';
  if (value === 'aguardando_faturamento') return 'Aguardando faturamento';
  if (value === 'precificado') return 'Precificado';
  if (value === 'perdido') return 'Débito interno';
  return 'Não precificado';
}

export function DashboardMap({ appointments, branches, scopeLabel }: { appointments: AppointmentLike[]; branches: Branch[]; scopeLabel: string }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const [daysAhead, setDaysAhead] = useState('30');
  const [query, setQuery] = useState('');
  const [mapError, setMapError] = useState('');
  const today = isoDate(new Date());
  const end = isoDate(addDays(new Date(), Number(daysAhead)));

  const upcoming = useMemo(() => appointments
    .filter((item) => item.appointment_date >= today && item.appointment_date <= end)
    .filter((item) => {
      const term = query.trim().toLowerCase();
      if (!term) return true;
      return `${item.technician?.name || ''} ${item.client_name_manual || ''} ${item.service_city || ''} ${item.branch?.name || ''}`.toLowerCase().includes(term);
    })
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date)), [appointments, today, end, query]);

  useEffect(() => {
    let cancelled = false;
    async function ensureLeaflet() {
      if ((window as any).L) return (window as any).L;
      if (!document.querySelector('link[data-agenda-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.setAttribute('data-agenda-leaflet', '1');
        document.head.appendChild(link);
      }
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[data-agenda-leaflet]') as HTMLScriptElement | null;
        if (existing) {
          if ((window as any).L) resolve();
          else existing.addEventListener('load', () => resolve(), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        script.setAttribute('data-agenda-leaflet', '1');
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Não foi possível carregar o mapa.'));
        document.body.appendChild(script);
      });
      return (window as any).L;
    }
    async function geocode(label: string, queryText: string) {
      const key = `agenda_geo_${queryText.toLowerCase()}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        try { return { label, ...JSON.parse(cached) }; } catch { /* ignore */ }
      }
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(queryText)}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data?.[0]) return null;
      const point = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
      localStorage.setItem(key, JSON.stringify(point));
      return { label, ...point };
    }
    async function buildMap() {
      if (!mapRef.current) return;
      try {
        setMapError('');
        const L = await ensureLeaflet();
        if (cancelled || !mapRef.current) return;
        if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
        const map = L.map(mapRef.current, { zoomControl: true }).setView([-5.5, -47.5], 5);
        mapInstance.current = map;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(map);

        const relevantBranches = branches.filter((branch) => upcoming.some((item) => item.branch_id === branch.id)).slice(0, 6);
        const uniqueCities = [...new Set(upcoming.map((item) => item.service_city).filter(Boolean) as string[])].slice(0, 10);
        const points: any[] = [];
        for (const branch of relevantBranches) {
          if (cancelled) return;
          const point = await geocode(`Tracbel · ${branch.name}`, `Tracbel ${branch.name}, Brasil`);
          if (point) points.push({ ...point, kind: 'branch', branchName: branch.name });
        }
        for (const city of uniqueCities) {
          if (cancelled) return;
          const point = await geocode(city, `${city}, Brasil`);
          if (point) points.push({ ...point, kind: 'client', city });
        }
        if (cancelled) return;
        const bounds: any[] = [];
        for (const point of points) {
          const related = point.kind === 'branch' ? upcoming.filter((item) => item.branch?.name === point.branchName) : upcoming.filter((item) => item.service_city === point.city);
          const icon = L.divIcon({ className: `agenda-map-pin agenda-map-pin-${point.kind}`, html: `<span>${point.kind === 'branch' ? 'T' : related.length}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] });
          const lines = point.kind === 'branch'
            ? `<strong>Tracbel · ${point.branchName}</strong><br/>${related.length} atendimento(s) no período`
            : `<strong>${point.city}</strong><br/>${related.slice(0, 5).map((item) => `${shortDate.format(parseIso(item.appointment_date))} · ${item.technician?.name || 'Técnico'} · ${item.client_name_manual || 'Cliente'}`).join('<br/>')}`;
          L.marker([point.lat, point.lng], { icon }).addTo(map).bindPopup(lines);
          bounds.push([point.lat, point.lng]);
        }
        if (bounds.length > 0) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 10 });
        else setMapError('Nenhuma cidade pôde ser localizada no mapa para o período selecionado.');
      } catch (error: any) {
        setMapError(error?.message || 'Mapa temporariamente indisponível.');
      }
    }
    buildMap();
    return () => { cancelled = true; if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [upcoming, branches]);

  return <section className='clean-panel map-dashboard-panel'>
    <div className='panel-heading map-heading'><div><h2><MapPinned /> Mapa de atendimentos · {scopeLabel}</h2><p>Tracbel, cidade do cliente, técnico e próximos atendimentos.</p></div><div className='map-controls'><select value={daysAhead} onChange={(event) => setDaysAhead(event.target.value)}><option value='7'>Próximos 7 dias</option><option value='15'>Próximos 15 dias</option><option value='30'>Próximos 30 dias</option><option value='60'>Próximos 60 dias</option></select><div className='inline-search compact-search'><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Técnico, cliente ou cidade' /></div></div></div>
    <div className='map-dashboard-grid'>
      <div className='agenda-map-wrap'><div ref={mapRef} className='agenda-live-map' />{mapError && <div className='map-warning'>{mapError}</div>}</div>
      <div className='upcoming-list'><div className='upcoming-list-head'><strong>{upcoming.length}</strong><span>próximos atendimento(s)</span></div>{upcoming.length === 0 ? <div className='empty-state'>Nenhum atendimento futuro no filtro.</div> : upcoming.slice(0, 18).map((item) => <div className='upcoming-item' key={item.id}><div className='upcoming-date'><strong>{shortDate.format(parseIso(item.appointment_date))}</strong><span>{item.branch?.name || 'Filial'}</span></div><div><strong>{item.technician?.name || 'Técnico não informado'}</strong><span>{item.service_city || 'Cidade não informada'} · {item.client_name_manual || 'Cliente não informado'}</span></div></div>)}</div>
    </div>
  </section>;
}

export function BillingPanel({ appointments, scopeLabel, canEdit, statuses, updateBilling }: { appointments: AppointmentLike[]; scopeLabel: string; canEdit: boolean; statuses: AppointmentStatus[]; updateBilling: (item: any, value: string) => void | Promise<void> }) {
  const [query, setQuery] = useState('');
  const [billing, setBilling] = useState('todos');
  const [status, setStatus] = useState('todos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [city, setCity] = useState('todos');
  const [sort, setSort] = useState('data');
  const cities = useMemo(() => [...new Set(appointments.map((item) => item.service_city).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR')), [appointments]);
  const filtered = useMemo(() => appointments.filter((item) => {
    const term = query.trim().toLowerCase();
    const text = `${item.client_name_manual || ''} ${item.equipment_serial || ''} ${item.technician?.name || ''} ${item.service_city || ''}`.toLowerCase();
    return (!term || text.includes(term)) && (billing === 'todos' || item.billing_status === billing) && (status === 'todos' || item.status_id === status) && (!from || item.appointment_date >= from) && (!to || item.appointment_date <= to) && (city === 'todos' || item.service_city === city);
  }).sort((a, b) => sort === 'valor' ? Number(b.amount || 0) - Number(a.amount || 0) : sort === 'cliente' ? (a.client_name_manual || '').localeCompare(b.client_name_manual || '', 'pt-BR') : a.appointment_date.localeCompare(b.appointment_date)), [appointments, query, billing, status, from, to, city, sort]);
  const total = filtered.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return <section className='clean-panel advanced-list-panel'>
    <div className='panel-heading'><div><h2>Faturamento · {scopeLabel}</h2><p>Filtros no cabeçalho e troca de status sem abrir atendimento.</p></div><div className='classification-control'><ArrowUpDown /><select value={sort} onChange={(event) => setSort(event.target.value)}><option value='data'>Classificar por data</option><option value='valor'>Maior valor</option><option value='cliente'>Cliente A–Z</option></select></div></div>
    <div className='advanced-filterbar'><div className='inline-search'><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Cliente, série, técnico ou cidade' /></div><label>De<input type='date' value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Até<input type='date' value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
    <div className='advanced-summary'><span><strong>{filtered.length}</strong> registros</span><span><strong>{brl.format(total)}</strong> no filtro</span></div>
    <div className='smart-table billing-smart-table'>
      <div className='smart-head'><div><span>Cliente</span></div><div><span>Período</span></div><div><span>Status atendimento</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value='todos'>Todos</option>{statuses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><span>Cidade</span><select value={city} onChange={(event) => setCity(event.target.value)}><option value='todos'>Todas</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><span>Valor</span></div><div><span>Faturamento</span><select value={billing} onChange={(event) => setBilling(event.target.value)}><option value='todos'>Todos</option><option value='nao_precificado'>Não precificado</option><option value='precificado'>Precificado</option><option value='aguardando_faturamento'>Aguardando faturamento</option><option value='faturado'>Faturado</option><option value='perdido'>Débito interno</option></select></div></div>
      {filtered.length === 0 ? <div className='empty-state'>Nenhum atendimento para os filtros selecionados.</div> : filtered.map((item) => <div className='smart-row' key={item.id}><div><strong>{item.client_name_manual || 'Cliente não informado'}</strong><span>{item.equipment_serial || 'Sem série'} · {item.technician?.name || 'Sem técnico'}</span></div><div><strong>{shortDate.format(parseIso(item.appointment_date))}</strong><span>{item.branch?.name || ''}</span></div><div><span className='status-dot-line'><i style={{ background: item.status?.color_hex || '#94a3b8' }} />{item.status?.name || '—'}</span></div><div><strong>{item.service_city || '—'}</strong></div><div><strong>{brl.format(Number(item.amount || 0))}</strong></div><div><select disabled={!canEdit} value={item.billing_status} onChange={(event) => updateBilling(item, event.target.value)}><option value='nao_precificado'>Não precificado</option><option value='precificado'>Precificado</option><option value='aguardando_faturamento'>Aguardando faturamento</option><option value='faturado'>Faturado</option><option value='perdido'>Débito interno</option></select><small>{billingLabel(item.billing_status)}</small></div></div>)}
    </div>
  </section>;
}

export function EquipmentPanel({ scopeLabel }: { scopeLabel: string }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<EquipmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('todos');
  const [pmp, setPmp] = useState('todos');
  const [city, setCity] = useState('todos');
  const [sort, setSort] = useState('cliente');
  const [searched, setSearched] = useState(false);

  async function searchEquipment() {
    setLoading(true); setSearched(true);
    const term = query.trim();
    let request: any = supabase.from('equipment_context').select('serial,client_name,manufacturer,model,city,current_hourmeter,hourmeter_date,caretrack_status,has_pmp').limit(300);
    if (term) request = request.or(`serial.ilike.%${term}%,client_name.ilike.%${term}%,city.ilike.%${term}%`);
    const { data } = await request;
    setRows((data || []) as EquipmentRow[]); setLoading(false);
  }
  const cities = useMemo(() => [...new Set(rows.map((item) => item.city).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR')), [rows]);
  const filtered = useMemo(() => rows.filter((item) => (status === 'todos' || (item.caretrack_status || '').toLowerCase() === status) && (pmp === 'todos' || (pmp === 'sim' ? item.has_pmp : !item.has_pmp)) && (city === 'todos' || item.city === city)).sort((a, b) => sort === 'serie' ? a.serial.localeCompare(b.serial) : sort === 'cidade' ? (a.city || '').localeCompare(b.city || '', 'pt-BR') : (a.client_name || '').localeCompare(b.client_name || '', 'pt-BR')), [rows, status, pmp, city, sort]);
  return <section className='clean-panel advanced-list-panel'>
    <div className='panel-heading'><div><h2>Equipamentos · {scopeLabel}</h2><p>Consulta por série, cliente ou cidade com filtros por coluna.</p></div><div className='classification-control'><SlidersHorizontal /><select value={sort} onChange={(event) => setSort(event.target.value)}><option value='cliente'>Classificar por cliente</option><option value='serie'>Série</option><option value='cidade'>Cidade</option></select></div></div>
    <div className='advanced-filterbar'><div className='inline-search'><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Série, cliente ou cidade' onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); searchEquipment(); } }} /></div><button className='primary-button' onClick={searchEquipment}><Search /> Buscar</button></div>
    <div className='smart-table equipment-smart-table'><div className='smart-head'><div><span>Equipamento</span></div><div><span>Cliente</span></div><div><span>Cidade</span><select value={city} onChange={(event) => setCity(event.target.value)}><option value='todos'>Todas</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div><span>CareTrack</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value='todos'>Todos</option><option value='verde'>Verde</option><option value='amarelo'>Amarelo</option><option value='vermelho'>Vermelho</option><option value='cinza'>Cinza</option></select></div><div><span>PMP</span><select value={pmp} onChange={(event) => setPmp(event.target.value)}><option value='todos'>Todos</option><option value='sim'>Com PMP</option><option value='nao'>Sem PMP</option></select></div><div><span>Horímetro</span></div></div>{loading ? <div className='empty-state'>Buscando equipamentos...</div> : filtered.length === 0 ? <div className='empty-state'>{searched ? 'Nenhum equipamento para os filtros.' : 'Pesquise para listar equipamentos.'}</div> : filtered.map((item, index) => <div className='smart-row' key={`${item.serial}-${index}`}><div><strong>{item.serial}</strong><span>{item.model || item.manufacturer || '—'}</span></div><div><strong>{item.client_name || 'Cliente não informado'}</strong></div><div><strong>{item.city || '—'}</strong></div><div><span className='status-dot-line'><i className={`care-${(item.caretrack_status || '').toLowerCase()}`} />{item.caretrack_status || '—'}</span></div><div><strong>{item.has_pmp ? 'Sim' : 'Não'}</strong></div><div><strong>{item.current_hourmeter ?? '—'}</strong><span>{item.hourmeter_date ? shortDate.format(parseIso(item.hourmeter_date)) : ''}</span></div></div>)}</div>
  </section>;
}
