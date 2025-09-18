// Test types for mapped type testing

export interface Employee {
  id: string;
  name: string;
  department: string;
  salary: number;
  startDate: Date;
  isActive: boolean;
  manager?: Employee;
}

// Basic mapped types
export type ReadonlyEmployee = {
  readonly [K in keyof Employee]: Employee[K];
};

export type OptionalEmployee = {
  [K in keyof Employee]?: Employee[K];
};

export type NullableEmployee = {
  [K in keyof Employee]: Employee[K] | null;
};

// Key remapping with template literal types
export type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

export type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

export type Prefixed<T, P extends string> = {
  [K in keyof T as `${P}_${string & K}`]: T[K];
};

// Filtering mapped types
export type StringProperties<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};

export type NonFunctionProperties<T> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
};

// Complex mapped type with conditionals
export type DeepMutable<T> = {
  -readonly [K in keyof T]: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepMutable<T[K]>
    : T[K];
};

// Applied mapped types
export type EmployeeGetters = Getters<Employee>;
export type EmployeeSetters = Setters<Employee>;
export type PrefixedEmployee = Prefixed<Employee, "emp">;
export type EmployeeStrings = StringProperties<Employee>;
export type EmployeeData = NonFunctionProperties<Employee>;

// Modifier manipulation
export type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

export type Concrete<T> = {
  [K in keyof T]-?: T[K];
};

// Index signature mapping
export type Dictionary<T> = {
  [key: string]: T;
};

export type ReadonlyDictionary<T> = {
  readonly [key: string]: T;
};

// Mapped type with index access
export type ValueOf<T> = T[keyof T];
export type EmployeeValues = ValueOf<Employee>;

// Advanced key remapping
export type RemovePrefix<T, P extends string> = {
  [K in keyof T as K extends `${P}${infer Suffix}` ? Suffix : K]: T[K];
};

export type CamelToSnake<T> = {
  [K in keyof T as K extends string
    ? K extends `${infer A}${infer B}`
      ? B extends Uppercase<B>
        ? `${Lowercase<A>}_${CamelToSnake<Lowercase<B>>}`
        : K
      : K
    : K]: T[K];
};

// Mapped type for API responses
export type AsyncProperties<T> = {
  [K in keyof T]: Promise<T[K]>;
};

export type LazyProperties<T> = {
  [K in keyof T]: () => T[K];
};

// Real-world example: Form state
export type FormState<T> = {
  values: T;
  errors: { [K in keyof T]?: string };
  touched: { [K in keyof T]?: boolean };
  dirty: { [K in keyof T]?: boolean };
};

export type EmployeeForm = FormState<Employee>;

