import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

// Wahi URL jo CancelMenuItem.jsx aur CancelModal.jsx mein hai
const APP_URL = "https://order-cancel-bvkc.onrender.com";

const STEPS = ["Order Confirmed", "Ready to Ship", "Shipped", "Delivered"];

export default async () => {
  render(<OrderTracker />, document.body);
};

function OrderTracker() {
  const [stage, setStage] = useState(0); // 0 = abhi pata nahi / dikhana nahi

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
        setStage(Number(data.stage) || 0);
      } catch (error) {
        console.error("[order-tracker] failed", error);
      }
    }
    loadStage();
  }, []);

  // DEBUG: editor mein block dikhne ke liye. Testing ke baad isse `return null;` kar dena.
    if (stage < 1) return null;

  return (
    <s-section heading="Track your order">
      <s-stack gap="base">
               <s-progress
          value={stage}
          max={STEPS.length}
          accessibilityLabel={`Step ${stage} of ${STEPS.length}: ${STEPS[stage - 1]}`}
        ></s-progress>

        <s-grid gridTemplateColumns="1fr 1fr 1fr 1fr" gap="small-200">
          {STEPS.map((label, index) => {
            const done = index < stage;
            const current = index === stage - 1;
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