# TV Shows Rental System - Example Usage Patterns

## Basic Usage Patterns

### Pattern 1: Simple Rent Button
```tsx
import { OptimizedRentalButton } from '@/components/OptimizedRentalButton';

export function EpisodeCard({ episode }) {
  return (
    <div className="episode-card">
      <h3>{episode.title}</h3>
      <p>{episode.description}</p>
      
      <OptimizedRentalButton
        contentId={episode.id}
        contentType="episode"
        price={episode.price}
        title={episode.title}
      />
    </div>
  );
}
```

### Pattern 2: Check Access & Show Different UI
```tsx
import { useOptimizedRentals } from '@/hooks/useOptimizedRentals';

export function EpisodePlayer({ episode }) {
  const { checkAccess } = useOptimizedRentals();
  const access = checkAccess(episode.id, 'episode');

  if (access.hasAccess) {
    return (
      <div>
        <VideoPlayer src={episode.video_url} />
        <p className="text-sm text-muted-foreground">
          ⏱️ {access.timeRemaining?.formatted}
        </p>
      </div>
    );
  }

  return <LockScreen content={episode} />;
}
```

### Pattern 3: Season with Episode Unlock
```tsx
import { useOptimizedRentals } from '@/hooks/useOptimizedRentals';
import { OptimizedRentalButton } from '@/components/OptimizedRentalButton';

export function SeasonCard({ season, episodes }) {
  const { checkAccess, checkSeasonAccess } = useOptimizedRentals();
  
  const seasonRented = checkSeasonAccess(season.id);

  return (
    <div>
      <h2>Season {season.season_number}</h2>
      
      {!seasonRented && (
        <OptimizedRentalButton
          contentId={season.id}
          contentType="season"
          price={season.price}
          title={`Season ${season.season_number}`}
        />
      )}

      <div className="episodes-grid">
        {episodes.map(ep => {
          const canWatch = seasonRented || checkAccess(ep.id, 'episode').hasAccess;
          
          return (
            <div key={ep.id} className={canWatch ? '' : 'opacity-50'}>
              <h4>{ep.title}</h4>
              
              {canWatch ? (
                <Button>▶ Watch</Button>
              ) : (
                <OptimizedRentalButton
                  contentId={ep.id}
                  contentType="episode"
                  price={ep.price}
                  title={ep.title}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Pattern 4: Pricing Comparison
```tsx
import { formatNaira } from '@/lib/priceUtils';

export function PricingSection({ season, episodes }) {
  const pricesMatch = episodes.reduce((sum, e) => sum + e.price, 0);
  const seasonPrice = season.price;
  const savings = pricesMatch - seasonPrice;
  const savingsPercent = Math.round((savings / pricesMatch) * 100);

  return (
    <div className="pricing-comparison">
      <div className="option">
        <h3>Individual Episodes</h3>
        <p className="text-2xl font-bold">{formatNaira(pricesMatch)}</p>
        <p className="text-sm text-muted-foreground">
          {episodes.length} episodes @ {formatNaira(pricesMatch / episodes.length)} each
        </p>
      </div>

      <div className="option featured">
        <Badge>Best Value</Badge>
        <h3>Full Season</h3>
        <p className="text-2xl font-bold text-green-600">
          {formatNaira(seasonPrice)}
        </p>
        <p className="text-sm text-green-600">
          Save {savingsPercent}% ({formatNaira(savings)})
        </p>
      </div>
    </div>
  );
}
```

---

## Advanced Patterns

### Pattern 5: Rental History & Management
```tsx
import { useOptimizedRentals } from '@/hooks/useOptimizedRentals';

export function RentalHistory() {
  const { rentals } = useOptimizedRentals();

  return (
    <div>
      <h2>Your Rentals</h2>
      <div className="rental-list">
        {rentals
          .filter(r => r.status === 'completed')
          .sorted((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map(rental => {
            const now = new Date().getTime();
            const expiry = new Date(rental.expires_at).getTime();
            const isExpired = expiry < now;
            const hoursLeft = Math.ceil((expiry - now) / (1000 * 60 * 60));

            return (
              <div key={rental.id} className={isExpired ? 'opacity-50' : ''}>
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">
                      {rental.content_type === 'season' ? 'Season' : 'Episode'} rental
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Paid: {formatNaira(rental.final_price)}
                    </p>
                  </div>
                  {!isExpired && (
                    <Badge className="h-fit">
                      {hoursLeft}h left
                    </Badge>
                  )}
                  {isExpired && (
                    <Badge variant="outline">Expired</Badge>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
```

### Pattern 6: Discount Code Validator
```tsx
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function ReferralCodeValidator({ price, onDiscount }) {
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateCode = async () => {
    if (!code.trim()) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: err } = await supabase
        .from('referral_codes')
        .select('discount_type, discount_value, is_active, valid_until')
        .eq('code', code.toUpperCase())
        .maybeSingle();

      if (err || !data || !data.is_active) {
        setError('Invalid code');
        return;
      }

      if (data.valid_until && new Date(data.valid_until) < new Date()) {
        setError('Code expired');
        return;
      }

      const discountAmount = data.discount_type === 'percentage'
        ? Math.floor(price * data.discount_value / 100)
        : Math.min(data.discount_value, price);

      setDiscount({
        code: code.toUpperCase(),
        type: data.discount_type,
        value: data.discount_value,
        amount: discountAmount,
      });

      onDiscount?.(discountAmount);
    } catch (err) {
      setError('Error validating code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {discount ? (
        <div className="p-3 bg-green-100 rounded">
          <p className="font-semibold">
            Code applied: {discount.code}
          </p>
          <p className="text-sm">
            Discount: -{formatNaira(discount.amount)}
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Input
              placeholder="Referral code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <Button
              onClick={validateCode}
              disabled={loading || !code.trim()}
            >
              {loading ? 'Checking...' : 'Apply'}
            </Button>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </>
      )}
    </div>
  );
}
```

### Pattern 7: Bulk Rental Processing
```tsx
import { useOptimizedRentals } from '@/hooks/useOptimizedRentals';

export function BulkCheckout({ episodes, paymentMethod }) {
  const { processRental } = useOptimizedRentals();
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState([]);

  const checkout = async () => {
    setIsProcessing(true);
    const processedResults = [];

    for (const episode of episodes) {
      try {
        const result = await processRental(
          episode.id,
          'episode',
          episode.price,
          paymentMethod
        );
        processedResults.push({
          episodeId: episode.id,
          success: result.success,
          error: result.error,
        });
      } catch (err) {
        processedResults.push({
          episodeId: episode.id,
          success: false,
          error: err.message,
        });
      }
    }

    setResults(processedResults);
    setIsProcessing(false);
  };

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  return (
    <div>
      {!results.length ? (
        <Button onClick={checkout} disabled={isProcessing}>
          {isProcessing ? 'Processing...' : 'Rent All'}
        </Button>
      ) : (
        <div>
          <p>✅ {successCount} rented successfully</p>
          {failureCount > 0 && <p>❌ {failureCount} failed</p>}
          <Button onClick={() => setResults([])}>Clear</Button>
        </div>
      )}
    </div>
  );
}
```

### Pattern 8: Access Control in Pages
```tsx
import { useOptimizedRentals } from '@/hooks/useOptimizedRentals';
import { Navigate } from 'react-router-dom';

export function ProtectedWatchPage({ episodeId }) {
  const { checkAccess } = useOptimizedRentals();
  const access = checkAccess(episodeId, 'episode');

  if (!access.hasAccess) {
    return <Navigate to={`/episode/${episodeId}`} />;
  }

  return (
    <div>
      {/* Watch page content */}
      <VideoPlayer episodeId={episodeId} />
      <p>Time remaining: {access.timeRemaining?.formatted}</p>
    </div>
  );
}
```

---

## Integration with TVShowPreview

### Full Integration Example
```tsx
import { OptimizedRentalButton } from '@/components/OptimizedRentalButton';
import { useOptimizedRentals } from '@/hooks/useOptimizedRentals';

export function TVShowPreviewSection({ season, episodes }) {
  const { checkSeasonAccess, checkAccess } = useOptimizedRentals();
  const seasonRented = checkSeasonAccess(season.id);

  // Season pricing option
  const RenderSeasonOption = () => (
    <div className="pricing-card">
      <Badge>Best Value</Badge>
      <h3>Full Season</h3>
      <p className="price">{formatNaira(season.price)}</p>
      <p className="episodes-count">{episodes.length} episodes</p>

      {seasonRented ? (
        <Button variant="default">
          ✓ You own this season
        </Button>
      ) : (
        <OptimizedRentalButton
          contentId={season.id}
          contentType="season"
          price={season.price}
          title={`Season ${season.season_number}`}
          onRentalSuccess={() => {
            // Refresh page or trigger state update
            window.location.reload();
          }}
        />
      )}
    </div>
  );

  // Episode list
  const RenderEpisodeList = () => (
    <div className="episodes-list">
      {episodes.map(ep => {
        const episodeAccess = checkAccess(ep.id, 'episode');
        const canWatch = seasonRented || episodeAccess.hasAccess;

        return (
          <div key={ep.id} className="episode-item">
            <div className="episode-info">
              <h4>Episode {ep.episode_number}: {ep.title}</h4>
              <p>{ep.description}</p>
            </div>

            {canWatch ? (
              <div>
                <Button
                  onClick={() => setSelectedEpisode(ep)}
                  className="watch-btn"
                >
                  ▶ Watch
                </Button>
                {episodeAccess.timeRemaining && (
                  <p className="timer">
                    ⏱️ {episodeAccess.timeRemaining.formatted}
                  </p>
                )}
              </div>
            ) : (
              <OptimizedRentalButton
                contentId={ep.id}
                contentType="episode"
                price={ep.price}
                title={`Episode ${ep.episode_number}: ${ep.title}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="tv-show-section">
      <RenderSeasonOption />
      <RenderEpisodeList />
    </div>
  );
}
```

---

## Testing The System

### Manual Test Checklist
```tsx
// Test 1: Episode Rental with Wallet
1. Browse to TV show
2. Click "Rent Episode - ₦100"
3. Select "Wallet" in checkout
4. Click "Pay ₦100"
5. Verify: Button changes to "Watch Now"
6. Verify: Time remaining shows "48h remaining"

// Test 2: Season Rental Unlocks Episodes
1. Click "Rent Season - ₦800"
2. Complete payment
3. View episodes in same season
4. Verify: All episodes show "Watch Now"
5. No individual episode rental needed

// Test 3: Referral Code Works
1. Start episode rental
2. Enter valid referral code
3. Click "Apply"
4. Verify: Discount shows in pricing
5. Verify: Final price is reduced
6. Complete payment
7. Verify: Usage tracked in DB

// Test 4: Error Handling
1. Try to rent without signing in → Redirect to auth
2. Try wallet payment with insufficient balance → Error message
3. Try invalid referral code → Error message
4. Try renting same episode twice → Already purchased message
```

---

## Customization Options

### Custom Price Display
```tsx
// Override price formatting
const CustomPriceDisplay = ({ price }) => (
  <div>
    <span className="currency">₦</span>
    <span className="amount">{(price / 100).toFixed(2)}</span>
  </div>
);
```

### Custom Discount Badge
```tsx
// Show discount in your own style
const CustomDiscount = ({ discount }) => (
  <div className="my-badge">
    <span className="save">SAVE</span>
    <span className="amount">{discount}%</span>
  </div>
);
```

### Custom Loading State
```tsx
// Override checkout dialog
<OptimizedRentalCheckout
  {...props}
  // Rental button customization
/>
```

---

**These patterns cover 90% of rental system use cases across the app.**
