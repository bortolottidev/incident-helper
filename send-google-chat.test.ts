import { vi, expect, it, beforeEach, afterAll } from 'vitest'
import { GoogleChatService } from './send-google-chat'
import { webhookError } from './setup-global-fetch'

const logger = {
  error: vi.fn(),
  debug: vi.fn(),
  log: vi.fn()
} as any

afterAll(() => {
  vi.restoreAllMocks()
})
beforeEach(() => {
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
  expect(() => { new GoogleChatService(null as any, logger) }).toThrowError()
  expect(() => { new GoogleChatService(undefined as any, logger) }).toThrowError()
})

it('should throw if missing logger', () => {
  expect(() => { new GoogleChatService('url', null as any) }).toThrowError()
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

it('should handle webhook error', async () => {
  const chat = new GoogleChatService('webhook.test?resp=KO', logger)
  const errorToReport = new Error('test')

  await chat.sendIncidentToGoogleChat(errorToReport)
  expect(logger.error).toHaveBeenNthCalledWith(1, expect.objectContaining({ msg: 'Cannot send msg to google chat' }))
  expect(logger.error).toHaveBeenNthCalledWith(2, webhookError)
})
