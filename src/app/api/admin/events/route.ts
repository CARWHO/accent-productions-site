import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET: Fetch all events/bookings with optional filters
 * Query params:
 *   - status: Filter by booking status
 *   - search: Search in event name, client name, or quote number
 *   - date_from: Filter events from this date
 *   - date_to: Filter events until this date
 *   - client: Filter by client name (exact or partial)
 *   - sort: Sort field (event_date, created_at, client_name)
 *   - order: asc or desc
 *   - limit: Max results (default 100)
 *   - offset: Pagination offset
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const client = searchParams.get('client');
  const sortField = searchParams.get('sort') || 'event_date';
  const sortOrder = searchParams.get('order') || 'desc';
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    let query = supabase
      .from('bookings')
      .select(`
        id,
        quote_number,
        event_name,
        event_date,
        event_time,
        location,
        client_name,
        client_email,
        client_phone,
        booking_type,
        status,
        created_at,
        client_approved_at,
        contractors_notified_at,
        quote_total,
        crew_count,
        approval_token,
        next_occurrence_date,
        recurrence_reminder_days
      `, { count: 'exact' });

    // Filter by status
    if (status) {
      query = query.eq('status', status);
    }

    // Search filter
    if (search) {
      query = query.or(`event_name.ilike.%${search}%,client_name.ilike.%${search}%,quote_number.ilike.%${search}%`);
    }

    // Client filter
    if (client) {
      query = query.ilike('client_name', `%${client}%`);
    }

    // Date range filters
    if (dateFrom) {
      query = query.gte('event_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('event_date', dateTo);
    }

    // Only filter by date if explicit date range is provided (no default filtering)

    // Sorting
    const validSortFields = ['event_date', 'created_at', 'client_name', 'status'];
    const field = validSortFields.includes(sortField) ? sortField : 'event_date';
    const ascending = sortOrder === 'asc';
    query = query.order(field, { ascending });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: bookings, count, error } = await query;

    if (error) {
      console.error('Error fetching events:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Get unique clients for the filter dropdown
    const { data: clients } = await supabase
      .from('bookings')
      .select('client_name, client_email')
      .order('client_name');

    // Deduplicate clients
    const uniqueClients = clients
      ? Array.from(new Map(clients.map(c => [c.client_email, c])).values())
      : [];

    // Get status counts for quick filters
    const { data: statusCounts } = await supabase
      .from('bookings')
      .select('status');

    const statusSummary: Record<string, number> = {};
    if (statusCounts) {
      for (const b of statusCounts) {
        statusSummary[b.status] = (statusSummary[b.status] || 0) + 1;
      }
    }

    return NextResponse.json({
      bookings,
      total: count || 0,
      limit,
      offset,
      clients: uniqueClients,
      statusSummary,
    });
  } catch (error) {
    console.error('Error in events API:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
