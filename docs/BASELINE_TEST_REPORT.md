# Baseline Test Report (Pre-HMS Conversion)

**Date**: 2026-11-11  
**Branch**: `feat/hms-conversion`  
**Test Runner**: Vitest v5.0.5  
**Result**: 15 passed, 2 failed (159 passed, 13 failed across 172 tests in 17 test files)

---

## Summary of Results

| Metric | Count |
| :--- | :--- |
| **Total Test Suites** | 17 |
| **Passed Suites** | 15 |
| **Failed Suites** | 2 |
| **Total Tests** | 172 |
| **Passed Tests** | 159 |
| **Failed Tests** | 13 |

---

## Detailed Failure Log

### 1. `tests/auth.test.ts` (1 test failure)
- **Suite**: `Staff Authentication System`
- **Test**: `middleware redirects unauthenticated access to /login and rejects /api/admin with 401`
- **Error**: `AssertionError: expected 200 to be 307`
- **Location**: `tests/auth.test.ts:233:38`
- **Root Cause**: Recent change in `middleware.ts` (commit `0d1bc02`) adjusting redirect handling for `/login` subpaths to prevent redirect loops.
- **Action**: Per project rules, left unmodified (unrelated to current task).

### 2. `tests/pos.test.ts` (12 test failures)
- **Suite**: `Prompt 14: POS (Walk-ins and in-store checkout)`
- **Failing Tests (all failed in `beforeEach` hook)**:
  1. `Split Payments Arithmetic & Balances > correctly splits payment across Cash and MoMo and calculates cash change`
  2. `Split Payments Arithmetic & Balances > handles partial payment with remaining balance due and optional tips`
  3. `Split Payments Arithmetic & Balances > successfully processes checkout for walk-in guest with no customerId or phone provided`
  4. `Role-Based Discount Limits & Reason Enforcement > allows Staff up to 5% discount with reason, but rejects discounts > 5%`
  5. `Role-Based Discount Limits & Reason Enforcement > allows Manager up to 20% discount with reason, but rejects discounts > 20%`
  6. `Role-Based Discount Limits & Reason Enforcement > allows Owner up to 100% discount with reason`
  7. `Role-Based Discount Limits & Reason Enforcement > strictly requires a reason when any discount is applied`
  8. `Sequential Gapless Receipt Numbers Under Concurrent Sales > generates sequential receipt numbers with NO gaps across 10 concurrent checkouts`
  9. `Voids & Refunds > allows voiding a receipt with reason and permission, enforcing role refund limits`
  10. `Voids & Refunds > rejects voiding if reason is missing`
  11. `Voids & Refunds > enforces role refund limit on void: Staff cannot void a 100 GHS sale`
  12. `End of Day Summary > aggregates Cash, MoMo, Card, Tips, and Voids correctly`
- **Error**: `PrismaClientKnownRequestError: Invalid prisma.user.findUniqueOrThrow() invocation ... No record was found for a query. where: { email: "owner@aurastudio.gh" }`
- **Location**: `tests/pos.test.ts:16:37`
- **Root Cause**: The integration test suite assumes the test database contains permanent pre-seeded users (`owner@aurastudio.gh`), which are missing when the database has not been seeded prior to running vitest.
- **Action**: Per project rules, left unmodified (unrelated to current task).

---

## Passing Test Suites (15)

1. `tests/availability.test.ts` (16 tests)
2. `tests/concurrency.test.ts` (6 tests)
3. `tests/customers.test.ts` (10 tests)
4. `tests/date.test.ts` (11 tests)
5. `tests/exclusion-constraint.test.ts` (6 tests)
6. `tests/money.test.ts` (13 tests)
7. `tests/notifications.test.ts` (13 tests)
8. `tests/payment-requests.test.ts` (10 tests)
9. `tests/payments.test.ts` (9 tests)
10. `tests/paystack-integration.test.ts` (10 tests)
11. `tests/rate-limit.test.ts` (8 tests)
12. `tests/rbac.test.ts` (12 tests)
13. `tests/reports-audit.test.ts` (9 tests)
14. `tests/self-service.test.ts` (12 tests)
15. `tests/staff-schedule.test.ts` (14 tests)

