// Garde seulement la partie numérique d'un identifiant WhatsApp
export const num = (jid) => (jid || '').split('@')[0].split(':')[0]

// Retrouve un membre du groupe à partir d'un identifiant (numéro ou LID)
export function findParticipant(meta, ids) {
  const wanted = ids.filter(Boolean).map(num)
  return meta.participants.find((p) =>
    [p.id, p.lid, p.phoneNumber].filter(Boolean).map(num).some((x) => wanted.includes(x))
  )
}

export const isAdmin = (p) => p?.admin === 'admin' || p?.admin === 'superadmin'
// Met un texte en petites capitales : "menu" -> "ᴍᴇɴᴜ"
const SC = 'ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ'
export const small = (s) =>
  s.toLowerCase().replace(/[a-z]/g, (c) => SC[c.charCodeAt(0) - 97])

// 3725000 -> "1h 2m 5s"
export function formatDuration(ms) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [h && `${h}h`, (h || m) && `${m}m`, `${s % 60}s`].filter(Boolean).join(' ')
}
