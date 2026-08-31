import React from 'react';
import { useTranslation } from 'next-i18next';

const LoginPage = () => {
    const { t } = useTranslation('login');

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
            <div className="max-w-md mx-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-xl p-8">
                <h1 className="text-2xl font-bold mb-6">{t('loginTitle', 'ავტორიზაცია')}</h1>
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1" htmlFor="email">{t('emailLabel', 'ელ-ფოსტა')}</label>
                    <input type="email" id="email" className="w-full p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder={t('emailPlaceholder', 'შეიყვანეთ ელ-ფოსტა')} />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1" htmlFor="password">{t('passwordLabel', 'პაროლი')}</label>
                    <input type="password" id="password" className="w-full p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder={t('passwordPlaceholder', 'შეიყვანეთ პაროლი')} />
                </div>
                <button className="w-full bg-cyan-600 text-white py-2 rounded-lg hover:bg-cyan-700 transition duration-200">
                    {t('submit', 'შესვლა')}
                </button>
            </div>
        </div>
    );
};

export default LoginPage;
