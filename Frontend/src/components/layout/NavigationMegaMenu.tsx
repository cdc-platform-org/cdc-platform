import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { NAV_DICT, type NavGroup } from '../../data/siteNavigation';
import type { SupportedLocale } from '../../utils/locale';

export default function NavigationMegaMenu({ entry, locale, active, triggerClass }: { entry: NavGroup; locale: SupportedLocale; active: boolean; triggerClass: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const nav = NAV_DICT[locale];
  const id = `navigation-${entry.key}`;
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div ref={root} className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }} onKeyDown={event => {
    if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={id} aria-current={active ? 'true' : undefined} className={`${triggerClass} border-none cursor-pointer`} onClick={() => setOpen(value => !value)} onKeyDown={event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => root.current?.querySelector<HTMLAnchorElement>('a')?.focus()); }
    }}>{nav.groups[entry.key]}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} /></button>
    {open && <div id={id} className="absolute top-full left-0 pt-4 z-[60] w-[34rem] max-w-[calc(100vw-3rem)]">
      <div className="overflow-hidden rounded-2xl border border-cdc-border bg-cdc-surface shadow-[0_20px_60px_-15px_rgba(0,0,0,0.22)]">
        <div className="grid grid-cols-2 p-4">{[entry.items.slice(0, Math.ceil(entry.items.length / 2)), entry.items.slice(Math.ceil(entry.items.length / 2))].map((items, index) => <div key={index} className={index ? 'border-l border-cdc-border pl-3' : 'pr-3'}>{items.map(item => {
          const Icon = item.icon;
          return <Link key={item.key} href={item.href} onClick={() => setOpen(false)} className="flex gap-3 rounded-xl p-3 no-underline hover:bg-cdc-primary-soft focus-visible:bg-cdc-primary-soft"><Icon className="h-5 w-5 shrink-0 text-cdc-primary-ink mt-0.5" /><span><span className="block text-[13px] font-bold text-cdc-ink">{nav.items[item.key].title}</span><span className="mt-1 block text-xs leading-relaxed text-cdc-muted">{nav.items[item.key].desc}</span></span></Link>;
        })}</div>)}</div>
        <Link href={entry.href} onClick={() => setOpen(false)} className="flex justify-between items-center border-t border-cdc-border bg-cdc-bg px-6 py-3 text-sm font-semibold text-cdc-primary-ink no-underline">{nav.groups[entry.key]}<ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>}
  </div>;
}
