"use client";

/**
 * Stripe's checkout, embedded in our own page.
 *
 * `EmbeddedCheckoutProvider` renders Stripe's iframe inline, so the customer
 * never leaves zaffarology.com. The client secret comes from OUR backend, which
 * created the session — the browser never talks to Stripe's API directly, and
 * never sees a secret key.
 *
 * `onComplete` fires when payment succeeds, but it is NOT what grants access:
 * the webhook is. This just tells the page to start asking the backend whether
 * the entitlement has landed yet, so the customer is not left staring at a
 * finished form.
 */

import { useCallback, useEffect, useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";

import { Loading } from "@/components/ui";
import { apiErrorMessage } from "@/lib/api";
import { startCheckout, stripeFor } from "@/lib/stripe";

export function StripeCheckout({
  fullName,
  returnUrl,
  onComplete,
  onError,
}: {
  fullName: string;
  returnUrl: string;
  onComplete: (sessionId: string) => void;
  onError: (message: string) => void;
}) {
  const [stripe, setStripe] = useState<ReturnType<typeof stripeFor> | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /* The session is created ONCE, on mount. `fetchClientSecret` would re-run on
     every re-render, and each call creates a new Stripe session — so a page
     that re-renders while someone types their card would abandon the session
     under them. */
  useEffect(() => {
    let alive = true;
    startCheckout(returnUrl, fullName)
      .then((res) => {
        if (!alive) return;
        setStripe(stripeFor(res.publishable_key));
        setSecret(res.client_secret);
        setSessionId(res.session_id);
      })
      .catch((err) => {
        if (!alive) return;
        const message = apiErrorMessage(err, "Could not open checkout. Please try again.");
        setFailed(message);
        onError(message);
      });
    return () => {
      alive = false;
    };
    // Deliberately once: see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const complete = useCallback(() => {
    if (sessionId) onComplete(sessionId);
  }, [sessionId, onComplete]);

  if (failed) {
    return (
      <p role="alert" className="rounded-xl border border-danger bg-danger/5 px-4 py-3 text-[13.5px] font-semibold text-danger">
        {failed}
      </p>
    );
  }

  if (!stripe || !secret) return <Loading full={false} label="Opening checkout" />;

  return (
    /* Stripe's iframe brings its own white surface and its own theme, so it
       sits in a plain bordered box rather than one of our cards — a card's
       padding and background would frame it twice. */
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <EmbeddedCheckoutProvider
        stripe={stripe}
        options={{ clientSecret: secret, onComplete: complete }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
