/* eslint-disable no-console */
const path = require("path");
const { randomUUID } = require("crypto");

const dotenv = require(path.join(__dirname, "..", "backend", "node_modules", "dotenv"));
dotenv.config({ path: path.join(__dirname, "..", "backend", ".env") });

const { PrismaClient } = require(path.join(
  __dirname,
  "..",
  "backend",
  "node_modules",
  "@prisma",
  "client",
));

const prisma = new PrismaClient();

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const ADMIN_IDENTIFIER = process.env.SMOKE_ADMIN_IDENTIFIER || "";
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || "";
const CR_OFFSET_MS = 6 * 60 * 60 * 1000;
const CACHE_WAIT_MS = 31_000;

const todayAmount = 13.37;
const yesterdayAmount = 99.99;

function getCrDayStart(now = new Date()) {
  const crMs = now.getTime() - CR_OFFSET_MS;
  const crDay = new Date(crMs);
  crDay.setUTCHours(0, 0, 0, 0);
  return new Date(crDay.getTime() + CR_OFFSET_MS);
}

async function api(method, url, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { status: res.status, body: json };
}

function assertEqual(name, actual, expected) {
  const ok = actual === expected;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name} | actual=${actual} expected=${expected}`);
  return ok;
}

function assertClose(name, actual, expected, epsilon = 0.001) {
  const ok = Math.abs(actual - expected) <= epsilon;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name} | actual=${actual} expected=${expected}`);
  return ok;
}

async function getSummaryAndKpi(token) {
  const [summaryRes, kpiRes] = await Promise.all([
    api("GET", `${BASE_URL}/operations/admin-dashboard-summary`, token),
    api("GET", `${BASE_URL}/operations/kpi`, token),
  ]);

  if (summaryRes.status !== 200) {
    throw new Error(`Summary failed with status ${summaryRes.status}`);
  }
  if (kpiRes.status !== 200) {
    throw new Error(`KPI failed with status ${kpiRes.status}`);
  }

  return { summary: summaryRes.body.summary, kpi: kpiRes.body.kpi };
}

async function main() {
  if (!ADMIN_IDENTIFIER || !ADMIN_PASSWORD) {
    console.error("Missing env vars: SMOKE_ADMIN_IDENTIFIER and SMOKE_ADMIN_PASSWORD");
    process.exit(2);
  }

  const loginRes = await api("POST", `${BASE_URL}/auth/login`, null, {
    identifier: ADMIN_IDENTIFIER,
    password: ADMIN_PASSWORD,
  });

  if (loginRes.status !== 200 || !loginRes.body || !loginRes.body.token) {
    console.error("Admin login failed", loginRes.status, loginRes.body);
    process.exit(1);
  }

  const token = loginRes.body.token;
  const adminUser = loginRes.body.user;
  if (!adminUser || adminUser.role !== "admin") {
    console.error("Expected admin role in login response");
    process.exit(1);
  }

  const marker = `tz-smoke-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const todayStart = getCrDayStart(new Date());
  const justBefore = new Date(todayStart.getTime() - 60_000);
  const justAfter = new Date(todayStart.getTime() + 60_000);
  const membershipEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  let tempGlobalId = null;
  let tempUserId = null;

  try {
    // Baseline snapshot
    const baseline = await getSummaryAndKpi(token);

    // Create temporary member in same gym
    const tempGlobal = await prisma.globalUserAccount.create({
      data: {
        id: randomUUID(),
        email: `${marker}@example.com`,
        passwordHash: "TEMP$not-used",
        fullName: `TZ Smoke ${marker}`,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    tempGlobalId = tempGlobal.id;

    const tempUser = await prisma.user.create({
      data: {
        id: randomUUID(),
        gymId: adminUser.gymId,
        globalUserId: tempGlobal.id,
        email: tempGlobal.email,
        fullName: `TZ Smoke ${marker}`,
        role: "member",
        isActive: true,
        membershipStartAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        membershipEndAt: membershipEnd,
      },
    });
    tempUserId = tempUser.id;

    // Stage A: insert only "yesterday" records (just before CR day start)
    await prisma.aIChatLog.create({
      data: {
        id: randomUUID(),
        userId: tempUser.id,
        type: "CHAT",
        userMessage: `${marker} before`,
        aiResponse: "ok",
        createdAt: justBefore,
      },
    });

    await prisma.membershipTransaction.create({
      data: {
        id: randomUUID(),
        gymId: adminUser.gymId,
        userId: tempUser.id,
        actorUserId: adminUser.id,
        type: "renewal",
        paymentMethod: "cash",
        amount: yesterdayAmount,
        currency: baseline.kpi.currency,
        membershipMonths: 1,
        membershipStartAt: justBefore,
        membershipEndAt: membershipEnd,
        createdAt: justBefore,
      },
    });

    await new Promise((r) => setTimeout(r, CACHE_WAIT_MS));
    const afterBefore = await getSummaryAndKpi(token);

    // Stage B: insert only "today" records (just after CR day start)
    await prisma.aIChatLog.create({
      data: {
        id: randomUUID(),
        userId: tempUser.id,
        type: "CHAT",
        userMessage: `${marker} after`,
        aiResponse: "ok",
        createdAt: justAfter,
      },
    });

    const dateKey = `${justAfter.getUTCFullYear()}-${String(justAfter.getUTCMonth() + 1).padStart(2, "0")}-${String(justAfter.getUTCDate()).padStart(2, "0")}`;

    await prisma.routineExerciseLog.create({
      data: {
        id: randomUUID(),
        userId: tempUser.id,
        weekStart: dateKey,
        dateKey,
        sessionDay: "monday",
        exerciseName: `TZ Smoke ${marker}`,
        normalizedExerciseName: `tz-smoke-${marker}`,
        loadKg: 10,
        loadUnit: "kg",
        reps: 10,
        sets: 3,
        performedAt: justAfter,
        createdAt: justAfter,
      },
    });

    await prisma.membershipTransaction.create({
      data: {
        id: randomUUID(),
        gymId: adminUser.gymId,
        userId: tempUser.id,
        actorUserId: adminUser.id,
        type: "renewal",
        paymentMethod: "cash",
        amount: todayAmount,
        currency: baseline.kpi.currency,
        membershipMonths: 1,
        membershipStartAt: justAfter,
        membershipEndAt: membershipEnd,
        createdAt: justAfter,
      },
    });

    await new Promise((r) => setTimeout(r, CACHE_WAIT_MS));
    const afterAfter = await getSummaryAndKpi(token);

    let okAll = true;

    // Yesterday record should not increase today's counters.
    okAll = assertEqual(
      "A) usersActiveToday unchanged by justBefore",
      afterBefore.summary.cards.usersActiveToday.value,
      baseline.summary.cards.usersActiveToday.value,
    ) && okAll;

    okAll = assertClose(
      "B) incomesToday unchanged by justBefore",
      afterBefore.summary.cards.incomesToday.value,
      baseline.summary.cards.incomesToday.value,
    ) && okAll;

    // Today record should increase today's counters.
    okAll = assertEqual(
      "C) usersActiveToday +1 by justAfter",
      afterAfter.summary.cards.usersActiveToday.value,
      afterBefore.summary.cards.usersActiveToday.value + 1,
    ) && okAll;

    okAll = assertClose(
      "D) incomesToday +todayAmount by justAfter",
      afterAfter.summary.cards.incomesToday.value,
      afterBefore.summary.cards.incomesToday.value + todayAmount,
    ) && okAll;

    okAll = assertClose(
      "E) kpi.today.revenue +todayAmount by justAfter",
      afterAfter.kpi.today.revenue,
      afterBefore.kpi.today.revenue + todayAmount,
    ) && okAll;

    console.log(`Summary: ${okAll ? "PASS" : "FAIL"}`);
    process.exit(okAll ? 0 : 1);
  } finally {
    if (tempUserId) {
      await prisma.membershipTransaction.deleteMany({ where: { userId: tempUserId } });
      await prisma.routineExerciseLog.deleteMany({ where: { userId: tempUserId } });
      await prisma.aIChatLog.deleteMany({ where: { userId: tempUserId } });
      await prisma.assistanceRequest.deleteMany({ where: { memberId: tempUserId } });
      await prisma.user.deleteMany({ where: { id: tempUserId } });
    }

    if (tempGlobalId) {
      await prisma.globalUserAccount.deleteMany({ where: { id: tempGlobalId } });
    }

    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error("Timezone smoke failed", err);
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
