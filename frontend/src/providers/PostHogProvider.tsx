 'use client'

 import posthog from 'posthog-js'
 import { PostHogProvider } from 'posthog-js/react'

 if (typeof window !== 'undefined') {
   const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
   const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

   if (key && host) {
     posthog.init(key, {
       api_host: host,
       person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
       capture_pageview: false // Disable automatic pageview capture, as we capture manually below
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
