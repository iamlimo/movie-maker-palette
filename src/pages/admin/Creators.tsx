import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Copy,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from "@/components/ui/alert-dialog";
import { useAuthCheck } from "@/hooks/useAuthCheck";

type CreatorProfile = {
  id: string;
  user_id: string | null;
  display_name: string;
  email: string;
  phone_number: string | null;
  company_name: string | null;
  creator_type: string | null;
  status: string | null;
  is_active: boolean | null;
  password_not_set: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type CreatorTokenState = {
  token: string;
  password: string;
};

type CreateCreatorPayload = {
  email: string;
  fullName: string;
  phone: string;
  companyName: string;
  creatorType: string;
};

type CreatorEditPayload = {
  display_name: string;
  email: string;
  phone_number: string;
  company_name: string;
  creator_type: string;
  status: string | null;
};

const ACTIVATE_BASE_URL = "https://signaturetv.co/activate";

function formatActivationLink(token: string) {
  const t = encodeURIComponent(token);
  return `${ACTIVATE_BASE_URL}?token=${t}`;
}

function safeStatus(status: CreatorProfile["status"]) {
  return status || "pending_activation";
}

function statusBadgeVariant(status: string | null) {
  const s = safeStatus(status);
  if (s === "active") return "default";
  if (s === "disabled") return "default";
  if (s === "pending_activation") return "outline";
  return "default";
}


export default function Creators() {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuthCheck();

  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    companyName: "",
    creatorType: "",
  });

  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [activationByCreatorId, setActivationByCreatorId] = useState<
    Record<string, CreatorTokenState>
  >({});

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editTarget, setEditTarget] = useState<CreatorProfile | null>(null);
  const [editForm, setEditForm] = useState<CreatorEditPayload>({
    display_name: "",
    email: "",
    phone_number: "",
    company_name: "",
    creator_type: "",
    status: null,
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CreatorProfile | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

const fetchCreators = async () => {
    setLoading(true);
    try {
      const q = (supabase as unknown as { from: any }).from("creator_profiles").select("*");

      // statusFilter/activeFilter behavior
      // - all: no filter
      // - active: is_active=true OR status=active
      // - disabled: is_active=false OR status=disabled
      // - pending_activation: status=pending_activation
      if (statusFilter !== "all") {
        const sf = statusFilter;
        if (sf === "active") {
          q.or("is_active.eq.true,status.eq.active");
        } else if (sf === "disabled") {
          q.or("is_active.eq.false,status.eq.disabled");
        } else if (sf === "pending_activation") {
          q.eq("status", "pending_activation");
        } else {
          q.eq("status", sf);
        }
      }

      if (searchTerm.trim()) {
        const s = `%${searchTerm.trim()}%`;
        q.or(
          [
            `display_name.ilike.${s}`,
            `email.ilike.${s}`,
            `phone_number.ilike.${s}`,
            `company_name.ilike.${s}`,
          ].join(","),
        );
      }

      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;

      setCreators((data as CreatorProfile[]) ?? []);
    } catch (err: any) {
      toast({
        title: "Failed to load creators",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchCreators();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  useEffect(() => {
    // keep edit form in sync when target changes
    if (!editTarget) return;
    setEditForm({
      display_name: editTarget.display_name ?? "",
      email: editTarget.email ?? "",
      phone_number: editTarget.phone_number ?? "",
      company_name: editTarget.company_name ?? "",
      creator_type: editTarget.creator_type ?? "",
      status: editTarget.status ?? null,
    });
  }, [editTarget]);

  const storedActivation = useMemo(() => {
    return (creatorId: string) => activationByCreatorId[creatorId];
  }, [activationByCreatorId]);

  const canSuperAdmin = isSuperAdmin;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSuperAdmin) return;

    const payload: CreateCreatorPayload = {
      email: createForm.email.trim(),
      fullName: createForm.fullName.trim(),
      phone: createForm.phone.trim(),
      companyName: createForm.companyName.trim(),
      creatorType: createForm.creatorType,
    };

    if (!payload.email || !payload.fullName || !payload.phone || !payload.companyName || !payload.creatorType) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }

    setCreateSubmitting(true);
    try {
      const res = await (supabase as any).functions.invoke(
        "admin-create-creator",
        {
          body: {
            email: payload.email,
            fullName: payload.fullName,
            phone: payload.phone,
            companyName: payload.companyName,
            creatorType: payload.creatorType,
          },
        },
      );

      const data = res?.data ?? res;
      if (!data?.success) {
        throw new Error(data?.error ?? "Failed to create creator");
      }

      const token = data.token as string;
      const creatorProfileId = data.creator_profile_id as string;
      const password = data.password as string;

      setActivationByCreatorId((prev) => ({
        ...prev,
        [creatorProfileId]: { token, password },
      }));

      toast({
        title: "Creator created",
        description: "Activation token generated. You can now activate.",
      });

      setCreateOpen(false);
      setCreateForm({ fullName: "", email: "", phone: "", companyName: "", creatorType: "" });

      await fetchCreators();
    } catch (err: any) {
      toast({
        title: "Failed to create creator",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleActivate = async (creator: CreatorProfile) => {
    const store = storedActivation(creator.id);
    if (!store) return;

    setLoading(true);
    try {
      // Only activate when pending_activation (per requirement)
      if (safeStatus(creator.status) !== "pending_activation") {
        toast({ title: "Not eligible for activation", description: "Creator is not pending activation.", variant: "secondary" });
        return;
      }

      const res = await (supabase as any).functions.invoke(
        "creator-activation",
        {
          body: {
            token: store.token,
            password: store.password,
          },
        },
      );

      const data = res?.data ?? res;
      if (!data?.success) {
        throw new Error(data?.error ?? "Activation failed");
      }

      toast({ title: "Creator activated" });

      // clear stored token
      setActivationByCreatorId((prev) => {
        const next = { ...prev };
        delete next[creator.id];
        return next;
      });

      await fetchCreators();
    } catch (err: any) {
      toast({
        title: "Activation failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (creator: CreatorProfile) => {
    if (!canSuperAdmin) return;
    setEditTarget(creator);
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    setEditSubmitting(true);
    try {
      const payload: CreatorEditPayload = {
        display_name: editForm.display_name.trim(),
        email: editForm.email.trim(),
        phone_number: editForm.phone_number.trim(),
        company_name: editForm.company_name.trim(),
        creator_type: editForm.creator_type.trim(),
        status: editForm.status,
      };

      const { error } = await (supabase as any)
        .from("creator_profiles")
        .update({
          display_name: payload.display_name,
          email: payload.email,
          phone_number: payload.phone_number,
          company_name: payload.company_name,
          creator_type: payload.creator_type,
          status: payload.status,
        })
        .eq("id", editTarget.id);

      if (error) throw error;

      toast({ title: "Creator updated" });
      setEditOpen(false);
      setEditTarget(null);
      await fetchCreators();
    } catch (err: any) {
      toast({
        title: "Failed to update creator",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleActive = async (creator: CreatorProfile, nextEnabled: boolean) => {
    if (!canSuperAdmin) return;

    setLoading(true);
    try {
      const nextStatus = nextEnabled ? "active" : "disabled";
      const { error } = await (supabase as any)
        .from("creator_profiles")
        .update({
          is_active: nextEnabled,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", creator.id);

      if (error) throw error;

      toast({ title: nextEnabled ? "Creator enabled" : "Creator disabled" });
      await fetchCreators();
    } catch (err: any) {
      toast({
        title: "Failed to update status",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const requestDelete = (creator: CreatorProfile) => {
    if (!canSuperAdmin) return;
    setDeleteTarget(creator);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from("creator_profiles")
        .delete()
        .eq("id", deleteTarget.id);

      if (error) throw error;

      // clear activation token state
      setActivationByCreatorId((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });

      toast({ title: "Creator deleted" });
      setDeleteOpen(false);
      setDeleteTarget(null);
      await fetchCreators();
    } catch (err: any) {
      toast({
        title: "Failed to delete creator",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const statusLabel = (creator: CreatorProfile) => {
    const s = safeStatus(creator.status);
    if (s === "active") return "Active";
    if (s === "disabled") return "Disabled";
    if (s === "pending_activation") return "Pending activation";
    return s;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Creators</h1>
          <p className="text-sm text-muted-foreground">Manage creator profiles and activation.</p>
        </div>

        {canSuperAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add a creator
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, email, phone, company"
        />

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending_activation">Pending activation</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Badge variant="outline">{creators.length} creators</Badge>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Creator</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {creators.map((creator) => {
              const activationStore = activationByCreatorId[creator.id];
              const eligibleForActivation =
                safeStatus(creator.status) === "pending_activation" &&
                !!activationStore;

              return (
                <TableRow key={creator.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{creator.display_name}</div>
                      {creator.creator_type && (
                        <Badge variant="secondary">{creator.creator_type}</Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{creator.phone_number ?? "—"}</div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{creator.email}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {creator.user_id ? `Auth linked` : "Not linked"}
                    </div>
                  </TableCell>

                  <TableCell>{creator.company_name ?? "—"}</TableCell>

                  <TableCell>
                    <Badge variant={statusBadgeVariant(creator.status)}>{statusLabel(creator)}</Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {eligibleForActivation && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-2"
                          onClick={() => handleActivate(creator)}
                          disabled={loading}
                        >
                          <Power className="h-4 w-4" />
                          Activate
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant={creator.is_active ? "secondary" : "outline"}
                        className="gap-2"
                        onClick={() => handleToggleActive(creator, true)}
                        disabled={!canSuperAdmin || !!creator.is_active || loading}
                        title="Enable"
                      >
                        <Power className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant={!creator.is_active ? "secondary" : "outline"}
                        className="gap-2"
                        onClick={() => handleToggleActive(creator, false)}
                        disabled={!canSuperAdmin || !creator.is_active || loading}
                        title="Disable"
                      >
                        <PowerOff className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => openEdit(creator)}
                        disabled={!canSuperAdmin || loading}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-2"
                        onClick={() => requestDelete(creator)}
                        disabled={!canSuperAdmin || loading}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {activationStore && safeStatus(creator.status) === "pending_activation" && (
                      <div className="mt-2 flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <Input
                            value={formatActivationLink(activationStore.token)}
                            readOnly
                            className="h-7 w-64 text-xs"
                            onClick={(ev) => {
                              (ev.target as HTMLInputElement).select();
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  formatActivationLink(activationStore.token),
                                );
                                toast({ title: "Activation link copied" });
                              } catch {
                                toast({
                                  title: "Copy failed",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Temp password: <span className="font-mono">{activationStore.password}</span>
                        </div>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {creators.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No creators found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a creator</DialogTitle>
            <DialogDescription>
              Creates a pending creator profile and generates an activation token + password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full name</label>
                <Input
                  value={createForm.fullName}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, fullName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, email: e.target.value }))
                  }
                  type="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={createForm.phone}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Company name</label>
                <Input
                  value={createForm.companyName}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, companyName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Creator type</label>
                <Input
                  value={createForm.creatorType}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, creatorType: e.target.value }))
                  }
                  placeholder="e.g. Individual / Studio / …"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSuperAdmin || createSubmitting}>
                {createSubmitting ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={editOpen} onOpenChange={(v) => {
        setEditOpen(v);
        if (!v) {
          setEditTarget(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit creator</DialogTitle>
            <DialogDescription>Update creator profile fields.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Display name</label>
                <Input
                  value={editForm.display_name}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, display_name: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, email: e.target.value }))
                  }
                  type="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={editForm.phone_number}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, phone_number: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Company</label>
                <Input
                  value={editForm.company_name}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, company_name: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Creator type</label>
                <Input
                  value={editForm.creator_type}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, creator_type: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Input
                  value={editForm.status ?? ""}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      status: e.target.value ? e.target.value : null,
                    }))
                  }
                  placeholder="active | disabled | pending_activation"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSuperAdmin || editSubmitting}>
                {editSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <DialogTitle>Delete creator?</DialogTitle>
            <AlertDialogDescription>
              This will permanently delete the creator profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                disabled={deleteSubmitting}
                onClick={handleDelete}
              >
                {deleteSubmitting ? "Deleting…" : "Delete"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

