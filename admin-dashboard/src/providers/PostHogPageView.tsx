 'use client'

 import { usePathname } from "next/navigation"
 import { useEffect, Suspense } from "react"
 import { usePostHog } from 'posthog-js/react'

 function PostHogPageViewInner() {
   const pathname = usePathname()
   const posthog = usePostHog()

   useEffect(() => {
     if (pathname && posthog) {
       const url = window.origin + pathname

       posthog.capture('$pageview', { '$current_url': url })
     }
   }, [pathname, posthog])

   return null
 }

 export default function PostHogPageView() {
   return (
     <Suspense fallback={null}>
       <PostHogPageViewInner />
     </Suspense>
   )
 }
