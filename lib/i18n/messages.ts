import { en } from './en'
import { ru } from './ru'

export type Locale = 'ru' | 'en'

export const LOCALES: readonly Locale[] = ['ru', 'en']

export type MessageKey = keyof typeof ru
export type Messages = Record<MessageKey, string>

export const MESSAGES: Record<Locale, Messages> = { ru, en }
