// Test types for conditional type testing

// Basic conditional types
export type IsString<T> = T extends string ? true : false;
export type IsNumber<T> = T extends number ? true : false;
export type IsArray<T> = T extends unknown[] ? true : false;

// Conditional type with infer
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
export type UnwrapArray<T> = T extends Array<infer U> ? U : T;
export type FunctionReturnType<T> = T extends (...args: unknown[]) => infer R
  ? R
  : never;

// Distributive conditional types
export type NonNullable<T> = T extends null | undefined ? never : T;
export type ExtractString<T> = T extends string ? T : never;

// Complex conditional types
export type DeepReadonly<T> = T extends object
  ? T extends Function
    ? T
    : { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

export type DeepPartial<T> = T extends object
  ? T extends Function
    ? T
    : { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

// Conditional types with template literals
export type EventName<T> = T extends `on${infer EventType}` ? EventType : never;
export type Capitalize<T extends string> =
  T extends `${infer First}${infer Rest}` ? `${Uppercase<First>}${Rest}` : T;

// Interface for testing
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  assignee?: string;
  dueDate?: Date;
  subtasks?: Task[];
}

export interface AsyncData<T> {
  loading: boolean;
  data?: T;
  error?: Error;
}

// Applied conditional types
export type TaskStatus = Task["completed"] extends true ? "done" : "pending";
export type OptionalFields<T> = {
  [K in keyof T as T[K] extends Required<T>[K] ? never : K]: T[K];
};
export type RequiredFields<T> = {
  [K in keyof T as T[K] extends Required<T>[K] ? K : never]: T[K];
};

// Type to test
export type ConditionalTask = DeepPartial<Task>;
export type ReadonlyTask = DeepReadonly<Task>;
export type AsyncTask = AsyncData<Task>;
export type TaskPromise = Promise<Task>;
export type UnwrappedTaskPromise = UnwrapPromise<TaskPromise>;

// Nested conditional with constraints
export type ValueOrArray<T> = T extends unknown[] ? T : T[];
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

// Complex real-world example
export type ApiResponse<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export type ExtractSuccess<T> = T extends { success: true; data: infer D }
  ? D
  : never;
export type ExtractError<T> = T extends { success: false; error: infer E }
  ? E
  : never;

