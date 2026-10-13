import { Cookie } from 'lucide-react';
import { PolicyPage, type PolicySection } from '../_policy/PolicyPage';

export const metadata = {
  title: 'Cookie Policy',
  description: 'Learn about how we use cookies on the YORD India website.',
  alternates: { canonical: '/cookies' },
};

const SECTIONS: PolicySection[] = [
  {
    heading: 'What Are Cookies?',
    blocks: [
      {
        kind: 'p',
        text: (
          <>
            Cookies are small text files that are stored on your device when you visit a website.
            They help the website remember your preferences and improve your browsing experience.
            Cookies can be &quot;session&quot; cookies (deleted when you close your browser) or
            &quot;persistent&quot; cookies (remain on your device for a set period or until you
            delete them).
          </>
        ),
      },
    ],
  },
  {
    heading: 'Types of Cookies We Use',
    blocks: [
      {
        kind: 'subsections',
        items: [
          {
            heading: 'ESSENTIAL COOKIES',
            text: 'These cookies are necessary for the website to function properly. They enable core features like shopping cart functionality, account authentication, and checkout. Without these cookies, certain services cannot be provided.',
          },
          {
            heading: 'ANALYTICS COOKIES',
            text: 'These cookies help us understand how visitors interact with our website. We use Google Analytics and PostHog for this: they record pages viewed, referral source, device type, approximate location, and — for PostHog — session replays of how pages are used. This helps us improve our website and services.',
          },
          {
            heading: 'FUNCTIONAL COOKIES',
            text: 'These cookies allow the website to remember choices you make (such as your preferred language or region) and provide enhanced, personalized features.',
          },
          {
            heading: 'MARKETING COOKIES',
            text: 'These cookies are used to track visitors across websites. The intention is to display ads that are relevant and engaging for individual users. You can opt out of these cookies.',
          },
        ],
      },
    ],
  },
  {
    heading: 'Managing Cookies',
    blocks: [
      {
        kind: 'p',
        text: 'Most web browsers allow you to control cookies through their settings. You can:',
      },
      {
        kind: 'list',
        items: [
          'View what cookies are stored on your device',
          'Delete all or specific cookies',
          'Block cookies from specific or all websites',
          'Set preferences for different types of cookies',
        ],
      },
      {
        kind: 'p',
        text: 'Please note that blocking or deleting cookies may impact your browsing experience and some features of our website may not function properly.',
      },
    ],
  },
  {
    heading: 'Third-Party Cookies',
    blocks: [
      {
        kind: 'p',
        text: 'Some cookies on our website are placed by third-party services, including payment processors (Razorpay), analytics services, and social media platforms. These third parties have their own privacy and cookie policies.',
      },
    ],
  },
  {
    heading: 'Contact Us',
    blocks: [
      {
        kind: 'p',
        text: (
          <>
            If you have any questions about our use of cookies, please contact us at{' '}
            <a href="mailto:privacy@yordindia.com" className="text-accent hover:underline">
              privacy@yordindia.com
            </a>
          </>
        ),
      },
    ],
  },
];

export default function CookiesPage() {
  return (
    <PolicyPage
      icon={Cookie}
      title="Cookie Policy"
      description="This policy explains how we use cookies and similar technologies."
      updated="January 1, 2025"
      sections={SECTIONS}
    />
  );
}
