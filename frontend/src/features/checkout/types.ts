/**
 * The checkout's shared vocabulary.
 *
 * These types were declared inside the components that used them
 * (`AddressData` in AddressForm, `PaymentMethod` in PaymentSection,
 * `CheckoutData` in CheckoutForm) and re-exported from there. The steps hook
 * and the order hook both need them, and a hook importing a type from a
 * component that imports the hook back is a cycle — so they live here, and the
 * component modules re-export them for their existing callers.
 */

export interface AddressData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export type PaymentMethod = 'razorpay' | 'upi' | 'netbanking' | 'cod';

export interface CheckoutData {
  shipping: AddressData;
  billing: AddressData;
  sameAsShipping: boolean;
  paymentMethod: PaymentMethod;
}
