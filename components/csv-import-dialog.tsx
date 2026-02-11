"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  UploadSimple, DownloadSimple, ArrowRight, CircleNotch, CheckCircle,
} from "@phosphor-icons/react";

const CONTACT_FIELDS = [
  "email", "first_name", "last_name", "phone", "company",
  "job_title", "address_city", "address_country",
] as const;

type ContactField = (typeof CONTACT_FIELDS)[number];

const FIELD_LABELS: Record<ContactField, string> = {
  email: "Email",
  first_name: "First name",
  last_name: "Last name",
  phone: "Phone",
  company: "Company",
  job_title: "Job title",
  address_city: "City",
  address_country: "Country",
};

const COLUMN_ALIASES: Record<ContactField, string[]> = {
  email: ["email", "e-mail", "email_address", "emailaddress"],
  first_name: ["first_name", "firstname", "first name", "first", "given_name", "givenname"],
  last_name: ["last_name", "lastname", "last name", "last", "surname", "family_name", "familyname"],
  phone: ["phone", "phone_number", "telephone", "mobile", "cell", "tel"],
  company: ["company", "company_name", "organization", "org", "organisation"],
  job_title: ["job_title", "title", "role", "position", "job", "jobtitle"],
  address_city: ["city", "address_city", "town"],
  address_country: ["country", "address_country", "nation"],
};

const SAMPLE_CSV = `email,first_name,last_name,phone,company,job_title,city,country
jane@example.com,Jane,Smith,+1 555-0100,Acme Inc,Marketing Manager,San Francisco,US
john@example.com,John,Doe,+1 555-0200,Globex Corp,Sales Director,New York,US
maria@example.com,Maria,Garcia,,Initech,Product Lead,Austin,US`;

function autoDetectMapping(headers: string[]): Record<number, ContactField | "skip"> {
  const mapping: Record<number, ContactField | "skip"> = {};
  const usedFields = new Set<ContactField>();

  headers.forEach((header, idx) => {
    const normalized = header.toLowerCase().trim();
    for (const field of CONTACT_FIELDS) {
      if (!usedFields.has(field) && COLUMN_ALIASES[field].includes(normalized)) {
        mapping[idx] = field;
        usedFields.add(field);
        return;
      }
    }
    mapping[idx] = "skip";
  });

  return mapping;
}

export function CsvImportDialog({
  orgId,
  trigger,
}: {
  orgId: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, ContactField | "skip">>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setStep(0);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setImporting(false);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDownloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n");
      if (lines.length < 2) {
        toast.error("CSV must have a header row and at least one data row");
        return;
      }

      const parsedHeaders = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
      const parsedRows = lines.slice(1).map((line) =>
        line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""))
      );

      setHeaders(parsedHeaders);
      setRows(parsedRows);
      setMapping(autoDetectMapping(parsedHeaders));
      setStep(2);
    };
    reader.readAsText(file);
  }

  function updateMapping(colIdx: number, value: string) {
    setMapping((prev) => ({ ...prev, [colIdx]: value as ContactField | "skip" }));
  }

  const hasEmailMapping = Object.values(mapping).includes("email");

  function getPreviewRows() {
    return rows.slice(0, 5);
  }

  function getMappedFieldsUsed(): ContactField[] {
    return Object.values(mapping).filter((v) => v !== "skip") as ContactField[];
  }

  async function handleImport() {
    if (!hasEmailMapping) {
      toast.error("You must map at least the Email column");
      return;
    }

    setImporting(true);
    const contactRows = rows
      .map((row) => {
        const contact: Record<string, string | null> = { org_id: orgId };
        Object.entries(mapping).forEach(([idxStr, field]) => {
          if (field !== "skip") {
            const val = row[parseInt(idxStr)]?.trim() || null;
            contact[field] = val;
          }
        });
        return contact;
      })
      .filter((c) => c.email);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("contacts")
      .upsert(contactRows, { onConflict: "org_id,email" })
      .select();

    setImporting(false);
    if (error) {
      toast.error("Import failed: " + error.message);
    } else {
      const count = data?.length ?? 0;
      setImportResult({ count });
      setStep(4);
      toast.success(`Imported ${count} contacts`);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <UploadSimple className="mr-2 h-4 w-4" />Import CSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>
            {step === 4 ? "Import Complete" : "Import Contacts from CSV"}
          </DialogTitle>
          <DialogDescription>
            {step === 0 && "Upload a CSV file with your contacts. We'll help you map the columns."}
            {step === 2 && "Map your CSV columns to contact fields."}
            {step === 3 && "Review the data before importing."}
            {step === 4 && `Successfully imported ${importResult?.count ?? 0} contacts.`}
          </DialogDescription>
        </DialogHeader>

        {/* Step 0: Format guidance */}
        {step === 0 && (
          <div className="space-y-4 min-w-0">
            <div className="rounded-md border p-4 space-y-3">
              <p className="text-sm font-medium">Expected CSV format</p>
              <p className="text-sm text-muted-foreground">
                Your CSV should have a header row. The <strong>email</strong> column is required. All other columns are optional.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.entries(FIELD_LABELS).map(([key, label]) => (
                        <TableHead key={key} className="text-xs whitespace-nowrap">
                          {label} {key === "email" && <span className="text-destructive">*</span>}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-xs">jane@example.com</TableCell>
                      <TableCell className="text-xs">Jane</TableCell>
                      <TableCell className="text-xs">Smith</TableCell>
                      <TableCell className="text-xs">+1 555-0100</TableCell>
                      <TableCell className="text-xs">Acme Inc</TableCell>
                      <TableCell className="text-xs">Marketing</TableCell>
                      <TableCell className="text-xs">SF</TableCell>
                      <TableCell className="text-xs">US</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadSample}>
                <DownloadSimple className="mr-2 h-4 w-4" />Download sample CSV
              </Button>
            </div>

            <div className="flex justify-center">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button onClick={() => fileInputRef.current?.click()} className="w-full">
                  <UploadSimple className="mr-2 h-4 w-4" />Choose CSV file
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Column mapping */}
        {step === 2 && (
          <div className="space-y-4 min-w-0">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">CSV Column</TableHead>
                    <TableHead>Maps to</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headers.map((header, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{header}</code>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping[idx] || "skip"}
                          onValueChange={(v) => updateMapping(idx, v)}
                        >
                          <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">Skip</SelectItem>
                            {CONTACT_FIELDS.map((field) => (
                              <SelectItem
                                key={field}
                                value={field}
                                disabled={Object.values(mapping).includes(field) && mapping[idx] !== field}
                              >
                                {FIELD_LABELS[field]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {!hasEmailMapping && (
              <p className="text-sm text-destructive">
                You must map at least one column to Email.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setStep(0); setHeaders([]); setRows([]); }}>
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!hasEmailMapping}>
                Preview <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && (
          <div className="space-y-4 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{rows.length} rows total</span>
              <span>&middot;</span>
              <span>{getMappedFieldsUsed().length} fields mapped</span>
              <span>&middot;</span>
              <div className="flex flex-wrap gap-1">
                {getMappedFieldsUsed().map((f) => (
                  <Badge key={f} variant="secondary" className="text-xs">{FIELD_LABELS[f]}</Badge>
                ))}
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {getMappedFieldsUsed().map((field) => (
                      <TableHead key={field} className="text-xs whitespace-nowrap">
                        {FIELD_LABELS[field]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getPreviewRows().map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      {getMappedFieldsUsed().map((field) => {
                        const colIdx = Object.entries(mapping).find(
                          ([, f]) => f === field
                        )?.[0];
                        return (
                          <TableCell key={field} className="text-xs">
                            {colIdx !== undefined ? row[parseInt(colIdx)] || "—" : "—"}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {rows.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing first 5 of {rows.length} rows
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <><CircleNotch className="mr-2 h-4 w-4 animate-spin" />Importing...</>
                ) : (
                  <>Import {rows.length} contacts</>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle className="h-12 w-12 text-green-500" weight="fill" />
            <p className="text-lg font-medium">
              {importResult?.count ?? 0} contacts imported
            </p>
            <Button onClick={() => { setOpen(false); reset(); }}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
