import { PREFIX, BOT_NAME, OWNER_NAME, VERSION, MENU_IMAGE, saveSettings } from './config.js'
import { num, findParticipant, isAdmin, small, formatDuration } from './utils.js'

const startTime = Date.now()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Vérifications communes aux commandes de groupe.
// Renvoie les infos du groupe, ou null (après avoir répondu) si une condition échoue.
async function groupContext({ sock, jid, isGroup, senderIds, reply }) {
  if (!isGroup) {
    await reply('⚠️ Cette commande fonctionne uniquement dans un groupe.')
    return null
  }
  const meta = await sock.groupMetadata(jid)
  const me = findParticipant(meta, [sock.user?.id, sock.user?.lid])
  const sender = findParticipant(meta, senderIds)
  if (!isAdmin(sender)) {
    await reply('⛔ Réservé aux admins du groupe.')
    return null
  }
  if (!isAdmin(me)) {
    await reply('⚠️ Je dois être admin du groupe pour faire ça.')
    return null
  }
  return { meta, me, sender }
}

// Cibles d'une commande : membres mentionnés, ou auteur du message cité
function getTargets(msg) {
  const ctx = msg.message.extendedTextMessage?.contextInfo
  const targets = [...(ctx?.mentionedJid || [])]
  if (!targets.length && ctx?.participant) targets.push(ctx.participant)
  return targets
}

async function changeRole(ctx, action, verbe) {
  const g = await groupContext(ctx)
  if (!g) return
  const ids = getTargets(ctx.msg)
    .map((t) => findParticipant(g.meta, [t]))
    .filter(Boolean)
    .map((p) => p.id)
  if (!ids.length) {
    return ctx.reply(`Utilisation : ${PREFIX}${verbe} @membre (ou réponds à son message)`)
  }
  await ctx.sock.groupParticipantsUpdate(ctx.jid, ids, action)
  await ctx.reply('✅ Fait.')
}


const CATEGORIES = {
  'Général': ['menu', 'ping', 'hello','mode'],
  'Groupe': ['kick', 'kickall', 'promote', 'demote', 'tagall', 'groupinfo'],
  
}

function buildMenu(settings) {
  // Les commandes non classées vont dans "Autres"
  const listed = Object.values(CATEGORIES).flat()
  const others = Object.keys(commands).filter((n) => !listed.includes(n))
  const cats = others.length ? { ...CATEGORIES, Autres: others } : CATEGORIES

  const header = [
    '┏━━━━━━━━━━━━━━━━━⬣',
    `┃  ✦ *${BOT_NAME}* ✦`,
    `┃  ${small('VERSION')} · ${VERSION}`,
    '┣━━━━━━━━━━━━━━━━━⬣',
    `┃ ◈ ${small('owner')} ➜ ${OWNER_NAME}`,
    `┃ ◈ ${small('mode')} ➜ ${settings.mode}`,
    `┃ ◈ ${small('prefix')} ➜ ${PREFIX}`,
    `┃ ◈ ${small('commandes')} ➜ ${Object.keys(commands).length}`,
    `┃ ◈ ${small('runtime')} ➜ ${formatDuration(Date.now() - startTime)}`,
    '┗━━━━━━━━━━━━━━━━━⬣',
  ].join('\n')

  const sections = Object.entries(cats).map(([title, names]) => {
    const lines = names.map(
      (n) => `┃ ◦ *${PREFIX}${n}* · ${commands[n].desc.split(' (')[0]}`
    )
    return [`┏━━━ ${small(title)} ━━━⬣`, ...lines, '┗━━━━━━━━━━━━━━━━━⬣'].join('\n')
  })

  return [header, ...sections].join('\n\n')
}
export const commands = {
    menu: {
    desc: 'Afficher le menu',
    async run({ replyImage, settings }) {
      await replyImage(MENU_IMAGE, buildMenu(settings))
    },
  },
  ping: {
    desc: 'Tester le bot',
    async run({ msg, reply }) {
      const sent = Number(msg.messageTimestamp) * 1000
      const latency = Math.max(0, Date.now() - sent) || 0
      await reply(`✅ Le bot est actif.\n⏱️ Latence : ${latency} ms`)
    },
  },

  hello: {
    desc: 'Saluer le bot',
    async run({ reply }) {
      await reply(`👋 Salut ! Je suis ${BOT_NAME}.`)
    },
  },

  kick: {
    desc: 'Retirer un membre (mentionne-le ou réponds à son message)',
    async run(ctx) {
      const g = await groupContext(ctx)
      if (!g) return
      const ids = getTargets(ctx.msg)
        .map((t) => findParticipant(g.meta, [t]))
        .filter((p) => p && p.id !== g.me.id && p.id !== g.sender.id)
        .map((p) => p.id)
      if (!ids.length) {
        return ctx.reply(`Utilisation : ${PREFIX}kick @membre (ou réponds à son message)`)
      }
      await ctx.sock.groupParticipantsUpdate(ctx.jid, ids, 'remove')
      await ctx.reply(`✅ ${ids.length} membre(s) retiré(s).`)
    },
  },

  kickall: {
    desc: 'Retirer tous (à confirmer avec "oui")',
    async run(ctx) {
      const g = await groupContext(ctx)
      if (!g) return
      if (ctx.args[0]?.toLowerCase() !== 'oui') {
        return ctx.reply(
          `⚠️ Cela va retirer TOUS les membres du groupe.\nPour confirmer : ${PREFIX}kickall oui`
        )
      }
      const keep = new Set([g.me.id, g.sender.id])
      const ids = g.meta.participants.filter((p) => !keep.has(p.id)).map((p) => p.id)
      await ctx.reply(`🧹 Retrait de ${ids.length} membre(s)...`)
      for (let i = 0; i < ids.length; i += 5) {
        await ctx.sock.groupParticipantsUpdate(ctx.jid, ids.slice(i, i + 5), 'remove')
        await sleep(2000) // petite pause pour ne pas spammer WhatsApp
      }
      await ctx.reply('✅ Terminé.')
    },
  },

  promote: {
    desc: 'Nommer un admin',
    run: (ctx) => changeRole(ctx, 'promote', 'promote'),
  },

  demote: {
    desc: 'Retirer un admin',
    run: (ctx) => changeRole(ctx, 'demote', 'demote'),
  },

  tagall: {
    desc: 'Mentionner tous',
    async run(ctx) {
      const g = await groupContext(ctx)
      if (!g) return
      const ids = g.meta.participants.map((p) => p.id)
      const intro = ctx.args.join(' ') || 'Appel à tous'
      await ctx.reply(`📢 ${intro}\n\n${ids.map((id) => `@${num(id)}`).join(' ')}`, ids)
    },
  },

  groupinfo: {
    desc: 'Infos groupe (nom, membres, admins)',
    async run({ sock, jid, isGroup, reply }) {
      if (!isGroup) return reply('⚠️ Cette commande fonctionne uniquement dans un groupe.')
      const meta = await sock.groupMetadata(jid)
      const admins = meta.participants.filter(isAdmin).length
      await reply(
        `👥 *${meta.subject}*\nMembres : ${meta.participants.length}\nAdmins : ${admins}\n\n${meta.desc || 'Pas de description.'}`
      )
    },
  },

  mode: {
    desc: 'changer de mode (propriétaire)',
    async run({ args, isOwner, reply, settings }) {
      if (!isOwner) return reply('⛔ Réservé au propriétaire.')
      const m = args[0]?.toLowerCase()
      if (!['private', 'public'].includes(m)) {
        return reply(`Mode actuel : ${settings.mode}\nUtilisation : ${PREFIX}mode private | public`)
      }
      settings.mode = m
      saveSettings(settings)
      await reply(`✅ Mode ${m} activé.`)
    },
  },
}
