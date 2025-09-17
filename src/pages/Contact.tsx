import { useState } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, MessageCircle, Clock, MapPin, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    setTimeout(() => {
      toast({
        title: "Message sent successfully!",
        description: "We'll get back to you within 24 hours."
      });
      setFormData({ name: '', email: '', subject: '', category: '', message: '' });
      setIsSubmitting(false);
    }, 1000);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const contactInfo = [
    {
      icon: Mail,
      title: 'Email Support',
      description: 'Send us an email anytime',
      value: 'support@signaturetv.com',
      action: 'mailto:support@signaturetv.com'
    },
    {
      icon: Phone,
      title: 'Phone Support',
      description: 'Call us during business hours',
      value: '+234 (0) 1 234 5678',
      action: 'tel:+2341234567'
    },
    {
      icon: MessageCircle,
      title: 'Live Chat',
      description: 'Chat with our support team',
      value: 'Available 24/7',
      action: '#'
    }
  ];

  const businessHours = [
    { day: 'Monday - Friday', hours: '9:00 AM - 6:00 PM WAT' },
    { day: 'Saturday', hours: '10:00 AM - 4:00 PM WAT' },
    { day: 'Sunday', hours: 'Closed' }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <section className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <MessageCircle className="h-8 w-8 text-primary" />
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Contact Us
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We're here to help! Get in touch with our support team for any questions or assistance.
            </p>
          </section>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Send className="h-5 w-5 text-primary" />
                    Send us a message
                  </CardTitle>
                  <CardDescription>
                    Fill out the form below and we'll get back to you as soon as possible.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-foreground">
                          Name *
                        </label>
                        <Input
                          required
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder="Your full name"
                          className="bg-background border-border"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-foreground">
                          Email *
                        </label>
                        <Input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="your.email@example.com"
                          className="bg-background border-border"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-foreground">
                          Category *
                        </label>
                        <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="billing">Billing & Payments</SelectItem>
                            <SelectItem value="technical">Technical Support</SelectItem>
                            <SelectItem value="account">Account Issues</SelectItem>
                            <SelectItem value="content">Content Request</SelectItem>
                            <SelectItem value="feedback">Feedback</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-foreground">
                          Subject *
                        </label>
                        <Input
                          required
                          value={formData.subject}
                          onChange={(e) => handleInputChange('subject', e.target.value)}
                          placeholder="Brief description of your inquiry"
                          className="bg-background border-border"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        Message *
                      </label>
                      <Textarea
                        required
                        value={formData.message}
                        onChange={(e) => handleInputChange('message', e.target.value)}
                        placeholder="Please provide detailed information about your inquiry..."
                        rows={6}
                        className="bg-background border-border"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full gradient-accent text-primary-foreground shadow-glow"
                    >
                      {isSubmitting ? 'Sending...' : 'Send Message'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Contact Information */}
            <div className="space-y-6">
              {/* Contact Methods */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Get in Touch</CardTitle>
                  <CardDescription>
                    Choose your preferred way to contact us
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contactInfo.map((info, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
                      <info.icon className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{info.title}</h4>
                        <p className="text-sm text-muted-foreground">{info.description}</p>
                        <p className="text-sm font-medium text-primary">{info.value}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Business Hours */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Clock className="h-5 w-5 text-primary" />
                    Business Hours
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {businessHours.map((schedule, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm text-foreground">{schedule.day}</span>
                      <Badge variant="outline" className="bg-background border-border">
                        {schedule.hours}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Office Location */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <MapPin className="h-5 w-5 text-primary" />
                    Our Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-foreground font-medium">Signature TV Headquarters</p>
                    <p className="text-sm text-muted-foreground">
                      123 Entertainment District<br />
                      Victoria Island, Lagos<br />
                      Nigeria
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Response Time */}
          <section className="mt-12 text-center">
            <Card className="bg-gradient-card border-border">
              <CardHeader>
                <CardTitle className="text-2xl text-foreground">Response Times</CardTitle>
                <CardDescription className="text-lg">
                  We strive to respond to all inquiries as quickly as possible
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <Badge className="gradient-accent text-primary-foreground mb-2">Priority</Badge>
                    <p className="text-sm text-foreground font-medium">Billing & Account Issues</p>
                    <p className="text-xs text-muted-foreground">Within 4 hours</p>
                  </div>
                  <div className="text-center">
                    <Badge variant="secondary" className="mb-2">Standard</Badge>
                    <p className="text-sm text-foreground font-medium">Technical Support</p>
                    <p className="text-xs text-muted-foreground">Within 24 hours</p>
                  </div>
                  <div className="text-center">
                    <Badge variant="outline" className="mb-2">General</Badge>
                    <p className="text-sm text-foreground font-medium">Other Inquiries</p>
                    <p className="text-xs text-muted-foreground">Within 48 hours</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Contact;