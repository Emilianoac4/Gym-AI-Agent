const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config({ quiet: true });

(async () => {
  const prisma = new PrismaClient();
  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'admin', isActive: true, deletedAt: null },
      select: { id: true, gymId: true, email: true },
    });

    if (!admin) {
      console.log(JSON.stringify({ ok: false, error: 'NO_ADMIN' }));
      return;
    }

    const member = await prisma.user.findFirst({
      where: { gymId: admin.gymId, role: 'member', isActive: true, deletedAt: null },
      select: { id: true, email: true, membershipEndAt: true },
    });

    const token = jwt.sign(
      { userId: admin.id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    console.log(JSON.stringify({ ok: true, admin, member, token }));
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: String(error) }));
  } finally {
    await prisma.$disconnect();
  }
})();
