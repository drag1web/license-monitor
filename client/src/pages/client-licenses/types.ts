export type ClientLicenseDraft = {
  license_key: string;
  product_name: string;
  customer_name: string;
  expires_at: string;
  max_activations: number;
};

export function makeClientLicenseKey() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LM-${part()}-${part()}-${part()}`;
}

export function makeClientLicenseDraft(): ClientLicenseDraft {
  return {
    license_key: makeClientLicenseKey(),
    product_name: "",
    customer_name: "",
    expires_at: "",
    max_activations: 1,
  };
}