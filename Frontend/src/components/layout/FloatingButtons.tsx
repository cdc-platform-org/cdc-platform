import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const AUTO_COLLAPSE_DELAY_MS = 3500;
const WHATSAPP_LINK = 'https://wa.me/message/AN67535SBUEWN1';

interface FloatingButtonsProps {
  // Overrides the default "open the homepage AI assistant" behavior — useful
  // if a page wants to wire this button to its own chat/help widget instead.
  onAssistantClick?: () => void;
}

type ButtonId = 'assistant' | 'whatsapp';

export default function FloatingButtons({ onAssistantClick }: FloatingButtonsProps) {
  const router = useRouter();
  const [autoExpanded, setAutoExpanded] = useState(true);
  const [hoveredId, setHoveredId] = useState<ButtonId | null>(null);

  useEffect(() => {
    const collapse = () => setAutoExpanded(false);
    const timer = setTimeout(collapse, AUTO_COLLAPSE_DELAY_MS);
    window.addEventListener('scroll', collapse, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', collapse);
    };
  }, []);

  const isExpanded = (id: ButtonId) => autoExpanded || hoveredId === id;

  const hoverHandlers = (id: ButtonId) => ({
    onMouseEnter: () => setHoveredId(id),
    onMouseLeave: () => setHoveredId((current) => (current === id ? null : current)),
    onTouchStart: () => setHoveredId(id),
    onFocus: () => setHoveredId(id),
    onBlur: () => setHoveredId((current) => (current === id ? null : current)),
  });

  const handleAssistantClick = () => {
    if (onAssistantClick) {
      onAssistantClick();
      return;
    }
    router.push({ pathname: '/', query: { assistant: '1' } });
  };

  // Homepage-only — the AI assistant panel and this whole floating cluster
  // only make sense there; every other page would just show dead buttons.
  if (router.pathname !== '/') {
    return null;
  }

  const pillClass =
    'group flex h-12 items-center rounded-full overflow-hidden border-none cursor-pointer ' +
    'shadow-lg hover:shadow-2xl transition-all duration-500 ease-in-out transform ' +
    'hover:-translate-y-1 hover:scale-105 active:scale-95';

  const labelClass = (expanded: boolean) =>
    `whitespace-nowrap text-sm font-bold overflow-hidden transition-all duration-500 ease-in-out ${
      expanded ? 'max-w-[220px] opacity-100 pr-5' : 'max-w-0 opacity-0 pr-0'
    }`;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
      <button
        type="button"
        onClick={handleAssistantClick}
        {...hoverHandlers('assistant')}
        aria-label="მიწერე ასისტენტს"
        className={`${pillClass} bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/30`}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center text-xl">🤖</span>
        <span className={labelClass(isExpanded('assistant'))}>მიწერე ასისტენტს</span>
      </button>

      <a
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        {...hoverHandlers('whatsapp')}
        aria-label="მოგვწერე WhatsApp-ში"
        className={`${pillClass} bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-emerald-500/30`}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.454L0 24zm6.59-4.846c1.66.986 3.288 1.478 4.956 1.479 5.485.001 9.948-4.461 9.951-9.945.001-2.657-1.03-5.154-2.901-7.027-1.871-1.872-4.369-2.903-7.027-2.903-5.492 0-9.955 4.463-9.958 9.948-.002 1.78.473 3.518 1.378 5.04l-.994 3.633 3.73-.978zm11.567-5.282c-.313-.156-1.854-.915-2.131-1.016-.277-.1-.478-.156-.678.156-.2.313-.778.981-.954 1.18-.176.201-.353.226-.666.07-1.353-.679-2.265-1.196-3.17-2.756-.24-.412.24-.383.687-1.275.076-.151.038-.284-.019-.397-.056-.113-.478-1.151-.655-1.577-.173-.414-.347-.359-.478-.359-.124-.002-.266-.002-.408-.002s-.373.053-.568.266c-.195.213-.746.729-.746 1.777s.762 2.059.868 2.2c.107.142 1.5 2.292 3.633 3.213.507.219.903.351 1.213.449.51.162.973.139 1.339.085.409-.06 1.854-.758 2.115-1.454.26-.695.26-1.293.183-1.416-.078-.124-.28-.198-.593-.354z" />
          </svg>
        </span>
        <span className={labelClass(isExpanded('whatsapp'))}>მოგვწერე WhatsApp-ში</span>
      </a>
    </div>
  );
}
