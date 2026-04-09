import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { recordPaymentSchema, getMembershipStatusSchema } from './payment.validation';
import { activateMembership, renewMembership, getUserMembershipStatus } from '../memberships/membership.service';
import { MembershipTransaction, AuditAction } from '@prisma/client';
import { createAuditLog } from '../../utils/audit';
import { HttpError } from '../../utils/http-error';

/**
 * POST /payments
 * Record a new payment for membership activation or renewal
 */
export async function recordPayment(req: Request, res: Response): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const actorUserId = req.auth.userId;
    const requester = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: { gymId: true, isActive: true },
    });

    if (!requester || !requester.isActive) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const gymId = requester.gymId;

    // Validate input
    const validated = recordPaymentSchema.parse(req.body);
    const { userId, membershipMonths, paymentMethod, amount, currency = 'USD', reference, notes } =
      validated;

    // Verify user exists and belongs to same gym
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.gymId !== gymId) {
      res.status(403).json({ error: 'User does not belong to this gym' });
      return;
    }

    // Determine if this is activation or renewal
    const isRenewal = user.membershipEndAt && user.membershipEndAt > new Date();

    let result;
    if (isRenewal) {
      // Renewal
      result = await renewMembership({
        gymId,
        userId,
        actorUserId,
        membershipMonths,
        paymentMethod: paymentMethod as any,
        amount,
        currency,
      });
    } else {
      // Activation (new or expired membership)
      result = await activateMembership({
        gymId,
        userId,
        actorUserId,
        membershipMonths,
        paymentMethod: paymentMethod as any,
        amount,
        currency,
      });
    }

    // Create audit log
    void createAuditLog({
      gymId,
      actorUserId,
      action: AuditAction.payment_recorded,
      resourceType: 'payment',
      resourceId: result.transaction.id,
      changes: {
        type: result.transaction.type,
        paymentMethod: result.transaction.paymentMethod,
        amount: result.transaction.amount,
        currency: result.transaction.currency,
        membershipMonths: result.transaction.membershipMonths,
        membershipEndAt: result.transaction.membershipEndAt,
      },
      metadata: {
        reference,
        notes,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    });

    res.status(201).json({
      success: true,
      transaction: {
        id: result.transaction.id,
        type: result.transaction.type,
        paymentMethod: result.transaction.paymentMethod,
        amount: result.transaction.amount,
        currency: result.transaction.currency,
        membershipMonths: result.transaction.membershipMonths,
        membershipStartAt: result.transaction.membershipStartAt,
        membershipEndAt: result.transaction.membershipEndAt,
      },
      membershipStatus: result.status,
      user: {
        id: result.user.id,
        email: result.user.email,
        membershipStartAt: result.user.membershipStartAt,
        membershipEndAt: result.user.membershipEndAt,
        membershipStatus: result.user.membershipStatus,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.issues });
      return;
    }

    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
}

/**
 * GET /payments/:userId/status
 * Get current membership status for a user
 */
export async function getMembershipStatus(req: Request, res: Response): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const requester = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { gymId: true, isActive: true },
    });

    if (!requester || !requester.isActive) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const gymId = requester.gymId;
    const userIdParam = req.params.userId;
    const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;

    if (!gymId) {
      res.status(400).json({ error: 'Missing gym context' });
      return;
    }

    if (!userId) {
      res.status(400).json({ error: 'Missing user id' });
      return;
    }

    // Verify user exists and belongs to same gym
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.gymId !== gymId) {
      res.status(403).json({ error: 'User does not belong to this gym' });
      return;
    }

    const result = await getUserMembershipStatus(userId);

    res.status(200).json({
      status: result.status,
      membershipStartAt: result.user.membershipStartAt,
      membershipEndAt: result.user.membershipEndAt,
      daysUntilExpiry: result.user.membershipEndAt
        ? Math.floor((result.user.membershipEndAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null,
    });
  } catch (error) {
    console.error('Error getting membership status:', error);
    res.status(500).json({ error: 'Failed to get membership status' });
  }
}

/**
 * GET /payments/gym/summary
 * Get payment summary for a gym (for admin dashboard)
 */
export async function getGymPaymentSummary(req: Request, res: Response): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const requester = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { gymId: true, isActive: true },
    });

    if (!requester || !requester.isActive) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const gymId = requester.gymId;

    const transactions = await prisma.membershipTransaction.findMany({
      where: { gymId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const summary = {
      totalTransactions: transactions.length,
      byType: {
        activation: transactions.filter((t: any) => t.type === 'activation').length,
        renewal: transactions.filter((t: any) => t.type === 'renewal').length,
      },
      byPaymentMethod: transactions.reduce((acc: Record<string, number>, t: any) => {
        acc[t.paymentMethod] = (acc[t.paymentMethod] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalRevenue: transactions.reduce((sum: number, t: any) => sum + t.amount, 0),
      currencyBreakdown: transactions.reduce((acc: Record<string, number>, t: any) => {
        if (!acc[t.currency]) {
          acc[t.currency] = 0;
        }
        acc[t.currency] += t.amount;
        return acc;
      }, {} as Record<string, number>),
      recentTransactions: transactions.slice(0, 10).map((t: any) => ({
        id: t.id,
        userId: t.userId,
        type: t.type,
        paymentMethod: t.paymentMethod,
        amount: t.amount,
        currency: t.currency,
        createdAt: t.createdAt,
      })),
    };

    res.status(200).json(summary);
  } catch (error) {
    console.error('Error getting gym payment summary:', error);
    res.status(500).json({ error: 'Failed to get payment summary' });
  }
}
