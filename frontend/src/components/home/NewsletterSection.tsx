'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Mail, CheckCircle, Loader2, Sparkles } from 'lucide-react';

// Success particle component for burst animation
function SuccessParticles({ show }: { show: boolean }) {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360;
    const distance = 80 + Math.random() * 40;
    return {
      id: i,
      angle,
      distance,
      size: 4 + Math.random() * 4,
      delay: Math.random() * 0.2,
    };
  });

  return (
    <AnimatePresence>
      {show && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-2 h-2 rounded-full bg-gold-200"
              style={{ width: particle.size, height: particle.size }}
              initial={{
                x: 0,
                y: 0,
                scale: 1,
                opacity: 1
              }}
              animate={{
                x: Math.cos((particle.angle * Math.PI) / 180) * particle.distance,
                y: Math.sin((particle.angle * Math.PI) / 180) * particle.distance,
                scale: 0,
                opacity: 0,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 1.2,
                delay: particle.delay,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

// Animated sparkle icon with rotation and pulse
function AnimatedSparkle({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      animate={{
        rotate: [0, 15, -15, 0],
        scale: [1, 1.2, 1, 1.1, 1],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        delay,
        ease: 'easeInOut',
      }}
    >
      <Sparkles size={14} className="text-gold-200" />
    </motion.div>
  );
}

export function NewsletterSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showParticles, setShowParticles] = useState(false);

  // Trigger particles on success
  useEffect(() => {
    if (status === 'success') {
      setShowParticles(true);
      const timer = setTimeout(() => setShowParticles(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setStatus('error');
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setStatus('loading');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Failed to subscribe. Please try again.');
        return;
      }

      setStatus('success');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setErrorMessage('Failed to subscribe. Please try again.');
    }
  };

  return (
    <section ref={containerRef} className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-noir-950 via-noir-900 to-noir-950" />

      {/* Decorative Elements */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gold-200/5 blur-[150px] animate-liquid-morph"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.05, 0.08, 0.05],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative max-w-[1440px] mx-auto px-6 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="max-w-2xl mx-auto text-center"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2, type: 'spring' }}
            className="inline-flex items-center justify-center w-16 h-16 mb-8 border border-gold-200/30 bg-noir-900/50"
            whileHover={{
              boxShadow: '0 0 30px rgba(255, 217, 102, 0.3), 0 0 60px rgba(255, 217, 102, 0.15)',
              borderColor: 'rgba(255, 217, 102, 0.5)',
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Mail size={24} className="text-gold-200" />
            </motion.div>
          </motion.div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <AnimatedSparkle delay={0} />
              <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] text-gold-200">
                JOIN THE INNER CIRCLE
              </p>
              <AnimatedSparkle delay={1.5} />
            </div>
            <h2 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl text-ivory-50 mb-4">
              Be First in Line
            </h2>
            <p className="font-[family-name:var(--font-cormorant)] text-xl text-ivory-200 mb-8">
              Get exclusive early access to new drops, limited editions, and VIP-only offers.
              Plus, enjoy 10% off your first order.
            </p>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            onSubmit={handleSubmit}
            className="relative"
          >
            {status === 'success' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative flex items-center justify-center gap-3 py-4 px-6 bg-emerald-500/10 border border-emerald-500/30 overflow-visible"
              >
                <SuccessParticles show={showParticles} />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 400 }}
                >
                  <CheckCircle size={20} className="text-emerald-500" />
                </motion.div>
                <span className="font-[family-name:var(--font-jakarta)] text-emerald-400">
                  Welcome to the inner circle! Check your inbox for your 10% discount code.
                </span>
              </motion.div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    {/* Input glow layers */}
                    <motion.div
                      className="absolute -inset-[2px] bg-gradient-to-r from-gold-200/50 via-gold-300/50 to-gold-200/50 blur-sm pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isFocused ? 1 : 0 }}
                      transition={{ duration: 0.3 }}
                    />
                    <motion.div
                      className="absolute -inset-[1px] bg-gradient-to-r from-gold-200 via-gold-300 to-gold-200 pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isFocused ? 0.6 : 0 }}
                      transition={{ duration: 0.3 }}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (status === 'error') setStatus('idle');
                      }}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      placeholder="Enter your email address"
                      className="relative w-full bg-noir-900 border border-noir-700 text-ivory-50 px-6 py-4 text-base placeholder:text-ivory-400 focus:border-gold-200 focus:outline-none transition-all duration-300"
                      style={{
                        boxShadow: isFocused
                          ? '0 0 20px rgba(255, 217, 102, 0.2), 0 0 40px rgba(255, 217, 102, 0.1)'
                          : 'none',
                      }}
                      disabled={status === 'loading'}
                    />
                    {status === 'error' && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute left-0 -bottom-6 text-sm text-red-400"
                      >
                        {errorMessage}
                      </motion.p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="inline-flex items-center justify-center gap-2 bg-gold-200 text-noir-950 px-8 py-4 font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] hover:bg-gold-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'loading' ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        SUBSCRIBING...
                      </>
                    ) : (
                      'SUBSCRIBE'
                    )}
                  </button>
                </div>
              </>
            )}
          </motion.form>

          {/* Privacy Note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-6 font-[family-name:var(--font-jakarta)] text-xs text-ivory-400"
          >
            By subscribing, you agree to our Privacy Policy. No spam, ever. Unsubscribe anytime.
          </motion.p>

          {/* Benefits */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-ivory-400"
          >
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-gold-200" />
              <span>Early Access</span>
            </div>
            <div className="w-px h-4 bg-noir-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-gold-200" />
              <span>Exclusive Offers</span>
            </div>
            <div className="w-px h-4 bg-noir-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-gold-200" />
              <span>10% Off First Order</span>
            </div>
            <div className="w-px h-4 bg-noir-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-gold-200" />
              <span>No Spam</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
