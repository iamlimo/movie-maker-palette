import { useState, useEffect } from "react";
import { Check, X, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Submission {
  id: string;
  title: string;
  description?: string;
  type: 'movie' | 'tv_show';
  status: 'pending' | 'approved' | 'rejected' | 'under_review';
  file_url?: string;
  producer_id: string;
  submitted_at: string;
  reviewed_at?: string;
  review_notes?: string;
  reviewer_id?: string;
}

const Submissions = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch submissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmission = async (submissionId: string, action: 'approve' | 'reject') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updateData = {
        status: action === 'approve' ? 'approved' as const : 'rejected' as const,
        reviewed_at: new Date().toISOString(),
        reviewer_id: user.id,
        review_notes: reviewNotes || null
      };

      const { error } = await supabase
        .from('submissions')
        .update(updateData)
        .eq('id', submissionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Submission ${action === 'approve' ? 'approved' : 'rejected'}`,
      });

      setReviewNotes("");
      setSelectedSubmission(null);
      fetchSubmissions();
    } catch (error) {
      console.error('Error reviewing submission:', error);
      toast({
        title: "Error",
        description: "Failed to review submission",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: "bg-green-500 text-white",
      rejected: "bg-red-500 text-white",
      pending: "bg-yellow-500 text-white",
      under_review: "bg-blue-500 text-white"
    };
    return (
      <Badge className={variants[status as keyof typeof variants] || "bg-gray-500 text-white"}>
        {status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const variants = {
      movie: "bg-blue-500 text-white",
      tv_show: "bg-purple-500 text-white"
    };
    return (
      <Badge className={variants[type as keyof typeof variants] || "bg-gray-500 text-white"}>
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Content Submissions</h1>
          <p className="text-muted-foreground">Review and approve producer submissions</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Producer</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{submission.title}</div>
                      {submission.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {submission.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getTypeBadge(submission.type)}</TableCell>
                  <TableCell>{getStatusBadge(submission.status)}</TableCell>
                  <TableCell>
                    {new Date(submission.submitted_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">Producer ID: {submission.producer_id.slice(0, 8)}...</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{submission.title}</DialogTitle>
                            <DialogDescription>
                              Submission Details
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Description</Label>
                              <p className="text-sm text-muted-foreground">
                                {submission.description || 'No description provided'}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Type</Label>
                                <p className="text-sm">{submission.type.replace('_', ' ')}</p>
                              </div>
                              <div>
                                <Label>Status</Label>
                                <p className="text-sm">{submission.status}</p>
                              </div>
                            </div>
                            {submission.file_url && (
                              <div>
                                <Label>File</Label>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  <a 
                                    href={submission.file_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline text-sm"
                                  >
                                    View File
                                  </a>
                                </div>
                              </div>
                            )}
                            {submission.review_notes && (
                              <div>
                                <Label>Review Notes</Label>
                                <p className="text-sm text-muted-foreground">
                                  {submission.review_notes}
                                </p>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>

                      {submission.status === 'pending' && (
                        <>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedSubmission(submission)}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Approve Submission</DialogTitle>
                                <DialogDescription>
                                  Approve "{submission.title}" and add it to the platform?
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="notes">Review Notes (Optional)</Label>
                                  <Textarea
                                    id="notes"
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                    placeholder="Add any notes about the approval..."
                                    rows={3}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                                  Cancel
                                </Button>
                                <Button 
                                  onClick={() => handleReviewSubmission(submission.id, 'approve')}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Approve
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedSubmission(submission)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Reject Submission</DialogTitle>
                                <DialogDescription>
                                  Reject "{submission.title}" and provide feedback to the producer.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="notes">Rejection Reason *</Label>
                                  <Textarea
                                    id="notes"
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                    placeholder="Explain why this submission is being rejected..."
                                    rows={3}
                                    required
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                                  Cancel
                                </Button>
                                <Button 
                                  onClick={() => handleReviewSubmission(submission.id, 'reject')}
                                  className="bg-red-600 hover:bg-red-700"
                                  disabled={!reviewNotes.trim()}
                                >
                                  Reject
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {submissions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No submissions found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Submissions;