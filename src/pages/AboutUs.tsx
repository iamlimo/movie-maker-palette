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
  Building2,
  Clapperboard,
  Eye,
  Globe,
  Handshake,
  MonitorPlay,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
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
                About Signature TV
              </h1>
              <p className="mt-4 text-lg md:text-xl text-muted-foreground max-w-2xl text-pretty">
                An innovative digital platform under the Signature Pictures
                Network, delivering premium video content to a diverse African
                and global audience.
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
                  <Building2 className="h-5 w-5 text-primary" />
                  Company Overview
                </CardTitle>
                <CardDescription>
                  Empowering creators, entertaining audiences.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Signature TV is an innovative digital platform under the
                Signature Pictures Network, focused on delivering premium video
                content to a diverse African and global audience. This platform
                is built to empower creators, entertain audiences, and reshape
                digital storytelling through technology and community
                engagement.
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Clapperboard className="h-5 w-5 text-primary" />
                  Signature TV
                </CardTitle>
                <CardDescription>
                  Africa's Home of Real Stories, Created by You, For the World.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Signature TV is a pay-per-view (PPV) streaming platform
                designed for high-quality, exclusive video content. It is home
                to original films, documentaries, music shows, reality series,
                and culturally rich narratives that celebrate African voices and
                beyond.
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

          {/* What We Offer */}
          <section className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
                What We Offer
              </h2>
            </div>

            <Separator className="mb-6" />

            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="mt-1 p-2 rounded-lg bg-primary/10">
                    <MonitorPlay className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      Curated, high-quality, on-demand content
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      A handpicked catalog of premium films, shows, and
                      documentaries.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="mt-1 p-2 rounded-lg bg-primary/10">
                    <Eye className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      Pay-per-view model
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Direct creator compensation with every view—no
                      subscriptions required.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="mt-1 p-2 rounded-lg bg-primary/10">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      African stories by African creators
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Authentic narratives that celebrate culture, creativity,
                      and community.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="mt-1 p-2 rounded-lg bg-primary/10">
                    <Rocket className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      Available on web, mobile and smart TV platforms
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Watch anywhere, on any device, with a seamless
                      experience.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Vision & Mission */}
          <section className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
                Vision & Mission
              </h2>
            </div>

            <Separator className="mb-6" />

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Eye className="h-5 w-5 text-primary" />
                    Vision
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  To become the leading digital content platform in Africa by
                  amplifying local voices and empowering creators globally.
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Rocket className="h-5 w-5 text-primary" />
                    Mission
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  To offer accessible, premium, and community-driven
                  entertainment experiences that merge storytelling,
                  technology, and culture.
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Collaboration & Partnerships */}
          <section className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
                Collaboration & Partnerships
              </h2>
            </div>

            <Separator className="mb-6" />

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Handshake className="h-5 w-5 text-primary" />
                  We welcome
                </CardTitle>
                <CardDescription>
                  Brands, creators, and investors shaping the future of African
                  entertainment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">
                        Content partnerships
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Production companies, studios, and creators looking to
                        distribute premium content.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">
                        Sponsorships
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Brands looking to target youth and entertainment
                        audiences.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">
                        Media & advertising integrations
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Strategic placements and co-branded campaigns.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">
                        Investor relations
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Platform growth and expansion opportunities.
                      </p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>
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
                  Partnerships, feedback, or support—reach out and we'll
                  respond.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <p className="text-muted-foreground max-w-xl">
                  If you're a creator, collaborator, or customer with an idea,
                  we'd love to hear from you.
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
