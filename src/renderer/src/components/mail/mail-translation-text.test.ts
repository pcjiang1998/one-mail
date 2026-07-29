import { describe, expect, it } from 'vitest'

import {
  applyHtmlTranslationTemplate,
  createHtmlTranslationTemplate,
  htmlToTranslationText
} from './mail-translation-text'

describe('mail translation HTML handling', () => {
  it('extracts only visible text and excludes CSS and non-content elements', () => {
    const html = `
      <style>.private-token { color: red; }</style>
      <div class="message" style="font-weight: 700; color: blue">
        Hello <strong>world</strong>
      </div>
      <script>window.privateToken = true</script>
      <template>private template text</template>
    `

    const template = createHtmlTranslationTemplate(html)

    expect(template.segments).toEqual(['Hello', 'world'])
    expect(template.segments.join(' ')).not.toContain('private-token')
    expect(template.segments.join(' ')).not.toContain('font-weight')
    expect(htmlToTranslationText(html)).toBe('Hello world')
  })

  it('reconstructs translated text inside the original HTML and CSS structure', () => {
    const cssMarker = '__ONEMAIL_HTML_TEXT_0__'
    const template = createHtmlTranslationTemplate(`
      <div class="message" style="font-weight: 700; --mail-note: ${cssMarker}">
        <span>Hello</span> world
        <template>${cssMarker}</template>
      </div>
    `)

    const translatedHtml = applyHtmlTranslationTemplate(template, ['你好', '世界'])
    const document = new DOMParser().parseFromString(translatedHtml, 'text/html')
    const message = document.querySelector('.message')

    expect(message?.getAttribute('style')).toContain('font-weight: 700')
    expect(message?.getAttribute('style')).toContain(cssMarker)
    expect(message?.querySelector('span')?.textContent).toBe('你好')
    expect(message?.textContent).toContain('世界')
    expect(message?.querySelector('template')?.content.textContent).toContain(cssMarker)
    expect(translatedHtml).not.toContain('__ONEMAIL_HTML_TEXT_1__')
  })
})
