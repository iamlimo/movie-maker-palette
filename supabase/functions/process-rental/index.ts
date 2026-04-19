import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const RENTAL_DURATION_HOURS = 48;
const SEASON_RENTAL_DURATION_HOURS = 720; // 30 days

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://signaturetv.co',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

// Helper function to get CORS headers based on origin
function getCorsHeaders(origin?: string) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin || '') 
    ? origin 
    : 'https://signaturetv.co';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
    'Content-Type': 'application/json',
  };
}

// Helper function to ensure CORS headers on all responses
function createResponse(data: unknown, status = 200, origin?: string) {
  return new Response(
    JSON.stringify(data),
    { status, headers: getCorsHeaders(origin) }
  );
}

interface ProcessRentalRequest {
  userId: string;
  contentId: string;
  contentType: 'episode' | 'season';
  price: number;
  paymentMethod: 'wallet' | 'paystack';
  referralCode?: string;
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('OK', {
      status: 200,
      headers: getCorsHeaders(origin),
    });
  }

  try {
    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let body: ProcessRentalRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return createResponse({ error: 'Invalid request body' }, 400, origin);
    }

    const { userId, contentId, contentType, price, paymentMethod, referralCode } = body;

    // Validate required fields
    if (!userId || !contentId || !contentType || !price || !paymentMethod) {
      return createResponse({ error: 'Missing required fields' }, 400, origin);
    }

    // Check for existing active rental
    const { data: existingRental } = await supabase
      .from('rentals')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .eq('status', 'completed')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingRental) {
      return createResponse({ error: 'User already has active rental for this content' }, 409, origin);
    }

    let finalPrice = price;
    let discountApplied = 0;

    // Apply referral code discount if provided
    if (referralCode) {
      const { data: codeData } = await supabase
        .from('referral_codes')
        .select('id, discount_type, discount_value')
        .eq('code', referralCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (codeData) {
        if (codeData.discount_type === 'percentage') {
          discountApplied = Math.floor(price * codeData.discount_value / 100);
        } else {
          discountApplied = Math.min(codeData.discount_value, price);
        }
        finalPrice = Math.max(0, price - discountApplied);

        // Record referral code usage
        await supabase.from('referral_code_uses').insert({
          code_id: codeData.id,
          user_id: userId,
          rental_id: undefined,
        });
      }
    }

    // Calculate expiration time based on content type
    const expiresAt = new Date();
    const durationHours = contentType === 'season' ? SEASON_RENTAL_DURATION_HOURS : RENTAL_DURATION_HOURS;
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    if (paymentMethod === 'wallet') {
      // Wallet payment - deduct from user's wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

      if (walletError) {
        console.error('Wallet query error:', walletError);
        return createResponse({ error: 'Failed to retrieve wallet', details: walletError.message }, 500, origin);
      }

      if (!wallet) {
        console.error('No wallet found for user:', userId);
        return createResponse({ error: 'Wallet not found' }, 404, origin);
      }

      // Ensure balance exists and is a valid number
      if (wallet.balance === null || wallet.balance === undefined) {
        console.error('Wallet balance is null/undefined for user:', userId);
        return createResponse({ error: 'Invalid wallet balance' }, 400, origin);
      }

      // Ensure balance is a number
      const walletBalance = typeof wallet.balance === 'string' 
        ? parseFloat(wallet.balance) 
        : Number(wallet.balance);

      if (isNaN(walletBalance)) {
        console.error('Wallet balance is NaN for user:', userId, 'Value:', wallet.balance);
        return createResponse({ error: 'Invalid wallet balance format' }, 400, origin);
      }

      if (walletBalance < finalPrice) {
        return createResponse({ error: 'Insufficient wallet balance' }, 402, origin);
      }

      // Create rental record
      console.log('Creating rental record for user:', userId, 'Content:', contentId);
      const { data: rental, error: rentalError } = await supabase
        .from('rentals')
        .insert({
          user_id: userId,
          content_id: contentId,
          content_type: contentType,
          price: finalPrice,
          payment_method: paymentMethod,
          status: 'completed',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (rentalError) {
        console.error('Rental creation error:', rentalError);
        console.error('Failed to create rental. Error details:', rentalError.message, 'Code:', rentalError.code);
        return createResponse({ error: 'Failed to create rental record', details: rentalError.message }, 500, origin);
      }

      // Deduct from wallet
      const newBalance = walletBalance - finalPrice;
      console.log('Updating wallet for user:', userId, 'New balance:', newBalance);
      
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Wallet update error:', updateError);
        console.error('Failed to update wallet for user:', userId, 'Error:', updateError.message);
        await supabase.from('rentals').delete().eq('id', rental.id);
        return createResponse({ error: 'Failed to process payment', details: updateError.message }, 500, origin);
      }

      // Update referral code usage with rental ID
      if (referralCode && discountApplied > 0) {
        const { data: codeData } = await supabase
          .from('referral_codes')
          .select('id')
          .eq('code', referralCode.toUpperCase())
          .maybeSingle();

        if (codeData) {
          await supabase
            .from('referral_code_uses')
            .update({ rental_id: rental.id })
            .eq('user_id', userId)
            .eq('code_id', codeData.id)
            .order('created_at', { ascending: false })
            .limit(1);
        }
      }

      return createResponse({
        success: true,
        rentalId: rental.id,
        paymentMethod: 'wallet',
        discountApplied,
      }, 200, origin);
    } else if (paymentMethod === 'paystack') {
      // Paystack payment - create payment record and generate authorization URL
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('email, raw_user_meta_data')
        .eq('id', userId)
        .maybeSingle();

      if (userError || !user) {
        return createResponse({ error: 'User profile not found' }, 404, origin);
      }

      // Create pending rental record
      const { data: rental, error: rentalError } = await supabase
        .from('rentals')
        .insert({
          user_id: userId,
          content_id: contentId,
          content_type: contentType,
          price: finalPrice,
          payment_method: paymentMethod,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (rentalError) {
        return createResponse({ error: 'Failed to create rental record' }, 500, origin);
      }

      // Get user's full name for Paystack
      const userData = user.raw_user_meta_data as any;
      const fullName = userData?.full_name || user.email?.split('@')[0] || 'Customer';

      // Initialize Paystack payment
      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          amount: finalPrice, // Already in kobo
          metadata: {
            rental_id: rental.id,
            content_id: contentId,
            content_type: contentType,
            discount_code: referralCode || null,
            discount_amount: discountApplied,
            user_name: fullName,
          },
          callback_url: `${SUPABASE_URL}/verify-rental-payment?rental_id=${rental.id}`,
        }),
      });

      if (!paystackResponse.ok) {
        const error = await paystackResponse.json();
        console.error('Paystack error:', error);
        await supabase.from('rentals').delete().eq('id', rental.id);
        return createResponse({ error: 'Failed to initialize payment' }, 500, origin);
      }

      const paystackData = await paystackResponse.json();

      // Create rental_payments tracking record
      const { error: paymentTrackError } = await supabase
        .from('rental_payments')
        .insert({
          rental_id: rental.id,
          user_id: userId,
          paystack_reference: paystackData.data.reference,
          paystack_access_code: paystackData.data.access_code,
          amount: finalPrice,
          payment_status: 'pending',
        });

      if (paymentTrackError) {
        console.error('Payment tracking error:', paymentTrackError);
      }

      return createResponse({
        success: true,
        rentalId: rental.id,
        paymentMethod: 'paystack',
        authorizationUrl: paystackData.data.authorization_url,
        paystackReference: paystackData.data.reference,
        discountApplied,
      }, 200, origin);
    }

    return createResponse({ error: 'Invalid payment method' }, 400, origin);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Error in process-rental:', errorMessage);
    console.error('Error stack:', errorStack);
    return createResponse({ 
      error: 'Internal server error',
      details: errorMessage 
    }, 500, origin);
  }
});
