import { Html, Head, Main, NextScript } from 'next/document';
import { APP_FAVICON_HREF } from '@/components/Brand/AppLogo';

export default function Document() {
  return (
    <Html lang="vi">
      <Head>
        <link rel="icon" href={APP_FAVICON_HREF} type="image/svg+xml" />
        <link rel="alternate icon" href={APP_FAVICON_HREF} type="image/svg+xml" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
