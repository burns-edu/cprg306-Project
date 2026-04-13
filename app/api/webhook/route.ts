import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  console.log("Webhook received!");
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;
  console.log("Stripe signature:", sig);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const items = JSON.parse(session.metadata?.items ?? "[]");

    const supabase = await createClient();

    // Calculate total
    const total = items.reduce(
      (sum: number, item: any) => sum + item.price * (item.qty ?? 1),
      0,
    );

    // 1. Create the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        userId: userId,
        orderDate: new Date().toISOString().split("T")[0],
        total,
        status: "confirmed",
      })
      .select()
      .single();

    if (orderError) {
      return Response.json({ error: orderError.message }, { status: 500 });
    }

    // 2. Insert order items
    const orderItems = items.map((item: any) => ({
      orderId: order.id,
      bookId: item.id,
      quantity: item.qty ?? 1,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from("orderItems")
      .insert(orderItems);

    if (itemsError) {
      return Response.json({ error: itemsError.message }, { status: 500 });
    }

    // 3. Clear the user's cart
    const { error: cartError } = await supabase
      .from("cartItems")
      .delete()
      .eq("userId", userId);

    if (cartError) {
      return Response.json({ error: cartError.message }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}
