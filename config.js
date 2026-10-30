import fs from 'fs'

export const PREFIX = '@'
export const BOT_NAME = '𝕂𝕒ï𝕕𝕠𝔹𝕠𝕥 @ 𝐒֟፝͜𝐆𝐇'
export const OWNER_NAME = '𝕂𝔸Ï𝔻𝕆'
export const VERSION = 'V0.0'
export const FOOTER = '> ☠️ Développé par *𝕂𝔸Ï𝔻𝕆* @ Glory to the clan 𝐒֟፝͜𝐆𝐇 𝐁֟፝͜𝐋𝐎𝐎𝐃 ❾❾'
export const MENU_IMAGE = 'https://files.catbox.moe/cl3gd9.jpg'

// Ton numéro PRINCIPAL : indicatif pays + numéro, sans + ni espaces
export const OWNERS = ['237688673503']

const FILE = './settings.json'

export function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    return { mode: 'private' } // par défaut : privé
  }
}

export function saveSettings(settings) {
  fs.writeFileSync(FILE, JSON.stringify(settings, null, 2))
}
