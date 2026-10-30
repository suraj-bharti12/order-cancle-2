import { authenticate } from "../shopify.server";

// Customer ne apna data maanga. Ye app customer ka koi data save nahi karti,
// isliye sirf receive karke 200 OK bhejna hai. Galat HMAC par authenticate 401 deta hai.
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.info(`[webhook] ${topic} received for ${shop} - no customer data stored`);
  return new Response();
};