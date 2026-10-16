'use client';

import { useId, useState } from 'react';
import { Check, Mail, MapPin, Send } from 'lucide-react';
import { Field, SelectInput, TextInput } from '@/features/ui/Field';
import { Button } from '@/features/ui/Button';
import { FormBanner } from '@/features/ui/FormBanner';
import { SectionHeading } from '@/features/ui/SectionHeading';

// No phone number: the placeholder that used to live here (`+91 98765 43210`)
// was fake contact information, which Google's Misrepresentation policy
// explicitly flags. Email and the office address are the real channels — add
// a phone block back only with a number that is actually answered.
const CONTACT_DETAILS = [
  {
    icon: Mail,
    title: 'EMAIL US',
    lines: [
      { label: 'General Inquiries', value: 'info@yordindia.com', href: 'mailto:info@yordindia.com' },
      { label: 'Order Support', value: 'support@yordindia.com', href: 'mailto:support@yordindia.com' },
    ],
  },
] as const;

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `Field` owns the ids of the inputs it wraps; the message textarea is
  // hand-wired because `Field` has no `TextArea` yet (reported upstream).
  const messageId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send message. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      setIsSubmitted(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch {
      setError('Failed to send message. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero Section */}
      <section className="pt-32 pb-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            align="center"
            eyebrow="GET IN TOUCH"
            title="Contact Us"
            description="Have a question about your order or need help finding the perfect merchandise? We're here to help."
            className="items-center"
          />
        </div>
      </section>

      {/* Contact Content */}
      <section className="pb-24">
        <div className="container-page">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Contact Info */}
            <div className="space-y-8">
              {CONTACT_DETAILS.map((detail) => {
                const Icon = detail.icon;
                return (
                  <div key={detail.title} className="bg-surface-card border border-border-default p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-accent-tint rounded-full flex items-center justify-center flex-shrink-0">
                        <Icon aria-hidden="true" className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-accent text-lg tracking-wider text-text-secondary mb-2">
                          {detail.title}
                        </h3>
                        {detail.lines.map((line) => (
                          <div key={line.href} className="mb-3 last:mb-0">
                            <p className="font-body text-sm text-text-muted mb-1">{line.label}</p>
                            <a
                              href={line.href}
                              className="font-body text-accent hover:text-accent-hover transition-colors"
                            >
                              {line.value}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="bg-surface-card border border-border-default p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-accent-tint rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin aria-hidden="true" className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-accent text-lg tracking-wider text-text-secondary mb-2">
                      OFFICE
                    </h3>
                    <p className="font-body text-sm text-text-muted">
                      YORD India
                      <br />
                      Gurgaon - 122001
                      <br />
                      Haryana, India
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-surface-card border border-border-default p-8">
                <h2 className="font-accent text-xl tracking-wider text-text-secondary mb-6">
                  SEND US A MESSAGE
                </h2>

                {isSubmitted ? (
                  // `role="status"` so the confirmation is announced when it
                  // replaces the form, not only seen.
                  <div role="status" className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-6 bg-success/10 rounded-full flex items-center justify-center">
                      <Check aria-hidden="true" className="w-8 h-8 text-success" />
                    </div>
                    <h3 className="font-display text-2xl text-text-secondary mb-2">Message Sent!</h3>
                    <p className="font-body text-text-muted mb-6">
                      Thank you for reaching out. We&apos;ll get back to you within 24 hours.
                    </p>
                    <Button variant="ghost" onClick={() => setIsSubmitted(false)}>
                      Send another message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {error ? <FormBanner tone="danger">{error}</FormBanner> : null}

                    <div className="grid md:grid-cols-2 gap-6">
                      <Field label="Your Name" name="contact-name" required>
                        <TextInput
                          name="name"
                          autoComplete="name"
                          required
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Enter your name"
                        />
                      </Field>
                      <Field label="Email Address" name="contact-email" required>
                        <TextInput
                          type="email"
                          inputMode="email"
                          name="email"
                          autoComplete="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="Enter your email"
                        />
                      </Field>
                    </div>

                    <Field label="Subject" name="contact-subject" required>
                      <SelectInput
                        name="subject"
                        required
                        value={formData.subject}
                        onChange={handleChange}
                      >
                        <option value="">Select a subject</option>
                        <option value="order">Order Inquiry</option>
                        <option value="shipping">Shipping Question</option>
                        <option value="return">Return/Exchange</option>
                        <option value="product">Product Information</option>
                        <option value="wholesale">Wholesale Inquiry</option>
                        <option value="other">Other</option>
                      </SelectInput>
                    </Field>

                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor={messageId}
                        className="font-body text-xs uppercase tracking-wider text-text-muted"
                      >
                        Message
                        <span aria-hidden="true" className="text-danger">
                          {' *'}
                        </span>
                      </label>
                      <textarea
                        id={messageId}
                        name="message"
                        required
                        aria-required="true"
                        rows={6}
                        value={formData.message}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-surface-card border border-border-strong text-text-secondary placeholder:text-text-muted font-body text-sm transition-colors focus:border-accent resize-none"
                        placeholder="How can we help you?"
                      />
                    </div>

                    <Button type="submit" isLoading={isSubmitting} className="w-full md:w-auto gap-2">
                      <Send size={18} aria-hidden="true" />
                      {isSubmitting ? 'SENDING...' : 'SEND MESSAGE'}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
