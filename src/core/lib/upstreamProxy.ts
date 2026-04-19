import axios, { type AxiosRequestConfig } from "axios";
import { env } from "../runtime";

type ParsedProxy = {
  protocol: "http";
  host: string;
  port: number;
  username?: string;
  password?: string;
};

type ProxiedFetchInit = RequestInit & {
  proxy?: string;
};

function parseProxyFromUrl(proxyUrl: string): ParsedProxy | null {
  try {
    const parsed = new URL(proxyUrl);
    if (!parsed.hostname || !parsed.port) return null;

    return {
      protocol: "http",
      host: parsed.hostname,
      port: Number(parsed.port),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
    };
  } catch {
    return null;
  }
}

function parseProxyLine(proxyLine: string): ParsedProxy | null {
  const [host, portRaw, username, password] = proxyLine.split(":");
  const port = Number(portRaw);

  if (!host || !portRaw || Number.isNaN(port)) {
    return null;
  }

  return {
    protocol: "http",
    host,
    port,
    username: username || undefined,
    password: password || undefined,
  };
}

function getConfiguredProxy(): ParsedProxy | null {
  const proxyUrl = env.WEBSHARE_PROXY_URL || env.UPSTREAM_PROXY_URL;
  if (proxyUrl) {
    return parseProxyFromUrl(proxyUrl);
  }

  const proxyLine = env.WEBSHARE_PROXY || env.UPSTREAM_PROXY;
  if (proxyLine) {
    return parseProxyLine(proxyLine);
  }

  return null;
}

export function getUpstreamProxyUrl(): string | undefined {
  const proxy = getConfiguredProxy();
  if (!proxy) return undefined;

  const auth =
    proxy.username && proxy.password
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
      : "";

  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
}

export function withUpstreamProxy(init: RequestInit = {}): ProxiedFetchInit {
  const proxyUrl = getUpstreamProxyUrl();
  if (!proxyUrl) {
    return init;
  }

  return {
    ...init,
    proxy: proxyUrl,
  };
}

export function getAxiosProxyConfig(): Pick<AxiosRequestConfig, "proxy"> {
  const proxy = getConfiguredProxy();
  if (!proxy) {
    return { proxy: undefined };
  }

  return {
    proxy: {
      protocol: proxy.protocol,
      host: proxy.host,
      port: proxy.port,
      auth:
        proxy.username && proxy.password
          ? {
              username: proxy.username,
              password: proxy.password,
            }
          : undefined,
    },
  };
}

export function createProxiedAxios(config: AxiosRequestConfig = {}) {
  return axios.create({
    ...getAxiosProxyConfig(),
    ...config,
  });
}
