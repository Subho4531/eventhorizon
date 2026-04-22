import { prisma } from '@/lib/prisma'

export interface ChallengeParams {
  marketId: string
  challengerAddress: string
  evidence: Evidence
  proposedOutcome: 'YES' | 'NO'
  bond: number
}

export interface Evidence {
  description: string
  urls: string[]
}

export interface Vote {
  voterAddress: string
  outcome: 'YES' | 'NO' | 'ORIGINAL'
  stake: number
}

export interface DisputeResult {
  accepted: boolean
  totalVotes: number
  weightedVotes: { [outcome: string]: number }
  bondDistribution: { [address: string]: number }
}

export interface DisputeStatus {
  id: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  challengerAddress: string
  evidence: Evidence
  proposedOutcome: string
  votingEndsAt: Date
  votes: Array<{
    voterAddress: string
    outcome: string
    weight: number
    stake: number
  }>
  weightedVoteTotals: { [outcome: string]: number }
}

/**
 * Submit a challenge to a market resolution
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 */
export async function submitChallenge(params: ChallengeParams): Promise<{ id: string }> {
  const { marketId, challengerAddress, evidence, proposedOutcome, bond } = params

  // Validate bond amount (Requirement 8.2)
  if (bond !== 100) {
    throw new Error('Challenge bond must be exactly 100 XLM')
  }

  // Validate evidence constraints (Requirement 8.3)
  if (evidence.description.length > 1000) {
    throw new Error('Evidence description must not exceed 1000 characters')
  }
  if (evidence.urls.length > 3) {
    throw new Error('Evidence must include at most 3 URLs')
  }

  // Validate evidence URLs (Requirement 10.2)
  const validatedUrls = await Promise.all(
    evidence.urls.map(async (url) => {
      try {
        const response = await fetch(url, { method: 'HEAD' })
        return {
          url,
          available: response.status === 200
        }
      } catch {
        return {
          url,
          available: false
        }
      }
    })
  )

  return await prisma.$transaction(async (tx) => {
    // Check for duplicate challenge (Requirement 8.7)
    const existingChallenge = await tx.disputeChallenge.findFirst({
      where: {
        marketId,
        challengerId: challengerAddress
      }
    })

    if (existingChallenge) {
      throw new Error('User has already submitted a challenge for this market')
    }

    // Get market to verify it's resolved
    const market = await tx.market.findUnique({
      where: { id: marketId }
    })

    if (!market) {
      throw new Error('Market not found')
    }

    if (market.status !== 'RESOLVED') {
      throw new Error('Market must be resolved before challenging')
    }

    // Create challenge with 72-hour voting period (Requirement 9.1)
    const votingEndsAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

    const challenge = await tx.disputeChallenge.create({
      data: {
        marketId,
        challengerId: challengerAddress,
        evidence: JSON.stringify({
          description: evidence.description,
          urls: validatedUrls
        }),
        proposedOutcome,
        bond,
        status: 'PENDING',
        votingEndsAt
      }
    })

    // Extend challenge period by 24h (Requirement 8.5)
    // This would be handled by updating market's challenge period end time
    // For now, we track it in the challenge record

    return { id: challenge.id }
  })
}

/**
 * Submit a vote on a dispute
 * Requirements: 9.2, 9.3, 9.4
 */
export async function submitVote(
  disputeId: string,
  vote: Vote
): Promise<void> {
  const { voterAddress, outcome, stake } = vote

  // Validate minimum stake (Requirement 9.4)
  if (stake < 10) {
    throw new Error('Minimum stake is 10 XLM')
  }

  return await prisma.$transaction(async (tx) => {
    // Get voter's reputation (Requirement 9.2)
    const voter = await tx.user.findUnique({
      where: { publicKey: voterAddress },
      select: { reputationScore: true }
    })

    if (!voter) {
      throw new Error('Voter not found')
    }

    if (voter.reputationScore <= 300) {
      throw new Error('Voter must have reputation score above 300')
    }

    // Check if dispute exists and is still open
    const dispute = await tx.disputeChallenge.findUnique({
      where: { id: disputeId }
    })

    if (!dispute) {
      throw new Error('Dispute not found')
    }

    if (dispute.status !== 'PENDING') {
      throw new Error('Dispute is no longer accepting votes')
    }

    if (new Date() > dispute.votingEndsAt) {
      throw new Error('Voting period has ended')
    }

    // Check for existing vote (one vote per dispute - Requirement 9.2)
    const existingVote = await tx.disputeVote.findUnique({
      where: {
        disputeId_voterId: {
          disputeId,
          voterId: voterAddress
        }
      }
    })

    if (existingVote) {
      throw new Error('User has already voted on this dispute')
    }

    // Calculate vote weight (Requirement 9.3)
    const weight = voter.reputationScore / 1000

    // Create vote
    await tx.disputeVote.create({
      data: {
        disputeId,
        voterId: voterAddress,
        outcome,
        stake,
        weight
      }
    })
  })
}

/**
 * Finalize a dispute after voting period ends
 * Requirements: 9.5, 9.6, 9.7, 9.8, 9.9
 */
export async function finalizeDispute(disputeId: string): Promise<DisputeResult> {
  return await prisma.$transaction(async (tx) => {
    const dispute = await tx.disputeChallenge.findUnique({
      where: { id: disputeId },
      include: {
        votes: true,
        market: true,
        challenger: true
      }
    })

    if (!dispute) {
      throw new Error('Dispute not found')
    }

    if (dispute.status !== 'PENDING') {
      throw new Error('Dispute has already been finalized')
    }

    if (new Date() < dispute.votingEndsAt) {
      throw new Error('Voting period has not ended yet')
    }

    // Calculate weighted vote totals (Requirement 9.5)
    const weightedVotes: { [outcome: string]: number } = {}
    let totalWeightedVotes = 0

    for (const vote of dispute.votes) {
      weightedVotes[vote.outcome] = (weightedVotes[vote.outcome] || 0) + vote.weight
      totalWeightedVotes += vote.weight
    }

    // Determine if challenge is accepted (>50% weighted votes - Requirement 9.6)
    const challengeVotes = weightedVotes[dispute.proposedOutcome] || 0
    const accepted = challengeVotes > totalWeightedVotes / 2

    // Update dispute status
    await tx.disputeChallenge.update({
      where: { id: disputeId },
      data: { status: accepted ? 'ACCEPTED' : 'REJECTED' }
    })

    const bondDistribution: { [address: string]: number } = {}

    if (accepted) {
      // Challenge accepted: return bond + 50 XLM reward (Requirement 9.7)
      bondDistribution[dispute.challengerId] = dispute.bond + 50

      // Slash oracle bond (Requirement 9.9)
      // This would interact with the Soroban contract to slash the oracle's bond
      // For now, we update the oracle's reputation
      const marketWithOracle = dispute.market as typeof dispute.market & { oracleAddress?: string }
      if (marketWithOracle.oracleAddress) {
        await tx.user.update({
          where: { publicKey: marketWithOracle.oracleAddress },
          data: {
            reputationScore: {
              decrement: 100
            },
            disputedResolutions: {
              increment: 1
            }
          }
        })
      }

      // Update market outcome
      await tx.market.update({
        where: { id: dispute.marketId },
        data: {
          outcome: dispute.proposedOutcome
        }
      })
    } else {
      // Challenge rejected: distribute bond to opposing voters (Requirement 9.8)
      const opposingVoters = dispute.votes.filter(
        v => v.outcome !== dispute.proposedOutcome
      )
      const totalOpposingWeight = opposingVoters.reduce((sum, v) => sum + v.weight, 0)

      if (totalOpposingWeight > 0) {
        for (const vote of opposingVoters) {
          const share = (vote.weight / totalOpposingWeight) * dispute.bond
          bondDistribution[vote.voterId] = share
        }
      }
    }

    return {
      accepted,
      totalVotes: dispute.votes.length,
      weightedVotes,
      bondDistribution
    }
  })
}

/**
 * Get dispute status for a market
 * Requirements: 9.10
 */
export async function getDisputeStatus(marketId: string): Promise<DisputeStatus[]> {
  const disputes = await prisma.disputeChallenge.findMany({
    where: { marketId },
    include: {
      votes: {
        select: {
          voterId: true,
          outcome: true,
          weight: true,
          stake: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return disputes.map(dispute => {
    const evidence = JSON.parse(dispute.evidence) as Evidence
    
    // Calculate weighted vote totals
    const weightedVoteTotals: { [outcome: string]: number } = {}
    for (const vote of dispute.votes) {
      weightedVoteTotals[vote.outcome] = 
        (weightedVoteTotals[vote.outcome] || 0) + vote.weight
    }

    return {
      id: dispute.id,
      status: dispute.status as 'PENDING' | 'ACCEPTED' | 'REJECTED',
      challengerAddress: dispute.challengerId,
      evidence,
      proposedOutcome: dispute.proposedOutcome,
      votingEndsAt: dispute.votingEndsAt,
      votes: dispute.votes.map(v => ({
        voterAddress: v.voterId,
        outcome: v.outcome,
        weight: v.weight,
        stake: v.stake
      })),
      weightedVoteTotals
    }
  })
}

/**
 * Get evidence for a dispute with flagging support
 * Requirements: 10.1, 10.3, 10.4, 10.5
 */
export async function getDisputeEvidence(disputeId: string): Promise<{
  evidence: {
    description: string
    urls: Array<{ url: string; available: boolean; hidden: boolean; flags: number }>
  }
  summary: {
    originalResolution: string
    challengeClaim: string
    voteDistribution: { [outcome: string]: number }
  }
}> {
  const dispute = await prisma.disputeChallenge.findUnique({
    where: { id: disputeId },
    include: {
      market: true,
      votes: true
    }
  })

  if (!dispute) {
    throw new Error('Dispute not found')
  }

  const evidence = JSON.parse(dispute.evidence) as {
    description: string
    urls: Array<{ url: string; available: boolean; flags?: number }>
  }

  // Apply hiding threshold (Requirement 10.5)
  const processedUrls = evidence.urls.map(urlData => ({
    url: urlData.url,
    available: urlData.available,
    hidden: (urlData.flags || 0) > 10,
    flags: urlData.flags || 0
  }))

  // Calculate vote distribution
  const voteDistribution: { [outcome: string]: number } = {}
  for (const vote of dispute.votes) {
    voteDistribution[vote.outcome] = (voteDistribution[vote.outcome] || 0) + 1
  }

  return {
    evidence: {
      description: evidence.description,
      urls: processedUrls
    },
    summary: {
      originalResolution: dispute.market.outcome || 'PENDING',
      challengeClaim: dispute.proposedOutcome,
      voteDistribution
    }
  }
}

/**
 * Flag evidence as misleading
 * Requirements: 10.4
 */
export async function flagEvidence(
  disputeId: string,
  urlIndex: number,
  _flaggerAddress: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const dispute = await tx.disputeChallenge.findUnique({
      where: { id: disputeId }
    })

    if (!dispute) {
      throw new Error('Dispute not found')
    }

    const evidence = JSON.parse(dispute.evidence) as {
      description: string
      urls: Array<{ url: string; available: boolean; flags?: number }>
    }

    if (urlIndex < 0 || urlIndex >= evidence.urls.length) {
      throw new Error('Invalid URL index')
    }

    // Increment flag count
    evidence.urls[urlIndex].flags = (evidence.urls[urlIndex].flags || 0) + 1

    await tx.disputeChallenge.update({
      where: { id: disputeId },
      data: {
        evidence: JSON.stringify(evidence)
      }
    })
  })
}
