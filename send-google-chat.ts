import { v4 as uuid } from 'uuid'
import assert from 'node:assert'

export class GoogleChatService {
  public constructor (
    private readonly googleChatWebhook: string,
    private readonly logger: {
      error: (context: any) => void
      log: (context: any) => void
      debug: (context: any) => void
    }
  ) {
    assert(googleChatWebhook, 'Google Chat Webbhook not provided')
    assert(logger, 'Error Logger not provided')
  }

  public async sendIncidentToGoogleChat (error: Error & { serializeToIncidentChat?: () => string }) {
    try {
      const incidentWebhook = this.googleChatWebhook
      const msg = error.stack || 'UNKNOWN'
      const props = (error.serializeToIncidentChat != null) ? error.serializeToIncidentChat() : null

      await this.sendToGoogleChat({ msg, tag: 'stack', props }, incidentWebhook)
    } catch (ex) {
      this.logger.error({ msg: 'Cannot send incident report, unexpected exception' })
    }
  }

  /**
   * Sends asynchronous message into Google Chat
   * @see https://developers.google.com/chat/how-tos/webhooks#node.js
   *
   * @return{boolean} truthy if msg is correctly dispatched
   */
  private async sendToGoogleChat (data: { props: string | null, msg: string, tag: string, msgId?: string, thread?: string }, webhookURL: string): Promise<boolean> {
    const thread = data.thread || process.env.NODE_ENV || 'SVILUPPO'
    const url = `${webhookURL}&threadKey=${thread}`

    const msgId = data.msgId ?? uuid()
    const text = `[${thread}#${msgId}] @ ${new Date().toISOString()}\n\n${data.props ? ('PROPS 📋 ' + data.props + '\n') : ''
      }${data.tag.toUpperCase()} 📋 ${data.msg}`

    const body = JSON.stringify({ text })
    const headers = {
      'Content-Type': 'application/json; charset=UTF-8'
    }

    let error = null
    const response = await fetch(url, { body, headers, method: 'POST' })
      .then(async res => {
        return await res.json()
      })
      .catch(err => {
        error = err
      })

    if (error) {
      this.logger.error({ msg: 'Cannot send msg to google chat', body })
      this.logger.error(error)
      return false
    }

    this.logger.log({ msg: 'Sent msg OK', msgId })
    this.logger.debug({ response, data })
    return true
  }
}
