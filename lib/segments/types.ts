// Field types for custom fields and data table columns
export type FieldType = "text" | "number" | "boolean" | "date" | "select";

// Operators for segment filter conditions
export type Operator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_set"
  | "is_not_set"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "before"
  | "after"
  | "in_last_days"
  | "is_true"
  | "is_false";

// Where a condition gets its data from
export type ConditionSource =
  | { type: "contact_field"; field: string }
  | { type: "custom_field"; field: string }
  | {
      type: "relation";
      table: string;
      column: string;
      aggregation: "exists" | "not_exists" | "count" | "sum" | "min" | "max";
    };

// A single filter condition
export interface FilterCondition {
  id: string;
  source: ConditionSource;
  operator: Operator;
  value?: unknown;
  value2?: unknown;
}

// A group of conditions with AND/OR logic (recursive)
export interface FilterGroup {
  id: string;
  logic: "and" | "or";
  conditions: (FilterCondition | FilterGroup)[];
}

// Type guard
export function isFilterGroup(
  item: FilterCondition | FilterGroup
): item is FilterGroup {
  return "logic" in item;
}

// Custom field definition (matches DB table)
export interface CustomFieldDefinition {
  id: string;
  org_id: string;
  name: string;
  label: string;
  field_type: FieldType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
}

// Data table definition (matches DB table)
export interface DataTableDefinition {
  id: string;
  org_id: string;
  name: string;
  label: string;
  table_type: "one_to_many" | "global";
  description: string | null;
  created_at: string;
  data_table_columns?: DataTableColumn[];
}

// Data table column (matches DB table)
export interface DataTableColumn {
  id: string;
  table_def_id: string;
  name: string;
  label: string;
  field_type: FieldType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
}

// Data table row (matches DB table)
export interface DataTableRow {
  id: string;
  org_id: string;
  table_def_id: string;
  contact_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

// Built-in contact fields available for segmentation
export const CONTACT_FIELDS = [
  { name: "email", label: "Email", field_type: "text" as FieldType },
  { name: "first_name", label: "First Name", field_type: "text" as FieldType },
  { name: "last_name", label: "Last Name", field_type: "text" as FieldType },
  { name: "phone", label: "Phone", field_type: "text" as FieldType },
  { name: "company", label: "Company", field_type: "text" as FieldType },
  { name: "job_title", label: "Job Title", field_type: "text" as FieldType },
  {
    name: "address_city",
    label: "City",
    field_type: "text" as FieldType,
  },
  {
    name: "address_country",
    label: "Country",
    field_type: "text" as FieldType,
  },
  {
    name: "unsubscribed",
    label: "Unsubscribed",
    field_type: "boolean" as FieldType,
  },
  {
    name: "created_at",
    label: "Created At",
    field_type: "date" as FieldType,
  },
] as const;
