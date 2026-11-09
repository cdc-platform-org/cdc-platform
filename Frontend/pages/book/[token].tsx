import { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { BookOpen, Loader2, Sparkles } from 'lucide-react';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import SEOHead from '../../src/components/seo/SEOHead';
import FlipBook from '../../src/components/tools/childrensBook/FlipBook';
import { SharedBook, getSharedBook, sharedBookAssetUrl } from '../../src/services/childrensBookService';

// Public "read & listen" page of a finished children's book, opened from
// the QR code on the PDF's back cover or a link the parent shared. No
// login; the token is the key and the parent can switch it off. Not indexed.

export default function SharedBookPage() {
  const { t } = useTranslation('childrensBook');
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : null;
  const [book, setBook] = useState<SharedBook | null>(null);
  const [missing, setMissing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getSharedBook(token)
      .then((data) => { if (!cancelled) setBook(data); })
      .catch(() => { if (!cancelled) setMissing(true); });
    return () => { cancelled = true; };
  }, [token]);

  function downloadMp3() {
    if (!token) return;
    setDownloading(true);
    // A plain link: the browser streams the file itself.
    const link = document.createElement('a');
    link.href = sharedBookAssetUrl(token, 'audio/full-story.mp3');
    link.download = `${book?.title ?? 'book'}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(false), 1500);
  }

  const createPath = `${router.locale && router.locale !== 'ka' ? `/${router.locale}` : ''}/dashboard/tools/childrens-book`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7f2fd] to-white">
      <SEOHead title={book ? book.title : t('sharedPageTitle')} description={t('sharedPageDescription')} noIndex />
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {missing ? (
          <div className="mx-auto max-w-md rounded-2xl border border-purple-100 bg-white p-8 text-center shadow-sm">
            <BookOpen className="mx-auto h-10 w-10 text-purple-400" />
            <p className="mt-4 text-gray-700">{t('sharedNotFound')}</p>
            <a href={createPath} className="mt-6 inline-flex items-center gap-2 rounded-full bg-purple-700 px-5 py-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4" />{t('flipCreateOwn')}</a>
          </div>
        ) : !book || !token ? (
          <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-purple-600" /></div>
        ) : (
          <FlipBook
            book={{
              title: book.title,
              heroName: book.heroName,
              dedication: book.dedication,
              blurb: book.blurb,
              fontId: book.fontId,
              coverUrl: sharedBookAssetUrl(token, 'cover'),
              portraitUrl: sharedBookAssetUrl(token, 'portrait'),
              pages: book.pages.map((page) => ({
                pageNumber: page.pageNumber,
                storyText: page.storyText,
                imageUrl: page.hasImage ? sharedBookAssetUrl(token, `page/${page.pageNumber}/image`) : null,
                audioUrl: page.hasAudio ? sharedBookAssetUrl(token, `audio/page/${page.pageNumber}`) : null,
              })),
            }}
            hasNarration={book.pages.some((page) => page.hasAudio)}
            onDownloadMp3={book.fullStoryAudio ? downloadMp3 : null}
            downloadingMp3={downloading}
            createUrl={createPath}
            footer={<p className="mt-8 text-center text-xs text-gray-400">{t('sharedPoweredBy')}</p>}
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common', 'childrensBook'])) },
});
