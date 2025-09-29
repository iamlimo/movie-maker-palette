import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UploadTester } from '@/components/admin/UploadTester';
import { TVShowCreator } from '@/components/admin/TVShowCreator';
import { TVShowFlowTest } from '@/components/admin/TVShowFlowTest';
import EpisodeUploadTest from '@/components/admin/EpisodeUploadTest';
import { 
  TestTube, 
  Tv,
  CheckCircle
} from 'lucide-react';

const AddTVShow = () => {
  const navigate = useNavigate();
  const [uploadTestsPassed, setUploadTestsPassed] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin/tv-shows')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to TV Shows
          </Button>
        </div>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">TV Show Management</h1>
              <p className="text-muted-foreground mt-1">
                Create and manage TV shows, seasons, and episodes
              </p>
            </div>
          </div>

          <Tabs defaultValue="flow-test" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="flow-test" className="flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Complete Flow Test
              </TabsTrigger>
              <TabsTrigger value="tester" className="flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Upload Tester
                {uploadTestsPassed && <CheckCircle className="h-4 w-4 text-green-600" />}
              </TabsTrigger>
              <TabsTrigger value="creator" className="flex items-center gap-2">
                <Tv className="h-4 w-4" />
                TV Show Creator
              </TabsTrigger>
            </TabsList>

            <TabsContent value="flow-test" className="space-y-6">
              <TVShowFlowTest />
              <EpisodeUploadTest />
            </TabsContent>

            <TabsContent value="tester" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>🧪 Step 1 — Upload Flow Tester</CardTitle>
                  <p className="text-muted-foreground">
                    Before building the full TV Shows feature, first verify and fix the media upload logic.
                    This ensures all upload functionality works correctly.
                  </p>
                </CardHeader>
                <CardContent>
                  <UploadTester />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="creator" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>📺 Step 2 — TV Shows Creation & Management</CardTitle>
                  <p className="text-muted-foreground">
                    Create and manage TV shows with all required fields, media uploads, and payment integration.
                  </p>
                </CardHeader>
                <CardContent>
                  <TVShowCreator />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AddTVShow;