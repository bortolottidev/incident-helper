import { GoogleChatService } from '../src/send-google-chat'

const googleChatWebhook = process.env.WEBHOOK
if (googleChatWebhook === undefined) {
  console.error({ msg: 'WEBHOOK NOT SETUP PROPERLY' })
  process.exit(222)
}
const chatService = new GoogleChatService(googleChatWebhook, console)

const error = new Error('Very basic error')

class ExtededError extends Error {
  serializeToIncidentChat (): string {
    return `Custom error => ${this.message}`
  }
}

const extendedError = new ExtededError('An exteded Error')

const runTest = async (): Promise<void> => {
  await chatService.sendIncidentToGoogleChat(error)
  await chatService.sendIncidentToGoogleChat(extendedError)
}

runTest().then(() => process.exit(0)).catch(() => process.exit(1))
