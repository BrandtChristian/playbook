import type { FieldType, Operator } from "./types";

export interface OperatorDef {
  value: Operator;
  label: string;
  requiresValue: boolean;
  requiresValue2?: boolean;
}

// Which operators are valid for each field type
export const OPERATORS_BY_TYPE: Record<FieldType, OperatorDef[]> = {
  text: [
    { value: "equals", label: "equals", requiresValue: true },
    { value: "not_equals", label: "does not equal", requiresValue: true },
    { value: "contains", label: "contains", requiresValue: true },
    { value: "not_contains", label: "does not contain", requiresValue: true },
    { value: "starts_with", label: "starts with", requiresValue: true },
    { value: "ends_with", label: "ends with", requiresValue: true },
    { value: "is_set", label: "is set", requiresValue: false },
    { value: "is_not_set", label: "is not set", requiresValue: false },
  ],
  number: [
    { value: "equals", label: "equals", requiresValue: true },
    { value: "not_equals", label: "does not equal", requiresValue: true },
    { value: "gt", label: "greater than", requiresValue: true },
    { value: "gte", label: "greater or equal", requiresValue: true },
    { value: "lt", label: "less than", requiresValue: true },
    { value: "lte", label: "less or equal", requiresValue: true },
    {
      value: "between",
      label: "between",
      requiresValue: true,
      requiresValue2: true,
    },
    { value: "is_set", label: "is set", requiresValue: false },
    { value: "is_not_set", label: "is not set", requiresValue: false },
  ],
  boolean: [
    { value: "is_true", label: "is true", requiresValue: false },
    { value: "is_false", label: "is false", requiresValue: false },
  ],
  date: [
    { value: "before", label: "before", requiresValue: true },
    { value: "after", label: "after", requiresValue: true },
    { value: "in_last_days", label: "in last N days", requiresValue: true },
    { value: "is_set", label: "is set", requiresValue: false },
    { value: "is_not_set", label: "is not set", requiresValue: false },
  ],
  select: [
    { value: "equals", label: "equals", requiresValue: true },
    { value: "not_equals", label: "does not equal", requiresValue: true },
    { value: "is_set", label: "is set", requiresValue: false },
    { value: "is_not_set", label: "is not set", requiresValue: false },
  ],
};

// Aggregation options for relational conditions
export const AGGREGATION_OPTIONS = [
  { value: "exists" as const, label: "has any" },
  { value: "not_exists" as const, label: "has no" },
  { value: "count" as const, label: "count of" },
  { value: "sum" as const, label: "sum of" },
  { value: "min" as const, label: "min of" },
  { value: "max" as const, label: "max of" },
];
