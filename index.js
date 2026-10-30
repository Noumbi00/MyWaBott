import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import pino from 'pino'
import { PREFIX, OWNERS, FOOTER, loadSettings } from './config.js'
import { commands } from './commands.js'
import { num } from './utils.js'

const settings = loadSettings()

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true })
    if (connection === 'open') console.log('✅ Bot connecté')
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) startBot()
      else console.log('Déconnecté. Supprime le dossier "session" et relance.')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    if (!msg?.message) return

    const text =
      msg.message.conversation || msg.message.extendedTextMessage?.text || ''
    if (!text.startsWith(PREFIX)) return

    const [name, ...args] = text.slice(PREFIX.length).trim().split(/\s+/)
    const command = commands[name.toLowerCase()]
    if (!command) return

    // Qui a envoyé le message ?
    const { key } = msg
    const jid = key.remoteJid
    const isGroup = jid.endsWith('@g.us')
    const senderIds = key.fromMe
      ? [sock.user?.id, sock.user?.lid]
      : isGroup
        ? [key.participant, key.participantAlt]
        : [key.remoteJid, key.remoteJidAlt]
    const isOwner = key.fromMe || senderIds.some((id) => OWNERS.includes(num(id)))

    console.log(`Commande ${PREFIX}${name} de`, senderIds.filter(Boolean).map(num))

    // Mode privé : seul le propriétaire peut utiliser le bot
    if (settings.mode === 'private' && !isOwner) return

    const withFooter = (t) => `${t}\n\n${FOOTER}`

    const reply = (t, mentions = []) =>
      sock.sendMessage(jid, { text: withFooter(t), mentions }, { quoted: msg })

    // Envoie une image avec un texte en légende (texte seul si l'image échoue)
    const replyImage = async (url, caption) => {
      try {
        await sock.sendMessage(
          jid,
          { image: { url }, caption: withFooter(caption) },
          { quoted: msg }
        )
      } catch (err) {
        console.error('Image impossible :', err.message)
        await reply(caption)
      }
    }

    try {
      await command.run({ sock, msg, jid, args, isGroup, isOwner, senderIds, reply, replyImage, settings })
    } catch (err) {
      console.error(err)
      await reply('❌ Une erreur est survenue.')
    }
  })
}

startBot()
