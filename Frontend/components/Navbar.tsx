import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Navbar: React.FC = () => {
    const { t } = useTranslation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    // Close mobile menu on route change
    React.useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location]);

    return (
        <nav className="top-nav bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800 shadow-sm z-50">
            <div className="container mx-auto flex justify-between items-center p-4">
                <Link to="/" className="text-lg font-bold">
                    {t('digitalTools', 'ციფრული ხელსაწყოები')}
                </Link>
                <button
                    className="lg:hidden text-gray-600 dark:text-slate-400"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    aria-label="Toggle navigation menu"
                >
                    ☰
                </button>
                <div className={`lg:flex ${isMobileMenuOpen ? 'block' : 'hidden'} absolute lg:static top-16 left-0 w-full lg:w-auto bg-white dark:bg-slate-900`}>
                    <Link to="/more" className="block px-4 py-2 text-sm text-gray-600 dark:text-slate-400">
                        {t('more', 'მეტი')}
                    </Link>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
