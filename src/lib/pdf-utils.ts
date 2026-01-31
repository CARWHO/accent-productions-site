// Shared utilities for PDF generation
import path from 'path';
import fs from 'fs';

/**
 * Get logo as base64 for embedding in PDF
 */
export function getLogoBase64(): string | null {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logo-quote.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      return `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }
    const fallbackPath = path.join(process.cwd(), 'public', 'images', 'logoblack.png');
    if (fs.existsSync(fallbackPath)) {
      const logoBuffer = fs.readFileSync(fallbackPath);
      return `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }
  } catch (e) {
    console.error('Error loading logo:', e);
  }
  return null;
}

/**
 * Format currency for NZ dollars
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format date for display (NZ format)
 */
export function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-NZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format current date for issued date
 */
export function formatDateShort(): string {
  return new Date().toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format time string (handles 24hr and 12hr formats)
 */
export function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const cleanTime = timeStr.trim().toLowerCase();
  if (/^\d{1,2}(:\d{2})?\s*(am|pm)$/i.test(cleanTime)) {
    return timeStr.trim();
  }
  const match24 = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const mins = match24[2];
    const period = hours >= 12 ? 'pm' : 'am';
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    return mins === '00' ? `${hours}${period}` : `${hours}:${mins}${period}`;
  }
  return timeStr;
}
