/* eslint-disable no-console */
const { PrismaClient, UserRole } = require("@prisma/client");

try {
  require("dotenv").config();
} catch {}

const prisma = new PrismaClient();
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = next;
    i += 1;
  }

  return parsed;
}

async function httpJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const raw = await response.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = { raw };
  }

  return { status: response.status, ok: response.ok, body };
}

async function login(identifier, password) {
  const loginResponse = await httpJson(`${BASE_URL}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });

  if (loginResponse.ok && loginResponse.body && loginResponse.body.token) {
    return { token: loginResponse.body.token, user: loginResponse.body.user };
  }

  const selector = loginResponse.body;
  if (
    loginResponse.ok &&
    selector &&
    selector.requiresGymSelection &&
    selector.selectorToken &&
    Array.isArray(selector.gyms)
  ) {
    const adminGym = selector.gyms.find((g) => g.role === "admin") || selector.gyms[0];
    if (!adminGym) {
      throw new Error(`No gym option received in selector flow: ${JSON.stringify(selector)}`);
    }

    const selected = await httpJson(`${BASE_URL}/auth/select-gym`, {
      method: "POST",
      body: JSON.stringify({
        selectorToken: selector.selectorToken,
        userId: adminGym.userId,
      }),
    });

    if (!selected.ok || !selected.body || !selected.body.token) {
      throw new Error(`Select gym failed: ${JSON.stringify(selected.body)}`);
    }

    return { token: selected.body.token, user: selected.body.user };
  }

  throw new Error(`Login failed: ${JSON.stringify(loginResponse.body)}`);
}

async function main() {
  const args = parseArgs();
  const identifier = args.identifier || process.env.E2E_ADMIN_IDENTIFIER;
  const password = args.password || process.env.E2E_ADMIN_PASSWORD;

  if (!identifier || !password) {
    throw new Error("Missing credentials. Use --identifier/--password or E2E_ADMIN_IDENTIFIER/E2E_ADMIN_PASSWORD env vars.");
  }

  const cleanup = {
    memberUserId: null,
    memberGlobalId: null,
  };

  try {
    const health = await httpJson(`${BASE_URL}/health`, { method: "GET", headers: {} });
    if (!health.ok) {
      throw new Error(`Health check failed: ${JSON.stringify(health.body)}`);
    }

    const auth = await login(identifier, password);

    const gymId = auth.user && auth.user.gymId
      ? auth.user.gymId
      : (
          await prisma.user.findFirst({
            where: {
              email: identifier.toLowerCase(),
              role: UserRole.admin,
              isActive: true,
              deletedAt: null,
            },
            select: { gymId: true },
          })
        )?.gymId;

    if (!gymId) {
      throw new Error("Unable to resolve admin gymId for test");
    }

    const stamp = Date.now();
    const memberEmail = `e2e.member.${stamp}@tuco.local`;

    const global = await prisma.globalUserAccount.create({
      data: {
        email: memberEmail,
        passwordHash: "TEMP$unused",
        fullName: `E2E Member ${stamp}`,
        emailVerifiedAt: new Date(),
        isActive: true,
      },
      select: { id: true },
    });
    cleanup.memberGlobalId = global.id;

    const member = await prisma.user.create({
      data: {
        gymId,
        globalUserId: global.id,
        email: memberEmail,
        username: `e2e${String(stamp).slice(-8)}`,
        fullName: `E2E Member ${stamp}`,
        role: UserRole.member,
        isActive: true,
      },
      select: { id: true },
    });
    cleanup.memberUserId = member.id;

    const payment = await httpJson(`${BASE_URL}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({
        userId: member.id,
        membershipMonths: 1,
        paymentMethod: "sinpe",
        amount: 15000,
        currency: "CRC",
        reference: "E2E-SINPE",
        notes: "script-e2e",
      }),
    });

    const status = await httpJson(`${BASE_URL}/payments/${member.id}/status`, {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    const summary = await httpJson(`${BASE_URL}/payments/gym/summary`, {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    console.log(
      JSON.stringify(
        {
          baseUrl: BASE_URL,
          gymId,
          memberUserId: member.id,
          results: {
            payment: {
              status: payment.status,
              ok: payment.ok,
              transactionId: payment.body?.transaction?.id || null,
              paymentMethod: payment.body?.transaction?.paymentMethod || null,
              membershipStatus: payment.body?.membershipStatus || null,
            },
            membershipStatus: {
              status: status.status,
              ok: status.ok,
              value: status.body?.status || null,
              daysUntilExpiry: status.body?.daysUntilExpiry ?? null,
            },
            summary: {
              status: summary.status,
              ok: summary.ok,
              totalTransactions: summary.body?.totalTransactions ?? null,
              byPaymentMethod: summary.body?.byPaymentMethod ?? null,
            },
          },
        },
        null,
        2,
      ),
    );
  } finally {
    try {
      if (cleanup.memberUserId) {
        await prisma.membershipTransaction.deleteMany({ where: { userId: cleanup.memberUserId } });
        await prisma.user.deleteMany({ where: { id: cleanup.memberUserId } });
      }
      if (cleanup.memberGlobalId) {
        await prisma.globalUserAccount.deleteMany({ where: { id: cleanup.memberGlobalId } });
      }
    } catch (error) {
      console.error("Cleanup warning:", error instanceof Error ? error.message : error);
    }

    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
