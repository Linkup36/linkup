import { defineStateMachine, describeStateMachine } from './engine';

/* -------------------------------------------------------------------------- */
/* 1. Marketplace Order Lifecycle (orders.status)                             */
/* -------------------------------------------------------------------------- */

export const ORDER_STATES = [
  'pending',
  'confirmed',
  'processing',
  'awaiting_agent',
  'accepted',
  'out_for_pickup',
  'arrived_at_seller',
  'picked_up',
  'out_for_delivery',
  'arrived_at_destination',
  'delivered',
  'completed',
  'disputed',
  'refunded',
  'cancelled',
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export const orderStateMachine = defineStateMachine<'order', OrderState>({
  id: 'order',
  description:
    'Marketplace order fulfillment lifecycle from checkout creation through rider pickup, delivery, buyer confirmation, and escrow completion or dispute.',
  source: { table: 'orders', column: 'status' },
  initial: 'pending',
  states: ORDER_STATES,
  transitions: {
    pending: ['confirmed', 'processing', 'awaiting_agent', 'cancelled', 'refunded'],
    confirmed: ['processing', 'awaiting_agent', 'cancelled', 'refunded'],
    processing: ['awaiting_agent', 'accepted', 'cancelled', 'refunded'],
    awaiting_agent: ['accepted', 'cancelled', 'refunded'],
    accepted: ['out_for_pickup', 'arrived_at_seller', 'picked_up', 'cancelled'],
    out_for_pickup: ['arrived_at_seller', 'picked_up', 'cancelled'],
    arrived_at_seller: ['picked_up', 'cancelled'],
    picked_up: ['out_for_delivery', 'arrived_at_destination', 'delivered', 'disputed'],
    out_for_delivery: ['arrived_at_destination', 'delivered', 'disputed'],
    arrived_at_destination: ['delivered', 'disputed'],
    delivered: ['completed', 'disputed', 'refunded'],
    completed: ['disputed', 'refunded'],
    disputed: ['completed', 'refunded'],
    refunded: [],
    cancelled: [],
  },
  meta: {
    pending: {
      label: 'Pending',
      shortLabel: 'Logged',
      description: 'Order created and awaiting confirmation.',
      tone: 'neutral',
      stepIndex: 0,
      flags: { canCancel: true, isPendingDispatch: true },
    },
    confirmed: {
      label: 'Confirmed',
      shortLabel: 'Logged',
      description: 'Payment verified and order confirmed.',
      tone: 'info',
      stepIndex: 0,
      flags: { canCancel: true, isPendingDispatch: true },
    },
    processing: {
      label: 'Processing',
      shortLabel: 'Clearing',
      description: 'Seller is preparing the order for dispatch.',
      tone: 'info',
      stepIndex: 1,
      flags: { canCancel: true, isPendingDispatch: true },
    },
    awaiting_agent: {
      label: 'Finding Rider',
      shortLabel: 'Finding Rider',
      description: 'Broadcasted to nearby logistics riders.',
      tone: 'warning',
      stepIndex: 1,
      aliases: ['broadcast'],
      flags: { canCancel: true, isPendingDispatch: true },
    },
    accepted: {
      label: 'Rider Assigned',
      shortLabel: 'Assigned',
      description: 'A logistics rider accepted the pickup mission.',
      tone: 'info',
      stepIndex: 1,
      aliases: ['assigned', 'started'],
      flags: { canCancel: true, isPendingDispatch: true },
    },
    out_for_pickup: {
      label: 'Heading to Seller',
      shortLabel: 'To Seller',
      description: 'Rider is en route to pick up the item from the seller.',
      tone: 'info',
      stepIndex: 2,
      flags: { isPendingDispatch: true, isInTransit: true },
    },
    arrived_at_seller: {
      label: 'At Seller',
      shortLabel: 'At Seller',
      description: 'Rider arrived at the seller pickup location.',
      tone: 'info',
      stepIndex: 2,
      flags: { isPendingDispatch: true, isInTransit: true },
    },
    picked_up: {
      label: 'Picked Up',
      shortLabel: 'Picked Up',
      description: 'Rider collected the package from the seller.',
      tone: 'info',
      stepIndex: 2,
      flags: { isInTransit: true },
    },
    out_for_delivery: {
      label: 'Out for Delivery',
      shortLabel: 'On the Way',
      description: 'Rider is delivering the package to the buyer.',
      tone: 'info',
      stepIndex: 2,
      flags: { isInTransit: true },
    },
    arrived_at_destination: {
      label: 'Arrived at Drop-off',
      shortLabel: 'Arrived',
      description: 'Rider arrived at the buyer drop-off location.',
      tone: 'info',
      stepIndex: 2,
      flags: { isInTransit: true },
    },
    delivered: {
      label: 'Delivered',
      shortLabel: 'Delivered',
      description: 'Package delivered; awaiting buyer confirmation or escrow release.',
      tone: 'success',
      stepIndex: 3,
      flags: { canConfirmReceipt: true, canDispute: true },
    },
    completed: {
      label: 'Completed',
      shortLabel: 'Secured',
      description: 'Buyer confirmed receipt and escrow funds were settled.',
      tone: 'success',
      stepIndex: 3,
      flags: { isSettled: true },
    },
    disputed: {
      label: 'Disputed',
      shortLabel: 'Disputed',
      description: 'Order is under admin dispute review with escrow held.',
      tone: 'danger',
      stepIndex: -1,
      flags: { requiresAdmin: true },
    },
    refunded: {
      label: 'Refunded',
      shortLabel: 'Refunded',
      description: 'Order was refunded to the buyer.',
      tone: 'neutral',
      stepIndex: -1,
      terminal: true,
    },
    cancelled: {
      label: 'Cancelled',
      shortLabel: 'Cancelled',
      description: 'Order was cancelled before completion.',
      tone: 'danger',
      stepIndex: -1,
      terminal: true,
    },
  },
});

/* -------------------------------------------------------------------------- */
/* 2. Send Package / Parcel Lifecycle (send_orders.status)                    */
/* -------------------------------------------------------------------------- */

export const SEND_ORDER_STATES = [
  'pending_payment',
  'finding_rider',
  'assigned_rider',
  'pickup',
  'on_the_way',
  'delivered',
  'cancelled',
] as const;

export type SendOrderState = (typeof SEND_ORDER_STATES)[number];

export const sendOrderStateMachine = defineStateMachine<'sendOrder', SendOrderState>({
  id: 'sendOrder',
  description:
    'On-demand parcel delivery (Send Package) lifecycle from payment through rider matching, pickup, transit, and drop-off.',
  source: { table: 'send_orders', column: 'status' },
  initial: 'pending_payment',
  states: SEND_ORDER_STATES,
  transitions: {
    pending_payment: ['finding_rider', 'cancelled'],
    finding_rider: ['assigned_rider', 'cancelled'],
    assigned_rider: ['pickup', 'on_the_way', 'cancelled'],
    pickup: ['on_the_way', 'delivered'],
    on_the_way: ['delivered'],
    delivered: [],
    cancelled: [],
  },
  meta: {
    pending_payment: {
      label: 'Pending Payment',
      shortLabel: 'Unpaid',
      description: 'Parcel order created; awaiting Paystack or wallet payment.',
      tone: 'warning',
      stepIndex: 0,
      flags: { canCancel: true, requiresPayment: true },
    },
    finding_rider: {
      label: 'Finding Rider',
      shortLabel: 'Finding Rider',
      description: 'Paid and broadcasted to available riders nearby.',
      tone: 'warning',
      stepIndex: 1,
      flags: { canCancel: true, isSearching: true },
    },
    assigned_rider: {
      label: 'Rider Assigned',
      shortLabel: 'Assigned',
      description: 'Rider accepted the parcel delivery and is heading to pickup.',
      tone: 'info',
      stepIndex: 2,
      aliases: ['assigned', 'started'],
      flags: { canCancel: true, isActiveDelivery: true },
    },
    pickup: {
      label: 'At Pickup',
      shortLabel: 'Pickup',
      description: 'Rider is collecting the parcel from the sender.',
      tone: 'info',
      stepIndex: 3,
      flags: { isInTransit: true, isActiveDelivery: true },
    },
    on_the_way: {
      label: 'On the Way',
      shortLabel: 'In Transit',
      description: 'Parcel is in transit to the drop-off recipient.',
      tone: 'info',
      stepIndex: 4,
      flags: { isInTransit: true, isActiveDelivery: true },
    },
    delivered: {
      label: 'Delivered',
      shortLabel: 'Delivered',
      description: 'Parcel delivered to the recipient.',
      tone: 'success',
      stepIndex: 5,
      terminal: true,
    },
    cancelled: {
      label: 'Cancelled',
      shortLabel: 'Cancelled',
      description: 'Parcel delivery was cancelled.',
      tone: 'danger',
      stepIndex: -1,
      terminal: true,
    },
  },
});

/* -------------------------------------------------------------------------- */
/* 3. Escrow Hold Lifecycle (escrow_holds.status)                             */
/* -------------------------------------------------------------------------- */

export const ESCROW_STATES = [
  'held',
  'released',
  'manual_release',
  'disputed',
  'refunded',
] as const;

export type EscrowState = (typeof ESCROW_STATES)[number];

export const escrowStateMachine = defineStateMachine<'escrow', EscrowState>({
  id: 'escrow',
  description: 'Marketplace escrow hold lifecycle protecting buyer and seller funds.',
  source: { table: 'escrow_holds', column: 'status' },
  initial: 'held',
  states: ESCROW_STATES,
  transitions: {
    held: ['released', 'manual_release', 'disputed', 'refunded'],
    disputed: ['released', 'manual_release', 'refunded'],
    released: [],
    manual_release: [],
    refunded: [],
  },
  meta: {
    held: {
      label: 'Held in Escrow',
      description: 'Funds are safely locked until delivery confirmation.',
      tone: 'warning',
    },
    released: {
      label: 'Released',
      description: 'Funds released to seller/rider wallets automatically.',
      tone: 'success',
      terminal: true,
    },
    manual_release: {
      label: 'Manually Released',
      description: 'Funds released by admin override.',
      tone: 'success',
      terminal: true,
    },
    disputed: {
      label: 'Disputed',
      description: 'Escrow frozen pending admin resolution.',
      tone: 'danger',
      flags: { requiresAdmin: true },
    },
    refunded: {
      label: 'Refunded',
      description: 'Escrow funds returned to buyer.',
      tone: 'neutral',
      terminal: true,
    },
  },
});

/* -------------------------------------------------------------------------- */
/* 4. Order Settlement Lifecycle (orders.settlement_status)                   */
/* -------------------------------------------------------------------------- */

export const SETTLEMENT_STATES = [
  'pending',
  'processing',
  'settled',
  'partially_settled',
  'failed',
  'refunded',
] as const;

export type SettlementState = (typeof SETTLEMENT_STATES)[number];

export const settlementStateMachine = defineStateMachine<'settlement', SettlementState>({
  id: 'settlement',
  description: 'Financial settlement state for marketplace order disbursements.',
  source: { table: 'orders', column: 'settlement_status' },
  initial: 'pending',
  states: SETTLEMENT_STATES,
  transitions: {
    pending: ['processing', 'settled', 'partially_settled', 'failed', 'refunded'],
    processing: ['settled', 'partially_settled', 'failed'],
    partially_settled: ['settled', 'refunded'],
    failed: ['processing', 'settled', 'refunded'],
    settled: ['refunded'],
    refunded: [],
  },
  meta: {
    pending: {
      label: 'Pending Settlement',
      description: 'Order not yet settled.',
      tone: 'warning',
    },
    processing: {
      label: 'Processing',
      description: 'Disbursement in progress.',
      tone: 'info',
    },
    settled: {
      label: 'Settled',
      description: 'All parties (seller, rider, promoter, platform) settled.',
      tone: 'success',
    },
    partially_settled: {
      label: 'Partially Settled',
      description: 'Some parties settled; remainder pending.',
      tone: 'warning',
    },
    failed: {
      label: 'Settlement Failed',
      description: 'Disbursement encountered an error and requires retry.',
      tone: 'danger',
    },
    refunded: {
      label: 'Refunded',
      description: 'Settlement reversed due to buyer refund.',
      tone: 'neutral',
      terminal: true,
    },
  },
});

/* -------------------------------------------------------------------------- */
/* 5. Payout Request Lifecycle (payout_requests.status)                       */
/* -------------------------------------------------------------------------- */

export const PAYOUT_STATES = ['pending', 'approved', 'paid', 'rejected', 'cancelled'] as const;
export type PayoutState = (typeof PAYOUT_STATES)[number];

export const payoutStateMachine = defineStateMachine<'payout', PayoutState>({
  id: 'payout',
  description: 'Seller, rider, and promoter wallet withdrawal request lifecycle.',
  source: { table: 'payout_requests', column: 'status' },
  initial: 'pending',
  states: PAYOUT_STATES,
  transitions: {
    pending: ['approved', 'paid', 'rejected', 'cancelled'],
    approved: ['paid', 'rejected'],
    paid: [],
    rejected: [],
    cancelled: [],
  },
  meta: {
    pending: {
      label: 'Pending Review',
      description: 'Withdrawal queued for admin/Paystack transfer processing.',
      tone: 'warning',
      flags: { requiresAdmin: true },
    },
    approved: {
      label: 'Approved',
      description: 'Payout approved and queued for transfer.',
      tone: 'info',
    },
    paid: {
      label: 'Paid',
      description: 'Funds transferred to bank account.',
      tone: 'success',
      aliases: ['completed'],
      terminal: true,
    },
    rejected: {
      label: 'Rejected',
      description: 'Withdrawal rejected; funds returned to wallet.',
      tone: 'danger',
      terminal: true,
    },
    cancelled: {
      label: 'Cancelled',
      description: 'Withdrawal cancelled before disbursement.',
      tone: 'neutral',
      terminal: true,
    },
  },
});

/* -------------------------------------------------------------------------- */
/* 6. KYC / Verification Lifecycle (seller & logistics verifications)         */
/* -------------------------------------------------------------------------- */

export const VERIFICATION_STATES = ['pending', 'verified', 'rejected'] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const verificationStateMachine = defineStateMachine<'verification', VerificationState>({
  id: 'verification',
  description: 'Seller and logistics rider KYC verification lifecycle.',
  source: { table: 'seller_verifications / logistics_verifications', column: 'status' },
  initial: 'pending',
  states: VERIFICATION_STATES,
  transitions: {
    pending: ['verified', 'rejected'],
    rejected: ['pending', 'verified'],
    verified: [],
  },
  meta: {
    pending: {
      label: 'Pending Review',
      description: 'KYC documents submitted and awaiting admin review.',
      tone: 'warning',
      flags: { requiresAdmin: true },
    },
    verified: {
      label: 'Verified',
      description: 'Account identity verified and approved to operate.',
      tone: 'success',
      aliases: ['approved'],
      terminal: true,
    },
    rejected: {
      label: 'Rejected',
      description: 'Verification rejected; user may resubmit updated documents.',
      tone: 'danger',
    },
  },
});

/* -------------------------------------------------------------------------- */
/* 7. Newsletter Campaign Lifecycle (newsletter_campaigns.status)             */
/* -------------------------------------------------------------------------- */

export const CAMPAIGN_STATES = ['draft', 'sending', 'sent', 'failed'] as const;
export type CampaignState = (typeof CAMPAIGN_STATES)[number];

export const campaignStateMachine = defineStateMachine<'campaign', CampaignState>({
  id: 'campaign',
  description: 'Admin email newsletter broadcast lifecycle.',
  source: { table: 'newsletter_campaigns', column: 'status' },
  initial: 'draft',
  states: CAMPAIGN_STATES,
  transitions: {
    draft: ['sending'],
    sending: ['sent', 'failed'],
    failed: ['sending', 'draft'],
    sent: [],
  },
  meta: {
    draft: { label: 'Draft', description: 'Saved campaign not yet dispatched.', tone: 'neutral' },
    sending: { label: 'Sending', description: 'Batch email dispatch in progress.', tone: 'info' },
    sent: { label: 'Sent', description: 'All batches dispatched.', tone: 'success', terminal: true },
    failed: { label: 'Failed', description: 'Dispatch failed; eligible for retry.', tone: 'danger' },
  },
});

/* -------------------------------------------------------------------------- */
/* Canonical Registry (DX & AX Introspection)                                 */
/* -------------------------------------------------------------------------- */

export const STATE_MACHINE_REGISTRY = {
  order: orderStateMachine,
  sendOrder: sendOrderStateMachine,
  escrow: escrowStateMachine,
  settlement: settlementStateMachine,
  payout: payoutStateMachine,
  verification: verificationStateMachine,
  campaign: campaignStateMachine,
} as const;

export function describeAllStateMachines() {
  return Object.values(STATE_MACHINE_REGISTRY).map((machine) =>
    describeStateMachine(machine as any),
  );
}
