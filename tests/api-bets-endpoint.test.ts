import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET } from '@/app/api/bets/route';
import { GET as GET_STATS } from '@/app/api/bets/stats/route';
import prisma from '@/lib/db';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  default: {
    market: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    bet: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn()
    },
    user: {
      upsert: vi.fn(),
      update: vi.fn()
    },
    transaction: {
      create: vi.fn()
    },
    $transaction: vi.fn((ops) => Promise.all(ops))
  }
}));

describe('POST /api/bets - Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject bet when market not found', async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(null);

    const req = new Request('http://localhost:3000/api/bets', {
      method: 'POST',
      body: JSON.stringify({
        marketId: 'market-123',
        userPublicKey: 'GABC123',
        amount: 50,
        side: 'YES',
        commitment: 'commitment-hash'
      })
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Market not found');
  });

  it('should reject bet when market is closed', async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue({
      id: 'market-123',
      status: 'CLOSED'
    } as any);

    const req = new Request('http://localhost:3000/api/bets', {
      method: 'POST',
      body: JSON.stringify({
        marketId: 'market-123',
        userPublicKey: 'GABC123',
        amount: 50,
        side: 'YES',
        commitment: 'commitment-hash'
      })
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Market is closed');
  });

  it('should create bet when market is open', async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue({
      id: 'market-123',
      status: 'OPEN'
    } as any);

    vi.mocked(prisma.bet.create).mockResolvedValue({
      id: 'bet-123',
      marketId: 'market-123',
      userPublicKey: 'GABC123',
      amount: 50,
      commitment: 'commitment-hash',
      revealed: false,
      createdAt: new Date()
    } as any);

    // Mock other prisma calls in transaction
    vi.mocked(prisma.market.update).mockResolvedValue({} as any);
    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any);
    vi.mocked(prisma.user.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const req = new Request('http://localhost:3000/api/bets', {
      method: 'POST',
      body: JSON.stringify({
        marketId: 'market-123',
        userPublicKey: 'GABC123',
        amount: 50,
        side: 'YES',
        commitment: 'commitment-hash'
      })
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.bet).toBeDefined();
    expect(data.bet.id).toBe('bet-123');
  });
});

describe('GET /api/bets - Filtering and Sorting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch bets with default pagination', async () => {
    const mockBets = [
      {
        id: 'bet-1',
        marketId: 'market-1',
        userPublicKey: 'GABC123',
        amount: 50,
        commitment: 'hash-1',
        revealed: false,
        createdAt: new Date(),
        market: { id: 'market-1', title: 'Test Market', status: 'OPEN' },
        user: { publicKey: 'GABC123', name: 'User 1' }
      }
    ];

    vi.mocked(prisma.bet.findMany).mockResolvedValue(mockBets as any);
    vi.mocked(prisma.bet.count).mockResolvedValue(1);

    const req = new Request('http://localhost:3000/api/bets');
    const response = await GET(req as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.bets).toHaveLength(1);
    expect(data.pagination.total).toBe(1);
    expect(data.pagination.limit).toBe(50);
    expect(data.pagination.offset).toBe(0);
  });

  it('should filter bets by marketId', async () => {
    vi.mocked(prisma.bet.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bet.count).mockResolvedValue(0);

    const req = new Request('http://localhost:3000/api/bets?marketId=market-123');
    await GET(req as any);

    expect(prisma.bet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ marketId: 'market-123' })
      })
    );
  });

  it('should filter bets by userPublicKey', async () => {
    vi.mocked(prisma.bet.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bet.count).mockResolvedValue(0);

    const req = new Request('http://localhost:3000/api/bets?userPublicKey=GABC123');
    await GET(req as any);

    expect(prisma.bet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userPublicKey: 'GABC123' })
      })
    );
  });

  it('should filter bets by status (sealed)', async () => {
    vi.mocked(prisma.bet.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bet.count).mockResolvedValue(0);

    const req = new Request('http://localhost:3000/api/bets?status=sealed');
    await GET(req as any);

    expect(prisma.bet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ revealed: false })
      })
    );
  });

  it('should filter bets by status (revealed)', async () => {
    vi.mocked(prisma.bet.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bet.count).mockResolvedValue(0);

    const req = new Request('http://localhost:3000/api/bets?status=revealed');
    await GET(req as any);

    expect(prisma.bet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ revealed: true })
      })
    );
  });

  it('should sort bets by amount ascending', async () => {
    vi.mocked(prisma.bet.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bet.count).mockResolvedValue(0);

    const req = new Request('http://localhost:3000/api/bets?sortBy=amount&sortOrder=asc');
    await GET(req as any);

    expect(prisma.bet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { amount: 'asc' }
      })
    );
  });

  it('should sort bets by createdAt descending (default)', async () => {
    vi.mocked(prisma.bet.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bet.count).mockResolvedValue(0);

    const req = new Request('http://localhost:3000/api/bets');
    await GET(req as any);

    expect(prisma.bet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' }
      })
    );
  });

  it('should apply pagination with custom limit and offset', async () => {
    vi.mocked(prisma.bet.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bet.count).mockResolvedValue(100);

    const req = new Request('http://localhost:3000/api/bets?limit=10&offset=20');
    const response = await GET(req as any);
    const data = await response.json();

    expect(prisma.bet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 20
      })
    );

    expect(data.pagination.hasMore).toBe(true);
  });
});

describe('GET /api/bets/stats - Aggregate Statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return aggregate statistics for all bets', async () => {
    vi.mocked(prisma.bet.aggregate).mockResolvedValue({
      _sum: { amount: 500 },
      _count: { id: 10 },
      _avg: { amount: 50 }
    } as any);

    vi.mocked(prisma.bet.count)
      .mockResolvedValueOnce(7) // sealed count
      .mockResolvedValueOnce(3); // revealed count

    const req = new Request('http://localhost:3000/api/bets/stats');
    const response = await GET_STATS(req as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalVolume).toBe(500);
    expect(data.betCount).toBe(10);
    expect(data.avgBetSize).toBe(50);
    expect(data.sealedCount).toBe(7);
    expect(data.revealedCount).toBe(3);
  });

  it('should filter stats by marketId', async () => {
    vi.mocked(prisma.bet.aggregate).mockResolvedValue({
      _sum: { amount: 100 },
      _count: { id: 2 },
      _avg: { amount: 50 }
    } as any);

    vi.mocked(prisma.bet.count)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);

    const req = new Request('http://localhost:3000/api/bets/stats?marketId=market-123');
    await GET_STATS(req as any);

    expect(prisma.bet.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ marketId: 'market-123' })
      })
    );
  });

  it('should handle empty bet data gracefully', async () => {
    vi.mocked(prisma.bet.aggregate).mockResolvedValue({
      _sum: { amount: null },
      _count: { id: 0 },
      _avg: { amount: null }
    } as any);

    vi.mocked(prisma.bet.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const req = new Request('http://localhost:3000/api/bets/stats');
    const response = await GET_STATS(req as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalVolume).toBe(0);
    expect(data.betCount).toBe(0);
    expect(data.avgBetSize).toBe(0);
    expect(data.sealedCount).toBe(0);
    expect(data.revealedCount).toBe(0);
  });
});
