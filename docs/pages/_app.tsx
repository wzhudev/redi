import type { AppProps } from 'next/app'
import { Analytics } from '@vercel/analytics/react'
import '../styles.css'

export default function MyApp(props: AppProps) {
  const { Component, pageProps } = props
  return (
    <>
      <Analytics></Analytics>
      <Component {...pageProps} />
    </>
  )
}
