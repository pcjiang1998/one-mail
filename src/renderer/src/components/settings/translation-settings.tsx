import { KeyRound, Languages, LoaderCircle, Save, TestTube2, X } from 'lucide-react'
import * as React from 'react'

import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@renderer/components/ui/field'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { loadTranslationSettings, saveTranslationSettings, translateMail } from '@renderer/lib/api'
import { useI18n, type TranslationKey } from '@renderer/lib/i18n'
import type {
  OpenAiApiMode,
  TranslationLanguage,
  TranslationProvider,
  TranslationProviderConfig,
  TranslationSettings
} from '../../../../shared/types'

type ConfigField =
  | 'action'
  | 'scene'
  | 'dictionaryId'
  | 'memoryId'
  | 'termRepositoryIds'
  | 'sentenceRepositoryIds'

type ProviderOption = {
  value: TranslationProvider
  label: string
  descriptionKey: TranslationKey
  credential: 'none' | 'optional' | 'required'
  credentialPlaceholder?: string
  model?: string
  apiMode?: boolean
  fields?: ConfigField[]
}

const providerOptions: ProviderOption[] = [
  {
    value: 'aliyun',
    label: 'Aliyun Translate',
    descriptionKey: 'settings.translation.provider.aliyun',
    credential: 'required',
    credentialPlaceholder: 'AccessKeyId#AccessKeySecret',
    fields: ['action', 'scene']
  },
  {
    value: 'baidu',
    label: 'Baidu Translate',
    descriptionKey: 'settings.translation.provider.baidu',
    credential: 'required',
    credentialPlaceholder: 'AppID#Key#Action(optional)'
  },
  {
    value: 'baidufield',
    label: 'Baidu Field Translate',
    descriptionKey: 'settings.translation.provider.baidufield',
    credential: 'required',
    credentialPlaceholder: 'AppID#Key#DomainCode'
  },
  {
    value: 'cnki',
    label: 'CNKI Translate',
    descriptionKey: 'settings.translation.provider.cnki',
    credential: 'none'
  },
  {
    value: 'huoshan',
    label: 'Volcengine Translate',
    descriptionKey: 'settings.translation.provider.huoshan',
    credential: 'required',
    credentialPlaceholder: 'AccessKeyId#AccessKeySecret'
  },
  {
    value: 'huoshanweb',
    label: 'Volcengine Web',
    descriptionKey: 'settings.translation.provider.huoshanweb',
    credential: 'none'
  },
  {
    value: 'caiyun',
    label: 'Caiyun Translate',
    descriptionKey: 'settings.translation.provider.caiyun',
    credential: 'required',
    credentialPlaceholder: 'Token'
  },
  {
    value: 'deepl',
    label: 'DeepL',
    descriptionKey: 'settings.translation.provider.deepl',
    credential: 'required',
    credentialPlaceholder: 'APIKey#GlossaryId(optional)'
  },
  {
    value: 'deeplx',
    label: 'DeepLX',
    descriptionKey: 'settings.translation.provider.deeplx',
    credential: 'none'
  },
  {
    value: 'deeplcustom',
    label: 'DeepL Custom',
    descriptionKey: 'settings.translation.provider.deeplcustom',
    credential: 'none'
  },
  {
    value: 'gemini',
    label: 'Google Gemini',
    descriptionKey: 'settings.translation.provider.gemini',
    credential: 'required',
    credentialPlaceholder: 'API Key',
    model: 'gemini-2.5-flash-lite'
  },
  {
    value: 'google',
    label: 'Google Translate',
    descriptionKey: 'settings.translation.provider.google',
    credential: 'none'
  },
  {
    value: 'claude',
    label: 'Anthropic Claude',
    descriptionKey: 'settings.translation.provider.claude',
    credential: 'required',
    credentialPlaceholder: 'API Key',
    model: 'claude-3-7-sonnet-20250219'
  },
  {
    value: 'openai',
    label: 'OpenAI Compatible',
    descriptionKey: 'settings.translation.provider.openai',
    credential: 'optional',
    credentialPlaceholder: 'API Key',
    model: 'gpt-4o-mini',
    apiMode: true
  },
  {
    value: 'microsoft',
    label: 'Microsoft Translator',
    descriptionKey: 'settings.translation.provider.microsoft',
    credential: 'required',
    credentialPlaceholder: 'ServiceKey#Region(optional)'
  },
  {
    value: 'niutrans',
    label: 'NiuTrans',
    descriptionKey: 'settings.translation.provider.niutrans',
    credential: 'required',
    credentialPlaceholder: 'API Key',
    fields: ['dictionaryId', 'memoryId']
  },
  {
    value: 'tencent',
    label: 'Tencent Cloud TMT',
    descriptionKey: 'settings.translation.provider.tencent',
    credential: 'required',
    credentialPlaceholder: 'SecretId#SecretKey#Region(optional)#ProjectId(optional)',
    fields: ['termRepositoryIds', 'sentenceRepositoryIds']
  },
  {
    value: 'tencenttransmart',
    label: 'Tencent Transmart',
    descriptionKey: 'settings.translation.provider.tencenttransmart',
    credential: 'none'
  },
  {
    value: 'libretranslate',
    label: 'LibreTranslate',
    descriptionKey: 'settings.translation.provider.libretranslate',
    credential: 'optional',
    credentialPlaceholder: 'API Key'
  }
]

const languageOptions: TranslationLanguage[] = [
  'zh-CN',
  'zh-TW',
  'en',
  'ja',
  'ko',
  'de',
  'fr',
  'es'
]

const configFieldDefinitions: Record<
  ConfigField,
  { labelKey: TranslationKey; placeholder?: string }
> = {
  action: { labelKey: 'settings.translation.action', placeholder: 'TranslateGeneral' },
  scene: { labelKey: 'settings.translation.scene', placeholder: 'general' },
  dictionaryId: { labelKey: 'settings.translation.dictionaryId' },
  memoryId: { labelKey: 'settings.translation.memoryId' },
  termRepositoryIds: {
    labelKey: 'settings.translation.termRepositoryIds',
    placeholder: 'id1,id2'
  },
  sentenceRepositoryIds: {
    labelKey: 'settings.translation.sentenceRepositoryIds',
    placeholder: 'id1,id2'
  }
}

export function TranslationSettings(): React.JSX.Element {
  const { t } = useI18n()
  const [draft, setDraft] = React.useState<TranslationSettings | null>(null)
  const [pending, setPending] = React.useState<'save' | 'test' | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void loadTranslationSettings()
      .then((settings) => {
        if (!cancelled) setDraft(settings)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : t('settings.translation.loadError')
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [t])

  if (!draft) {
    return (
      <div className="flex min-h-48 items-center justify-center text-xs text-muted-foreground">
        <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
        {t('common.loading')}
      </div>
    )
  }

  const providerDefinition =
    providerOptions.find((provider) => provider.value === draft.activeProvider) ??
    providerOptions[0]
  const activeConfig = draft.providers[draft.activeProvider]

  function updateConfig(patch: Partial<TranslationProviderConfig>): void {
    setDraft((current) =>
      current
        ? {
            ...current,
            providers: {
              ...current.providers,
              [current.activeProvider]: {
                ...current.providers[current.activeProvider],
                ...patch
              }
            }
          }
        : current
    )
  }

  function updateOpenAiMode(apiMode: OpenAiApiMode): void {
    const endpoint = activeConfig.endpoint
    const officialResponses = 'https://api.openai.com/v1/responses'
    const officialCompletions = 'https://api.openai.com/v1/chat/completions'
    updateConfig({
      apiMode,
      endpoint:
        endpoint === officialResponses || endpoint === officialCompletions
          ? apiMode === 'responses'
            ? officialResponses
            : officialCompletions
          : endpoint
    })
  }

  async function persistSettings(test: boolean): Promise<void> {
    if (!draft) return
    setPending(test ? 'test' : 'save')
    setError(null)
    setMessage(null)
    try {
      const saved = await saveTranslationSettings(draft)
      setDraft(saved)
      if (test) {
        const result = await translateMail({
          text: 'Hello, this is a translation service test.',
          targetLanguage: saved.targetLanguage
        })
        setMessage(t('settings.translation.testSuccess', { text: result.translatedText }))
      } else {
        setMessage(t('settings.translation.saved'))
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('settings.translation.saveError'))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col gap-4 p-3 sm:p-4">
      <Alert className="bg-muted/30 py-2 text-xs">
        <Languages />
        <AlertTitle>{t('settings.translation.privacyTitle')}</AlertTitle>
        <AlertDescription className="text-xs">
          {t('settings.translation.privacyDescription')}
        </AlertDescription>
      </Alert>

      <Field>
        <FieldLabel>{t('settings.translation.provider')}</FieldLabel>
        <Select
          value={draft.activeProvider}
          disabled={Boolean(pending)}
          onValueChange={(value) =>
            setDraft({ ...draft, activeProvider: value as TranslationProvider })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providerOptions.map((provider) => (
              <SelectItem key={provider.value} value={provider.value}>
                {provider.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>{t(providerDefinition.descriptionKey)}</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>{t('settings.translation.targetLanguage')}</FieldLabel>
        <Select
          value={draft.targetLanguage}
          disabled={Boolean(pending)}
          onValueChange={(value) =>
            setDraft({ ...draft, targetLanguage: value as TranslationLanguage })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languageOptions.map((language) => (
              <SelectItem key={language} value={language}>
                {t(`settings.translation.language.${language}` as TranslationKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="border-t pt-4">
        <Field>
          <FieldLabel>{t('settings.translation.endpoint')}</FieldLabel>
          <Input
            value={activeConfig.endpoint ?? ''}
            disabled={Boolean(pending)}
            spellCheck={false}
            onChange={(event) => updateConfig({ endpoint: event.target.value })}
          />
        </Field>
      </div>

      {providerDefinition.credential !== 'none' ? (
        <Field>
          <FieldLabel>
            {t('settings.translation.credential')}
            {providerDefinition.credential === 'optional' ? ` (${t('common.optional')})` : null}
          </FieldLabel>
          <div className="flex gap-2">
            <Input
              className="min-w-0 flex-1"
              type="password"
              value={activeConfig.apiKey ?? ''}
              disabled={Boolean(pending)}
              placeholder={
                activeConfig.apiKeyConfigured
                  ? t('settings.translation.secretConfigured')
                  : providerDefinition.credentialPlaceholder
              }
              autoComplete="off"
              onChange={(event) =>
                updateConfig({ apiKey: event.target.value, apiKeyConfigured: undefined })
              }
            />
            {activeConfig.apiKeyConfigured ? (
              <Button
                size="icon"
                variant="outline"
                title={t('settings.translation.clearApiKey')}
                aria-label={t('settings.translation.clearApiKey')}
                disabled={Boolean(pending)}
                onClick={() => updateConfig({ apiKey: '', apiKeyConfigured: false })}
              >
                <X />
              </Button>
            ) : null}
          </div>
          <FieldDescription>
            <KeyRound className="mr-1 inline size-3" aria-hidden="true" />
            {t('settings.translation.secretDescription')}
            {providerDefinition.credentialPlaceholder
              ? ` ${t('settings.translation.credentialFormat')}: ${providerDefinition.credentialPlaceholder}`
              : null}
          </FieldDescription>
        </Field>
      ) : null}

      {providerDefinition.apiMode ? (
        <Field>
          <FieldLabel>{t('settings.translation.apiMode')}</FieldLabel>
          <Select
            value={activeConfig.apiMode ?? 'responses'}
            disabled={Boolean(pending)}
            onValueChange={(value) => updateOpenAiMode(value as OpenAiApiMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="responses">Responses API</SelectItem>
              <SelectItem value="chat-completions">Chat Completions API</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {providerDefinition.model ? (
        <Field>
          <FieldLabel>{t('settings.translation.model')}</FieldLabel>
          <Input
            value={activeConfig.model ?? ''}
            disabled={Boolean(pending)}
            placeholder={providerDefinition.model}
            onChange={(event) => updateConfig({ model: event.target.value })}
          />
        </Field>
      ) : null}

      {providerDefinition.fields?.map((field) => {
        const definition = configFieldDefinitions[field]
        return (
          <Field key={field}>
            <FieldLabel>{t(definition.labelKey)}</FieldLabel>
            <Input
              value={activeConfig[field] ?? ''}
              disabled={Boolean(pending)}
              placeholder={definition.placeholder}
              onChange={(event) => updateConfig({ [field]: event.target.value })}
            />
          </Field>
        )
      })}

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button
          variant="outline"
          disabled={Boolean(pending)}
          onClick={() => void persistSettings(true)}
        >
          {pending === 'test' ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <TestTube2 data-icon="inline-start" />
          )}
          {t('settings.translation.test')}
        </Button>
        <Button disabled={Boolean(pending)} onClick={() => void persistSettings(false)}>
          {pending === 'save' ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          {t('common.save')}
        </Button>
      </div>

      {message ? (
        <Alert className="py-2 text-xs">
          <Languages />
          <AlertTitle>{message}</AlertTitle>
        </Alert>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  )
}
