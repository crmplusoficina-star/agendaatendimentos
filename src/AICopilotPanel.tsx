import { useCallback, useEffect, useState } from 'react';
import { Bell, Check, Eye, Lightbulb, ThumbsUp, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import './ai-copilot.css';

type Insight = {
  id: string;
  appointment_id: string | null;
  insight_type: string;
  priority: string;
  presentation_level: number;
  title: string;
  message: string;
  status: string;
  created_at: string;
};

type Props = { profileId: string; branchIds: string[] };

const iconFor = (type: string) => type === 'preventivo' ? '🔧' : type === 'historico' ? '🔎' : type === 'planejamento' ? '📅' : type === 'relacionamento' ? '📍' : type === 'comercial' ? '💰' : '💡';

export function AICopilotPanel({ profileId, branchIds }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Insight[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q: any = supabase.from('ai_insights').select('id,appointment_id,insight_type,priority,presentation_level,title,message,status,created_at,branch_id').in('status', ['new', 'viewed', 'useful']).order('created_at', { ascending: false }).limit(40);
    if (branchIds.length === 1) q = q.eq('branch_id', branchIds[0]);
    else if (branchIds.length > 1) q = q.in('branch_id', branchIds);
    const { data } = await q;
    setItems((data || []) as Insight[]);
  }, [branchIds.join('|')]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 45000);
    const refresh = () => load();
    window.addEventListener('agenda-ai-refresh', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('agenda-ai-refresh', refresh); };
  }, [load]);

  async function feedback(id: string, status: 'viewed' | 'ignored' | 'useful' | 'converted') {
    setBusy(id);
    await supabase.functions.invoke('ai-agenda-copilot', { body: { operation: 'feedback', insight_id: id, status, profile_id: profileId } });
    setBusy(null);
    await load();
  }

  const unread = items.filter((item) => item.status === 'new').length;
  return <div className='ai-bell-wrap'>
    <button className='ai-bell-button' title='Insights da agenda' onClick={() => setOpen((value) => !value)}><Bell />{unread > 0 && <b>{unread > 9 ? '9+' : unread}</b>}</button>
    {open && <div className='ai-insight-drawer'>
      <div className='ai-insight-head'><div><strong><Lightbulb /> Copiloto da agenda</strong><span>Sugestões aparecem somente quando há contexto suficiente.</span></div><button onClick={() => setOpen(false)}><X /></button></div>
      {items.length === 0 ? <div className='ai-empty'><Check /><strong>Nenhum insight relevante agora</strong><span>A análise silenciosa também é um resultado válido.</span></div> : <div className='ai-insight-list'>{items.map((item) => <article key={item.id} className={`ai-insight-item priority-${item.priority}`}>
        <div className='ai-insight-title'><span>{iconFor(item.insight_type)}</span><div><strong>{item.title}</strong><small>{item.insight_type} · {item.priority}</small></div></div>
        <p>{item.message}</p>
        <div className='ai-insight-actions'><button disabled={busy === item.id} onClick={() => feedback(item.id, 'viewed')}><Eye /> Ver</button><button disabled={busy === item.id} onClick={() => feedback(item.id, 'useful')}><ThumbsUp /> Útil</button><button disabled={busy === item.id} onClick={() => feedback(item.id, 'ignored')}><X /> Ignorar</button></div>
      </article>)}</div>}
    </div>}
  </div>;
}

export function AppointmentInsight({ appointmentId }: { appointmentId?: string }) {
  const [item, setItem] = useState<Insight | null>(null);
  useEffect(() => {
    let active = true;
    if (!appointmentId) { setItem(null); return; }
    const load = () => supabase.from('ai_insights').select('id,appointment_id,insight_type,priority,presentation_level,title,message,status,created_at').eq('appointment_id', appointmentId).in('status', ['new', 'viewed', 'useful']).gte('presentation_level', 3).order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => { if (active) setItem((data || null) as Insight | null); });
    load();
    const refresh = () => load();
    window.addEventListener('agenda-ai-refresh', refresh);
    return () => { active = false; window.removeEventListener('agenda-ai-refresh', refresh); };
  }, [appointmentId]);
  if (!item) return null;
  return <div className='appointment-ai-card'><span>{iconFor(item.insight_type)}</span><div><strong>{item.title}</strong><p>{item.message}</p></div></div>;
}
