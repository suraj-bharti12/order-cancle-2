import { authenticate } from "../shopify.server";

// Customer ka data delete karne ki request. Ye app customer ka koi data save nahi karti.
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.info(`[webhook] ${topic} received for ${shop} - no customer data stored`);
  return new Response();
};