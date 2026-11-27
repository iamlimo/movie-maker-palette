import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Globe2, MapPin } from 'lucide-react';

interface Territory {
  code: string;
  name: string;
  region_name: string;
  continent_name: string;
}

interface Props {
  continents: string[];
  regions: string[];
  territories: string[];
  onChange: (value: { continents: string[]; regions: string[]; territories: string[] }) => void;
}

const FALLBACK: Territory[] = [
  { code: 'WW', name: 'Worldwide', region_name: 'Global', continent_name: 'Worldwide' },
  { code: 'NG', name: 'Nigeria', region_name: 'West Africa', continent_name: 'Africa' },
  { code: 'GH', name: 'Ghana', region_name: 'West Africa', continent_name: 'Africa' },
  { code: 'ZA', name: 'South Africa', region_name: 'Southern Africa', continent_name: 'Africa' },
  { code: 'KE', name: 'Kenya', region_name: 'East Africa', continent_name: 'Africa' },
  { code: 'US', name: 'United States', region_name: 'North America', continent_name: 'North America' },
  { code: 'GB', name: 'United Kingdom', region_name: 'Northern Europe', continent_name: 'Europe' },
  { code: 'FR', name: 'France', region_name: 'Western Europe', continent_name: 'Europe' },
  { code: 'IN', name: 'India', region_name: 'South Asia', continent_name: 'Asia' },
  { code: 'JP', name: 'Japan', region_name: 'East Asia', continent_name: 'Asia' },
  { code: 'AU', name: 'Australia', region_name: 'Australia and New Zealand', continent_name: 'Oceania' },
];

export default function RegionTerritorySelector({ continents, regions, territories, onChange }: Props) {
  const [catalog, setCatalog] = useState<Territory[]>(FALLBACK);

  useEffect(() => {
    supabase
      .from('geographic_territories')
      .select('code,name,region_name,continent_name')
      .eq('active', true)
      .order('name')
      .then(({ data }) => {
        if (data?.length) setCatalog(data as Territory[]);
      });
  }, []);

  const availableContinents = useMemo(
    () => Array.from(new Set(catalog.map(item => item.continent_name))).sort(),
    [catalog]
  );

  const availableRegions = useMemo(
    () => Array.from(new Set(catalog.filter(item => !continents.length || continents.includes(item.continent_name)).map(item => item.region_name))).sort(),
    [catalog, continents]
  );

  const availableTerritories = useMemo(
    () => catalog.filter(item =>
      (!continents.length || continents.includes(item.continent_name)) &&
      (!regions.length || regions.includes(item.region_name))
    ),
    [catalog, continents, regions]
  );

  const toggle = (field: 'continents' | 'regions' | 'territories', value: string) => {
    const current = field === 'continents' ? continents : field === 'regions' ? regions : territories;
    const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value];

    if (field === 'continents') {
      const allowedRegions = Array.from(new Set(catalog.filter(item => next.includes(item.continent_name)).map(item => item.region_name)));
      const allowedCodes = catalog.filter(item => next.includes(item.continent_name)).map(item => item.code);
      onChange({
        continents: next,
        regions: regions.filter(region => allowedRegions.includes(region)),
        territories: territories.filter(code => allowedCodes.includes(code)),
      });
    } else if (field === 'regions') {
      const allowedCodes = catalog.filter(item => next.includes(item.region_name)).map(item => item.code);
      onChange({ continents, regions: next, territories: territories.filter(code => allowedCodes.includes(code)) });
    } else {
      const selected = catalog.filter(item => next.includes(item.code));
      onChange({
        continents: Array.from(new Set([...continents, ...selected.map(item => item.continent_name)])),
        regions: Array.from(new Set([...regions, ...selected.map(item => item.region_name)])),
        territories: next,
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> Continents</Label>
        <div className="flex flex-wrap gap-2">
          {availableContinents.map(continent => (
            <Badge
              key={continent}
              variant={continents.includes(continent) ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => toggle('continents', continent)}
            >
              {continent}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Regions</Label>
        <div className="flex flex-wrap gap-2">
          {availableRegions.map(region => (
            <Badge
              key={region}
              variant={regions.includes(region) ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => toggle('regions', region)}
            >
              {region}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Territories</Label>
        <div className="max-h-52 overflow-y-auto rounded-md border p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {availableTerritories.map(territory => (
            <label key={territory.code} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={territories.includes(territory.code)}
                onChange={() => toggle('territories', territory.code)}
                className="h-4 w-4"
              />
              <span>{territory.name}</span>
              <span className="text-xs text-muted-foreground">({territory.code})</span>
            </label>
          ))}
        </div>
        {territories.length > 0 && (
          <p className="text-xs text-muted-foreground">{territories.length} territory/territories selected</p>
        )}
      </div>
    </div>
  );
}
