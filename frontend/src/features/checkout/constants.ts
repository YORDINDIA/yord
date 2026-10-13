/**
 * Checkout-only constants.
 *
 * `INDIAN_STATES` used to be a local array in `AddressForm` — 36 names, no
 * "Other", and no way for a second surface to read the same list. The
 * shipping and billing selects both read it from here now.
 */
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
  'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu',
  'Lakshadweep',
  // The list is the 36 states and union territories, but an address outside
  // them (an APO/FPO, a not-yet-listed spelling) must still be orderable.
  'Other',
] as const;

/** The documented returns window (`/returns`), used by the checkout trust card. */
export const RETURN_WINDOW_DAYS = 14;
