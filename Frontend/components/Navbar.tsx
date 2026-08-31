import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Navbar: React.FC = () => {
    const { t } = useTranslation();

    return (
        <nav className="top-nav bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800 shadow-sm">
            <div className="container mx-auto flex justify-between items-center p-4">
                <Link to="/" className="text-lg font-bold">
                    {t('digitalTools', 'ციფრული ხელსაწყოები')}
                </Link>
                <div>
                    <Link to="/more" className="text-sm text-gray-600 dark:text-slate-400">
                        {t('more', 'მეტი')}
                    </Link>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
