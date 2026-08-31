import React from 'react';
import { useTranslation } from 'next-i18next';

const SiteFooter = () => {
    const { t } = useTranslation('footer');

    return (
        <footer className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200/60 dark:border-slate-800 py-12">
            <div className="max-w-6xl mx-auto px-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mb-6">
                    <div>
                        <h3 className="font-bold mb-2">{t('about', 'ჩვენს შესახებ')}</h3>
                        <ul>
                            <li><a href="/about" className="text-slate-600 dark:text-slate-300 hover:underline">{t('aboutUs', 'ჩვენ შესახებ')}</a></li>
                            <li><a href="/contact" className="text-slate-600 dark:text-slate-300 hover:underline">{t('contact', 'კონტაქტი')}</a></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-bold mb-2">{t('services', 'მომსახურებები')}</h3>
                        <ul>
                            <li><a href="/services" className="text-slate-600 dark:text-slate-300 hover:underline">{t('ourServices', 'ჩვენი მომსახურებები')}</a></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-bold mb-2">{t('followUs', 'გვითვალთვალეთ')}</h3>
                        <ul className="flex space-x-4">
                            <li><a href="https://facebook.com" className="text-slate-600 dark:text-slate-300 hover:underline">Facebook</a></li>
                            <li><a href="https://twitter.com" className="text-slate-600 dark:text-slate-300 hover:underline">Twitter</a></li>
                            <li><a href="https://instagram.com" className="text-slate-600 dark:text-slate-300 hover:underline">Instagram</a></li>
                        </ul>
                    </div>
                </div>
                <div className="text-center text-slate-500 dark:text-slate-400">
                    <p>{t('copyright', '© 2023 ჩვენი კომპანია. ყველა უფლება დაცულია.')}</p>
                </div>
            </div>
        </footer>
    );
};

export default SiteFooter;
