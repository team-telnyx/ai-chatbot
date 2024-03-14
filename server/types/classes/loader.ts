/* 
  This enumerator is very important
  It determines the available indexes in our vectorstore
  Adding another type here will create a new index in our vectorstore 
  */

export enum DocumentType {
  telnyx = 'Telnyx_docs',
}

export type Document = {
  id: string;
  url: string;
  type: DocumentType;
  title: string;
  display_title: string;
  description: string;
  body: string;
  paragraphs: Paragraph[];
  total_tokens: number;
  rule_violation: boolean;
  metadata: {
    collection?: string;
    keywords?: string;
  };
};

export type Paragraph = {
  id?: string;
  heading: string;
  content: string;
  tokens: number;
};
