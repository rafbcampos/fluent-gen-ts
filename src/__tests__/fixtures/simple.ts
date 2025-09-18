/** User Address */
export interface Address {
  /** Street name */
  street: string;
  /** City name */
  city: string;
  /** Country code */
  country: string;
}

/** Platform User */
export interface User {
  /** Unique identifier */
  id: string;
  /** Full name */
  name: string;
  /** Age in years */
  age?: number;
  /** User address */
  address: Address;
}

export type Point = {
  x: number;
  y: number;
  z?: number;
};

export interface ApiResponse<T = any, U extends User = User> {
  data: T;
  error?: string;
  user?: U;
  timestamp: number;
}

export enum Status {
  Active = "active",
  Inactive = "inactive",
  Pending = "pending",
}

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface ComplexType {
  union: string | number | boolean;
  intersection: User & { role: string };
  array: string[];
  tuple: [string, number, boolean];
  literal: "foo" | "bar" | 42;
  nested: {
    deep: {
      value: string;
    };
  };
}

