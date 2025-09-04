import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CastCrew {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photo_url?: string;
  social_links: any; // Using any to handle JSONB from Supabase
  created_at: string;
  updated_at: string;
}

interface CastCrewManagerProps {
  onSelectionChange?: (selected: CastCrew[]) => void;
  selectedIds?: string[];
  mode?: "select" | "manage";
}

const ROLE_OPTIONS = [
  "actor",
  "director", 
  "producer",
  "writer",
  "cinematographer",
  "editor",
  "composer",
  "costume_designer",
  "production_designer"
];

const CastCrewManager: React.FC<CastCrewManagerProps> = ({ 
  onSelectionChange, 
  selectedIds = [], 
  mode = "manage" 
}) => {
  const [castCrew, setCastCrew] = useState<CastCrew[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CastCrew | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    bio: "",
    photo_url: "",
    social_links: { twitter: "", instagram: "", website: "" }
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchCastCrew();
  }, []);

  const fetchCastCrew = async () => {
    try {
      const { data, error } = await supabase
        .from('cast_crew')
        .select('*')
        .order('name');

      if (error) throw error;
      setCastCrew((data || []).map(item => ({
        ...item,
        social_links: item.social_links || { twitter: "", instagram: "", website: "" }
      })));
    } catch (error) {
      console.error('Error fetching cast & crew:', error);
      toast({
        title: "Error",
        description: "Failed to fetch cast & crew",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadPhoto = async () => {
    if (!selectedFile) return null;

    try {
      setUploadProgress(0);
      
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const filePath = `cast-photos/${fileName}`;

      // Use the upload-video function for photo uploads
      const response = await supabase.functions.invoke('upload-video', {
        body: {
          action: 'get_upload_info',
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type
        }
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to get upload info');
      }

      const { signedUrl, filePath: uploadPath } = response.data;

      // Upload the file
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      setUploadProgress(100);

      // Confirm upload
      const confirmResponse = await supabase.functions.invoke('upload-video', {
        body: {
          action: 'confirm_upload',
          filePath: uploadPath,
          bucket: 'thumbnails'
        }
      });

      if (!confirmResponse.data?.success) {
        throw new Error('Failed to confirm upload');
      }

      return confirmResponse.data.publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload photo",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let photoUrl = formData.photo_url;
      
      if (selectedFile) {
        photoUrl = await uploadPhoto();
        if (!photoUrl) return;
      }

      const submitData = {
        ...formData,
        photo_url: photoUrl,
        social_links: formData.social_links
      };

      if (editingItem) {
        const { error } = await supabase
          .from('cast_crew')
          .update(submitData)
          .eq('id', editingItem.id);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Cast/crew member updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('cast_crew')
          .insert([submitData]);

        if (error) throw error;
        
        toast({
          title: "Success", 
          description: "Cast/crew member added successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchCastCrew();
    } catch (error) {
      console.error('Error saving cast/crew member:', error);
      toast({
        title: "Error",
        description: "Failed to save cast/crew member",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cast_crew')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Cast/crew member deleted successfully",
      });
      
      fetchCastCrew();
    } catch (error) {
      console.error('Error deleting cast/crew member:', error);
      toast({
        title: "Error",
        description: "Failed to delete cast/crew member",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      role: "",
      bio: "",
      photo_url: "",
      social_links: { twitter: "", instagram: "", website: "" }
    });
    setEditingItem(null);
    setSelectedFile(null);
    setUploadProgress(0);
  };

  const openEditDialog = (item: CastCrew) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      role: item.role,
      bio: item.bio || "",
      photo_url: item.photo_url || "",
      social_links: item.social_links || { twitter: "", instagram: "", website: "" }
    });
    setIsDialogOpen(true);
  };

  const handleSelection = (item: CastCrew) => {
    if (mode !== "select" || !onSelectionChange) return;
    
    const isSelected = selectedIds.includes(item.id);
    const newSelection = isSelected 
      ? castCrew.filter(c => selectedIds.includes(c.id) && c.id !== item.id)
      : [...castCrew.filter(c => selectedIds.includes(c.id)), item];
    
    onSelectionChange(newSelection);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="w-16 h-16 gradient-accent rounded-full animate-pulse mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading cast & crew...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Cast & Crew Management</h2>
          <p className="text-muted-foreground">
            {mode === "select" ? "Select cast & crew members" : "Manage cast & crew database"}
          </p>
        </div>
        {mode === "manage" && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Cast/Crew
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? "Edit Cast/Crew Member" : "Add Cast/Crew Member"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(role => (
                          <SelectItem key={role} value={role}>
                            {role.replace('_', ' ').toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="bio">Biography</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="photo">Photo Upload</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="photo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div 
                          className="gradient-accent h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Social Links</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Twitter URL"
                      value={formData.social_links.twitter}
                      onChange={(e) => setFormData({
                        ...formData,
                        social_links: { ...formData.social_links, twitter: e.target.value }
                      })}
                    />
                    <Input
                      placeholder="Instagram URL"
                      value={formData.social_links.instagram}
                      onChange={(e) => setFormData({
                        ...formData,
                        social_links: { ...formData.social_links, instagram: e.target.value }
                      })}
                    />
                    <Input
                      placeholder="Website URL"
                      value={formData.social_links.website}
                      onChange={(e) => setFormData({
                        ...formData,
                        social_links: { ...formData.social_links, website: e.target.value }
                      })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingItem ? "Update" : "Add"} Cast/Crew
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {castCrew.map((item) => (
          <Card 
            key={item.id} 
            className={`cursor-pointer transition-all ${
              mode === "select" && selectedIds.includes(item.id) 
                ? "ring-2 ring-primary shadow-glow" 
                : ""
            }`}
            onClick={() => handleSelection(item)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                {item.photo_url ? (
                  <img
                    src={item.photo_url}
                    alt={item.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <Badge variant="secondary">{item.role.replace('_', ' ')}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {item.bio && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {item.bio}
                </p>
              )}
              
              {mode === "manage" && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog(item);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {castCrew.length === 0 && (
        <div className="text-center py-8">
          <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No cast & crew members found</p>
          {mode === "manage" && (
            <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Member
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default CastCrewManager;