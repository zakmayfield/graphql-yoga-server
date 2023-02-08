import { PrismaClient, User } from '@prisma/client';
import { FastifyRequest } from 'fastify';
import { JwtPayload, verify } from 'jsonwebtoken';

export const APP_SECRET: string = 'testing secret, use env'!;

export async function authenticateUser(
  prisma: PrismaClient,
  request: FastifyRequest
): Promise<User | null> {
  const header = request.headers.authorization;
  console.log('REQ HEADER :::', request?.headers?.host);

  if (header !== null) {
    const token = header?.split(' ')[1];
    if (!token) {
      return null;
    }

    const tokenPayload = verify(token, APP_SECRET) as JwtPayload;
    const userId = tokenPayload.userId;

    return await prisma.user.findUnique({ where: { id: userId } });
  }

  return null;
}
