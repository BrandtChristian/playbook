"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Crown,
  ShieldCheck,
  User,
  Trash,
  CircleNotch,
  UsersThree,
  EnvelopeSimple,
  FunnelSimple,
} from "@phosphor-icons/react";

type Member = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "owner" | "admin" | "member";
  created_at: string;
};

type Segment = {
  id: string;
  name: string;
  contact_count: number;
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function roleBadge(role: string) {
  switch (role) {
    case "owner":
      return (
        <Badge className="gap-1">
          <Crown className="h-3 w-3" weight="fill" />
          Owner
        </Badge>
      );
    case "admin":
      return (
        <Badge variant="secondary" className="gap-1">
          <ShieldCheck className="h-3 w-3" weight="fill" />
          Admin
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          <User className="h-3 w-3" />
          Member
        </Badge>
      );
  }
}

export function TeamMembers({
  members: initialMembers,
  currentUserId,
  currentUserRole,
  orgId,
  hasResendKey,
  segments = [],
}: {
  members: Member[];
  currentUserId: string;
  currentUserRole: "owner" | "admin" | "member";
  orgId: string;
  hasResendKey: boolean;
  segments?: Segment[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessMemberId, setAccessMemberId] = useState<string | null>(null);
  const [accessMemberName, setAccessMemberName] = useState<string>("");
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [unrestricted, setUnrestricted] = useState(true);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const isOwner = currentUserRole === "owner";
  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

  async function handleInvite() {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }

    setInviting(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to send invitation");
        return;
      }

      toast.success(`Invited ${inviteEmail.trim()} as ${inviteRole}`);
      setInviteEmail("");
      setInviteRole("member");
      setDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", memberId);

    if (error) {
      toast.error("Failed to update role");
      return;
    }

    setMembers(
      members.map((m) =>
        m.id === memberId ? { ...m, role: newRole as Member["role"] } : m
      )
    );
    toast.success("Role updated");
  }

  async function handleRemove(memberId: string, memberName: string | null) {
    if (
      !confirm(
        `Remove ${memberName || "this member"} from the organization? This will delete their account.`
      )
    ) {
      return;
    }

    setRemovingId(memberId);
    try {
      const res = await fetch("/api/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to remove member");
        return;
      }

      setMembers(members.filter((m) => m.id !== memberId));
      toast.success("Member removed");
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleResendInvite(memberId: string) {
    setResendingId(memberId);
    try {
      const res = await fetch("/api/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to resend invite");
        return;
      }

      toast.success("Invite email resent");
    } catch {
      toast.error("Failed to resend invite");
    } finally {
      setResendingId(null);
    }
  }

  async function openAccessDialog(memberId: string, memberName: string | null) {
    setAccessMemberId(memberId);
    setAccessMemberName(memberName || "this member");
    setAccessDialogOpen(true);
    setAccessLoading(true);

    try {
      const res = await fetch(`/api/segment-access?userId=${memberId}`);
      const data = await res.json();

      if (res.ok) {
        setUnrestricted(!data.restricted);
        setSelectedSegmentIds(new Set(data.segmentIds));
      }
    } catch {
      toast.error("Failed to load access settings");
    } finally {
      setAccessLoading(false);
    }
  }

  async function handleSaveAccess() {
    if (!accessMemberId) return;

    setAccessSaving(true);
    try {
      const res = await fetch("/api/segment-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: accessMemberId,
          segmentIds: unrestricted ? [] : Array.from(selectedSegmentIds),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to save access settings");
        return;
      }

      toast.success(
        unrestricted
          ? "Access set to unrestricted"
          : `Restricted to ${selectedSegmentIds.size} segment${selectedSegmentIds.size !== 1 ? "s" : ""}`
      );
      setAccessDialogOpen(false);
    } catch {
      toast.error("Failed to save access settings");
    } finally {
      setAccessSaving(false);
    }
  }

  function toggleSegment(segmentId: string) {
    setSelectedSegmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) {
        next.delete(segmentId);
      } else {
        next.add(segmentId);
      }
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersThree className="h-5 w-5 text-primary" weight="duotone" />
            <CardTitle>Team</CardTitle>
          </div>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <UserPlus className="mr-1 h-3 w-3" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite team member</DialogTitle>
                  <DialogDescription>
                    {hasResendKey
                      ? "They'll receive an email with a link to join your organization."
                      : "The user will be added to your organization. Configure Resend to send invite emails."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Email address</Label>
                    <Input
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">
                          Member — can create and edit content
                        </SelectItem>
                        <SelectItem value="admin">
                          Admin — full access including deletion
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    disabled={inviting || !inviteEmail.trim()}
                    onClick={handleInvite}
                  >
                    {inviting ? (
                      <>
                        <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                        Inviting...
                      </>
                    ) : (
                      "Send invite"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <CardDescription>
          Manage your organization members and roles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 border"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(member.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {member.full_name || "Unnamed"}
                    {member.id === currentUserId && (
                      <span className="text-muted-foreground ml-1">(you)</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOwner &&
                member.id !== currentUserId &&
                member.role !== "owner" ? (
                  <>
                    <Select
                      value={member.role}
                      onValueChange={(val) =>
                        handleRoleChange(member.id, val)
                      }
                    >
                      <SelectTrigger className="w-[120px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    {member.role === "member" && segments.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() =>
                          openAccessDialog(member.id, member.full_name)
                        }
                        title="Manage segment access"
                      >
                        <FunnelSimple className="h-4 w-4" />
                      </Button>
                    )}
                    {hasResendKey && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        disabled={resendingId === member.id}
                        onClick={() => handleResendInvite(member.id)}
                        title="Resend invite email"
                      >
                        {resendingId === member.id ? (
                          <CircleNotch className="h-4 w-4 animate-spin" />
                        ) : (
                          <EnvelopeSimple className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      disabled={removingId === member.id}
                      onClick={() =>
                        handleRemove(member.id, member.full_name)
                      }
                    >
                      {removingId === member.id ? (
                        <CircleNotch className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                ) : (
                  roleBadge(member.role)
                )}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No team members yet.
            </p>
          )}
        </div>
      </CardContent>

      {/* Segment Access Dialog */}
      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Segment access</DialogTitle>
            <DialogDescription>
              Control which segments {accessMemberName} can view and use.
            </DialogDescription>
          </DialogHeader>
          {accessLoading ? (
            <div className="flex items-center justify-center py-8">
              <CircleNotch className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4">
              <label className="flex items-center gap-3 p-3 border cursor-pointer">
                <Checkbox
                  checked={unrestricted}
                  onCheckedChange={(checked) => {
                    setUnrestricted(!!checked);
                    if (checked) {
                      setSelectedSegmentIds(new Set());
                    }
                  }}
                />
                <div>
                  <p className="text-sm font-medium">Unrestricted access</p>
                  <p className="text-xs text-muted-foreground">
                    Can view and use all segments
                  </p>
                </div>
              </label>

              {!unrestricted && (
                <div className="grid gap-2 max-h-[240px] overflow-y-auto">
                  {segments.map((segment) => (
                    <label
                      key={segment.id}
                      className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedSegmentIds.has(segment.id)}
                        onCheckedChange={() => toggleSegment(segment.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{segment.name}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {segment.contact_count} contacts
                      </span>
                    </label>
                  ))}
                  {segments.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No segments created yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              disabled={accessSaving || accessLoading || (!unrestricted && selectedSegmentIds.size === 0)}
              onClick={handleSaveAccess}
            >
              {accessSaving ? (
                <>
                  <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
