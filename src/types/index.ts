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
  organization?: string;
  event_name?: string;
  event_date: string;
  event_time?: string;
  setup_time?: string;
  attendance: number;
  location: string;
  venue_contact?: string;
  content?: string;
  indoor_outdoor?: string;
  power_access?: string;
  stage_provider?: string;
  details?: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  status: InquiryStatus;
}

export interface InquiryFormData {
  eventType: EventType;
  organization: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  setupTime: string;
  attendance: number;
  location: string;
  venueContact: string;
  content: string;
  indoorOutdoor: string;
  powerAccess: string;
  stageProvider: string;
  details: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}
