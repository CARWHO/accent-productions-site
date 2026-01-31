// Shared formatting utilities

export function formatDate(dateStr: string, style: 'short' | 'long' = 'long'): string {
  return new Date(dateStr).toLocaleDateString('en-NZ', {
    weekday: style,
    day: 'numeric',
    month: style === 'short' ? 'short' : 'long',
    year: 'numeric',
  });
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Variant without decimal places (for whole numbers)
export function formatCurrencyWhole(amount: number): string {
  return `$${amount.toLocaleString('en-NZ', { minimumFractionDigits: 0 })}`;
}
