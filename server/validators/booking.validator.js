/**
 * Booking Input Validators
 */

const validateCreateBooking = (req) => {
  const { customerName, customerPhone, customerAddress, serviceCategory, amount } = req.body || {};

  if (!customerName || !customerPhone || !customerAddress || !serviceCategory || amount === undefined || amount === null) {
    return {
      isValid: false,
      message: 'Missing required booking fields: customerName, customerPhone, customerAddress, serviceCategory, and amount are required.'
    };
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return {
      isValid: false,
      message: 'Booking amount must be a positive number.'
    };
  }

  return { isValid: true };
};

const RESCHEDULE_SLOT_DURATION_MS = 2 * 60 * 60 * 1000;

const validateProposeReschedule = (req) => {
  const { windowStart, windowEnd } = req.body || {};

  if (!windowStart || !windowEnd) {
    return { isValid: false, message: 'windowStart and windowEnd are both required.' };
  }

  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { isValid: false, message: 'windowStart and windowEnd must be valid dates.' };
  }
  if (start.getTime() <= Date.now()) {
    return { isValid: false, message: 'windowStart must be in the future.' };
  }
  if (end.getTime() - start.getTime() < RESCHEDULE_SLOT_DURATION_MS) {
    return { isValid: false, message: `The availability window must be at least ${RESCHEDULE_SLOT_DURATION_MS / 3600000} hours long.` };
  }

  return { isValid: true };
};

const validateRespondToReschedule = (req) => {
  const { action, selectedStart } = req.body || {};

  if (!['accept', 'cancel'].includes(action)) {
    return { isValid: false, message: "action must be 'accept' or 'cancel'." };
  }
  if (action === 'accept') {
    if (!selectedStart || Number.isNaN(new Date(selectedStart).getTime())) {
      return { isValid: false, message: 'A valid selectedStart date/time is required to accept.' };
    }
  }

  return { isValid: true };
};

module.exports = {
  validateCreateBooking,
  validateProposeReschedule,
  validateRespondToReschedule
};
