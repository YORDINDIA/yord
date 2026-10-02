 'use client'

 import { usePathname, useSearchParams } from "next/navigation"
 import { useEffect, Suspense } from "react"
 import { usePostHog } from 'posthog-js/react'
import { classifyPage } from '@/lib/analytics/routeTemplate'
import { trackIfNew } from '@/lib/analytics/track'

 function PostHogPageViewInner() {
   const pathname = usePathname()
   const searchParams = useSearchParams()
   const posthog = usePostHog()

   useEffect(() => {
     if (pathname && posthog) {
       let url = window.origin + pathname
       if (searchParams.toString()) {
         url = url + `?${searchParams.toString()}`
       }

       posthog.capture('$pageview', { '$current_url': url })
     }
   }, [pathname, searchParams, posthog])

  // First-party pageview: query-stripped path classified into the template
  // buckets the admin's engagement rollups group on. Runs whether or not
  // PostHog is configured; `trackIfNew` keeps dev StrictMode remounts from
  // double-counting one navigation.
  useEffect(() => {
    if (!pathname) return
    const { template, handle } = classifyPage(pathname)
    trackIfNew(pathname, {
      type: 'page_viewed',
      template,
      ...(handle !== undefined ? { handle } : {}),
    })
  }, [pathname])

   return null
 }

 export default function PostHogPageView() {
   return (
     <Suspense fallback={null}>
       <PostHogPageViewInner />
     </Suspense>
   )
 }
