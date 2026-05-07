export type Visibility = "private" | "unlisted" | "domain" | "public";



export interface PublicUser {
  id: string;
  email: string;
  emailDomain: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  visibility: Visibility;
  /** Optional punchier headline used for SEO and the OG share card. */
  seoTitle?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SearchHit {
  id: string;
  title: string;
  snippet: string;
  tags: string[];
  updatedAt: number;
}

export interface WriteInput {
  title: string;
  body: string;
  tags?: string[];
  visibility?: Visibility;
  seoTitle?: string;
}

export interface AppendInput {
  id: string;
  body: string;
}

export interface SearchInput {
  query: string;
  tags?: string[];
  limit?: number;
}
