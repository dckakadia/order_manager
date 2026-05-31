# Implementation Plan: CI/CD, Order Status History, and Service Layer

This plan outlines the next major architectural features for the Order Manager: adding an automated deployment pipeline, auditing order status transitions, and extracting business logic into a dedicated Service Layer.

## User Review Required
> [!IMPORTANT]
> **GitHub Secrets Setup for CI/CD**
> To allow GitHub Actions to deploy to your Ubuntu server, you will need to add three secrets to your GitHub repository (`Settings > Secrets and variables > Actions > New repository secret`):
> 1. `SSH_HOST`: Your server IP (e.g., `116.74.77.22`)
> 2. `SSH_USERNAME`: Your SSH username (e.g., `dckakadia`)
> 3. `SSH_PASSWORD`: Your SSH password (or `SSH_PRIVATE_KEY` if you use an RSA key).

## Open Questions
- Do you use a password or an SSH key to log into your Ubuntu server? I will configure the GitHub Actions workflow to use a password by default, but it can be changed to an SSH key.
- Where exactly is the project located on your server? I will assume `~/order_manager` based on our previous terminal sessions.

## Proposed Changes

---

### Backend Service Layer

Extracting database operations into service classes to enable isolated unit testing and clean up route files.

#### [NEW] `backend/services/orderService.js`
- Move all Prisma calls for `Order` (`create`, `findMany`, `update`, `delete`) from `orders.js`.
- Integrate the new `OrderStatusHistory` creation logic here.

#### [NEW] `backend/services/customerService.js`
- Move all Prisma calls for `Customer` from `customers.js`.

#### [NEW] `backend/services/itemService.js`
- Move all Prisma calls for `Item` from `items.js`.

#### [MODIFY] `backend/routes/orders.js`, `customers.js`, `items.js`
- Refactor routes to instantiate and call methods from their respective service files.
- Keep only request validation, HTTP response handling, and `Socket.IO` emitting in the routes.

---

### Order Status History

Adding a robust audit trail for every order status change.

#### [MODIFY] `backend/prisma/schema.prisma`
Add a new model to track historical states.
```prisma
model OrderStatusHistory {
  id              Int      @id @default(autoincrement())
  orderId         Int
  order           Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  previousStatus  String?  // Null if this is the initial creation
  newStatus       String
  changedByUserId Int?
  user            User?    @relation(fields: [changedByUserId], references: [id], onDelete: SetNull)
  timestamp       DateTime @default(now())
  
  @@index([orderId])
  @@index([timestamp])
}
```
Update `Order` and `User` models to include the reverse relation:
```prisma
  // In Order model:
  statusHistory OrderStatusHistory[]
  
  // In User model:
  statusChanges OrderStatusHistory[]
```

#### [MODIFY] `backend/services/orderService.js`
- Update `createOrder` to automatically insert the initial status into `OrderStatusHistory`.
- Update `updateOrderStatus` to insert a record into `OrderStatusHistory` with the `previousStatus`, `newStatus`, and the ID of the user performing the action (`req.user.id`).

#### [MODIFY] `backend/routes/orders.js`
- Add a new endpoint `GET /api/orders/:id/history` to retrieve the timeline of an order.

---

### CI/CD Pipeline

Automating the testing and deployment workflow on every push to the `master` branch.

#### [NEW] `.github/workflows/deploy.yml`
Create a GitHub Actions workflow with two jobs:
1. **Test Job**: Runs `npm install` and `npm test` on a runner.
2. **Deploy Job**: If tests pass, uses `appleboy/ssh-action` to connect to your Ubuntu server, pull the latest code, install dependencies, run migrations (`npx prisma db push --accept-data-loss`), and restart PM2.

## Verification Plan

### Automated Tests
- The existing API tests will be run automatically on GitHub Actions.
- Add mock service tests to verify the service layer if necessary.

### Manual Verification
- Commit and push to `master`.
- Watch the GitHub Actions tab to ensure the pipeline runs `npm test` successfully and then connects to the server to deploy the code.
- Create a new order and update its status; then query the database to verify `OrderStatusHistory` records are generated correctly.
