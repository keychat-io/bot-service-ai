# Keychat Chat Bot Service

## Description

* Handle `/*` message. like: `/h` 
* Receive any text from client app, and send response
* Perform charging operations, receive ecash token

## Diagram

```mermaid
sequenceDiagram
    BotService->>+BotService: Launch
    BotCenter->>+BotCenter: setup params: name, prices, description...
    BotService-->>+Relay: update metadata
    BotCenter-->>Relay: listen pubkey
    User -->> Relay: fetch metadata
    User -->> User: Dialog to confirm charge info
    User -) Relay: send encrypted message
    Relay-->>+BotCenter: fetch message
    BotCenter-->>+BotCenter: decrypt message
    BotService-->>+BotCenter: receive ecash token
    BotCenter-)BotService: push decryptedMessage to BotService
    BotService-->>+BotCenter: Send message
    BotCenter-->>Relay: encrypt message and send
    Relay-)User: fetch message
  ```

## Project setup
[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## bot-center
 **Deploy `bot-center` project first**

[https://github.com/keychat-io/bot-center](https://github.com/keychat-io/bot-center)
### Features
1. Connect to relay, receive and send messages
2. Maintain an ecash wallet and provide payment API

## a. Set the Bot Metadata
Once set success, the keychat app will recognize this account as a bot.

Command: `ts-node src/config/update-metadata.ts`

or

```
curl -X POST -H 'Content-type: application/json' --data '{"name":"ChatGPT","type":"Chatbot","description":"I am an AI-powered assistant designed to help answer a variety of questions and provide information.I can assist you in acquiring knowledge, explaining concepts, offering advice, and even help with simple calculations or translations.","commands":[{"name":"/h","description":"Show help message"},{"name":"/m","description":"Which model do you prefer, GPT-4o or 4o-mini?"}],"botPricePerMessageRequest":{"type":"botPricePerMessageRequest","message":"I am an AI-powered assistant designed to help answer a variety of questions and provide information. I can assist you in acquiring knowledge, explaining concepts, offering advice, and even help with simple calculations or translations.\n\nYou need to pay in ecash for each message sent. Please select a model to start chat","priceModels":[{"name":"GPT-4o-mini","description":"","price":1,"unit":"sat","mints":[]},{"name":"GPT-4o","description":"","price":4,"unit":"sat","mints":[]},{"name":"GPT-4-Turbo","description":"","price":8,"unit":"sat","mints":[]}]}}' http://0.0.0.0:5001/metadata/2714ef65b4f14c5c74b1d817eefcc1a994835de3034bfd2d5e2d3e8abbbadf32
```
Success
```json
{"code":200,"error":null,"data":"4433dec54c89fcc97d28049ffdc1b88ca5a61a1be5a4890719615bf4ebdf50f6"}
```

## Chat with your bot
1. Send message to bot use keychat app
2. BotCenter will receive your message and decrypt it.
3. BotCenter will call your service with user's data
```json
{
  "id": "id1234",
  "from": "from1253",
  "to": "to123",
  "content": "content123",
  "decryptedDontent": "{\"type\":\"botText\",\"content\":\"Hi, I am keychat.\"}",
  "createAt": 1234567,
  "sig": "sig123"
}
```
4. BotService decode `decryptedDontent`
5. Make response: send a message to user 

### Message Struct 

Client
```
{
  type: MessageTypeEnum;
  message: string;
  id?: string;
  payToken?: string;
  priceModel?: string;
}
```

Server
```
{
  type: MessageTypeEnum;
  id: string;
  description: string;
  data: string;
  list: BotMessageData[];
}
```

BotMessageData
```
{
  name: string;  // price model id
  description: string;
  price: number;
  unit: string;
  mints: string[];
}
```

MessageTypeEnum 
```
{
  botText,
  botPricePerMessageRequest, 
  botOneTimePaymentRequest,  
}
```

### Client Commands
1. Client Message:
`{"type":"botText","message":"/h"}`

BotServer: send help message to user.
Server Response: `you can ask me any questions`

2. Client Message: `{"type":"botText","message":"/m"}`
BotServer: send all charge models to user. 

```
{
  "type": "botPricePerMessageRequest",
  "id": "SelectPriceModel",
  "message": "Please select a model to chat",
  "priceModels": [
    {
      "name": "gpt-3.5-turbo",
      "description": "",
      "price": 0,
      "unit": "sat",
      "mints": []
    },
    {
      "name": "gpt-4o-mini",
      "description": "",
      "price": 2,
      "unit": "sat",
      "mints": []
    }
  ]
}
```
If the user sets the charging configuration, a cashu Token will be attached to each message.

Example, If select `gpt-4o-mini` and  send `Who are your?` to bot.
Client's send message like this:

```json
{"type":"botText","message":"Who are your?","priceModel":"gpt-4o-mini","payToken":"cashuBo2Ftd2h0dHBzOi8vODMzMy5zcGFjZTozMzM4YXVjc2F0YXSBomFpSAB1nj-LBrNvYXCBo2FhAmFzeEBhODljMjk0ZTBjMDhkMzQ0YTljZmRhZDgzMzFmNDI5ZDRiZWE0ZDJkYjA0NzBiMjExZDM5MDY1MWRhZDAwOWZkYWNYIQKGsB8Zx6ABj3Z02asmKR9HFDySfVHgP_UDhnSPMvWquw"}
```

bot server will recive `payToken`, and make response to user.


## Local Http API Test
1. Set FREE=true in `.env` file to skip ecash verify
2. Curl the api in local development environment
```
 curl -X POST -H 'Content-type: application/json' --data '{"id":"41966824fd221d6aec4af7f75a9473a1486aa33e23e5794b400693597b66e9d","from":"0b464234a9a1819dcf9498244d845daa6bc176c30480e79e3b8cb69b1d69f121","to":"c095a79edcc5d87740063dbd53d18e0cf98ee2129a7509b0883492cca42a517e","ts":1729219617000,"kind":4,"content":"{\"type\":\"botText\",\"message\":\"Who are your?\",\"priceModel\":\"cashuBo2Ftd2h0dHBzOi8vODMzMy5zcGFjZTozMzM4YXVjc2F0YXSBomFpSAB1nj-LBrNvYXCBo2FhAWFzeEBiN2Nk2NDk5OTBhZTZjYTllYzYwMmQwNDk1NGM2ZjZmOTBiMmMwNWMzMDMyNWVlNDZmNjU0MmZhZGRhZWFjNGZiYWNYIQOdOWhtZ18AAwDRnImNah9D4P8uDw6Vp1lagRoEqFGPqQ\"}"}' http://127.0.0.1:3000/chat
```