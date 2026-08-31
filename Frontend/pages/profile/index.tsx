import React from 'react';
import { useTranslation } from 'next-i18next';

const ProfilePage = () => {
    const { t } = useTranslation('profile');

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-xl p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6">{t('profile', 'პროფილი')}</h1>
                <div className="flex items-center mb-4">
                    <img src="/path/to/avatar.jpg" alt="User Avatar" className="w-16 h-16 rounded-full mr-4" />
                    <div>
                        <h2 className="text-lg font-semibold">{t('username', 'მომხმარებლის სახელი')}</h2>
                    </div>
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1" htmlFor="email">{t('email', 'ელ. ფოსტა')}</label>
                    <input type="email" id="email" className="w-full p-2 rounded-lg border border-slate-300" placeholder={t('emailPlaceholder', 'შეიყვანეთ ელ. ფოსტა')} />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1" htmlFor="password">{t('password', 'პაროლი')}</label>
                    <input type="password" id="password" className="w-full p-2 rounded-lg border border-slate-300" placeholder={t('passwordPlaceholder', 'შეიყვანეთ პაროლი')} />
                </div>
                <button className="w-full bg-cyan-600 text-white py-2 rounded-lg hover:bg-cyan-700 transition duration-200">
                    {t('save', 'შენახვა')}
                </button>
            </div>
        </div>
    );
};

export default ProfilePage;
