import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const users = [
  {
    name: 'Rohit Acharya',
    email: 'rohitacharya25@gmail.com',
    publicKey: 'GCFJQCTGFO5QXE5F6TYFRARFDX3O2GXSJ56N37ZBEX4V5LQYQKU54IQH',
  },
  {
    name: 'Deep Saha',
    email: 'sdeep027@gmail.com',
    publicKey: 'GAPZFL43CLQZUZTVH4XGC7XPY7WGWD7RI2D4E2IQGFDFVYZN4BI7GMVL',
  },
  {
    name: 'Sumit Sarkar',
    email: 'sumit087@gmail.com',
    publicKey: 'GAVAIWLB3PBWMVKPDHLDVRAS7VH4DA2SXW3W2G7V5QLJ6DK3HY3AJVAN',
  },
  {
    name: 'Samrat Natta',
    email: 'samratnatta993@gmail.com',
    publicKey: 'GBTLRERJBUOHFIIZCHAOTXSSQ2UF5BU6WFYMXCMHY672II75LXXB3FAI',
  },
  {
    name: 'Nilarpan Jana',
    email: 'nnilarpan@gmail.com',
    publicKey: 'GCQM3XP3IWUY3LCPDIP4QRLB7VIL2DY2QLZJ2KG2NANWUAFAZ3ULECUQ',
  },
  {
    name: 'Samrat Trader',
    email: 'mamotadasmamotadas@gmail.com',
    publicKey: 'GCRG5UZWUAFUEC67XU4Q6GUYLA4OGR3EBKEVFMXTJ34HI6QTQAP6T7L7',
  },
  {
    name: 'Cosmeon Trader',
    email: 'nilarpanj@gmail.com',
    publicKey: 'GAIQM3ISTUYHANMIJ2ZYUCLGALE6UYWYIORVS7XA43YJ6WAHWZW2XR7G',
  },
  {
    name: 'Sylvia Barick',
    email: 'taniabarick15@gmail.com',
    publicKey: 'GBYOEY63WVKXY5KTSQZG4FGCDYY2CV7K3SH4ZSVN6IFDWJ464HPFIEIQ',
  },
];

async function main() {
  console.log('Starting user update...');
  for (const user of users) {
    try {
      await prisma.user.upsert({
        where: { publicKey: user.publicKey },
        update: {
          name: user.name,
          email: user.email,
        },
        create: {
          publicKey: user.publicKey,
          name: user.name,
          email: user.email,
          balance: 1000, // Initial balance for testers
        },
      });
      console.log(`Updated user: ${user.name}`);
    } catch (error) {
      console.error(`Failed to update user ${user.name}:`, error);
    }
  }
  console.log('User update completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
