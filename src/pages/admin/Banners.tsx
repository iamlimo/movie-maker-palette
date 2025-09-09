import { useState } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, GripVertical, Upload, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBanners, Banner } from '@/hooks/useBanners';

export default function Banners() {
  const { banners, loading, createBanner, updateBanner, deleteBanner } = useBanners();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    image_url: '',
    cta_text: '',
    cta_link: '',
    display_order: 0,
    is_visible: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingBanner) {
        await updateBanner(editingBanner.id, formData);
        setEditingBanner(null);
      } else {
        await createBanner(formData);
        setIsCreateDialogOpen(false);
      }
      
      setFormData({
        title: '',
        subtitle: '',
        image_url: '',
        cta_text: '',
        cta_link: '',
        display_order: 0,
        is_visible: true
      });
    } catch (error) {
      console.error('Error saving banner:', error);
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      image_url: banner.image_url || '',
      cta_text: banner.cta_text || '',
      cta_link: banner.cta_link || '',
      display_order: banner.display_order,
      is_visible: banner.is_visible
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this banner?')) {
      try {
        await deleteBanner(id);
      } catch (error) {
        console.error('Error deleting banner:', error);
      }
    }
  };

  const handleVisibilityToggle = async (banner: Banner) => {
    try {
      await updateBanner(banner.id, { is_visible: !banner.is_visible });
    } catch (error) {
      console.error('Error updating visibility:', error);
    }
  };

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
          <h1 className="text-3xl font-bold tracking-tight">Banners & CTAs</h1>
          <p className="text-muted-foreground">
            Create and manage promotional banners for your homepage
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Banner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Banner</DialogTitle>
              <DialogDescription>
                Add a new promotional banner to your homepage
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Banner title"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="subtitle">Subtitle</Label>
                  <Textarea
                    id="subtitle"
                    value={formData.subtitle}
                    onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="Optional subtitle"
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="image_url">Image URL</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="image_url"
                      value={formData.image_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                      placeholder="https://example.com/banner-image.jpg"
                    />
                    <Button type="button" variant="outline">
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="cta_text">CTA Text</Label>
                    <Input
                      id="cta_text"
                      value={formData.cta_text}
                      onChange={(e) => setFormData(prev => ({ ...prev, cta_text: e.target.value }))}
                      placeholder="Watch Now"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cta_link">CTA Link</Label>
                    <Input
                      id="cta_link"
                      value={formData.cta_link}
                      onChange={(e) => setFormData(prev => ({ ...prev, cta_link: e.target.value }))}
                      placeholder="/movies"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) }))}
                    min={0}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_visible"
                    checked={formData.is_visible}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_visible: checked }))}
                  />
                  <Label htmlFor="is_visible">Visible on homepage</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create Banner</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {banners.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">No banners found</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first promotional banner
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Banner
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          banners.map((banner) => (
            <Card key={banner.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center space-x-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">{banner.title}</CardTitle>
                    {banner.subtitle && (
                      <CardDescription>{banner.subtitle}</CardDescription>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={banner.is_visible ? "default" : "secondary"}>
                    {banner.is_visible ? (
                      <>
                        <Eye className="mr-1 h-3 w-3" />
                        Visible
                      </>
                    ) : (
                      <>
                        <EyeOff className="mr-1 h-3 w-3" />
                        Hidden
                      </>
                    )}
                  </Badge>
                  <Badge variant="outline">Order: {banner.display_order}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-start space-x-4">
                  {banner.image_url && (
                    <div className="flex-shrink-0">
                      <img 
                        src={banner.image_url} 
                        alt={banner.title}
                        className="w-24 h-16 object-cover rounded border"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    {banner.cta_text && banner.cta_link && (
                      <div className="mb-2">
                        <Badge variant="outline" className="inline-flex items-center">
                          <ExternalLink className="mr-1 h-3 w-3" />
                          {banner.cta_text} → {banner.cta_link}
                        </Badge>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Created: {new Date(banner.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={banner.is_visible}
                          onCheckedChange={() => handleVisibilityToggle(banner)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(banner)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(banner.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingBanner} onOpenChange={() => setEditingBanner(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Banner</DialogTitle>
            <DialogDescription>
              Update banner details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Banner title"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-subtitle">Subtitle</Label>
                <Textarea
                  id="edit-subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Optional subtitle"
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-image_url">Image URL</Label>
                <div className="flex space-x-2">
                  <Input
                    id="edit-image_url"
                    value={formData.image_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                    placeholder="https://example.com/banner-image.jpg"
                  />
                  <Button type="button" variant="outline">
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-cta_text">CTA Text</Label>
                  <Input
                    id="edit-cta_text"
                    value={formData.cta_text}
                    onChange={(e) => setFormData(prev => ({ ...prev, cta_text: e.target.value }))}
                    placeholder="Watch Now"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-cta_link">CTA Link</Label>
                  <Input
                    id="edit-cta_link"
                    value={formData.cta_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, cta_link: e.target.value }))}
                    placeholder="/movies"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-display_order">Display Order</Label>
                <Input
                  id="edit-display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) }))}
                  min={0}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-is_visible"
                  checked={formData.is_visible}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_visible: checked }))}
                />
                <Label htmlFor="edit-is_visible">Visible on homepage</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Update Banner</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}