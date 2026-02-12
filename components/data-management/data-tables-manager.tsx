"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus,
  Trash,
  ArrowLeft,
  Table as TableIcon,
} from "@phosphor-icons/react";
import type {
  DataTableDefinition,
  DataTableColumn,
  DataTableRow,
  FieldType,
} from "@/lib/segments/types";

type ContactRef = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  boolean: "Boolean",
  date: "Date",
  select: "Select",
};

export function DataTablesManager({
  tableDefs: initialTableDefs,
  contacts,
  orgId,
  tableType,
}: {
  tableDefs: DataTableDefinition[];
  contacts: ContactRef[];
  orgId: string;
  tableType: "one_to_many" | "global";
}) {
  const [tableDefs, setTableDefs] = useState(initialTableDefs);
  const [selectedTable, setSelectedTable] = useState<DataTableDefinition | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [tableName, setTableName] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [tableDescription, setTableDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function handleLabelChange(val: string) {
    setTableLabel(val);
    setTableName(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
    );
  }

  async function handleCreateTable(e: React.FormEvent) {
    e.preventDefault();
    if (!tableLabel.trim() || !tableName.trim()) return;
    setSaving(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("data_table_definitions")
      .insert({
        org_id: orgId,
        name: tableName.trim(),
        label: tableLabel.trim(),
        table_type: tableType,
        description: tableDescription.trim() || null,
      })
      .select("*, data_table_columns(*)")
      .single();

    if (error) {
      toast.error(
        error.code === "23505"
          ? "A table with this name already exists"
          : error.message
      );
    } else {
      setTableDefs((prev) => [...prev, data]);
      toast.success("Table created");
      setCreateOpen(false);
      setTableLabel("");
      setTableName("");
      setTableDescription("");
    }
    setSaving(false);
    router.refresh();
  }

  async function handleDeleteTable(table: DataTableDefinition) {
    const supabase = createClient();
    const { error } = await supabase
      .from("data_table_definitions")
      .delete()
      .eq("id", table.id);

    if (error) {
      toast.error(error.message);
    } else {
      setTableDefs((prev) => prev.filter((t) => t.id !== table.id));
      if (selectedTable?.id === table.id) setSelectedTable(null);
      toast.success("Table deleted");
      router.refresh();
    }
  }

  if (selectedTable) {
    return (
      <DataTableDetail
        tableDef={selectedTable}
        contacts={contacts}
        orgId={orgId}
        onBack={() => setSelectedTable(null)}
        onUpdate={(updated) => {
          setSelectedTable(updated);
          setTableDefs((prev) =>
            prev.map((t) => (t.id === updated.id ? updated : t))
          );
        }}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              {tableType === "one_to_many"
                ? "Relation Tables"
                : "Global Tables"}
            </CardTitle>
            <CardDescription>
              {tableType === "one_to_many"
                ? "One-to-many tables linked to contacts. Each contact can have multiple rows (e.g. orders, events)."
                : "Shared reference tables not tied to contacts (e.g. products, categories)."}
            </CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Create table
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateTable}>
                <DialogHeader>
                  <DialogTitle>Create table</DialogTitle>
                  <DialogDescription>
                    Define a new{" "}
                    {tableType === "one_to_many" ? "relation" : "global"} data
                    table.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Label</Label>
                    <Input
                      value={tableLabel}
                      onChange={(e) => handleLabelChange(e.target.value)}
                      placeholder="e.g. Orders"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Internal name</Label>
                    <Input
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                      placeholder="e.g. orders"
                      required
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Input
                      value={tableDescription}
                      onChange={(e) => setTableDescription(e.target.value)}
                      placeholder="Optional description"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" type="button">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {tableDefs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No tables defined yet. Create one to start storing{" "}
            {tableType === "one_to_many"
              ? "per-contact relational"
              : "shared reference"}{" "}
            data.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tableDefs.map((table) => (
              <Card
                key={table.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedTable(table)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <TableIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{table.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {table.name}
                      </p>
                      {table.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {table.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {table.data_table_columns?.length ?? 0} columns
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTable(table);
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Detail view for a single data table (columns + rows)
function DataTableDetail({
  tableDef,
  contacts,
  orgId,
  onBack,
  onUpdate,
}: {
  tableDef: DataTableDefinition;
  contacts: ContactRef[];
  orgId: string;
  onBack: () => void;
  onUpdate: (updated: DataTableDefinition) => void;
}) {
  const [columns, setColumns] = useState<DataTableColumn[]>(
    tableDef.data_table_columns ?? []
  );
  const [rows, setRows] = useState<DataTableRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [addColOpen, setAddColOpen] = useState(false);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [colName, setColName] = useState("");
  const [colLabel, setColLabel] = useState("");
  const [colType, setColType] = useState<FieldType>("text");
  const [colOptions, setColOptions] = useState("");
  const [saving, setSaving] = useState(false);
  const [rowData, setRowData] = useState<Record<string, string>>({});
  const [rowContactId, setRowContactId] = useState<string>("");

  useEffect(() => {
    loadRows();
  }, [tableDef.id]);

  async function loadRows() {
    setLoadingRows(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("data_table_rows")
      .select("*")
      .eq("table_def_id", tableDef.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
    setLoadingRows(false);
  }

  function handleColLabelChange(val: string) {
    setColLabel(val);
    setColName(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
    );
  }

  async function handleAddColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!colLabel.trim() || !colName.trim()) return;
    setSaving(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("data_table_columns")
      .insert({
        table_def_id: tableDef.id,
        name: colName.trim(),
        label: colLabel.trim(),
        field_type: colType,
        options:
          colType === "select" && colOptions.trim()
            ? colOptions.split(",").map((o) => o.trim()).filter(Boolean)
            : null,
        sort_order: columns.length,
      })
      .select()
      .single();

    if (error) {
      toast.error(
        error.code === "23505"
          ? "A column with this name already exists"
          : error.message
      );
    } else {
      const newCols = [...columns, data];
      setColumns(newCols);
      onUpdate({ ...tableDef, data_table_columns: newCols });
      toast.success("Column added");
      setAddColOpen(false);
      setColLabel("");
      setColName("");
      setColType("text");
      setColOptions("");
    }
    setSaving(false);
  }

  async function handleDeleteColumn(col: DataTableColumn) {
    const supabase = createClient();
    const { error } = await supabase
      .from("data_table_columns")
      .delete()
      .eq("id", col.id);

    if (error) {
      toast.error(error.message);
    } else {
      const newCols = columns.filter((c) => c.id !== col.id);
      setColumns(newCols);
      onUpdate({ ...tableDef, data_table_columns: newCols });
      toast.success("Column deleted");
    }
  }

  async function handleAddRow(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("data_table_rows")
      .insert({
        org_id: orgId,
        table_def_id: tableDef.id,
        contact_id:
          tableDef.table_type === "one_to_many" && rowContactId
            ? rowContactId
            : null,
        data: rowData,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      setRows((prev) => [data, ...prev]);
      toast.success("Row added");
      setAddRowOpen(false);
      setRowData({});
      setRowContactId("");
    }
    setSaving(false);
  }

  async function handleDeleteRow(row: DataTableRow) {
    const supabase = createClient();
    const { error } = await supabase
      .from("data_table_rows")
      .delete()
      .eq("id", row.id);

    if (error) {
      toast.error(error.message);
    } else {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success("Row deleted");
    }
  }

  function getContactLabel(contactId: string | null) {
    if (!contactId) return "—";
    const c = contacts.find((c) => c.id === contactId);
    if (!c) return contactId.slice(0, 8);
    return c.email;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div>
          <h3 className="text-lg font-semibold">{tableDef.label}</h3>
          <p className="text-sm text-muted-foreground font-mono">
            {tableDef.name}
          </p>
        </div>
      </div>

      {/* Columns section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Columns</CardTitle>
            <Dialog open={addColOpen} onOpenChange={setAddColOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1 h-4 w-4" />
                  Add column
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddColumn}>
                  <DialogHeader>
                    <DialogTitle>Add column</DialogTitle>
                    <DialogDescription>
                      Add a new column to the {tableDef.label} table.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Label</Label>
                      <Input
                        value={colLabel}
                        onChange={(e) => handleColLabelChange(e.target.value)}
                        placeholder="e.g. Order Total"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Internal name</Label>
                      <Input
                        value={colName}
                        onChange={(e) => setColName(e.target.value)}
                        placeholder="e.g. order_total"
                        required
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Type</Label>
                      <Select
                        value={colType}
                        onValueChange={(v) => setColType(v as FieldType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {colType === "select" && (
                      <div className="grid gap-2">
                        <Label>Options (comma-separated)</Label>
                        <Input
                          value={colOptions}
                          onChange={(e) => setColOptions(e.target.value)}
                          placeholder="e.g. pending, completed, refunded"
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" type="button">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Adding..." : "Add column"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {columns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No columns yet. Add columns to define the table structure.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {columns.map((col) => (
                <Badge
                  key={col.id}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  <span>{col.label}</span>
                  <span className="text-muted-foreground">
                    ({FIELD_TYPE_LABELS[col.field_type]})
                  </span>
                  <button
                    onClick={() => handleDeleteColumn(col)}
                    className="ml-1 hover:text-destructive"
                  >
                    <Trash className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rows section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Data ({rows.length} rows)
            </CardTitle>
            <Dialog open={addRowOpen} onOpenChange={setAddRowOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={columns.length === 0}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add row
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddRow}>
                  <DialogHeader>
                    <DialogTitle>Add row</DialogTitle>
                    <DialogDescription>
                      Add a new row to {tableDef.label}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {tableDef.table_type === "one_to_many" && (
                      <div className="grid gap-2">
                        <Label>Contact</Label>
                        <Select
                          value={rowContactId}
                          onValueChange={setRowContactId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select contact" />
                          </SelectTrigger>
                          <SelectContent>
                            {contacts.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.email}
                                {c.first_name && ` (${c.first_name})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {columns.map((col) => (
                      <div key={col.id} className="grid gap-2">
                        <Label>{col.label}</Label>
                        {col.field_type === "select" && col.options ? (
                          <Select
                            value={(rowData[col.name] as string) ?? ""}
                            onValueChange={(v) =>
                              setRowData((prev) => ({ ...prev, [col.name]: v }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${col.label}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {col.options.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={
                              col.field_type === "number"
                                ? "number"
                                : col.field_type === "date"
                                ? "date"
                                : "text"
                            }
                            value={(rowData[col.name] as string) ?? ""}
                            onChange={(e) =>
                              setRowData((prev) => ({
                                ...prev,
                                [col.name]: e.target.value,
                              }))
                            }
                            placeholder={col.label}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" type="button">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Adding..." : "Add row"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {columns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Add columns first before adding data.
            </p>
          ) : loadingRows ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Loading...
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No data yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableDef.table_type === "one_to_many" && (
                      <TableHead>Contact</TableHead>
                    )}
                    {columns.map((col) => (
                      <TableHead key={col.id}>{col.label}</TableHead>
                    ))}
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      {tableDef.table_type === "one_to_many" && (
                        <TableCell className="text-sm">
                          {getContactLabel(row.contact_id)}
                        </TableCell>
                      )}
                      {columns.map((col) => (
                        <TableCell key={col.id} className="text-sm">
                          {row.data[col.name] != null
                            ? String(row.data[col.name])
                            : "—"}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRow(row)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
