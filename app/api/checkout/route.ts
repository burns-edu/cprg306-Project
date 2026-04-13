import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
    const { items } = await request.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: items.map((item: any) => ({
            price_data: {
                currency: 'cad',
                product_data: {
                    name: item.title,
                    images: [item.cover_url],
                },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.qty ?? 1,
        })),
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/cart?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/cart`,
        metadata: {
            userId: user?.id ?? '',
            items: JSON.stringify(items),
        },
    });

    // Process order immediately after Stripe session is created
    if (user) {
        console.log('Processing order for user:', user.id)
        const total = items.reduce(
            (sum: number, item: any) => sum + item.price * (item.qty ?? 1), 0
        );
        console.log('Total:', total)

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                userId: user.id,
                orderDate: new Date().toISOString().split('T')[0],
                total,
                status: 'confirmed',
            })
            .select()
            .single();

        console.log('Order:', order, 'Error:', orderError)

        if (order) {
            const { error: itemsError } = await supabase.from('orderItems').insert(
                items.map((item: any) => ({
                    orderId: order.id,
                    bookId: item.id,
                    quantity: item.qty ?? 1,
                    price: item.price,
                }))
            );
            console.log('Items error:', itemsError)

            const { error: cartError } = await supabase.from('cartItems').delete().eq('userId', user.id);
            console.log('Cart error:', cartError)
        }
    }

    return Response.json({ url: session.url });
}