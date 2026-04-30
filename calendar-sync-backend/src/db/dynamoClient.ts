/**
 * db/dynamoClient.ts — Shared DynamoDB client instance.
 *
 * Uses the endpoint override for local development (DynamoDB Local).
 * In production (Lambda), endpoint is undefined and uses the default AWS endpoint.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { config } from "../config";

const baseClient = new DynamoDBClient({
  region: config.db.region,
  ...(config.db.endpoint ? { endpoint: config.db.endpoint } : {}),
});

export const docClient = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
