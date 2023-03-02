import { vi, expect, it, beforeEach, afterAll, Mock } from 'vitest'
import incident from './index'
import { webhookError } from '../setup-global-fetch'
interface CustomMatchers<R = unknown> {
  checkBodySent: (nodeEnv: string, error: Error) => R
}

declare global {
  namespace Vi {
    interface Assertion extends CustomMatchers { }
    interface AsymmetricMatchersContaining extends CustomMatchers { }
  }
}
expect.extend({
  checkBodySent: (received, expectedNodeEnv, error) => {
    const { body } = received
    const { text } = JSON.parse(body)
    const serializedProps = error.serializeToIncidentChat ? error.serializeToIncidentChat() : null
    const propsPattern = serializedProps ? `PROPS 📋 ${serializedProps}\n` : ''
    const stackPattern = error.stack ? `STACK 📋 Error: ${error.message}` : 'STACK 📋 UNKNOWN'
    const pattern = `\\[${expectedNodeEnv}#.*\\] @ .*\n\n${propsPattern}${stackPattern}`
    if (!text.match(pattern)) {
      console.error('Pattern doesnt match', { text, pattern })
      return {
        message: () => `expected ${received} to match ${pattern}`,
        pass: false
      }
    }

    return { pass: true, message: () => 'OK' }
  }
})

const { GoogleChatService } = incident

const logger = {
  error: vi.fn(),
  debug: vi.fn(),
  log: vi.fn()
} as any

afterAll(() => {
  vi.restoreAllMocks()
})
beforeEach(() => {
  (fetch as Mock).mockClear()
  logger.error.mockReset()
  logger.debug.mockReset()
  logger.log.mockReset()
})

it('should work with fetch mock', async () => {
  const res = await fetch('fetch/health').then(async r => await r.json())
  expect(res).toStrictEqual({ healthy: true })
})

it('should not throw when send a valid error', () => {
  const chat = new GoogleChatService('webhook.test?resp=ok', logger)
  const error = new Error('Kaboom')

  expect(async () => {
    await chat.sendIncidentToGoogleChat(error)
  }).not.toThrowError()
})

it('should send an error to google chat', async () => {
  const chat = new GoogleChatService('webhook.test?resp=ok', logger)
  class SerializableError extends Error {
    serializeToIncidentChat (): string {
      return 'hey test'
    }
  }
  const error = new SerializableError('ASD')

  await chat.sendIncidentToGoogleChat(error)
  const expectedData = expect.objectContaining({ props: 'hey test', msg: expect.stringContaining('ASD'), tag: 'stack' })
  expect(logger.debug).toHaveBeenCalledWith({ response: { ok: true }, data: expectedData })
  expect(logger.log).toHaveBeenCalledWith({ msg: 'Sent msg OK', msgId: expect.any(String) })
})

it('should throw if missing webhook url', () => {
  // eslint-disable-next-line no-new
  expect(() => { new GoogleChatService(null as any, logger) }).toThrowError()
  // eslint-disable-next-line no-new
  expect(() => { new GoogleChatService(undefined as any, logger) }).toThrowError()
})

it('should throw if missing logger', () => {
  // eslint-disable-next-line no-new
  expect(() => { new GoogleChatService('url', null as any) }).toThrowError()
  // eslint-disable-next-line no-new
  expect(() => { new GoogleChatService('url', undefined as any) }).toThrowError()
})

it('should handle serialization error', () => {
  const chat = new GoogleChatService('webhook.test?resp=ok', logger)
  class UnserializableError extends Error {
    serializeToIncidentChat (): string {
      throw new Error('Cannot serialize Kaboom')
    }
  }
  const error = new UnserializableError('Kaboom')

  expect(async () => await chat.sendIncidentToGoogleChat(error)).not.toThrowError()
  expect(logger.error).toHaveBeenNthCalledWith(1, { msg: 'Cannot send incident report, unexpected exception' })
})

it('should handle basic error', async () => {
  const chat = new GoogleChatService('webhook.test?resp=KO', logger)
  const errorToReport = new Error('test')

  await chat.sendIncidentToGoogleChat(errorToReport)
  expect(logger.error).toHaveBeenNthCalledWith(1, expect.objectContaining({ msg: 'Cannot send msg to google chat' }))
  expect(logger.error).toHaveBeenNthCalledWith(2, webhookError)
})

it('should format basic error', async () => {
  const chat = new GoogleChatService('webhook.test?resp=OK', logger)
  const errorToReport = new Error('testError')

  process.env.NODE_ENV = 'test_thread'
  await chat.sendIncidentToGoogleChat(errorToReport)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('webhook.test?resp=OK&threadKey=test_thread', expect.checkBodySent('test_thread', errorToReport))
})

it('should format extended error', async () => {
  const chat = new GoogleChatService('webhook.test?resp=OK', logger)
  class SerializableError extends Error {
    serializeToIncidentChat (): string {
      return 'hey error ' + this.message
    }
  }
  const serializableError = new SerializableError('kabooom')

  process.env.NODE_ENV = 'test_thread'
  await chat.sendIncidentToGoogleChat(serializableError)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('webhook.test?resp=OK&threadKey=test_thread', expect.checkBodySent('test_thread', serializableError))
})

it('should format unknown stack error', async () => {
  const chat = new GoogleChatService('webhook.test?resp=OK', logger)
  class ErrorWithoutStack extends Error {
    constructor (msg: string) {
      super(msg)
      this.stack = undefined
    }
  }
  const serializableError = new ErrorWithoutStack('crap')

  process.env.NODE_ENV = 'production'
  await chat.sendIncidentToGoogleChat(serializableError)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('webhook.test?resp=OK&threadKey=production', expect.checkBodySent('production', serializableError))
})
