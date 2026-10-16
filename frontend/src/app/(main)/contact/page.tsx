import { ContactForm } from '@/features/support/ContactForm';

export const metadata = {
  title: 'Contact Us',
  description:
    'Questions about an order or the merchandise? Contact the YORD India support team by email.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return <ContactForm />;
}
