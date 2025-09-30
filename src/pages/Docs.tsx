import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/Header";
import { FileVideo, Shield, Upload, Play, CheckCircle2, AlertTriangle } from "lucide-react";

const Docs = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Backblaze B2 Video Storage Integration</h1>
          <p className="text-muted-foreground text-lg">
            Complete guide for super admins on managing video content with Backblaze B2
          </p>
        </div>

        {/* Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileVideo className="h-5 w-5" />
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Signature TV uses Backblaze B2 for cost-effective, scalable video storage.
              This system provides secure streaming with temporary signed URLs and download protection.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Cost-Effective</p>
                  <p className="text-sm text-muted-foreground">Significantly lower storage costs for large video files</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Better Performance</p>
                  <p className="text-sm text-muted-foreground">Optimized for large file storage and streaming</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Scalability</p>
                  <p className="text-sm text-muted-foreground">Handles millions of video files without degradation</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Lower Bandwidth</p>
                  <p className="text-sm text-muted-foreground">Reduced bandwidth costs compared to traditional storage</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Workflow */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Admin Workflow
            </CardTitle>
            <CardDescription>Step-by-step guide for uploading and managing video content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">Step 1</Badge>
                <h3 className="font-semibold">Upload to Backblaze</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Manually upload movie/episode videos to your Backblaze B2 bucket using:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                <li>Backblaze web interface</li>
                <li>Backblaze CLI</li>
                <li>Any S3-compatible tool</li>
              </ul>
              <Alert className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Organize videos in folders: <code className="bg-muted px-1 py-0.5 rounded">movies/</code>, 
                  <code className="bg-muted px-1 py-0.5 rounded ml-1">episodes/</code>, 
                  <code className="bg-muted px-1 py-0.5 rounded ml-1">tv-shows/</code>
                </AlertDescription>
              </Alert>
            </div>

            <Separator />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">Step 2</Badge>
                <h3 className="font-semibold">Create Content in Dashboard</h3>
              </div>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                <li>Navigate to Admin → Movies → Add Movie (or Add Episode)</li>
                <li>Paste the Backblaze file URL or path in the "Video URL" field</li>
                <li>Click "Test Video" to preview before publishing</li>
                <li>Upload thumbnails, posters, and trailers through Supabase (as usual)</li>
                <li>Fill in metadata (title, description, price, etc.)</li>
              </ul>
              
              <div className="mt-3 bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium mb-2">Example URL formats:</p>
                <code className="block text-xs bg-background p-2 rounded mb-1">
                  https://f002.backblazeb2.com/file/my-bucket/movies/movie-name.mp4
                </code>
                <code className="block text-xs bg-background p-2 rounded">
                  movies/movie-name.mp4
                </code>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">Step 3</Badge>
                <h3 className="font-semibold">Publish</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Once validated, submit the form. The video path is stored in the database (not the public URL).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* User Workflow */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              User Experience
            </CardTitle>
            <CardDescription>How users access and watch protected content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Browsing</h3>
              <p className="text-sm text-muted-foreground">
                Users browse movies/episodes normally. Only thumbnails and posters are displayed.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Renting/Purchasing</h3>
              <p className="text-sm text-muted-foreground">
                Users rent or purchase content through Paystack payment processing.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Watching</h3>
              <p className="text-sm text-muted-foreground mb-2">
                After successful payment:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                <li>A secure, time-limited signed URL is generated from Backblaze B2</li>
                <li>Signed URL expires after 2 hours for security</li>
                <li>URL automatically refreshes during long viewing sessions</li>
                <li>Users cannot share video URLs (they expire quickly)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Security Features */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Features
            </CardTitle>
            <CardDescription>Multi-layered protection for your video content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Signed URLs</h3>
              <p className="text-sm text-muted-foreground">
                All video URLs are temporary and expire after 2 hours. Users cannot share video URLs as they expire quickly.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Access Control</h3>
              <p className="text-sm text-muted-foreground">
                Videos are only accessible to users with active rentals/purchases. Super admins can view all content.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Download Protection</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                <li>Video player disables right-click and download options</li>
                <li>Context menu is blocked</li>
                <li>Watermark overlay indicates protected content</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Automatic Refresh</h3>
              <p className="text-sm text-muted-foreground">
                URLs are refreshed 5 minutes before expiry during playback for seamless long-form content viewing.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Environment Variables */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Required Configuration</CardTitle>
            <CardDescription>Environment variables needed in Supabase</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <code className="block text-sm">BACKBLAZE_B2_APPLICATION_KEY_ID</code>
              <code className="block text-sm">BACKBLAZE_B2_APPLICATION_KEY</code>
              <code className="block text-sm">BACKBLAZE_B2_BUCKET_NAME</code>
            </div>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Video preview doesn't work</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                <li>Check the file path is correct</li>
                <li>Ensure Backblaze credentials are configured in Supabase</li>
                <li>Verify the video file exists in the bucket</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Video playback fails for users</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                <li>Check user has active rental/purchase</li>
                <li>Verify Backblaze credentials are valid</li>
                <li>Check edge function logs for errors</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Signed URL expires during playback</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                <li>System automatically refreshes URLs 5 minutes before expiry</li>
                <li>If issues persist, check network connectivity</li>
                <li>Review browser console for error messages</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              For technical issues or questions:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
              <li>Check edge function logs in Supabase dashboard</li>
              <li>Verify Backblaze credentials are correctly configured</li>
              <li>Test video URLs using the admin preview feature</li>
              <li>Contact technical support with error details</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Docs;
