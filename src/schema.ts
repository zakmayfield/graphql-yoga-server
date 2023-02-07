import { PostLinkArgs, PostCommentArgs, UpdateCommentArgs } from './types';
import { GraphQLContext } from './context';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLError } from 'graphql';
import type { Link, Comment } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';

const parseIntSafe = (value: string): number | null => {
  if (/^(\d+)$/.test(value)) {
    return parseInt(value, 10);
  }
  return null;
};

const applyTakeConstraints = (params: {
  min: number;
  max: number;
  value: number;
}) => {
  if (params.value < params.min || params.value > params.max) {
    throw new GraphQLError(
      `'take' argument value '${params.value}' is outside the valud range of ${params.min} to ${params.max}`
    );
  }

  return params.value;
};

const applySkipConstraints = (params: {
  min: number;
  max: number;
  value: number;
}) => {
  if (params.value < params.min || params.value > params.max) {
    throw new GraphQLError(
      `'skip' argument value '${params.value}' is outside the valud range of ${params.min} to ${params.max}`
    );
  }

  return params.value;
};

const typeDefs = /* GraphQL */ `
  type Query {
    linkFeed(filterNeedle: String, take: Int, skip: Int): [Link]!
    link(linkId: ID!): Link
    comment(commentId: String!): Comment
    linkComments(linkId: String!): Link
  }

  type Mutation {
    postLink(description: String!, url: String!): Link
    postCommentOnLink(linkId: String!, body: String!): Comment
    deleteCommentOnLink(commentId: String!): Comment
    updateCommentOnLink(commentId: String!, body: String!): Comment

    deleteLink(id: String!): Link!
  }

  type Link {
    id: ID!
    description: String!
    url: String!
    comments: [Comment!]!
  }

  type Comment {
    id: ID!
    body: String!
    link: Link
  }
`;

const resolvers = {
  // ::: query :::
  Query: {
    // ::: Link :::
    linkFeed: async (
      parent: unknown,
      args: { filterNeedle?: string; skip?: number; take?: number },
      context: GraphQLContext
    ) => {
      /* Regarding filterNeedle
        filterNeedle is a pretty powerful tool to utilize, this is allowing us to search our Link model based on a condition of similar characters. We can specify which rows we want to filter against, in this case below we are filtering against both properties, description and url. If we change this to just check description then any matchings against url wont register
      */

      // note * consider making enums for available pagination min and max amounts ect

      const where = args.filterNeedle
        ? {
            OR: [
              { description: { contains: args.filterNeedle } },
              { url: { contains: args.filterNeedle } },
            ],
          }
        : {};

      const take = applyTakeConstraints({
        min: 1,
        max: 50,
        value: args.take ?? 30,
      });

      const skip = applySkipConstraints({
        min: 0,
        max: 50,
        value: args.skip ?? 0,
      });

      const linkFeed = await context.prisma.link.findMany({
        where,
        // take: number of items to take from the list
        take,
        // start at after x amount of indexes i.e. skip first 10
        skip,
      });

      return linkFeed;
    },
    linkComments: async (
      parent: unknown,
      args: { linkId: string },
      context: GraphQLContext
    ) => {
      const { linkId } = args;

      const linkComments = await context.prisma.link.findUnique({
        where: { id: Number(linkId) },
      });

      return linkComments;
    },

    // ::: Comment :::
    comment: async (
      parent: unknown,
      args: { commentId: string },
      context: GraphQLContext
    ) => {
      const { commentId } = args;

      const comment = await context.prisma.comment.findUnique({
        where: { id: Number(commentId) },
      });

      return comment;
    },
  },

  /* Regarding Link & Comment below:
    Link and Comment is pretty sweet - when hitting a query for our Link model we are allowing the client to also query the available comments on the Link, but in a separate query. This means the top level query of Link can succeed but the sub query of comments on the same query can fail, meaning we still have access to the top level of our data { ...link ✅  | comments 🚫 }. This means our UI can support data on multiple levels allowing us to avoid error bubbling and crashing our whole application. For instance a page with several sub tabs, the lowest sub tab can fail on the query but the rest of the data will load fine because the query didn't fail as a whole, only on comments
  */

  // ::: link :::
  Link: {
    comments: async (parent: Link, args: {}, context: GraphQLContext) => {
      return await context.prisma.comment.findMany({
        where: { linkId: parent.id },
      });
    },
  },

  Comment: {
    link: async (parent: Comment, args: {}, context: GraphQLContext) => {
      const { linkId } = parent;

      return await context.prisma.link.findUnique({
        where: { id: Number(linkId) },
      });
    },
  },

  // ::: mutations :::
  Mutation: {
    // ::: Link :::
    postLink: async (
      parent: unknown,
      args: PostLinkArgs,
      context: GraphQLContext
    ) => {
      const { description, url } = args;
      if (!description || !url)
        return Promise.reject(new GraphQLError(`🚫 All fields are required.`));

      const newLink: Link = await context.prisma.link.create({
        data: {
          description,
          url,
        },
      });

      return newLink;
    },
    deleteLink: async (
      parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      const { id } = args;
      const safeID = parseIntSafe(id);

      if (safeID === null) {
        return Promise.reject(
          new GraphQLError(`Cannot delete non-existing link with id '${id}'.`)
        );
      }

      const linkToDelete = await context.prisma.link.findUnique({
        where: { id: safeID },
      });

      if (!linkToDelete) {
        return Promise.reject(
          new GraphQLError(`Link with ID: '${id}' does not exist.`)
        );
      }

      const deletedLink = await context.prisma.link
        .delete({
          where: { id: safeID },
        })
        .catch((err: unknown) => {
          if (
            err instanceof PrismaClientKnownRequestError &&
            err.code === 'P2003'
          ) {
            return Promise.reject(
              new GraphQLError(
                `Cannot delete non-existing link with id '${id}'.`
              )
            );
          }
          return Promise.reject(err);
        });

      return deletedLink;
    },

    // ::: Comment :::
    postCommentOnLink: async (
      parent: unknown,
      args: PostCommentArgs,
      context: GraphQLContext
    ) => {
      const { body, linkId } = args;
      const safeID = parseIntSafe(linkId);

      if (safeID === null) {
        return Promise.reject(
          new GraphQLError(
            `Cannot post comment on non-existing link with id '${linkId}'.`
          )
        );
      }

      const linkToPostCommentOn = await context.prisma.link.findUnique({
        where: { id: safeID },
      });

      if (!linkToPostCommentOn)
        return Promise.reject(
          new GraphQLError(`Link with ID: '${linkId}' does not exist.`)
        );

      if (!body)
        return Promise.reject(new GraphQLError(`🚫 Body is a required field`));

      const newComment: Comment = await context.prisma.comment
        .create({
          data: {
            body,
            linkId: safeID,
          },
        })
        .catch((err: unknown) => {
          if (
            err instanceof PrismaClientKnownRequestError &&
            err.code === 'P2003'
          ) {
            return Promise.reject(
              new GraphQLError(
                `Cannot post comment on non-existing link with id '${linkId}'.`
              )
            );
          }
          return Promise.reject(err);
        });

      return newComment;
    },
    deleteCommentOnLink: async (
      parent: unknown,
      args: { commentId: string },
      context: GraphQLContext
    ) => {
      const { commentId } = args;
      const safeID = parseIntSafe(commentId);

      if (safeID === null) {
        return Promise.reject(
          new GraphQLError(
            `Cannot delete non-existing comment with id '${commentId}'.`
          )
        );
      }

      const commentToDelete = await context.prisma.comment.findUnique({
        where: { id: safeID },
      });

      if (!commentToDelete) {
        return Promise.reject(
          new GraphQLError(`Comment with ID: '${commentId}' does not exist.`)
        );
      }

      const deletedComment: Comment = await context.prisma.comment
        .delete({
          where: { id: safeID },
        })
        .catch((err: unknown) => {
          if (
            err instanceof PrismaClientKnownRequestError &&
            err.code === 'P2003'
          ) {
            return Promise.reject(
              new GraphQLError(
                `Cannot delete a non-existing comment with id '${commentId}'.`
              )
            );
          }
          return Promise.reject(err);
        });

      return deletedComment;
    },
    updateCommentOnLink: async (
      parent: unknown,
      args: UpdateCommentArgs,
      context: GraphQLContext
    ) => {
      const { commentId, body } = args;

      const safeID = parseIntSafe(commentId);

      if (safeID === null) {
        return Promise.reject(
          new GraphQLError(
            `Cannot delete non-existing comment with id '${commentId}'.`
          )
        );
      }

      const commentToDelete = await context.prisma.comment.findUnique({
        where: { id: safeID },
      });

      if (!commentToDelete) {
        return Promise.reject(
          new GraphQLError(`Comment with ID: '${commentId}' does not exist.`)
        );
      }

      const updatedComment: Comment = await context.prisma.comment
        .update({
          where: { id: safeID },
          data: {
            body,
          },
        })
        .catch((err: unknown) => {
          if (
            err instanceof PrismaClientKnownRequestError &&
            err.code === 'P2003'
          ) {
            return Promise.reject(
              new GraphQLError(
                `Cannot post comment on non-existing link with id '${commentId}'.`
              )
            );
          }
          return Promise.reject(err);
        });

      return updatedComment;
    },
  },
};

export const schema = makeExecutableSchema({
  resolvers: [resolvers],
  typeDefs: [typeDefs],
});
