import { Analytics } from "@vercel/analytics/react"
import '../styles.css'
import { AppProps } from "next/app"

export default function MyApp(props: AppProps) {
  const { Component, pageProps } = props
  return <>
    <Analytics></Analytics>
    <Component {...pageProps} />
  </>
}