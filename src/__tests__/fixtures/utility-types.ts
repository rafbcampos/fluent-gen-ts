// Test interfaces for utility type testing
export interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  inStock: boolean;
  tags: string[];
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address: {
    street: string;
    city: string;
    country: string;
    zipCode: string;
  };
  isActive: boolean;
}

// Utility type examples
export type ProductSummary = Pick<Product, "id" | "name" | "price">;
export type ProductWithoutId = Omit<Product, "id">;
export type PartialProduct = Partial<Product>;
export type RequiredProduct = Required<Product>;
export type ReadonlyProduct = Readonly<Product>;

// More complex utility types
export type CustomerContact = Pick<Customer, "email" | "phone">;
export type CustomerWithoutAddress = Omit<Customer, "address">;
export type PartialCustomer = Partial<Customer>;
export type RequiredCustomer = Required<Customer>;

// Nested utility types
export type DeepPartialCustomer = Partial<{
  [K in keyof Customer]: Customer[K] extends object
    ? Partial<Customer[K]>
    : Customer[K];
}>;

// Record types
export type ProductCatalog = Record<string, Product>;
export type CustomerDatabase = Record<string, Customer>;
export type PriceList = Record<string, number>;

// Extract and Exclude
export type StringKeys = Extract<keyof Product, string>;
export type NonNullableProduct = {
  [K in keyof Product]: NonNullable<Product[K]>;
};

// Combined utility types
export type EditableProduct = Partial<
  Pick<Product, "name" | "price" | "description">
>;
export type ImmutableCustomer = Readonly<Required<Customer>>;

