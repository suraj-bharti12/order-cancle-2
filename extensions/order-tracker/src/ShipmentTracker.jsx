import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

// Wahi URL jo baaki extension files mein hai
const APP_URL = "https://order-cancel-bvkc.onrender.com";

const STEPS = ["Confirmed", "Shipped", "Delivered"];

const numericId = (gid) => String(gid || "").split("/").pop().split("?")[0];

export default async () => {
  render(<ShipmentTracker />, document.body);
};

// Har shipment (fulfillment) card ke andar uska apna tracker
function ShipmentTracker() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const orderId = shopify.order.value?.id;
        const fulfillmentId = shopify.fulfillmentId; // ye card kis shipment ka hai
        if (!orderId || !fulfillmentId) return;

        const token = await shopify.sessionToken.get();
        const res = await fetch(
          `${APP_URL}/api/order-cancel?orderId=${encodeURIComponent(orderId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;

        const data = await res.json();
        const match = (data.fulfillments || []).find(
          (f) => numericId(f.fulfillmentId) === numericId(fulfillmentId),
        );
        if (match) setStep(match.stage >= 4 ? 3 : 2);
      } catch (error) {
        console.error("[shipment-tracker] failed", error);
      }
    }
    load();
  }, []);

  if (step < 1) return null;
  return <Steps step={step} />;
}

function Steps({ step }) {
  return (
    <s-stack gap="small-200">
      <s-progress
        value={step}
        max={STEPS.length}
        accessibilityLabel={`Shipment status: ${STEPS[step - 1]}`}
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