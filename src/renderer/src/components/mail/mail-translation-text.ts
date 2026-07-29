import type { Message } from '@renderer/components/mail/types'

export type HtmlTranslationTemplate = {
  html: string
  segments: string[]
}

export function getMessageTranslationText(message: Message): string {
  if (message.html?.trim()) return htmlToTranslationText(message.html)
  return message.body.join('\n\n').trim()
}

export function htmlToTranslationText(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
  document
    .querySelectorAll('script, style, noscript, template')
    .forEach((element) => element.remove())
  const output: string[] = []

  appendNodeText(document.body, output)
  return output
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function createHtmlTranslationTemplate(html: string): HtmlTranslationTemplate {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const segments: string[] = []
  const textNodes: Text[] = []
  collectTranslatableTextNodes(document.body, textNodes)

  for (const node of textNodes) {
    const original = node.data
    const text = original.trim()
    if (!text) continue
    const start = original.indexOf(text)
    const marker = htmlSegmentMarker(segments.length)
    segments.push(text)
    node.data = `${original.slice(0, start)}${marker}${original.slice(start + text.length)}`
  }

  return { html: document.body.innerHTML, segments }
}

export function applyHtmlTranslationTemplate(
  template: HtmlTranslationTemplate,
  translatedSegments: string[]
): string {
  const document = new DOMParser().parseFromString(template.html, 'text/html')
  const textNodes: Text[] = []
  collectTextNodes(document.body, textNodes)

  for (const node of textNodes) {
    translatedSegments.forEach((translatedText, index) => {
      const marker = htmlSegmentMarker(index)
      if (node.data.includes(marker)) node.data = node.data.replace(marker, translatedText)
    })
  }

  return document.body.innerHTML
}

function appendNodeText(node: Node, output: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    output.push(node.textContent ?? '')
    return
  }
  if (!(node instanceof HTMLElement)) return

  if (node.tagName === 'BR') {
    output.push('\n')
    return
  }

  const block = isBlockElement(node)
  if (block && output.length > 0 && !output.at(-1)?.endsWith('\n')) output.push('\n')
  if (node.tagName === 'LI') output.push('- ')
  node.childNodes.forEach((child) => appendNodeText(child, output))
  if (block && !output.at(-1)?.endsWith('\n')) output.push('\n')
}

function collectTranslatableTextNodes(node: Node, output: Text[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.textContent?.trim()) output.push(node as Text)
    return
  }
  if (!(node instanceof HTMLElement) || isNonContentElement(node)) return
  node.childNodes.forEach((child) => collectTranslatableTextNodes(child, output))
}

function collectTextNodes(node: Node, output: Text[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    output.push(node as Text)
    return
  }
  if (node instanceof HTMLElement && isNonContentElement(node)) return
  node.childNodes.forEach((child) => collectTextNodes(child, output))
}

function isNonContentElement(element: HTMLElement): boolean {
  return ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(element.tagName)
}

function htmlSegmentMarker(index: number): string {
  return `__ONEMAIL_HTML_TEXT_${index}__`
}

function isBlockElement(element: HTMLElement): boolean {
  return [
    'ADDRESS',
    'ARTICLE',
    'ASIDE',
    'BLOCKQUOTE',
    'DIV',
    'FOOTER',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HEADER',
    'LI',
    'MAIN',
    'P',
    'PRE',
    'SECTION',
    'TD',
    'TH',
    'TR'
  ].includes(element.tagName)
}
