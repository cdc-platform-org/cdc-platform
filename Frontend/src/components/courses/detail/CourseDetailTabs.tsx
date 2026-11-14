import { useRef } from 'react';
import { useTranslation } from 'next-i18next';
export type DetailTab = 'overview' | 'curriculum' | 'projects' | 'reviews';
export const detailTabs: DetailTab[] = ['overview', 'curriculum', 'projects', 'reviews'];
export default function CourseDetailTabs({ value, onChange }: { value: DetailTab; onChange: (tab: DetailTab) => void }) {
  const { t } = useTranslation('courses');
  const root = useRef<HTMLDivElement>(null);
  return <div ref={root} role="tablist" aria-label={t('academy.courseContent')} className="flex overflow-x-auto border-b border-cdc-border gap-6" onKeyDown={event => {
    const index = detailTabs.indexOf(value);
    const next = event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : null;
    if (next === null) return;
    event.preventDefault(); onChange(detailTabs[next]); root.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();
  }}>{detailTabs.map(tab => <button key={tab} id={`tab-${tab}`} type="button" role="tab" aria-selected={value === tab} aria-controls={`panel-${tab}`} tabIndex={value === tab ? 0 : -1} onClick={() => onChange(tab)} className={`shrink-0 border-b-2 py-4 text-sm font-bold transition-colors ${value === tab ? 'border-cdc-primary text-cdc-primary-ink' : 'border-transparent text-cdc-muted hover:text-cdc-ink'}`}>{t(`academy.${tab}`)}</button>)}</div>;
}
