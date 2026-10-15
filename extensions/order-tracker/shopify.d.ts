import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/OrderTracker.jsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.order-status.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/ShipmentTracker.jsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.order-status.fulfillment-details.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/PendingTracker.jsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.order-status.unfulfilled-items.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}
