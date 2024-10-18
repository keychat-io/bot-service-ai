import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientMessageDto } from 'src/dto/client_message.dto';
import { NostrEventDto } from 'src/dto/nostr_event.dto';
import { GPTService } from './gpt.service';
import { MessageTypeEnum } from 'src/dto/message_type_enum';
import { QueueService } from './queue.service';
import { ChatInputParams } from 'src/dto/chat_input_params.dto';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { delay } from 'rxjs';
import WS from 'ws';
import axios from 'axios';
import { botPricePerMessageRequest } from '../config/metadata.json';
import { RedisService } from './redis.service';

enum BotSupportCommands {
  HELP = '/h',
  MODELS = '/m',
}

function getBotSupportCommands(): Set<string> {
  return new Set(Object.values(BotSupportCommands));
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(GPTService.name);

  private websocket: ReconnectingWebSocket;

  constructor(
    @Inject(QueueService) private queueService: QueueService,
    @Inject(RedisService) private redisService: RedisService,
  ) {
    if (process.env.BOT_CENTER_SUBSCRIBE == null) {
      throw new Error('process.env.BOT_CENTER_SUBSCRIBE is null');
    }
    this.websocket = new ReconnectingWebSocket(
      process.env.BOT_CENTER_SUBSCRIBE,
      [],
      { WebSocket: WS },
    );
    this.websocket.addEventListener('open', () => {
      this.logger.log(`${process.env.BOT_CENTER_SUBSCRIBE} connected`);
      this.sendHelloMessage();
    });

    this.websocket.addEventListener('message', (data) => {
      this.logger.log(`message: ${data.data}`);
      let ned: NostrEventDto;
      try {
        ned = NostrEventDto.parse(data.data);
        this.proccessMessage(ned);
      } catch (error) {
        this.logger.error(error.message, error.stack);
      } finally {
        if (ned != null && ned.id != null) {
          this.websocket.send(ned.id);
        }
      }
    });
  }

  async sendErrorMessageToClient(bot: string, to: string, message: string) {
    const key = `ErrorMessageCount:${bot} + ${to}`;
    const exist = await this.redisService.getClient().get(key);
    if (exist != null) {
      if (parseInt(exist) > 3) {
        this.logger.error(`Too many error messages ${exist}`);
        return;
      }
      await this.redisService
        .getClient()
        .set(key, parseInt(exist) + 1, 'EX', 60);
    } else {
      await this.redisService.getClient().set(key, 1, 'EX', 60);
    }
    await this.sendMessageToClient(to, `[Error] ${message}`);
  }

  async sendMessageToClient(to: string, message: string) {
    this.logger.log(`sendMessageToClient: ${to} ${message}`);
    try {
      const url = `${process.env.BOT_CENTER_SEND_MESSAGE}/from/${process.env.GPT_BOT_PUBKEY}/to/${to}`;
      const response = await axios.post(url, message);
      this.logger.log(`Message response: ${JSON.stringify(response.data)}`);
    } catch (error) {
      this.logger.error(
        `Failed to send message: ${error.message}`,
        error.stack,
      );
    }
  }

  async receiveEcash(token: string, amount: number) {
    let res: any;
    try {
      res = await axios.post(process.env.BOT_CENTER_RECEIVE_ECASH, token, {
        timeout: 5000,
      });
      this.logger.log(`Payment Received: ${JSON.stringify(res.data)}`);
    } catch (error) {
      if (error.response) {
        let message = error.response.data.error || 'ReceiveFailed';
        if (message.indexOf('operation timed out') > 0) {
          message = 'Receive_Ecash_Timeout';
        }
        throw new Error(`Receive_Ecash_Failed_${message}`);
      } else if (error.request) {
        this.logger.error(error, error.stack);
        throw new Error(`Receive_Ecash_Failed. Try Again later`);
      }
      throw new Error(error.message);
    }

    if (res.data.code == 200 && res.data.data >= amount) {
      return;
    }
    throw new Error(`Payment_Amount_Not_Match_${amount}_SAT`);
  }

  async sendHelloMessage() {
    if (process.env.GPT_BOT_PUBKEY.length === 0) {
      this.logger.error('process.env.GPT_BOT_PUBKEY is empty');
      return;
    }
    await delay(500);
    this.websocket.send(process.env.GPT_BOT_PUBKEY);
  }

  proccessMessage(neo: NostrEventDto) {
    let ccd: ClientMessageDto;
    try {
      ccd = ClientMessageDto.parse(neo.content);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      ccd = new ClientMessageDto().fromJSON({
        type: MessageTypeEnum.botText,
        message: neo.content,
      });
    }
    this.logger.log(`ClientCommandDto: ${JSON.stringify(ccd)}`);
    switch (ccd.type) {
      case MessageTypeEnum.botText:
        return this.proccessText(neo, ccd);
      case MessageTypeEnum.botOneTimePaymentRequest:
        return this.proccessOnetimePaymentResponse(ccd);
      default:
        this.logger.error(`Unknown message type: ${ccd.type}`);
        return this.sendErrorMessageToClient(
          neo.to,
          neo.from,
          'Unknown message type',
        );
    }
  }

  proccessText(neo: NostrEventDto, ccd: ClientMessageDto) {
    if (
      ccd.content.startsWith('/') &&
      getBotSupportCommands().has(ccd.content)
    ) {
      return this.proccessCommand(neo, ccd);
    }
    // start chat job
    this.queueService.addJob({
      eventId: neo.id,
      from: neo.from,
      to: neo.to,
      clientMessageDto: ccd,
    } as ChatInputParams);
    return { code: 200 };
  }

  proccessOnetimePaymentResponse(ccd: ClientMessageDto) {
    console.log(ccd.payToken);
    throw new Error('Method not implemented.');
  }

  async proccessCommand(neo: NostrEventDto, cmd: ClientMessageDto) {
    this.logger.log(`cmd: ${cmd.toJson()} received`);

    switch (cmd.content) {
      case BotSupportCommands.HELP:
        const helpMessage = `I am a chatbot that can help you with your queries. Pay ecash for each message you send.`;
        return this.sendMessageToClient(neo.from, helpMessage);
      case BotSupportCommands.MODELS:
        return this.sendMessageToClient(
          neo.from,
          JSON.stringify(botPricePerMessageRequest),
        );
    }
  }
}
