const PAYSTACK_API_URL = "https://api.paystack.co";

export async function fetchPaystackTransaction(reference: string, paystackKey: string) {
  const response = await fetch(`${PAYSTACK_API_URL}/transaction/verify/${reference}`, {
    headers: {
      Authorization: `Bearer ${paystackKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Paystack API error: ${response.statusText}`);
  }

  return response.json();
}

export type SyncPaymentRecordParams = {
  reference: string;
  success: boolean;
  paidAmount: number;
  channel: string;
  paystackStatus: string;
  failureReason?: string | null;
  rawEvent: Record<string, unknown>;
};

/**
 * Shared logic used by:
 * - paystack-webhook (direct webhook events)
 * - admin-sync-paystack (admin-triggered verification/sync)
 *
 * Updates canonical `payments` row and handles wallet credits for successful top-ups exactly once.
 */
export async function syncPaymentRecord(
  supabase: any,
  params: SyncPaymentRecordParams,
): Promise<void> {
  try {
    const { data: payment, error: lookupErr } = await supabase
      .from("payments")
      .select("id, user_id, purpose, amount, enhanced_status, status, metadata")
      .or(`intent_id.eq.${params.reference},provider_reference.eq.${params.reference}`)
      .maybeSingle();

    if (lookupErr) {
      console.warn("[paystack-sync] payment lookup failed:", lookupErr.message);
      return;
    }
    if (!payment) {
      console.log("[paystack-sync] no payment row for reference:", params.reference);
      return;
    }

    const alreadyCompleted =
      payment.enhanced_status === "completed" || payment.status === "completed";

    const nextStatus = params.success ? "completed" : "failed";
    const nextEnhanced = params.success ? "completed" : "failed";

    const mergedMeta: Record<string, unknown> = {
      ...(payment.metadata as Record<string, unknown> | null ?? {}),
      paystack_channel: params.channel,
      paystack_status: params.paystackStatus,
      paystack_paid_amount: params.paidAmount,
      paystack_event_at: new Date().toISOString(),
      ...(params.failureReason ? { paystack_failure_reason: params.failureReason } : {}),
    };

    const { error: updErr } = await supabase
      .from("payments")
      .update({
        status: nextStatus,
        enhanced_status: nextEnhanced,
        provider_reference: params.reference,
        method: params.channel,
        error_message: params.success ? null : (params.failureReason ?? "Charge failed"),
        metadata: mergedMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (updErr) {
      console.warn("[paystack-sync] payment update failed:", updErr.message);
    }

    // Credit wallet for top-ups — only if not already completed.
    if (params.success && payment.purpose === "wallet_topup" && !alreadyCompleted) {
      const { data: wallet, error: walletErr } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", payment.user_id)
        .maybeSingle();

      if (walletErr) {
        console.error("[paystack-sync] wallet lookup failed:", walletErr.message);
      }

      let walletId = wallet?.id as string | undefined;
      if (!walletId) {
        const { data: newWalletId } = await supabase.rpc("ensure_wallet_for_user", {
          p_user_id: payment.user_id,
        });
        walletId = newWalletId as string | undefined;
      }

      if (!walletId) {
        console.error(
          "[paystack-sync] wallet not found and could not be created for",
          payment.user_id,
        );
        return;
      }

      const { error: creditErr } = await supabase.rpc("credit_wallet", {
        p_wallet_id: walletId,
        p_amount: params.paidAmount,
        p_type: "wallet_topup",
        p_reference: params.reference,
        p_description: "Paystack wallet top-up",
        p_metadata: { channel: params.channel, source: "paystack-webhook" },
        p_user_id: payment.user_id,
        p_payment_id: payment.id,
      });

      if (creditErr) {
        const msg = String(creditErr.message || "");
        if (creditErr.code === "23505" || /duplicate|already/i.test(msg)) {
          console.log("[paystack-sync] wallet credit already applied for", params.reference);
        } else {
          console.error("[paystack-sync] wallet credit failed:", msg);
        }
      } else {
        console.log(
          `[paystack-sync] wallet credited: user=${payment.user_id} amount=${params.paidAmount} ref=${params.reference}`,
        );
      }
    }
  } catch (err) {
    console.error("[paystack-sync] syncPaymentRecord exception:", err);
  }
}
