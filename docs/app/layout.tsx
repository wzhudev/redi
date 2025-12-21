import { GoogleAnalytics } from '@next/third-parties/google';
import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';
import '../styles.css';

export const metadata = {
  title: {
    default: 'Redi',
    template: '%s – Redi',
  },
  description:
    'A light-weight dependency injection library for TypeScript and JavaScript',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text y="32" font-size="32">💉</text></svg>',
  },
  openGraph: {
    title: 'Redi',
    description: 'A light-weight dependency injection library',
  },
};

const logo = <span style={{ fontWeight: 800 }}>Redi</span>;

const navbar = (
  <Navbar logo={logo} projectLink="https://github.com/wzhudev/redi" />
);

const currentYear = new Date().getFullYear();

const footer = (
  <Footer>
    {`MIT ${currentYear} © `}
    <a href="https://wzhu.dev" target="_blank" rel="noreferrer">
      wzhudev
    </a>
    .
  </Footer>
);

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/wzhudev/redi/tree/main/docs"
          footer={footer}
          toc={{ backToTop: true }}
        >
          {children}
        </Layout>
        <GoogleAnalytics gaId="G-6NKSQS3F6L" />
      </body>
    </html>
  );
}
