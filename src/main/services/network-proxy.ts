import { Buffer } from 'node:buffer'
import { Socket, connect as connectTcp } from 'node:net'
import { TLSSocket, connect as connectTls } from 'node:tls'
import { session } from 'electron'
import type { AccountProxyMode, ProxyMode } from '../../shared/types'
import { getSettings } from '../db/repositories/settings.repository'

type ProxyAccount = {
  proxyMode?: AccountProxyMode
  customProxyUrl?: string
}

type ProxyTarget = { host: string; port: number }
type ProxyDescriptor =
  | { mode: 'direct' }
  | { mode: 'socks5'; url: URL }
  | { mode: 'http'; host: string; port: number; auth?: string }

const CONNECTION_TIMEOUT_MS = 15000

export async function connectMailSocket(
  account: ProxyAccount,
  host: string,
  port: number,
  secure: boolean
): Promise<Socket | TLSSocket> {
  const descriptor = await resolveProxyDescriptor(account, { host, port })
  if (descriptor.mode === 'direct') {
    return secure ? connectDirectTls(host, port) : connectDirectTcp(host, port)
  }

  const tunnel =
    descriptor.mode === 'socks5'
      ? await connectSocks5(descriptor.url, { host, port })
      : await connectHttpProxy(descriptor, { host, port })
  if (!secure) return tunnel
  return upgradeTunnelToTls(tunnel, host)
}

export async function connectMailTunnel(
  account: ProxyAccount,
  host: string,
  port: number
): Promise<Socket> {
  const descriptor = await resolveProxyDescriptor(account, { host, port })
  if (descriptor.mode === 'direct') return connectDirectTcp(host, port)
  return descriptor.mode === 'socks5'
    ? connectSocks5(descriptor.url, { host, port })
    : connectHttpProxy(descriptor, { host, port })
}

export function validateSocks5ProxyUrl(value?: string): string | undefined {
  const text = value?.trim()
  if (!text) return undefined
  const url = new URL(text)
  if (url.protocol !== 'socks5:' || !url.hostname || !url.port) {
    throw new Error('自定义代理必须是 socks5://主机:端口 格式。')
  }
  const port = Number(url.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SOCKS5 代理端口无效。')
  }
  return url.toString()
}

async function resolveProxyDescriptor(
  account: ProxyAccount,
  target: ProxyTarget
): Promise<ProxyDescriptor> {
  const settings = getSettings()
  const accountMode = account.proxyMode ?? 'global'
  const mode: ProxyMode = accountMode === 'global' ? settings.globalProxyMode : accountMode
  const customUrl = accountMode === 'global' ? settings.globalProxyUrl : account.customProxyUrl

  if (mode === 'none') return { mode: 'direct' }
  if (mode === 'custom') {
    const value = validateSocks5ProxyUrl(customUrl)
    if (!value) throw new Error('尚未配置 SOCKS5 代理地址。')
    return { mode: 'socks5', url: new URL(value) }
  }

  const rules = await session.defaultSession.resolveProxy(`https://${target.host}:${target.port}`)
  return parseSystemProxyRule(rules)
}

function parseSystemProxyRule(value: string): ProxyDescriptor {
  for (const rawRule of value.split(';')) {
    const [kind = '', address = ''] = rawRule.trim().split(/\s+/, 2)
    const normalizedKind = kind.toUpperCase()
    if (!normalizedKind || normalizedKind === 'DIRECT') return { mode: 'direct' }
    if (normalizedKind === 'SOCKS5' || normalizedKind === 'SOCKS') {
      return { mode: 'socks5', url: new URL(`socks5://${address}`) }
    }
    if (['PROXY', 'HTTP', 'HTTPS'].includes(normalizedKind)) {
      const { host, port } = parseHostPort(address)
      return { mode: 'http', host, port }
    }
  }
  return { mode: 'direct' }
}

function parseHostPort(value: string): ProxyTarget {
  const url = new URL(`http://${value}`)
  const port = Number(url.port || 80)
  if (!url.hostname || !Number.isInteger(port)) throw new Error('系统代理地址无效。')
  return { host: url.hostname, port }
}

async function connectDirectTcp(host: string, port: number): Promise<Socket> {
  const socket = connectTcp({ host, port })
  await waitForSocket(socket, 'connect')
  return socket
}

async function connectDirectTls(host: string, port: number): Promise<TLSSocket> {
  const socket = connectTls({ host, port, servername: host, rejectUnauthorized: true })
  await waitForSocket(socket, 'secureConnect')
  return socket
}

async function upgradeTunnelToTls(socket: Socket, servername: string): Promise<TLSSocket> {
  const tlsSocket = connectTls({ socket, servername, rejectUnauthorized: true })
  await waitForSocket(tlsSocket, 'secureConnect')
  return tlsSocket
}

async function connectSocks5(proxy: URL, target: ProxyTarget): Promise<Socket> {
  const socket = await connectDirectTcp(proxy.hostname, Number(proxy.port))
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

async function connectHttpProxy(
  proxy: Extract<ProxyDescriptor, { mode: 'http' }>,
  target: ProxyTarget
): Promise<Socket> {
  const socket = await connectDirectTcp(proxy.host, proxy.port)
  const authority = `${target.host}:${target.port}`
  const headers = [
    `CONNECT ${authority} HTTP/1.1`,
    `Host: ${authority}`,
    'Proxy-Connection: Keep-Alive'
  ]
  if (proxy.auth)
    headers.push(`Proxy-Authorization: Basic ${Buffer.from(proxy.auth).toString('base64')}`)
  socket.write(`${headers.join('\r\n')}\r\n\r\n`)
  const response = await readUntil(socket, Buffer.from('\r\n\r\n'))
  if (!/^HTTP\/1\.[01] 2\d\d\b/i.test(response.toString('latin1'))) {
    socket.destroy()
    throw new Error('系统 HTTP 代理拒绝连接邮件服务器。')
  }
  return socket
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
