import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSearch } from '@/hooks/useSearch';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { formatNaira } from '@/lib/priceUtils';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchModal = ({ isOpen, onClose }: SearchModalProps) => {
  const [localSearch, setLocalSearch] = useState('');
  const { searchResults, search, isSearching } = useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      search(localSearch);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [localSearch, search]);

  const handleResultClick = (result: any) => {
    const path = result.content_type === 'movie' 
      ? `/movie/${result.id}` 
      : `/tvshow/${result.id}`;
    navigate(path);
    onClose();
    setLocalSearch('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Search className="h-5 w-5" />
            Search Movies & TV Shows
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for movies and TV shows..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-10 bg-background border-border focus:ring-ring"
              autoFocus
            />
            {localSearch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocalSearch('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {isSearching && (
              <div className="text-center py-8 text-muted-foreground">
                Searching...
              </div>
            )}
            
            {!isSearching && localSearch && searchResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No results found for "{localSearch}"
              </div>
            )}

            {searchResults.map((result) => (
              <div
                key={result.id}
                onClick={() => handleResultClick(result)}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary cursor-pointer transition-smooth"
              >
                {result.thumbnail_url && (
                  <img
                    src={result.thumbnail_url}
                    alt={result.title}
                    className="w-16 h-24 object-cover rounded-md"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{result.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={result.content_type === 'movie' ? 'default' : 'secondary'}>
                      {result.content_type === 'movie' ? 'Movie' : 'TV Show'}
                    </Badge>
                    {result.genre && (
                      <span className="text-sm text-muted-foreground">{result.genre}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {result.rating && (
                      <span className="text-sm text-muted-foreground">Rated {result.rating}</span>
                    )}
                    <span className="text-sm font-medium text-primary">{formatNaira(result.price)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchModal;