import { vi } from 'vitest'

export const webhookError = new Error('Webhook test doesnt work properly')
const buildFetchResponse = async (responseBody: any): Promise<{ json: () => any }> => await Promise.resolve({
  json: () => responseBody
})

const FetchModuleMock = vi.fn().mockImplementation((url: string) => {
  console.log({ msg: 'fetch call..', url })
  if (url === 'fetch/health') {
    return buildFetchResponse({ healthy: true })
  }

  if (url.startsWith('webhook.test?resp=ok')) {
    return buildFetchResponse({ ok: true })
  }

  if (url.startsWith('webhook.test?resp=KO')) {
    return Promise.reject(webhookError)
  }
})

vi.stubGlobal('fetch', FetchModuleMock)
