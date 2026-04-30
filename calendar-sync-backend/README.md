# Calendar Sync Backend

Two-way sync between Google Calendar and Microsoft Outlook Calendar.

## Quick Start (Local Development)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your OAuth credentials
```

### 3. Start DynamoDB Local
```bash
# Using Docker:
docker run -p 8000:8000 amazon/dynamodb-local

# Or download from: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html
```

### 4. Create tables
```bash
npm run setup-db
```

### 5. Start the server
```bash
npm run dev
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | None | Health check |
| POST | `/api/register` | HMAC | Register user for sync |
| POST | `/api/unregister` | HMAC | Stop syncing |
| GET | `/api/status/:userId` | HMAC | Check sync health |
| POST | `/webhooks/google` | Google token | Google push notification |
| POST | `/webhooks/microsoft` | MS clientState | Microsoft notification |
| POST | `/dev/poll` | None | Manual poll trigger (dev only) |
| POST | `/dev/renew-webhooks` | None | Manual webhook renewal (dev only) |

## Architecture

```
Mobile App → POST /api/register (sends refresh tokens)
                    ↓
              DynamoDB (stores tokens + mappings)
                    ↓
        Google Webhook ←→ Sync Engine ←→ Microsoft Webhook
                    ↓
         EventBridge Poll (every 5 min, smart: only stale users)
```

## AWS Deployment

```bash
npm run build
npx serverless deploy
```
