export type IntercomResource = {
  id: string;
  type: string;
  workspace_id: string;
  parent_id: number;
  parent_type: string;
  title: string;
  description: string;
  body: string;
  author_id: number;
  state: string;
  created_at: number;
  updated_at: number;
  url: string;
};

export interface IntercomDocument extends IntercomResource {
  metadata: {
    collection: string;
  };
}
