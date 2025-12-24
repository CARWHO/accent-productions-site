import { CartProvider } from '@/lib/cart-context';
import { CartSummary } from '@/components/backline/CartSummary';

export default function BacklineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      {children}
      <CartSummary />
    </CartProvider>
  );
}
