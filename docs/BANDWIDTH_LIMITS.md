# Backblaze B2 Bandwidth Limits

## Current Setup
- **Plan**: Backblaze B2 Free Tier
- **Daily Download Bandwidth**: 1 GB per calendar day
- **Bandwidth Resets**: Midnight UTC daily
- **Current Status**: Bandwidth limits enforced and monitored

## How Bandwidth Limits Work

### Free Tier Limits
- 1 GB of free download bandwidth per day
- Once exceeded, downloads return HTTP 503 (Service Unavailable) or 429 (Too Many Requests)
- Bandwidth counter resets automatically at midnight UTC
- The limit applies to all downloads from your B2 account

### Paid Plan Options
| Plan | Monthly Cost | Download Bandwidth |
|------|-------------|-------------------|
| Free | $0 | 1 GB/day (free) + overage |
| Pay-as-you-go | Variable | Unlimited (charged per GB) |
| Prepaid | $97/month | 500 GB/month (20% savings) |
| 1TB Bundle | $97/month | 1 TB/month storage + included bandwidth |

**See**: https://www.backblaze.com/b2/cloud-storage-pricing.html

## Fallback Strategy

When Backblaze bandwidth is exceeded, the system automatically falls back to **Supabase Storage** for video delivery. This ensures users can continue watching videos even when B2 bandwidth limits are reached.

### How It Works
1. `get-video-url` edge function attempts to generate a signed URL from Backblaze B2
2. If B2 returns 503/429, the function automatically falls back to Supabase storage
3. Users see a notification: "Using backup server due to bandwidth limits"
4. Video playback continues seamlessly on Supabase infrastructure

### Response Headers
- `X-Bandwidth-Limited: true` — Indicates B2 bandwidth limit was triggered
- `Cache-Control: public, max-age=3600` — Allows client-side caching to reduce requests

## Client-Side Optimizations

### URL Caching
- Signed URLs are cached in browser memory per video
- Reduces unnecessary edge function calls
- Cache expires 1 second before signed URL validity period

### Bandwidth Monitoring
- VideoPlayer component detects bandwidth limit responses
- Displays user-friendly warning banner
- Toast notification explains the situation

## Recommendations

### Short-term (Current)
✅ **Active**: Fallback to Supabase when B2 bandwidth exceeded
✅ **Active**: Client-side URL caching to minimize requests
✅ **Active**: Bandwidth-aware error responses with helpful messages

### Medium-term (Next 1-3 months)
- Monitor daily bandwidth usage patterns
- Estimate costs for upgrading B2 plan
- Consider usage spikes (peak viewing times, marketing campaigns)

### Long-term (3-6 months)
If consistent bandwidth exceeds 1 GB daily:
1. **Upgrade B2**: Switch to pay-as-you-go or prepaid plan
2. **Use CDN**: Add Cloudflare or Bunny CDN for edge caching
3. **Supabase Storage**: Move all videos to Supabase (included in tier)
4. **Hybrid Approach**: Hot content on B2, archive on Supabase

## Monitoring & Alerts

### Check B2 Usage
1. Log in to Backblaze B2 console
2. Go to **Account Settings** → **Bandwidth Usage**
3. View daily/monthly bandwidth consumption

### Edge Function Logs
Enable Supabase function logs to see:
- When B2 fallback is triggered
- Bandwidth limit status
- Source of video URL (Backblaze vs Supabase)

```sql
-- Query edge function logs
SELECT
  created_at,
  function_name,
  status_code,
  execution_duration_ms,
  error_message
FROM edge_function_logs
WHERE function_name = 'get-video-url'
ORDER BY created_at DESC
LIMIT 100;
```

## Upgrading B2 Plan

### Steps
1. Go to https://www.backblaze.com/b2/plans.html
2. Select appropriate plan for expected usage
3. Update billing information
4. B2 credentials remain unchanged (no code updates needed)

### Cost Estimation Example
- **Current**: 1 GB/day × 30 days = 30 GB/month
  - Free tier: 1 GB free daily + overage charges
  - Total overage: 29 GB × $0.006/GB = ~$0.17/month
  
- **Upgrade**: Prepaid plan
  - $97/month for 500 GB bandwidth
  - Sufficient for ~16.7 GB/day

## Testing Bandwidth Limits

To test fallback behavior locally:
```typescript
// In get-video-url/index.ts, temporarily simulate bandwidth limit
if (true) { // Change to test
  return new Response(
    JSON.stringify({ error: 'Simulated bandwidth limit' }),
    { status: 503, headers: { ...corsHeaders, 'X-Bandwidth-Limited': 'true' } }
  );
}
```

## References
- [Backblaze B2 Pricing](https://www.backblaze.com/b2/cloud-storage-pricing.html)
- [B2 Download Authorization](https://www.backblaze.com/b2/docs/b2_get_download_authorization.html)
- [B2 API Rate Limits](https://www.backblaze.com/b2/docs/api/rate-limits.html)
- [Backblaze Status Page](https://status.backblaze.com/)
