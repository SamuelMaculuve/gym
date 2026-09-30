/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ADOBE_FONTS_KIT?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
