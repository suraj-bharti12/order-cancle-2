import { authenticate } from "../shopify.server";
import db from "../db.server";

// App uninstall ke 48 ghante baad Shopify bhejta hai: store ka saara data delete karo.
// Hum sirf login sessions rakhte hain, wahi delete kar dete hain.
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);
  await db.session.deleteMany({ where: { shop } });
  console.info(`[webhook] ${topic} received for ${shop} - sessions deleted`);
  return new Response();
};