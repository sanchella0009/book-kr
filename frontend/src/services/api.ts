const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  json?: any;
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options.headers || {});

  if (options.json) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.json);
  }

  // Include credentials for HTTPOnly JWT Cookie
  options.credentials = 'include';
  options.headers = headers;

  const response = await fetch(url, options as RequestInit);
  const result = await response.json();

  if (!response.ok || !result.success) {
    const errorMsg = result.error?.message || response.statusText || 'An error occurred';
    const error = new Error(errorMsg);
    (error as any).code = result.error?.code || 'HTTP_ERROR';
    (error as any).status = response.status;
    throw error;
  }

  return result.data as T;
}

export const api = {
  // Public API
  public: {
    getBooks: () => request<any[]>('/public/books'),
    getBookByYear: (year: number) => request<any>(`/public/book/${year}`),
    getChapter: (year: number, chapterId: number) =>
      request<any>(`/public/book/${year}/chapter/${chapterId}`),
  },

  // Admin Auth API
  auth: {
    login: (json: any) => request<any>('/admin/auth/login', { method: 'POST', json }),
    logout: () => request<any>('/admin/auth/logout', { method: 'POST' }),
    me: () => request<any>('/admin/auth/me'),
    changePassword: (json: any) => request<any>('/admin/auth/change-password', { method: 'POST', json }),
  },

  // Admin Books API
  books: {
    list: () => request<any[]>('/admin/books'),
    create: (json: any) => request<any>('/admin/books', { method: 'POST', json }),
    get: (id: number) => request<any>(`/admin/books/${id}`),
    update: (id: number, json: any) => request<any>(`/admin/books/${id}`, { method: 'PUT', json }),
    delete: (id: number) => request<any>(`/admin/books/${id}`, { method: 'DELETE' }),
    publish: (id: number) => request<any>(`/admin/books/${id}/publish`, { method: 'POST' }),
    unpublish: (id: number) => request<any>(`/admin/books/${id}/unpublish`, { method: 'POST' }),
  },

  // Admin Chapters API
  chapters: {
    list: (bookId: number) => request<any[]>(`/admin/books/${bookId}/chapters`),
    create: (bookId: number, json: any) => request<any>(`/admin/books/${bookId}/chapters`, { method: 'POST', json }),
    get: (id: number) => request<any>(`/admin/chapters/${id}`),
    update: (id: number, json: any) => request<any>(`/admin/chapters/${id}`, { method: 'PUT', json }),
    delete: (id: number) => request<any>(`/admin/chapters/${id}`, { method: 'DELETE' }),
    duplicate: (id: number) => request<any>(`/admin/chapters/${id}/duplicate`, { method: 'POST' }),
    reorder: (chapterIds: number[]) => request<any>('/admin/chapters/reorder', { method: 'POST', json: { chapterIds } }),
    publish: (id: number) => request<any>(`/admin/chapters/${id}/publish`, { method: 'POST' }),
    unpublish: (id: number) => request<any>(`/admin/chapters/${id}/unpublish`, { method: 'POST' }),
  },

  // Admin Content Blocks API
  blocks: {
    list: (chapterId: number) => request<any[]>(`/admin/chapters/${chapterId}/blocks`),
    create: (chapterId: number, json: any) => request<any>(`/admin/chapters/${chapterId}/blocks`, { method: 'POST', json }),
    update: (id: number, json: any) => request<any>(`/admin/blocks/${id}`, { method: 'PUT', json }),
    delete: (id: number) => request<any>(`/admin/blocks/${id}`, { method: 'DELETE' }),
    duplicate: (id: number) => request<any>(`/admin/blocks/${id}/duplicate`, { method: 'POST' }),
    reorder: (chapterId: number, blockIds: number[]) =>
      request<any>('/admin/blocks/reorder', { method: 'POST', json: { chapterId, blockIds } }),
  },

  // Admin Revisions API
  revisions: {
    list: (chapterId: number) => request<any[]>(`/admin/chapters/${chapterId}/revisions`),
    restore: (revisionId: number) => request<any>(`/admin/revisions/${revisionId}/restore`, { method: 'POST' }),
  },

  // Admin Media API
  media: {
    list: (filters: { search?: string; team?: string; event?: string } = {}) => {
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.set('search', filters.search);
      if (filters.team) queryParams.set('team', filters.team);
      if (filters.event) queryParams.set('event', filters.event);
      return request<any[]>(`/admin/media?${queryParams.toString()}`);
    },
    upload: (formData: FormData) => {
      return request<any[]>('/admin/media', {
        method: 'POST',
        body: formData, // fetch will automatically set boundary headers for FormData when body is FormData and headers doesn't override content-type
      });
    },
    update: (id: number, json: any) => request<any>(`/admin/media/${id}`, { method: 'PUT', json }),
    delete: (id: number) => request<any>(`/admin/media/${id}`, { method: 'DELETE' }),
  },
};
