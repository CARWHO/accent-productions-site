import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json(
        { success: false, message: 'Database connection not available' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');

    let query = supabase
      .from('equipment')
      .select('id, category, name, notes, hire_rate_per_day, stock_quantity')
      .eq('available', true)
      .eq('type', 'audio');

    // Apply category filter if provided
    if (category) {
      query = query.eq('category', category);
    }

    // Apply search filter if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,notes.ilike.%${search}%,category.ilike.%${search}%`);
    }

    query = query.order('category').order('name');

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audio equipment:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch audio equipment' },
        { status: 500 }
      );
    }

    // Group items by category
    const groupedItems: Record<string, typeof data> = {};
    for (const item of data || []) {
      if (!groupedItems[item.category]) {
        groupedItems[item.category] = [];
      }
      groupedItems[item.category].push(item);
    }

    // Also return flat list for search results
    return NextResponse.json({
      success: true,
      items: groupedItems,
      allItems: data || []
    });
  } catch (error) {
    console.error('Error in audio-equipment API:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
