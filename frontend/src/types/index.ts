export interface Book {
  id: number;
  year: number;
  title: string;
  description: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: number;
  book_id: number;
  title: string;
  description: string | null;
  cover_media_id: number | null;
  cover_path: string | null;
  sort_order: number;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
  startPageIdx?: number;
  startPageNumber?: number;
}

export interface ContentBlockStyle {
  align?: 'left' | 'center' | 'right' | 'justify';
  textColor?: string;
  backgroundColor?: string;
  fontSizeMultiplier?: number;
  italic?: boolean;
  bold?: boolean;
  borderStyle?: string;
  stickerType?: string;
  spacerHeight?: number;
  columnsCount?: number; // for gallery
}

export interface ContentBlock {
  id: number;
  chapter_id: number;
  type:
    | 'heading'
    | 'subheading'
    | 'paragraph'
    | 'image'
    | 'image_with_caption'
    | 'quote'
    | 'date'
    | 'separator'
    | 'gallery'
    | 'video'
    | 'sticker'
    | 'spacer';
  sort_order: number;
  content: string;
  style: ContentBlockStyle | null;
  media_id: number | null;
  media_filename?: string;
  media_width?: number;
  media_height?: number;
  optimized_path?: string;
  thumbnail_path?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Media {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  orig_size: number;
  width: number;
  height: number;
  title: string | null;
  description: string | null;
  captured_at: string | null;
  team: string | null;
  event: string | null;
  author: string | null;
  optimized_path: string;
  original_path: string;
  thumbnail_path: string;
  created_at: string;
}

export interface Revision {
  id: number;
  chapter_id: number;
  content: ContentBlock[];
  creator_name: string | null;
  created_at: string;
}

export interface ReaderSettings {
  fontSizeScale: number; // e.g. 1.0, 1.2, 1.5, 0.8
  fontFamily: 'serif' | 'sans';
  lineHeight: 'compact' | 'normal' | 'relaxed';
  textWidth: 'narrow' | 'normal' | 'wide';
  theme: 'light' | 'dark' | 'system';
}

export interface VirtualPage {
  index: number;
  blocks: ContentBlock[];
  chapterId?: number;
  chapterTitle?: string;
}
