export interface DmButton { title: string; url: string }

export interface FormState {
  name: string;
  triggerType: 'any' | 'keyword';
  keywords: string[];
  replyEnabled: boolean;
  replyTemplates: string[];
  dmEnabled: boolean;
  dmTemplates: string[];
  dmButtons: DmButton[];
  followCheckEnabled: boolean;
  followAskMessage: string;
  followAskButton: string;
  followFailMessage: string;
  followFailButton: string;
  postScope: 'all' | 'specific';
  postIds: string[];
  postData: { id: string; caption?: string; thumbnail?: string }[];
}

export const EMPTY_FORM: FormState = {
  name: '',
  triggerType: 'any',
  keywords: [],
  replyEnabled: true,
  replyTemplates: [''],
  dmEnabled: false,
  dmTemplates: [''],
  dmButtons: [],
  followCheckEnabled: false,
  followAskMessage: "Ma'lumotni olish uchun quyidagi tugmani bosing 👇",
  followAskButton: "Ma'lumotni olish",
  followFailMessage: "Siz hali obuna bo'lmagansiz. Iltimos, avval sahifamizga obuna bo'ling, keyin tugmani bosing.",
  followFailButton: "Obuna bo'ldim ✅",
  postScope: 'all',
  postIds: [],
  postData: [],
};
