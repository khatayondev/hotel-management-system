import { wrapLuxuryEmailHtml } from "../email/templates/base-layout";

export interface DefaultTemplateDefinition {
  slug: string;
  name: string;
  channel: "SMS" | "EMAIL";
  event: string;
  subject?: string;
  template: string;
  variables: string[];
  description: string;
}

export const DEFAULT_NOTIFICATION_TEMPLATES: DefaultTemplateDefinition[] = [
  // 1. Booking Confirmed
  {
    slug: "booking_confirmed_sms",
    name: "Booking Confirmed (SMS)",
    channel: "SMS",
    event: "booking_confirmed",
    template:
      "Hello {{name}}, your booking for {{service}} on {{date}} at {{time}} is confirmed (Ref: {{reference}}). Balance due: {{amountDue}}. Manage your appointment: {{manageLink}}",
    variables: ["name", "service", "date", "time", "reference", "amountDue", "manageLink"],
    description: "Sent immediately when a booking is confirmed",
  },
  {
    slug: "booking_confirmed_email",
    name: "Booking Confirmed (Email)",
    channel: "EMAIL",
    event: "booking_confirmed",
    subject: "Booking Confirmed: {{service}} on {{date}} - {{businessName}}",
    template: wrapLuxuryEmailHtml({
      title: "Appointment Confirmed",
      badge: "VIP Slot Secured",
      preheader: "Your appointment for {{service}} on {{date}} is confirmed.",
      bodyHtml:
        "<p style=\"margin: 0 0 14px 0;\">Dear <strong>{{name}}</strong>,</p><p style=\"margin: 0 0 14px 0;\">We are delighted to confirm your appointment for <strong>{{service}}</strong> on <strong>{{date}} at {{time}}</strong>.</p><p style=\"margin: 0;\">Thank you for choosing {{businessName}}! Please arrive 10 minutes prior to your scheduled time.</p>",
      metaFields: [
        { label: "Treatment", value: "{{service}}" },
        { label: "Date & Time", value: "{{date}} at {{time}}" },
        { label: "Booking Reference", value: "{{reference}}" },
        { label: "Balance Due", value: "{{amountDue}}" },
      ],
      ctaText: "Manage Your Booking",
      ctaUrl: "{{manageLink}}",
    }),
    variables: ["name", "service", "date", "time", "reference", "amountDue", "manageLink", "businessName"],
    description: "Email confirmation with full appointment details",
  },

  // 2. Payment Received
  {
    slug: "payment_received_sms",
    name: "Payment Received (SMS)",
    channel: "SMS",
    event: "payment_received",
    template:
      "Hello {{name}}, we received your payment of {{amountPaid}} for booking {{reference}}. Balance remaining: {{amountDue}}. View receipt: {{manageLink}}",
    variables: ["name", "amountPaid", "reference", "amountDue", "manageLink"],
    description: "Sent when deposit or full payment is verified",
  },
  {
    slug: "payment_received_email",
    name: "Payment Received (Email)",
    channel: "EMAIL",
    event: "payment_received",
    subject: "Receipt for Booking {{reference}} - {{businessName}}",
    template:
      "<p>Hello {{name}},</p><p>Thank you! We have received your payment of <strong>{{amountPaid}}</strong> for your booking <strong>{{reference}}</strong>.</p><p>Remaining Balance: <strong>{{amountDue}}</strong>.</p><p><a href=\"{{manageLink}}\">View receipt & booking details</a></p>",
    variables: ["name", "amountPaid", "reference", "amountDue", "manageLink", "businessName"],
    description: "Email receipt acknowledging payment",
  },

  // 3. Payment Request
  {
    slug: "payment_request_sms",
    name: "Payment Request (SMS)",
    channel: "SMS",
    event: "payment_request",
    template:
      "Hello {{name}}, please complete your payment of {{amountDue}} for {{service}} (Ref: {{reference}}): {{manageLink}}",
    variables: ["name", "amountDue", "service", "reference", "manageLink"],
    description: "Sent to request online deposit or balance payment",
  },
  {
    slug: "payment_request_email",
    name: "Payment Request (Email)",
    channel: "EMAIL",
    event: "payment_request",
    subject: "Payment Request: {{service}} (Ref: {{reference}})",
    template:
      "<p>Hello {{name}},</p><p>Please complete your payment of <strong>{{amountDue}}</strong> for your upcoming appointment for <strong>{{service}}</strong> (Ref: {{reference}}).</p><p><a href=\"{{manageLink}}\">Pay online securely via Mobile Money or Card</a></p>",
    variables: ["name", "amountDue", "service", "reference", "manageLink"],
    description: "Payment link email for customer balance or deposit",
  },

  // 4. Reminder 24h
  {
    slug: "reminder_24h_sms",
    name: "24-Hour Reminder (SMS)",
    channel: "SMS",
    event: "reminder_24h",
    template:
      "Reminder: Hello {{name}}, your appointment for {{service}} is tomorrow, {{date}} at {{time}}. Please arrive 10 mins early (solo clients only). Ref: {{reference}}. Manage: {{manageLink}}",
    variables: ["name", "service", "date", "time", "reference", "amountDue", "manageLink"],
    description: "Sent 24 hours before appointment start time",
  },
  {
    slug: "reminder_24h_email",
    name: "24-Hour Reminder (Email)",
    channel: "EMAIL",
    event: "reminder_24h",
    subject: "Reminder: Your appointment tomorrow at {{time}}",
    template:
      "<p>Hello {{name}},</p><p>This is a friendly reminder that your appointment for <strong>{{service}}</strong> is scheduled for tomorrow, <strong>{{date}} at {{time}}</strong>.</p><p>Ref: {{reference}}<br/>Balance due: {{amountDue}}</p><p><a href=\"{{manageLink}}\">View or manage your booking</a></p>",
    variables: ["name", "service", "date", "time", "reference", "amountDue", "manageLink"],
    description: "Email reminder 24 hours prior",
  },

  // 5. Reminder 2h
  {
    slug: "reminder_2h_sms",
    name: "2-Hour Reminder (SMS)",
    channel: "SMS",
    event: "reminder_2h",
    template:
      "See you soon! Hello {{name}}, your {{service}} starts in 2 hours at {{time}}. Please arrive 10m early (solo clients only; cancelled if 30m late). Ref: {{reference}}: {{manageLink}}",
    variables: ["name", "service", "time", "reference", "manageLink"],
    description: "Sent 2 hours before appointment start time",
  },
  {
    slug: "reminder_2h_email",
    name: "2-Hour Reminder (Email)",
    channel: "EMAIL",
    event: "reminder_2h",
    subject: "See you soon: Appointment in 2 hours ({{time}})",
    template:
      "<p>Hello {{name}},</p><p>We look forward to welcoming you in 2 hours for <strong>{{service}}</strong> at <strong>{{time}}</strong>.</p><p><a href=\"{{manageLink}}\">View location and appointment details</a></p>",
    variables: ["name", "service", "time", "manageLink"],
    description: "Email reminder 2 hours prior",
  },

  // 6. Reschedule
  {
    slug: "booking_rescheduled_sms",
    name: "Booking Rescheduled (SMS)",
    channel: "SMS",
    event: "booking_rescheduled",
    template:
      "Hello {{name}}, your booking {{reference}} has been rescheduled to {{date}} at {{time}} for {{service}}. Manage: {{manageLink}}",
    variables: ["name", "reference", "date", "time", "service", "manageLink"],
    description: "Sent when an appointment date or time is modified",
  },
  {
    slug: "booking_rescheduled_email",
    name: "Booking Rescheduled (Email)",
    channel: "EMAIL",
    event: "booking_rescheduled",
    subject: "Appointment Rescheduled: {{service}} is now on {{date}} at {{time}}",
    template:
      "<p>Hello {{name}},</p><p>Your appointment for <strong>{{service}}</strong> has been rescheduled to <strong>{{date}} at {{time}}</strong>.</p><p>Reference: {{reference}}</p><p><a href=\"{{manageLink}}\">View updated booking</a></p>",
    variables: ["name", "service", "date", "time", "reference", "manageLink"],
    description: "Email update for rescheduled appointment",
  },

  // 7. Cancellation
  {
    slug: "booking_cancelled_sms",
    name: "Booking Cancelled (SMS)",
    channel: "SMS",
    event: "booking_cancelled",
    template:
      "Hello {{name}}, your booking {{reference}} for {{service}} on {{date}} has been cancelled. Details: {{manageLink}}",
    variables: ["name", "reference", "service", "date", "manageLink"],
    description: "Sent when a booking is cancelled",
  },
  {
    slug: "booking_cancelled_email",
    name: "Booking Cancelled (Email)",
    channel: "EMAIL",
    event: "booking_cancelled",
    subject: "Booking Cancelled: {{reference}} - {{businessName}}",
    template:
      "<p>Hello {{name}},</p><p>Your booking <strong>{{reference}}</strong> for {{service}} on {{date}} has been cancelled.</p><p><a href=\"{{manageLink}}\">View cancellation summary</a></p>",
    variables: ["name", "reference", "service", "date", "manageLink", "businessName"],
    description: "Email notification of cancellation",
  },

  // 8. Refund
  {
    slug: "refund_issued_sms",
    name: "Refund Issued (SMS)",
    channel: "SMS",
    event: "refund_issued",
    template:
      "Hello {{name}}, a refund of {{refundAmount}} for booking {{reference}} has been processed. Details: {{manageLink}}",
    variables: ["name", "refundAmount", "reference", "manageLink"],
    description: "Sent when a deposit or payment refund is processed",
  },
  {
    slug: "refund_issued_email",
    name: "Refund Issued (Email)",
    channel: "EMAIL",
    event: "refund_issued",
    subject: "Refund Processed: {{reference}} - {{businessName}}",
    template:
      "<p>Hello {{name}},</p><p>A refund of <strong>{{refundAmount}}</strong> has been processed for booking <strong>{{reference}}</strong>.</p><p>Funds usually reflect within 24 to 72 hours depending on your bank/MoMo provider.</p><p><a href=\"{{manageLink}}\">View details</a></p>",
    variables: ["name", "refundAmount", "reference", "manageLink", "businessName"],
    description: "Email receipt of refund issuance",
  },

  // 9. No-Show Follow-up
  {
    slug: "no_show_followup_sms",
    name: "No-Show Follow-up (SMS)",
    channel: "SMS",
    event: "no_show_followup",
    template:
      "Hello {{name}}, we missed you today for {{service}} (Ref: {{reference}}). We would love to welcome you back—rebook anytime: {{manageLink}}",
    variables: ["name", "service", "reference", "manageLink"],
    description: "Sent to customers after an appointment marked as no-show",
  },
  {
    slug: "no_show_followup_email",
    name: "No-Show Follow-up (Email)",
    channel: "EMAIL",
    event: "no_show_followup",
    subject: "We missed you today at {{businessName}}",
    template:
      "<p>Hello {{name}},</p><p>We missed you today for your <strong>{{service}}</strong> appointment (Ref: {{reference}}).</p><p>Life happens! When you are ready to reschedule, simply click the link below:</p><p><a href=\"{{manageLink}}\">Book your next visit</a></p>",
    variables: ["name", "service", "reference", "manageLink", "businessName"],
    description: "Gentle email follow-up after no-show",
  },

  // 10. Staff Alert: New Web Booking
  {
    slug: "staff_alert_new_booking_sms",
    name: "Staff Alert: New Booking (SMS)",
    channel: "SMS",
    event: "staff_alert_new_booking",
    template:
      "New Web Booking: {{name}} booked {{service}} on {{date}} at {{time}} (Ref: {{reference}}). Staff: {{staffName}}",
    variables: ["name", "service", "date", "time", "reference", "staffName"],
    description: "Sent to assigned staff or manager upon new web booking",
  },
  {
    slug: "staff_alert_new_booking_email",
    name: "Staff Alert: New Booking (Email)",
    channel: "EMAIL",
    event: "staff_alert_new_booking",
    subject: "New Web Booking: {{service}} on {{date}} at {{time}}",
    template:
      "<p>A new web booking has been placed:</p><ul><li><strong>Client:</strong> {{name}}</li><li><strong>Service:</strong> {{service}}</li><li><strong>Date/Time:</strong> {{date}} at {{time}}</li><li><strong>Staff Assigned:</strong> {{staffName}}</li><li><strong>Reference:</strong> {{reference}}</li></ul>",
    variables: ["name", "service", "date", "time", "staffName", "reference"],
    description: "Staff/Owner notification for new online reservations",
  },
];
