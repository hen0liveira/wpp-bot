import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import axios from 'axios'

async function sendToN8n(data: any) {
    const n8nWebhookUrl = 'SEU_WEBHOOK_URL_AQUI' 
    try {
        await axios.post(n8nWebhookUrl, data)
        console.log('Dados enviados para n8n com sucesso')
    } catch (error) {
        console.error('Erro ao enviar dados para n8n:', error)
    }
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    })
    
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('conexão fechada devido a ', lastDisconnect?.error, ', reconectando ', shouldReconnect)
            if (shouldReconnect) {
                connectToWhatsApp()
            }
        } else if (connection === 'open') {
            console.log('conexão aberta')
        }
    })
    
    sock.ev.on('creds.update', saveCreds)
    
    sock.ev.on('messages.upsert', async (m) => {
        console.log(JSON.stringify(m, undefined, 2))
        
        const msg = m.messages[0]
        if (!msg.key.fromMe && m.type === 'notify') {
            const sender = msg.key.remoteJid
            const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
            
            const dataToSend = {
                sender,
                messageContent,
                timestamp: new Date().toISOString(),
            }
            
            await sendToN8n(dataToSend)
            
            await sock.sendMessage(sender!, { text: 'Recebi sua mensagem e a processei!' })
        }
    })
}

connectToWhatsApp()