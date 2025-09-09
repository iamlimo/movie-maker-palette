import { useState } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, GripVertical, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSliderItems } from '@/hooks/useSliderItems';
import CinematicHeroSlider from '@/components/CinematicHeroSlider';

export default function HeroSlider() {
  const { sliderItems, loading, refetch } = useSliderItems();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-l-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hero Slider Management</h1>
          <p className="text-muted-foreground">
            Manage featured content displayed in the hero slider
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="mr-2 h-4 w-4" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add to Slider
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Content to Hero Slider</DialogTitle>
                <DialogDescription>
                  Select movies or TV shows to feature in the hero slider
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search movies and TV shows..." />
                </div>
                
                <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                  {/* This would be populated with movies/TV shows from the database */}
                  <div className="text-center py-8 text-muted-foreground">
                    Content selection functionality would be implemented here
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button onClick={() => setIsAddDialogOpen(false)}>
                  Add Selected Content
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Preview Section */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
            <CardDescription>
              This is how the hero slider will appear on your homepage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative bg-background border rounded-lg overflow-hidden">
              <CinematicHeroSlider />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Slider Items Management */}
      <Card>
        <CardHeader>
          <CardTitle>Current Slider Items</CardTitle>
          <CardDescription>
            Manage the order and visibility of hero slider content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sliderItems.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-semibold mb-2">No slider items found</h3>
                <p className="text-muted-foreground mb-4">
                  Add movies or TV shows to the hero slider
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Content
                </Button>
              </div>
            ) : (
              sliderItems.map((item, index) => (
                <div key={item.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  
                  <div className="flex-shrink-0">
                    {item.poster_url ? (
                      <img 
                        src={item.poster_url} 
                        alt={item.title}
                        className="w-16 h-24 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-24 bg-muted rounded flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">No Image</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant="outline">{item.content_type}</Badge>
                      {item.genre && <Badge variant="secondary">{item.genre}</Badge>}
                      <Badge variant="outline">₦{item.price}</Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant={item.status === 'active' ? "default" : "secondary"}>
                      {item.status === 'active' ? (
                        <>
                          <Eye className="mr-1 h-3 w-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <EyeOff className="mr-1 h-3 w-3" />
                          Inactive
                        </>
                      )}
                    </Badge>
                    <Badge variant="outline">#{item.sort_order}</Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={item.status === 'active'}
                      onCheckedChange={(checked) => {
                        // Handle status toggle
                        console.log('Toggle status for:', item.id, checked);
                      }}
                    />
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}