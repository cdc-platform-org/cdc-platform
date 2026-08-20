import { useState, useEffect, FormEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Briefcase, Sparkles, FileEdit, Sun, Moon, ArrowUpRight } from 'lucide-react';
import SiteFooter from '../src/components/layout/SiteFooter';
import BackButton from '../src/components/common/BackButton';
import Toast from '../src/components/shared/Toast';
import { AgencyContent, AgencyPortfolioItem } from '../src/types/siteContent';
import { getSiteContent } from '../src/services/siteContentService';
import { resolveBlogImageUrl } from '../src/services/blogService';
import { onImageErrorFallback } from '../src/utils/imageFallback';

const OBJECT_POSITION: Record<string, string> = {
  top: 'center top',
  center: 'center center',
  bottom: 'center bottom',
  left: 'left center',
  right: 'right center',
};
import { submitStudioInquiry } from '../src/services/studioService';

// Bundled fallback shown until (or unless) an admin adds portfolio items via
// /admin/cms/agency — keeps the page populated on a fresh install with no
// CMS rows yet, same fallback pattern as the homepage's DEFAULT stats/FAQ.
// imageUrl below points at Pollinations.ai (the same unauthenticated,
// no-key image generator services/aiAgentService.ts uses for blog covers)
// as an illustrative placeholder cover — replace with a real project
// screenshot via the CMS once available. externalLink is only set for
// Taylor.ge since that's the one project whose live domain is already
// named in its own title/description; the others are left unset (the card
// simply renders non-interactive) rather than guessing a URL.
const DEFAULT_PORTFOLIO: AgencyPortfolioItem[] = [
  {
    badgeKa: 'GITA მხარდაჭერა',
    badgeEn: 'GITA Support',
    titleKa: 'თაილორ.გე - ინოვაციური სტარტაპი',
    titleEn: 'Taylor.ge - Innovative Startup',
    subtitleKa: 'ვებ-დეველოპმენტი & მარკეტინგი',
    subtitleEn: 'Web Development & Marketing',
    descKa: 'ციფრული სამკერვალო თარგების პლატფორმის სრული ვებ-მხარდაჭერა და სოციალური ქსელების მართვა.',
    descEn: 'Full web support and social media management for a digital sewing patterns platform.',
    statusKa: '✓ წარმატებული ქეისი',
    statusEn: '✓ Success Case',
    imageUrl: 'https://image.pollinations.ai/prompt/modern%20e-commerce%20website%20mockup%20on%20laptop%20screen%2C%20sewing%20and%20fashion%20patterns%20platform%2C%20isometric%203D%20vector%20illustration%2C%20vibrant%20tech%20colors%2C%20clean%20professional%20design%2C%20studio%20lighting%2C%2016%3A9?width=1280&height=720&seed=101&nologo=true',
    externalLink: 'https://taylor.ge',
  },
  {
    badgeKa: 'ტურიზმი',
    badgeEn: 'Tourism',
    titleKa: 'მწვანე გურია - ეკო ტურიზმი',
    titleEn: 'Green Guria - Eco Tourism',
    subtitleKa: 'UI/UX დიზაინი & საიტი',
    subtitleEn: 'UI/UX Design & Web',
    descKa: 'გურიის 10 ნაკლებად ცნობილი ლოკაციის ციფრული პლატფორმა და საინფორმაციო QR ფირფიშების დიზაინი.',
    descEn: 'Digital platform and informational QR plates design for 10 hidden locations of Guria.',
    statusKa: '✓ წარმატებული ქეისი',
    statusEn: '✓ Success Case',
    imageUrl: 'https://image.pollinations.ai/prompt/eco%20tourism%20digital%20platform%20with%20map%20pins%20over%20green%20hills%2C%20QR%20code%20signage%2C%20isometric%203D%20vector%20illustration%2C%20vibrant%20nature%20tech%20colors%2C%20clean%20professional%20design%2C%20studio%20lighting%2C%2016%3A9?width=1280&height=720&seed=102&nologo=true',
  },
  {
    badgeKa: 'SMM',
    badgeEn: 'SMM',
    titleKa: 'ლოკალური ბიზნესების ციფრული მხარდაჭერა',
    titleEn: 'Digital Support for Local Businesses',
    subtitleKa: 'SMM & ანიმაცია',
    subtitleEn: 'SMM & Animation',
    descKa: 'სოციალური მედიის სარეკლამო კონტენტის, ანიმაციებისა და ბრენდინგის მიწოდება რეგიონული ბიზნესებისთვის.',
    descEn: 'Providing social media advertising content, animations, and branding for regional businesses.',
    statusKa: '✓ წარმატებული ქეისი',
    statusEn: '✓ Success Case',
    imageUrl: 'https://image.pollinations.ai/prompt/social%20media%20content%20calendar%20and%20animated%20posts%20floating%20around%20a%20smartphone%2C%20isometric%203D%20vector%20illustration%2C%20vibrant%20marketing%20colors%2C%20clean%20professional%20design%2C%20studio%20lighting%2C%2016%3A9?width=1280&height=720&seed=103&nologo=true',
  },
];

const emptyForm = { name: '', email: '', phone: '', company: '', projectType: '', budgetRange: '', message: '' };

export default function Agency() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [portfolio, setPortfolio] = useState<AgencyPortfolioItem[]>(DEFAULT_PORTFOLIO);

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  // 🌐 ენის სთეითი სააგენტოს გვერდისთვისაც! — synced with router.locale so
  // globally-mounted shared components (AuthModal) pick up the switch too.
  const [lang, setLang] = useState<'GEO' | 'ENG'>(() => (router.locale === 'en' ? 'ENG' : 'GEO'));

  const handleLangToggle = () => {
    const next = lang === 'GEO' ? 'ENG' : 'GEO';
    setLang(next);
    router.push({ pathname: router.pathname, query: router.query }, router.asPath, {
      locale: next === 'ENG' ? 'en' : 'ka',
      shallow: true,
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = localStorage.getItem('darkMode') === 'true';
      setDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  useEffect(() => {
    getSiteContent<AgencyContent>('agency')
      .then((row) => {
        if (row?.content.portfolio && row.content.portfolio.length > 0) {
          setPortfolio(row.content.portfolio);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(false), 4000);
    return () => clearTimeout(timer);
  }, [showToast]);

  const toggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    localStorage.setItem('darkMode', String(nextDark));
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const safeText = (text: string) => {
    return <span className="font-sans inline-block font-bold tracking-normal">{text}</span>;
  };

  // 🌐 ჭკვიანი ავტომატური თარგმანის მექანიზმი
  const translate = (geo: React.ReactNode, eng: React.ReactNode) => {
    return lang === 'GEO' ? geo : eng;
  };

  const handleFormChange = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await submitStudioInquiry({
        name: form.name,
        email: form.email,
        phone: form.phone,
        company: form.company,
        projectType: form.projectType,
        budgetRange: form.budgetRange,
        message: form.message,
      });
      setForm(emptyForm);
      setShowToast(true);
    } catch (err: any) {
      const apiErrors = err?.response?.data?.errors;
      const apiMessage = err?.response?.data?.message;
      setFormError(
        Array.isArray(apiErrors)
          ? apiErrors.map((issue: any) => issue.message).join(' ')
          : apiMessage || translate('მოთხოვნის გაგზავნა ვერ მოხერხდა. სცადეთ თავიდან.', 'Unable to submit your request. Please try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = `w-full rounded-xl border px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
    darkMode ? 'bg-[#0e1422] border-slate-800 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
  }`;

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-300 relative overflow-hidden ${darkMode ? 'text-slate-200 bg-[#0b0f19]' : 'text-slate-800 bg-[#f1f5f9]'}`}>
      <Head>
        <title>CDC Studio | ციფრული სააგენტო</title>
      </Head>

      {/* 🧭 NAVIGATION */}
      <nav className={`sticky top-0 z-50 border-b px-6 md:px-12 py-5 ${darkMode ? 'border-slate-800 bg-[#0e1422]/90 backdrop-blur-md' : 'border-slate-200/60 bg-white/90 backdrop-blur-md'}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-cyan-500 to-purple-600 text-white px-4 py-2 rounded-xl font-black text-sm tracking-wider">{safeText('CDC')}</div>
            <div>
              <span className="font-bold text-lg block leading-none tracking-tight">{safeText('CDC Studio')}</span>
              <span className="text-[11px] text-slate-400 font-bold block mt-1">{translate('სოციალური მეწარმეობა & ციფრული სააგენტო', 'Social Entrepreneurship & Digital Agency')}</span>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-base font-bold tracking-wide">
            <Link href="/" className="hover:text-cyan-500 transition no-underline text-current">{translate('მთავარზე დაბრუნება', 'Return Home')}</Link>

            {/* 🌐 ენის გადამრთველი სააგენტოს გვერდზეც! */}
            <button
              type="button"
              onClick={handleLangToggle}
              title={lang === 'GEO' ? 'Switch to English' : 'ქართულ ენაზე გადართვა'}
              className={`font-sans font-black text-xs px-2.5 py-1.5 rounded-lg border transition duration-200 cursor-pointer ${
                darkMode ? 'border-slate-800 bg-slate-900/60 text-cyan-400' : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {lang === 'GEO' ? 'ENG' : 'GEO'}
            </button>

            <button type="button" onClick={toggleDarkMode} className="p-2 rounded-xl transition border-none bg-transparent cursor-pointer duration-200">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* 🏙️ HERO BANNER */}
      <div className={`border-b text-center py-20 backdrop-blur-md ${darkMode ? 'bg-[#0e1422]/40 border-slate-800' : 'bg-slate-100/40 border-slate-200'}`}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex justify-start mb-6">
            <BackButton fallbackHref="/" className={darkMode ? 'text-slate-400 hover:text-slate-100' : ''} />
          </div>
          <div className="flex justify-center mb-4">
            <span className="text-xs font-black uppercase tracking-widest px-4 py-2 bg-purple-500/10 text-purple-500 rounded-full border border-purple-500/20 flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5" />
              {translate('სოციალური მეწარმეობა & ციფრული სააგენტო', 'Social Entrepreneurship & Digital Agency')}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black mt-4 mb-6 tracking-wide text-slate-900 dark:text-white leading-tight">
            {translate('პროფესიონალური ციფრული სერვისები თქვენი ბიზნესისთვის', 'Professional Digital Services For Your Business')}
          </h1>

          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
            {translate(
              <>{safeText('CDC Studio')} აერთიანებს ნიჭიერ სტუდენტებსა და გამოცდილ მენტორებს. ჩვენ ვქმნით საიტებს, რეკლამას, კონტენტსა და ვიზუალებს ლოკალური და საერთაშორისო ბიზნესებისთვის.</>,
              <>{safeText('CDC Studio')} combines talented students and experienced mentors. We create websites, advertisement, content, and visuals for local and international businesses.</>
            )}
          </p>

          <div className="mt-8">
            <a
              href="#request-project"
              className="inline-block bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-8 py-3.5 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
            >
              {translate('შეუკვეთე პროექტი', 'Request a Project')}
            </a>
          </div>
        </div>
      </div>

      {/* 📊 PORTFOLIO PROJECTS FEED */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-xl md:text-2xl font-black mb-10 tracking-wide flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-500" />
          {translate('ჩვენი შესრულებული სამუშაოები', 'Our Portfolio')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {portfolio.map((p, i) => {
            return (
              <a
                key={i}
                href={p.externalLink || undefined}
                target={p.externalLink ? '_blank' : undefined}
                rel={p.externalLink ? 'noopener noreferrer' : undefined}
                className={`group border rounded-3xl overflow-hidden backdrop-blur-md no-underline text-current transition-all duration-300 transform hover:scale-[1.03] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] flex flex-col justify-between min-h-[300px] ${
                  darkMode ? 'bg-[#0e1422]/80 border-slate-800' : 'bg-white/90 border-slate-200'
                } ${p.externalLink ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="relative w-full aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveBlogImageUrl(p.imageUrl)}
                      alt=""
                      onError={onImageErrorFallback}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      style={{
                        objectPosition: OBJECT_POSITION[p.imagePosition ?? 'center'],
                        transform: `scale(${(p.imageZoom ?? 100) / 100})`,
                      }}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${darkMode ? 'bg-gradient-to-br from-[#0e1422] to-slate-900' : 'bg-gradient-to-br from-slate-100 to-slate-200'}`}>
                      <Briefcase className="w-8 h-8 text-cyan-500/40" />
                    </div>
                  )}
                  {p.externalLink && (
                    <span className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white transition-transform duration-300 group-hover:scale-110">
                      <ArrowUpRight className="w-4 h-4" />
                    </span>
                  )}
                </div>
                <div className="p-8">
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border ${
                    darkMode ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' : 'text-cyan-700 bg-cyan-50 border-cyan-100'
                  }`}>
                    {translate(p.badgeKa, p.badgeEn)}
                  </span>

                  <h3 className="text-lg font-black mt-5 mb-2 tracking-wide leading-snug flex items-center gap-1.5">
                    {translate(p.titleKa, p.titleEn)}
                    {p.externalLink && <ArrowUpRight className="w-4 h-4 text-cyan-500 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
                  </h3>

                  <h4 className="text-xs font-bold text-slate-400 mb-5 uppercase tracking-wide">
                    {translate(p.subtitleKa, p.subtitleEn)}
                  </h4>

                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-medium">
                    {translate(p.descKa, p.descEn)}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-500">
                    {translate(p.statusKa, p.statusEn)}
                  </span>
                  {p.externalLink && (
                    <span className="text-[11px] font-bold text-cyan-500 flex items-center gap-1">
                      {translate('ნახე პროექტი', 'View Project')}
                      <ArrowUpRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
                </div>
              </a>
            );
          })}
        </div>
      </main>

      {/* REQUEST A PROJECT */}
      <section id="request-project" className={`border-t py-20 ${darkMode ? 'border-slate-800 bg-[#0e1422]/40' : 'border-slate-200 bg-slate-100/40'}`}>
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-xl md:text-2xl font-black mb-3 tracking-wide flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-cyan-500" />
            {translate('შეუკვეთე პროექტი', 'Request a Project')}
          </h2>
          <p className="text-sm text-slate-400 mb-10 leading-relaxed">
            {translate(
              'შეავსეთ ფორმა და ჩვენი გუნდი 1-2 სამუშაო დღეში დაგიკავშირდებათ.',
              "Fill out the form and our team will get back to you within 1-2 business days."
            )}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-500 font-medium">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                required
                placeholder={translate('სახელი *', 'Name *') as string}
                value={form.name}
                onChange={handleFormChange('name')}
                className={inputClass}
              />
              <input
                required
                type="email"
                placeholder={translate('ელ-ფოსტა *', 'Email *') as string}
                value={form.email}
                onChange={handleFormChange('email')}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                required
                type="tel"
                placeholder={translate('ტელეფონის ნომერი *', 'Phone Number *') as string}
                value={form.phone}
                onChange={handleFormChange('phone')}
                className={inputClass}
              />
              <input
                required
                placeholder={translate('კომპანია *', 'Company *') as string}
                value={form.company}
                onChange={handleFormChange('company')}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                required
                placeholder={translate('პროექტის ტიპი (მაგ. ვებ-საიტი, SMM) *', 'Project type (e.g. Website, SMM) *') as string}
                value={form.projectType}
                onChange={handleFormChange('projectType')}
                className={inputClass}
              />
              <input
                required
                placeholder={translate('სავარაუდო ბიუჯეტი *', 'Estimated Budget *') as string}
                value={form.budgetRange}
                onChange={handleFormChange('budgetRange')}
                className={inputClass}
              />
            </div>

            <textarea
              required
              rows={5}
              placeholder={translate('მოგვიყევით პროექტზე... *', 'Tell us about your project... *') as string}
              value={form.message}
              onChange={handleFormChange('message')}
              className={inputClass}
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-8 py-3.5 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-60"
            >
              {submitting
                ? translate('იგზავნება...', 'Submitting...')
                : translate('მოთხოვნის გაგზავნა', 'Submit Request')}
            </button>
          </form>
        </div>
      </section>

      <SiteFooter />

      {showToast && (
        <Toast message={translate('მოთხოვნა წარმატებით გაიგზავნა!', 'Your request has been submitted!') as string} />
      )}
    </div>
  );
}
