 'use client'

 import posthog from 'posthog-js'
 import { PostHogProvider } from 'posthog-js/react'

 if (typeof window !== 'undefined') {
   const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
   const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

   if (key && host) {
     posthog.init(key, {
       api_host: host,
       person_profiles: 'identified_only',
       capture_pageview: false
     })
   }
 }

 export function PHProvider({
   children,
 }: {
   children: React.ReactNode
 }) {
   return <PostHogProvider client={posthog}>{children}</PostHogProvider>
 }
