import { schema } from './schema';
import { execute, parse } from 'graphql';
import { createYoga } from 'graphql-yoga';
import { createServer } from 'http';
import { createContext } from './context';
import fastify, { FastifyRequest, FastifyReply } from 'fastify';

export function buildApp(logging = true) {
  const app = fastify({
    logger: logging && {
      transport: {
        target: 'pino-pretty',
      },
      level: 'debug',
    },
  });

  const graphQLServer = createYoga<{
    req: FastifyRequest;
    reply: FastifyReply;
  }>({
    schema,

    context: createContext,
    
    logging: {
      debug: (...args) => args.forEach((arg) => app.log.debug(arg)),
      info: (...args) => args.forEach((arg) => app.log.info(arg)),
      warn: (...args) => args.forEach((arg) => app.log.warn(arg)),
      error: (...args) => args.forEach((arg) => app.log.error(arg)),
    },
  });

  app.addContentTypeParser('multipart/form-data', {}, (req, payload, done) =>
    done(null)
  );

  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],

    handler: async (req, reply) => {
      const response = await graphQLServer.handleNodeRequest(req, {
        req,
        reply,
      });

      for (const [name, value] of response.headers) {
        reply.header(name, value);
      }

      reply.status(response.status);

      reply.send(response.body);

      return reply;
    },
  });

  return app;
}

// async function main() {
//     const yoga = createYoga({ schema, context: createContext })
//     const server = createServer(yoga)

//     server.listen(4000, () => {
//         console.log(`🚀 server running on http://localhost:4000`)
//     })
// }

// main();
