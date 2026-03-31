import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Briefcase, Users, Heart, Zap, Globe, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface JobListing {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  type: string | null;
  description: string | null;
  created_at: string;
}

const cultureCards = [
  {
    icon: Zap,
    title: "Innovation First",
    description: "We push boundaries in African entertainment, using cutting-edge technology to deliver world-class streaming experiences.",
  },
  {
    icon: Users,
    title: "Collaborative Spirit",
    description: "Every voice matters. We build together — from engineers to creatives — shaping the future of storytelling.",
  },
  {
    icon: Heart,
    title: "Passion for Content",
    description: "We live and breathe film. Our team is united by a deep love for African stories and global cinema.",
  },
  {
    icon: Globe,
    title: "Global Reach",
    description: "Based in Africa, serving the world. Join a team that's bringing diverse narratives to a global audience.",
  },
];

export default function Careers() {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      const { data } = await supabase
        .from("job_listings")
        .select("id, title, department, location, type, description, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      setJobs(data || []);
      setLoading(false);
    };
    fetchJobs();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-3xl mx-auto text-center"
        >
          <Badge variant="outline" className="mb-6 border-primary/30 text-primary">
            We're Hiring
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
            Build the Future of African Entertainment
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto text-pretty">
            Signature TV is redefining how stories are told and experienced across Africa. Join our team and help shape what comes next.
          </p>
        </motion.div>
      </section>

      {/* Culture */}
      <section className="px-4 pb-24">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-2xl font-semibold text-center mb-12"
          >
            Why Signature TV?
          </motion.h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {cultureCards.map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="group rounded-xl border border-border bg-card p-6 transition-shadow duration-300 hover:shadow-[var(--shadow-card)]"
              >
                <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                  <card.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold mb-2">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Job Listings */}
      <section className="px-4 pb-32">
        <div className="max-w-3xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-2xl font-semibold text-center mb-2"
          >
            Open Positions
          </motion.h2>
          <p className="text-center text-muted-foreground mb-10">
            Find the role that fits you.
          </p>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-card animate-pulse" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="w-10 h-10 mx-auto mb-4 opacity-40" />
              <p className="font-medium">No open positions right now</p>
              <p className="text-sm mt-1">Check back soon — we're always growing.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                  whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    to={`/careers/apply/${job.id}`}
                    className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-[var(--shadow-card)] active:scale-[0.98]"
                  >
                    <div className="min-w-0">
                      <h3 className="font-semibold mb-1.5 group-hover:text-primary transition-colors">{job.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        {job.department && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5" />
                            {job.department}
                          </span>
                        )}
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {job.location}
                          </span>
                        )}
                        {job.type && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {job.type}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-4" />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
