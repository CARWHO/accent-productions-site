// Shared status configuration for admin and review pages

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  quote_sent: 'bg-blue-100 text-blue-800',
  client_approved: 'bg-green-100 text-green-800',
  contractors_notified: 'bg-purple-100 text-purple-800',
  assigned: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  quote_sent: 'Quote Sent',
  client_approved: 'Approved',
  contractors_notified: 'Notified',
  assigned: 'Assigned',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ASSIGNMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  deposit_paid: 'bg-blue-100 text-blue-800',
  invoiced: 'bg-purple-100 text-purple-800',
  not_sent: 'bg-gray-100 text-gray-800',
  not_due: 'bg-gray-100 text-gray-800',
};
