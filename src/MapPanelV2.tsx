import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPinned, Search } from 'lucide-react';
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

type Props = { appointments: AppointmentLike[]; branches: Branch[]; scopeLabel: string };
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
function parseIso(value: string) { return new Date(`${value}T12:00:00`); }
function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function normalize(value?: string | null) { return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

// Fallback permanente para evitar que filiais desapareçam quando o serviço público de geocodificação limita requisições.
// O popup continua exibindo o endereço real cadastrado no Supabase.
const BRANCH_FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  balsas: { lat: -7.5321, lng: -46.0372 },
  imperatriz: { lat: -5.5264, lng: -47.4917 },
  itaitinga: { lat: -3.9694, lng: -38.5298 },
  manaus: { lat: -3.0550, lng: -60.0157 },
  maraba: { lat: -5.3811, lng: -49.1323 },
  marituba: { lat: -1.3618, lng: -48.2506 },
  miritituba: { lat: -4.2762, lng: -55.9840 },
  'sao luis': { lat: -2.6476, lng: -44.2480 },
  teresina: { lat: -5.1705, lng: -42.7942 },
};

function fallbackForBranch(branch: Branch) {
  return BRANCH_FALLBACK_COORDS[normalize(branch.name)] || BRANCH_FALLBACK_COORDS[normalize(branch.city)] || null;
}

export function DashboardMapV2({ appointments, branches, scopeLabel }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const [daysAhead, setDaysAhead] = useState('30');
  const [query, setQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('todas');
  const [mapError, setMapError] = useState('');
  const today = isoDate(new Date());
  const end = isoDate(addDays(new Date(), Number(daysAhead)));

  const visibleBranches = useMemo(() => branchFilter === 'todas' ? branches : branches.filter((branch) => branch.id === branchFilter), [branches, branchFilter]);
  const visibleBranchIds = useMemo(() => new Set(visibleBranches.map((branch) => branch.id)), [visibleBranches]);
  const upcoming = useMemo(() => appointments
    .filter((item) => item.appointment_date >= today && item.appointment_date <= end)
    .filter((item) => visibleBranchIds.has(item.branch_id))
    .filter((item) => {
      const term = query.trim().toLowerCase();
      if (!term) return true;
      return `${item.technician?.name || ''} ${item.client_name_manual || ''} ${item.service_city || ''} ${item.branch?.name || ''}`.toLowerCase().includes(term);
    })
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date)), [appointments, today, end, query, visibleBranchIds]);

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
      const key = `agenda_geo_v3_${queryText.toLowerCase()}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        try { return { label, ...JSON.parse(cached) }; } catch { /* cache inválido */ }
      }
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(queryText)}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (!data?.[0]) return null;
        const point = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
        localStorage.setItem(key, JSON.stringify(point));
        return { label, ...point };
      } catch {
        return null;
      }
    }

    async function resolveBranchPoint(branch: Branch) {
      const fallback = fallbackForBranch(branch);
      const addressCandidates = [
        branch.address,
        branch.postal_code ? `${branch.postal_code}, Brasil` : null,
        [branch.city, branch.state, 'Brasil'].filter(Boolean).join(', '),
        `${branch.name}, Brasil`,
      ].filter(Boolean) as string[];

      // Primeiro usa cache de geocodificação, se já existir. Se a consulta externa falhar,
      // cai imediatamente no ponto local para garantir o marcador.
      for (const candidate of addressCandidates) {
        const cacheKey = `agenda_geo_v3_${candidate.toLowerCase()}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try { return { label: `Tracbel · ${branch.name}`, ...JSON.parse(cached) }; } catch { /* segue */ }
        }
      }
      if (fallback) return { label: `Tracbel · ${branch.name}`, ...fallback, fallback: true };

      for (const candidate of addressCandidates) {
        const point = await geocode(`Tracbel · ${branch.name}`, candidate);
        if (point) return point;
      }
      return null;
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

        const points: any[] = [];

        // Todas as filiais são resolvidas primeiro e sempre recebem marcador via fallback local.
        for (const branch of visibleBranches) {
          if (cancelled) return;
          const point = await resolveBranchPoint(branch);
          if (point) points.push({ ...point, kind: 'branch', branch });
        }

        // Cidades de clientes são complementares; falha nelas não afeta os marcadores das filiais.
        const uniqueCities = [...new Set(upcoming.map((item) => item.service_city).filter(Boolean) as string[])].slice(0, 20);
        for (const city of uniqueCities) {
          if (cancelled) return;
          const related = upcoming.filter((item) => item.service_city === city);
          const branch = visibleBranches.find((entry) => entry.id === related[0]?.branch_id);
          const stateHint = branch?.state ? `, ${branch.state}` : '';
          const point = await geocode(city, `${city}${stateHint}, Brasil`);
          if (point) points.push({ ...point, kind: 'client', city });
        }

        if (cancelled) return;
        const bounds: any[] = [];
        for (const point of points) {
          if (point.kind === 'branch') {
            const branch = point.branch as Branch;
            const related = upcoming.filter((item) => item.branch_id === branch.id);
            const icon = L.divIcon({ className: 'agenda-map-pin agenda-map-pin-branch', html: '<span>T</span>', iconSize: [32, 32], iconAnchor: [16, 16] });
            const address = branch.address || [branch.city, branch.state, branch.postal_code].filter(Boolean).join(' · ') || 'Endereço não informado';
            const popup = `<strong>Tracbel · ${branch.name}</strong><br/><span>${address}</span><br/><b>${related.length} atendimento(s) no período</b>`;
            L.marker([point.lat, point.lng], { icon }).addTo(map).bindPopup(popup);
            bounds.push([point.lat, point.lng]);
          } else {
            const related = upcoming.filter((item) => item.service_city === point.city);
            const icon = L.divIcon({ className: 'agenda-map-pin agenda-map-pin-client', html: `<span>${related.length}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] });
            const popup = `<strong>${point.city}</strong><br/>${related.slice(0, 8).map((item) => `${shortDate.format(parseIso(item.appointment_date))} · ${item.technician?.name || 'Técnico'} · ${item.client_name_manual || 'Cliente'}`).join('<br/>')}`;
            L.marker([point.lat, point.lng], { icon }).addTo(map).bindPopup(popup);
            bounds.push([point.lat, point.lng]);
          }
        }
        if (bounds.length > 0) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 10 });
        else setMapError('Nenhuma filial ou cidade pôde ser localizada no mapa.');
      } catch (error: any) {
        setMapError(error?.message || 'Mapa temporariamente indisponível.');
      }
    }

    buildMap();
    return () => { cancelled = true; if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [upcoming, visibleBranches]);

  return <section className='clean-panel map-dashboard-panel'>
    <div className='panel-heading map-heading'>
      <div><h2><MapPinned /> Mapa de atendimentos · {scopeLabel}</h2><p>Todas as filiais do filtro aparecem sempre; o endereço do cadastro é exibido no marcador.</p></div>
      <div className='map-controls'>
        <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}><option value='todas'>Todas as filiais</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        <select value={daysAhead} onChange={(event) => setDaysAhead(event.target.value)}><option value='7'>Próximos 7 dias</option><option value='15'>Próximos 15 dias</option><option value='30'>Próximos 30 dias</option><option value='60'>Próximos 60 dias</option></select>
        <div className='inline-search compact-search'><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Técnico, cliente ou cidade' /></div>
      </div>
    </div>
    <div className='branch-address-strip'>{visibleBranches.map((branch) => <div key={branch.id}><strong>{branch.name}</strong><span>{branch.address || [branch.city, branch.state, branch.postal_code].filter(Boolean).join(' · ') || 'Endereço não informado'}</span></div>)}</div>
    <div className='map-dashboard-grid'>
      <div className='agenda-map-wrap'><div ref={mapRef} className='agenda-live-map' />{mapError && <div className='map-warning'>{mapError}</div>}</div>
      <div className='upcoming-list'><div className='upcoming-list-head'><strong>{upcoming.length}</strong><span>próximos atendimento(s)</span></div>{upcoming.length === 0 ? <div className='empty-state'>Nenhum atendimento futuro no filtro. As filiais continuam visíveis no mapa.</div> : upcoming.slice(0, 18).map((item) => <div className='upcoming-item' key={item.id}><div className='upcoming-date'><strong>{shortDate.format(parseIso(item.appointment_date))}</strong><span>{item.branch?.name || 'Filial'}</span></div><div><strong>{item.technician?.name || 'Técnico não informado'}</strong><span>{item.service_city || 'Cidade não informada'} · {item.client_name_manual || 'Cliente não informado'}</span></div></div>)}</div>
    </div>
  </section>;
}
