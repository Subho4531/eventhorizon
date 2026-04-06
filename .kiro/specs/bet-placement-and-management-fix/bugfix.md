# Bugfix Requirements Document

## Introduction

The Gravity prediction market platform has two critical issues preventing users from successfully placing bets and admins from monitoring betting activity:

1. **Dashboard Bet Placement Flow**: The dashboard at `/dashboard` displays markets with YES/NO buttons that open a BetModal component. While the modal contains complete ZK proof generation logic, the betting flow is incomplete or broken, preventing users from successfully placing bets.

2. **Admin Panel Bet Visibility**: The admin panel at `/admin` provides market resolution functionality and displays the IntelligenceDashboard, but lacks any interface for admins to view, manage, or monitor bets that have been placed across markets.

These issues prevent the core betting functionality from working and limit administrative oversight of platform activity.

## Bug Analysis

### Current Behavior (Defect)

#### Issue 1: Dashboard Bet Placement

1.1 WHEN a user clicks YES or NO buttons on a market card in the dashboard THEN the BetModal opens but the betting flow does not complete successfully

1.2 WHEN a user attempts to place a bet through the BetModal THEN the transaction may fail or not properly update the system state

1.3 WHEN a user completes the bet placement process THEN the UI does not refresh to show the updated market state or user position

#### Issue 2: Admin Panel Bet Management

2.1 WHEN an admin accesses the admin panel at `/admin` THEN there is no interface to view bets that have been placed

2.2 WHEN bets are placed on markets THEN admins have no visibility into betting activity, volumes, or user positions

2.3 WHEN an admin needs to monitor market health or detect suspicious activity THEN there is no bet management dashboard available

### Expected Behavior (Correct)

#### Issue 1: Dashboard Bet Placement

3.1 WHEN a user clicks YES or NO buttons on a market card THEN the BetModal SHALL open with the correct market context and selected side pre-populated

3.2 WHEN a user enters a bet amount and clicks "Generate Proof & Lock Position" THEN the system SHALL successfully generate the ZK proof, sign the transaction via Freighter, submit to Soroban, and index the bet in the database

3.3 WHEN a bet is successfully placed THEN the system SHALL display a success message, update the market state, refresh the UI to show updated pools, and close the modal

3.4 WHEN a bet placement fails at any step THEN the system SHALL display a clear error message indicating which step failed and why

#### Issue 2: Admin Panel Bet Management

3.5 WHEN an admin accesses the admin panel THEN the system SHALL display a bet management section showing all bets across all markets

3.6 WHEN viewing the bet management interface THEN admins SHALL see bet details including market, user public key, amount, commitment hash, timestamp, and status (sealed/revealed)

3.7 WHEN admins need to analyze betting activity THEN the system SHALL provide filtering and sorting capabilities by market, user, date, and amount

3.8 WHEN admins view bet statistics THEN the system SHALL display aggregate metrics including total bet volume, number of bets per market, and betting trends

### Unchanged Behavior (Regression Prevention)

4.1 WHEN users interact with other dashboard features (market creation, navigation, wallet connection) THEN the system SHALL CONTINUE TO function as currently implemented

4.2 WHEN admins use existing market resolution functionality THEN the system SHALL CONTINUE TO resolve markets and update outcomes correctly

4.3 WHEN the IntelligenceDashboard displays market quality and risk scores THEN the system SHALL CONTINUE TO show these metrics without interference from bet management features

4.4 WHEN users view markets in the Markets page or Portfolio page THEN the system SHALL CONTINUE TO display market information correctly

4.5 WHEN the BetModal generates ZK proofs using the seal_bet circuit THEN the system SHALL CONTINUE TO use the same cryptographic parameters and commitment scheme

4.6 WHEN bets are stored in localStorage for the reveal flow THEN the system SHALL CONTINUE TO maintain the same data structure for backward compatibility
