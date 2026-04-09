import { prisma } from '../../config/prisma';
import { MembershipStatus, PaymentMethod, AuditAction } from '@prisma/client';
import { createAuditLog } from '../../utils/audit';

export interface CreateMembershipParams {
  gymId: string;
  userId: string;
  actorUserId: string;
  membershipMonths: number;
  paymentMethod: PaymentMethod;
  amount: number;
  currency: string;
}

export interface RenewMembershipParams {
  gymId: string;
  userId: string;
  actorUserId: string;
  membershipMonths: number;
  paymentMethod: PaymentMethod;
  amount: number;
  currency: string;
}

/**
 * Calculate membership status based on dates
 */
export function calculateMembershipStatus(
  membershipStartAt: Date | null,
  membershipEndAt: Date | null
): MembershipStatus | null {
  if (!membershipEndAt) {
    return null;
  }

  const now = new Date();
  const daysUntilExpiry = Math.floor(
    (membershipEndAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry < 0) {
    return MembershipStatus.EXPIRED;
  }

  if (daysUntilExpiry <= 7) {
    return MembershipStatus.EXPIRING;
  }

  return MembershipStatus.ACTIVE;
}

/**
 * Activate a new membership for a user
 */
export async function activateMembership(
  params: CreateMembershipParams
): Promise<{
  user: any;
  transaction: any;
  status: MembershipStatus;
}> {
  const { gymId, userId, actorUserId, membershipMonths, paymentMethod, amount, currency } =
    params;

  const now = new Date();
  const membershipStartAt = now;
  const membershipEndAt = new Date(
    now.getFullYear(),
    now.getMonth() + membershipMonths,
    now.getDate()
  );

  return await prisma.$transaction(async (tx: any) => {
    // Create membership transaction record
    const transaction = await tx.membershipTransaction.create({
      data: {
        gymId,
        userId,
        actorUserId,
        type: 'activation',
        paymentMethod,
        amount,
        currency,
        membershipMonths,
        membershipStartAt,
        membershipEndAt,
      },
    });

    // Calculate new status
    const status = calculateMembershipStatus(membershipStartAt, membershipEndAt);

    // Update user with new membership dates and status
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        membershipStartAt,
        membershipEndAt,
        membershipStatus: status,
      },
    });

    return {
      user,
      transaction,
      status: status || MembershipStatus.ACTIVE,
    };
  });
}

/**
 * Renew an existing membership
 */
export async function renewMembership(
  params: RenewMembershipParams
): Promise<{
  user: any;
  transaction: any;
  status: MembershipStatus;
}> {
  const { gymId, userId, actorUserId, membershipMonths, paymentMethod, amount, currency } =
    params;

  // Get current user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Calculate new membership end date
  const startDate = user.membershipEndAt || new Date();
  const newEndDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth() + membershipMonths,
    startDate.getDate()
  );

  return await prisma.$transaction(async (tx: any) => {
    // Create membership transaction record
    const transaction = await tx.membershipTransaction.create({
      data: {
        gymId,
        userId,
        actorUserId,
        type: 'renewal',
        paymentMethod,
        amount,
        currency,
        membershipMonths,
        membershipStartAt: startDate,
        membershipEndAt: newEndDate,
      },
    });

    // Calculate new status
    const status = calculateMembershipStatus(startDate, newEndDate);

    // Update user with new membership end date and status
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        membershipEndAt: newEndDate,
        membershipStatus: status,
      },
    });

    return {
      user: updatedUser,
      transaction,
      status: status || MembershipStatus.ACTIVE,
    };
  });
}

/**
 * Get current membership status for a user
 */
export async function getUserMembershipStatus(userId: string): Promise<{
  status: MembershipStatus | null;
  user: any;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const status = calculateMembershipStatus(user.membershipStartAt, user.membershipEndAt);

  // Update status in DB if it changed
  if (status !== user.membershipStatus) {
    await prisma.user.update({
      where: { id: userId },
      data: { membershipStatus: status },
    });
  }

  return {
    status,
    user,
  };
}

/**
 * Cancel a membership
 */
export async function cancelMembership(
  userId: string,
  actorUserId: string,
  gymId: string
): Promise<{ user: any }> {
  return await prisma.$transaction(async (tx: any) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        membershipStatus: MembershipStatus.INACTIVE,
        membershipEndAt: new Date(),
      },
    });

    return { user };
  });
}
