# Bet Placement and Management Fix - Bugfix Design

## Overview

This bugfix addresses two critical issues in the Gravity prediction market platform:

1. **Dashboard Bet Placement Flow**: The BetModal component contains complete ZK proof generation logic but the betting flow fails to complete successfully, preventing users from placing bets through the dashboard interface.

2. **Admin Panel Bet Management**: The admin panel lacks any interface for viewing, managing, or monitoring bets placed across markets, limiting administrative oversight and platform health monitoring.

The fix will ensure the bet placement flow completes successfully with proper error handling and UI feedback, and will add a comprehensive bet management interface to the admin panel with filtering, sorting, and analytics capabilities.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when users attempt to place bets through the dashboard or when admins try to view bet data
- **Property (P)**: The desired behavior - bets complete successfully with proper state updates, and admins can view/manage all betting activity
- **Preservation**: Existing functionality (market creation, resolution, wallet connection, ZK proof generation) that must remain unchanged
- **BetModal**: The React component in `components/BetModal.tsx` that handles ZK-sealed bet placement
- **placeBet**: The function in `lib/escrow.ts` that builds unsigned Soroban XDR for the `place_bet` contract call
- **Commitment**: Poseidon hash output from the seal_bet circuit that represents a sealed bet position
- **Sealed Bet**: A bet where the side (YES/NO) is hidden via ZK commitment until market resolution
- **Freighter**: Stellar wallet browser extension used for transaction signing

## Bug Details

### Bug Condition

The bug manifests in two distinct scenarios:

**Scenario 1: Dashboard Bet Placement**
The bug occurs when a user clicks YES or NO on a market card, enters a bet amount in the BetModal, and clicks "Generate Proof & Lock Position". The `handleBet` function in BetModal.tsx executes the following flow:
1. Generates ZK proof using snarkjs and seal_bet circuit
2. Calls `placeBet()` from lib/escrow.ts to build unsigned XDR
3. Signs transaction with Freighter wallet
4. Submits signed XDR to Soroban
5. Indexes bet in Prisma via POST /api/bets
6. Saves proof data to localStorage

The flow may fail at any of these steps without proper error handling, state recovery, or UI feedback.

**Scenario 2: Admin Panel Bet Visibility**
The bug occurs when an admin accesses `/admin` and expects to see betting activity. The admin panel currently only shows markets pending resolution and the IntelligenceDashboard, but provides no interface to view bets, user positions, or betting analytics.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: string, context: object }
  OUTPUT: boolean
  
  RETURN (input.action === "PLACE_BET" 
          AND input.context.modalOpen === true
          AND input.context.hasMarketData === true
          AND (betFlowFails(input.context) OR uiStateInconsistent(input.context)))
         OR
         (input.action === "VIEW_BETS"
          AND input.context.userRole === "ADMIN"
          AND input.context.route === "/admin"
          AND betManagementInterfaceNotPresent())
END FUNCTION

FUNCTION betFlowFails(context)
  RETURN zkProofGenerationFails(context)
         OR xdrBuildingFails(context)
         OR freighterSigningFails(context)
         OR sorobanSubmissionFails(context)
         OR databaseIndexingFails(context)
         OR localStorageSaveFails(context)
END FUNCTION

FUNCTION uiStateInconsistent(context)
  RETURN modalDoesNotClose(context)
         OR marketPoolsNotUpdated(context)
         OR successMessageNotShown(context)
         OR errorNotDisplayed(context)
END FUNCTION

FUNCTION betManagementInterfaceNotPresent()
  RETURN NOT existsComponent("BetManagementTable")
         AND NOT existsEndpoint("/api/bets?marketId=...")
         AND NOT existsUI("FilterBetsByMarket")
END FUNCTION
```

### Examples

**Example 1: Bet Placement Success Path (Expected)**
- User clicks "YES" on "Will BTC reach $100k by EOY?" market
- BetModal opens with side=0 (YES) pre-selected
- User enters amount "50" XLM
- User clicks "Generate Proof & Lock Position"
- ZK proof generates successfully (commitment: "12345...")
- Freighter prompts for signature → user approves
- Transaction submits to Soroban → hash: "abc123..."
- POST /api/bets succeeds → bet indexed in database
- localStorage updated with proof data
- Success message displays: "Bet Sealed Successfully!"
- Modal closes after 2 seconds
- Market card updates: yesPool increases by 50 XLM

**Example 2: Bet Placement Failure - Freighter Rejection (Current Bug)**
- User clicks "NO" on market
- BetModal opens, user enters "25" XLM
- ZK proof generates successfully
- Freighter prompts for signature → user rejects
- Error thrown: "User rejected signing or Freighter error"
- Generic alert displays: "Error generating ZK proof. See console."
- Modal remains open with "Generating ZK Proof..." button stuck
- User cannot retry without closing and reopening modal
- Market state not updated, localStorage not saved

**Example 3: Admin Views Bets (Expected)**
- Admin navigates to `/admin`
- Page displays "Markets Pending Resolution" section
- Below that, "Bet Management" section shows table with columns:
  - Market Title
  - User Public Key (truncated)
  - Amount (XLM)
  - Commitment Hash (truncated)
  - Status (Sealed/Revealed)
  - Timestamp
- Admin can filter by market, sort by amount/date
- Admin sees aggregate stats: Total Volume, Bet Count, Avg Bet Size

**Example 4: Admin Bet Visibility (Current Bug)**
- Admin navigates to `/admin`
- Page shows only market resolution interface and IntelligenceDashboard
- No bet data visible anywhere
- Admin cannot determine which markets have betting activity
- Admin cannot identify large bets or suspicious patterns
- Admin must manually query database to see bet data

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- ZK proof generation using snarkjs and seal_bet circuit must continue to work with the same cryptographic parameters
- Freighter wallet integration for transaction signing must remain unchanged
- Market creation, resolution, and display functionality must continue to work
- IntelligenceDashboard display of quality scores and risk metrics must remain unchanged
- localStorage structure for reveal flow (`zk_portfolio` array) must maintain backward compatibility
- Existing API routes (/api/markets, /api/users, /api/transactions) must continue to function
- Dashboard layout, navigation, and wallet connection must remain unchanged
- Admin market resolution flow must continue to work exactly as before

**Scope:**
All inputs that do NOT involve bet placement through BetModal or admin bet viewing should be completely unaffected by this fix. This includes:
- Market browsing and display in dashboard, markets page, portfolio page
- Market creation via CreateMarketModal
- Market resolution via admin panel
- User profile viewing and reputation display
- Leaderboard functionality
- Transaction history viewing
- Wallet connection and balance display

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

### Issue 1: Dashboard Bet Placement

1. **Inadequate Error Handling**: The `handleBet` function in BetModal.tsx has a single try-catch block that catches all errors and displays a generic alert. This prevents users from understanding which step failed (ZK proof generation, Freighter signing, Soroban submission, or database indexing) and how to recover.

2. **UI State Management**: The `isGenerating` state is set to false in the finally block, but if an error occurs, the modal remains open with no clear recovery path. The success state transition (showing success message → closing modal after 2s) may not execute if earlier steps fail.

3. **Missing Validation**: The BetModal does not validate that the market is still OPEN before attempting to place a bet, potentially allowing bets on closed/resolved markets.

4. **Race Conditions**: The modal closes automatically after 2 seconds on success, but if the user clicks outside or presses ESC during this window, the state may become inconsistent.

5. **Database Sync Failures**: The POST /api/bets call may fail silently if the market or user doesn't exist in the database, but the on-chain transaction has already succeeded, creating a state mismatch.

### Issue 2: Admin Panel Bet Management

1. **Missing UI Component**: There is no BetManagementTable or equivalent component in the admin panel to display bet data.

2. **Missing API Endpoint**: The existing GET /api/bets endpoint only handles POST requests for creating bets. There is no GET handler to fetch bets with filtering/pagination.

3. **Missing Database Queries**: No Prisma queries exist to fetch bets with market/user relations, aggregate statistics, or filtering by status/date.

4. **Incomplete Admin Page**: The admin page (app/(dashboard)/admin/page.tsx) only fetches and displays markets, with no logic to fetch or display bets.

## Correctness Properties

Property 1: Bug Condition - Bet Placement Completes Successfully

_For any_ bet placement attempt where the user has a connected wallet, the market is OPEN, and the user enters a valid amount, the fixed BetModal SHALL complete the full flow (ZK proof generation → Freighter signing → Soroban submission → database indexing → localStorage save) and display appropriate success or error messages at each step, allowing the user to retry on failure.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

Property 2: Bug Condition - Admin Bet Visibility

_For any_ admin accessing the `/admin` page, the fixed admin panel SHALL display a bet management interface showing all bets across all markets with filtering, sorting, and aggregate statistics, enabling admins to monitor betting activity and detect suspicious patterns.

**Validates: Requirements 3.5, 3.6, 3.7, 3.8**

Property 3: Preservation - Existing Functionality Unchanged

_For any_ user interaction that does NOT involve placing bets through BetModal or viewing bets in the admin panel, the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for market creation, resolution, browsing, wallet connection, and other features.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

#### File 1: `components/BetModal.tsx`

**Function**: `handleBet`

**Specific Changes**:

1. **Add Step-by-Step Error Handling**: Replace the single try-catch with granular error handling for each step:
   - Wrap ZK proof generation in try-catch with specific error message
   - Wrap Freighter signing in try-catch with user-friendly rejection message
   - Wrap Soroban submission in try-catch with network error handling
   - Wrap database indexing in try-catch with fallback retry logic
   - Wrap localStorage save in try-catch with warning (non-critical)

2. **Add Market Validation**: Before starting the bet flow, fetch market status from `/api/markets/${marketId}` and verify status === "OPEN". Display error if market is closed/resolved.

3. **Improve UI State Management**: 
   - Add separate loading states: `isGeneratingProof`, `isSigning`, `isSubmitting`, `isIndexing`
   - Display current step to user: "Generating ZK Proof...", "Awaiting Signature...", "Submitting to Blockchain...", "Finalizing..."
   - Add retry button that appears on error instead of requiring modal close/reopen

4. **Add Transaction Confirmation**: After Soroban submission, display transaction hash with link to Stellar explorer before closing modal

5. **Emit Event on Success**: Dispatch custom event `betPlaced` with market ID to trigger dashboard refresh

#### File 2: `app/(dashboard)/dashboard/page.tsx`

**Function**: Component root

**Specific Changes**:

1. **Add Event Listener**: Listen for `betPlaced` custom event and refetch markets when triggered

2. **Pass Market Status to Modal**: Pass full market object to BetModal instead of just ID/title, allowing modal to validate market status

#### File 3: `app/api/bets/route.ts`

**Function**: `POST` handler

**Specific Changes**:

1. **Add Validation**: Verify market exists and is OPEN before creating bet record

2. **Add Error Response Details**: Return specific error messages (e.g., "", "Market is closed") instead of generic "DB error"

3. **Add GET Handler**: Implement GET /api/bets with query parameters:
   - `marketId` (optional): Filter bets by market
   - `userPublicKey` (optional): Filter bets by user
   - `status` (optional): Filter by revealed/sealed status
   - `limit` (optional): Pagination limit (default 50)
   - `offset` (optional): Pagination offset (default 0)
   - `sortBy` (optional): Sort field (amount, createdAt)
   - `sortOrder` (optional): asc/desc

4. **Add Aggregate Endpoint**: Implement GET /api/bets/stats with query parameters:
   - `marketId` (optional): Stats for specific market
   - Returns: { totalVolume, betCount, avgBetSize, sealedCount, revealedCount }

#### File 4: `app/(dashboard)/admin/page.tsx`

**Function**: Component root

**Specific Changes**:

1. **Add Bet Fetching**: Add state for `bets`, `betStats`, `selectedMarketFilter`, `sortBy`, `sortOrder`

2. **Add useEffect Hook**: Fetch bets and stats on component mount and when filters change

3. **Add Bet Management Section**: Below the market resolution section, add:
   - Section header: "Bet Management"
   - Filter dropdown: Select market (All Markets, or specific market titles)
   - Sort controls: Sort by Amount/Date, Ascending/Descending
   - Stats cards: Total Volume, Bet Count, Avg Bet Size
   - Bet table with columns: Market, User, Amount, Commitment, Status, Timestamp

4. **Add Bet Table Component**: Create inline table component with:
   - Responsive grid layout
   - Truncated public keys (show first 8 chars + "...")
   - Truncated commitment hashes (show first 12 chars + "...")
   - Color-coded status badges (blue for Sealed, green for Revealed)
   - Timestamp formatted as relative time (e.g., "2 hours ago")

#### File 5: `components/BetManagementTable.tsx` (New File)

**Function**: Reusable bet table component

**Specific Changes**:

1. **Create Component**: Extract bet table logic from admin page into reusable component

2. **Props Interface**: Accept `bets`, `loading`, `onSort`, `onFilter` props

3. **Responsive Design**: Use Tailwind grid with mobile-friendly stacking

4. **Interactive Features**: 
   - Click commitment hash to copy to clipboard
   - Click user public key to view user profile (future enhancement)
   - Hover to show full commitment/public key in tooltip

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate bet placement flows and admin panel interactions. Run these tests on the UNFIXED code to observe failures and understand the root causes.

**Test Cases**:

1. **Bet Placement - Freighter Rejection Test**: Simulate user clicking bet button, generating proof, then rejecting Freighter signature prompt (will fail on unfixed code - modal stuck in loading state)

2. **Bet Placement - Network Failure Test**: Simulate Soroban RPC being unavailable during submission (will fail on unfixed code - generic error with no retry option)

3. **Bet Placement - Database Sync Failure Test**: Simulate POST /api/bets returning 500 error after successful on-chain transaction (will fail on unfixed code - state mismatch between chain and DB)

4. **Admin Bet Visibility Test**: Navigate to /admin and search for bet management interface (will fail on unfixed code - interface does not exist)

5. **Admin Bet Filtering Test**: Attempt to filter bets by market via GET /api/bets?marketId=X (will fail on unfixed code - endpoint returns 405 Method Not Allowed)

**Expected Counterexamples**:
- BetModal remains in loading state after Freighter rejection
- Generic error alerts with no actionable information
- No bet management interface in admin panel
- GET /api/bets returns 405 error

Possible causes: inadequate error handling, missing UI components, missing API endpoints, incomplete state management

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL betAttempt WHERE isBugCondition(betAttempt) DO
  result := handleBet_fixed(betAttempt)
  ASSERT result.success === true OR result.errorMessage !== "generic error"
  ASSERT result.uiState === "ready_for_retry" OR result.uiState === "success"
  ASSERT result.modalState === "closed" OR result.modalState === "open_with_retry"
END FOR

FOR ALL adminView WHERE isBugCondition(adminView) DO
  result := AdminPage_fixed(adminView)
  ASSERT result.betManagementVisible === true
  ASSERT result.bets.length > 0 OR result.emptyStateShown === true
  ASSERT result.filteringWorks === true
  ASSERT result.statsDisplayed === true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL userAction WHERE NOT isBugCondition(userAction) DO
  ASSERT originalBehavior(userAction) === fixedBehavior(userAction)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-bet-placement interactions, then write property-based tests capturing that behavior.

**Test Cases**:

1. **Market Creation Preservation**: Verify CreateMarketModal continues to work identically after fix

2. **Market Resolution Preservation**: Verify admin market resolution flow produces same results after fix

3. **Dashboard Display Preservation**: Verify market cards, stats, and layout render identically after fix

4. **Wallet Connection Preservation**: Verify WalletProvider and Freighter integration work identically after fix

5. **ZK Proof Generation Preservation**: Verify seal_bet circuit and snarkjs integration produce same commitments after fix

6. **LocalStorage Structure Preservation**: Verify zk_portfolio array structure remains backward compatible after fix

### Unit Tests

- Test BetModal error handling for each failure scenario (ZK proof, Freighter, Soroban, DB)
- Test BetModal market validation (OPEN vs CLOSED/RESOLVED)
- Test BetModal UI state transitions (loading → success, loading → error → retry)
- Test GET /api/bets with various filter combinations
- Test GET /api/bets/stats aggregation logic
- Test BetManagementTable rendering with empty/populated data
- Test BetManagementTable sorting and filtering

### Property-Based Tests

- Generate random bet amounts and verify BetModal handles all valid inputs (1-1000000 XLM)
- Generate random market states and verify BetModal only allows bets on OPEN markets
- Generate random bet datasets and verify GET /api/bets filtering/sorting produces correct results
- Generate random error scenarios and verify BetModal always provides actionable error messages
- Test that all non-bet-placement user flows produce identical results before/after fix

### Integration Tests

- Test full bet placement flow: dashboard → modal → ZK proof → Freighter → Soroban → DB → localStorage → UI refresh
- Test bet placement failure recovery: error at each step → retry → success
- Test admin bet management flow: navigate to /admin → view bets → filter by market → sort by amount → view stats
- Test bet placement → admin visibility: place bet in dashboard → navigate to admin → verify bet appears in table
- Test concurrent bet placement: multiple users betting on same market → verify all bets indexed correctly
- Test bet placement on closed market: attempt bet after market closes → verify error message displayed
