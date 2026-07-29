import type { MailtoComposeRequest } from '../../shared/types'

const MAX_PENDING_REQUESTS = 20
const pendingRequests: MailtoComposeRequest[] = []

export function findMailtoUrl(args: string[]): string | undefined {
  return args.map((arg) => arg.trim()).find((arg) => arg.toLowerCase().startsWith('mailto:'))
}

export function enqueueMailtoUrl(rawUrl: string): MailtoComposeRequest | null {
  const request = parseMailtoUrl(rawUrl)
  if (!request) return null

  pendingRequests.push(request)
  if (pendingRequests.length > MAX_PENDING_REQUESTS) pendingRequests.shift()
  return request
}

export function takePendingMailtoRequests(): MailtoComposeRequest[] {
  return pendingRequests.splice(0, pendingRequests.length)
}

export function parseMailtoUrl(rawUrl: string): MailtoComposeRequest | null {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return null
  }
  if (url.protocol.toLowerCase() !== 'mailto:') return null

  return {
    to: uniqueAddresses([decodeMailtoComponent(url.pathname), ...url.searchParams.getAll('to')]),
    cc: uniqueAddresses(url.searchParams.getAll('cc')),
    bcc: uniqueAddresses(url.searchParams.getAll('bcc')),
    subject: sanitizeHeader(url.searchParams.get('subject') ?? ''),
    body: sanitizeBody(url.searchParams.get('body') ?? '')
  }
}

function decodeMailtoComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function uniqueAddresses(values: string[]): string[] {
  const addresses = values
    .flatMap((value) => value.split(/[;,]/))
    .map((value) => sanitizeHeader(value).trim())
    .filter(Boolean)
  return [...new Set(addresses)]
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n\0]+/g, ' ').trim()
}

function sanitizeBody(value: string): string {
  return value.replace(/\0/g, '')
}
