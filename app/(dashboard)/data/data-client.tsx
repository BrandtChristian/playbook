"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomFieldsManager } from "@/components/data-management/custom-fields-manager";
import { DataTablesManager } from "@/components/data-management/data-tables-manager";
import type {
  CustomFieldDefinition,
  DataTableDefinition,
} from "@/lib/segments/types";

type ContactRef = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

export function DataClient({
  customFields: initialCustomFields,
  tableDefs: initialTableDefs,
  contacts,
  orgId,
}: {
  customFields: CustomFieldDefinition[];
  tableDefs: DataTableDefinition[];
  contacts: ContactRef[];
  orgId: string;
}) {
  return (
    <Tabs defaultValue="person" className="space-y-4">
      <TabsList>
        <TabsTrigger value="person">Person Data</TabsTrigger>
        <TabsTrigger value="relations">Relation Tables</TabsTrigger>
        <TabsTrigger value="global">Global Tables</TabsTrigger>
      </TabsList>

      <TabsContent value="person">
        <CustomFieldsManager
          fields={initialCustomFields}
          orgId={orgId}
        />
      </TabsContent>

      <TabsContent value="relations">
        <DataTablesManager
          tableDefs={initialTableDefs.filter(
            (t) => t.table_type === "one_to_many"
          )}
          contacts={contacts}
          orgId={orgId}
          tableType="one_to_many"
        />
      </TabsContent>

      <TabsContent value="global">
        <DataTablesManager
          tableDefs={initialTableDefs.filter(
            (t) => t.table_type === "global"
          )}
          contacts={contacts}
          orgId={orgId}
          tableType="global"
        />
      </TabsContent>
    </Tabs>
  );
}
