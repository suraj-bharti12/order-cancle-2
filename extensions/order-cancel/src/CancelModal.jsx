import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

// Wahi URL jo CancelMenuItem.jsx mein daala hai
const APP_URL = "https://apply-lyrics-delivery-inspection.trycloudflare.com";

const REASONS = [
  "Ordered by mistake",
  "Changed my mind",
  "Want a different size or colour",
  "Delivery is taking too long",
  "Found a better price elsewhere",
  "Other",
];

async function callServer(method, body) {
  const token = await shopify.sessionToken.get();
  const url =
    method === "GET"
      ? `${APP_URL}/api/order-cancel?orderId=${encodeURIComponent(shopify.orderId)}`
      : `${APP_URL}/api/order-cancel`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Request failed");
    err.data = data;
    throw err;
  }
  return data;
}

export default async () => {
  render(<CancelModal />, document.body);
};

function CancelModal() {
  // checking | ready | submitting | done | blocked | error
  const [step, setStep] = useState("checking");
  const [reason, setReason] = useState(REASONS[0]);
  const [message, setMessage] = useState("");

  // Popup khulte hi dobara check (beech mein ready to ship ho gaya ho to)
  useEffect(() => {
    callServer("GET")
      .then((data) => {
        if (data.cancellable) {
          setStep("ready");
        } else {
          setMessage(data.message || "This order can no longer be cancelled.");
          setStep("blocked");
        }
      })
      .catch(() => {
        setMessage("We couldn't check this order right now. Please try again.");
        setStep("error");
      });
  }, []);

  async function onConfirm() {
    setStep("submitting");
    try {
      const data = await callServer("POST", { orderId: shopify.orderId, reason });
      setMessage(data.message || "Your order has been cancelled.");
      setStep("done");
    } catch (error) {
      setMessage(error.data?.message || "Something went wrong. Please try again.");
      setStep(error.data?.state === "READY_TO_SHIP" ? "blocked" : "error");
    }
  }

  const showForm = step === "ready" || step === "submitting";

  return (
    <s-customer-account-action heading="Cancel order">
      {step === "checking" && (
        <s-stack direction="inline" alignItems="center" gap="base">
          <s-spinner accessibilityLabel="Checking order status" />
          <s-text>Checking order status…</s-text>
        </s-stack>
      )}

      {showForm && (
        <s-stack gap="base">
          <s-paragraph>
            Are you sure you want to cancel this order? This can't be undone.
            If you've already paid, the refund goes back to your original payment method.
          </s-paragraph>
          <s-select
            label="Reason for cancellation"
            value={reason}
            disabled={step === "submitting"}
            onChange={(e) => setReason(e.target.value)}
          >
            {REASONS.map((r) => (
              <s-option key={r} value={r}>
                {r}
              </s-option>
            ))}
          </s-select>
        </s-stack>
      )}

      {step === "blocked" && <s-banner tone="warning">{message}</s-banner>}
      {step === "error" && <s-banner tone="critical">{message}</s-banner>}
      {step === "done" && <s-banner tone="success">{message}</s-banner>}

      {showForm && (
        <s-button
          slot="primary-action"
          tone="critical"
          loading={step === "submitting"}
          onClick={onConfirm}
        >
          Yes, cancel order
        </s-button>
      )}

      {step === "done" ? (
        <s-button slot="primary-action" onClick={() => shopify.close()}>
          Done
        </s-button>
      ) : (
        <s-button
          slot="secondary-actions"
          disabled={step === "submitting"}
          onClick={() => shopify.close()}
        >
          Keep order
        </s-button>
      )}
    </s-customer-account-action>
  );
}