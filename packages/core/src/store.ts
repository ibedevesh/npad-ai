import type { Note, SearchHit, WriteInput, AppendInput, SearchInput, Visibility } from "./types.js";

export interface UpdateInput {
  id: string;
  title?: string;
  body?: string;
  tags?: string[];
  visibility?: Visibility;
}

export interface ListInput {
  limit?: number;
  tag?: string;
}

export interface Store {
  write(input: WriteInput): Promise<Note>;
  read(idOrUrl: string): Promise<Note | null>;
  append(input: AppendInput): Promise<Note | null>;
  update(input: UpdateInput): Promise<Note | null>;
  list(input?: ListInput): Promise<Note[]>;
  search(input: SearchInput): Promise<SearchHit[]>;
  fork(idOrUrl: string): Promise<Note | null>;
  delete(id: string): Promise<boolean>;
}
