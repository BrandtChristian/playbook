"use client";

import { useState } from "react";
import {
  Folder,
  FolderOpen,
  CaretRight,
  CaretDown,
  ImageSquare,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { AssetFolder } from "@/hooks/use-assets";

interface FolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folderId: string | null) => void;
  folders: AssetFolder[];
  title?: string;
  currentFolderId?: string | null;
}

function PickerFolderItem({
  folder,
  selectedId,
  onSelect,
  depth = 0,
}: {
  folder: AssetFolder;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedId === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1.5 px-2 cursor-pointer text-sm transition-colors ${
          isSelected
            ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(folder.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="shrink-0"
          >
            {expanded ? (
              <CaretDown className="h-3 w-3" />
            ) : (
              <CaretRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-3" />
        )}
        {isSelected ? (
          <FolderOpen weight="fill" className="h-4 w-4 shrink-0 text-indigo-500" />
        ) : (
          <Folder className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{folder.name}</span>
      </div>
      {expanded &&
        hasChildren &&
        folder.children!.map((child) => (
          <PickerFolderItem
            key={child.id}
            folder={child}
            selectedId={selectedId}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export function FolderPickerDialog({
  isOpen,
  onClose,
  onSelect,
  folders,
  title = "Move to folder",
  currentFolderId,
}: FolderPickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    currentFolderId ?? null
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="border max-h-[300px] overflow-y-auto py-1">
          {/* Root / no folder */}
          <div
            className={`flex items-center gap-1.5 py-1.5 px-2 cursor-pointer text-sm transition-colors ${
              selectedId === null
                ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
            onClick={() => setSelectedId(null)}
          >
            <ImageSquare
              className="h-4 w-4 shrink-0"
              weight={selectedId === null ? "fill" : "regular"}
            />
            <span>No folder (root)</span>
          </div>
          {folders.map((folder) => (
            <PickerFolderItem
              key={folder.id}
              folder={folder}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onSelect(selectedId);
              onClose();
            }}
          >
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
