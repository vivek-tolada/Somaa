'use strict';

const emailConfig = require('../config/email');
const logger = require('../config/logger');

// ─── Email Notifications ─────────────────────────────────────────────────────

const notifyReservationCreated = async (reservation) => {
    const tasks = [emailConfig.sendAdminReservationAlert(reservation)];
    if (reservation.email) {
        tasks.push(emailConfig.sendReservationConfirmation(reservation));
    }
    const results = await Promise.allSettled(tasks);
    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            logger.error('Notification send failed', { index: i, reason: r.reason?.message });
        }
    });
};

const notifyPartyBookingCreated = async (booking) => {
    await emailConfig.sendAdminPartyAlert(booking).catch(err =>
        logger.error('Party booking notification failed', { error: err.message })
    );
};

const notifyReservationStatusUpdate = async (reservation) => {
    if (!reservation.email) return;
    await emailConfig.sendReservationStatusUpdate(reservation).catch(err =>
        logger.error('Reservation status update notification failed', { error: err.message })
    );
};

const notifyPartyBookingStatusUpdate = async (booking) => {
    if (!booking.email) return;
    await emailConfig.sendPartyBookingStatusUpdate(booking).catch(err =>
        logger.error('Party booking status update notification failed', { error: err.message })
    );
};

// ─── SMS (Integration-Ready Stub) ────────────────────────────────────────────
// To activate: install twilio, set TWILIO_ACCOUNT_SID / AUTH_TOKEN / FROM_NUMBER
// and replace the stub below with actual Twilio calls.

const sendSms = async (to, message) => {
    if (process.env.SMS_PROVIDER === 'twilio') {
        // const twilio = require('twilio');
        // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        // await client.messages.create({ body: message, from: process.env.TWILIO_FROM, to });
        logger.info('[SMS STUB] Would send to', { to, message: message.slice(0, 60) });
        return;
    }
    if (process.env.SMS_PROVIDER === 'msg91') {
        // Integration hook for MSG91 (India) — add SDK here
        logger.info('[SMS STUB - MSG91] Would send to', { to });
        return;
    }
    logger.debug('[SMS] No SMS provider configured — skipping', { to });
};

// ─── WhatsApp (Integration-Ready Stub) ───────────────────────────────────────
// To activate: configure WhatsApp Business API credentials and replace stub.

const sendWhatsApp = async (to, templateName, params) => {
    if (process.env.WHATSAPP_PROVIDER === 'meta') {
        // Integration hook for Meta WhatsApp Business Cloud API
        // await fetch(`https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        //   method: 'POST', headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, ... }, body: ...
        // });
        logger.info('[WhatsApp STUB] Would send template', { to, templateName });
        return;
    }
    logger.debug('[WhatsApp] No provider configured — skipping', { to });
};

// ─── Webhooks ─────────────────────────────────────────────────────────────────

const triggerWebhook = async (event, payload) => {
    const url = process.env.WEBHOOK_URL;
    if (!url) return;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-SOMAA-Event': event,
                ...(process.env.WEBHOOK_SECRET
                    ? { 'X-SOMAA-Signature': process.env.WEBHOOK_SECRET }
                    : {}),
            },
            body: JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload }),
        });
        logger.info('Webhook delivered', { event, status: res.status, url });
    } catch (err) {
        logger.error('Webhook delivery failed', { event, error: err.message, url });
    }
};

module.exports = {
    notifyReservationCreated,
    notifyPartyBookingCreated,
    notifyReservationStatusUpdate,
    notifyPartyBookingStatusUpdate,
    sendSms,
    sendWhatsApp,
    triggerWebhook,
};
