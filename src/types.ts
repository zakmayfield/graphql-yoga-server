export interface PostLinkArgs {
    description: string,
    url: string
}
export interface PostCommentArgs {
  body: string,
  linkId: string
}
export interface UpdateCommentArgs {
  commentId: string;
  body: string;
}
export interface SignupArgs {
  name: string;
  email: string;
  password: string;
}
export interface LoginArgs {
  email: string;
  password: string;
}