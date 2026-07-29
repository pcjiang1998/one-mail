import { createCipheriv, createHash, createHmac, randomBytes } from 'node:crypto'

import type {
  TranslationLanguage,
  TranslationProvider,
  TranslationProviderConfig
} from '../ipc/types'

const TRANSLATION_TIMEOUT_MS = 45_000
const CNKI_CHUNK_LENGTH = 800

type FetchImplementation = typeof fetch

export async function translateWithProvider(
  provider: TranslationProvider,
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  switch (provider) {
    case 'aliyun':
      return translateWithAliyun(config, text, targetLanguage, fetchImplementation)
    case 'baidu':
      return translateWithBaidu(config, text, targetLanguage, fetchImplementation, false)
    case 'baidufield':
      return translateWithBaidu(config, text, targetLanguage, fetchImplementation, true)
    case 'caiyun':
      return translateWithCaiyun(config, text, targetLanguage, fetchImplementation)
    case 'claude':
      return translateWithClaude(config, text, targetLanguage, fetchImplementation)
    case 'cnki':
      return translateWithCnki(config, text, targetLanguage, fetchImplementation)
    case 'deepl':
      return translateWithDeepL(config, text, targetLanguage, fetchImplementation)
    case 'deeplcustom':
      return translateWithDeepLCustom(config, text, targetLanguage, fetchImplementation)
    case 'deeplx':
      return translateWithDeepLX(config, text, targetLanguage, fetchImplementation)
    case 'gemini':
      return translateWithGemini(config, text, targetLanguage, fetchImplementation)
    case 'google':
      return translateWithGoogle(config, text, targetLanguage, fetchImplementation)
    case 'huoshan':
      return translateWithHuoshan(config, text, targetLanguage, fetchImplementation)
    case 'huoshanweb':
      return translateWithHuoshanWeb(config, text, targetLanguage, fetchImplementation)
    case 'libretranslate':
      return translateWithLibreTranslate(config, text, targetLanguage, fetchImplementation)
    case 'microsoft':
      return translateWithMicrosoft(config, text, targetLanguage, fetchImplementation)
    case 'niutrans':
      return translateWithNiutrans(config, text, targetLanguage, fetchImplementation)
    case 'openai':
      return translateWithOpenAi(config, text, targetLanguage, fetchImplementation)
    case 'tencent':
      return translateWithTencent(config, text, targetLanguage, fetchImplementation)
    case 'tencenttransmart':
      return translateWithTencentTransmart(config, text, targetLanguage, fetchImplementation)
  }
}

async function translateWithAliyun(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const [accessKeyId, accessKeySecret] = requireCredentialParts(config, '阿里云翻译', 2, 2)
  const parameters: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: config.action?.trim() || 'TranslateGeneral',
    Format: 'JSON',
    FormatType: 'text',
    Scene: config.scene?.trim() || 'general',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: randomBytes(12).toString('hex'),
    SignatureVersion: '1.0',
    SourceLanguage: 'auto',
    SourceText: text,
    TargetLanguage: mapAliyunLanguage(targetLanguage),
    Timestamp: new Date().toISOString(),
    Version: '2018-10-12'
  }
  const encodedBody = Object.entries(parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&')
  const stringToSign = `POST&%2F&${encodeRfc3986(encodedBody)}`
  const signature = createHmac('sha1', `${accessKeySecret}&`).update(stringToSign).digest('base64')
  const response = await requestJson(fetchImplementation, requireEndpoint(config, '阿里云翻译'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `${encodedBody}&Signature=${encodeRfc3986(signature)}`
  })
  const code = readPath(response, ['Code'])
  if (code !== undefined && String(code) !== '200') {
    throw new Error(
      `阿里云翻译返回错误：${String(code)} ${String(readPath(response, ['Message']) ?? '')}`
    )
  }
  return requireTranslatedText(readPath(response, ['Data', 'Translated']), '阿里云翻译')
}

async function translateWithBaidu(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation,
  fieldMode: boolean
): Promise<string> {
  const parts = requireCredentialParts(
    config,
    fieldMode ? '百度领域翻译' : '百度翻译',
    fieldMode ? 3 : 2,
    3
  )
  const [appId, secretKey, third = '0'] = parts
  const salt = Date.now().toString()
  const signSource = fieldMode
    ? `${appId}${text}${salt}${third}${secretKey}`
    : `${appId}${text}${salt}${secretKey}`
  const endpoint = new URL(requireEndpoint(config, fieldMode ? '百度领域翻译' : '百度翻译'))
  endpoint.searchParams.set('q', text)
  endpoint.searchParams.set('appid', appId)
  endpoint.searchParams.set('from', 'auto')
  endpoint.searchParams.set('to', mapSimpleLanguage(targetLanguage))
  endpoint.searchParams.set('salt', salt)
  endpoint.searchParams.set('sign', createHash('md5').update(signSource).digest('hex'))
  if (fieldMode) endpoint.searchParams.set('domain', third)
  else {
    endpoint.searchParams.set('action', third)
    endpoint.searchParams.set('needIntervene', '1')
  }

  const response = await requestJson(fetchImplementation, endpoint.toString(), { method: 'GET' })
  const errorCode = readPath(response, ['error_code'])
  if (errorCode) {
    throw new Error(
      `${fieldMode ? '百度领域翻译' : '百度翻译'}返回错误：${String(errorCode)} ${String(readPath(response, ['error_msg']) ?? '')}`
    )
  }
  const results = readPath(response, ['trans_result'])
  if (!Array.isArray(results)) {
    throw new Error(`${fieldMode ? '百度领域翻译' : '百度翻译'}未返回译文。`)
  }
  return requireTranslatedText(
    results
      .map((item) => readPath(item, ['dst']))
      .filter(isString)
      .join(''),
    fieldMode ? '百度领域翻译' : '百度翻译'
  )
}

async function translateWithCaiyun(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const response = await requestJson(fetchImplementation, requireEndpoint(config, '彩云小译'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-authorization': `token ${requireApiKey(config, '彩云小译')}`
    },
    body: JSON.stringify({
      source: [text],
      trans_type: `auto2${mapCaiyunLanguage(targetLanguage)}`,
      request_id: Date.now().toString(),
      detect: true
    })
  })
  return requireTranslatedText(readPath(response, ['target', 0]), '彩云小译')
}

async function translateWithClaude(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const model = requireModel(config, 'Claude')
  const response = await requestJson(fetchImplementation, requireEndpoint(config, 'Claude'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': requireApiKey(config, 'Claude')
    },
    body: JSON.stringify({
      model,
      system: translationPrompt(targetLanguage),
      messages: [{ role: 'user', content: text }],
      temperature: 0,
      max_tokens: 8192,
      stream: false
    })
  })
  const content = readPath(response, ['content'])
  const translated = Array.isArray(content)
    ? content
        .map((item) => readPath(item, ['text']))
        .filter(isString)
        .join('')
    : undefined
  return requireTranslatedText(translated, 'Claude')
}

async function translateWithCnki(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  if (!targetLanguage.startsWith('zh-')) {
    throw new Error('CNKI 翻译当前仅支持将内容翻译为中文。')
  }
  const endpoint = requireEndpoint(config, 'CNKI 翻译')
  const tokenResponse = await requestJson(
    fetchImplementation,
    appendEndpointPath(endpoint, 'getToken'),
    { method: 'GET' }
  )
  const token = readPath(tokenResponse, ['data']) ?? readPath(tokenResponse, ['token'])
  if (typeof token !== 'string' || !token.trim()) throw new Error('CNKI 翻译未返回访问令牌。')

  const translations: string[] = []
  for (const chunk of splitAtLength(text, CNKI_CHUNK_LENGTH)) {
    const response = await requestJson(
      fetchImplementation,
      appendEndpointPath(endpoint, 'translate/literaltranslation'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=UTF-8', Token: token },
        body: JSON.stringify({ words: encryptCnkiText(chunk), translateType: null })
      }
    )
    if (readPath(response, ['data', 'isInputVerificationCode'])) {
      throw new Error('CNKI 翻译要求完成人机验证，请稍后再试。')
    }
    translations.push(
      requireTranslatedText(readPath(response, ['data', 'mResult']), 'CNKI 翻译').replace(
        /(查看名企职位.+?https:\/\/dict\.cnki\.net[a-zA-Z./]+\.html?)/g,
        ''
      )
    )
  }
  return translations.join('')
}

async function translateWithDeepL(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const [apiKey, glossaryId] = splitCredential(config.apiKey)
  if (!apiKey) throw new Error('请先配置 DeepL API Key。')
  const body: Record<string, unknown> = {
    text: [text],
    target_lang: mapDeepLLanguage(targetLanguage)
  }
  if (glossaryId) body.glossary_id = glossaryId
  const response = await requestJson(fetchImplementation, requireEndpoint(config, 'DeepL'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `DeepL-Auth-Key ${apiKey}`
    },
    body: JSON.stringify(body)
  })
  return requireTranslatedText(readPath(response, ['translations', 0, 'text']), 'DeepL')
}

async function translateWithDeepLCustom(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const response = await requestJson(fetchImplementation, requireEndpoint(config, 'DeepL Custom'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      text,
      source_lang: 'AUTO',
      target_lang: mapDeepLLanguage(targetLanguage)
    })
  })
  const translated =
    readPath(response, ['data']) ??
    readPath(response, ['translatedText']) ??
    readPath(response, ['translations', 0, 'text'])
  return requireTranslatedText(translated, 'DeepL Custom')
}

async function translateWithDeepLX(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const configuredEndpoint = requireEndpoint(config, 'DeepLX')
  if (!/deepl\.com\/jsonrpc/i.test(configuredEndpoint)) {
    return translateWithDeepLCustom(config, text, targetLanguage, fetchImplementation)
  }
  const id = 1000 * (Math.floor(Math.random() * 99_999) + 8_300_000) + 1
  const count = (text.match(/i/g) ?? []).length + 1
  const now = Date.now()
  const body = JSON.stringify({
    jsonrpc: '2.0',
    method: 'LMT_handle_texts',
    id,
    params: {
      texts: [{ text, requestAlternatives: 3 }],
      splitting: 'newlines',
      lang: {
        source_lang_user_selected: 'AUTO',
        target_lang: mapDeepLLanguage(targetLanguage)
      },
      timestamp: now - (now % count) + count,
      commonJobParams: { wasSpoken: false, transcribe_as: '' }
    }
  }).replace(
    '"method":"',
    (id + 5) % 29 === 0 || (id + 3) % 13 === 0 ? '"method" : "' : '"method": "'
  )
  const endpoint = new URL(configuredEndpoint)
  endpoint.searchParams.set('client', 'chrome-extension,1.28.0')
  endpoint.searchParams.set('method', 'LMT_handle_jobs')
  const response = await requestJson(fetchImplementation, endpoint.toString(), {
    method: 'POST',
    headers: {
      Accept: '*/*',
      Authorization: 'None',
      'Content-Type': 'application/json',
      Referer: 'https://www.deepl.com/'
    },
    body
  })
  return requireTranslatedText(readPath(response, ['result', 'texts', 0, 'text']), 'DeepLX')
}

async function translateWithGemini(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const endpoint = buildGeminiEndpoint(config)
  endpoint.searchParams.set('key', requireApiKey(config, 'Gemini'))
  const response = await requestJson(fetchImplementation, endpoint.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: `${translationPrompt(targetLanguage)}\n\n${text}` }] }
      ],
      generationConfig: { temperature: 0 }
    })
  })
  const parts = readPath(response, ['candidates', 0, 'content', 'parts'])
  const translated = Array.isArray(parts)
    ? parts
        .map((part) => readPath(part, ['text']))
        .filter(isString)
        .join('')
    : undefined
  return requireTranslatedText(translated, 'Gemini')
}

async function translateWithGoogle(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const endpoint = requireEndpoint(config, 'Google Translate').replace(/\/+$/, '')
  const response = await requestJson(
    fetchImplementation,
    `${endpoint}/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLanguage)}&dt=t`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ q: text }).toString()
    }
  )
  if (!Array.isArray(response)) throw new Error('Google Translate 返回了无法识别的数据。')
  const segments = response[0]
  if (!Array.isArray(segments)) throw new Error('Google Translate 未返回译文。')
  return requireTranslatedText(
    segments
      .map((segment) =>
        Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : ''
      )
      .join(''),
    'Google Translate'
  )
}

async function translateWithHuoshan(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const [accessKeyId, accessKeySecret] = requireCredentialParts(config, '火山翻译', 2, 2)
  const currentTime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const region = 'cn-north-1'
  const service = 'translate'
  const query = 'Action=TranslateText&Version=2020-06-01'
  const requestBody = JSON.stringify({
    TargetLanguage: mapSimpleLanguage(targetLanguage),
    TextList: [text]
  })
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Date': currentTime,
    'X-Content-Sha256': sha256Hex(requestBody)
  }
  const signedHeaders = Object.keys(headers)
    .sort()
    .map((key) => key.toLowerCase())
    .join(';')
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((key) => `${key.toLowerCase()}:${headers[key]}\n`)
    .join('')
  const canonicalRequest = [
    'POST',
    '/',
    query,
    canonicalHeaders,
    signedHeaders,
    headers['X-Content-Sha256']
  ].join('\n')
  const scope = `${currentTime}/${region}/${service}/request`
  const signingString = ['HMAC-SHA256', currentTime, scope, sha256Hex(canonicalRequest)].join('\n')
  const dateKey = hmacSha256(accessKeySecret, currentTime)
  const regionKey = hmacSha256(dateKey, region)
  const serviceKey = hmacSha256(regionKey, service)
  const signingKey = hmacSha256(serviceKey, 'request')
  const signature = createHmac('sha256', signingKey).update(signingString).digest('hex')
  headers.Authorization = `HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await requestJson(
    fetchImplementation,
    `${requireEndpoint(config, '火山翻译').replace(/\/+$/, '')}/?${query}`,
    { method: 'POST', headers, body: requestBody }
  )
  return requireTranslatedText(
    readPath(response, ['TranslationList', 0, 'Translation']),
    '火山翻译'
  )
}

async function translateWithHuoshanWeb(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const response = await requestJson(fetchImplementation, requireEndpoint(config, '火山网页翻译'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_language: 'auto',
      target_language: mapSimpleLanguage(targetLanguage),
      text
    })
  })
  return requireTranslatedText(readPath(response, ['translation']), '火山网页翻译')
}

async function translateWithLibreTranslate(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const body: Record<string, string> = {
    q: text,
    source: 'auto',
    target: mapSimpleLanguage(targetLanguage),
    format: 'text'
  }
  if (config.apiKey?.trim()) body.api_key = config.apiKey.trim()
  const response = await requestJson(
    fetchImplementation,
    appendEndpointPath(requireEndpoint(config, 'LibreTranslate'), 'translate'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  )
  return requireTranslatedText(readPath(response, ['translatedText']), 'LibreTranslate')
}

async function translateWithMicrosoft(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const [apiKey, region] = requireCredentialParts(config, 'Microsoft Translator', 1, 2)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Ocp-Apim-Subscription-Key': apiKey
  }
  if (region && region.toLowerCase() !== 'global') {
    headers['Ocp-Apim-Subscription-Region'] = region.replace(/\s+/g, '').toLowerCase()
  }
  const endpoint = appendEndpointPath(requireEndpoint(config, 'Microsoft Translator'), 'translate')
  const response = await requestJson(
    fetchImplementation,
    `${endpoint}?api-version=3.0&to=${encodeURIComponent(mapMicrosoftLanguage(targetLanguage))}`,
    { method: 'POST', headers, body: JSON.stringify([{ Text: text }]) }
  )
  return requireTranslatedText(
    readPath(response, [0, 'translations', 0, 'text']),
    'Microsoft Translator'
  )
}

async function translateWithNiutrans(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const endpoint = requireEndpoint(config, '小牛翻译').replace(/\/+$/, '')
  const url = new URL(appendEndpointPath(endpoint, 'textTranslation'))
  url.searchParams.set('pluginType', 'one-mail')
  url.searchParams.set('apikey', requireApiKey(config, '小牛翻译'))
  const response = await requestJson(fetchImplementation, url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' },
    body: JSON.stringify({
      from: 'auto',
      to: mapSimpleLanguage(targetLanguage),
      termDictionaryLibraryId: config.dictionaryId?.trim() || undefined,
      translationMemoryLibraryId: config.memoryId?.trim() || undefined,
      realmCode: 99,
      source: 'one-mail',
      src_text: text
    })
  })
  const code = readPath(response, ['code'])
  if (code !== undefined && Number(code) !== 200) {
    throw new Error(
      `小牛翻译返回错误：${String(code)} ${String(readPath(response, ['msg']) ?? '')}`
    )
  }
  const direct = readPath(response, ['data', 'tgt_text'])
  if (typeof direct === 'string') return requireTranslatedText(direct, '小牛翻译')
  const sentences = readPath(response, ['data', 0, 'sentences'])
  const translated = Array.isArray(sentences)
    ? sentences
        .map((sentence) => readPath(sentence, ['data']))
        .filter(isString)
        .join('')
    : undefined
  return requireTranslatedText(translated, '小牛翻译')
}

async function translateWithOpenAi(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const endpoint = requireEndpoint(config, 'OpenAI')
  const model = requireModel(config, 'OpenAI')
  const apiMode = config.apiMode ?? 'responses'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey?.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`
  const prompt = translationPrompt(targetLanguage)
  const body =
    apiMode === 'responses'
      ? {
          model,
          instructions: prompt,
          input: [{ role: 'user', content: [{ type: 'input_text', text }] }],
          stream: false
        }
      : {
          model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: text }
          ],
          temperature: 0,
          stream: false
        }
  const response = await requestJson(fetchImplementation, endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })
  const translated =
    apiMode === 'responses'
      ? readOpenAiResponsesText(response)
      : readPath(response, ['choices', 0, 'message', 'content'])
  return requireTranslatedText(translated, 'OpenAI')
}

async function translateWithTencent(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const [secretId, secretKey, region = 'ap-shanghai', projectId = '0'] = requireCredentialParts(
    config,
    '腾讯云翻译',
    2,
    4
  )
  const parameters: Record<string, string> = {
    Action: 'TextTranslate',
    Language: 'zh-CN',
    Nonce: String(Math.floor(Math.random() * 90_000) + 10_000),
    ProjectId: projectId,
    Region: region,
    SecretId: secretId,
    Source: 'auto',
    SourceText: text,
    Target: mapSimpleLanguage(targetLanguage),
    Timestamp: Math.floor(Date.now() / 1000).toString(),
    Version: '2018-03-21'
  }
  parseCommaList(config.termRepositoryIds).forEach((id, index) => {
    parameters[`TermRepoIDList.${index}`] = id
  })
  parseCommaList(config.sentenceRepositoryIds).forEach((id, index) => {
    parameters[`SentRepoIDList.${index}`] = id
  })
  const entries = Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right))
  const rawQuery = entries.map(([key, value]) => `${key}=${value}`).join('&')
  const signature = createHmac('sha1', secretKey)
    .update(`POSTtmt.tencentcloudapi.com/?${rawQuery}`)
    .digest('base64')
  const body = `${entries
    .map(([key, value]) => `${encodeFormComponent(key)}=${encodeFormComponent(value)}`)
    .join('&')}&Signature=${encodeFormComponent(signature)}`
  const response = await requestJson(fetchImplementation, requireEndpoint(config, '腾讯云翻译'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const serviceError = readPath(response, ['Response', 'Error'])
  if (serviceError) {
    throw new Error(
      `腾讯云翻译返回错误：${String(readPath(serviceError, ['Code']) ?? '')} ${String(readPath(serviceError, ['Message']) ?? '')}`
    )
  }
  return requireTranslatedText(readPath(response, ['Response', 'TargetText']), '腾讯云翻译')
}

async function translateWithTencentTransmart(
  config: TranslationProviderConfig,
  text: string,
  targetLanguage: TranslationLanguage,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const response = await requestJson(fetchImplementation, requireEndpoint(config, '腾讯交互翻译'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: 'https://transmart.qq.com/zh-CN/index'
    },
    body: JSON.stringify({
      header: {
        fn: 'auto_translation',
        client_key: 'browser-chrome-110.0.0-Windows-10-df4bd4c5-a65d-44b2-a40f-42f34f3535f2'
      },
      type: 'plain',
      model_category: 'normal',
      source: { lang: 'auto', text_list: [text] },
      target: { lang: mapSimpleLanguage(targetLanguage) }
    })
  })
  const translated = readPath(response, ['auto_translation'])
  return requireTranslatedText(
    Array.isArray(translated) ? translated.filter(isString).join('\n').trim() : translated,
    '腾讯交互翻译'
  )
}

async function requestJson(
  fetchImplementation: FetchImplementation,
  url: string,
  init: RequestInit
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS)
  try {
    const response = await fetchImplementation(url, { ...init, signal: controller.signal })
    const responseText = await response.text()
    let parsed: unknown
    try {
      parsed = responseText ? JSON.parse(responseText) : null
    } catch {
      parsed = responseText
    }
    if (!response.ok) {
      const detail = readServiceError(parsed)
      throw new Error(`翻译服务请求失败（HTTP ${response.status}）${detail ? `：${detail}` : '。'}`)
    }
    return parsed
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('翻译服务请求超时。')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function buildGeminiEndpoint(config: TranslationProviderConfig): URL {
  const endpoint = requireEndpoint(config, 'Gemini')
  if (/:generateContent(?:\?|$)/i.test(endpoint)) return new URL(endpoint)
  const normalized = endpoint.replace(/\/+$/, '')
  const model = requireModel(config, 'Gemini')
  const modelEndpoint = /\/models\/[^/]+$/i.test(normalized)
    ? normalized
    : `${normalized}/${encodeURIComponent(model)}`
  return new URL(`${modelEndpoint}:generateContent`)
}

function encryptCnkiText(text: string): string {
  const cipher = createCipheriv('aes-128-ecb', Buffer.from('4e87183cfd3a45fe'), null)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return encrypted.toString('base64').replace(/\//g, '_').replace(/\+/g, '-')
}

function splitAtLength(text: string, maximumLength: number): string[] {
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > maximumLength) {
    const candidate = remaining.slice(0, maximumLength)
    const splitAt = Math.max(
      candidate.lastIndexOf('\n'),
      candidate.lastIndexOf(' '),
      Math.floor(maximumLength * 0.6)
    )
    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt)
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

function requireCredentialParts(
  config: TranslationProviderConfig,
  provider: string,
  minimum: number,
  maximum: number
): string[] {
  const parts = splitCredential(config.apiKey)
  if (parts.length < minimum || parts.length > maximum || parts.some((part) => !part)) {
    const count = minimum === maximum ? String(minimum) : `${minimum}-${maximum}`
    throw new Error(`请按服务说明配置 ${provider} 凭据（${count} 个字段）。`)
  }
  return parts
}

function splitCredential(value?: string): string[] {
  const credential = value?.trim()
  if (!credential) return []
  const delimiter = credential.includes('#') ? '#' : credential.includes('@') ? '@' : undefined
  return delimiter ? credential.split(delimiter).map((part) => part.trim()) : [credential]
}

function requireEndpoint(config: TranslationProviderConfig, provider: string): string {
  const endpoint = config.endpoint?.trim()
  if (!endpoint) throw new Error(`请先配置 ${provider} Endpoint。`)
  const parsed = new URL(endpoint)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${provider} Endpoint 仅支持 HTTP 或 HTTPS。`)
  }
  return parsed.toString().replace(/\/$/, '')
}

function appendEndpointPath(endpoint: string, path: string): string {
  const normalized = endpoint.replace(/\/+$/, '')
  return normalized.toLowerCase().endsWith(`/${path.toLowerCase()}`)
    ? normalized
    : `${normalized}/${path}`
}

function requireApiKey(config: TranslationProviderConfig, provider: string): string {
  const apiKey = config.apiKey?.trim()
  if (!apiKey) throw new Error(`请先配置 ${provider} API Key。`)
  return apiKey
}

function requireModel(config: TranslationProviderConfig, provider: string): string {
  const model = config.model?.trim()
  if (!model) throw new Error(`请先配置 ${provider} 模型名称。`)
  return model
}

function requireTranslatedText(value: unknown, provider: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${provider} 未返回译文。`)
  return value
}

function readPath(value: unknown, path: Array<string | number>): unknown {
  let current = value
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string | number, unknown>)[key]
  }
  return current
}

function readOpenAiResponsesText(value: unknown): unknown {
  const direct = readPath(value, ['output_text'])
  if (typeof direct === 'string') return direct
  const output = readPath(value, ['output'])
  if (!Array.isArray(output)) return undefined
  const texts: string[] = []
  for (const item of output) {
    const content = readPath(item, ['content'])
    if (!Array.isArray(content)) continue
    for (const part of content) {
      const text = readPath(part, ['text'])
      if (typeof text === 'string') texts.push(text)
    }
  }
  return texts.join('') || undefined
}

function readServiceError(value: unknown): string | undefined {
  const detail =
    readPath(value, ['error', 'message']) ??
    readPath(value, ['Response', 'Error', 'Message']) ??
    readPath(value, ['message']) ??
    (typeof value === 'string' ? value : undefined)
  return typeof detail === 'string' ? detail.trim().slice(0, 300) : undefined
}

function translationPrompt(targetLanguage: TranslationLanguage): string {
  return `Translate the email body into ${languageName(targetLanguage)}. Preserve paragraph breaks, lists, names, email addresses, URLs, factual meaning, and every __ONEMAIL_SEGMENT_n__ marker exactly. Return only the translated text.`
}

function mapSimpleLanguage(language: TranslationLanguage): string {
  return language.startsWith('zh-') ? 'zh' : language
}

function mapAliyunLanguage(language: TranslationLanguage): string {
  return language === 'zh-TW' ? 'zh-tw' : mapSimpleLanguage(language)
}

function mapCaiyunLanguage(language: TranslationLanguage): string {
  return language === 'zh-TW' ? 'zh-Hant' : mapSimpleLanguage(language)
}

function mapMicrosoftLanguage(language: TranslationLanguage): string {
  if (language === 'zh-CN') return 'zh-Hans'
  if (language === 'zh-TW') return 'zh-Hant'
  return language
}

function mapDeepLLanguage(language: TranslationLanguage): string {
  if (language === 'zh-CN') return 'ZH-HANS'
  if (language === 'zh-TW') return 'ZH-HANT'
  return language.toUpperCase()
}

function languageName(language: TranslationLanguage): string {
  const names: Record<TranslationLanguage, string> = {
    'zh-CN': 'Simplified Chinese',
    'zh-TW': 'Traditional Chinese',
    en: 'English',
    ja: 'Japanese',
    ko: 'Korean',
    de: 'German',
    fr: 'French',
    es: 'Spanish'
  }
  return names[language]
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function encodeFormComponent(value: string): string {
  return encodeRfc3986(value).replace(/%20/g, '+')
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function hmacSha256(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest()
}

function parseCommaList(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}
