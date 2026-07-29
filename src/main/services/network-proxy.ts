import { Buffer } from 'node:buffer'
import { Socket, connect as connectTcp, isIP } from 'node:net'
import { TLSSocket, connect as connectTls } from 'node:tls'
import { session } from 'electron'
import type { AccountProxyMode, ProxyMode } from '../../shared/types'
import { parseCustomProxyUrl } from '../../shared/proxy-url'
import { getSettings } from '../db/repositories/settings.repository'

type ProxyAccount = {
  proxyMode?: AccountProxyMode
  customProxyUrl?: string
}

type ProxyTarget = { host: string; port: number }
type ProxyDescriptor =
  | { mode: 'direct' }
  | { mode: 'socks4'; url: URL }
  | { mode: 'socks5'; url: URL }
  | { mode: 'http'; url: URL }

const CONNECTION_TIMEOUT_MS = 15000

export async function connectMailSocket(
  account: ProxyAccount,
  host: string,
  port: number,
  secure: boolean
): Promise<Socket | TLSSocket> {
  return connectWithProxyFallback(account, { host, port }, secure)
}

export async function connectMailTunnel(
  account: ProxyAccount,
  host: string,
  port: number
): Promise<Socket> {
  return connectWithProxyFallback(account, { host, port }, false)
}

export function validateCustomProxyUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined
  const url = parseCustomProxyUrl(value)
  if (!url) {
    throw new Error(
      '自定义代理必须是有效的 http://、https://、socks4://、socks4a://、socks5:// 或 socks5h:// 地址。'
    )
  }
  return url.toString()
}

async function connectWithProxyFallback(
  account: ProxyAccount,
  target: ProxyTarget,
  secure: boolean
): Promise<Socket | TLSSocket> {
  const descriptors = await resolveProxyDescriptors(account, target)
  let lastError: unknown

  for (const descriptor of descriptors) {
    try {
      if (descriptor.mode === 'direct') {
        return secure
          ? await connectDirectTls(target.host, target.port)
          : await connectDirectTcp(target.host, target.port)
      }

      const tunnel = await connectProxyTunnel(descriptor, target)
      return secure ? await upgradeTunnelToTls(tunnel, target.host) : tunnel
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('无法连接邮件服务器或代理。')
}

function connectProxyTunnel(
  descriptor: Exclude<ProxyDescriptor, { mode: 'direct' }>,
  target: ProxyTarget
): Promise<Socket> {
  if (descriptor.mode === 'socks4') return connectSocks4(descriptor.url, target)
  if (descriptor.mode === 'socks5') return connectSocks5(descriptor.url, target)
  return connectHttpProxy(descriptor.url, target)
}

async function resolveProxyDescriptors(
  account: ProxyAccount,
  target: ProxyTarget
): Promise<ProxyDescriptor[]> {
  const settings = getSettings()
  const accountMode = account.proxyMode ?? 'global'
  const mode: ProxyMode = accountMode === 'global' ? settings.globalProxyMode : accountMode
  const customUrl = accountMode === 'global' ? settings.globalProxyUrl : account.customProxyUrl

  if (mode === 'none') return [{ mode: 'direct' }]
  if (mode === 'custom') {
    const value = validateCustomProxyUrl(customUrl)
    if (!value) throw new Error('尚未配置自定义代理地址。')
    return [descriptorFromUrl(new URL(value))]
  }

  const rules = await session.defaultSession.resolveProxy(`https://${target.host}:${target.port}`)
  return parseSystemProxyRules(rules)
}

function parseSystemProxyRules(value: string): ProxyDescriptor[] {
  const descriptors: ProxyDescriptor[] = []
  for (const rawRule of value.split(';')) {
    const [kind = '', address = ''] = rawRule.trim().split(/\s+/, 2)
    const normalizedKind = kind.toUpperCase()
    if (!normalizedKind) continue
    if (normalizedKind === 'DIRECT') {
      descriptors.push({ mode: 'direct' })
      continue
    }
    if (normalizedKind === 'SOCKS4') {
      descriptors.push({ mode: 'socks4', url: new URL(`socks4://${address}`) })
      continue
    }
    if (normalizedKind === 'SOCKS5' || normalizedKind === 'SOCKS') {
      descriptors.push({ mode: 'socks5', url: new URL(`socks5://${address}`) })
      continue
    }
    if (['PROXY', 'HTTP', 'HTTPS'].includes(normalizedKind)) {
      const protocol = normalizedKind === 'HTTPS' ? 'https' : 'http'
      descriptors.push({ mode: 'http', url: new URL(`${protocol}://${address}`) })
    }
  }
  return descriptors.length > 0 ? descriptors : [{ mode: 'direct' }]
}

function descriptorFromUrl(url: URL): Exclude<ProxyDescriptor, { mode: 'direct' }> {
  if (url.protocol === 'socks4:' || url.protocol === 'socks4a:') {
    return { mode: 'socks4', url }
  }
  if (url.protocol === 'socks5:' || url.protocol === 'socks5h:') {
    return { mode: 'socks5', url }
  }
  return { mode: 'http', url }
}

async function connectDirectTcp(host: string, port: number): Promise<Socket> {
  const socket = connectTcp({ host, port })
  keepSocketErrorsHandled(socket)
  try {
    await waitForSocket(socket, 'connect')
    return socket
  } catch (error) {
    socket.destroy()
    throw error
  }
}

async function connectDirectTls(host: string, port: number): Promise<TLSSocket> {
  const socket = connectTls({ host, port, servername: host, rejectUnauthorized: true })
  keepSocketErrorsHandled(socket)
  try {
    await waitForSocket(socket, 'secureConnect')
    return socket
  } catch (error) {
    socket.destroy()
    throw error
  }
}

async function upgradeTunnelToTls(socket: Socket, servername: string): Promise<TLSSocket> {
  const tlsSocket = connectTls({ socket, servername, rejectUnauthorized: true })
  keepSocketErrorsHandled(tlsSocket)
  try {
    await waitForSocket(tlsSocket, 'secureConnect')
    return tlsSocket
  } catch (error) {
    tlsSocket.destroy()
    throw error
  }
}

async function connectSocks5(proxy: URL, target: ProxyTarget): Promise<Socket> {
  const socket = await connectDirectTcp(proxy.hostname, getProxyPort(proxy))
  try {
    const username = decodeURIComponent(proxy.username)
    const password = decodeURIComponent(proxy.password)
    socket.write(Buffer.from([0x05, 0x01, username ? 0x02 : 0x00]))
    const greeting = await readExactly(socket, 2)
    if (greeting[0] !== 0x05 || greeting[1] === 0xff) throw new Error('SOCKS5 代理拒绝认证方式。')

    if (greeting[1] === 0x02) {
      const user = Buffer.from(username, 'utf8')
      const pass = Buffer.from(password, 'utf8')
      if (user.length > 255 || pass.length > 255) throw new Error('SOCKS5 用户名或密码过长。')
      socket.write(
        Buffer.concat([Buffer.from([0x01, user.length]), user, Buffer.from([pass.length]), pass])
      )
      const auth = await readExactly(socket, 2)
      if (auth[1] !== 0x00) throw new Error('SOCKS5 代理认证失败。')
    }

    const domain = Buffer.from(target.host, 'utf8')
    if (domain.length > 255) throw new Error('目标服务器名称过长。')
    socket.write(
      Buffer.concat([
        Buffer.from([0x05, 0x01, 0x00, 0x03, domain.length]),
        domain,
        Buffer.from([(target.port >> 8) & 0xff, target.port & 0xff])
      ])
    )
    const response = await readExactly(socket, 4)
    if (response[0] !== 0x05 || response[1] !== 0x00) {
      throw new Error(`SOCKS5 代理连接目标服务器失败（代码 ${response[1]}）。`)
    }
    if (![0x01, 0x03, 0x04].includes(response[3])) {
      throw new Error('SOCKS5 代理返回了不支持的地址类型。')
    }
    const addressLength =
      response[3] === 0x01 ? 4 : response[3] === 0x04 ? 16 : (await readExactly(socket, 1))[0]
    await readExactly(socket, addressLength + 2)
    return socket
  } catch (error) {
    socket.destroy()
    throw error
  }
}

async function connectSocks4(proxy: URL, target: ProxyTarget): Promise<Socket> {
  const socket = await connectDirectTcp(proxy.hostname, getProxyPort(proxy))
  try {
    const userId = Buffer.from(decodeURIComponent(proxy.username), 'utf8')
    const targetAddress = isIP(target.host) === 4 ? parseIpv4(target.host) : undefined
    if (!targetAddress && proxy.protocol === 'socks4:') {
      throw new Error('SOCKS4 代理仅支持 IPv4 目标；域名目标请使用 socks4a://。')
    }

    const port = Buffer.from([(target.port >> 8) & 0xff, target.port & 0xff])
    const request = targetAddress
      ? Buffer.concat([Buffer.from([0x04, 0x01]), port, targetAddress, userId, Buffer.from([0x00])])
      : Buffer.concat([
          Buffer.from([0x04, 0x01]),
          port,
          Buffer.from([0x00, 0x00, 0x00, 0x01]),
          userId,
          Buffer.from([0x00]),
          Buffer.from(target.host, 'utf8'),
          Buffer.from([0x00])
        ])
    socket.write(request)
    const response = await readExactly(socket, 8)
    if (response[1] !== 0x5a) {
      throw new Error(`SOCKS4 代理连接目标服务器失败（代码 ${response[1]}）。`)
    }
    return socket
  } catch (error) {
    socket.destroy()
    throw error
  }
}

async function connectHttpProxy(proxy: URL, target: ProxyTarget): Promise<Socket> {
  const socket =
    proxy.protocol === 'https:'
      ? await connectDirectTls(proxy.hostname, getProxyPort(proxy))
      : await connectDirectTcp(proxy.hostname, getProxyPort(proxy))
  try {
    const authority = `${target.host}:${target.port}`
    const headers = [
      `CONNECT ${authority} HTTP/1.1`,
      `Host: ${authority}`,
      'Proxy-Connection: Keep-Alive'
    ]
    if (proxy.username) {
      const auth = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`
      headers.push(`Proxy-Authorization: Basic ${Buffer.from(auth).toString('base64')}`)
    }
    socket.write(`${headers.join('\r\n')}\r\n\r\n`)
    const response = await readUntil(socket, Buffer.from('\r\n\r\n'))
    if (/^HTTP\/1\.[01] 2\d\d\b/i.test(response.toString('latin1'))) return socket

    socket.destroy()
    throw new Error('系统 HTTP 代理拒绝连接邮件服务器。')
  } catch (error) {
    socket.destroy()
    throw error
  }
}

function getProxyPort(proxy: URL): number {
  const fallback = proxy.protocol === 'http:' ? 80 : proxy.protocol === 'https:' ? 443 : 1080
  const port = Number(proxy.port || fallback)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('代理端口无效。')
  }
  return port
}

function parseIpv4(address: string): Buffer {
  return Buffer.from(address.split('.').map(Number))
}

function keepSocketErrorsHandled(socket: Socket | TLSSocket): void {
  socket.on('error', () => undefined)
}

function waitForSocket(
  socket: Socket | TLSSocket,
  event: 'connect' | 'secureConnect'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => finish(new Error('连接邮件服务器或代理超时。')),
      CONNECTION_TIMEOUT_MS
    )
    const onReady = (): void => finish()
    const onError = (error: Error): void => finish(error)
    function finish(error?: Error): void {
      clearTimeout(timeout)
      socket.off(event, onReady)
      socket.off('error', onError)
      if (error) reject(error)
      else resolve()
    }
    socket.once(event, onReady)
    socket.once('error', onError)
  })
}

function readExactly(socket: Socket, size: number): Promise<Buffer> {
  return readSocket(socket, (buffer) => (buffer.length >= size ? size : 0))
}

function readUntil(socket: Socket, marker: Buffer): Promise<Buffer> {
  return readSocket(socket, (buffer) => {
    const index = buffer.indexOf(marker)
    return index >= 0 ? index + marker.length : 0
  })
}

function readSocket(socket: Socket, getSize: (buffer: Buffer) => number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0)
    const timeout = setTimeout(
      () => finish(new Error('代理服务器响应超时。')),
      CONNECTION_TIMEOUT_MS
    )
    const onData = (chunk: Buffer): void => {
      buffer = Buffer.concat([buffer, chunk])
      const size = getSize(buffer)
      if (size > 0) finish(undefined, buffer.subarray(0, size), buffer.subarray(size))
    }
    const onError = (error: Error): void => finish(error)
    const onClose = (): void => finish(new Error('代理连接已断开。'))
    function finish(error?: Error, value?: Buffer, remainder?: Buffer): void {
      clearTimeout(timeout)
      socket.off('data', onData)
      socket.off('error', onError)
      socket.off('close', onClose)
      if (remainder?.length) socket.unshift(remainder)
      if (error) reject(error)
      else resolve(value ?? Buffer.alloc(0))
    }
    socket.on('data', onData)
    socket.once('error', onError)
    socket.once('close', onClose)
  })
}
