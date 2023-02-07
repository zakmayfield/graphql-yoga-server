import { schema } from './schema';
import { execute, parse } from 'graphql';
import { createYoga } from 'graphql-yoga';
import { createServer } from 'http';
import { createContext } from './context';
import * as dotenv from 'dotenv';

dotenv.config()

async function main() {
    const yoga = createYoga({ schema, context: createContext })
    const server = createServer(yoga)

    server.listen(4000, () => {
        console.log(`🚀 server running on http://localhost:4000`)
    })
}

main();
