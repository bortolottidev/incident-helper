import { GoogleChatService } from '../send-google-chat'

const googleChatWebhook = process.env.WEBHOOK
if (googleChatWebhook === undefined) {
  console.error({ msg: 'WEBHOOK NOT SETUP PROPERLY' })
  process.exit(222)
}
const chatService = new GoogleChatService(googleChatWebhook, console)

const error = new Error('Very basic error')

const runTest = async (): Promise<void> => {
  await chatService.sendIncidentToGoogleChat(error)
}

runTest().then(() => process.exit(0)).catch(() => process.exit(1))
