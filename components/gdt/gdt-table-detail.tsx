"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  CircleNotch,
  WarningCircle,
  X,
  Trash,
  Plus,
} from "@phosphor-icons/react";
import Link from "next/link";
import { toast } from "sonner";
import { EditableCell, validateGdtValue, getPlaceholder } from "./editable-cell";
import type {
  GdtFieldMetadata,
  GdtTableWithMetadata,
} from "@/lib/agillic/globaldata-api";

interface GdtTableDetailProps {
  tableId: string;
}

interface EditState {
  [recordId: string]: Record<string, string>;
}

interface NewRow {
  tempId: string;
  data: Record<string, string>;
}

export function GdtTableDetail({ tableId }: GdtTableDetailProps) {
  const [tableData, setTableData] = useState<GdtTableWithMetadata | null>(null);
  const [editState, setEditState] = useState<EditState>({});
  const [newRows, setNewRows] = useState<NewRow[]>([]);
  const [savingRecords, setSavingRecords] = useState<Set<string>>(new Set());
  const [deletingRecords, setDeletingRecords] = useState<Set<string>>(
    new Set()
  );
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scroll refs
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableInnerRef = useRef<HTMLTableElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const [scrollMax, setScrollMax] = useState(0);

  const loadTable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/gdt/tables/${encodeURIComponent(tableId)}`
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || `Failed to fetch table (${response.status})`
        );
      }
      const data: GdtTableWithMetadata = await response.json();
      setTableData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load table");
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  // Track table scroll dimensions
  useEffect(() => {
    const scrollEl = tableScrollRef.current;
    const tableEl = tableInnerRef.current;
    if (!scrollEl || !tableEl) return;

    const update = () => {
      const max = scrollEl.scrollWidth - scrollEl.clientWidth;
      setScrollMax(max > 0 ? max : 0);
      if (sliderRef.current) {
        sliderRef.current.value = String(scrollEl.scrollLeft);
      }
    };

    requestAnimationFrame(update);

    const observer = new ResizeObserver(update);
    observer.observe(tableEl);
    observer.observe(scrollEl);
    return () => observer.disconnect();
  }, [tableData]);

  const handleSliderInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      if (tableScrollRef.current) {
        tableScrollRef.current.scrollLeft = Number(e.currentTarget.value);
      }
    },
    []
  );

  const handleTableScroll = useCallback(() => {
    if (sliderRef.current && tableScrollRef.current) {
      sliderRef.current.value = String(tableScrollRef.current.scrollLeft);
    }
  }, []);

  // Warn on unsaved changes before navigation
  useEffect(() => {
    const hasDirty = Object.keys(editState).length > 0 || newRows.length > 0;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasDirty) {
        e.preventDefault();
      }
    };
    if (hasDirty) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editState, newRows]);

  const identifierField = useMemo(
    () =>
      tableData?.fields.find((f) => f.identifier) ||
      tableData?.fields.find((f) => f.name === "ID"),
    [tableData?.fields]
  );

  const identifierFieldName = identifierField?.name || "ID";

  const dirtyRecordIds = useMemo(() => Object.keys(editState), [editState]);
  const hasPendingChanges = dirtyRecordIds.length > 0 || newRows.length > 0;
  const isSavingAny = savingRecords.size > 0;

  const handleCellChange = useCallback(
    (recordId: string, fieldName: string, value: string) => {
      setEditState((prev) => {
        const originalRecord = tableData?.records.find(
          (r) => r[identifierFieldName] === recordId
        );
        const originalValue = originalRecord?.[fieldName] ?? "";

        const current = { ...prev };

        if (value === originalValue) {
          if (current[recordId]) {
            const { [fieldName]: _, ...rest } = current[recordId];
            if (Object.keys(rest).length === 0) {
              delete current[recordId];
            } else {
              current[recordId] = rest;
            }
          }
        } else {
          current[recordId] = { ...current[recordId], [fieldName]: value };
        }

        return current;
      });
    },
    [tableData?.records, identifierFieldName]
  );

  // --- Update (existing) ---
  const handleSave = useCallback(
    async (recordId: string) => {
      const originalRecord = tableData?.records.find(
        (r) => r[identifierFieldName] === recordId
      );
      if (!originalRecord || !editState[recordId]) return;

      const updatedRecord = { ...originalRecord, ...editState[recordId] };

      setSavingRecords((prev) => new Set(prev).add(recordId));

      try {
        const response = await fetch(
          `/api/gdt/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedRecord),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to save (${response.status})`);
        }

        setTableData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            records: prev.records.map((r) =>
              r[identifierFieldName] === recordId ? updatedRecord : r
            ),
          };
        });

        setEditState((prev) => {
          const { [recordId]: _, ...rest } = prev;
          return rest;
        });

        toast.success(`Record "${recordId}" saved`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save record"
        );
      } finally {
        setSavingRecords((prev) => {
          const next = new Set(prev);
          next.delete(recordId);
          return next;
        });
      }
    },
    [tableData?.records, editState, identifierFieldName, tableId]
  );

  // --- Delete ---
  const handleDelete = useCallback(
    async (recordId: string) => {
      setConfirmingDelete(null);
      setDeletingRecords((prev) => new Set(prev).add(recordId));

      try {
        const response = await fetch(
          `/api/gdt/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`,
          { method: "DELETE" }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(
            data.error || `Failed to delete (${response.status})`
          );
        }

        setTableData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            records: prev.records.filter(
              (r) => r[identifierFieldName] !== recordId
            ),
          };
        });

        setEditState((prev) => {
          const { [recordId]: _, ...rest } = prev;
          return rest;
        });

        toast.success(`Record "${recordId}" deleted`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete record"
        );
      } finally {
        setDeletingRecords((prev) => {
          const next = new Set(prev);
          next.delete(recordId);
          return next;
        });
      }
    },
    [tableId, identifierFieldName]
  );

  // --- Create (new rows) ---
  const handleAddRow = useCallback(() => {
    const tempId = `__new_${Date.now()}`;
    const emptyData: Record<string, string> = {};
    tableData?.fields.forEach((f) => {
      emptyData[f.name] = "";
    });
    setNewRows((prev) => [...prev, { tempId, data: emptyData }]);
  }, [tableData?.fields]);

  const handleNewRowChange = useCallback(
    (tempId: string, fieldName: string, value: string) => {
      setNewRows((prev) =>
        prev.map((row) =>
          row.tempId === tempId
            ? { ...row, data: { ...row.data, [fieldName]: value } }
            : row
        )
      );
    },
    []
  );

  const handleSaveNewRow = useCallback(
    async (tempId: string) => {
      const row = newRows.find((r) => r.tempId === tempId);
      if (!row) return;

      const recordId = row.data[identifierFieldName];
      if (!recordId) {
        toast.error(`${identifierFieldName} is required`);
        return;
      }

      // Validate all fields
      const errors: string[] = [];
      for (const field of tableData?.fields ?? []) {
        const val = row.data[field.name];
        if (val) {
          const error = validateGdtValue(val, field.type);
          if (error) {
            errors.push(`${field.name}: ${error}`);
          }
        }
      }
      if (errors.length > 0) {
        toast.error(errors.join(", "));
        return;
      }

      setSavingRecords((prev) => new Set(prev).add(tempId));

      try {
        const response = await fetch(
          `/api/gdt/tables/${encodeURIComponent(tableId)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(row.data),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(
            data.error || `Failed to create (${response.status})`
          );
        }

        setTableData((prev) => {
          if (!prev) return prev;
          return { ...prev, records: [...prev.records, row.data] };
        });
        setNewRows((prev) => prev.filter((r) => r.tempId !== tempId));

        toast.success(`Record "${recordId}" created`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to create record"
        );
      } finally {
        setSavingRecords((prev) => {
          const next = new Set(prev);
          next.delete(tempId);
          return next;
        });
      }
    },
    [newRows, identifierFieldName, tableId, tableData?.fields]
  );

  const handleDiscardNewRow = useCallback((tempId: string) => {
    setNewRows((prev) => prev.filter((r) => r.tempId !== tempId));
  }, []);

  // --- Save all ---
  const handleSaveAll = useCallback(async () => {
    for (const row of newRows) {
      await handleSaveNewRow(row.tempId);
    }
    for (const recordId of dirtyRecordIds) {
      await handleSave(recordId);
    }
  }, [newRows, handleSaveNewRow, dirtyRecordIds, handleSave]);

  const handleCancelAll = useCallback(() => {
    setEditState({});
    setNewRows([]);
  }, []);

  // --- Loading state ---
  if (loading) {
    return (
      <div className="max-w-full mx-auto">
        <div className="mb-8">
          <Link href="/gdt-editor">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tables
            </Button>
          </Link>
          <div className="h-8 w-64 bg-muted animate-pulse rounded mb-2" />
          <div className="h-5 w-48 bg-muted animate-pulse rounded" />
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2">
              <CircleNotch className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">
                Loading table data…
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="max-w-full mx-auto">
        <div className="mb-8">
          <Link href="/gdt-editor">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tables
            </Button>
          </Link>
        </div>
        <Card className="border-destructive">
          <CardContent className="py-6 flex items-center gap-3">
            <WarningCircle
              className="h-5 w-5 text-destructive flex-shrink-0"
              weight="fill"
            />
            <p className="text-sm text-destructive flex-1">{error}</p>
            <Button variant="outline" size="sm" onClick={loadTable}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tableData) return null;

  const isWideTable = tableData.fields.length > 5;
  const totalRecords = tableData.records.length + newRows.length;

  return (
    <div className="max-w-full mx-auto">
      <div className="mb-8">
        <Link href="/gdt-editor">
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tables
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {tableData.name}
            </h1>
            {tableData.description && (
              <p className="mt-2 text-muted-foreground">
                {tableData.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline">
                {totalRecords} record{totalRecords !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="outline">
                {tableData.fields.length} field
                {tableData.fields.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
          <Button size="sm" onClick={handleAddRow}>
            <Plus className="h-4 w-4 mr-2" />
            Add row
          </Button>
        </div>
      </div>

      {totalRecords === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              This table has no records.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          {/* Top scroll slider for wide tables */}
          {scrollMax > 0 && (
            <div className="px-3 py-1.5 border-b border-border">
              <input
                ref={sliderRef}
                type="range"
                min={0}
                max={scrollMax}
                defaultValue={0}
                onInput={handleSliderInput}
                className="w-full h-1.5 accent-muted-foreground cursor-pointer"
                aria-label="Scroll table horizontally"
              />
            </div>
          )}

          {/* Table */}
          <div
            ref={tableScrollRef}
            onScroll={handleTableScroll}
            className="overflow-x-auto relative"
          >
            <Table ref={tableInnerRef}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px] sticky left-0 z-20 bg-background" />
                  {tableData.fields.map((field: GdtFieldMetadata) => (
                    <TableHead
                      key={field.name}
                      style={{
                        minWidth: "120px",
                        maxWidth:
                          isWideTable && !field.identifier
                            ? "240px"
                            : undefined,
                      }}
                    >
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="truncate" title={field.name}>
                          {field.name}
                        </span>
                        {field.identifier && (
                          <Badge className="text-[10px] px-1 py-0 flex-shrink-0">
                            ID
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 font-normal flex-shrink-0"
                        >
                          {field.type}
                        </Badge>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Existing records */}
                {tableData.records.map((record) => {
                  const recordId = record[identifierFieldName];
                  const rowEdits = editState[recordId];
                  const isSaving = savingRecords.has(recordId);
                  const isDeleting = deletingRecords.has(recordId);
                  const isConfirming = confirmingDelete === recordId;

                  return (
                    <TableRow
                      key={recordId}
                      className={rowEdits ? "bg-amber-500/5" : undefined}
                    >
                      <TableCell className="sticky left-0 z-10 bg-background w-[40px] px-1">
                        {isDeleting ? (
                          <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                        ) : isConfirming ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleDelete(recordId)}
                            >
                              Yes
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => setConfirmingDelete(null)}
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => setConfirmingDelete(recordId)}
                            aria-label={`Delete record ${recordId}`}
                          >
                            <Trash className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </TableCell>
                      {tableData.fields.map((field: GdtFieldMetadata) => (
                        <TableCell
                          key={field.name}
                          style={{
                            ...(field.type === "NUMBER"
                              ? { fontVariantNumeric: "tabular-nums" }
                              : undefined),
                            ...(isWideTable && !field.identifier
                              ? { maxWidth: "240px" }
                              : undefined),
                          }}
                        >
                          {field.identifier ? (
                            <span className="font-medium whitespace-nowrap">
                              {record[field.name]}
                            </span>
                          ) : (
                            <EditableCell
                              value={
                                rowEdits?.[field.name] ??
                                record[field.name] ??
                                ""
                              }
                              originalValue={record[field.name] ?? ""}
                              fieldType={field.type}
                              onChange={(value) =>
                                handleCellChange(recordId, field.name, value)
                              }
                              disabled={isSaving || isDeleting}
                            />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}

                {/* New rows */}
                {newRows.map((row) => {
                  const isSaving = savingRecords.has(row.tempId);

                  return (
                    <TableRow key={row.tempId} className="bg-green-500/5">
                      <TableCell className="sticky left-0 z-10 bg-background w-[40px] px-1">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleSaveNewRow(row.tempId)}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <CircleNotch className="h-3 w-3 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleDiscardNewRow(row.tempId)}
                            disabled={isSaving}
                            aria-label="Discard new row"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      {tableData.fields.map((field: GdtFieldMetadata) => (
                        <TableCell
                          key={field.name}
                          style={
                            isWideTable && !field.identifier
                              ? { maxWidth: "240px" }
                              : undefined
                          }
                        >
                          {field.type === "BOOLEAN" ? (
                            <div className="flex items-center min-h-[36px]">
                              <Checkbox
                                checked={
                                  row.data[field.name]?.toLowerCase() === "true"
                                }
                                onCheckedChange={(checked) =>
                                  handleNewRowChange(
                                    row.tempId,
                                    field.name,
                                    checked ? "true" : "false"
                                  )
                                }
                                disabled={isSaving}
                                aria-label={field.name}
                              />
                            </div>
                          ) : (
                            <Input
                              value={row.data[field.name] || ""}
                              onChange={(e) =>
                                handleNewRowChange(
                                  row.tempId,
                                  field.name,
                                  e.target.value
                                )
                              }
                              placeholder={getPlaceholder(
                                field.type,
                                field.name
                              )}
                              className="h-9 min-w-[100px]"
                              inputMode={
                                field.type === "NUMBER" ? "decimal" : undefined
                              }
                              spellCheck={false}
                              disabled={isSaving}
                            />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Floating save bar */}
      {hasPendingChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <Card className="shadow-lg border-border">
            <CardContent className="py-3 px-4 flex items-center gap-4">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {dirtyRecordIds.length > 0 &&
                  `${dirtyRecordIds.length} edit${dirtyRecordIds.length !== 1 ? "s" : ""}`}
                {dirtyRecordIds.length > 0 && newRows.length > 0 && ", "}
                {newRows.length > 0 &&
                  `${newRows.length} new row${newRows.length !== 1 ? "s" : ""}`}
              </span>
              <Button
                size="sm"
                className="h-9"
                onClick={handleSaveAll}
                disabled={isSavingAny}
              >
                {isSavingAny ? (
                  <CircleNotch className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9"
                onClick={handleCancelAll}
                disabled={isSavingAny}
                aria-label="Discard all changes"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
