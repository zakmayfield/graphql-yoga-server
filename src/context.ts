import { PrismaClient, User } from '@prisma/client';
import { FastifyRequest } from 'fastify';
import { GraphQLParams } from 'graphql-yoga';
import { authenticateUser } from './auth';

const prisma = new PrismaClient();

export type GraphQLContext = {
  prisma: PrismaClient;
  currentUser: User | null;
};

type ContextProps = {
  request: FastifyRequest;
  params: GraphQLParams;
};

export async function createContext(
  initialContext: ContextProps
): Promise<GraphQLContext> {
//   console.log('initialContext :::', initialContext.request);
  return {
    prisma,
    currentUser: await authenticateUser(prisma, initialContext.request),
  };
}
