import type { AppProps } from 'next/app';
import { GoogleAnalytics } from '@next/third-parties/google';
import '../styles.css';

export default function MyApp(props: AppProps) {
  const { Component, pageProps } = props;
  return (
    <>
      <Component {...pageProps} />
      <GoogleAnalytics gaId="G-6NKSQS3F6L" />
    </>
  );
}
