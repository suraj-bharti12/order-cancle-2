import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

// Wahi URL jo baaki extension files mein hai
const APP_URL = "https://order-cancel-bvkc.onrender.com";

const STEPS = ["Confirmed", "Shipped", "Delivered"];

// Server stage (1 Confirmed, 3 Shipped, 4 Delivered) -> tracker step (1-3)
function toStep(stage) {
  if (stage >= 4) return 3;
  if (stage === 3) return 2;
  if (stage >= 1) return 1;
  return 0;
}

const numericId = (gid) => String(gid || "").split("/").pop().split("?")[0];

export default async () => {
  render(<OrderItemTracker />, document.body);
};

function OrderItemTracker() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const orderId = shopify.order.value?.id;
        const line = shopify.target.value; // ye extension jis item ke neeche hai
        if (!orderId || !line) return;

        const token = await shopify.sessionToken.get();
        const res = await fetch(
          `${APP_URL}/api/order-cancel?orderId=${encodeURIComponent(orderId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;

        const data = await res.json();
        const lines = data.lines || [];

        // Pehle line item ID se match karo, na mile to product variant se
        const match =
          lines.find((l) => numericId(l.lineItemId) === numericId(line.id)) ||
          lines.find((l) => l.variantId && l.variantId === line.merchandise?.id);

        if (match) setStep(toStep(match.stage));
      } catch (error) {
        console.error("[order-item-tracker] failed", error);
      }
    }
    load();
  }, []);

  // Cancelled order, ya match na mile -> kuch nahi dikhega
  if (step < 1) return null;

  return (
    <s-stack gap="small-200">
      <s-progress
        value={step}
        max={STEPS.length}
        accessibilityLabel={`Item status: ${STEPS[step - 1]}`}
      ></s-progress>
      <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="small-300">
        {STEPS.map((label, index) => {
          const done = index < step;
          const current = index === step - 1;
          return (
            <s-stack key={label} direction="inline" alignItems="center" gap="small-300">
              <s-icon
                size="small"
                type={done ? "check-circle" : "circle"}
                tone={done ? "success" : "neutral"}
              ></s-icon>
              <s-text type={current ? "strong" : undefined} color={done ? undefined : "subdued"}>
                {label}
              </s-text>
            </s-stack>
          );
        })}
      </s-grid>
    </s-stack>
  );
}