import * as Sentry from '@sentry/nextjs';
import type { NextPageContext } from 'next';
import NextErrorComponent from 'next/error';

// Next.js has no custom error page by default (falls back to its own
// built-in one), which meant errors that reach this boundary — a render
// crash Next itself catches, not one of our own try/catch blocks — were
// never reported anywhere. This file only adds Sentry capture; the actual
// rendered UI is still Next's own built-in error component, unchanged.
type ErrorProps = { statusCode: number };

export default function CustomError({ statusCode }: ErrorProps) {
  return <NextErrorComponent statusCode={statusCode} />;
}

CustomError.getInitialProps = async (ctx: NextPageContext) => {
  await Sentry.captureUnderscoreErrorException(ctx);
  return NextErrorComponent.getInitialProps(ctx);
};
