import { z } from 'zod';

export const recordPaymentSchema = z.object({
  userId: z.string().min(1, 'userIdisrequired'),
  membershipMonths: z.number().positive('membershipMonths must be positive'),
  paymentMethod: z.enum(['card', 'transfer', 'cash', 'sinpe']),
  amount: z.number().positive('amount must be positive'),
  currency: z.string().default('USD'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const getMembershipStatusSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

export type GetMembershipStatusInput = z.infer<typeof getMembershipStatusSchema>;
