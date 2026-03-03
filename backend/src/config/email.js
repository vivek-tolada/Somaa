'use strict';

const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

// ─── Email Templates ──────────────────────────────────────────────────────────

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #0a0a0a; color: #f5f0e8; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 2rem; }
    .header { background: linear-gradient(135deg, #c41e2a, #d4912a); padding: 2rem; text-align: center; border-radius: 12px 12px 0 0; }
    .header h1 { margin: 0; font-size: 2rem; letter-spacing: 4px; color: #fff; }
    .header p { margin: 0.5rem 0 0; color: rgba(255,255,255,0.8); font-size: 0.85rem; letter-spacing: 2px; }
    .body { background: #161616; padding: 2rem; border-radius: 0 0 12px 12px; border: 1px solid rgba(212,168,68,0.1); border-top: none; }
    .detail-row { display: flex; padding: 0.75rem 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .detail-label { color: #d4912a; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; min-width: 140px; }
    .detail-value { color: #f5f0e8; }
    .cta { display: inline-block; margin-top: 1.5rem; padding: 0.875rem 2rem; background: #c41e2a; color: #fff; border-radius: 50px; text-decoration: none; font-weight: 600; }
    .footer { text-align: center; margin-top: 2rem; font-size: 0.75rem; color: rgba(245,240,232,0.3); }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>SOMAA</h1>
      <p>Luxury Dining & Live Music · Visakhapatnam</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      4th Floor, VIP Center, VIP Road, Visakhapatnam · +91 92111 12666<br>
      Open daily 11:30 AM – 11:30 PM
    </div>
  </div>
</body>
</html>`;

const reservationConfirmationTemplate = (reservation) => baseTemplate(`
  <h2 style="color:#d4a844;margin-top:0">Reservation Confirmed ✓</h2>
  <p>Thank you, <strong>${reservation.name}</strong>! Your table reservation at SOMAA has been received.</p>
  <div style="margin:1.5rem 0">
    <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${reservation.date}</span></div>
    <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${reservation.time_slot}</span></div>
    <div class="detail-row"><span class="detail-label">Guests</span><span class="detail-value">${reservation.guests}</span></div>
    ${reservation.special_requests ? `<div class="detail-row"><span class="detail-label">Special Requests</span><span class="detail-value">${reservation.special_requests}</span></div>` : ''}
  </div>
  <p style="color:rgba(245,240,232,0.6);font-size:0.9rem">Our team will confirm your booking within 2 hours. For immediate assistance, call us at <strong style="color:#d4912a">+91 92111 12666</strong>.</p>
`);

const adminReservationAlert = (reservation) => baseTemplate(`
  <h2 style="color:#c41e2a;margin-top:0">🔔 New Reservation</h2>
  <div style="margin:1rem 0">
    <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${reservation.name}</span></div>
    <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${reservation.phone}</span></div>
    <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${reservation.email || '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${reservation.date}</span></div>
    <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${reservation.time_slot}</span></div>
    <div class="detail-row"><span class="detail-label">Guests</span><span class="detail-value">${reservation.guests}</span></div>
    ${reservation.special_requests ? `<div class="detail-row"><span class="detail-label">Special Requests</span><span class="detail-value">${reservation.special_requests}</span></div>` : ''}
    <div class="detail-row"><span class="detail-label">Booking ID</span><span class="detail-value" style="font-family:monospace;font-size:0.8rem">${reservation.id}</span></div>
  </div>
`);

const adminPartyAlert = (booking) => baseTemplate(`
  <h2 style="color:#c41e2a;margin-top:0">🎉 New Party Booking — HIGH PRIORITY</h2>
  <div style="margin:1rem 0">
    <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${booking.name}</span></div>
    <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${booking.phone}</span></div>
    <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${booking.email || '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Event Type</span><span class="detail-value">${booking.event_type}</span></div>
    <div class="detail-row"><span class="detail-label">Preferred Date</span><span class="detail-value">${booking.preferred_date}</span></div>
    <div class="detail-row"><span class="detail-label">Guest Count</span><span class="detail-value">${booking.guest_count}</span></div>
    ${booking.notes ? `<div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">${booking.notes}</span></div>` : ''}
  </div>
`);

const reservationStatusUpdateTemplate = (reservation) => baseTemplate(`
  <h2 style="color:#d4a844;margin-top:0">Reservation Update: ${reservation.status.toUpperCase()}</h2>
  <p>Dear <strong>${reservation.name}</strong>, your table reservation status has been updated to <strong>${reservation.status}</strong>.</p>
  <div style="margin:1.5rem 0">
    <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${reservation.date}</span></div>
    <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${reservation.time_slot}</span></div>
    <div class="detail-row"><span class="detail-label">Guests</span><span class="detail-value">${reservation.guests}</span></div>
    ${reservation.notes ? `<div class="detail-row"><span class="detail-label">Notes from SOMAA</span><span class="detail-value">${reservation.notes}</span></div>` : ''}
  </div>
  <p style="color:rgba(245,240,232,0.6);font-size:0.9rem">If you have any questions, call us at <strong style="color:#d4912a">+91 92111 12666</strong>.</p>
`);

const partyBookingStatusUpdateTemplate = (booking) => baseTemplate(`
  <h2 style="color:#d4a844;margin-top:0">Event Booking Update: ${booking.status.toUpperCase()}</h2>
  <p>Dear <strong>${booking.name}</strong>, the status of your ${booking.event_type} inquiry has been updated to <strong>${booking.status}</strong>.</p>
  <div style="margin:1.5rem 0">
    <div class="detail-row"><span class="detail-label">Event Type</span><span class="detail-value">${booking.event_type}</span></div>
    <div class="detail-row"><span class="detail-label">Preferred Date</span><span class="detail-value">${booking.preferred_date}</span></div>
    <div class="detail-row"><span class="detail-label">Guest Count</span><span class="detail-value">${booking.guest_count}</span></div>
    ${booking.notes ? `<div class="detail-row"><span class="detail-label">Notes from SOMAA</span><span class="detail-value">${booking.notes}</span></div>` : ''}
  </div>
  <p style="color:rgba(245,240,232,0.6);font-size:0.9rem">If you have any questions, call us at <strong style="color:#d4912a">+91 92111 12666</strong>.</p>
`);

// ─── Send Helpers ─────────────────────────────────────────────────────────────

const sendMail = async (options) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    logger.warn('Email not configured — skipping send', { to: options.to, subject: options.subject });
    return null;
  }
  try {
    const info = await getTransporter().sendMail({
      from: `"SOMAA Restobar" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      ...options,
    });
    logger.info('Email sent', { messageId: info.messageId, to: options.to });
    return info;
  } catch (err) {
    logger.error('Email send failed', { error: err.message, to: options.to });
    return null;
  }
};

module.exports = {
  sendReservationConfirmation: (reservation) =>
    sendMail({
      to: reservation.email,
      subject: `SOMAA – Reservation Received for ${reservation.date}`,
      html: reservationConfirmationTemplate(reservation),
    }),

  sendAdminReservationAlert: (reservation) =>
    sendMail({
      to: process.env.ADMIN_EMAIL,
      subject: `[SOMAA] New Reservation – ${reservation.name} (${reservation.date})`,
      html: adminReservationAlert(reservation),
    }),

  sendAdminPartyAlert: (booking) =>
    sendMail({
      to: process.env.ADMIN_EMAIL,
      subject: `[SOMAA] 🎉 Party Booking – ${booking.event_type} | ${booking.preferred_date}`,
      html: adminPartyAlert(booking),
    }),

  sendReservationStatusUpdate: (reservation) =>
    sendMail({
      to: reservation.email,
      subject: `SOMAA – Reservation Update: ${reservation.status.toUpperCase()}`,
      html: reservationStatusUpdateTemplate(reservation),
    }),

  sendPartyBookingStatusUpdate: (booking) =>
    sendMail({
      to: booking.email,
      subject: `SOMAA – Event Booking Update: ${booking.status.toUpperCase()}`,
      html: partyBookingStatusUpdateTemplate(booking),
    }),
};
