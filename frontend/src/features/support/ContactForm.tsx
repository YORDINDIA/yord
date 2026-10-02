"use client";

import { useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Send,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send message. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      setIsSubmitted(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch {
      setError("Failed to send message. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto text-center">
          <p className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-accent mb-4">
            GET IN TOUCH
          </p>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-text-primary mb-6">
            Contact Us
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-text-muted max-w-2xl mx-auto">
            Have a question about your order or need help finding the perfect
            merchandise? We&apos;re here to help.
          </p>
        </div>
      </section>

      {/* Contact Content */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Contact Info */}
            <div className="space-y-8">
              <div className="bg-surface-card border border-border-default p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-accent-tint rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-text-secondary mb-2">
                      EMAIL US
                    </h3>
                    <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted mb-1">
                      General Inquiries
                    </p>
                    <a
                      href="mailto:info@yordindia.com"
                      className="font-[family-name:var(--font-jakarta)] text-accent hover:text-accent-hover transition-colors"
                    >
                      info@yordindia.com
                    </a>
                    <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted mt-3 mb-1">
                      Order Support
                    </p>
                    <a
                      href="mailto:support@yordindia.com"
                      className="font-[family-name:var(--font-jakarta)] text-accent hover:text-accent-hover transition-colors"
                    >
                      support@yordindia.com
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-surface-card border border-border-default p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-accent-tint rounded-full flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-text-secondary mb-2">
                      CALL US
                    </h3>
                    <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted mb-1">
                      Mon - Sat, 10am - 7pm IST
                    </p>
                    <a
                      href="tel:+919876543210"
                      className="font-[family-name:var(--font-jakarta)] text-accent hover:text-accent-hover transition-colors"
                    >
                      +91 98765 43210
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-surface-card border border-border-default p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-accent-tint rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-text-secondary mb-2">
                      OFFICE
                    </h3>
                    <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
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
                <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-text-secondary mb-6">
                  SEND US A MESSAGE
                </h2>

                {isSubmitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-6 bg-green-500/10 rounded-full flex items-center justify-center">
                      <Check className="w-8 h-8 text-green-400" />
                    </div>
                    <h3 className="font-[family-name:var(--font-playfair)] text-2xl text-text-secondary mb-2">
                      Message Sent!
                    </h3>
                    <p className="font-[family-name:var(--font-jakarta)] text-text-muted mb-6">
                      Thank you for reaching out. We&apos;ll get back to you
                      within 24 hours.
                    </p>
                    <button
                      onClick={() => setIsSubmitted(false)}
                      className="text-accent font-[family-name:var(--font-jakarta)] text-sm hover:text-accent-hover transition-colors"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                      <div className="p-4 bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="font-[family-name:var(--font-jakarta)] text-sm text-red-300">
                          {error}
                        </p>
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-text-muted mb-2">
                          Your Name *
                        </label>
                        <input
                          type="text"
                          name="name"
                          required
                          value={formData.name}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-surface-raised border border-border-default text-text-secondary font-[family-name:var(--font-jakarta)] text-sm placeholder:text-text-muted focus:border-accent transition-colors"
                          placeholder="Enter your name"
                        />
                      </div>
                      <div>
                        <label className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-text-muted mb-2">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-surface-raised border border-border-default text-text-secondary font-[family-name:var(--font-jakarta)] text-sm placeholder:text-text-muted focus:border-accent transition-colors"
                          placeholder="Enter your email"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-text-muted mb-2">
                        Subject *
                      </label>
                      <select
                        name="subject"
                        required
                        value={formData.subject}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-surface-raised border border-border-default text-text-secondary font-[family-name:var(--font-jakarta)] text-sm focus:border-accent transition-colors"
                      >
                        <option value="">Select a subject</option>
                        <option value="order">Order Inquiry</option>
                        <option value="shipping">Shipping Question</option>
                        <option value="return">Return/Exchange</option>
                        <option value="product">Product Information</option>
                        <option value="wholesale">Wholesale Inquiry</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-text-muted mb-2">
                        Message *
                      </label>
                      <textarea
                        name="message"
                        required
                        rows={6}
                        value={formData.message}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-surface-raised border border-border-default text-text-secondary font-[family-name:var(--font-jakarta)] text-sm placeholder:text-text-muted focus:border-accent transition-colors resize-none"
                        placeholder="How can we help you?"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 bg-accent text-text-on-accent font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-accent-hover transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          SENDING...
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          SEND MESSAGE
                        </>
                      )}
                    </button>
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
