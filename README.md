# Digital Banking System

Backend implementation for the Digital Banking System assignment.

## Stack

- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma
- JWT
- bcrypt
- Zod

## Implemented requirements

- Customer registration and login
- JWT authentication
- BVN/NIN onboarding workflow
- Account creation only after successful verification
- Maximum one account per customer
- ₦15,000 initial account pre-funding
- Account balance enquiry
- Intra-bank transfers
- Inter-bank transfer adapter
- Name enquiry adapter
- Transaction history with customer-level data isolation
- Transaction status
- Database transaction handling for intra-bank transfers
- Environment-based secrets

## NIBSS By Phoenix integration

This project is wired to the endpoints in the supplied NIBSS By Phoenix API documentation.

Base URL:

`https://nibssbyphoenix.onrender.com`

The integration uses:

- `POST /api/fintech/onboard`
- `POST /api/auth/token`
- `POST /api/account/create`
- `GET /api/account/name-enquiry/{accountNumber}`
- `GET /api/account/balance/{accountNumber}`
- `POST /api/transfer`
- `GET /api/transaction/{transactionId}`
- `POST /api/validateBvn`
- `POST /api/validateNin`

The documentation states that protected endpoints require a Bearer JWT and that the JWT expires after one hour.

### First-time fintech onboarding

Put your assigned company/bank name and email in `.env`, then run:

```bash
npm run nibss:onboard
```

The documentation's onboarding endpoint returns `apiKey`, `apiSecret`, `bankCode`, and `bankName`. Copy the returned `apiKey` and `apiSecret` into `.env`.

Never commit those secrets.

### Customer KYC

Use only sandbox/test identifiers provided by the course/assignment. Do not use real BVN or NIN values.

The backend calls `validateBvn` or `validateNin`, stores the returned verification result, and only permits account creation after successful verification.

### Account creation

The backend then calls NIBSS By Phoenix `POST /api/account/create` with:

```json
{
  "kycType": "bvn",
  "kycID": "SANDBOX_BVN",
  "dob": "YYYY-MM-DD"
}
```

The provider generates the 10-digit account number and returns a starting balance of ₦15,000 according to the supplied documentation.

### Transfers

Before transfer, the backend performs the documented name enquiry. It then calls the provider's transfer endpoint. A local recipient in the database is classified as an intra-bank transfer; an account not belonging to the local bank is classified as inter-bank.

The provider's returned transaction ID is stored as the transaction reference/TSQ and is used by the transaction-status endpoint.

### Important implementation note

The assignment's "no real BVN/NIN" instruction is respected. The API client validates the 11-digit format but does not contain any real customer identity values.


## Setup

1. Install Node.js 20+ and PostgreSQL.
2. Create a PostgreSQL database named `digital_bank`.
3. Copy `.env.example` to `.env`.
4. Set `DATABASE_URL` and `JWT_SECRET`.
5. Install dependencies:

```bash
npm install
```

6. Generate Prisma client:

```bash
npm run prisma:generate
```

7. Run migration:

```bash
npx prisma migrate dev --name init
```

8. Start development server:

```bash
npm run dev
```

API:

`http://localhost:5000`

Health check:

`GET /health`

## Core API

### Register
`POST /api/v1/auth/register`

```json
{
  "email": "test@example.com",
  "password": "Password123!",
  "firstName": "Test",
  "lastName": "Customer",
  "phone": "08000000000"
}
```

### Login
`POST /api/v1/auth/login`

```json
{
  "email": "test@example.com",
  "password": "Password123!"
}
```

Use the returned JWT as:

`Authorization: Bearer <token>`

### BVN onboarding
`POST /api/v1/onboarding/bvn`

```json
{
  "identifier": "SANDBOX_BVN"
}
```

### NIN onboarding
`POST /api/v1/onboarding/nin`

```json
{
  "identifier": "SANDBOX_NIN"
}
```

### Onboarding status
`GET /api/v1/onboarding/status`

### Create account
`POST /api/v1/accounts`

The customer must be verified first. The account receives ₦15,000.

### Account/balance
`GET /api/v1/accounts`
`GET /api/v1/accounts/balance`

### Name enquiry
`POST /api/v1/transfers/name-enquiry`

For the local development implementation, `bankCode: "SELF"` resolves an account locally.

For external banks, connect the exact NIBSS By Phoenix endpoint.

### Transfer
`POST /api/v1/transfers`

```json
{
  "recipientAccountNumber": "1234567890",
  "recipientBankCode": "SELF",
  "amount": 5000,
  "description": "Test transfer"
}
```

### Transaction history
`GET /api/v1/transactions`

Only transactions belonging to the authenticated customer's account are returned.

### Transaction status
`GET /api/v1/transactions/:reference`

## Security

- Passwords are hashed with bcrypt.
- JWT protects customer endpoints.
- NIBSS credentials belong in `.env`, not source code.
- BVN/NIN values are encrypted before database storage.
- Transaction history is filtered by the authenticated user's account.
- Account creation is constrained to one account per customer at database level.
- Monetary values are stored as integer kobo to avoid floating-point currency errors.

## Suggested Postman test order

1. Register Customer A
2. Login Customer A
3. Complete sandbox BVN/NIN verification
4. Confirm onboarding status
5. Create Customer A account
6. Confirm ₦15,000 balance
7. Register Customer B
8. Login Customer B
9. Complete sandbox verification
10. Create Customer B account
11. Name enquiry Customer B
12. Transfer ₦5,000 from A to B
13. Check A balance
14. Check B balance
15. Check transaction history for A
16. Check transaction history for B
17. Check transaction status
18. Attempt to create a second account for A — must fail
19. Attempt transfer above available balance — must fail
20. Attempt unauthorized transaction/account access — must not expose another customer's data
