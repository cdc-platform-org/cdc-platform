import { Mail, Phone, MapPin, Building2 } from 'lucide-react';
import SimpleSiteLayout from '@/src/components/layout/SimpleSiteLayout';
import { merchantInfo } from '@/src/data/merchantInfo';

const heading = { ka: 'კონტაქტი', en: 'Contact Us' };
const intro = {
  ka: 'გაქვთ შეკითხვა კურსების, გადახდის ან პლატფორმის შესახებ? დაგვიკავშირდით ნებისმიერი ხერხით ქვემოთ.',
  en: 'Have a question about courses, payments, or the platform? Reach us any of the ways below.',
};
const labels = {
  ka: { email: 'ელ-ფოსტა', phone: 'ტელეფონი', address: 'მისამართი', org: 'იურიდიული პირი', idCode: 'ს/კ' },
  en: { email: 'Email', phone: 'Phone', address: 'Address', org: 'Legal Entity', idCode: 'ID Code' },
};

export default function ContactPage() {
  return (
    <SimpleSiteLayout titleKa={heading.ka} titleEn={heading.en}>
      {(lang) => {
        const l = lang === 'GEO' ? 'ka' : 'en';
        const t = labels[l];
        return (
          <>
            <h1 className="text-3xl font-black mb-2">{heading[l]}</h1>
            <p className="text-sm text-slate-400 mb-10 leading-relaxed">{intro[l]}</p>

            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">{t.email}</p>
                  <a href={`mailto:${merchantInfo.email}`} className="text-sm text-slate-200 hover:text-cyan-400 no-underline">
                    {merchantInfo.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">{t.phone}</p>
                  <a href={`tel:${merchantInfo.phone.replace(/\s+/g, '')}`} className="text-sm text-slate-200 hover:text-cyan-400 no-underline">
                    {merchantInfo.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">{t.address}</p>
                  <p className="text-sm text-slate-200">{l === 'ka' ? merchantInfo.addressKa : merchantInfo.addressEn}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-4 border-t border-slate-800">
                <Building2 className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">{t.org}</p>
                  <p className="text-sm text-slate-300">{l === 'ka' ? merchantInfo.orgNameKa : merchantInfo.orgNameEn}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {t.idCode}: {merchantInfo.identificationCode}
                  </p>
                </div>
              </div>
            </div>
          </>
        );
      }}
    </SimpleSiteLayout>
  );
}
