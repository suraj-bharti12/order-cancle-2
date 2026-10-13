import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

// Wahi URL jo CancelMenuItem.jsx aur CancelModal.jsx mein hai
const APP_URL = "https://order-cancel-bvkc.onrender.com";

const STEPS = ["Order Confirmed", "Shipped", "Delivered"];

// Server stage (1 Confirmed, 2 Ready to Ship, 3 Shipped, 4 Delivered) -> tracker step (1-3)
function toStep(stage) {
  if (stage >= 4) return 3; // Delivered
  if (stage === 3) return 2; // Shipped
  if (stage >= 1) return 1; // Confirmed (Ready to Ship bhi isi mein)
  return 0;
}

export default async () => {
  render(<OrderTracker />, document.body);
};

function OrderTracker() {
  const [step, setStep] = useState(0); // 0 = abhi pata nahi / dikhana nahi

  useEffect(() => {
    async function loadStage() {
      try {
        const orderId = shopify.order.value?.id;
        if (!orderId) return;

        const token = await shopify.sessionToken.get();
        const res = await fetch(
          `${APP_URL}/api/order-cancel?orderId=${encodeURIComponent(orderId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;

        const data = await res.json();
        setStep(toStep(Number(data.stage) || 0));
      } catch (error) {
        console.error("[order-tracker] failed", error);
      }
    }
    loadStage();
  }, []);

  // Cancelled order, error, ya loading -> tracker nahi dikhega
  if (step < 1) return null;

  return (
    <s-section heading="Track your order">
      <s-stack gap="base">
        <s-progress
          value={step}
          max={STEPS.length}
          accessibilityLabel={`Step ${step} of ${STEPS.length}: ${STEPS[step - 1]}`}
        ></s-progress>

        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="small-200">
          {STEPS.map((label, index) => {
            const done = index < step;
            const current = index === step - 1;
            return (
              <s-stack key={label} alignItems="center" gap="small-200">
                <s-icon type={done ? "check-circle" : "circle"} tone={done ? "success" : "neutral"}></s-icon>
                <s-text type={current ? "strong" : undefined} color={done ? undefined : "subdued"}>
                  {label}
                </s-text>
              </s-stack>
            );
          })}
        </s-grid>
      </s-stack>
    </s-section>
  );
}