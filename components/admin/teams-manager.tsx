"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CircleNotch, Plus, Trash, UsersThree, PencilSimple,
} from "@phosphor-icons/react";

type TargetGroup = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type Team = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  target_groups: TargetGroup[];
  user_count: number;
};

type Member = {
  id: string;
  full_name: string | null;
  role: string;
};

export function TeamsManager({ members }: { members: Member[] }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [targetGroups, setTargetGroups] = useState<TargetGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTgIds, setFormTgIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // User assignment state
  const [assigningTeam, setAssigningTeam] = useState<Team | null>(null);
  const [teamUserIds, setTeamUserIds] = useState<Set<string>>(new Set());
  const [savingUsers, setSavingUsers] = useState(false);

  const fetchTeams = useCallback(async () => {
    const res = await fetch("/api/admin/teams");
    const json = await res.json();
    if (res.ok) setTeams(json.teams ?? []);
    setLoading(false);
  }, []);

  const fetchTargetGroups = useCallback(async () => {
    const res = await fetch("/api/agillic/target-groups");
    const json = await res.json();
    if (res.ok) setTargetGroups(json.targetGroups ?? []);
  }, []);

  useEffect(() => {
    fetchTeams();
    fetchTargetGroups();
  }, [fetchTeams, fetchTargetGroups]);

  function openCreate() {
    setEditingTeam(null);
    setFormName("");
    setFormDesc("");
    setFormTgIds(new Set());
    setShowForm(true);
  }

  function openEdit(team: Team) {
    setEditingTeam(team);
    setFormName(team.name);
    setFormDesc(team.description ?? "");
    setFormTgIds(new Set(team.target_groups.map((tg) => tg.id)));
    setShowForm(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);

    const body = {
      name: formName.trim(),
      description: formDesc.trim() || null,
      targetGroupIds: Array.from(formTgIds),
      isActive: true,
    };

    const url = editingTeam
      ? `/api/admin/teams/${editingTeam.id}`
      : "/api/admin/teams";
    const method = editingTeam ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (res.ok) {
      toast.success(editingTeam ? "Team updated" : "Team created");
      setShowForm(false);
      fetchTeams();
    } else {
      const json = await res.json();
      toast.error(json.error || "Failed to save team");
    }
  }

  async function handleDelete(teamId: string) {
    const res = await fetch(`/api/admin/teams/${teamId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Team deleted");
      fetchTeams();
    } else {
      toast.error("Failed to delete team");
    }
  }

  async function openUserAssignment(team: Team) {
    setAssigningTeam(team);
    // Fetch current team users
    const res = await fetch(`/api/admin/teams/${team.id}/users`);
    const json = await res.json();
    const ids = (json.users ?? []).map((u: { id: string }) => u.id);
    setTeamUserIds(new Set(ids));
  }

  async function handleSaveUsers() {
    if (!assigningTeam) return;
    setSavingUsers(true);

    const res = await fetch(`/api/admin/teams/${assigningTeam.id}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: Array.from(teamUserIds) }),
    });

    setSavingUsers(false);
    if (res.ok) {
      toast.success("Team members updated");
      setAssigningTeam(null);
      fetchTeams();
    } else {
      toast.error("Failed to update team members");
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <CircleNotch className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UsersThree className="h-5 w-5" weight="duotone" />
                Teams
              </CardTitle>
              <CardDescription>
                Organize users into teams and control which target groups they can access.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 h-3 w-3" />Add Team
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No teams yet. Create one to control target group access.
            </p>
          ) : (
            <div className="space-y-2">
              {teams.map((team) => (
                <div key={team.id} className="flex items-center justify-between p-3 border">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{team.name}</p>
                    {team.description && (
                      <p className="text-xs text-muted-foreground truncate">{team.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {team.target_groups.length} target group{team.target_groups.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {team.user_count} member{team.user_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={team.is_active ? "default" : "outline"}>
                      {team.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openUserAssignment(team)}>
                      <UsersThree className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(team)}>
                      <PencilSimple className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(team.id)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Team Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTeam ? "Edit Team" : "Create Team"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Marketing" />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Optional description" />
            </div>
            <div className="grid gap-2">
              <Label>Target Groups</Label>
              <div className="max-h-48 overflow-y-auto border p-2 space-y-1">
                {targetGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No target groups synced yet. Sync from settings first.</p>
                ) : (
                  targetGroups.map((tg) => (
                    <label key={tg.id} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                      <Checkbox
                        checked={formTgIds.has(tg.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(formTgIds);
                          if (checked) next.add(tg.id); else next.delete(tg.id);
                          setFormTgIds(next);
                        }}
                      />
                      <span>{tg.name}</span>
                      {tg.description && <span className="text-xs text-muted-foreground">— {tg.description}</span>}
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">{formTgIds.size} selected</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? "Saving..." : editingTeam ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Users Dialog */}
      <Dialog open={!!assigningTeam} onOpenChange={(v) => { if (!v) setAssigningTeam(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Members — {assigningTeam?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto border p-2 space-y-1">
            {members.filter((m) => m.role === "member").length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No members to assign. Teams only apply to members (not admins/owners).</p>
            ) : (
              members.filter((m) => m.role === "member").map((member) => (
                <label key={member.id} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                  <Checkbox
                    checked={teamUserIds.has(member.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(teamUserIds);
                      if (checked) next.add(member.id); else next.delete(member.id);
                      setTeamUserIds(next);
                    }}
                  />
                  <span>{member.full_name || "Unnamed"}</span>
                  <Badge variant="outline" className="text-[10px]">{member.role}</Badge>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningTeam(null)}>Cancel</Button>
            <Button onClick={handleSaveUsers} disabled={savingUsers}>
              {savingUsers ? "Saving..." : "Save Members"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
