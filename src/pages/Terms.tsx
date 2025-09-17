import Header from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Shield, AlertTriangle, Scale } from 'lucide-react';

const Terms = () => {
  const lastUpdated = "September 17, 2024";

  const sections = [
    {
      id: "acceptance",
      title: "Acceptance of Terms",
      content: [
        "By accessing and using Signature TV, you accept and agree to be bound by the terms and provision of this agreement.",
        "If you do not agree to abide by the above, please do not use this service.",
        "These terms apply to all visitors, users, and others who access or use the service."
      ]
    },
    {
      id: "service",
      title: "Service Description",
      content: [
        "Signature TV is a premium movie and TV show rental platform that allows users to rent and stream digital content.",
        "We provide access to a curated collection of movies and TV shows for rental periods as specified on each item.",
        "Content availability may vary by region and is subject to licensing agreements.",
        "We reserve the right to modify, suspend, or discontinue any aspect of the service at any time."
      ]
    },
    {
      id: "account",
      title: "User Accounts",
      content: [
        "You must create an account to access certain features of our service.",
        "You are responsible for maintaining the confidentiality of your account credentials.",
        "You are responsible for all activities that occur under your account.",
        "You must provide accurate and complete information when creating your account.",
        "You must be at least 18 years old to create an account."
      ]
    },
    {
      id: "rentals",
      title: "Rental Terms",
      content: [
        "Content rental periods are clearly displayed and begin when you start watching or 24 hours after purchase, whichever comes first.",
        "Rental fees are non-refundable except as required by law or our refund policy.",
        "You may not download, copy, or redistribute rented content.",
        "Access to rented content expires at the end of the rental period.",
        "Technical issues must be reported within the rental period for assistance."
      ]
    },
    {
      id: "payment",
      title: "Payment Terms",
      content: [
        "All payments are processed securely through our payment partners.",
        "Prices are displayed in Nigerian Naira (NGN) and include applicable taxes.",
        "Payment is required before accessing rented content.",
        "We may offer promotional pricing at our discretion.",
        "Refunds are provided only under our refund policy terms."
      ]
    },
    {
      id: "conduct",
      title: "User Conduct",
      content: [
        "You agree not to use the service for any unlawful purpose.",
        "You may not attempt to circumvent content protection measures.",
        "Sharing account credentials is prohibited.",
        "You may not use automated systems to access our service.",
        "Harassment, spam, or abusive behavior is not tolerated."
      ]
    },
    {
      id: "intellectual",
      title: "Intellectual Property",
      content: [
        "All content on Signature TV is protected by copyright and other intellectual property laws.",
        "You may not copy, reproduce, distribute, or create derivative works from our content.",
        "Our trademarks, logos, and service marks are our property.",
        "User-generated content remains your property, but you grant us necessary licenses to operate the service."
      ]
    },
    {
      id: "privacy",
      title: "Privacy",
      content: [
        "Your privacy is important to us. Please review our Privacy Policy.",
        "We collect and use information as described in our Privacy Policy.",
        "We implement appropriate security measures to protect your information.",
        "We do not sell your personal information to third parties."
      ]
    },
    {
      id: "disclaimers",
      title: "Disclaimers",
      content: [
        "The service is provided 'as is' without warranties of any kind.",
        "We do not guarantee uninterrupted or error-free service.",
        "Content availability is subject to licensing restrictions.",
        "We are not liable for any indirect, incidental, or consequential damages.",
        "Our liability is limited to the amount you paid for the specific content."
      ]
    },
    {
      id: "termination",
      title: "Termination",
      content: [
        "We may terminate or suspend your account at any time for violations of these terms.",
        "You may cancel your account at any time.",
        "Upon termination, your right to use the service ceases immediately.",
        "Provisions that should survive termination will remain in effect."
      ]
    },
    {
      id: "changes",
      title: "Changes to Terms",
      content: [
        "We reserve the right to modify these terms at any time.",
        "Changes will be posted on this page with an updated date.",
        "Continued use of the service after changes constitutes acceptance.",
        "Material changes will be communicated via email or service notification."
      ]
    },
    {
      id: "governing",
      title: "Governing Law",
      content: [
        "These terms are governed by the laws of Nigeria.",
        "Any disputes will be resolved in the courts of Lagos State, Nigeria.",
        "If any provision is found unenforceable, the remainder shall remain in effect.",
        "These terms constitute the entire agreement between you and Signature TV."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Hero Section */}
          <section className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <ScrollText className="h-8 w-8 text-primary" />
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Terms of Service
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
              Please read these terms carefully before using our service
            </p>
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
              Last Updated: {lastUpdated}
            </Badge>
          </section>

          {/* Important Notice */}
          <Card className="mb-8 border-primary/20 bg-gradient-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Important Notice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                By using Signature TV, you agree to these Terms of Service. If you do not agree with any part of these terms, 
                you may not use our service. These terms affect your legal rights and obligations, so please read them carefully.
              </p>
            </CardContent>
          </Card>

          {/* Terms Sections */}
          <div className="space-y-6">
            {sections.map((section, index) => (
              <Card key={section.id} className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {section.content.map((item, itemIndex) => (
                      <li key={itemIndex} className="text-muted-foreground leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Contact Information */}
          <Card className="mt-12 bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Scale className="h-5 w-5 text-primary" />
                Legal Contact
              </CardTitle>
              <CardDescription>
                Questions about these terms or legal matters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Legal Department</h4>
                  <p className="text-sm text-muted-foreground">
                    Signature TV Legal<br />
                    123 Entertainment District<br />
                    Victoria Island, Lagos, Nigeria
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Contact Information</h4>
                  <p className="text-sm text-muted-foreground">
                    Email: legal@signaturetv.com<br />
                    Phone: +234 (0) 1 234 5678<br />
                    Business Hours: Monday - Friday, 9:00 AM - 6:00 PM WAT
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related Documents */}
          <div className="mt-12 text-center">
            <h3 className="text-xl font-semibold mb-4 text-foreground">Related Documents</h3>
            <div className="flex justify-center gap-4">
              <Badge 
                variant="outline" 
                className="bg-background border-border hover:bg-secondary cursor-pointer p-2"
              >
                <Shield className="h-4 w-4 mr-1" />
                Privacy Policy
              </Badge>
              <Badge 
                variant="outline" 
                className="bg-background border-border hover:bg-secondary cursor-pointer p-2"
              >
                Cookie Policy
              </Badge>
              <Badge 
                variant="outline" 
                className="bg-background border-border hover:bg-secondary cursor-pointer p-2"
              >
                Refund Policy
              </Badge>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Terms;