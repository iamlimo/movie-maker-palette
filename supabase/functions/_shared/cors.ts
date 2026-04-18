// Shared CORS utilities for edge functions

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '3600',
};

export const corsHeadersWithContentType = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeadersWithContentType,
  });
}

export function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status,
    headers: corsHeadersWithContentType,
  });
}

export function handleOptions(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response('OK', {
      status: 200,
      headers: corsHeadersWithContentType,
    });
  }
  return null;
}