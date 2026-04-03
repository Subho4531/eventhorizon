async function main() {
  const market = {
    contractMarketId: 1,
    title: "Will SpaceX land humans on Mars by 2026?",
    description: "Sealed-bid prediction on the success of the first crewed Mars mission.",
    creatorId: "GA2NUAFIJ6XN2QXRPWYGGGLSRIENLE4KISERJOSQS2IA37Z3PQVOLE43",
    closeDate: "2027-12-31T23:59:59Z",
    bondAmount: 50
  };

  console.log("Seeding market 1 via API...");
  const res = await fetch("http://localhost:3000/api/markets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(market)
  });

  if (res.ok) {
    const data = await res.json();
    console.log("✅ Market 1 seeded successfully into Prisma:", data.market.id);
  } else {
    const err = await res.text();
    console.log("❌ Failed to seed market:", err);
  }
}

main();
