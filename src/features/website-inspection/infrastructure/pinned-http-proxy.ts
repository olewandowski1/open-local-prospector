import { randomBytes } from "node:crypto"
import { createServer, request as requestHttp, type ServerResponse } from "node:http"
import { request as requestHttps } from "node:https"
import { connect, isIP } from "node:net"
import type { Duplex } from "node:stream"

import {
  type ResolveHost,
  resolvePublicHttpUrl,
} from "@/features/website-inspection/domain/network-policy"

const CONNECTION_TIMEOUT_MS = 20_000
const MAX_REQUESTS = 500
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024

export type PinnedHttpProxy = Readonly<{
  playwrightProxy: Readonly<{ server: string; username: string; password: string }>
  close: () => Promise<void>
}>

/**
 * Chromium delegates every outbound connection to this loopback proxy. The proxy resolves and
 * validates the destination, then connects to the selected numeric address instead of asking the
 * operating system to resolve the hostname again. The original hostname remains visible to HTTP
 * and TLS, so ordinary virtual hosting and certificate verification continue to work.
 */
export async function startPinnedHttpProxy(resolveHost: ResolveHost): Promise<PinnedHttpProxy> {
  const username = "prospector"
  const password = randomBytes(24).toString("base64url")
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
  const sockets = new Set<Duplex>()
  let requests = 0
  const server = createServer(async (request, response) => {
    if (!authorized(request.headers["proxy-authorization"], authorization)) {
      rejectProxyAuthentication(response)
      return
    }
    if (++requests > MAX_REQUESTS) {
      response.writeHead(429).end()
      return
    }
    try {
      const target = await resolvePublicHttpUrl(request.url ?? "", resolveHost)
      const address = target.addresses[0]
      if (!address) throw new Error("approved address missing")
      const send = target.url.protocol === "https:" ? requestHttps : requestHttp
      const upstream = send({
        protocol: target.url.protocol,
        hostname: address,
        port: target.url.port || (target.url.protocol === "https:" ? 443 : 80),
        method: request.method,
        path: `${target.url.pathname}${target.url.search}`,
        headers: forwardedHeaders(request.headers, target.url.host),
        agent: false,
        ...(target.url.protocol === "https:" ? { servername: target.url.hostname } : {}),
      })
      upstream.setTimeout(CONNECTION_TIMEOUT_MS, () => upstream.destroy())
      upstream.on("response", (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers)
        pipeBoundedResponse(upstreamResponse, response)
      })
      upstream.on("error", () => respondBadGateway(response))
      request.pipe(upstream)
    } catch {
      respondBadGateway(response)
    }
  })

  server.on("connect", async (request, browserSocket, head) => {
    if (!authorized(request.headers["proxy-authorization"], authorization)) {
      browserSocket.end("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n")
      return
    }
    if (++requests > MAX_REQUESTS) {
      browserSocket.end("HTTP/1.1 429 Too Many Requests\r\n\r\n")
      return
    }
    try {
      const target = await resolvePinnedConnectTarget(request.url ?? "", resolveHost)
      const upstreamSocket = connect({ host: target.address, port: target.port })
      sockets.add(browserSocket)
      sockets.add(upstreamSocket)
      upstreamSocket.setTimeout(CONNECTION_TIMEOUT_MS, () => upstreamSocket.destroy())
      upstreamSocket.once("connect", () => {
        browserSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n")
        if (head.length > 0) upstreamSocket.write(head)
        browserSocket.pipe(upstreamSocket).pipe(browserSocket)
      })
      upstreamSocket.once("error", () => browserSocket.destroy())
      upstreamSocket.once("close", () => sockets.delete(upstreamSocket))
      browserSocket.once("close", () => sockets.delete(browserSocket))
    } catch {
      browserSocket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n")
    }
  })
  server.on("clientError", (_error, socket) => socket.destroy())

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject)
      resolve()
    })
  })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("inspection proxy did not bind")
  return {
    playwrightProxy: { server: `http://127.0.0.1:${address.port}`, username, password },
    close: async () => {
      for (const socket of sockets) socket.destroy()
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}

function authorized(value: string | undefined, expected: string): boolean {
  return value === expected
}

function rejectProxyAuthentication(response: ServerResponse): void {
  response.writeHead(407, { "Proxy-Authenticate": 'Basic realm="Open Prospector"' }).end()
}

function respondBadGateway(response: ServerResponse): void {
  if (!response.headersSent) response.writeHead(502)
  response.end()
}

function forwardedHeaders(
  headers: Readonly<Record<string, string | string[] | undefined>>,
  host: string,
): Record<string, string | string[] | undefined> {
  const forwarded: Record<string, string | string[] | undefined> = { ...headers, host }
  delete forwarded["proxy-authorization"]
  delete forwarded["proxy-connection"]
  return forwarded
}

function connectTarget(authority: string): Readonly<{ host: string; port: number }> {
  const url = new URL(`https://${authority}`)
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error("invalid CONNECT authority")
  const port = Number(url.port || 443)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("invalid CONNECT port")
  return { host: url.hostname.replace(/^\[|\]$/gu, ""), port }
}

export async function resolvePinnedConnectTarget(
  authority: string,
  resolveHost: ResolveHost,
): Promise<Readonly<{ address: string; port: number }>> {
  const target = connectTarget(authority)
  const urlHost = isIP(target.host) === 6 ? `[${target.host}]` : target.host
  const approved = await resolvePublicHttpUrl(`https://${urlHost}:${target.port}`, resolveHost)
  const address = approved.addresses[0]
  if (!address) throw new Error("approved address missing")
  return { address, port: target.port }
}

function pipeBoundedResponse(
  upstream: NodeJS.ReadableStream & { destroy: () => void },
  response: ServerResponse,
): void {
  let bytes = 0
  upstream.on("data", (chunk: Buffer) => {
    bytes += chunk.byteLength
    if (bytes > MAX_RESPONSE_BYTES) {
      upstream.destroy()
      response.destroy()
    }
  })
  upstream.pipe(response)
}
