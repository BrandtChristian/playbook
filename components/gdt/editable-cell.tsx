"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const DATE_FORMAT = "dd.MM.yyyy HH:mm:ss";
const DATE_REGEX = /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}$/;

export function validateGdtValue(
  value: string,
  fieldType: string
): string | null {
  if (!value) return null;

  switch (fieldType) {
    case "NUMBER":
      if (isNaN(Number(value))) return "Must be a number";
      return null;
    case "BOOLEAN":
      if (!["true", "false"].includes(value.toLowerCase()))
        return "Must be true or false";
      return null;
    case "DATE":
    case "TIMESTAMP":
      if (!DATE_REGEX.test(value)) return `Format: ${DATE_FORMAT}`;
      return null;
    default:
      return null;
  }
}

export function getPlaceholder(fieldType: string, fieldName: string): string {
  switch (fieldType) {
    case "NUMBER":
      return "0";
    case "BOOLEAN":
      return "true / false";
    case "DATE":
    case "TIMESTAMP":
      return DATE_FORMAT;
    default:
      return fieldName;
  }
}

interface EditableCellProps {
  value: string;
  originalValue: string;
  fieldType: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function EditableCell({
  value,
  originalValue,
  fieldType,
  onChange,
  disabled = false,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDirty = value !== originalValue;

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    const error = validateGdtValue(localValue, fieldType);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setIsEditing(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, value, onChange, fieldType]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setLocalValue(value);
    setValidationError(null);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit]
  );

  if (disabled) {
    return (
      <span
        className={cn(
          "block min-h-[24px]",
          isDirty && "bg-amber-500/10 rounded px-1"
        )}
      >
        {value || "\u00A0"}
      </span>
    );
  }

  // Boolean fields render as a checkbox — always interactive
  if (fieldType === "BOOLEAN") {
    const checked = value.toLowerCase() === "true";
    return (
      <div
        className={cn(
          "flex items-center min-h-[44px]",
          isDirty && "bg-amber-500/10 rounded px-1"
        )}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
          aria-label="Toggle value"
        />
      </div>
    );
  }

  if (isEditing) {
    return (
      <div>
        <Input
          ref={inputRef}
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            if (validationError) setValidationError(null);
          }}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          inputMode={fieldType === "NUMBER" ? "decimal" : undefined}
          placeholder={getPlaceholder(fieldType, "")}
          className={cn(
            "h-9 min-w-[100px]",
            isDirty && "bg-amber-500/10",
            validationError &&
              "border-destructive focus-visible:ring-destructive"
          )}
          spellCheck={false}
        />
        {validationError && (
          <p className="text-[11px] text-destructive mt-0.5">
            {validationError}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      title={value || undefined}
      className={cn(
        "block w-full min-h-[44px] sm:min-h-[24px] text-left px-1 py-1 rounded cursor-text truncate max-w-[240px]",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDirty && "bg-amber-500/10"
      )}
    >
      {value || (
        <span className="text-muted-foreground italic">empty</span>
      )}
    </button>
  );
}
