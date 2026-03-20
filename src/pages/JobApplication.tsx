import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, Clock, Briefcase, Upload, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { z } from "zod";

const applicationSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().email("Valid email required").max(255),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  cover_letter: z.string().trim().max(5000).optional().or(z.literal("")),
  portfolio_url: z.string().url("Invalid URL").max(500).optional().or(z.literal("")),
  linkedin_url: z.string().url("Invalid URL").max(500).optional().or(z.literal("")),
  years_of_experience: z.coerce.number().int().min(0).max(50).optional(),
});

interface JobListing {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  type: string | null;
  description: string | null;
  requirements: string | null;
  benefits: string | null;
}

export default function JobApplication() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [job, setJob] = useState<JobListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    cover_letter: "",
    portfolio_url: "",
    linkedin_url: "",
    years_of_experience: "",
  });

  useEffect(() => {
    const fetchJob = async () => {
      if (!jobId) return;
      const { data } = await supabase
        .from("job_listings")
        .select("id, title, department, location, type, description, requirements, benefits")
        .eq("id", jobId)
        .single();
      setJob(data);
      setLoading(false);
    };
    fetchJob();
  }, [jobId]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parsed = applicationSchema.safeParse({
      ...form,
      years_of_experience: form.years_of_experience ? Number(form.years_of_experience) : undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!resumeFile) {
      setErrors({ resume: "Please upload your resume" });
      return;
    }

    setSubmitting(true);
    try {
      // Upload resume
      const ext = resumeFile.name.split(".").pop();
      const filePath = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, resumeFile);

      if (uploadError) throw uploadError;

      const resumeUrl = `resumes/${filePath}`;

      // Submit application
      const { error: insertError } = await supabase.from("job_applications").insert({
        job_listing_id: jobId!,
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        cover_letter: parsed.data.cover_letter || null,
        resume_url: resumeUrl,
        portfolio_url: parsed.data.portfolio_url || null,
        linkedin_url: parsed.data.linkedin_url || null,
        years_of_experience: parsed.data.years_of_experience ?? null,
      });

      if (insertError) throw insertError;

      toast({ title: "Application submitted!", description: "We'll review your application and get back to you." });
      navigate("/careers");
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-32 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-32 text-center text-muted-foreground">
          <p>Job listing not found.</p>
          <Link to="/careers" className="text-primary hover:underline mt-2 inline-block">Back to Careers</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <div className="max-w-2xl mx-auto px-4 pt-28 pb-24">
        <Link to="/careers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          All positions
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Job details */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold mb-3">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
              {job.department && <Badge variant="outline">{job.department}</Badge>}
              {job.location && (
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
              )}
              {job.type && (
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{job.type}</span>
              )}
            </div>
            {job.description && (
              <div className="prose prose-sm prose-invert max-w-none mb-4">
                <h3 className="text-base font-semibold text-foreground">About the Role</h3>
                <p className="text-muted-foreground whitespace-pre-line">{job.description}</p>
              </div>
            )}
            {job.requirements && (
              <div className="mb-4">
                <h3 className="text-base font-semibold mb-2">Requirements</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{job.requirements}</p>
              </div>
            )}
            {job.benefits && (
              <div className="mb-4">
                <h3 className="text-base font-semibold mb-2">Benefits</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{job.benefits}</p>
              </div>
            )}
          </div>

          {/* Application Form */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold mb-6">Apply for this position</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input id="full_name" value={form.full_name} onChange={(e) => handleChange("full_name", e.target.value)} className="mt-1.5" />
                  {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} className="mt-1.5" />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="years_of_experience">Years of Experience</Label>
                  <Input id="years_of_experience" type="number" min={0} max={50} value={form.years_of_experience} onChange={(e) => handleChange("years_of_experience", e.target.value)} className="mt-1.5" />
                </div>
              </div>

              <div>
                <Label htmlFor="resume">Resume (PDF) *</Label>
                <div className="mt-1.5">
                  <label
                    htmlFor="resume"
                    className={`flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 cursor-pointer transition-colors ${
                      resumeFile ? "border-primary/40 bg-primary/5" : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground truncate">
                      {resumeFile ? resumeFile.name : "Upload your resume"}
                    </span>
                  </label>
                  <input
                    id="resume"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && file.size <= 10 * 1024 * 1024) {
                        setResumeFile(file);
                        setErrors((prev) => ({ ...prev, resume: "" }));
                      } else if (file) {
                        setErrors((prev) => ({ ...prev, resume: "File must be under 10MB" }));
                      }
                    }}
                  />
                </div>
                {errors.resume && <p className="text-xs text-destructive mt-1">{errors.resume}</p>}
              </div>

              <div>
                <Label htmlFor="cover_letter">Cover Letter</Label>
                <Textarea
                  id="cover_letter"
                  rows={5}
                  value={form.cover_letter}
                  onChange={(e) => handleChange("cover_letter", e.target.value)}
                  placeholder="Tell us why you're a great fit..."
                  className="mt-1.5"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="portfolio_url">Portfolio URL</Label>
                  <Input id="portfolio_url" placeholder="https://" value={form.portfolio_url} onChange={(e) => handleChange("portfolio_url", e.target.value)} className="mt-1.5" />
                  {errors.portfolio_url && <p className="text-xs text-destructive mt-1">{errors.portfolio_url}</p>}
                </div>
                <div>
                  <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                  <Input id="linkedin_url" placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={(e) => handleChange("linkedin_url", e.target.value)} className="mt-1.5" />
                  {errors.linkedin_url && <p className="text-xs text-destructive mt-1">{errors.linkedin_url}</p>}
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full active:scale-[0.98]">
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : "Submit Application"}
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
