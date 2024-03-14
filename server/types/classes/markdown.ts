export type MarkdownDocument = {
  id: string;
  url: string;
  path: string;
  filename: string;
  title: string;
  description: string;
  keywords: string;
  body: string;
  type: string;
};

export type Section = {
  content: string;
  heading?: string;
  slug?: string;
};
