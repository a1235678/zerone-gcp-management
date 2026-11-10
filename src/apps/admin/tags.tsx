// 各種狀態對應的標籤顏色。文字一律來自 data/labels，顏色只是輔助。
import {
  billStatusLabel,
  reconcileStateLabel,
  customerStatusLabel,
  dealerStatusLabel,
  domainVerificationLabel,
  logResultLabel,
  operationStatusLabel,
  scheduleStatusLabel,
  subscriptionStatusLabel,
  userStatusLabel,
  workOrderStatusLabel,
} from '@data/labels';
import type {
  BillDisplayStatus,
  ReconcileState,
  CustomerStatus,
  DealerStatus,
  DomainVerification,
  LogResult,
  OperationStatus,
  ScheduleStatus,
  SubscriptionStatus,
  UserStatus,
  WorkOrderStatus,
} from '@data/types';
import { StatusTag, type Tone } from '@shared/components/StatusTag';

const tag = <K extends string>(labels: Record<K, string>, tones: Record<K, Tone>) =>
  function Tag({ value }: { value: K }) {
    return <StatusTag tone={tones[value]}>{labels[value]}</StatusTag>;
  };

export const CustomerStatusTag = tag<CustomerStatus>(customerStatusLabel, { active: 'success', disabled: 'neutral' });
export const DealerStatusTag = tag<DealerStatus>(dealerStatusLabel, { active: 'success', suspended: 'neutral' });
export const DomainVerificationTag = tag<DomainVerification>(domainVerificationLabel, { verified: 'success', pending: 'warning', failed: 'danger' });
export const SubscriptionStatusTag = tag<SubscriptionStatus>(subscriptionStatusLabel, { active: 'success', expiring: 'warning', cancelled: 'neutral' });
export const WorkOrderStatusTag = tag<WorkOrderStatus>(workOrderStatusLabel, {
  draft: 'neutral',
  salesReview: 'warning',
  techReview: 'warning',
  approved: 'info',
  processing: 'info',
  completed: 'success',
  returned: 'danger',
});
export const OperationStatusTag = tag<OperationStatus>(operationStatusLabel, { submitted: 'info', completed: 'success', failed: 'danger', manual: 'warning' });
export const ScheduleStatusTag = tag<ScheduleStatus>(scheduleStatusLabel, { waiting: 'neutral', running: 'info', done: 'success', failed: 'danger', cancelled: 'neutral' });
export const UserStatusTag = tag<UserStatus>(userStatusLabel, { active: 'success', disabled: 'neutral', invited: 'info' });
export const LogResultTag = tag<LogResult>(logResultLabel, { success: 'success', failure: 'danger', warning: 'warning' });
export const BillStatusTag = tag<BillDisplayStatus>(billStatusLabel, { pending: 'warning', billed: 'info', overdue: 'danger', paid: 'success' });
export const ReconcileStateTag = tag<ReconcileState>(reconcileStateLabel, { match: 'success', mismatch: 'warning', resolved: 'info', noInvoice: 'neutral' });
