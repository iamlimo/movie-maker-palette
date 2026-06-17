import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CreatorProfile = {
  id: string;
  display_name: string;
};

type ContentType = 'movie' | 'tv_show' | 'episode';

export default function CreatorSelect(props: {
  label?: string;
  required?: boolean;
  contentType: ContentType;
  contentId?: string | null;
  value?: string | null;
  onChange?: (creatorProfileId: string) => void;
  className?: string;
}) {
  const {
    label = 'Creator',
    required = true,
    contentType,
    contentId,
    value,
    onChange,
    className,
  } = props;

  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>(value || '');
  const [loadingMapping, setLoadingMapping] = useState<boolean>(!!contentId);
  const [loadingCreators, setLoadingCreators] = useState<boolean>(true);

  const hasControlledValue = useMemo(() => value !== undefined, [value]);

  // Keep local state in sync for controlled usage.
  useEffect(() => {
    if (!hasControlledValue) return;
    setSelectedCreatorId(value || '');
  }, [hasControlledValue, value]);

  useEffect(() => {
    let mounted = true;

    const fetchCreators = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('creator_profiles')
          .select('id, display_name')
          .eq('status', 'active')
          .order('display_name', { ascending: true });

        if (error) throw error;
        if (mounted) setCreators(data || []);
      } catch (e) {
        console.error('[CreatorSelect] fetchCreators error:', e);
      } finally {
        if (mounted) setLoadingCreators(false);
      }
    };

    fetchCreators();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!contentId) {
      setLoadingMapping(false);
      return;
    }

    let mounted = true;

    const fetchCurrentMapping = async () => {
      try {
        setLoadingMapping(true);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('content_creators')
          .select('creator_profile_id')
          .eq('content_id', contentId)
          .eq('content_type', contentType)
          .maybeSingle();

        if (error) throw error;

        const creatorProfileId: string | null = data?.creator_profile_id ?? null;

        if (mounted && creatorProfileId) {
          if (!hasControlledValue) setSelectedCreatorId(creatorProfileId);
          onChange?.(creatorProfileId);
        }
      } catch (e) {
        console.error('[CreatorSelect] fetchCurrentMapping error:', e);
      } finally {
        if (mounted) setLoadingMapping(false);
      }
    };

    fetchCurrentMapping();

    return () => {
      mounted = false;
    };
  }, [contentId, contentType, hasControlledValue, onChange]);

  const handleChange = (next: string) => {
    setSelectedCreatorId(next);
    onChange?.(next);
  };

  return (
    <div className={className}>
      <div className="space-y-2">
        <Label>
          {label}
          {required ? ' *' : ''}
        </Label>

        <Select
          value={selectedCreatorId}
          onValueChange={handleChange}
          disabled={loadingCreators || loadingMapping}
        >
          <SelectTrigger className="bg-input border-border text-foreground">
            <SelectValue
              placeholder={loadingMapping ? 'Loading...' : 'Select creator'}
            />
          </SelectTrigger>
          <SelectContent>
            {creators.map((creator) => (
              <SelectItem key={creator.id} value={creator.id}>
                {creator.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {loadingCreators && (
          <p className="text-xs text-muted-foreground">Loading creators...</p>
        )}

        {!loadingCreators && required && !selectedCreatorId && (
          <p className="text-xs text-destructive">Creator is required.</p>
        )}
      </div>
    </div>
  );
}
