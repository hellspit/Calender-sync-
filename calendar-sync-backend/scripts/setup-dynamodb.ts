/**
 * scripts/setup-dynamodb.ts — Create all DynamoDB tables for local development.
 *
 * Usage: npm run setup-db
 * Requires DynamoDB Local running on http://localhost:8000
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";

const endpoint = process.env.DYNAMODB_ENDPOINT || "http://localhost:8000";
const region = process.env.AWS_REGION || "us-east-1";

const client = new DynamoDBClient({ region, endpoint });

const TABLES = [
  {
    TableName: "calendar-sync-users",
    KeySchema: [{ AttributeName: "userId", KeyType: "HASH" as const }],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" as const },
    ],
    BillingMode: "PAY_PER_REQUEST" as const,
  },
  {
    TableName: "calendar-sync-mappings",
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" as const },
      { AttributeName: "googleEventId", KeyType: "RANGE" as const },
    ],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" as const },
      { AttributeName: "googleEventId", AttributeType: "S" as const },
    ],
    BillingMode: "PAY_PER_REQUEST" as const,
  },
  {
    TableName: "calendar-sync-idempotency",
    KeySchema: [
      { AttributeName: "requestHash", KeyType: "HASH" as const },
    ],
    AttributeDefinitions: [
      { AttributeName: "requestHash", AttributeType: "S" as const },
    ],
    BillingMode: "PAY_PER_REQUEST" as const,
    // Note: TTL is enabled separately via UpdateTimeToLive API
    // DynamoDB Local supports TTL but doesn't auto-delete. Fine for dev.
  },
];

async function main() {
  console.log(`\n🗄️  Setting up DynamoDB tables at ${endpoint}\n`);

  const existing = await client.send(new ListTablesCommand({}));
  const existingNames = existing.TableNames ?? [];

  for (const table of TABLES) {
    if (existingNames.includes(table.TableName)) {
      console.log(`  ✅ ${table.TableName} — already exists`);
      continue;
    }

    try {
      await client.send(new CreateTableCommand(table));
      console.log(`  ✅ ${table.TableName} — created`);
    } catch (err: any) {
      console.error(`  ❌ ${table.TableName} — ${err.message}`);
    }
  }

  console.log("\n✨ Done!\n");
}

main().catch(console.error);
