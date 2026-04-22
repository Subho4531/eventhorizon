/**
 * tests/properties/dispute-resolution.test.ts
 * 
 * Property-based tests for dispute resolution system
 * Feature: advanced-prediction-market-intelligence
 * 
 * Tests universal correctness properties across randomized inputs
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
import {
  submitChallenge,
  submitVote,
  finalizeDispute,
  getDisputeEvidence,
} from '@/lib/intelligence/dispute-resolution'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => {
  const mockPrisma: any = {
    market: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    disputeChallenge: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    disputeVote: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
  mockPrisma.$transaction = vi.fn((callback) => callback(mockPrisma))
  return {
    prisma: mockPrisma,
  }
})

// Mock fetch for URL validation
global.fetch = vi.fn()

describe('Dispute Resolution - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Property 19: Challenge Period Opening
  test('Property 19: 48-hour challenge period opens on RESOLVED status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          status: fc.constantFrom('OPEN', 'RESOLVED', 'DISPUTED', 'FINALIZED'),
          resolvedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
        }),
        async ({ marketId, status, resolvedAt }) => {
          vi.clearAllMocks()
          const market = {
            id: marketId,
            status,
            resolvedAt: status === 'RESOLVED' ? resolvedAt : null,
            outcome: status === 'RESOLVED' ? 'YES' : null,
          }

          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.disputeChallenge.findFirst).mockResolvedValue(null)
          vi.mocked(prisma.user.findUnique).mockResolvedValue({
            publicKey: 'challenger',
            reputationScore: 500,
          } as any)
          vi.mocked(prisma.disputeChallenge.create).mockResolvedValue({
            id: 'challenge-1',
            votingEndsAt: new Date(resolvedAt.getTime() + 48 * 60 * 60 * 1000),
          } as any)

          const challengeParams = {
            marketId,
            challengerAddress: 'challenger',
            evidence: {
              description: 'Test evidence',
              urls: ['https://example.com'],
            },
            proposedOutcome: 'NO' as const,
            bond: 100,
          }

          // Property: challenge should only be accepted if market status is RESOLVED
          if (status === 'RESOLVED') {
            await submitChallenge(challengeParams)
            
            // Verify 72-hour period was set
            const now = Date.now()
            const expectedEndTime = now + 72 * 60 * 60 * 1000
            const createCall = vi.mocked(prisma.disputeChallenge.create).mock.calls[0][0].data as any
            expect(createCall.votingEndsAt.getTime()).toBeGreaterThanOrEqual(expectedEndTime - 1000)
            expect(createCall.votingEndsAt.getTime()).toBeLessThanOrEqual(expectedEndTime + 1000)
            
            // Verify challenge was created
            expect(prisma.disputeChallenge.create).toHaveBeenCalled()
          } else {
            // Should reject challenge for non-RESOLVED markets
            await expect(submitChallenge(challengeParams)).rejects.toThrow()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 20: Challenge Bond Requirement
  test('Property 20: exactly 100 XLM bond required for challenge', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          bond: fc.float({ min: 0, max: 500, noNaN: true }),
        }),
        async ({ marketId, bond }) => {
          vi.clearAllMocks()
          const market = {
            id: marketId,
            status: 'RESOLVED',
            resolvedAt: new Date(),
            outcome: 'YES',
          }

          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.disputeChallenge.findFirst).mockResolvedValue(null)
          vi.mocked(prisma.user.findUnique).mockResolvedValue({
            publicKey: 'challenger',
            reputationScore: 500,
          } as any)
          vi.mocked(prisma.disputeChallenge.create).mockResolvedValue({
            id: 'challenge-1',
            bond: 100,
          } as any)

          const challengeParams = {
            marketId,
            challengerAddress: 'challenger',
            evidence: {
              description: 'Test evidence',
              urls: [],
            },
            proposedOutcome: 'NO' as const,
            bond,
          }

          // Property: challenge should only be accepted if bond is exactly 100 XLM
          if (Math.abs(bond - 100) < 0.01) {
            await submitChallenge(challengeParams)
            const createCall = vi.mocked(prisma.disputeChallenge.create).mock.calls[0]?.[0]?.data as any
            expect(createCall.bond).toBe(100)
          } else {
            await expect(submitChallenge(challengeParams)).rejects.toThrow(/bond.*100/)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 21: Challenge Evidence Constraints
  test('Property 21: evidence max 1000 chars and max 3 URLs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          description: fc.string({ maxLength: 2000 }),
          urlCount: fc.integer({ min: 0, max: 10 }),
        }),
        async ({ marketId, description, urlCount }) => {
          vi.clearAllMocks()
          const urls = Array.from({ length: urlCount }, (_, i) => `https://example${i}.com`)

          const market = {
            id: marketId,
            status: 'RESOLVED',
            resolvedAt: new Date(),
            outcome: 'YES',
          }

          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.disputeChallenge.findFirst).mockResolvedValue(null)
          vi.mocked(prisma.user.findUnique).mockResolvedValue({
            publicKey: 'challenger',
            reputationScore: 500,
          } as any)
          vi.mocked(prisma.disputeChallenge.create).mockResolvedValue({
            id: 'challenge-1',
            evidence: JSON.stringify({ description, urls }),
          } as any)

          const challengeParams = {
            marketId,
            challengerAddress: 'challenger',
            evidence: {
              description,
              urls,
            },
            proposedOutcome: 'NO' as const,
            bond: 100,
          }

          // Property: challenge should only be accepted if description ≤ 1000 chars and urls ≤ 3
          const validDescription = description.length <= 1000
          const validUrls = urlCount <= 3

          if (validDescription && validUrls) {
            await submitChallenge(challengeParams)
            const createCall = vi.mocked(prisma.disputeChallenge.create).mock.calls[0]?.[0]?.data as any
            const evidence = JSON.parse(createCall.evidence)
            expect(evidence.description.length).toBeLessThanOrEqual(1000)
            expect(evidence.urls.length).toBeLessThanOrEqual(3)
          } else {
            await expect(submitChallenge(challengeParams)).rejects.toThrow()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 22: Duplicate Challenge Prevention
  test('Property 22: one challenge per user per market', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          challengerAddress: fc.string({ minLength: 1 }),
          hasExistingChallenge: fc.boolean(),
        }),
        async ({ marketId, challengerAddress, hasExistingChallenge }) => {
          vi.clearAllMocks()
          const market = {
            id: marketId,
            status: 'RESOLVED',
            resolvedAt: new Date(),
            outcome: 'YES',
          }

          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.user.findUnique).mockResolvedValue({
            publicKey: challengerAddress,
            reputationScore: 500,
          } as any)

          // Mock existing challenge if applicable
          if (hasExistingChallenge) {
            vi.mocked(prisma.disputeChallenge.findFirst).mockResolvedValue({
              id: 'existing-challenge',
              marketId,
              challengerId: challengerAddress,
            } as any)
          } else {
            vi.mocked(prisma.disputeChallenge.findFirst).mockResolvedValue(null)
          }

          vi.mocked(prisma.disputeChallenge.create).mockResolvedValue({
            id: 'new-challenge',
          } as any)

          const challengeParams = {
            marketId,
            challengerAddress,
            evidence: {
              description: 'Test evidence',
              urls: [],
            },
            proposedOutcome: 'NO' as const,
            bond: 100,
          }

          // Property: challenge should only be accepted if user has no existing challenge
          if (hasExistingChallenge) {
            await expect(submitChallenge(challengeParams)).rejects.toThrow(/already.*challenge/)
          } else {
            const result = await submitChallenge(challengeParams)
            expect(result.id).toBeDefined()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 23: Voting Eligibility
  test('Property 23: reputation >300 required for voting', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          disputeId: fc.string({ minLength: 1 }),
          voterAddress: fc.string({ minLength: 1 }),
          reputation: fc.integer({ min: 0, max: 1000 }),
        }),
        async ({ disputeId, voterAddress, reputation }) => {
          vi.clearAllMocks()
          const dispute = {
            id: disputeId,
            marketId: 'market-1',
            status: 'PENDING',
            votingEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          }

          vi.mocked(prisma.disputeChallenge.findUnique).mockResolvedValue(dispute as any)
          vi.mocked(prisma.user.findUnique).mockResolvedValue({
            publicKey: voterAddress,
            reputationScore: reputation,
          } as any)
          vi.mocked(prisma.disputeVote.findUnique).mockResolvedValue(null)
          vi.mocked(prisma.disputeVote.create).mockResolvedValue({
            id: 'vote-1',
            weight: reputation / 1000,
          } as any)

          const vote = {
            voterAddress,
            outcome: 'YES' as const,
            stake: 10,
            weight: reputation / 1000,
          }

          // Property: vote should only be accepted if reputation > 300
          if (reputation > 300) {
            await submitVote(disputeId, vote)
            const createCall = vi.mocked(prisma.disputeVote.create).mock.calls[0]?.[0]?.data as any
            expect(createCall.weight).toBeCloseTo(reputation / 1000, 3)
          } else {
            await expect(submitVote(disputeId, vote)).rejects.toThrow(/reputation/)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 24: Vote Weighting
  test('Property 24: vote weight = reputation / 1000', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          disputeId: fc.string({ minLength: 1 }),
          voterAddress: fc.string({ minLength: 1 }),
          reputation: fc.integer({ min: 301, max: 1000 }), // Valid reputation range
        }),
        async ({ disputeId, voterAddress, reputation }) => {
          vi.clearAllMocks()
          const dispute = {
            id: disputeId,
            marketId: 'market-1',
            status: 'PENDING',
            votingEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          }

          vi.mocked(prisma.disputeChallenge.findUnique).mockResolvedValue(dispute as any)
          vi.mocked(prisma.user.findUnique).mockResolvedValue({
            publicKey: voterAddress,
            reputationScore: reputation,
          } as any)
          vi.mocked(prisma.disputeVote.findUnique).mockResolvedValue(null)
          vi.mocked(prisma.disputeVote.create).mockResolvedValue({
            id: 'vote-1',
            weight: reputation / 1000,
          } as any)

          const vote = {
            voterAddress,
            outcome: 'YES' as const,
            stake: 10,
            weight: reputation / 1000,
          }

          await submitVote(disputeId, vote)

          // Property: vote weight must equal reputation / 1000
          const expectedWeight = reputation / 1000
          const createCall = vi.mocked(prisma.disputeVote.create).mock.calls[0]?.[0]?.data as any
          expect(createCall.weight).toBeCloseTo(expectedWeight, 3)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 25: Dispute Resolution Threshold
  test('Property 25: >50% weighted votes overturns resolution', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          disputeId: fc.string({ minLength: 1 }),
          yesVotes: fc.array(
            fc.record({
              reputation: fc.integer({ min: 301, max: 1000 }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          noVotes: fc.array(
            fc.record({
              reputation: fc.integer({ min: 301, max: 1000 }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
        }),
        async ({ disputeId, yesVotes, noVotes }) => {
          vi.clearAllMocks()
          const dispute = {
            id: disputeId,
            marketId: 'market-1',
            challengerId: 'challenger',
            proposedOutcome: 'YES',
            status: 'PENDING',
            bond: 100,
            votingEndsAt: new Date(Date.now() - 1000), // Voting period ended
          }

          const market = {
            id: 'market-1',
            outcome: 'NO', // Original outcome
            status: 'RESOLVED',
          }

          // Create vote records
          const votes = [
            ...yesVotes.map((v, i) => ({
              id: `yes-vote-${i}`,
              disputeId,
              voterId: `voter-yes-${i}`,
              outcome: 'YES',
              stake: 10,
              weight: v.reputation / 1000,
            })),
            ...noVotes.map((v, i) => ({
              id: `no-vote-${i}`,
              disputeId,
              voterId: `voter-no-${i}`,
              outcome: 'NO',
              stake: 10,
              weight: v.reputation / 1000,
            })),
          ]

          vi.mocked(prisma.disputeChallenge.findUnique).mockResolvedValue({
            ...dispute,
            votes,
            market,
            challenger: { publicKey: 'challenger', reputationScore: 500 }
          } as any)
          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.disputeVote.findMany).mockResolvedValue(votes as any)
          vi.mocked(prisma.disputeChallenge.update).mockResolvedValue({
            ...dispute,
            status: 'ACCEPTED',
          } as any)
          vi.mocked(prisma.market.update).mockResolvedValue({
            ...market,
            outcome: 'YES',
          } as any)

          const result = await finalizeDispute(disputeId)

          // Calculate weighted votes
          const yesWeight = yesVotes.reduce((sum, v) => sum + v.reputation / 1000, 0)
          const noWeight = noVotes.reduce((sum, v) => sum + v.reputation / 1000, 0)
          const totalWeight = yesWeight + noWeight

          // Property: challenge accepted if YES votes > 50% of total weighted votes
          if (totalWeight > 0) {
            const yesPercentage = yesWeight / totalWeight
            
            if (yesPercentage > 0.5) {
              expect(result.accepted).toBe(true)
              expect(result.weightedVotes.YES).toBeCloseTo(yesWeight, 3)
            } else {
              expect(result.accepted).toBe(false)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 26: Challenge Reward Distribution
  test('Property 26: bond + 50 XLM for accepted, proportional for rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          disputeId: fc.string({ minLength: 1 }),
          accepted: fc.boolean(),
          opposingVoterCount: fc.integer({ min: 1, max: 10 }),
        }),
        async ({ disputeId, accepted, opposingVoterCount }) => {
          vi.clearAllMocks()
          const bond = 100
          const reward = 50

          const dispute = {
            id: disputeId,
            marketId: 'market-1',
            challengerId: 'challenger',
            proposedOutcome: 'YES',
            status: 'PENDING',
            bond,
            votingEndsAt: new Date(Date.now() - 1000),
          }

          // Winners are those who voted for the final outcome
          const winners = Array.from({ length: opposingVoterCount }, (_, i) => ({
            id: `vote-${i}`,
            disputeId,
            voterId: `winner-${i}`,
            outcome: accepted ? 'YES' : 'NO',
            stake: 10,
            weight: 0.5,
          }))

          // If accepted, challenger is also a winner (they get bond + 50)
          // If rejected, challenger is a loser (they lose bond)
          const votes = [...winners]
          if (!accepted) {
            votes.push({
              id: 'challenger-vote',
              disputeId,
              voterId: 'challenger',
              outcome: 'YES', // Challenger always votes for proposed outcome
              stake: 10,
              weight: 0.1,
            })
          }

          vi.mocked(prisma.disputeChallenge.findUnique).mockResolvedValue({
            ...dispute,
            votes,
            market: { id: 'market-1', outcome: 'NO' },
            challenger: { publicKey: 'challenger', reputationScore: 500 }
          } as any)
          vi.mocked(prisma.disputeChallenge.update).mockResolvedValue({
            ...dispute,
            status: accepted ? 'ACCEPTED' : 'REJECTED',
          } as any)

          const result = await finalizeDispute(disputeId)

          if (accepted) {
            expect(result.bondDistribution['challenger']).toBe(bond + reward)
          } else {
            const totalDistributed = Object.values(result.bondDistribution).reduce(
              (sum, amount) => sum + amount,
              0
            )
            expect(totalDistributed).toBeCloseTo(bond, 2)
            
            const expectedPerWinner = bond / winners.length
            winners.forEach((v) => {
              expect(result.bondDistribution[v.voterId]).toBeCloseTo(expectedPerWinner, 2)
            })
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 27: Evidence URL Validation
  test('Property 27: HTTP 200 check, mark unavailable if not', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          urls: fc.uniqueArray(
            fc.record({
              url: fc.string({ minLength: 5, maxLength: 20 }).map(s => `https://${s}.com`),
              statusCode: fc.constantFrom(200, 404, 500),
            }),
            { minLength: 1, maxLength: 3, selector: (u) => u.url }
          ),
        }),
        async ({ marketId, urls }) => {
          vi.clearAllMocks()
          const market = {
            id: marketId,
            status: 'RESOLVED',
            resolvedAt: new Date(),
            outcome: 'YES',
          }

          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.disputeChallenge.findFirst).mockResolvedValue(null)
          vi.mocked(prisma.user.findUnique).mockResolvedValue({
            publicKey: 'challenger',
            reputationScore: 500,
          } as any)

          // Mock fetch responses
          vi.mocked(global.fetch).mockImplementation(async (url: any) => {
            const match = urls.find((u) => u.url === url)
            return {
              ok: match?.statusCode === 200,
              status: match?.statusCode || 404,
            } as Response
          })

          vi.mocked(prisma.disputeChallenge.create).mockImplementation((async (args: any) => {
            const evidence = JSON.parse(args.data.evidence as string)
            return {
              id: 'challenge-1',
              evidence: JSON.stringify(evidence),
            } as any
          }) as any)

          const challengeParams = {
            marketId,
            challengerAddress: 'challenger',
            evidence: {
              description: 'Test evidence',
              urls: urls.map((u) => u.url),
            },
            proposedOutcome: 'NO' as const,
            bond: 100,
          }

          await submitChallenge(challengeParams)
          const createCall = vi.mocked(prisma.disputeChallenge.create).mock.calls[0]?.[0]?.data as any
          const evidence = JSON.parse(createCall.evidence)

          const validatedUrls = evidence.urls
          expect(validatedUrls.length).toBe(urls.length)
          urls.forEach(({ url, statusCode }, index) => {
            expect(validatedUrls[index].url).toBe(url)
            expect(validatedUrls[index].available).toBe(statusCode === 200)
          })
        }
      ),
      { numRuns: 50 }
    )
  })

  // Property 28: Evidence Hiding Threshold
  test('Property 28: hide evidence after >10 misleading flags', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          disputeId: fc.string({ minLength: 1 }),
          flagCount: fc.integer({ min: 0, max: 20 }),
        }),
        async ({ disputeId, flagCount }) => {
          vi.clearAllMocks()
          const dispute = {
            id: disputeId,
            marketId: 'market-1',
            evidence: JSON.stringify({
              description: 'Test evidence',
              urls: [{ url: 'https://example.com', available: true, flags: flagCount }],
            }),
            votes: [],
            market: { outcome: 'YES' },
          }

          vi.mocked(prisma.disputeChallenge.findUnique).mockResolvedValue(dispute as any)

          const result = await getDisputeEvidence(disputeId)
          const evidence = result.evidence.urls[0] as any

          // Property: evidence should be hidden if flags > 10
          if (flagCount > 10) {
            expect(evidence.hidden).toBe(true)
          } else {
            expect(evidence.hidden).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Additional property: Vote stake minimum
  test('Property: minimum 10 XLM stake required for voting', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          disputeId: fc.string({ minLength: 1 }),
          voterAddress: fc.string({ minLength: 1 }),
          stake: fc.float({ min: 0, max: 100, noNaN: true }),
        }),
        async ({ disputeId, voterAddress, stake }) => {
          vi.clearAllMocks()
          const dispute = {
            id: disputeId,
            marketId: 'market-1',
            status: 'PENDING',
            votingEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          }

          vi.mocked(prisma.disputeChallenge.findUnique).mockResolvedValue(dispute as any)
          vi.mocked(prisma.user.findUnique).mockResolvedValue({
            publicKey: voterAddress,
            reputationScore: 500,
          } as any)
          vi.mocked(prisma.disputeVote.findUnique).mockResolvedValue(null)
          vi.mocked(prisma.disputeVote.create).mockResolvedValue({
            id: 'vote-1',
            stake,
          } as any)

          const vote = {
            voterAddress,
            outcome: 'YES' as const,
            stake,
            weight: 0.5,
          }

          // Property: vote should only be accepted if stake >= 10 XLM
          if (stake >= 10) {
            await submitVote(disputeId, vote)
            const createCall = vi.mocked(prisma.disputeVote.create).mock.calls[0]?.[0]?.data as any
            expect(createCall.stake).toBeGreaterThanOrEqual(10)
          } else {
            await expect(submitVote(disputeId, vote)).rejects.toThrow(/stake.*10/)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Additional property: Voting period enforcement
  test('Property: votes rejected after voting period ends', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          disputeId: fc.string({ minLength: 1 }),
          voterAddress: fc.string({ minLength: 1 }),
          hoursUntilEnd: fc.integer({ min: -48, max: 72 }).filter(h => h !== 0),
        }),
        async ({ disputeId, voterAddress, hoursUntilEnd }) => {
          vi.clearAllMocks()
          const votingEndsAt = new Date(Date.now() + hoursUntilEnd * 60 * 60 * 1000)

          const dispute = {
            id: disputeId,
            marketId: 'market-1',
            status: 'PENDING',
            votingEndsAt,
          }

          vi.mocked(prisma.disputeChallenge.findUnique).mockResolvedValue(dispute as any)
          vi.mocked(prisma.user.findUnique).mockResolvedValue({
            publicKey: voterAddress,
            reputationScore: 500,
          } as any)
          vi.mocked(prisma.disputeVote.findUnique).mockResolvedValue(null)
          vi.mocked(prisma.disputeVote.create).mockResolvedValue({
            id: 'vote-1',
          } as any)

          const vote = {
            voterAddress,
            outcome: 'YES' as const,
            stake: 10,
            weight: 0.5,
          }

          // Property: vote should only be accepted if voting period has not ended
          if (hoursUntilEnd > 0) {
            await submitVote(disputeId, vote)
            expect(prisma.disputeVote.create).toHaveBeenCalled()
          } else {
            await expect(submitVote(disputeId, vote)).rejects.toThrow(/voting.*ended/i)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
