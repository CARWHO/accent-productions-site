export type EventType =
  | 'wedding'
  | 'corporate'
  | 'festival'
  | 'private_party'
  | 'other';

export type InquiryStatus =
  | 'new'
  | 'quoted'
  | 'paid'
  | 'completed'
  | 'cancelled';

export interface Inquiry {
  id: string;
  created_at: string;
  event_type: EventType;
  attendance: number;
  event_date: string;
  location: string;
  duration: string;
  details: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  status: InquiryStatus;
}

export interface InquiryFormData {
  eventType: EventType;
  attendance: number;
  eventDate: string;
  location: string;
  duration: string;
  details: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}
