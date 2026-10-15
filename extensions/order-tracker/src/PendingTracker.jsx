import "@shopify/ui-extensions/preact";
import { render } from "preact";

const STEPS = ["Confirmed", "Shipped", "Delivered"];

export default async () => {
  render(<PendingTracker />, document.body);
};

// Jo items abhi ship nahi hue (unfulfilled), unke card mein "Confirmed" tracker.
// Server call ki zaroorat nahi: unfulfilled = abhi Confirmed stage.
function PendingTracker() {
  const order = shopify.order.value;
  if (!order || order.cancelledAt) return null;

  const step = 1;
  return (
    <s-stack gap="small-200">
      <s-progress
        value={step}
        max={STEPS.length}
        accessibilityLabel="Shipment status: Confirmed"
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