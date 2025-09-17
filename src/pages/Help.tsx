import Header from '@/components/Header';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, MessageCircle, Book, Video, CreditCard, Shield, Clock, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const Help = () => {
  const helpTopics = [
    {
      icon: Video,
      title: 'Getting Started',
      description: 'Learn the basics of using Signature TV',
      articles: 8
    },
    {
      icon: CreditCard,
      title: 'Payments & Billing',
      description: 'Understanding rentals, payments, and refunds',
      articles: 12
    },
    {
      icon: Shield,
      title: 'Account & Security',
      description: 'Manage your account and privacy settings',
      articles: 6
    },
    {
      icon: Clock,
      title: 'Streaming Issues',
      description: 'Troubleshoot playback and technical problems',
      articles: 10
    }
  ];

  const faqs = [
    {
      question: "How do I rent a movie or TV show?",
      answer: "Browse our collection, select the content you want to watch, and click 'Rent Now'. Complete the payment process and you'll have access to stream the content for the rental period."
    },
    {
      question: "How long do I have access to rented content?",
      answer: "Rental periods vary by content but typically range from 24-72 hours. The exact rental duration is displayed on each item's page before you complete your purchase."
    },
    {
      question: "Can I watch rented content offline?",
      answer: "Currently, all content must be streamed online. We're working on adding offline viewing capabilities for future updates."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept major credit cards, debit cards, and digital wallets through our secure payment processor Paystack. All transactions are encrypted and secure."
    },
    {
      question: "Can I get a refund if I'm not satisfied?",
      answer: "Refunds are available within 24 hours of purchase if you haven't started watching the content. Contact our support team for assistance with refund requests."
    },
    {
      question: "Is my account information secure?",
      answer: "Yes, we use industry-standard encryption and security measures to protect your personal information and payment details. We never store payment information on our servers."
    },
    {
      question: "How can I add content to my watchlist?",
      answer: "Click the heart icon on any movie or TV show card to add it to your watchlist. You can view and manage your watchlist from the navigation menu."
    },
    {
      question: "What should I do if content won't play?",
      answer: "First, check your internet connection. If the issue persists, try refreshing your browser or clearing your cache. Contact support if problems continue."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <section className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <HelpCircle className="h-8 w-8 text-primary" />
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Help Center
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Find answers to common questions and get support for your Signature TV experience
            </p>
          </section>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  Contact Support
                </CardTitle>
                <CardDescription>
                  Get personalized help from our support team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/contact">
                  <Button className="w-full gradient-accent text-primary-foreground shadow-glow">
                    Get Help Now
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Users className="h-5 w-5 text-primary" />
                  Community Forum
                </CardTitle>
                <CardDescription>
                  Connect with other users and share tips
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full bg-background border-border hover:bg-secondary">
                  Join Community
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Help Topics */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-foreground">Popular Help Topics</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {helpTopics.map((topic, index) => (
                <Card key={index} className="bg-card border-border hover:shadow-card transition-smooth cursor-pointer">
                  <CardHeader>
                    <topic.icon className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-lg text-foreground">{topic.title}</CardTitle>
                    <CardDescription>{topic.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                      {topic.articles} articles
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* FAQ Section */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Book className="h-6 w-6 text-primary" />
              <h2 className="text-3xl font-bold text-foreground">Frequently Asked Questions</h2>
            </div>
            
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="bg-card border border-border rounded-lg px-6"
                >
                  <AccordionTrigger className="text-foreground hover:text-primary transition-smooth">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          {/* Still Need Help */}
          <section className="mt-12 text-center">
            <Card className="bg-gradient-card border-border">
              <CardHeader>
                <CardTitle className="text-2xl text-foreground">Still need help?</CardTitle>
                <CardDescription className="text-lg">
                  Our support team is here to assist you with any questions or issues
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-4 justify-center">
                <Link to="/contact">
                  <Button className="gradient-accent text-primary-foreground shadow-glow">
                    Contact Support
                  </Button>
                </Link>
                <Button variant="outline" className="bg-background border-border hover:bg-secondary">
                  Browse All Articles
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Help;