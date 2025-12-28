'use client';

import Image from 'next/image';
import { useCart } from '@/lib/cart-context';

interface EquipmentCardProps {
  id: string;
  name: string;
  category: string;
  notes: string | null;
  hireRate: number | null;
  stockQuantity: number;
}

export function EquipmentCard({ id, name, category, notes, hireRate, stockQuantity }: EquipmentCardProps) {
  const { addItem, isInCart, getItemQuantity, updateQuantity } = useCart();
  const inCart = isInCart(id);
  const quantity = getItemQuantity(id);
  const atMax = quantity >= stockQuantity;

  const handleAdd = () => {
    addItem({ id, name, category, notes });
  };

  return (
    <div className={`border rounded-md overflow-hidden transition-all ${inCart ? 'border-[#000000] bg-[#000000]/5' : 'border-gray-200'}`}>
      <div className="aspect-[4/3] relative w-full bg-gray-100">
        <Image
          src="https://placehold.co/400x300/1a1a1a/ffffff?text=Equipment"
          alt={name}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 text-sm lg:text-base truncate">{name}</h3>
        {notes && <p className="text-xs text-gray-500 mt-0.5 truncate">{notes}</p>}
        <div className="flex items-center justify-between mt-1">
          {hireRate && <p className="text-xs text-gray-600 font-medium">~${hireRate}/day</p>}
          {stockQuantity > 1 && <p className="text-xs text-gray-400">{stockQuantity} available</p>}
        </div>
        <div className="mt-3">
          {inCart ? (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => updateQuantity(id, quantity - 1)}
                className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md"
              >
                -
              </button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <button
                type="button"
                onClick={() => updateQuantity(id, quantity + 1)}
                disabled={atMax}
                className={`w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md ${atMax ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              className="w-full py-2 bg-[#000000] text-white font-medium rounded-md text-sm"
            >
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
