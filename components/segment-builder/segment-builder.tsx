"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash, Users, ArrowsClockwise } from "@phosphor-icons/react";
import { OPERATORS_BY_TYPE, AGGREGATION_OPTIONS } from "@/lib/segments/operators";
import {
  CONTACT_FIELDS,
  type FilterGroup,
  type FilterCondition,
  type ConditionSource,
  type Operator,
  type FieldType,
  type CustomFieldDefinition,
  type DataTableDefinition,
  isFilterGroup,
} from "@/lib/segments/types";

interface SegmentBuilderProps {
  value: FilterGroup;
  onChange: (rules: FilterGroup) => void;
  customFields: CustomFieldDefinition[];
  dataTables: DataTableDefinition[];
  orgId: string;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyCondition(): FilterCondition {
  return {
    id: generateId(),
    source: { type: "contact_field", field: "email" },
    operator: "equals",
    value: "",
  };
}

function emptyGroup(): FilterGroup {
  return {
    id: generateId(),
    logic: "and",
    conditions: [emptyCondition()],
  };
}

// Resolve field type from a source
function getFieldType(
  source: ConditionSource,
  customFields: CustomFieldDefinition[],
  dataTables: DataTableDefinition[]
): FieldType {
  if (source.type === "contact_field") {
    const f = CONTACT_FIELDS.find((cf) => cf.name === source.field);
    return f?.field_type ?? "text";
  }
  if (source.type === "custom_field") {
    const f = customFields.find((cf) => cf.name === source.field);
    return f?.field_type ?? "text";
  }
  if (source.type === "relation") {
    if (source.aggregation === "exists" || source.aggregation === "not_exists") {
      return "boolean";
    }
    // For count/sum/min/max, the result is numeric
    return "number";
  }
  return "text";
}

// Get select options for a source
function getSelectOptions(
  source: ConditionSource,
  customFields: CustomFieldDefinition[],
  dataTables: DataTableDefinition[]
): string[] | null {
  if (source.type === "custom_field") {
    const f = customFields.find((cf) => cf.name === source.field);
    if (f?.field_type === "select" && f.options) return f.options;
  }
  if (source.type === "relation") {
    const table = dataTables.find((t) => t.name === source.table);
    const col = table?.data_table_columns?.find((c) => c.name === source.column);
    if (col?.field_type === "select" && col.options) return col.options;
  }
  return null;
}

export function SegmentBuilder({
  value,
  onChange,
  customFields,
  dataTables,
  orgId,
}: SegmentBuilderProps) {
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSample, setPreviewSample] = useState<
    { id: string; email: string; first_name: string | null }[]
  >([]);
  const [previewing, setPreviewing] = useState(false);

  const relationTables = dataTables.filter(
    (t) => t.table_type === "one_to_many"
  );

  const handlePreview = useCallback(async () => {
    setPreviewing(true);
    try {
      const res = await fetch("/api/segments/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, filterRules: value }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreviewCount(data.count);
        setPreviewSample(data.sample);
      }
    } catch {
      // ignore
    }
    setPreviewing(false);
  }, [orgId, value]);

  function updateGroup(
    group: FilterGroup,
    targetId: string,
    updater: (item: FilterGroup) => FilterGroup
  ): FilterGroup {
    if (group.id === targetId) return updater(group);
    return {
      ...group,
      conditions: group.conditions.map((item) =>
        isFilterGroup(item) ? updateGroup(item, targetId, updater) : item
      ),
    };
  }

  function updateCondition(
    group: FilterGroup,
    targetId: string,
    updater: (item: FilterCondition) => FilterCondition
  ): FilterGroup {
    return {
      ...group,
      conditions: group.conditions.map((item) => {
        if (isFilterGroup(item)) {
          return updateCondition(item, targetId, updater);
        }
        return item.id === targetId ? updater(item) : item;
      }),
    };
  }

  function removeItem(group: FilterGroup, targetId: string): FilterGroup {
    return {
      ...group,
      conditions: group.conditions
        .filter((item) => item.id !== targetId)
        .map((item) =>
          isFilterGroup(item) ? removeItem(item, targetId) : item
        ),
    };
  }

  function addCondition(groupId: string) {
    onChange(
      updateGroup(value, groupId, (g) => ({
        ...g,
        conditions: [...g.conditions, emptyCondition()],
      }))
    );
  }

  function addGroup(groupId: string) {
    onChange(
      updateGroup(value, groupId, (g) => ({
        ...g,
        conditions: [...g.conditions, emptyGroup()],
      }))
    );
  }

  return (
    <div className="space-y-4">
      <FilterGroupUI
        group={value}
        depth={0}
        customFields={customFields}
        dataTables={dataTables}
        relationTables={relationTables}
        onLogicChange={(logic) =>
          onChange({ ...value, logic })
        }
        onAddCondition={() => addCondition(value.id)}
        onAddGroup={() => addGroup(value.id)}
        onRemoveItem={(id) => onChange(removeItem(value, id))}
        onUpdateCondition={(id, updater) =>
          onChange(updateCondition(value, id, updater))
        }
        onUpdateGroupLogic={(id, logic) =>
          onChange(
            updateGroup(value, id, (g) => ({ ...g, logic }))
          )
        }
        onAddConditionToGroup={(groupId) => addCondition(groupId)}
        onAddGroupToGroup={(groupId) => addGroup(groupId)}
      />

      <div className="flex items-center gap-3 pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePreview}
          disabled={previewing}
        >
          <ArrowsClockwise
            className={`mr-1 h-4 w-4 ${previewing ? "animate-spin" : ""}`}
          />
          {previewing ? "Counting..." : "Preview"}
        </Button>
        {previewCount !== null && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {previewCount} contact{previewCount !== 1 ? "s" : ""} match
            </span>
          </div>
        )}
      </div>

      {previewSample.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {previewSample.map((c) => (
            <Badge key={c.id} variant="secondary" className="text-xs">
              {c.email}
            </Badge>
          ))}
          {previewCount !== null && previewCount > 5 && (
            <Badge variant="outline" className="text-xs">
              +{previewCount - 5} more
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// Recursive group renderer
function FilterGroupUI({
  group,
  depth,
  customFields,
  dataTables,
  relationTables,
  onLogicChange,
  onAddCondition,
  onAddGroup,
  onRemoveItem,
  onUpdateCondition,
  onUpdateGroupLogic,
  onAddConditionToGroup,
  onAddGroupToGroup,
}: {
  group: FilterGroup;
  depth: number;
  customFields: CustomFieldDefinition[];
  dataTables: DataTableDefinition[];
  relationTables: DataTableDefinition[];
  onLogicChange: (logic: "and" | "or") => void;
  onAddCondition: () => void;
  onAddGroup: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateCondition: (
    id: string,
    updater: (c: FilterCondition) => FilterCondition
  ) => void;
  onUpdateGroupLogic: (id: string, logic: "and" | "or") => void;
  onAddConditionToGroup: (groupId: string) => void;
  onAddGroupToGroup: (groupId: string) => void;
}) {
  return (
    <div
      className={`space-y-2 ${
        depth > 0 ? "border-l-2 border-muted pl-4 ml-2" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Match</span>
        <Select
          value={group.logic}
          onValueChange={(v) => onLogicChange(v as "and" | "or")}
        >
          <SelectTrigger className="w-20 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="and">ALL</SelectItem>
            <SelectItem value="or">ANY</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">of the following:</span>
      </div>

      {group.conditions.map((item) =>
        isFilterGroup(item) ? (
          <div key={item.id} className="relative">
            <FilterGroupUI
              group={item}
              depth={depth + 1}
              customFields={customFields}
              dataTables={dataTables}
              relationTables={relationTables}
              onLogicChange={(logic) => onUpdateGroupLogic(item.id, logic)}
              onAddCondition={() => onAddConditionToGroup(item.id)}
              onAddGroup={() => onAddGroupToGroup(item.id)}
              onRemoveItem={onRemoveItem}
              onUpdateCondition={onUpdateCondition}
              onUpdateGroupLogic={onUpdateGroupLogic}
              onAddConditionToGroup={onAddConditionToGroup}
              onAddGroupToGroup={onAddGroupToGroup}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute -top-1 -right-1 h-6 w-6"
              onClick={() => onRemoveItem(item.id)}
            >
              <Trash className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <ConditionRow
            key={item.id}
            condition={item}
            customFields={customFields}
            dataTables={dataTables}
            relationTables={relationTables}
            onChange={(updater) => onUpdateCondition(item.id, updater)}
            onRemove={() => onRemoveItem(item.id)}
          />
        )
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onAddCondition}>
          <Plus className="mr-1 h-3 w-3" />
          Condition
        </Button>
        {depth < 2 && (
          <Button type="button" variant="outline" size="sm" onClick={onAddGroup}>
            <Plus className="mr-1 h-3 w-3" />
            Group
          </Button>
        )}
      </div>
    </div>
  );
}

// Single condition row
function ConditionRow({
  condition,
  customFields,
  dataTables,
  relationTables,
  onChange,
  onRemove,
}: {
  condition: FilterCondition;
  customFields: CustomFieldDefinition[];
  dataTables: DataTableDefinition[];
  relationTables: DataTableDefinition[];
  onChange: (updater: (c: FilterCondition) => FilterCondition) => void;
  onRemove: () => void;
}) {
  const fieldType = getFieldType(condition.source, customFields, dataTables);
  const operators = getOperatorsForCondition(condition, customFields, dataTables);
  const selectOptions = getSelectOptions(condition.source, customFields, dataTables);
  const currentOp = operators.find((o) => o.value === condition.operator);

  // Build source key for select value
  function sourceKey(source: ConditionSource): string {
    if (source.type === "contact_field") return `cf:${source.field}`;
    if (source.type === "custom_field") return `custom:${source.field}`;
    if (source.type === "relation") {
      return `rel:${source.table}:${source.column}:${source.aggregation}`;
    }
    return "";
  }

  function handleSourceChange(key: string) {
    const [prefix, ...rest] = key.split(":");
    let newSource: ConditionSource;

    if (prefix === "cf") {
      newSource = { type: "contact_field", field: rest[0] };
    } else if (prefix === "custom") {
      newSource = { type: "custom_field", field: rest[0] };
    } else if (prefix === "rel") {
      newSource = {
        type: "relation",
        table: rest[0],
        column: rest[1] || "",
        aggregation: (rest[2] || "exists") as ConditionSource & { type: "relation" } extends { aggregation: infer A } ? A : never,
      };
    } else {
      return;
    }

    onChange((c) => ({
      ...c,
      source: newSource,
      operator: "equals",
      value: "",
      value2: undefined,
    }));
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Field picker */}
      <Select
        value={sourceKey(condition.source)}
        onValueChange={handleSourceChange}
      >
        <SelectTrigger className="w-48 h-8">
          <SelectValue placeholder="Select field" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Contact Fields</SelectLabel>
            {CONTACT_FIELDS.map((f) => (
              <SelectItem key={`cf:${f.name}`} value={`cf:${f.name}`}>
                {f.label}
              </SelectItem>
            ))}
          </SelectGroup>
          {customFields.length > 0 && (
            <SelectGroup>
              <SelectLabel>Custom Fields</SelectLabel>
              {customFields.map((f) => (
                <SelectItem key={`custom:${f.name}`} value={`custom:${f.name}`}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {relationTables.length > 0 && (
            <SelectGroup>
              <SelectLabel>Related Data</SelectLabel>
              {relationTables.map((t) => (
                <SelectItem
                  key={`rel:${t.name}::exists`}
                  value={`rel:${t.name}::exists`}
                >
                  {t.label} (has any)
                </SelectItem>
              ))}
              {relationTables.map((t) => (
                <SelectItem
                  key={`rel:${t.name}::not_exists`}
                  value={`rel:${t.name}::not_exists`}
                >
                  {t.label} (has none)
                </SelectItem>
              ))}
              {relationTables.flatMap((t) =>
                (t.data_table_columns ?? [])
                  .filter((c) => c.field_type === "number")
                  .flatMap((c) =>
                    (["count", "sum"] as const).map((agg) => (
                      <SelectItem
                        key={`rel:${t.name}:${c.name}:${agg}`}
                        value={`rel:${t.name}:${c.name}:${agg}`}
                      >
                        {t.label} &rarr; {c.label} ({agg})
                      </SelectItem>
                    ))
                  )
              )}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {/* Operator picker — skip for exists/not_exists */}
      {condition.source.type === "relation" &&
      (condition.source.aggregation === "exists" ||
        condition.source.aggregation === "not_exists") ? null : (
        <Select
          value={condition.operator}
          onValueChange={(v) =>
            onChange((c) => ({ ...c, operator: v as Operator, value: "", value2: undefined }))
          }
        >
          <SelectTrigger className="w-40 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Value input */}
      {currentOp?.requiresValue && (
        <>
          {selectOptions ? (
            <Select
              value={String(condition.value ?? "")}
              onValueChange={(v) => onChange((c) => ({ ...c, value: v }))}
            >
              <SelectTrigger className="w-40 h-8">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {selectOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="w-36 h-8"
              type={fieldType === "number" ? "number" : fieldType === "date" ? "date" : "text"}
              value={String(condition.value ?? "")}
              onChange={(e) =>
                onChange((c) => ({ ...c, value: e.target.value }))
              }
              placeholder={
                condition.operator === "in_last_days" ? "days" : "value"
              }
            />
          )}
        </>
      )}

      {/* Second value for between */}
      {currentOp?.requiresValue2 && (
        <>
          <span className="text-sm text-muted-foreground">and</span>
          <Input
            className="w-28 h-8"
            type="number"
            value={String(condition.value2 ?? "")}
            onChange={(e) =>
              onChange((c) => ({ ...c, value2: e.target.value }))
            }
            placeholder="max"
          />
        </>
      )}

      {/* Remove */}
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
        <Trash className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function getOperatorsForCondition(
  condition: FilterCondition,
  customFields: CustomFieldDefinition[],
  dataTables: DataTableDefinition[]
) {
  const fieldType = getFieldType(condition.source, customFields, dataTables);
  return OPERATORS_BY_TYPE[fieldType] ?? OPERATORS_BY_TYPE.text;
}
