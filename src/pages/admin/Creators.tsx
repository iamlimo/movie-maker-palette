import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { MailCheck, Pencil, Power, PowerOff, Trash2, UserPlus } from "lucide-react";
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
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuthCheck } from "@/hooks/useAuthCheck";

type CreatorProfile = {
  id: string;
  user_id: string | null;
  display_name: string;
  email: string;
  phone_number: string | null;
  company_name: string | null;
  address: string | null;
  creator_type: string | null;
  status: string | null;
  is_active: boolean | null;
  password_not_set: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export const CREATOR_TYPES = [
  { value: "producer", label: "Producer" },
  { value: "director", label: "Director" },
  { value: "studio", label: "Studio" },
  { value: "content_owner", label: "Content Owner" },
  { value: "distributor", label: "Distributor" },
];

const creatorTypeLabel = (value: string | null) =>
  CREATOR_TYPES.find((t) => t.value === value)?.label ?? value ?? "—";

const emptyCreateForm = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  companyName: "",
  address: "",
  creatorType: "",
};

function safeStatus(status: CreatorProfile["status"]) {
  return status || "pending_activation";
}

function statusLabel(status: string | null) {
  const s = safeStatus(status);
  if (s === "active") return "Active";
  if (s === "disabled") return "Disabled";
  if (s === "pending_activation") return "Pending activation";
  return s;
}

function statusBadgeVariant(status: string | null): "default" | "outline" | "secondary" {
  const s = safeStatus(status);
  if (s === "active") return "default";
  if (s === "pending_activation") return "outline";
  return "secondary";
}

export default function Creators() {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuthCheck();
  const canManage = isSuperAdmin;

  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ ...emptyCreateForm });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editTarget, setEditTarget] = useState<CreatorProfile | null>(null);
  const [editForm, setEditForm] = useState({
    display_name: "",
    email: "",
    phone_number: "",
    company_name: "",
    address: "",
    creator_type: "",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CreatorProfile | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchCreators = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = (supabase as any).from("creator_profiles").select("*");

      if (statusFilter !== "all") {
        q.eq("status", statusFilter);
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
    } catch (err) {
      toast({
        title: "Failed to load creators",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchCreators, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    if (!editTarget) return;
    setEditForm({
      display_name: editTarget.display_name ?? "",
      email: editTarget.email ?? "",
      phone_number: editTarget.phone_number ?? "",
      company_name: editTarget.company_name ?? "",
      address: editTarget.address ?? "",
      creator_type: editTarget.creator_type ?? "",
    });
  }, [editTarget]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    const payload = {
      fullName: createForm.fullName.trim(),
      email: createForm.email.trim(),
      password: createForm.password.trim() || undefined,
      phone: createForm.phone.trim(),
      companyName: createForm.companyName.trim(),
      address: createForm.address.trim() || undefined,
      creatorType: createForm.creatorType,
      redirectTo: `${window.location.origin}/reset-password`,
    };

    if (
      !payload.fullName ||
      !payload.email ||
      !payload.phone ||
      !payload.companyName ||
      !payload.creatorType
    ) {
      toast({
        title: "Missing required fields",
        description: "Full name, email, phone, company/studio name and creator type are required.",
        variant: "destructive",
      });
      return;
    }

    if (payload.password && payload.password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    setCreateSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-creator", {
        body: { action: "create", ...payload },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Failed to create creator");

      toast({
        title: "Creator created",
        description: data.emailSent
          ? "A password-reset email was sent. Activate the account when you're ready."
          : `Status: pending activation. Temporary password: ${data.password}`,
      });

      setCreateOpen(false);
      setCreateForm({ ...emptyCreateForm });
      await fetchCreators();
    } catch (err) {
      toast({
        title: "Failed to create creator",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreateSubmitting(false);
    }
  };

  const runCreatorAction = async (
    creator: CreatorProfile,
    action: "activate" | "deactivate" | "send_reset",
  ) => {
    if (!canManage) return;
    setBusyId(creator.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-creator", {
        body: {
          action,
          creatorProfileId: creator.id,
          email: creator.email,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Action failed");

      toast({
        title:
          action === "activate"
            ? "Creator activated"
            : action === "deactivate"
              ? "Creator disabled"
              : "Password reset email sent",
        description:
          action === "activate"
            ? data.emailSent
              ? "They were emailed a link to set their password."
              : "Creator can now sign in to the creator dashboard."
            : undefined,
      });

      await fetchCreators();
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    setEditSubmitting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("creator_profiles")
        .update({
          display_name: editForm.display_name.trim(),
          email: editForm.email.trim(),
          phone_number: editForm.phone_number.trim(),
          company_name: editForm.company_name.trim(),
          address: editForm.address.trim() || null,
          creator_type: editForm.creator_type || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editTarget.id);

      if (error) throw error;

      toast({ title: "Creator updated" });
      setEditOpen(false);
      setEditTarget(null);
      await fetchCreators();
    } catch (err) {
      toast({
        title: "Failed to update creator",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("creator_profiles")
        .delete()
        .eq("id", deleteTarget.id);

      if (error) throw error;

      toast({ title: "Creator deleted" });
      setDeleteOpen(false);
      setDeleteTarget(null);
      await fetchCreators();
    } catch (err) {
      toast({
        title: "Failed to delete creator",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Creators</h1>
          <p className="text-sm text-muted-foreground">
            Create creator accounts, activate them, and map them to content.
          </p>
        </div>

        {canManage && (
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
              <TableHead>Contact</TableHead>
              <TableHead>Company / Studio</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {creators.map((creator) => {
              const isPending = safeStatus(creator.status) === "pending_activation";
              const busy = busyId === creator.id;

              return (
                <TableRow key={creator.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{creator.display_name}</span>
                      <Badge variant="secondary">{creatorTypeLabel(creator.creator_type)}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {creator.address || "No address"}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div>{creator.email}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {creator.phone_number ?? "—"} · {creator.user_id ? "Login ready" : "No login"}
                    </div>
                  </TableCell>

                  <TableCell>{creator.company_name ?? "—"}</TableCell>

                  <TableCell>
                    <Badge variant={statusBadgeVariant(creator.status)}>
                      {statusLabel(creator.status)}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {(isPending || !creator.is_active) && (
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => runCreatorAction(creator, "activate")}
                          disabled={!canManage || busy}
                        >
                          <Power className="h-4 w-4" />
                          Activate
                        </Button>
                      )}

                      {creator.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => runCreatorAction(creator, "deactivate")}
                          disabled={!canManage || busy}
                          title="Disable"
                        >
                          <PowerOff className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => runCreatorAction(creator, "send_reset")}
                        disabled={!canManage || busy}
                        title="Send password reset email"
                      >
                        <MailCheck className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          setEditTarget(creator);
                          setEditOpen(true);
                        }}
                        disabled={!canManage || busy}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-2"
                        onClick={() => {
                          setDeleteTarget(creator);
                          setDeleteOpen(true);
                        }}
                        disabled={!canManage || busy}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add a creator</DialogTitle>
            <DialogDescription>
              Creates the login account in “pending activation”. The creator is emailed a link to set
              their own password, and can sign in to the creator dashboard once you activate them.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full name *</label>
                <Input
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm((p) => ({ ...p, fullName: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email *</label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Default password</label>
                <Input
                  type="text"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Leave empty to auto-generate"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters. The creator is prompted to reset it.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Phone number *</label>
                <Input
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Company / Studio name *</label>
                <Input
                  value={createForm.companyName}
                  onChange={(e) => setCreateForm((p) => ({ ...p, companyName: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Creator type *</label>
                <Select
                  value={createForm.creatorType}
                  onValueChange={(v) => setCreateForm((p) => ({ ...p, creatorType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select creator type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CREATOR_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Address</label>
                <Textarea
                  value={createForm.address}
                  onChange={(e) => setCreateForm((p) => ({ ...p, address: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canManage || createSubmitting}>
                {createSubmitting ? "Creating…" : "Create creator"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditTarget(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit creator</DialogTitle>
            <DialogDescription>Update creator profile details.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full name</label>
                <Input
                  value={editForm.display_name}
                  onChange={(e) => setEditForm((p) => ({ ...p, display_name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Phone number</label>
                <Input
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone_number: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Company / Studio name</label>
                <Input
                  value={editForm.company_name}
                  onChange={(e) => setEditForm((p) => ({ ...p, company_name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Creator type</label>
                <Select
                  value={editForm.creator_type}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, creator_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select creator type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CREATOR_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Address</label>
                <Textarea
                  value={editForm.address}
                  onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete creator?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {deleteTarget?.display_name}'s creator profile and any content mappings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteSubmitting}>
              {deleteSubmitting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
