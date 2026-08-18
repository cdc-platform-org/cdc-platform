import { useRouter } from 'next/router';
import Head from 'next/head';
import { ShieldAlert, KeyRound, Activity, EyeOff, Lock, Mail } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import RoleGate from '../../src/components/auth/RoleGate';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';

const dict = {
  ka: {
    title: 'კიბერუსაფრთხოება',
    subtitle: 'AG-SAIA — სუვერენული AI უსაფრთხოების კვანძის მართვა.',
    fallback: 'კიბერუსაფრთხოების გვერდი ხელმისაწვდომია მხოლოდ ბიზნეს ანგარიშებისა და ადმინისტრატორებისთვის.',
    comingSoonTitle: 'AG-SAIA მალე გაეშვება',
    comingSoonBody:
      'ეს არის მომავალი პროდუქტის წინასწარი გადახედვა — ქვემოთ მოცემული პანელები ჯერ არ არის აქტიური და ჯერ არ აჩვენებს რეალურ მონაცემებს. AG-SAIA-ს გაშვების შემდეგ, აქ გამოჩნდება რეალურ დროში თქვენი ინფრასტრუქტურის უსაფრთხოების სტატუსი.',
    contact: 'დაგვიკავშირდით განახლებებისთვის',
    threatLevel: 'რეალურ დროში საფრთხის დონე',
    zkpHandshake: 'ZKP Handshake სტატუსი',
    honeypotLogs: 'თაფლის ქოთნის (Honeypot) ჟურნალი',
    availableAtLaunch: 'ხელმისაწვდომი იქნება გაშვების შემდეგ',
    previewBadge: 'გადახედვა',
  },
  en: {
    title: 'Cyber Security',
    subtitle: 'AG-SAIA — Sovereign AI security node management.',
    fallback: 'The Cyber Security page is available only to Business accounts and administrators.',
    comingSoonTitle: 'AG-SAIA launches soon',
    comingSoonBody:
      "This is a preview of an upcoming product — the panels below aren't active yet and show no live data. Once AG-SAIA launches, this is where you'll see your infrastructure's real-time security status.",
    contact: 'Contact us for updates',
    threatLevel: 'Real-Time Threat Level',
    zkpHandshake: 'ZKP Handshake Status',
    honeypotLogs: 'Honeypot Logs',
    availableAtLaunch: 'Available after launch',
    previewBadge: 'Preview',
  },
};

function PreviewPanel({ icon: Icon, title, note }: { icon: typeof ShieldAlert; title: string; note: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-6 flex flex-col items-center text-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Icon className="w-6 h-6 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-sm font-black tracking-wide">{title}</h3>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
        <Lock className="w-3 h-3" />
        {note}
      </span>
    </div>
  );
}

function CyberSecurityContent() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>

      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/dashboard/client" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-black flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            {t.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        <RoleGate
          allowedRoles={['Client', 'SuperAdmin']}
          fallback={<p className="text-sm text-slate-500 dark:text-slate-400">{t.fallback}</p>}
        >
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-6 mb-6">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
                <Lock className="w-3 h-3" />
                {t.previewBadge}
              </span>
              <div>
                <h2 className="text-sm font-black tracking-wide mb-1">{t.comingSoonTitle}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t.comingSoonBody}</p>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <PreviewPanel icon={Activity} title={t.threatLevel} note={t.availableAtLaunch} />
            <PreviewPanel icon={KeyRound} title={t.zkpHandshake} note={t.availableAtLaunch} />
            <PreviewPanel icon={EyeOff} title={t.honeypotLogs} note={t.availableAtLaunch} />
          </div>

          <a
            href="mailto:contact@cdc.org.ge"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            <Mail className="w-4 h-4" />
            {t.contact}
          </a>
        </RoleGate>
      </div>

      <SiteFooter />
    </div>
  );
}

export default function CyberSecurityPage() {
  return (
    <ProtectedRoute>
      <CyberSecurityContent />
    </ProtectedRoute>
  );
}
