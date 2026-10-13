import { authenticate, unauthenticated } from "../shopify.server";

// ============================================================
// READY TO SHIP RULES: condition badalni ho to sirf yahan badlein.
// Inme se koi bhi ek match hua to cancel band.
// ============================================================

// 1) Order par ye tag laga ho (Render -> Environment -> READY_TO_SHIP_TAGS se aata hai)
const READY_TO_SHIP_TAGS = (process.env.READY_TO_SHIP_TAGS || "ready-to-ship,ready to ship,ready_to_ship,rts")
  .split(",")
  .map((t) => t.trim().toLowerCase())
  .filter(Boolean);

// 2) Shopify ka fulfillment status
const BLOCKING_FULFILLMENT_STATUSES = ["IN_PROGRESS", "PARTIALLY_FULFILLED", "FULFILLED"];

// 3) Fulfillment order status / 3PL ne order accept kar liya
const BLOCKING_FULFILLMENT_ORDER_STATUSES = ["IN_PROGRESS", "CLOSED"];
const BLOCKING_REQUEST_STATUSES = ["ACCEPTED"];

// ============================================================
// ORDER TRACKER STAGES (Order Confirmed -> Ready to Ship -> Shipped -> Delivered)
// ============================================================

const tagList = (envValue, fallback) =>
  (envValue || fallback)
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

// Ye tags lage hon to "Shipped" / "Delivered" maana jayega (Render env se badal sakte hain)
const SHIPPED_TAGS = tagList(process.env.SHIPPED_TAGS, "shipped,dispatched");
const DELIVERED_TAGS = tagList(process.env.DELIVERED_TAGS, "delivered");

// Courier ne Shopify mein shipment status update kiya ho
const SHIPPED_DISPLAY_STATUSES = [
  "CARRIER_PICKED_UP",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "ATTEMPTED_DELIVERY",
  "DELAYED",
  "NOT_DELIVERED",
  "DELIVERED",
];

// ============================================================

const ORDER_QUERY = `#graphql
  query CancelEligibility($id: ID!) {
    order(id: $id) {
      id
      name
      cancelledAt
      closed
      tags
      displayFinancialStatus
      displayFulfillmentStatus
      customer { id }
      lineItems(first: 50) { nodes { isGiftCard } }
      fulfillments(first: 10) { id status displayStatus }
      fulfillmentOrders(first: 20) { nodes { id status requestStatus } }
    }
  }
`;

const CANCEL_MUTATION = `#graphql
  mutation CancelOrder($orderId: ID!, $refundMethod: OrderCancelRefundMethodInput, $staffNote: String) {
    orderCancel(
      orderId: $orderId
      reason: CUSTOMER
      restock: true
      notifyCustomer: true
      refundMethod: $refundMethod
      staffNote: $staffNote
    ) {
      job { id done }
      orderCancelUserErrors { field message code }
    }
  }
`;

const TAGS_ADD_MUTATION = `#graphql
  mutation AddCancelTags($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      node { id }
      userErrors { field message }
    }
  }
`;

const TAGS_REMOVE_MUTATION = `#graphql
  mutation RemoveCancelTags($id: ID!, $tags: [String!]!) {
    tagsRemove(id: $id, tags: $tags) {
      node { id }
      userErrors { field message }
    }
  }
`;

const JOB_QUERY = `#graphql
  query JobStatus($id: ID!) {
    job(id: $id) { id done }
  }
`;

// orderCancel background job hai -> poora hone tak wait karo (max ~8 sec),
// taaki customer ka page refresh ho to order "Canceled" hi dikhe
async function waitForJob(admin, job) {
  if (!job?.id || job.done) return;
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await admin.graphql(JOB_QUERY, { variables: { id: job.id } });
      const { data } = await res.json();
      if (data?.job?.done) return;
    } catch (error) {
      console.error("[order-cancel] job check failed", error);
      return;
    }
  }
}

const ACCOUNT_URL_QUERY = `#graphql
  query AccountUrl {
    shop {
      customerAccountsV2 { url }
    }
  }
`;

// Customer account ke orders page ka poora URL (jaise https://shopify.com/123/account/orders)
async function getOrdersUrl(admin) {
  try {
    const res = await admin.graphql(ACCOUNT_URL_QUERY);
    const { data } = await res.json();
    const base = data?.shop?.customerAccountsV2?.url;
    return base ? `${String(base).replace(/\/$/, "")}/orders` : null;
  } catch (error) {
    console.error("[order-cancel] account url failed", error);
    return null;
  }
}

const READY_MSG =
  "Your order is ready to ship, so it can no longer be cancelled. You can request a return once it's delivered.";

const PAID_STATUSES = ["PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED"];

const lowerTags = (order) => (order.tags || []).map((t) => t.trim().toLowerCase());
const successfulFulfillments = (order) => (order.fulfillments || []).filter((f) => f.status === "SUCCESS");

// Order "ready to ship" stage par pahunch gaya hai ya nahi
function isReadyToShip(order) {
  const tags = lowerTags(order);
  if (READY_TO_SHIP_TAGS.some((t) => tags.includes(t))) return true;
  if (BLOCKING_FULFILLMENT_STATUSES.includes(order.displayFulfillmentStatus)) return true;
  if (successfulFulfillments(order).length > 0) return true;
  return (order.fulfillmentOrders?.nodes || []).some(
    (fo) =>
      BLOCKING_FULFILLMENT_ORDER_STATUSES.includes(fo.status) ||
      BLOCKING_REQUEST_STATUSES.includes(fo.requestStatus),
  );
}

// Tracker ke liye stage: 1 Confirmed, 2 Ready to Ship, 3 Shipped, 4 Delivered
function getStage(order) {
  const tags = lowerTags(order);
  const fulfillments = successfulFulfillments(order);

  const delivered =
    DELIVERED_TAGS.some((t) => tags.includes(t)) ||
    (order.displayFulfillmentStatus === "FULFILLED" &&
      fulfillments.length > 0 &&
      fulfillments.every((f) => f.displayStatus === "DELIVERED"));
  if (delivered) return 4;

  const shipped =
    SHIPPED_TAGS.some((t) => tags.includes(t)) ||
    fulfillments.some((f) => SHIPPED_DISPLAY_STATUSES.includes(f.displayStatus));
  if (shipped) return 3;

  if (isReadyToShip(order)) return 2;
  return 1;
}

// Order dekh kar decide karo: cancel ho sakta hai ya nahi
function checkOrder(order, customerId) {
  // Order isi logged-in customer ka hona chahiye
  if (!order || !customerId || order.customer?.id !== customerId) {
    return { cancellable: false, state: "NOT_ALLOWED", message: "Order not found." };
  }
  if (order.cancelledAt) {
    return { cancellable: false, state: "CANCELLED", message: "This order is already cancelled." };
  }
  if (order.closed) {
    return { cancellable: false, state: "NOT_ALLOWED", message: "This order can no longer be cancelled." };
  }

  // Gift card wale orders cancel nahi honge
  if ((order.lineItems?.nodes || []).some((li) => li.isGiftCard)) {
    return { cancellable: false, state: "NOT_ALLOWED", message: "Gift card orders can't be cancelled." };
  }

  if (isReadyToShip(order)) {
    return { cancellable: false, state: "READY_TO_SHIP", message: READY_MSG };
  }

  return { cancellable: true, state: "OPEN", message: "" };
}

// Shopify se order laao aur check karo
async function loadOrder(sessionToken, orderId) {
  if (typeof orderId !== "string" || !/^gid:\/\/shopify\/Order\/\d+$/.test(orderId)) {
    return { result: { cancellable: false, state: "NOT_ALLOWED", message: "Invalid order." } };
  }

  const shop = String(sessionToken.dest || "").replace(/^https?:\/\//, "");
  const { admin } = await unauthenticated.admin(shop);

  const res = await admin.graphql(ORDER_QUERY, { variables: { id: orderId } });
  const { data } = await res.json();
  const order = data?.order ?? null;

  // sessionToken.sub = logged-in customer ki ID
  return { admin, order, result: checkOrder(order, sessionToken.sub) };
}

// GET /api/order-cancel?orderId=...  -> button enable/disable ke liye status
export const loader = async ({ request }) => {
  const { sessionToken, cors } = await authenticate.public.customerAccount(request);
  const orderId = new URL(request.url).searchParams.get("orderId");

  try {
    const { order, result } = await loadOrder(sessionToken, orderId);

    // Tracker stage sirf usi customer ko dikhe jiska order hai
    const ownsOrder = Boolean(order && sessionToken.sub && order.customer?.id === sessionToken.sub);
    const stage = ownsOrder && !order.cancelledAt ? getStage(order) : 0;

    return cors(Response.json({ ...result, stage }));
  } catch (error) {
    console.error("[order-cancel] status error", error);
    return cors(
      Response.json(
        { cancellable: false, state: "ERROR", message: "Could not check order status." },
        { status: 500 },
      ),
    );
  }
};

// POST /api/order-cancel  body: { orderId, reason }  -> order cancel
export const action = async ({ request }) => {
  const { sessionToken, cors } = await authenticate.public.customerAccount(request);

  let body;
  try {
    body = await request.json();
  } catch {
    return cors(Response.json({ state: "ERROR", message: "Invalid request." }, { status: 400 }));
  }

  try {
    // Cancel se pehle server par dobara check
    const { admin, order, result } = await loadOrder(sessionToken, body.orderId);
    if (!result.cancellable) {
      const status = result.state === "READY_TO_SHIP" ? 409 : 403;
      return cors(Response.json(result, { status }));
    }

    // 1) Cancel se pehle reason ka tag lagao (Unicommerce / admin ke liye)
    const reasonText = String(body.reason || "Not given").replace(/,/g, " ").trim();
    const cancelTags = ["customer-cancelled", `Cancel: ${reasonText}`.slice(0, 40)];

    const tagRes = await admin.graphql(TAGS_ADD_MUTATION, {
      variables: { id: body.orderId, tags: cancelTags },
    });
    const tagJson = await tagRes.json();
    if (tagJson.data?.tagsAdd?.userErrors?.length) {
      console.error("[order-cancel] tag add failed", order.name, tagJson.data.tagsAdd.userErrors);
    }

    // 2) Order cancel karo
    const variables = {
      orderId: body.orderId,
      staffNote: `Cancelled by customer from account page. Reason: ${reasonText.slice(0, 180)}`,
    };

    // Paid order ho to refund original payment method mein (COD mein nahi)
    if (PAID_STATUSES.includes(order.displayFinancialStatus)) {
      variables.refundMethod = { originalPaymentMethodsRefund: true };
    }

    const res = await admin.graphql(CANCEL_MUTATION, { variables });
    const { data, errors } = await res.json();
    const userErrors = data?.orderCancel?.orderCancelUserErrors ?? [];

    if (errors?.length || userErrors.length) {
      console.error("[order-cancel] cancel failed", order.name, errors, userErrors);

      // Cancel nahi hua -> lagaye hue tags wapas hatao
      try {
        await admin.graphql(TAGS_REMOVE_MUTATION, {
          variables: { id: body.orderId, tags: cancelTags },
        });
      } catch (removeError) {
        console.error("[order-cancel] tag remove failed", order.name, removeError);
      }

      return cors(
        Response.json(
          { state: "ERROR", message: "We couldn't cancel this order. Please contact customer support." },
          { status: 422 },
        ),
      );
    }

    // Cancel poora hone tak ruko
    await waitForJob(admin, data?.orderCancel?.job);

    console.info("[order-cancel] cancelled", order.name, "reason:", reasonText);

    // Orders page ka URL, taaki extension poora page reload kar sake
    const ordersUrl = await getOrdersUrl(admin);

    return cors(
      Response.json({
        state: "CANCELLED",
        message: "Your order has been cancelled. You'll receive a confirmation email shortly.",
        ordersUrl,
      }),
    );
  } catch (error) {
    console.error("[order-cancel] cancel error", error);
    return cors(
      Response.json({ state: "ERROR", message: "Something went wrong. Please try again." }, { status: 500 }),
    );
  }
};