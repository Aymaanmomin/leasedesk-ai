// Runs the real migration in an in-memory Postgres (PGlite) with a minimal stub of
// Supabase's auth schema, then checks Row Level Security and contract immutability.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = join(__dirname, "..", "migrations");
const ALICE = "00000000-0000-0000-0000-00000000000a"; // org A owner
const BOB = "00000000-0000-0000-0000-00000000000b";   // org B owner
const VIC = "00000000-0000-0000-0000-00000000000c";   // org A viewer

let db: PGlite;
let orgA: string;
let orgB: string;
let propA: string;

async function as<T>(user: string, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role authenticated nologin;
    create role anon nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    insert into auth.users values ('${ALICE}'), ('${BOB}'), ('${VIC}');
  `);
  for (const f of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  // No blanket grants here: the migration's own GRANT statements must be sufficient.

  orgA = (await as<{ id: string }>(ALICE, "select public.create_organization('Org A') as id"))[0].id;
  orgB = (await as<{ id: string }>(BOB, "select public.create_organization('Org B') as id"))[0].id;
  await db.query("insert into organization_memberships values ($1, $2, 'viewer')", [orgA, VIC]);

  propA = (await as<{ id: string }>(ALICE,
    "insert into properties (organization_id, name, address_line, city, zip) values ($1, 'Fuel Plaza', '1 Demo', 'Austin', '78701') returning id",
    [orgA]))[0].id;
});

describe("organization isolation (RLS)", () => {
  it("landlord cannot see another organization's properties", async () => {
    expect(await as(BOB, "select id from properties")).toHaveLength(0);
    expect(await as(ALICE, "select id from properties")).toHaveLength(1);
  });

  it("landlord cannot insert records into another organization", async () => {
    await expect(as(BOB,
      "insert into properties (organization_id, name, address_line, city, zip) values ($1, 'X', '1', 'Y', '78701')",
      [orgA])).rejects.toThrow(/row-level security/);
  });

  it("landlord cannot update another organization's records", async () => {
    await as(BOB, "update properties set name = 'hacked' where id = $1", [propA]);
    const rows = await as<{ name: string }>(ALICE, "select name from properties where id = $1", [propA]);
    expect(rows[0].name).toBe("Fuel Plaza");
  });

  it("contract cannot point at another organization's property", async () => {
    await expect(as(BOB,
      "insert into contracts (organization_id, property_id, name, lease_type) values ($1, $2, 'x', 'residential')",
      [orgB, propA])).rejects.toThrow(/another organization|row-level security/);
  });

  it("read-only viewer can read but not write", async () => {
    expect(await as(VIC, "select id from properties")).toHaveLength(1);
    await expect(as(VIC,
      "insert into properties (organization_id, name, address_line, city, zip) values ($1, 'X', '1', 'Y', '78701')",
      [orgA])).rejects.toThrow(/row-level security/);
  });

  it("anonymous users see nothing", async () => {
    expect(await as("", "select id from organizations")).toHaveLength(0);
  });

  it("anon role has no table privileges at all", async () => {
    await db.exec("set role anon;");
    try {
      await expect(db.query("select id from properties")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role;");
    }
  });

  it("authenticated cannot insert organizations directly (only via create_organization)", async () => {
    await expect(as(ALICE, "insert into organizations (name, created_by) values ('x', $1)", [ALICE]))
      .rejects.toThrow(/permission denied/);
  });
});

describe("executed contract immutability", () => {
  let cid: string;
  beforeAll(async () => {
    cid = (await as<{ id: string }>(ALICE,
      "insert into contracts (organization_id, property_id, name, lease_type, status, monthly_rent_cents, end_date) values ($1, $2, 'Signed lease', 'gas_station_adjacent', 'executed', 250000, '2028-01-01') returning id",
      [orgA, propA]))[0].id;
  });

  it("signed contract terms cannot be edited", async () => {
    await expect(as(ALICE, "update contracts set monthly_rent_cents = 1 where id = $1", [cid])).rejects.toThrow(/immutable/);
  });

  it("signed contract cannot be deleted", async () => {
    await expect(as(ALICE, "delete from contracts where id = $1", [cid])).rejects.toThrow(/cannot be deleted/);
  });

  it("stays locked after archiving and cannot return to draft", async () => {
    await as(ALICE, "update contracts set status = 'archived' where id = $1", [cid]);
    await expect(as(ALICE, "update contracts set end_date = '2030-01-01' where id = $1", [cid])).rejects.toThrow(/immutable/);
    await expect(as(ALICE, "update contracts set status = 'draft' where id = $1", [cid])).rejects.toThrow(/immutable/);
  });

  it("drafts remain editable", async () => {
    const id = (await as<{ id: string }>(ALICE,
      "insert into contracts (organization_id, property_id, name, lease_type) values ($1, $2, 'Draft', 'residential') returning id",
      [orgA, propA]))[0].id;
    await as(ALICE, "update contracts set monthly_rent_cents = 100 where id = $1", [id]);
    const rows = await as<{ monthly_rent_cents: string }>(ALICE, "select monthly_rent_cents from contracts where id = $1", [id]);
    expect(Number(rows[0].monthly_rent_cents)).toBe(100);
  });
});

describe("activity log", () => {
  it("is append-only", async () => {
    // Users have no UPDATE/DELETE grant on the log...
    await expect(as(ALICE, "delete from activity_logs")).rejects.toThrow(/permission denied/);
    await expect(as(ALICE, "update activity_logs set event_type = 'x'")).rejects.toThrow(/permission denied/);
    expect((await as(ALICE, "select id from activity_logs")).length).toBeGreaterThan(0);
    // ...and even a privileged role is stopped by the trigger.
    await expect(db.query("delete from activity_logs")).rejects.toThrow(/append-only/);
    await expect(db.query("update activity_logs set event_type = 'x'")).rejects.toThrow(/append-only/);
  });
  it("cannot be forged for another actor", async () => {
    await expect(as(ALICE,
      "insert into activity_logs (organization_id, actor_id, event_type) values ($1, $2, 'x')",
      [orgA, BOB])).rejects.toThrow(/row-level security/);
  });
});
