"use client";

import { useState } from "react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  CaretRight,
  CaretDown,
  DotsThree,
  Pencil,
  Trash,
  ImageSquare,
} from "@phosphor-icons/react";
import { useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AssetFolder } from "@/hooks/use-assets";

interface AssetFolderNavigationProps {
  folders: AssetFolder[];
  currentFolderId: string | null;
  onFolderChange: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  isAdmin: boolean;
  isDropTarget?: boolean;
}

function FolderTreeItem({
  folder,
  currentFolderId,
  onFolderChange,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  isAdmin,
  isDropTarget = false,
  depth = 0,
}: {
  folder: AssetFolder;
  currentFolderId: string | null;
  onFolderChange: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  isAdmin: boolean;
  isDropTarget?: boolean;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [subfoldersOpen, setSubfoldersOpen] = useState(false);
  const [subfolderName, setSubfolderName] = useState("");

  const { setNodeRef, isOver } = useDroppable({
    id: folder.id,
    disabled: !isDropTarget,
  });

  const isActive = currentFolderId === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;

  return (
    <div>
      <div
        ref={setNodeRef}
        className={`group flex items-center gap-1 py-1 px-2 cursor-pointer text-sm transition-colors ${
          isOver
            ? "bg-indigo-100 dark:bg-indigo-950/40 ring-1 ring-indigo-400 ring-inset"
            : isActive
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onFolderChange(folder.id)}
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
        {isActive ? (
          <FolderOpen weight="fill" className="h-4 w-4 shrink-0 text-indigo-500" />
        ) : (
          <Folder className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate flex-1">{folder.name}</span>
        {typeof folder.asset_count === "number" && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {folder.asset_count}
          </span>
        )}
        {isAdmin && !folder.is_system && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-accent"
              >
                <DotsThree className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setSubfoldersOpen(true);
                }}
              >
                <FolderPlus className="h-3.5 w-3.5 mr-2" />
                New subfolder
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setNewName(folder.name);
                  setRenameOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(folder.id);
                }}
              >
                <Trash className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {expanded &&
        hasChildren &&
        folder.children!.map((child) => (
          <FolderTreeItem
            key={child.id}
            folder={child}
            currentFolderId={currentFolderId}
            onFolderChange={onFolderChange}
            onCreateFolder={onCreateFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            isAdmin={isAdmin}
            isDropTarget={isDropTarget}
            depth={depth + 1}
          />
        ))}

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRenameFolder(folder.id, newName);
                setRenameOpen(false);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onRenameFolder(folder.id, newName);
                setRenameOpen(false);
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New subfolder dialog */}
      <Dialog open={subfoldersOpen} onOpenChange={setSubfoldersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New subfolder in {folder.name}</DialogTitle>
          </DialogHeader>
          <Input
            value={subfolderName}
            onChange={(e) => setSubfolderName(e.target.value)}
            placeholder="Subfolder name"
            onKeyDown={(e) => {
              if (e.key === "Enter" && subfolderName.trim()) {
                onCreateFolder(subfolderName, folder.id);
                setSubfolderName("");
                setSubfoldersOpen(false);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubfoldersOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (subfolderName.trim()) {
                  onCreateFolder(subfolderName, folder.id);
                  setSubfolderName("");
                  setSubfoldersOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AssetFolderNavigation({
  folders,
  currentFolderId,
  onFolderChange,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  isAdmin,
  isDropTarget = false,
}: AssetFolderNavigationProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [folderName, setFolderName] = useState("");

  const { setNodeRef: setRootRef, isOver: isRootOver } = useDroppable({
    id: "root-drop",
    disabled: !isDropTarget,
  });

  return (
    <div className="w-full">
      {/* All Assets */}
      <div
        ref={setRootRef}
        className={`flex items-center gap-1.5 py-1.5 px-2 cursor-pointer text-sm transition-colors ${
          isRootOver
            ? "bg-indigo-100 dark:bg-indigo-950/40 ring-1 ring-indigo-400 ring-inset"
            : currentFolderId === null
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        }`}
        onClick={() => onFolderChange(null)}
      >
        <ImageSquare className="h-4 w-4 shrink-0" weight={currentFolderId === null ? "fill" : "regular"} />
        <span>All assets</span>
      </div>

      {/* Folder tree */}
      {folders.map((folder) => (
        <FolderTreeItem
          key={folder.id}
          folder={folder}
          currentFolderId={currentFolderId}
          onFolderChange={onFolderChange}
          onCreateFolder={onCreateFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          isAdmin={isAdmin}
          isDropTarget={isDropTarget}
        />
      ))}

      {/* Create folder button */}
      {isAdmin && (
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 py-1.5 px-2 text-sm text-muted-foreground hover:text-foreground w-full transition-colors"
        >
          <FolderPlus className="h-4 w-4" />
          <span>New folder</span>
        </button>
      )}

      {/* Create folder dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
          </DialogHeader>
          <Input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => {
              if (e.key === "Enter" && folderName.trim()) {
                onCreateFolder(folderName);
                setFolderName("");
                setCreateOpen(false);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (folderName.trim()) {
                  onCreateFolder(folderName);
                  setFolderName("");
                  setCreateOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
