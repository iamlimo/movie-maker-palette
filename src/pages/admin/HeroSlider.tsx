import { useState, useMemo } from 'react';
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
import { useAllContent } from '@/hooks/useMovies';
import CinematicHeroSlider from '@/components/CinematicHeroSlider';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatNaira } from '@/lib/priceUtils';

export default function HeroSlider() {
  const { sliderItems, loading, refetch } = useSliderItems();
  const { content, loading: contentLoading } = useAllContent();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContent, setSelectedContent] = useState<Set<string>>(new Set());

  const filteredContent = useMemo(() => {
    return content.filter(item => 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [content, searchTerm]);

  const handleAddToSlider = async () => {
    if (selectedContent.size === 0) {
      toast({
        title: "No content selected",
        description: "Please select at least one item to add to the slider",
        variant: "destructive",
      });
      return;
    }

    try {
      const contentArray = Array.from(selectedContent);
      const sliderData = contentArray.map((contentId, index) => {
        const item = content.find(c => c.id === contentId);
        if (!item) return null;
        
        return {
          content_id: contentId,
          content_type: item.content_type,
          title: item.title,
          description: item.description || '',
          poster_url: item.slider_cover_url || item.landscape_poster_url || item.thumbnail_url,
          genre: item.genre?.name || null,
          rating: item.rating,
          price: item.price,
          is_featured: true,
          is_rentable: true,
          sort_order: sliderItems.length + index + 1,
          status: 'active'
        };
      }).filter(Boolean);

      for (const item of sliderData) {
        const { error } = await supabase
          .from('slider_items')
          .insert(item);
        
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Added ${contentArray.length} item(s) to slider`,
      });
      
      setSelectedContent(new Set());
      setIsAddDialogOpen(false);
      refetch();
    } catch (error: any) {
      console.error('Error adding to slider:', error);
      toast({
        title: "Error",
        description: "Failed to add content to slider",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (itemId: string, newStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('slider_items')
        .update({ status: newStatus ? 'active' : 'inactive' })
        .eq('id', itemId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Slider item status updated",
      });
      
      refetch();
    } catch (error: any) {
      console.error('Error updating slider item:', error);
      toast({
        title: "Error",
        description: "Failed to update slider item",
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('slider_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Slider item deleted",
      });
      
      refetch();
    } catch (error: any) {
      console.error('Error deleting slider item:', error);
      toast({
        title: "Error",
        description: "Failed to delete slider item",
        variant: "destructive",
      });
    }
  };

  if (loading || contentLoading) {
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
                  <Input 
                    placeholder="Search movies and TV shows..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                  {filteredContent.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'No content found matching your search' : 'No content available'}
                    </div>
                  ) : (
                    filteredContent.map((item) => (
                      <div key={item.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <input
                          type="checkbox"
                          checked={selectedContent.has(item.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedContent);
                            if (e.target.checked) {
                              newSelected.add(item.id);
                            } else {
                              newSelected.delete(item.id);
                            }
                            setSelectedContent(newSelected);
                          }}
                          className="rounded"
                        />
                        
                        <div className="flex-shrink-0">
                          {item.thumbnail_url ? (
                            <img 
                              src={item.thumbnail_url} 
                              alt={item.title}
                              className="w-12 h-16 object-cover rounded"
                            />
                          ) : (
                            <div className="w-12 h-16 bg-muted rounded flex items-center justify-center">
                              <span className="text-xs text-muted-foreground">No Image</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <h4 className="font-medium">{item.title}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {item.description}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="outline" className="text-xs">{item.content_type}</Badge>
                            {item.genre?.name && <Badge variant="secondary" className="text-xs">{item.genre.name}</Badge>}
                            <Badge variant="outline" className="text-xs">{formatNaira(item.price)}</Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddToSlider} disabled={selectedContent.size === 0}>
                  Add Selected Content ({selectedContent.size})
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
                      <Badge variant="outline">{formatNaira(item.price)}</Badge>
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
                      onCheckedChange={(checked) => handleToggleStatus(item.id, checked)}
                    />
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteItem(item.id)}
                    >
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