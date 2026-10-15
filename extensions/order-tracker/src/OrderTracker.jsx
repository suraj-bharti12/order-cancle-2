import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

// Wahi URL jo CancelMenuItem.jsx aur CancelModal.jsx mein hai
const APP_URL = "https://order-cancel-bvkc.onrender.com";

// Customer ko warehouse ka naam dikhana hai ya nahi
const SHOW_WAREHOUSE = true;

const STEPS = ["Order Confirmed", "Shipped", "Delivered"];

// Server stage (1 Confirmed, 3 Shipped, 4 Delivered) -> tracker step (1-3)
function toStep(stage) {
  if (stage >= 4) return 3;
  if (stage === 3) return 2;
  return 1;
}

export default async () => {
  render(<OrderTracker />, document.body);
};

function OrderTracker() {
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    async function load() {
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
        setShipments(Array.isArray(data.shipments) ? data.shipments : []);
      } catch (error) {
        console.error("[order-tracker] failed", error);
      }
    }
    load();
  }, []);

  // Cancelled order, error, ya loading -> kuch nahi dikhega
  if (!shipments.length) return null;

  const total = shipments.length;

  return (
    <s-section heading="Track your order">
      <s-stack gap="large">
        {shipments.map((s, index) => (
          <s-stack key={s.id} gap="small-200">
            {index > 0 && <s-divider></s-divider>}
            <Shipment shipment={s} number={index + 1} total={total} />
          </s-stack>
        ))}
      </s-stack>
    </s-section>
  );
}

function Shipment({ shipment, number, total }) {
  const step = toStep(Number(shipment.stage) || 1);
  const title = total > 1 ? `Shipment ${number} of ${total}` : "Shipment";

  // Courier aur tracking number, ya "Not shipped yet"
  const courierLine = shipment.courier || shipment.trackingNumber
    ? [shipment.courier, shipment.trackingNumber && `Tracking: ${shipment.trackingNumber}`]
        .filter(Boolean)
        .join(" · ")
    : step === 1
      ? "Not shipped yet"
      : "";

  return (
    <s-stack gap="small-200">
      <s-text type="strong">{title}</s-text>

      {shipment.items && <s-text>{shipment.items}</s-text>}

      {courierLine && <s-text color="subdued">{courierLine}</s-text>}

      {SHOW_WAREHOUSE && shipment.warehouse && (
        <s-text color="subdued">From: {shipment.warehouse}</s-text>
      )}

      <s-progress
        value={step}
        max={STEPS.length}
        accessibilityLabel={`${title}: step ${step} of ${STEPS.length}, ${STEPS[step - 1]}`}
      ></s-progress>

      <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="small-200">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step - 1;
          return (
            <s-stack key={label} alignItems="center" gap="small-200">
              <s-icon
                type={done ? "check-circle" : "circle"}
                tone={done ? "success" : "neutral"}
                size="small"
              ></s-icon>
              <s-text type={current ? "strong" : undefined} color={done ? undefined : "subdued"}>
                {label}
              </s-text>
            </s-stack>
          );
        })}
      </s-grid>

      {shipment.trackingUrl && (
        <s-link href={shipment.trackingUrl} target="_blank">
          Track package
        </s-link>
      )}
    </s-stack>
  );
}