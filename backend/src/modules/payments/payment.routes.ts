import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeAction } from '../../middleware/authorize.middleware';
import { recordPayment, getMembershipStatus, getGymPaymentSummary } from './payment.controller';

const router = Router();

/**
 * POST /payments
 * Record a new payment for membership activation or renewal
 * Requires: payments.record permission (typically trainer/admin)
 */
router.post('/', authenticate, authorizeAction('payments.record'), recordPayment);

/**
 * GET /payments/:userId/status
 * Get current membership status for a user
 * Requires: users.read permission
 */
router.get('/:userId/status', authenticate, authorizeAction('users.read'), getMembershipStatus);

/**
 * GET /payments/gym/summary
 * Get payment summary for a gym (admin dashboard)
 * Requires: gym.read permission
 */
router.get('/gym/summary', authenticate, authorizeAction('gym.read'), getGymPaymentSummary);

export default router;
