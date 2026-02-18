import { JsonLd, faqSchema, breadcrumbSchema } from '@/lib/seo/jsonld';
import { FAQPageClient } from './FAQClient';
import type { FAQCategory } from './FAQClient';

export const metadata = {
  title: 'FAQ — Concert Merchandise Questions Answered',
  description:
    'Frequently asked questions about YORD India concert merchandise. Learn about shipping across India, returns, sizing, payment via Razorpay, and how to buy merchandise for Coldplay, Diljit Dosanjh, Karan Aujla, Ed Sheeran & more.',
  alternates: { canonical: '/faq' },
};

const FAQ_DATA: FAQCategory[] = [
  {
    title: 'Concert Merchandise',
    items: [
      {
        question: 'Where can I buy concert merchandise in India?',
        answer: 'YORD India is India\'s leading online store for premium concert merchandise. We offer fan-made, artist-inspired designs for 50+ artists including Coldplay, Diljit Dosanjh, Karan Aujla, Ed Sheeran, Taylor Swift, Linkin Park, AP Dhillon, and many more. Shop online at yordindia.com with pan-India delivery.',
      },
      {
        question: 'Which artist merchandise do you carry?',
        answer: 'We carry merchandise for 65+ artists performing in India, including global acts like Coldplay, Kanye West, Calvin Harris, DJ Snake, Linkin Park, Tiësto, Def Leppard, Dream Theater, The Lumineers, Ed Sheeran, Dua Lipa, Imagine Dragons, Maroon 5, Green Day, Bryan Adams, John Mayer, and Indian artists like Diljit Dosanjh, Karan Aujla, Arijit Singh, AP Dhillon, Yo Yo Honey Singh, DIVINE, Seedhe Maut, King, Prateek Kuhad, and many more.',
      },
      {
        question: 'Is your merchandise officially licensed?',
        answer: 'YORD India sells fan-made, artist-inspired designs crafted by passionate fans for fans. Our products celebrate the artists you love with premium quality materials and unique creative designs. Each piece is made with care and attention to detail.',
      },
      {
        question: 'Do you sell merchandise for upcoming concerts in India?',
        answer: 'Yes! We stock merchandise ahead of major concerts and tours in India. Whether it\'s Kanye West\'s India debut in Delhi, Calvin Harris\'s first India shows, Karan Aujla\'s P-Pop Culture World Tour, Def Leppard\'s India Tour, or festivals like Lollapalooza India and Sunburn, we have you covered with exclusive designs.',
      },
      {
        question: 'What is the best website to buy concert merch in India?',
        answer: 'YORD India (yordindia.com) is India\'s premier destination for premium concert merchandise. We offer exclusive fan-made designs, premium quality materials, competitive pricing in INR, and reliable pan-India shipping with free delivery on orders above ₹1,999.',
      },
    ],
  },
  {
    title: 'Orders & Shipping',
    items: [
      {
        question: 'How long does shipping take?',
        answer: 'Standard shipping within India takes 5-7 business days. Metro cities typically receive orders within 3-5 business days. We offer express shipping options at checkout for faster delivery.',
      },
      {
        question: 'Do you ship internationally?',
        answer: 'Currently, we only ship within India. We are working on expanding to international shipping soon. Subscribe to our newsletter to be notified when we launch international delivery.',
      },
      {
        question: 'How can I track my order?',
        answer: 'Once your order ships, you\'ll receive an email with tracking information. You can also track your order by logging into your account and viewing your order history.',
      },
      {
        question: 'What are the shipping charges?',
        answer: 'We offer free shipping on all orders above ₹1,999. For orders below this amount, a flat shipping fee of ₹99 applies.',
      },
    ],
  },
  {
    title: 'Returns & Exchanges',
    items: [
      {
        question: 'What is your return policy?',
        answer: 'We accept returns within 14 days of delivery for unworn items with original tags attached. Items must be in their original packaging and condition.',
      },
      {
        question: 'How do I initiate a return?',
        answer: 'Log into your account, go to Order History, select the order you wish to return, and click "Request Return." Our team will process your request within 24-48 hours.',
      },
      {
        question: 'Can I exchange an item for a different size?',
        answer: 'Yes! We offer free size exchanges. Simply initiate a return request and select "Exchange" as the reason. Once we receive your item, we\'ll ship the new size.',
      },
      {
        question: 'When will I receive my refund?',
        answer: 'Refunds are processed within 5-7 business days after we receive and inspect the returned item. The refund will be credited to your original payment method.',
      },
    ],
  },
  {
    title: 'Products & Authenticity',
    items: [
      {
        question: 'What kind of merchandise do you sell?',
        answer: 'We sell fan-made, artist-inspired designs created with love by fans for fans. Our focus is on quality craftsmanship and celebrating the artists you love.',
      },
      {
        question: 'What sizes do you offer?',
        answer: 'Most items are available in sizes XS to 3XL. We provide detailed size guides on each product page to help you find your perfect fit.',
      },
      {
        question: 'Are the colors as shown in photos?',
        answer: 'We make every effort to display accurate colors. However, slight variations may occur due to different screen settings. Product descriptions include exact color details.',
      },
      {
        question: 'How do I care for my merchandise?',
        answer: 'Care instructions are printed on each item\'s label and included in the product description. Generally, we recommend machine washing cold and tumble drying on low.',
      },
    ],
  },
  {
    title: 'Payment & Security',
    items: [
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit/debit cards, UPI, net banking, and popular wallets through our secure Razorpay payment gateway.',
      },
      {
        question: 'Is my payment information secure?',
        answer: 'Yes. All payments are processed through Razorpay, which uses bank-level encryption to protect your information. We never store your card details.',
      },
      {
        question: 'Do you offer Cash on Delivery?',
        answer: 'Currently, we only accept online payments. This helps us maintain competitive pricing and faster shipping.',
      },
      {
        question: 'What currency are prices displayed in?',
        answer: 'All prices are displayed in Indian Rupees (INR). All applicable taxes (GST) are included in the displayed price.',
      },
    ],
  },
];

export default function FAQPage() {
  // Flatten all FAQs for the JSON-LD schema
  const allFaqs = FAQ_DATA.flatMap((category) => category.items);

  return (
    <>
      <JsonLd data={faqSchema(allFaqs)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'FAQ', url: '/faq' },
        ])}
      />
      <FAQPageClient faqData={FAQ_DATA} />
    </>
  );
}
