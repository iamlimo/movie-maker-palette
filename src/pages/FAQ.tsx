import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Film,
  Globe2,
  LifeBuoy,
  Mail,
  MessageCircle,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Category = {
  id: string;
  title: string;
  description: string;
  icon: typeof Play;
  questions: { q: string; a: string }[];
};

const categories: Category[] = [
  {
    id: "getting-started", icon: Play, title: "Getting started",
    description: "Everything you need for your first watch.",
    questions: [
      { q: "What is Signature TV?", a: "Signature TV is a premium African film, TV, documentary and original content streaming platform. Rent the stories you love and start watching instantly." },
      { q: "How does Signature TV work?", a: "Create an account, browse our catalogue, choose a title and its rental period, then complete payment. Your title is ready to stream as soon as payment succeeds." },
      { q: "What devices can I use?", a: "Watch on iPhone and Android phones, tablets, laptops, desktops, Smart TVs with a browser, or any compatible device with an internet connection." },
      { q: "Do I need a subscription?", a: "No. Signature TV is rental-based, so you only pay for the films and shows you want to watch." },
    ],
  },
  {
    id: "rentals-payments", icon: CreditCard, title: "Rentals & payments",
    description: "Rental periods, payment methods and access.",
    questions: [
      { q: "What are the rental duration options?", a: "Episode rentals last 72 hours, feature movie rentals last 7 days, and full-season TV rentals last 14 days. Your rental starts immediately after successful payment." },
      { q: "How can I pay?", a: "Pay securely with debit cards, bank transfer, mobile money where available, or the payment channels provided by Paystack and Flutterwave. Payments are currently completed on the website." },
      { q: "Can I watch offline?", a: "Offline download is coming soon. For now, Signature TV titles are available to stream online." },
    ],
  },
  {
    id: "creators", icon: Film, title: "For creators",
    description: "Bring your story to a global audience.",
    questions: [
      { q: "Can I upload my content?", a: "Yes. Filmmakers, production houses and studios can register and submit eligible content for premium rental." },
      { q: "How much do creators earn?", a: "Signature TV offers a 70% revenue share for premium rentals, with performance bonuses for top-performing creators and monthly payout cycles." },
      { q: "What content can I upload?", a: "We welcome films, short films, TV shows, web series, documentaries, comedy, podcasts, music videos, educational and lifestyle content. Content guidelines apply." },
    ],
  },
  {
    id: "troubleshooting", icon: ShieldCheck, title: "Troubleshooting",
    description: "Quick answers when something is not working.",
    questions: [
      { q: "Why is my video not playing?", a: "Check your internet connection, confirm your rental has not expired, refresh your browser and make sure you are not streaming on another device. Contact support if the issue continues." },
      { q: "How many devices can I use?", a: "You can log in on multiple devices, but streaming is limited to one device at a time." },
      { q: "Why can’t I pay inside the app?", a: "Apple restricts external payment systems in iOS apps. Complete your payment securely through the Signature TV website, then sign in to watch in the app." },
    ],
  },
  {
    id: "support", icon: LifeBuoy, title: "Support & more",
    description: "Reach us, reset your account and stay updated.",
    questions: [
      { q: "How do I contact support?", a: "Email support@signaturetv.com, use the in-app help center or start a live chat on the website. Our team is ready to help." },
      { q: "Is Signature TV available globally?", a: "Yes. Anyone with a reliable internet connection can access Signature TV worldwide." },
      { q: "How do I reset my password?", a: "Go to Login, select Forgot Password and enter your email. We will send instructions to your inbox." },
      { q: "Does Signature TV have original content?", a: "Yes. Signature Originals features exclusive African films, series and documentary projects." },
    ],
  },
];

const FAQ = () => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const visibleCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return categories
      .filter((category) => activeCategory === "all" || category.id === activeCategory)
      .map((category) => ({ ...category, questions: category.questions.filter(({ q, a }) => !query || `${q} ${a}`.toLowerCase().includes(query)) }))
      .filter((category) => category.questions.length > 0);
  }, [activeCategory, search]);

  const totalResults = visibleCategories.reduce((sum, category) => sum + category.questions.length, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-12 shadow-premium sm:px-12 lg:py-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,hsl(var(--primary)/.24),transparent_32%),radial-gradient(circle_at_10%_100%,hsl(var(--accent)/.12),transparent_34%)]" />
            <div className="relative max-w-3xl">
              <Badge variant="outline" className="mb-5 border-primary/30 bg-primary/10 px-3 py-1 text-primary"><Sparkles className="mr-2 h-3.5 w-3.5" /> The Signature guide</Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Questions? <span className="text-primary">Press play.</span></h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">Find quick answers about renting, watching and sharing the stories that matter to you.</p>
              <div className="relative mt-8 max-w-2xl">
                <Search className="absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rentals, payments, devices..." aria-label="Search frequently asked questions" className="h-14 rounded-2xl border-border bg-background/80 pl-12 pr-12 text-base shadow-card focus-visible:ring-primary" />
                {search && <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search"><X className="h-5 w-5" /></button>}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{totalResults} {totalResults === 1 ? "answer" : "answers"} to explore</p>
            </div>
          </section>

          <section className="mt-10 grid gap-4 sm:grid-cols-3">
            {[[Clock3, "Flexible rentals", "72 hours to 14 days"], [Globe2, "Watch anywhere", "On all your favourite screens"], [Users, "Built for creators", "Keep 70% of rental revenue"]].map(([Icon, title, text]) => (
              <Card key={title as string} className="group border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-2xl bg-primary/10 p-3 text-primary transition-transform group-hover:rotate-6"><Icon className="h-5 w-5" /></div><div><p className="font-semibold">{title as string}</p><p className="mt-1 text-sm text-muted-foreground">{text as string}</p></div></CardContent></Card>
            ))}
          </section>

          <div className="mt-12 flex flex-col gap-8 lg:flex-row lg:items-start">
            <aside className="lg:sticky lg:top-24 lg:w-64 lg:shrink-0">
              <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Browse topics</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide lg:block lg:space-y-2">
                <button onClick={() => { setActiveCategory("all"); setOpenQuestion(null); }} className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all lg:w-full ${activeCategory === "all" ? "bg-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><BookOpen className="h-4 w-4" /> All questions</button>
                {categories.map(({ id, title, icon: Icon }) => <button key={id} onClick={() => { setActiveCategory(id); setOpenQuestion(null); }} className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all lg:w-full ${activeCategory === id ? "bg-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon className="h-4 w-4" /> {title}</button>)}
              </div>
            </aside>

            <section className="min-w-0 flex-1 space-y-5" aria-live="polite">
              {visibleCategories.length > 0 ? visibleCategories.map((category) => { const Icon = category.icon; return (
                <Card key={category.id} id={category.id} className="overflow-hidden border-border bg-card">
                  <div className="flex items-center gap-4 border-b border-border px-5 py-5 sm:px-7"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div><div><h2 className="text-lg font-semibold sm:text-xl">{category.title}</h2><p className="mt-1 text-sm text-muted-foreground">{category.description}</p></div></div>
                  <div className="divide-y divide-border px-5 sm:px-7">{category.questions.map((faq) => { const id = `${category.id}-${faq.q}`; const isOpen = openQuestion === id; return (
                    <div key={faq.q} className="py-1"><button onClick={() => setOpenQuestion(isOpen ? null : id)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 py-5 text-left font-medium transition-colors hover:text-primary"><span>{faq.q}</span><ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180 text-primary" : ""}`} /></button><div className={`grid transition-[grid-template-rows,opacity] duration-300 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}><div className="min-h-0 overflow-hidden"><p className="pb-5 pr-8 text-sm leading-7 text-muted-foreground">{faq.a}</p></div></div></div>
                  ); })}</div>
                </Card>
              ); }) : <Card className="border-dashed border-border bg-card p-10 text-center"><Search className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-4 text-xl font-semibold">No answers found</h2><p className="mt-2 text-muted-foreground">Try a different search term or browse all topics.</p><Button variant="outline" className="mt-5" onClick={() => { setSearch(""); setActiveCategory("all"); }}>Show all questions</Button></Card>}
            </section>
          </div>

          <section className="relative mt-14 overflow-hidden rounded-3xl border border-primary/20 bg-primary/10 p-7 sm:p-10"><div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"><div><Badge className="mb-3 bg-primary text-primary-foreground"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> We’re here to help</Badge><h2 className="text-2xl font-bold sm:text-3xl">Still looking for an answer?</h2><p className="mt-2 max-w-xl text-muted-foreground">Our support team can help you get back to the story.</p></div><div className="flex flex-wrap gap-3"><Link to="/contact"><Button className="gradient-accent text-primary-foreground shadow-glow">Contact support <ArrowRight className="ml-2 h-4 w-4" /></Button></Link><a href="mailto:support@signaturetv.com"><Button variant="outline" className="border-border bg-background"><Mail className="mr-2 h-4 w-4" /> Email us</Button></a></div></div></section>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground"><MessageCircle className="h-4 w-4 text-primary" /> Average support response: within 24 hours</div>
        </div>
      </main>
    </div>
  );
};

export default FAQ;
