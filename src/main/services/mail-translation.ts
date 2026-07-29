import { getTranslationSettingsForMain } from '../db/repositories/settings.repository'
import type {
  TranslationLanguage,
  TranslationProvider,
  TranslationProviderConfig,
  TranslationRequest,
  TranslationResult
} from '../ipc/types'
import { translateWithProvider } from './mail-translation-providers'

const MAX_TRANSLATION_TEXT_LENGTH = 200_000
const TRANSLATION_CHUNK_LENGTH = 4_000

type FetchImplementation = typeof fetch

export async function translateMailText(
  input: TranslationRequest,
  fetchImplementation: FetchImplementation = fetch
): Promise<TranslationResult> {
  const text = input?.text?.trim()
  const segments = normalizeSegments(input?.segments)
  const totalLength = text?.length ?? segments.reduce((sum, segment) => sum + segment.length, 0)
  if (!text && segments.length === 0) throw new Error('没有可翻译的邮件正文。')
  if (totalLength > MAX_TRANSLATION_TEXT_LENGTH) {
    throw new Error('邮件正文过长，暂时无法一次翻译。')
  }

  const settings = getTranslationSettingsForMain()
  const targetLanguage = input.targetLanguage ?? settings.targetLanguage
  if (!isTranslationLanguage(targetLanguage)) throw new Error('不支持的翻译目标语言。')
  const provider = settings.activeProvider
  const config = settings.providers[provider]
  const translatedSegments =
    segments.length > 0
      ? await translateSegments(provider, config, segments, targetLanguage, fetchImplementation)
      : undefined
  const translatedText = translatedSegments
    ? translatedSegments.join('\n')
    : await translateLongText(provider, config, text!, targetLanguage, fetchImplementation)

  return {
    provider,
    targetLanguage,
    translatedText: translatedText.trim(),
    translatedSegments
  }
}

async function translateLongText(
  provider: TranslationProvider,
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const translatedChunks: string[] = []
  for (const chunk of splitTranslationText(text)) {
    translatedChunks.push(
      await translateWithProvider(provider, config, chunk, targetLanguage, fetchImplementation)
    )
  }
  return translatedChunks.join('')
}

async function translateSegments(
  provider: TranslationProvider,
  config: TranslationProviderConfig,
  segments: string[],
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string[]> {
  const result = new Array<string>(segments.length)
  for (const batch of createSegmentBatches(segments)) {
    if (batch.length === 1) {
      const item = batch[0]
      result[item.index] = await translateLongText(
        provider,
        config,
        item.text,
        targetLanguage,
        fetchImplementation
      )
      continue
    }

    const encoded = batch.map((item) => `${segmentMarker(item.index)}${item.text}`).join('\n')
    const translated = await translateWithProvider(
      provider,
      config,
      encoded,
      targetLanguage,
      fetchImplementation
    )
    const parsed = parseTranslatedSegments(
      translated,
      batch.map((item) => item.index)
    )
    if (parsed) {
      for (const [index, value] of parsed) result[index] = value
      continue
    }

    for (const item of batch) {
      result[item.index] = await translateLongText(
        provider,
        config,
        item.text,
        targetLanguage,
        fetchImplementation
      )
    }
  }
  return result
}

function splitTranslationText(text: string): string[] {
  const chunks: string[] = []
  let remaining = text.replace(/\r\n?/g, '\n')
  while (remaining.length > TRANSLATION_CHUNK_LENGTH) {
    const candidate = remaining.slice(0, TRANSLATION_CHUNK_LENGTH)
    const newlineIndex = candidate.lastIndexOf('\n')
    const spaceIndex = candidate.lastIndexOf(' ')
    const splitAt = Math.max(newlineIndex, spaceIndex, Math.floor(TRANSLATION_CHUNK_LENGTH * 0.6))
    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt)
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

function normalizeSegments(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  if (value.length > 2_000) throw new Error('邮件正文包含过多文本节点，无法翻译。')
  return value.map((segment) => (typeof segment === 'string' ? segment.trim() : '')).filter(Boolean)
}

function createSegmentBatches(segments: string[]): Array<Array<{ index: number; text: string }>> {
  const batches: Array<Array<{ index: number; text: string }>> = []
  let current: Array<{ index: number; text: string }> = []
  let currentLength = 0

  segments.forEach((text, index) => {
    const encodedLength = segmentMarker(index).length + text.length + 1
    if (current.length > 0 && currentLength + encodedLength > TRANSLATION_CHUNK_LENGTH) {
      batches.push(current)
      current = []
      currentLength = 0
    }
    current.push({ index, text })
    currentLength += encodedLength
  })
  if (current.length > 0) batches.push(current)
  return batches
}

function parseTranslatedSegments(
  translated: string,
  indexes: number[]
): Map<number, string> | null {
  const positions = indexes.map((index) => ({
    index,
    position: translated.indexOf(segmentMarker(index))
  }))
  if (positions.some((item) => item.position < 0)) return null
  positions.sort((left, right) => left.position - right.position)

  const parsed = new Map<number, string>()
  positions.forEach((item, positionIndex) => {
    const start = item.position + segmentMarker(item.index).length
    const end = positions[positionIndex + 1]?.position ?? translated.length
    const value = translated
      .slice(start, end)
      .replace(/^\s*\n?/, '')
      .replace(/\n?\s*$/, '')
      .trim()
    if (value) parsed.set(item.index, value)
  })
  return parsed.size === indexes.length ? parsed : null
}

function segmentMarker(index: number): string {
  return `__ONEMAIL_SEGMENT_${index}__`
}

function isTranslationLanguage(value: unknown): value is TranslationLanguage {
  return ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'de', 'fr', 'es'].includes(String(value))
}
