'use client';

interface ContactInfoFieldsProps {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  details?: string;
  showValidation: boolean;
  inputStyles: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onDetailsChange?: (value: string) => void;
  showDetailsField?: boolean;
}

export function ContactInfoFields({
  contactName,
  contactEmail,
  contactPhone,
  details,
  showValidation,
  inputStyles,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onDetailsChange,
  showDetailsField = false,
}: ContactInfoFieldsProps) {
  return (
    <div className="grid gap-3 lg:gap-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name *</label>
        <input
          type="text"
          value={contactName}
          onChange={(e) => onNameChange(e.target.value)}
          className={`${inputStyles} ${showValidation && !contactName ? 'border-red-500' : ''}`}
          placeholder="John Smith"
        />
        {showValidation && !contactName && (
          <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 lg:gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            className={`${inputStyles} ${showValidation && !contactEmail ? 'border-red-500' : ''}`}
            placeholder="john@example.com"
          />
          {showValidation && !contactEmail && (
            <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Phone *</label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className={`${inputStyles} ${showValidation && !contactPhone ? 'border-red-500' : ''}`}
            placeholder="+64 21 123 4567"
          />
          {showValidation && !contactPhone && (
            <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
          )}
        </div>
      </div>

      {showDetailsField && onDetailsChange && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Event Details</label>
          <textarea
            value={details || ''}
            onChange={(e) => onDetailsChange(e.target.value)}
            rows={3}
            className={`${inputStyles} resize-none`}
            placeholder="Tell us about your event..."
          />
        </div>
      )}
    </div>
  );
}
