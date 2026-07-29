import { GetServerSideProps } from 'next';

// Alias for the canonical /verify/[code] page (the URL actually embedded in
// every certificate's QR code, see Backend's certificateService.ts) — kept
// as a redirect rather than a duplicate implementation so there is only one
// place that renders verification results.
export const getServerSideProps: GetServerSideProps = async ({ params }) => ({
  redirect: { destination: `/verify/${params?.id}`, permanent: false },
});

export default function VerifyCertificateRedirect() {
  return null;
}
