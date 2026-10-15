import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/OrderTracker.jsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.order-status.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/OrderItemTracker.jsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.order-status.cart-line-item.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}
