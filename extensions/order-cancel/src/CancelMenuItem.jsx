import "@shopify/ui-extensions/preact";
import { render } from "preact";

const APP_URL = "https://apply-lyrics-delivery-inspection.trycloudflare.com";

export default async () => {
  let data = { cancellable: false, state: "UNKNOWN" };

  try {
    const token = await shopify.sessionToken.get();
    const res = await fetch(
      `${APP_URL}/api/order-cancel?orderId=${encodeURIComponent(shopify.orderId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) data = await res.json();
  } catch (error) {
    console.error("[order-cancel] status check failed", error);
  }

  render(<CancelButton data={data} />, document.body);
};

function CancelButton({ data }) {
  // Cancelled order par button nahi dikhega
  if (data.state === "CANCELLED") return null;

  // Ready to ship -> disabled
  if (!data.cancellable) {
    return (
      <s-button
        disabled
        accessibilityLabel="Cancellation is not available because this order is ready to ship"
      >
        Cancel order
      </s-button>
    );
  }

  return <s-button>Cancel order</s-button>;
}