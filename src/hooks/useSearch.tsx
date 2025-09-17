import { useState, useCallback, useMemo } from 'react';
import { useAllContent } from './useMovies';

export type SearchResult = {
  id: string;
  title: string;
  content_type: 'movie' | 'tv_show';
  thumbnail_url?: string;
  genre?: string;
  rating?: string;
  price: number;
};

export const useSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { content, loading } = useAllContent();

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    
    return content
      .filter(item => 
        item.title.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term)
      )
      .map(item => ({
        id: item.id,
        title: item.title,
        content_type: item.content_type,
        thumbnail_url: item.thumbnail_url,
        genre: item.genre?.name,
        rating: item.rating,
        price: item.price
      }))
      .slice(0, 10); // Limit results
  }, [content, searchTerm]);

  const search = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  return {
    searchTerm,
    searchResults,
    search,
    clearSearch,
    isSearching: loading
  };
};