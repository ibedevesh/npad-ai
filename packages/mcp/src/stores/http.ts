import {
  parseId,
  type Store,
  type Note,
  type SearchHit,
  type WriteInput,
  type AppendInput,
  type SearchInput,
  type UpdateInput,
  type ListInput,
} from "@npad/core";

export class HttpStore implements Store {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`npad ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  }

  async write(input: WriteInput): Promise<Note> {
    return this.request<Note>("/n", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async read(idOrUrl: string): Promise<Note | null> {
    const id = parseId(idOrUrl);
    if (!id) return null;
    try {
      return await this.request<Note>(`/n/${id}`);
    } catch (e) {
      if (String(e).includes("404")) return null;
      throw e;
    }
  }

  async append(input: AppendInput): Promise<Note | null> {
    const id = parseId(input.id);
    if (!id) return null;
    try {
      return await this.request<Note>(`/n/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ body: input.body }),
      });
    } catch (e) {
      if (String(e).includes("404")) return null;
      throw e;
    }
  }

  async search(input: SearchInput): Promise<SearchHit[]> {
    const params = new URLSearchParams({ q: input.query });
    if (input.limit) params.set("limit", String(input.limit));
    if (input.tags?.length) params.set("tags", input.tags.join(","));
    return this.request<SearchHit[]>(`/search?${params.toString()}`);
  }

  async update(input: UpdateInput): Promise<Note | null> {
    const id = parseId(input.id);
    if (!id) return null;
    const { id: _drop, ...rest } = input;
    try {
      return await this.request<Note>(`/n/${id}`, {
        method: "PUT",
        body: JSON.stringify(rest),
      });
    } catch (e) {
      if (String(e).includes("404")) return null;
      throw e;
    }
  }

  async list(input: ListInput = {}): Promise<Note[]> {
    const params = new URLSearchParams();
    if (input.limit) params.set("limit", String(input.limit));
    if (input.tag) params.set("tag", input.tag);
    return this.request<Note[]>(`/list?${params.toString()}`);
  }

  async fork(idOrUrl: string): Promise<Note | null> {
    const id = parseId(idOrUrl);
    if (!id) return null;
    try {
      return await this.request<Note>(`/n/${id}/fork`, { method: "POST" });
    } catch (e) {
      if (String(e).includes("404")) return null;
      throw e;
    }
  }

  async delete(id: string): Promise<boolean> {
    const parsed = parseId(id);
    if (!parsed) return false;
    try {
      await this.request<void>(`/n/${parsed}`, { method: "DELETE" });
      return true;
    } catch {
      return false;
    }
  }
}
