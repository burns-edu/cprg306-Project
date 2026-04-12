import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(request: Request) {
  const { items, userId } = await request.json();

  // Calculate total
  const total = items.reduce(
    (sum: number, item: any) => sum + item.price * (item.qty ?? 1),
    0,
  );

  // 1. Create the order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      userID: userId,
      orderDate: new Date().toISOString().split("T")[0], // formats as YYYY-MM-DD
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
    bookId: item.bookId,
    qty: item.qty ?? 1,
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

  return Response.json({ success: true });
}
