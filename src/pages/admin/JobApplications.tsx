import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Mail, ExternalLink, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Application {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cover_letter: string | null;
  resume_url: string | null;
  portfolio_url: string | null;
  linkedin_url: string | null;
  years_of_experience: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  job_listing_id: string;
  job_listings: { title: string } | null;
}

export default function JobApplications() {
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchApplications = async () => {
    const { data } = await supabase
      .from("job_applications")
      .select("*, job_listings(title)")
      .order("created_at", { ascending: false });
    setApplications((data as Application[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchApplications(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : null);
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("job_applications").update({ notes }).eq("id", selected.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Notes saved" });
      setApplications((prev) => prev.map((a) => (a.id === selected.id ? { ...a, notes } : a)));
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Delete resume from storage if exists
    if (deleteTarget.resume_url) {
      const path = deleteTarget.resume_url.replace("resumes/", "");
      await supabase.storage.from("resumes").remove([path]);
    }
    const { error } = await supabase.from("job_applications").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Error deleting", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Application deleted" });
      setApplications((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(null);
    }
    setDeleteTarget(null);
    setDeleting(false);
  };

  const downloadResume = async (resumeUrl: string) => {
    const path = resumeUrl.replace("resumes/", "");
    const { data, error } = await supabase.storage.from("resumes").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Error downloading", description: "Could not generate download link", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const forwardToEmail = (app: Application) => {
    const jobTitle = app.job_listings?.title || "Unknown Position";
    const subject = encodeURIComponent(`New Application: ${app.full_name} — ${jobTitle}`);
    const body = encodeURIComponent(
      `Applicant: ${app.full_name}\nEmail: ${app.email}\nPhone: ${app.phone || "N/A"}\nExperience: ${app.years_of_experience ?? "N/A"} years\nPosition: ${jobTitle}\n\nCover Letter:\n${app.cover_letter || "N/A"}\n\nPortfolio: ${app.portfolio_url || "N/A"}\nLinkedIn: ${app.linkedin_url || "N/A"}`
    );
    window.open(`mailto:careers@signaturepicture.co?subject=${subject}&body=${body}`, "_blank");
  };

  const statusColor = (s: string) => {
    if (s === "new") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (s === "reviewed") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    if (s === "shortlisted") return "bg-green-500/10 text-green-400 border-green-500/20";
    return "bg-red-500/10 text-red-400 border-red-500/20";
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Job Applications</h1>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : applications.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No applications yet.</div>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow
                  key={app.id}
                  className="cursor-pointer"
                  onClick={() => { setSelected(app); setNotes(app.notes || ""); }}
                >
                  <TableCell className="font-medium">{app.full_name}</TableCell>
                  <TableCell>{app.job_listings?.title || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{app.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor(app.status)}>{app.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(app.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {app.resume_url && (
                        <Button variant="ghost" size="icon" onClick={() => downloadResume(app.resume_url!)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => forwardToEmail(app)}>
                        <Mail className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(app)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.full_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Position</span>
                  <span>{selected.job_listings?.title || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <a href={`mailto:${selected.email}`} className="text-primary hover:underline">{selected.email}</a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{selected.phone || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Experience</span>
                  <span>{selected.years_of_experience != null ? `${selected.years_of_experience} years` : "—"}</span>
                </div>
                {selected.portfolio_url && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Portfolio</span>
                    <a href={selected.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {selected.linkedin_url && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">LinkedIn</span>
                    <a href={selected.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {selected.cover_letter && (
                  <div>
                    <p className="text-muted-foreground mb-1">Cover Letter</p>
                    <p className="whitespace-pre-line text-foreground bg-muted/30 rounded-lg p-3">{selected.cover_letter}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Select value={selected.status} onValueChange={(v) => updateStatus(selected.id, v)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="shortlisted">Shortlisted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Admin Notes</Label>
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
                  <Button size="sm" onClick={saveNotes} disabled={saving} className="mt-2">
                    {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}Save Notes
                  </Button>
                </div>

                <div className="flex gap-2 pt-2">
                  {selected.resume_url && (
                    <Button variant="outline" size="sm" onClick={() => downloadResume(selected.resume_url!)}>
                      <Download className="w-4 h-4 mr-1" />Resume
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => forwardToEmail(selected)}>
                    <Mail className="w-4 h-4 mr-1" />Forward
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setSelected(null); setDeleteTarget(selected); }}>
                    <Trash2 className="w-4 h-4 mr-1" />Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete application from {deleteTarget?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this application and its resume. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
