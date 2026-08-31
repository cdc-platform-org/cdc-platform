import React from 'react';
import { useTranslation } from 'react-i18next';

const Dashboard: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">{t('dashboardTitle', 'დაშბორდი')}</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="tool-card bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-xl hover:-translate-y-1 transition-all duration-300 p-4">
                    <h2 className="font-semibold">{t('tool1Title', 'Tool 1')}</h2>
                    <p>{t('tool1Description', 'Description for Tool 1')}</p>
                    <a href="/tool1" className="text-blue-500 hover:underline">{t('learnMore', 'მეტი ინფორმაცია')}</a>
                </div>
                <div className="tool-card bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-xl hover:-translate-y-1 transition-all duration-300 p-4">
                    <h2 className="font-semibold">{t('tool2Title', 'Tool 2')}</h2>
                    <p>{t('tool2Description', 'Description for Tool 2')}</p>
                    <a href="/tool2" className="text-blue-500 hover:underline">{t('learnMore', 'მეტი ინფორმაცია')}</a>
                </div>
                <div className="tool-card bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-xl hover:-translate-y-1 transition-all duration-300 p-4">
                    <h2 className="font-semibold">{t('tool3Title', 'Tool 3')}</h2>
                    <p>{t('tool3Description', 'Description for Tool 3')}</p>
                    <a href="/tool3" className="text-blue-500 hover:underline">{t('learnMore', 'მეტი ინფორმაცია')}</a>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
