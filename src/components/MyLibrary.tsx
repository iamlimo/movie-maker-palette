import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRentals } from '@/hooks/useRentals';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface RentedContent {
  id: string;
  title: string;
  thumbnail_url?: string;
  content_type: 'movie' | 'tv';
  rental: {
    expires_at: string;
    amount: number;
  };
}

const MyLibrary = () => {
  const { user } = useAuth();
  const { activeRentals, formatTimeRemaining } = useRentals();
  const [rentedContent, setRentedContent] = useState<RentedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user && activeRentals.length > 0) {
      fetchRentedContent();
    } else {
      setIsLoading(false);
    }
  }, [user, activeRentals]);

  const fetchRentedContent = async () => {
    try {
      setIsLoading(true);
      const contentPromises = activeRentals.map(async (rental) => {
        if (rental.content_type === 'movie') {
          const { data, error } = await supabase
            .from('movies')
            .select('id, title, thumbnail_url')
            .eq('id', rental.content_id)
            .single();

          if (error || !data) return null;
          return {
            id: data.id,
            title: data.title,
            thumbnail_url: data.thumbnail_url,
            content_type: 'movie' as const,
            rental: { expires_at: rental.expires_at, amount: rental.amount }
          };
        } else {
          const { data, error } = await supabase
            .from('episodes')
            .select('id, title')
            .eq('id', rental.content_id)
            .single();

          if (error || !data) return null;
          return {
            id: data.id,
            title: data.title,
            content_type: 'tv' as const,
            rental: { expires_at: rental.expires_at, amount: rental.amount }
          };
        }
      });

      const results = await Promise.all(contentPromises);
      const validContent = results.filter((item) => item !== null) as RentedContent[];
      setRentedContent(validContent);
      
    } catch (error) {
      console.error('Error fetching rented content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWatchClick = (content: RentedContent) => {
    const route = content.content_type === 'movie' 
      ? `/movie/${content.id}` 
      : `/tvshow/${content.id}`;
    navigate(route);
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Library</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please sign in to view your rented content.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Library</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (rentedContent.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Library</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Rentals Yet</h3>
            <p className="text-muted-foreground">
              Rent movies and shows to start building your library
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Library ({rentedContent.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rentedContent.map((content) => (
            <div
              key={`${content.content_type}-${content.id}`}
              className="group cursor-pointer"
              onClick={() => handleWatchClick(content)}
            >
              <div className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden mb-3 group-hover:scale-105 transition-transform">
                {content.thumbnail_url ? (
                  <img
                    src={content.thumbnail_url}
                    alt={content.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <Play className="h-8 w-8 text-white ml-1" />
                  </div>
                </div>

                {/* Content type badge */}
                <div className="absolute top-2 left-2">
                  <Badge variant={content.content_type === 'movie' ? 'default' : 'secondary'}>
                    {content.content_type === 'movie' ? 'Movie' : 'TV Show'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold truncate">{content.title}</h3>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatTimeRemaining(content.rental.expires_at)}</span>
                </div>

                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWatchClick(content);
                  }}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Watch Now
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default MyLibrary;