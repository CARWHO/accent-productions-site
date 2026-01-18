import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET: Fetch booking and contractor data
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ message: 'Missing token' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ message: 'Database not configured' }, { status: 500 });
  }

  try {
    // Find booking by contractor_selection_token or approval_token
    let booking = null;

    // First try contractor_selection_token
    const { data: bookingBySelection } = await supabase
      .from('bookings')
      .select('*')
      .eq('contractor_selection_token', token)
      .single();

    if (bookingBySelection) {
      booking = bookingBySelection;
    } else {
      // Fallback to approval_token (for "skip client approval" flow)
      const { data: bookingByApproval } = await supabase
        .from('bookings')
        .select('*')
        .eq('approval_token', token)
        .single();

      booking = bookingByApproval;
    }

    if (!booking) {
      return NextResponse.json({ message: 'Booking not found' }, { status: 404 });
    }

    // Fetch all active contractors
    const { data: contractors, error: contractorsError } = await supabase
      .from('contractors')
      .select('*')
      .eq('active', true)
      .order('name');

    if (contractorsError) {
      console.error('Error fetching contractors:', contractorsError);
      return NextResponse.json({ message: 'Failed to fetch contractors' }, { status: 500 });
    }

    // Fetch existing assignments for this booking
    const { data: existingAssignments } = await supabase
      .from('booking_contractor_assignments')
      .select('*, contractors(*)')
      .eq('booking_id', booking.id);

    return NextResponse.json({
      booking,
      contractors: contractors || [],
      existingAssignments: existingAssignments || [],
    });
  } catch (error) {
    console.error('Error in select-contractors GET:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST: Save contractor selections
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, bookingId, assignments, vehicleContractorId } = body;

    if (!token || !bookingId || !assignments || !Array.isArray(assignments)) {
      return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ message: 'Database not configured' }, { status: 500 });
    }

    // Validate token matches booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ message: 'Booking not found' }, { status: 404 });
    }

    // Verify token
    if (booking.contractor_selection_token !== token && booking.approval_token !== token) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 403 });
    }

    // Validate each assignment's hours and rates
    for (const a of assignments) {
      const rate = Number(a.hourly_rate);
      const hours = Number(a.estimated_hours);

      if (isNaN(rate) || rate < 20 || rate > 500) {
        return NextResponse.json({ message: 'Hourly rate must be between $20 and $500' }, { status: 400 });
      }
      if (isNaN(hours) || hours < 0.5 || hours > 24) {
        return NextResponse.json({ message: 'Estimated hours must be between 0.5 and 24' }, { status: 400 });
      }
    }

    // Delete existing assignments for this booking
    await supabase
      .from('booking_contractor_assignments')
      .delete()
      .eq('booking_id', bookingId);

    // Determine vehicle amount for contractor who uses personal vehicle
    const vehicleAmount = (booking.vehicle_type === 'personal' && vehicleContractorId && booking.vehicle_amount)
      ? Number(booking.vehicle_amount)
      : 0;

    // Insert new assignments
    const assignmentsToInsert = assignments.map((a: {
      contractor_id: string;
      hourly_rate: number;
      estimated_hours: number;
      pay_amount: number;
      tasks_description?: string;
      equipment_assigned?: string[];
    }) => {
      // Add vehicle amount to pay if this contractor is assigned the vehicle
      const additionalVehiclePay = (a.contractor_id === vehicleContractorId) ? vehicleAmount : 0;

      return {
        booking_id: bookingId,
        contractor_id: a.contractor_id,
        hourly_rate: a.hourly_rate,
        estimated_hours: a.estimated_hours,
        pay_amount: a.pay_amount + additionalVehiclePay, // Base pay + vehicle allowance if applicable
        tasks_description: a.tasks_description || null,
        equipment_assigned: a.equipment_assigned || null,
        status: 'pending',
      };
    });

    const { error: insertError } = await supabase
      .from('booking_contractor_assignments')
      .insert(assignmentsToInsert);

    if (insertError) {
      console.error('Error inserting assignments:', insertError);
      return NextResponse.json({ message: 'Failed to save assignments' }, { status: 500 });
    }

    // Update booking status and vehicle contractor assignment
    const bookingUpdate: Record<string, string | null> = {
      status: 'selecting_contractors',
      contractors_selected_at: new Date().toISOString(),
    };

    // Save vehicle contractor ID if provided (only valid when vehicle_type is 'personal')
    if (vehicleContractorId !== undefined) {
      bookingUpdate.vehicle_contractor_id = vehicleContractorId || null;
    }

    await supabase
      .from('bookings')
      .update(bookingUpdate)
      .eq('id', bookingId);

    return NextResponse.json({
      success: true,
      assignmentCount: assignments.length,
    });
  } catch (error) {
    console.error('Error in select-contractors POST:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
