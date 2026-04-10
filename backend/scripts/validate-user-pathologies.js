/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

try {
  require("dotenv").config();
} catch {}

const prisma = new PrismaClient();

async function main() {
  const tableRows = await prisma.$queryRawUnsafe(`
    SELECT to_regclass('public.user_pathologies')::text AS regclass
  `);

  const columnRows = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_pathologies'
    ORDER BY ordinal_position
  `);

  const indexRows = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'user_pathologies'
    ORDER BY indexname
  `);

  const rowCountRows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS count
    FROM public.user_pathologies
  `).catch(() => [{ count: null }]);

  const regclass = tableRows?.[0]?.regclass ?? null;
  const columnNames = new Set((columnRows || []).map((row) => row.column_name));
  const indexNames = new Set((indexRows || []).map((row) => row.indexname));
  const rowCount = rowCountRows?.[0]?.count ?? null;

  const checks = [
    {
      label: "table public.user_pathologies exists",
      ok: Boolean(regclass),
      detail: regclass || "missing",
    },
    {
      label: "column allow_trainer_view exists",
      ok: columnNames.has("allow_trainer_view"),
      detail: columnNames.has("allow_trainer_view") ? "present" : "missing",
    },
    {
      label: "column notes exists",
      ok: columnNames.has("notes"),
      detail: columnNames.has("notes") ? "present" : "missing",
    },
    {
      label: "column pathology_key exists",
      ok: columnNames.has("pathology_key"),
      detail: columnNames.has("pathology_key") ? "present" : "missing",
    },
    {
      label: "unique tuple index exists",
      ok: indexNames.has("idx_user_pathologies_user_key_label_unique"),
      detail: indexNames.has("idx_user_pathologies_user_key_label_unique") ? "present" : "missing",
    },
    {
      label: "active lookup index exists",
      ok: indexNames.has("idx_user_pathologies_user_active"),
      detail: indexNames.has("idx_user_pathologies_user_active") ? "present" : "missing",
    },
  ];

  console.log("=== validate:user-pathologies ===");
  console.log(`DATABASE_URL host check: ${process.env.DATABASE_URL ? "configured" : "missing"}`);
  console.log("");

  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.label} (${check.detail})`);
  }

  console.log("");
  console.log("Columns found:");
  for (const row of columnRows || []) {
    console.log(`- ${row.column_name} :: ${row.data_type} :: nullable=${row.is_nullable}`);
  }

  console.log("");
  console.log("Indexes found:");
  for (const row of indexRows || []) {
    console.log(`- ${row.indexname}`);
  }

  console.log("");
  console.log(`Row count: ${rowCount === null ? "unavailable" : rowCount}`);

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    console.error("");
    console.error("Validation failed. Execute backend/prisma/add_user_pathologies.sql in Supabase SQL Editor.");
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("Validation passed.");
}

main()
  .catch((error) => {
    console.error("Validation errored:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
