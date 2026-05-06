import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Film,
  Sparkles,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

const AboutUs = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 opacity-70 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
              <div
                className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
                aria-hidden="true"
              />
            </div>

            <div className="relative p-6 md:p-10">
              <div className="flex items-center gap-3 mb-4">
                <Badge
                  className="bg-primary/10 text-primary border-primary/20"
                  variant="outline"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  About Us
                </Badge>
              </div>

              <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
                Signature TV — premium entertainment, built for you.
              </h1>
              <p className="mt-4 text-lg md:text-xl text-muted-foreground max-w-2xl text-pretty">
                We bring you a modern streaming experience for African
                stories—designed to be fast, secure, and effortlessly enjoyable
                across your devices.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/contact" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto gradient-accent text-primary-foreground shadow-glow">
                    Contact Our Team
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/help" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto bg-background border-border hover:bg-secondary"
                  >
                    Learn More
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* Core Cards */}
          <section className="mt-10 grid md:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Film className="h-5 w-5 text-primary" />
                  Our Mission
                </CardTitle>
                <CardDescription>
                  Deliver premium movies and TV shows with a seamless rental
                  flow.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Signature TV is focused on great content and great user
                experience—so you can discover, rent, and watch without
                friction.
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Zap className="h-5 w-5 text-primary" />
                  What We Offer
                </CardTitle>
                <CardDescription>
                  Curated entertainment powered by a modern streaming
                  experience.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                From new releases to timeless classics—our catalog is designed
                to keep your next watch one tap away.
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Security First
                </CardTitle>
                <CardDescription>
                  Time-limited access to protect content and enhance
                  reliability.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                We use secure, time-based access patterns to keep your viewing
                protected—without making the experience complicated.
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Users className="h-5 w-5 text-primary" />
                  Built for People
                </CardTitle>
                <CardDescription>
                  A minimal, consistent interface across devices.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Whether you're on mobile or desktop, our UI stays clean and
                responsive so you can focus on what matters: watching.
              </CardContent>
            </Card>
          </section>

          {/* Impact */}
          <section className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
                Our impact, in simple terms
              </h2>
            </div>

            <Separator className="mb-6" />

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <p className="text-3xl font-bold text-foreground">Fast</p>
                  <p className="text-muted-foreground mt-1">
                    Quick browsing & smooth playback
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <p className="text-3xl font-bold text-foreground">Secure</p>
                  <p className="text-muted-foreground mt-1">
                    Protected access for better content safety
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <p className="text-3xl font-bold text-foreground">Clear</p>
                  <p className="text-muted-foreground mt-1">
                    Simple rental & watch experience
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <p className="text-3xl font-bold text-foreground">Reliable</p>
                  <p className="text-muted-foreground mt-1">
                    Designed for everyday viewing
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Closing */}
          <section className="mt-10">
            <Card className="bg-gradient-card border-border">
              <CardHeader>
                <CardTitle className="text-2xl text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Want to work with us?
                </CardTitle>
                <CardDescription className="text-lg">
                  Partnerships, feedback, or support—reach out and we’ll
                  respond.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <p className="text-muted-foreground max-w-xl">
                  If you’re a creator, collaborator, or customer with an idea,
                  we’d love to hear from you.
                </p>
                <div className="flex gap-3">
                  <Link to="/careers">
                    <Button
                      variant="outline"
                      className="bg-background border-border hover:bg-secondary"
                    >
                      Careers
                    </Button>
                  </Link>
                  <Link to="/contact">
                    <Button className="gradient-accent text-primary-foreground shadow-glow">
                      Contact Us
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
};

export default AboutUs;
