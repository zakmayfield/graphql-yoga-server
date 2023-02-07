import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const newLink = await prisma.link.create({
    data: {
      description: 'test link 2',
      url: 'test link url',
    },
  });

  const allLinks = await prisma.link.findMany();

  console.log('::: all links :::', allLinks);
}

main().finally(async () => await prisma.$disconnect());
