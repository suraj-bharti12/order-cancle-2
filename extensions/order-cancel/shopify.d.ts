import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/CancelMenuItem.jsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.order.action.menu-item.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/CancelModal.jsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.order.action.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/OrderTracker.jsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.order-status.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}
