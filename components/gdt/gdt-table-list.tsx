"use client";

import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Database,
  CaretRight,
  CircleNotch,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";

export function GdtTableList() {
  const [tables, setTables] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/gdt/tables");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || `Failed to fetch tables (${response.status})`
        );
      }
      const data = await response.json();
      setTables(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tables");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const filteredTables = useMemo(
    () =>
      tables.filter((name) =>
        name.toLowerCase().includes(filter.toLowerCase())
      ),
    [tables, filter]
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-foreground">GDT Editor</h1>
        <p className="mt-2 text-muted-foreground">
          Browse and edit Global Data Table records
        </p>
      </div>

      <div className="mb-6">
        <Input
          placeholder="Filter tables…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
          aria-label="Filter tables by name"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <Skeleton className="h-5 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-6 flex items-center gap-3">
            <WarningCircle
              className="h-5 w-5 text-destructive flex-shrink-0"
              weight="fill"
            />
            <div className="flex-1">
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadTables}>
              {loading ? (
                <CircleNotch className="h-4 w-4 animate-spin" />
              ) : (
                "Retry"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filteredTables.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Database
              className="h-8 w-8 text-muted-foreground mx-auto mb-3"
              weight="duotone"
            />
            <p className="text-sm text-muted-foreground">
              {tables.length === 0
                ? "No Global Data Tables found in your Agillic instance."
                : `No tables matching "${filter}".`}
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filteredTables.length > 0 && (
        <div className="space-y-2">
          {filteredTables.map((name) => (
            <Link key={name} href={`/gdt-editor/${encodeURIComponent(name)}`}>
              <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database
                      className="h-4 w-4 text-muted-foreground flex-shrink-0"
                      weight="duotone"
                    />
                    <span className="font-medium text-foreground">{name}</span>
                  </div>
                  <CaretRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
