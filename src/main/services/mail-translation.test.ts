import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TranslationSettings } from '../ipc/types'

const settings = vi.hoisted<TranslationSettings>(() => ({
  activeProvider: 'google',
  targetLanguage: 'zh-CN',
  providers: {
    aliyun: {},
    baidu: {},
    baidufield: {},
    caiyun: {},
    claude: {},
    cnki: {},
    deeplcustom: {},
    gemini: {},
    google: { endpoint: 'https://translate.googleapis.com' },
    huoshan: {},
    huoshanweb: {},
    microsoft: {},
    deepl: {},
    libretranslate: {},
    deeplx: {},
    niutrans: {},
    openai: {},
    tencent: {},
    tencenttransmart: {}
  }
}))

vi.mock('../db/repositories/settings.repository', () => ({
  getTranslationSettingsForMain: () => settings
}))

import { translateMailText } from './mail-translation'

describe('mail translation service', () => {
  beforeEach(() => {
    settings.activeProvider = 'google'
    settings.targetLanguage = 'zh-CN'
  })

  it('translates plain text with the configured Google endpoint', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(init?.body)).toContain('q=Hello')
      return jsonResponse([[['你好', 'Hello']]])
    })

    const result = await translateMailText({ text: 'Hello' }, fetchMock as typeof fetch)

    expect(result.translatedText).toBe('你好')
    expect(result.provider).toBe('google')
  })

  it('maps translated segment markers back to their original indexes', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestText = new URLSearchParams(String(init?.body)).get('q') ?? ''
      expect(requestText).toContain('__ONEMAIL_SEGMENT_0__First')
      expect(requestText).toContain('__ONEMAIL_SEGMENT_1__Second')
      return jsonResponse([[['__ONEMAIL_SEGMENT_0__第一\n__ONEMAIL_SEGMENT_1__第二', requestText]]])
    })

    const result = await translateMailText(
      { segments: ['First', 'Second'] },
      fetchMock as typeof fetch
    )

    expect(result.translatedSegments).toEqual(['第一', '第二'])
    expect(result.translatedText).toBe('第一\n第二')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('uses the OpenAI Responses API mode explicitly', async () => {
    settings.activeProvider = 'openai'
    settings.providers.openai = {
      endpoint: 'https://api.openai.com/v1/responses',
      apiKey: 'openai-key',
      model: 'gpt-test',
      apiMode: 'responses'
    }
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer openai-key' })
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({ model: 'gpt-test', stream: false })
      expect(body.instructions).toContain('__ONEMAIL_SEGMENT_n__')
      expect(body.input[0].content[0]).toEqual({ type: 'input_text', text: 'Hello' })
      expect(body.messages).toBeUndefined()
      return jsonResponse({
        output: [{ content: [{ type: 'output_text', text: '你好' }] }]
      })
    })

    await expect(
      translateMailText({ text: 'Hello' }, fetchMock as typeof fetch)
    ).resolves.toMatchObject({ translatedText: '你好' })
  })

  it('uses the OpenAI Chat Completions API mode explicitly', async () => {
    settings.activeProvider = 'openai'
    settings.providers.openai = {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'openai-key',
      model: 'gpt-test',
      apiMode: 'chat-completions'
    }
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.messages).toHaveLength(2)
      expect(body.input).toBeUndefined()
      return jsonResponse({ choices: [{ message: { content: '你好' } }] })
    })

    await expect(
      translateMailText({ text: 'Hello' }, fetchMock as typeof fetch)
    ).resolves.toMatchObject({ translatedText: '你好' })
  })

  it('signs Aliyun requests from a combined credential', async () => {
    settings.activeProvider = 'aliyun'
    settings.providers.aliyun = {
      endpoint: 'https://mt.aliyuncs.com',
      apiKey: 'access-id#access-secret',
      action: 'TranslateGeneral',
      scene: 'general'
    }
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = String(init?.body)
      expect(body).toContain('AccessKeyId=access-id')
      expect(body).toContain('SourceText=Hello')
      expect(body).toMatch(/Signature=[^&]+/)
      return jsonResponse({ Code: '200', Data: { Translated: '你好' } })
    })

    await expect(
      translateMailText({ text: 'Hello' }, fetchMock as typeof fetch)
    ).resolves.toMatchObject({ translatedText: '你好' })
  })

  it('supports Baidu general and field credential formats', async () => {
    settings.activeProvider = 'baidu'
    settings.providers.baidu = {
      endpoint: 'https://api.fanyi.baidu.com/api/trans/vip/translate',
      apiKey: 'app-id#secret#1'
    }
    const generalFetch = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = new URL(String(url))
      expect(requestUrl.searchParams.get('appid')).toBe('app-id')
      expect(requestUrl.searchParams.get('action')).toBe('1')
      expect(requestUrl.searchParams.get('sign')).toMatch(/^[a-f0-9]{32}$/)
      return jsonResponse({ trans_result: [{ dst: '你好' }] })
    })
    await expect(
      translateMailText({ text: 'Hello' }, generalFetch as typeof fetch)
    ).resolves.toMatchObject({ translatedText: '你好' })

    settings.activeProvider = 'baidufield'
    settings.providers.baidufield = {
      endpoint: 'https://api.fanyi.baidu.com/api/trans/vip/fieldtranslate',
      apiKey: 'app-id@secret@it'
    }
    const fieldFetch = vi.fn(async (url: string | URL | Request) => {
      expect(new URL(String(url)).searchParams.get('domain')).toBe('it')
      return jsonResponse({ trans_result: [{ dst: '领域译文' }] })
    })
    await expect(
      translateMailText({ text: 'Hello' }, fieldFetch as typeof fetch)
    ).resolves.toMatchObject({ translatedText: '领域译文' })
  })

  it('creates signed Volcengine and Tencent Cloud requests', async () => {
    settings.activeProvider = 'huoshan'
    settings.providers.huoshan = {
      endpoint: 'https://translate.volcengineapi.com',
      apiKey: 'access-id#access-secret'
    }
    const huoshanFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Authorization: expect.stringContaining('Credential=access-id/')
      })
      expect(JSON.parse(String(init?.body))).toEqual({
        TargetLanguage: 'zh',
        TextList: ['Hello']
      })
      return jsonResponse({ TranslationList: [{ Translation: '你好' }] })
    })
    await expect(
      translateMailText({ text: 'Hello' }, huoshanFetch as typeof fetch)
    ).resolves.toMatchObject({ translatedText: '你好' })

    settings.activeProvider = 'tencent'
    settings.providers.tencent = {
      endpoint: 'https://tmt.tencentcloudapi.com',
      apiKey: 'secret-id#secret-key#ap-shanghai#0'
    }
    const tencentFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = String(init?.body)
      expect(body).toContain('SecretId=secret-id')
      expect(body).toContain('Region=ap-shanghai')
      expect(body).toMatch(/Signature=[^&]+/)
      return jsonResponse({ Response: { TargetText: '你好' } })
    })
    await expect(
      translateMailText({ text: 'Hello' }, tencentFetch as typeof fetch)
    ).resolves.toMatchObject({ translatedText: '你好' })
  })

  it('encrypts CNKI text and performs token and translation requests separately', async () => {
    settings.activeProvider = 'cnki'
    settings.providers.cnki = { endpoint: 'https://dict.cnki.net/fyzs-front-api' }
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (url: string | URL | Request) => {
        expect(String(url)).toContain('/getToken')
        return jsonResponse({ code: 200, data: 'cnki-token' })
      })
      .mockImplementationOnce(async (url: string | URL | Request, init?: RequestInit) => {
        expect(String(url)).toContain('/translate/literaltranslation')
        expect(init?.headers).toMatchObject({ Token: 'cnki-token' })
        const body = JSON.parse(String(init?.body))
        expect(body.words).not.toContain('Hello')
        return jsonResponse({ data: { mResult: '你好' } })
      })

    await expect(
      translateMailText({ text: 'Hello' }, fetchMock as typeof fetch)
    ).resolves.toMatchObject({ translatedText: '你好' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    {
      provider: 'caiyun' as const,
      config: {
        endpoint: 'https://api.interpreter.caiyunai.com/v1/translator',
        apiKey: 'token'
      },
      response: { target: ['你好'] }
    },
    {
      provider: 'claude' as const,
      config: {
        endpoint: 'https://api.anthropic.com/v1/messages',
        apiKey: 'key',
        model: 'claude-test'
      },
      response: { content: [{ type: 'text', text: '你好' }] }
    },
    {
      provider: 'deepl' as const,
      config: { endpoint: 'https://api-free.deepl.com/v2/translate', apiKey: 'key#glossary' },
      response: { translations: [{ text: '你好' }] }
    },
    {
      provider: 'deeplcustom' as const,
      config: { endpoint: 'http://localhost:1188/translate' },
      response: { data: '你好' }
    },
    {
      provider: 'deeplx' as const,
      config: { endpoint: 'https://www2.deepl.com/jsonrpc' },
      response: { result: { texts: [{ text: '你好' }] } }
    },
    {
      provider: 'gemini' as const,
      config: {
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        apiKey: 'key',
        model: 'gemini-test'
      },
      response: { candidates: [{ content: { parts: [{ text: '你好' }] } }] }
    },
    {
      provider: 'huoshanweb' as const,
      config: { endpoint: 'https://translate.volcengine.com/crx/translate/v1' },
      response: { translation: '你好' }
    },
    {
      provider: 'libretranslate' as const,
      config: { endpoint: 'http://localhost:5000/translate' },
      response: { translatedText: '你好' }
    },
    {
      provider: 'microsoft' as const,
      config: {
        endpoint: 'https://api.cognitive.microsofttranslator.com',
        apiKey: 'key#eastasia'
      },
      response: [{ translations: [{ text: '你好' }] }]
    },
    {
      provider: 'niutrans' as const,
      config: { endpoint: 'https://niutrans.com/niuInterface', apiKey: 'key' },
      response: { code: 200, data: { tgt_text: '你好' } }
    },
    {
      provider: 'tencenttransmart' as const,
      config: { endpoint: 'https://transmart.qq.com/api/imt' },
      response: { auto_translation: ['你好'] }
    }
  ])('parses the $provider response format', async ({ provider, config, response }) => {
    settings.activeProvider = provider
    settings.providers[provider] = config
    const fetchMock = vi.fn(async () => jsonResponse(response))

    await expect(
      translateMailText({ text: 'Hello' }, fetchMock as typeof fetch)
    ).resolves.toMatchObject({ translatedText: '你好', provider })
  })
})

function jsonResponse(value: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(value)
  } as Response
}
