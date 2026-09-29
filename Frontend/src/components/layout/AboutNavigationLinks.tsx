import Link from 'next/link';
import { Users, GalleryHorizontal, PlayCircle } from 'lucide-react';
import { useRouter } from 'next/router';
import { resolveLocale } from '../../utils/locale';
import ka from '../../../public/locales/ka/home.json';
import en from '../../../public/locales/en/home.json';
import de from '../../../public/locales/de/home.json';
import es from '../../../public/locales/es/home.json';
import fr from '../../../public/locales/fr/home.json';
import uk from '../../../public/locales/uk/home.json';

// Read the existing home resources directly: content pages do not all load
// the home namespace. Both header variants share this order and these routes.
const resources = { ka, en, de, es, fr, uk };
const items = [
  { href: '/about', key: 'aboutCenter' },
  { href: '/mentors', key: 'mentors' },
  { href: '/trainers', key: 'trainers' },
  { href: '/about#team', key: 'teamMembers' },
  { href: '/gallery', key: 'photoGallery' },
  { href: '/tutorials', key: 'videoTutorials' },
] as const;

interface Props {
  className: string | ((index: number) => string);
  onNavigate?: () => void;
  icons?: 'desktop' | 'mobile';
}

export default function AboutNavigationLinks({ className, onNavigate, icons }: Props) {
  const { locale } = useRouter();
  const labels = { ...en, ...resources[resolveLocale(locale)] };
  return <>{items.map(({ href, key }, index) => (
    <Link key={key} href={href} onClick={onNavigate}
      className={typeof className === 'function' ? className(index) : className}>
      {icons === 'desktop' && key === 'mentors' && <Users className="w-4 h-4 shrink-0" />}
      {icons === 'desktop' && key === 'photoGallery' && <GalleryHorizontal className="w-4 h-4 shrink-0" />}
      {icons && key === 'videoTutorials' && <PlayCircle className={icons === 'desktop' ? 'w-4 h-4 shrink-0' : 'w-5 h-5 shrink-0'} />}
      {labels[key]}
    </Link>
  ))}</>;
}
