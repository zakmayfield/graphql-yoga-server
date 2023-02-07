export interface PostLinkArgs {
    description: string,
    url: string
}
export type PostCommentArgs = {
  body: string,
  linkId: string
}
export interface UpdateCommentArgs {
  commentId: string;
  body: string;
}