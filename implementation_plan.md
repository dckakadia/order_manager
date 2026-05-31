# Implementation Plan: Tests, Pagination, Status History, & Error Boundaries

This plan covers the final set of missing features and bug fixes to ensure the application is robust, scalable, and fully tested.

## Proposed Changes

---

### 1. React Error Boundary

To prevent the entire application from unmounting and displaying a "white screen of death" if a single component fails.

#### [NEW] `frontend/src/ErrorBoundary.jsx`
- Create a standard React Error Boundary class component.
- It will catch JS errors anywhere in the child component tree, log them, and display a fallback UI with a "Reload Application" button.

#### [MODIFY] `frontend/src/main.jsx`
- Import `ErrorBoundary` and wrap the `<App />` component.

---

### 2. Status History Display (Manager Dashboard)

Currently, the backend tracks status changes via `OrderStatusHistory`, but the UI doesn't expose this data.

#### [MODIFY] `frontend/src/ManagerDashboard.jsx`
- Add a new "History" button or link to the Accountant Order Table for each order.
- Create an `OrderHistoryModal` component state.
- When clicked, fetch `GET /api/orders/:id/history` and display a vertical timeline showing:
  - Timestamp of the change.
  - Previous Status -> New Status.
  - The Username of the employee who made the change.

---

### 3. Pagination UI

The backend already supports `page` and `limit` query parameters, but the frontend currently fetches all orders (or defaults to the first page) without a way to navigate.

#### [MODIFY] `frontend/src/LiveOrderStatus.jsx`
- Add `page` and `totalPages` state.
- Update `apiFetch` to include `?page=${page}&limit=20`.
- Add a standard `<div className="pagination">` block at the bottom with "Previous" and "Next" buttons, along with a "Page X of Y" indicator.
- Automatically refresh data when `page` changes.

#### [MODIFY] `frontend/src/SalesForm.jsx`
- Apply the exact same pagination state and UI controls to the "Recent Orders" list shown below the sales form.

---

### 4. Comprehensive API Tests

Expand the test suite to ensure business-critical logic doesn't silently break.

#### [MODIFY] `backend/__tests__/api.test.js`
- **Order CRUD**: Test creating, reading, updating, and soft-deleting an order.
- **Customer Deletion Constraint**: Test that deleting a customer who has existing orders returns a `400 Bad Request` with the correct error message (preventing orphaned records).
- **Rate Limiting**: Create a loop of rapid login requests to verify that `express-rate-limit` correctly triggers a `429 Too Many Requests` error.

## Verification Plan

### Automated Verification
- Run `npm test` in the backend directory. We expect 10+ passing tests, specifically validating the new CRUD, constraint, and rate limit behaviors.

### Manual Verification
- **Error Boundary**: Temporarily introduce a bug in a React component and verify the friendly fallback UI appears instead of a blank screen.
- **Status History**: Open the Manager Dashboard, click "History" on a recently modified order, and verify the timeline renders correctly.
- **Pagination**: Navigate to the Live Order Status page and use the Previous/Next buttons to browse older records.
