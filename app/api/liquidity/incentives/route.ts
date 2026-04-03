import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      )
    }

    // Get current week start
    const now = new Date()
    const weekStart = getWeekStart(now)

    // Get user's current week rewards
    const currentWeekReward = await prisma.liquidityReward.findFirst({
      where: {
        userId,
        weekStart,
        claimed: false
      }
    })

    // Get user's claimed rewards history
    const claimedRewards = await prisma.liquidityReward.findMany({
      where: {
        userId,
        claimed: true
      },
      orderBy: { weekStart: 'desc' },
      take: 10
    })

    // Get all low-liquidity markets (pool < 200 XLM)
    const lowLiquidityMarkets = await prisma.market.findMany({
      where: {
        status: 'OPEN'
      },
      select: {
        id: true,
        title: true,
        yesPool: true,
        noPool: true,
        incentiveMultiplier: true
      }
    })

    // Filter for low liquidity (totalPool < 200)
    const filteredMarkets = lowLiquidityMarkets
      .filter(m => (m.yesPool + m.noPool) < 200)
      .map(m => ({
        id: m.id,
        title: m.title,
        totalPool: m.yesPool + m.noPool,
        incentiveMultiplier: m.incentiveMultiplier
      }))

    return NextResponse.json({
      currentWeek: {
        weekStart,
        points: currentWeekReward?.points || 0,
        estimatedReward: currentWeekReward ? calculateEstimatedReward(currentWeekReward.points) : 0
      },
      history: claimedRewards.map(r => ({
        weekStart: r.weekStart,
        points: r.points,
        reward: r.reward
      })),
      lowLiquidityMarkets: filteredMarkets
    })
  } catch (error) {
    console.error('Error fetching liquidity incentives:', error)
    return NextResponse.json(
      { error: 'Failed to fetch liquidity incentives' },
      { status: 500 }
    )
  }
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

async function calculateEstimatedReward(userPoints: number): Promise<number> {
  const WEEKLY_POOL = 1000 // XLM
  const weekStart = getWeekStart(new Date())

  // Get total points for the week
  const allRewards = await prisma.liquidityReward.findMany({
    where: {
      weekStart,
      claimed: false
    },
    select: { points: true }
  })

  const totalPoints = allRewards.reduce((sum, r) => sum + r.points, 0)

  if (totalPoints === 0) {
    return 0
  }

  return (userPoints / totalPoints) * WEEKLY_POOL
}
