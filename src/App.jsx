import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, ResponsiveContainer, Tooltip,
} from 'recharts'
import {
  LayoutDashboard, Receipt, Users, Settings as SettingsIcon, Plus, X,
  ArrowUpRight, ArrowDownRight, Utensils, Car, Home, HeartPulse, Film,
  ShoppingBag, FileText, MoreHorizontal, Briefcase, Gift, DollarSign,
  UserPlus, Trash2, Calendar, Bell, Lock, Upload, Download, Sun, Moon,
  Monitor, Check, ChevronLeft, Wallet, User, Paperclip, Target, BarChart3, Fingerprint,
} from 'lucide-react'

/* ============================================================
   COSTANTI E DATI DI DEFAULT
   ============================================================ */

const ICONS = {
  food: Utensils, transport: Car, home: Home, health: HeartPulse, fun: Film,
  shopping: ShoppingBag, bills: FileText, other: MoreHorizontal,
  salary: Briefcase, gift: Gift, income: DollarSign,
}

const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Cibo', icon: 'food', color: '#f97316', isExpense: true },
  { id: 'transport', name: 'Trasporti', icon: 'transport', color: '#3b82f6', isExpense: true },
  { id: 'home', name: 'Casa', icon: 'home', color: '#92400e', isExpense: true },
  { id: 'health', name: 'Salute', icon: 'health', color: '#ef4444', isExpense: true },
  { id: 'fun', name: 'Svago', icon: 'fun', color: '#a855f7', isExpense: true },
  { id: 'shopping', name: 'Shopping', icon: 'shopping', color: '#ec4899', isExpense: true },
  { id: 'bills', name: 'Bollette', icon: 'bills', color: '#14b8a6', isExpense: true },
  { id: 'other_exp', name: 'Altro', icon: 'other', color: '#6b7280', isExpense: true },
  { id: 'salary', name: 'Stipendio', icon: 'salary', color: '#22c55e', isExpense: false },
  { id: 'gift', name: 'Regalo', icon: 'gift', color: '#f59e0b', isExpense: false },
  { id: 'other_inc', name: 'Altra entrata', icon: 'income', color: '#84cc16', isExpense: false },
]

const DEFAULT_ACCOUNTS = [
  { id: 'cash', name: 'Contanti', initialBalance: 0 },
  { id: 'bank', name: 'Conto Corrente', initialBalance: 0 },
  { id: 'card', name: 'Carta', initialBalance: 0 },
]

const PURE_RED = '#FF0000'

const DEBT_TYPES = {
  loanGiven: { label: 'Prestito erogato', sign: 1 },
  debtTaken: { label: 'Debito contratto', sign: -1 },
  repaymentReceived: { label: 'Restituzione ricevuta', sign: -1 },
  repaymentMade: { label: 'Restituzione effettuata', sign: 1 },
}

/* ============================================================
   UTILITY
   ============================================================ */

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

const fmtCurrency = (n) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n || 0)

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })

const monthKey = (d) => `${d.getFullYear()}-${d.getMonth()}`

function hsvToHex(h, s) {
  const S = Math.max(0, Math.min(100, s)) / 100
  const H = (((h % 360) + 360) % 360) / 60
  const c = S
  const x = c * (1 - Math.abs((H % 2) - 1))
  const m = 1 - c
  let r = 0, g = 0, b = 0
  if (H < 1) [r, g, b] = [c, x, 0]
  else if (H < 2) [r, g, b] = [x, c, 0]
  else if (H < 3) [r, g, b] = [0, c, x]
  else if (H < 4) [r, g, b] = [0, x, c]
  else if (H < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const to = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}

function hexToHueSat(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return { h: 0, s: 100 }
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const sat = max === 0 ? 0 : (d / max) * 100
  return { h: Math.round(h), s: Math.round(sat) }
}

function catView(t, categories) {
  const cat = categories.find(c => c.id === t.categoryId)
  return {
    name: cat?.name || t.categoryName || 'Senza categoria',
    color: cat?.color || t.categoryColor || '#6b7280',
    icon: cat?.icon || t.categoryIcon || 'other',
  }
}

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024

function fmtBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function openAttachment(a) {
  const link = document.createElement('a')
  link.href = a.dataUrl
  link.download = a.name
  link.target = '_blank'
  link.rel = 'noreferrer'
  link.click()
}

const PERIODS = [
  { key: 'day', label: 'Giorno' },
  { key: 'week', label: 'Settimana' },
  { key: 'month', label: 'Mese' },
  { key: 'year', label: 'Anno' },
]

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const startOfWeek = (d) => { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x }
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1)
const startOfYear = (d) => new Date(d.getFullYear(), 0, 1)

function periodRange(date, period) {
  if (period === 'day') { const s2 = startOfDay(date); const e = new Date(s2); e.setDate(e.getDate() + 1); return { start: s2, end: e } }
  if (period === 'week') { const s2 = startOfWeek(date); const e = new Date(s2); e.setDate(e.getDate() + 7); return { start: s2, end: e } }
  if (period === 'month') { const s2 = startOfMonth(date); const e = new Date(s2.getFullYear(), s2.getMonth() + 1, 1); return { start: s2, end: e } }
  const s2 = startOfYear(date); const e = new Date(s2.getFullYear() + 1, 0, 1); return { start: s2, end: e }
}

function shiftPeriod(date, period, dir) {
  const d = new Date(date)
  if (period === 'day') d.setDate(d.getDate() + dir)
  else if (period === 'week') d.setDate(d.getDate() + dir * 7)
  else if (period === 'month') d.setMonth(d.getMonth() + dir)
  else d.setFullYear(d.getFullYear() + dir)
  return d
}

function periodLabel(date, period) {
  if (period === 'day') return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (period === 'week') {
    const { start, end } = periodRange(date, 'week')
    const endIncl = new Date(end); endIncl.setDate(endIncl.getDate() - 1)
    return `${start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${endIncl.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  if (period === 'month') return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return String(date.getFullYear())
}

function subBuckets(transactions, date, period) {
  const { start, end } = periodRange(date, period)
  const inRange = transactions.filter(t => { const d = new Date(t.date); return d >= start && d < end })

  if (period === 'day') {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ label: `${h}`, value: 0 }))
    inRange.forEach(t => { buckets[new Date(t.date).getHours()].value += t.isExpense ? -t.amount : t.amount })
    return buckets
  }
  if (period === 'week') {
    const labels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
    const buckets = labels.map(l => ({ label: l, value: 0 }))
    inRange.forEach(t => { const idx = (new Date(t.date).getDay() + 6) % 7; buckets[idx].value += t.isExpense ? -t.amount : t.amount })
    return buckets
  }
  if (period === 'month') {
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
    const buckets = Array.from({ length: daysInMonth }, (_, i) => ({ label: `${i + 1}`, value: 0 }))
    inRange.forEach(t => { buckets[new Date(t.date).getDate() - 1].value += t.isExpense ? -t.amount : t.amount })
    return buckets
  }
  const labels = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
  const buckets = labels.map(l => ({ label: l, value: 0 }))
  inRange.forEach(t => { buckets[new Date(t.date).getMonth()].value += t.isExpense ? -t.amount : t.amount })
  return buckets
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function useLocalStorageState(key, initial) {
  const [state, setState] = useState(() => loadJSON(key, initial))
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)) } catch {}
  }, [key, state])
  return [state, setState]
}

/* ============================================================
   NOTIFICHE LOCALI & BIOMETRIA
   ============================================================ */

const isNative = Capacitor.isNativePlatform()

const reminderNumId = (id) => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % 2147483647
}

async function checkNotificationPermission() {
  if (isNative) {
    try {
      const p = await LocalNotifications.checkPermissions()
      return p.display
    } catch {
      return 'unknown'
    }
  }
  return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
}

async function requestNotificationPermission() {
  if (isNative) {
    try {
      const p = await LocalNotifications.requestPermissions()
      return p.display
    } catch {
      return 'denied'
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

const webTimers = new Map()
const MAX_TIMEOUT = 2147483647

async function biometricCheck() {
  if (!isNative) return { isAvailable: false }
  try {
    return await BiometricAuth.checkBiometry()
  } catch {
    return { isAvailable: false }
  }
}

async function biometricAuthenticate() {
  if (!isNative) return false
  try {
    await BiometricAuth.authenticate({ reason: 'Sblocca Money Tracker', cancelTitle: 'Usa il PIN' })
    return true
  } catch {
    return false
  }
}

function scheduleDebtReminder(entry, contactName) {
  if (!entry.reminderDate) return
  const target = new Date(entry.reminderDate)
  if (isNaN(target.getTime()) || target.getTime() <= Date.now()) return
  const body = `${contactName} ti deve ${fmtCurrency(entry.amount)}. Ricordati di riscuotere!`

  if (isNative) {
    LocalNotifications.schedule({
      notifications: [{
        id: reminderNumId(entry.id),
        title: 'Promemoria credito',
        body,
        schedule: { at: target, allowWhileIdle: true },
      }],
    }).catch(() => {})
    return
  }

  if (typeof Notification === 'undefined') return
  const ms = target.getTime() - Date.now()
  if (ms > MAX_TIMEOUT) return
  clearTimeout(webTimers.get(entry.id))
  webTimers.set(entry.id, setTimeout(() => {
    webTimers.delete(entry.id)
    if (Notification.permission === 'granted') {
      new Notification('Promemoria credito', { body })
    }
  }, ms))
}

function cancelDebtReminder(entryId) {
  if (isNative) {
    LocalNotifications.cancel({ notifications: [{ id: reminderNumId(entryId) }] }).catch(() => {})
  }
  clearTimeout(webTimers.get(entryId))
  webTimers.delete(entryId)
}

/* ============================================================
   TEMA
   ============================================================ */

function useTheme(mode) {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (e) => setSystemDark(e.matches)
    mq.addEventListener?.('change', listener)
    return () => mq.removeEventListener?.('change', listener)
  }, [])

  const dark = mode === 'system' ? systemDark : mode === 'dark'

  return dark
    ? {
        dark: true, bg: '#0f172a', card: '#1e293b', text: '#f1f5f9', subtext: '#94a3b8',
        border: '#334155', primary: '#6366f1', income: '#22c55e', expense: '#ef4444',
        inputBg: '#1e293b',
      }
    : {
        dark: false, bg: '#f1f5f9', card: '#ffffff', text: '#0f172a', subtext: '#64748b',
        border: '#e2e8f0', primary: '#4f46e5', income: '#16a34a', expense: '#dc2626',
        inputBg: '#ffffff',
      }
}

/* ============================================================
   COMPONENTI DI SUPPORTO
   ============================================================ */

function IconBubble({ name, color, size = 20 }) {
  const Icon = ICONS[name] || MoreHorizontal
  return (
    <div style={{
      width: size + 20, height: size + 20, borderRadius: 14,
      background: `${color}26`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon size={size} color={color} />
    </div>
  )
}

function SummaryCard({ theme, label, value, icon: Icon, color }) {
  return (
    <div style={{
      flex: 1, background: theme.card, borderRadius: 18, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, background: `${color}26`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={color} />
      </div>
      <div style={{ fontSize: 11, color: theme.subtext }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
    </div>
  )
}

function Modal({ theme, title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50,
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div
        style={{
          background: theme.bg, width: '100%', maxHeight: '92%', borderTopLeftRadius: 24,
          borderTopRightRadius: 24, padding: '18px 18px 28px', overflowY: 'auto',
          animation: 'slideUp .2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>{title}</div>
          <button onClick={onClose} style={iconBtnStyle(theme)}><X size={20} color={theme.text} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const iconBtnStyle = (theme) => ({
  background: theme.card, border: 'none', borderRadius: 10, width: 36, height: 36,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
})

const inputStyle = (theme) => ({
  width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${theme.border}`,
  background: theme.inputBg, color: theme.text, fontSize: 15, outline: 'none',
})

function ChipButton({ active, color, theme, children, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20,
        border: `1px solid ${active ? color : theme.border}`,
        background: active ? color : 'transparent', color: active ? '#fff' : theme.text,
        fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {Icon && <Icon size={14} color={active ? '#fff' : color} />}
      {children}
    </button>
  )
}

const HS_SLIDER_CSS = `
.dt-hs-slider{-webkit-appearance:none;appearance:none;width:100%;height:18px;border-radius:9px;outline:none;margin:0;border:1px solid rgba(128,128,128,.35)}
.dt-hs-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:26px;height:26px;border-radius:50%;background:#fff;border:3px solid #111;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer}
.dt-hs-slider::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid #111;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer}
`

function SwatchPicker({ theme, value, onChange, size = 26 }) {
  const [open, setOpen] = useState(false)
  const [hs, setHs] = useState({ h: 0, s: 100 })

  const openPicker = () => { setHs(hexToHueSat(value || PURE_RED)); setOpen(true) }
  const draft = hsvToHex(hs.h, hs.s)
  const label = { fontSize: 12, fontWeight: 600, color: theme.subtext, margin: '14px 0 8px' }

  return (
    <>
      <button
        type="button" onClick={openPicker} aria-label="Scegli colore"
        style={{ width: size, height: size, borderRadius: '50%', background: value || PURE_RED, border: `2px solid ${theme.border}`, cursor: 'pointer', flexShrink: 0, padding: 0 }}
      />
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <style>{HS_SLIDER_CSS}</style>
          <div onClick={(e) => e.stopPropagation()} style={{ background: theme.card, borderRadius: 20, padding: 20, width: '100%', maxWidth: 320 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>Scegli il colore</div>

            <div style={label}>Tonalità</div>
            <input
              className="dt-hs-slider" type="range" min="0" max="360" value={hs.h}
              onChange={(e) => setHs(p => ({ ...p, h: Number(e.target.value) }))}
              style={{ background: 'linear-gradient(to right,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)' }}
            />

            <div style={label}>Saturazione</div>
            <input
              className="dt-hs-slider" type="range" min="0" max="100" value={hs.s}
              onChange={(e) => setHs(p => ({ ...p, s: Number(e.target.value) }))}
              style={{ background: `linear-gradient(to right,#FFFFFF,${hsvToHex(hs.h, 100)})` }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 }}>
              <button
                type="button" onClick={() => setOpen(false)}
                style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text, fontWeight: 700, cursor: 'pointer' }}
              >
                Annulla
              </button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: draft, border: `2px solid ${theme.border}`, margin: '0 auto' }} />
                <div style={{ fontSize: 10, color: theme.subtext, marginTop: 4 }}>{draft}</div>
              </div>
              <button
                type="button" onClick={() => { onChange(draft); setOpen(false) }}
                style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: theme.primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CategoryEditor({ theme, cats, onChange, onRemove, includeIncome = false }) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PURE_RED)
  const [newIsExpense, setNewIsExpense] = useState(true)

  const rename = (id, name) => onChange(cats.map(c => c.id === id ? { ...c, name } : c))
  const recolor = (id, color) => onChange(cats.map(c => c.id === id ? { ...c, color } : c))
  const add = () => {
    if (!newName.trim()) return
    onChange([...cats, {
      id: uuid(), name: newName.trim(), icon: newIsExpense ? 'other' : 'income',
      color: newColor, isExpense: newIsExpense,
    }])
    setNewName('')
    setNewColor(PURE_RED)
  }

  const groups = includeIncome
    ? [{ label: 'Spese', exp: true }, { label: 'Entrate', exp: false }]
    : [{ label: null, exp: true }]

  return (
    <div>
      {groups.map(g => {
        const list = cats.filter(c => c.isExpense === g.exp)
        return (
          <div key={g.label || 'exp'} style={{ marginBottom: 16 }}>
            {g.label && <div style={{ fontSize: 12, fontWeight: 700, color: theme.subtext, marginBottom: 8 }}>{g.label.toUpperCase()}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: theme.card, borderRadius: 14, padding: 10 }}>
                  <SwatchPicker theme={theme} value={c.color} onChange={(col) => recolor(c.id, col)} />
                  <input
                    value={c.name} onChange={(e) => rename(c.id, e.target.value)}
                    style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: theme.text, fontSize: 14, fontWeight: 600 }}
                  />
                  <button onClick={() => onRemove(c.id)} style={iconBtnStyle(theme)}><Trash2 size={15} color={theme.expense} /></button>
                </div>
              ))}
              {list.length === 0 && <div style={{ color: theme.subtext, fontSize: 13, padding: '4px 0' }}>Nessuna categoria.</div>}
            </div>
          </div>
        )
      })}

      <div style={{ fontSize: 12, fontWeight: 600, color: theme.subtext, margin: '4px 0 8px' }}>Nuova categoria</div>
      {includeIncome && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <ChipButton active={newIsExpense} color={theme.expense} theme={theme} onClick={() => setNewIsExpense(true)}>Spesa</ChipButton>
          <ChipButton active={!newIsExpense} color={theme.income} theme={theme} onClick={() => setNewIsExpense(false)}>Entrata</ChipButton>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SwatchPicker theme={theme} value={newColor} onChange={setNewColor} size={34} />
        <input style={{ ...inputStyle(theme), flex: 1 }} placeholder="es. Studio, Palestra..." value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button onClick={add} style={{ ...iconBtnStyle(theme), width: 46, background: theme.primary }}><Plus size={18} color="#fff" /></button>
      </div>
    </div>
  )
}

function AttachmentPicker({ theme, attachments, onChange, compact = false }) {
  const inputRef = React.useRef(null)
  const [busy, setBusy] = useState(false)

  const handleFiles = async (files) => {
    setBusy(true)
    const next = [...attachments]
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        alert(`"${file.name}" supera i 4 MB e non è stato aggiunto`)
        continue
      }
      try {
        const dataUrl = await readFileAsDataURL(file)
        next.push({ id: uuid(), name: file.name, type: file.type, size: file.size, dataUrl })
      } catch { /* file illeggibile, ignorato */ }
    }
    onChange(next)
    setBusy(false)
  }

  const thumbSize = compact ? 52 : 64

  return (
    <div>
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {attachments.map(a => (
            <div key={a.id} style={{ position: 'relative', width: thumbSize }}>
              <div onClick={() => openAttachment(a)} style={{ cursor: 'pointer' }}>
                {a.type?.startsWith('image/') ? (
                  <img src={a.dataUrl} alt={a.name} style={{ width: thumbSize, height: thumbSize, objectFit: 'cover', borderRadius: 10, border: `1px solid ${theme.border}`, display: 'block' }} />
                ) : (
                  <div style={{ width: thumbSize, height: thumbSize, borderRadius: 10, background: theme.bg, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={20} color={theme.subtext} />
                  </div>
                )}
                <div style={{ fontSize: 9, color: theme.subtext, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(attachments.filter(x => x.id !== a.id)) }}
                style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: theme.expense, border: `2px solid ${theme.card}`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button" onClick={() => inputRef.current?.click()} disabled={busy}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 12, border: `1px dashed ${theme.border}`, background: 'transparent', color: theme.subtext, fontSize: 12, cursor: 'pointer' }}
      >
        <Paperclip size={14} /> {busy ? 'Caricamento...' : 'Aggiungi prova (foto, PDF, ecc.)'}
      </button>
      <input
        ref={inputRef} type="file" multiple style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files.length) handleFiles([...e.target.files]); e.target.value = '' }}
      />
    </div>
  )
}

function AttachmentsModal({ theme, entry, onClose, onChange }) {
  return (
    <Modal theme={theme} title="Prove allegate" onClose={onClose}>
      <AttachmentPicker theme={theme} attachments={entry.attachments || []} onChange={onChange} />
    </Modal>
  )
}

/* ============================================================
   GRAFICI
   ============================================================ */

function ExpensePie({ theme, data, emptyLabel = 'Nessuna spesa questo mese' }) {
  if (!data.length) {
    return <div style={{ padding: '30px 0', textAlign: 'center', color: theme.subtext, fontSize: 13 }}>{emptyLabel}</div>
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: '55%', height: 160 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={35} outerRadius={70} paddingAngle={2}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v) => fmtCurrency(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.text }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CashFlowChart({ theme, data }) {
  return (
    <div style={{ height: 180 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="label" stroke={theme.subtext} fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v) => fmtCurrency(v)} contentStyle={{ background: theme.card, border: 'none', borderRadius: 10 }} />
          <Bar dataKey="value" radius={[6, 6, 6, 6]}>
            {data.map((d, i) => <Cell key={i} fill={d.value >= 0 ? theme.income : theme.expense} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ============================================================
   SCHERMATA: DASHBOARD
   ============================================================ */

function GoalCard({ theme, goal, currentBalance, onDelete }) {
  const span = goal.targetAmount - goal.startAmount
  const saved = Math.max(0, currentBalance - goal.startAmount)
  const progress = Math.max(0, Math.min(100, span <= 0 ? 100 : (saved / span) * 100))
  const reached = progress >= 100
  const daysLeft = goal.targetDate ? Math.ceil((new Date(goal.targetDate) - new Date()) / 86400000) : null

  return (
    <div style={{ background: theme.card, borderRadius: 16, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${theme.primary}26`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Target size={16} color={theme.primary} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.name}</div>
          <div style={{ fontSize: 11, color: theme.subtext }}>
            {fmtCurrency(saved)} di {fmtCurrency(span > 0 ? span : goal.targetAmount)}
            {daysLeft !== null && (daysLeft >= 0 ? ` · ${daysLeft}g rimanenti` : ' · scaduto')}
          </div>
        </div>
        <button onClick={onDelete} style={iconBtnStyle(theme)}><Trash2 size={14} color={theme.expense} /></button>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: theme.border, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: reached ? theme.income : theme.primary, borderRadius: 4, transition: 'width .3s' }} />
      </div>
      <div style={{ textAlign: 'right', fontSize: 11, color: theme.subtext, marginTop: 4 }}>{progress.toFixed(0)}%{reached ? ' 🎉' : ''}</div>
    </div>
  )
}

function AddGoalModal({ theme, currentBalance, onClose, onSave }) {
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const save = () => {
    const amt = parseFloat(targetAmount.replace(',', '.'))
    if (!name.trim() || !amt || amt <= 0) { alert('Inserisci un nome e un importo obiettivo valido'); return }
    onSave({
      id: uuid(), name: name.trim(), targetAmount: amt,
      targetDate: targetDate ? new Date(targetDate).toISOString() : null,
      startAmount: currentBalance, createdAt: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <Modal theme={theme} title="Nuovo obiettivo di risparmio" onClose={onClose}>
      <input style={{ ...inputStyle(theme), marginBottom: 14 }} placeholder="es. Vacanza, Fondo emergenza..." value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ fontSize: 12, fontWeight: 600, color: theme.subtext, marginBottom: 6 }}>Importo obiettivo €</div>
      <input inputMode="decimal" style={{ ...inputStyle(theme), marginBottom: 14 }} placeholder="es. 2000" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
      <div style={{ fontSize: 12, fontWeight: 600, color: theme.subtext, marginBottom: 6 }}>Data obiettivo (opzionale)</div>
      <input type="date" style={{ ...inputStyle(theme), marginBottom: 16 }} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      <div style={{ fontSize: 11, color: theme.subtext, marginBottom: 20, lineHeight: 1.4 }}>Il progresso parte dal saldo attuale ({fmtCurrency(currentBalance)}).</div>
      <button onClick={save} style={{ width: '100%', padding: 15, borderRadius: 14, border: 'none', background: theme.primary, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
        Crea obiettivo
      </button>
    </Modal>
  )
}

function DashboardScreen({ theme, transactions, accounts, categories, contacts, debtEntries, profile, goals, onAddGoal, onDeleteGoal }) {
  const now = new Date()

  const totalBalance = useMemo(() => {
    const base = accounts.reduce((s, a) => s + a.initialBalance, 0)
    const moved = transactions.reduce((s, t) => s + (t.isExpense ? -t.amount : t.amount), 0)
    return base + moved
  }, [accounts, transactions])

  const monthIncome = useMemo(() =>
    transactions.filter(t => !t.isExpense && monthKey(new Date(t.date)) === monthKey(now))
      .reduce((s, t) => s + t.amount, 0), [transactions])

  const monthExpense = useMemo(() =>
    transactions.filter(t => t.isExpense && monthKey(new Date(t.date)) === monthKey(now))
      .reduce((s, t) => s + t.amount, 0), [transactions])

  const balanceFor = useCallback((contactId) =>
    debtEntries.filter(e => e.contactId === contactId)
      .reduce((s, e) => s + e.amount * DEBT_TYPES[e.type].sign, 0), [debtEntries])

  const totalCredits = useMemo(() =>
    contacts.reduce((s, c) => { const b = balanceFor(c.id); return b > 0 ? s + b : s }, 0), [contacts, balanceFor])

  const totalDebts = useMemo(() =>
    contacts.reduce((s, c) => { const b = balanceFor(c.id); return b < 0 ? s + Math.abs(b) : s }, 0), [contacts, balanceFor])

  const pieData = useMemo(() => {
    const map = {}
    transactions
      .filter(t => t.isExpense && monthKey(new Date(t.date)) === monthKey(now))
      .forEach(t => {
        const v = catView(t, categories)
        if (!map[t.categoryId]) map[t.categoryId] = { name: v.name, color: v.color, value: 0 }
        map[t.categoryId].value += t.amount
      })
    return Object.values(map)
  }, [transactions, categories])

  const [showAddGoal, setShowAddGoal] = useState(false)

  const barData = useMemo(() => {
    const arr = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = monthKey(d)
      const income = transactions.filter(t => !t.isExpense && monthKey(new Date(t.date)) === key).reduce((s, t) => s + t.amount, 0)
      const expense = transactions.filter(t => t.isExpense && monthKey(new Date(t.date)) === key).reduce((s, t) => s + t.amount, 0)
      arr.push({ label: d.toLocaleDateString('it-IT', { month: 'short' }), value: income - expense })
    }
    return arr
  }, [transactions])

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {profile?.name && (
        <div style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>Ciao, {profile.name} 👋</div>
      )}
      <div style={{
        background: `linear-gradient(135deg, ${theme.primary}, #7c3aed)`, borderRadius: 22, padding: 22,
      }}>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Saldo Totale Disponibile</div>
        <div style={{ color: '#fff', fontSize: 30, fontWeight: 800, marginTop: 6 }}>{fmtCurrency(totalBalance)}</div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <SummaryCard theme={theme} label="Entrate (mese)" value={fmtCurrency(monthIncome)} icon={ArrowDownRight} color={theme.income} />
        <SummaryCard theme={theme} label="Uscite (mese)" value={fmtCurrency(monthExpense)} icon={ArrowUpRight} color={theme.expense} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <SummaryCard theme={theme} label="Crediti da incassare" value={fmtCurrency(totalCredits)} icon={ArrowDownRight} color={theme.income} />
        <SummaryCard theme={theme} label="Debiti da saldare" value={fmtCurrency(totalDebts)} icon={ArrowUpRight} color={theme.expense} />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>Obiettivi di risparmio</div>
          <button onClick={() => setShowAddGoal(true)} style={{ ...iconBtnStyle(theme), width: 30, height: 30 }}><Plus size={16} color={theme.text} /></button>
        </div>
        {goals.length === 0 && (
          <div style={{ color: theme.subtext, fontSize: 12, background: theme.card, borderRadius: 16, padding: 14, lineHeight: 1.5 }}>
            Nessun obiettivo ancora. Aggiungine uno per iniziare a monitorare i tuoi risparmi.
          </div>
        )}
        {goals.map(g => (
          <GoalCard key={g.id} theme={theme} goal={g} currentBalance={totalBalance} onDelete={() => onDeleteGoal(g.id)} />
        ))}
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Spese per categoria</div>
        <div style={{ background: theme.card, borderRadius: 18, padding: 14 }}>
          <ExpensePie theme={theme} data={pieData} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Andamento cash flow (6 mesi)</div>
        <div style={{ background: theme.card, borderRadius: 18, padding: 14 }}>
          <CashFlowChart theme={theme} data={barData} />
        </div>
      </div>
      <div style={{ height: 70 }} />
      {showAddGoal && <AddGoalModal theme={theme} currentBalance={totalBalance} onClose={() => setShowAddGoal(false)} onSave={onAddGoal} />}
    </div>
  )
}

/* ============================================================
   SCHERMATA: TRANSAZIONI & ANALISI
   ============================================================ */

function AnalysisScreen({ theme, transactions, categories }) {
  const [period, setPeriod] = useState('month')
  const [anchor, setAnchor] = useState(new Date())

  const { start, end } = useMemo(() => periodRange(anchor, period), [anchor, period])

  const inRange = useMemo(
    () => transactions.filter(t => { const d = new Date(t.date); return d >= start && d < end }),
    [transactions, start, end]
  )

  const income = useMemo(() => inRange.filter(t => !t.isExpense).reduce((s, t) => s + t.amount, 0), [inRange])
  const expense = useMemo(() => inRange.filter(t => t.isExpense).reduce((s, t) => s + t.amount, 0), [inRange])

  const pieData = useMemo(() => {
    const map = {}
    inRange.filter(t => t.isExpense).forEach(t => {
      const v = catView(t, categories)
      if (!map[t.categoryId]) map[t.categoryId] = { name: v.name, color: v.color, value: 0 }
      map[t.categoryId].value += t.amount
    })
    return Object.values(map)
  }, [inRange, categories])

  const barData = useMemo(() => subBuckets(transactions, anchor, period), [transactions, anchor, period])

  return (
    <div style={{ padding: 16, paddingBottom: 90 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: theme.text, marginBottom: 16 }}>Analisi</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
        {PERIODS.map(p => (
          <ChipButton key={p.key} active={period === p.key} color={theme.primary} theme={theme} onClick={() => { setPeriod(p.key); setAnchor(new Date()) }}>
            {p.label}
          </ChipButton>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
        <button onClick={() => setAnchor(shiftPeriod(anchor, period, -1))} style={iconBtnStyle(theme)}><ChevronLeft size={18} color={theme.text} /></button>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, textTransform: 'capitalize', textAlign: 'center', flex: 1 }}>
          {periodLabel(anchor, period)}
        </div>
        <button onClick={() => setAnchor(shiftPeriod(anchor, period, 1))} style={{ ...iconBtnStyle(theme), transform: 'rotate(180deg)' }}><ChevronLeft size={18} color={theme.text} /></button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <SummaryCard theme={theme} label="Entrate" value={fmtCurrency(income)} icon={ArrowDownRight} color={theme.income} />
        <SummaryCard theme={theme} label="Uscite" value={fmtCurrency(expense)} icon={ArrowUpRight} color={theme.expense} />
      </div>
      <div style={{ background: theme.card, borderRadius: 18, padding: 16, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: theme.subtext }}>Saldo del periodo</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: income - expense >= 0 ? theme.income : theme.expense }}>
          {fmtCurrency(income - expense)}
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Andamento</div>
      <div style={{ background: theme.card, borderRadius: 18, padding: 14, marginBottom: 20 }}>
        <CashFlowChart theme={theme} data={barData} />
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Spese per categoria</div>
      <div style={{ background: theme.card, borderRadius: 18, padding: 14, marginBottom: 20 }}>
        <ExpensePie theme={theme} data={pieData} emptyLabel="Nessuna spesa in questo periodo" />
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Movimenti ({inRange.length})</div>
      {inRange.length === 0 && <div style={{ color: theme.subtext, fontSize: 13 }}>Nessun movimento in questo periodo.</div>}
      {[...inRange].sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => {
        const cat = catView(t, categories)
        return (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: theme.card, borderRadius: 14, padding: 10, marginBottom: 8 }}>
            <IconBubble name={cat.icon} color={cat.color} size={16} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>{cat.name}</div>
              <div style={{ fontSize: 11, color: theme.subtext }}>{new Date(t.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: period === 'day' ? '2-digit' : undefined, minute: period === 'day' ? '2-digit' : undefined })}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: t.isExpense ? theme.expense : theme.income }}>
              {t.isExpense ? '-' : '+'}{fmtCurrency(t.amount)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TransactionsScreen({ theme, transactions, categories, accounts, onDelete }) {
  const grouped = useMemo(() => {
    const map = {}
    ;[...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
      const key = fmtDate(t.date)
      if (!map[key]) map[key] = []
      map[key].push(t)
    })
    return map
  }, [transactions])

  if (!transactions.length) {
    return <div style={{ padding: 40, textAlign: 'center', color: theme.subtext }}>Nessuna transazione ancora.<br />Usa il + per aggiungerne una.</div>
  }

  return (
    <div style={{ padding: 16, paddingBottom: 90 }}>
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.subtext, margin: '10px 0 8px' }}>{date}</div>
          {items.map(t => {
            const cat = catView(t, categories)
            const acc = accounts.find(a => a.id === t.accountId)
            return (
              <div
                key={t.id}
                onClick={() => { if (confirm('Eliminare questa transazione?')) onDelete(t.id) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, background: theme.card,
                  borderRadius: 16, padding: 12, marginBottom: 8, cursor: 'pointer',
                }}
              >
                <IconBubble name={cat.icon} color={cat.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: theme.text, fontSize: 14 }}>{cat.name}</div>
                  <div style={{ fontSize: 12, color: theme.subtext, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {acc?.name}{t.notes ? ` · ${t.notes}` : ''}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: t.isExpense ? theme.expense : theme.income, fontSize: 14 }}>
                  {t.isExpense ? '-' : '+'}{fmtCurrency(t.amount)}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function AddTransactionModal({ theme, categories, accounts, onClose, onSave }) {
  const [isExpense, setIsExpense] = useState(true)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(categories.find(c => c.isExpense)?.id || '')
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const filteredCats = categories.filter(c => c.isExpense === isExpense)

  useEffect(() => {
    if (!filteredCats.find(c => c.id === categoryId)) setCategoryId(filteredCats[0]?.id || '')
  }, [isExpense])

  const save = () => {
    const val = parseFloat(amount.replace(',', '.'))
    if (!val || val <= 0 || !categoryId || !accountId) { alert('Inserisci un importo valido e seleziona categoria/conto'); return }
    const cat = categories.find(c => c.id === categoryId)
    onSave({
      id: uuid(), amount: val, isExpense, categoryId, accountId, date: new Date(date).toISOString(), notes,
      categoryName: cat?.name, categoryColor: cat?.color, categoryIcon: cat?.icon,
    })
    onClose()
  }

  return (
    <Modal theme={theme} title="Nuova transazione" onClose={onClose}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <ChipButton active={isExpense} color={theme.expense} theme={theme} onClick={() => setIsExpense(true)} icon={ArrowUpRight}>Uscita</ChipButton>
        <ChipButton active={!isExpense} color={theme.income} theme={theme} onClick={() => setIsExpense(false)} icon={ArrowDownRight}>Entrata</ChipButton>
      </div>

      <input
        style={{ ...inputStyle(theme), fontSize: 26, fontWeight: 700, textAlign: 'center', marginBottom: 18 }}
        placeholder="0,00 €" value={amount} inputMode="decimal"
        onChange={(e) => setAmount(e.target.value)}
      />

      <div style={{ fontSize: 13, fontWeight: 600, color: theme.subtext, marginBottom: 8 }}>Categoria</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {filteredCats.map(c => (
          <ChipButton key={c.id} active={categoryId === c.id} color={c.color} theme={theme} icon={ICONS[c.icon]} onClick={() => setCategoryId(c.id)}>
            {c.name}
          </ChipButton>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: theme.subtext, marginBottom: 8 }}>Conto</div>
      <select style={{ ...inputStyle(theme), marginBottom: 18 }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      <div style={{ fontSize: 13, fontWeight: 600, color: theme.subtext, marginBottom: 8 }}>Data</div>
      <input type="date" style={{ ...inputStyle(theme), marginBottom: 18 }} value={date} onChange={(e) => setDate(e.target.value)} />

      <input style={{ ...inputStyle(theme), marginBottom: 22 }} placeholder="Note (opzionale)" value={notes} onChange={(e) => setNotes(e.target.value)} />

      <button onClick={save} style={{
        width: '100%', padding: 15, borderRadius: 14, border: 'none',
        background: isExpense ? theme.expense : theme.income, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
      }}>
        Salva transazione
      </button>
    </Modal>
  )
}

/* ============================================================
   SCHERMATA: CREDITI / DEBITI
   ============================================================ */

function DebtsScreen({ theme, contacts, debtEntries, onOpenContact }) {
  const balanceFor = (contactId) =>
    debtEntries.filter(e => e.contactId === contactId).reduce((s, e) => s + e.amount * DEBT_TYPES[e.type].sign, 0)

  if (!contacts.length) {
    return <div style={{ padding: 40, textAlign: 'center', color: theme.subtext }}>Nessun contatto ancora.<br />Usa il + per aggiungerne uno.</div>
  }

  return (
    <div style={{ padding: 16, paddingBottom: 90 }}>
      {[...contacts].sort((a, b) => a.name.localeCompare(b.name)).map(c => {
        const balance = balanceFor(c.id)
        const isCredit = balance > 0, isZero = balance === 0
        return (
          <div key={c.id} onClick={() => onOpenContact(c.id)} style={{
            display: 'flex', alignItems: 'center', gap: 12, background: theme.card,
            borderRadius: 16, padding: 12, marginBottom: 8, cursor: 'pointer',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: theme.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14,
            }}>
              {c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: theme.text, fontSize: 14 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: theme.subtext }}>
                {isZero ? 'Saldo saldato' : isCredit ? `${c.name} ti deve` : `Devi a ${c.name}`}
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: isZero ? theme.subtext : (isCredit ? theme.income : theme.expense) }}>
              {fmtCurrency(Math.abs(balance))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ContactDetailScreen({ theme, contact, entries, onBack, onAdd, onDelete, onDeleteContact, onUpdateAttachments, reminderTime, remindersEnabled }) {
  const balance = entries.reduce((s, e) => s + e.amount * DEBT_TYPES[e.type].sign, 0)
  const [showAdd, setShowAdd] = useState(false)
  const [attachEntry, setAttachEntry] = useState(null)

  return (
    <div style={{ padding: 16, paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={iconBtnStyle(theme)}><ChevronLeft size={20} color={theme.text} /></button>
        <div style={{ fontSize: 18, fontWeight: 700, color: theme.text, flex: 1 }}>{contact.name}</div>
        <button onClick={() => { if (confirm('Eliminare il contatto e tutti i movimenti?')) onDeleteContact() }} style={iconBtnStyle(theme)}>
          <Trash2 size={18} color={theme.expense} />
        </button>
      </div>

      <div style={{
        background: `${balance >= 0 ? theme.income : theme.expense}1f`, borderRadius: 20, padding: 20,
        textAlign: 'center', marginBottom: 18,
      }}>
        <div style={{ fontSize: 13, color: theme.subtext }}>
          {balance === 0 ? 'Saldo saldato' : balance > 0 ? `${contact.name} ti deve` : `Devi a ${contact.name}`}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: balance === 0 ? theme.subtext : (balance > 0 ? theme.income : theme.expense) }}>
          {fmtCurrency(Math.abs(balance))}
        </div>
      </div>

      <button onClick={() => setShowAdd(true)} style={{
        width: '100%', padding: 13, borderRadius: 14, border: `1px dashed ${theme.border}`,
        background: 'transparent', color: theme.primary, fontWeight: 700, marginBottom: 16, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <Plus size={16} /> Nuovo movimento
      </button>

      {entries.length === 0 && <div style={{ textAlign: 'center', color: theme.subtext, padding: 20 }}>Nessun movimento ancora</div>}

      {[...entries].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => {
        const positive = DEBT_TYPES[e.type].sign > 0
        const attachments = e.attachments || []
        return (
          <div key={e.id} style={{ background: theme.card, borderRadius: 16, padding: 12, marginBottom: 8 }}>
            <div onClick={() => { if (confirm('Eliminare questo movimento?')) onDelete(e.id) }} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <IconBubble name={positive ? 'income' : 'other'} color={positive ? theme.income : theme.expense} size={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>{DEBT_TYPES[e.type].label}</div>
                <div style={{ fontSize: 12, color: theme.subtext }}>{fmtDate(e.date)}{e.notes ? ` · ${e.notes}` : ''}{e.reminderDate ? ` · 🔔 ${new Date(e.reminderDate).toLocaleDateString('it-IT')}` : ''}</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: positive ? theme.income : theme.expense }}>
                {positive ? '+' : '-'}{fmtCurrency(e.amount)}
              </div>
            </div>
            <button
              onClick={() => setAttachEntry(e)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: theme.subtext, fontSize: 11, cursor: 'pointer', padding: '8px 0 0', marginLeft: 42 }}
            >
              <Paperclip size={12} /> {attachments.length > 0 ? `${attachments.length} prova/e allegata/e` : 'Aggiungi prova'}
            </button>
          </div>
        )
      })}

      {showAdd && (
        <AddDebtEntryModal theme={theme} reminderTime={reminderTime} remindersEnabled={remindersEnabled} onClose={() => setShowAdd(false)} onSave={(entry) => { onAdd(entry); setShowAdd(false) }} />
      )}

      {attachEntry && (
        <AttachmentsModal
          theme={theme} entry={attachEntry} onClose={() => setAttachEntry(null)}
          onChange={(atts) => { onUpdateAttachments(attachEntry.id, atts); setAttachEntry(prev => prev && { ...prev, attachments: atts }) }}
        />
      )}
    </div>
  )
}

function AddDebtEntryModal({ theme, onClose, onSave, reminderTime = '09:00', remindersEnabled = true }) {
  const [type, setType] = useState('loanGiven')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reminderDate, setReminderDate] = useState('')
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState([])

  const save = () => {
    const val = parseFloat(amount.replace(',', '.'))
    if (!val || val <= 0) { alert('Inserisci un importo valido'); return }
    onSave({
      id: uuid(), amount: val, type, date: new Date(date).toISOString(), notes, attachments,
      reminderDate: reminderDate ? new Date(`${reminderDate}T${reminderTime}:00`).toISOString() : null,
    })
  }

  return (
    <Modal theme={theme} title="Nuovo movimento" onClose={onClose}>
      <div style={{ fontSize: 13, fontWeight: 600, color: theme.subtext, marginBottom: 8 }}>Tipo di movimento</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {Object.entries(DEBT_TYPES).map(([key, val]) => (
          <ChipButton key={key} active={type === key} color={theme.primary} theme={theme} onClick={() => setType(key)}>{val.label}</ChipButton>
        ))}
      </div>

      <input
        style={{ ...inputStyle(theme), fontSize: 22, fontWeight: 700, textAlign: 'center', marginBottom: 18 }}
        placeholder="0,00 €" value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)}
      />

      <div style={{ fontSize: 13, fontWeight: 600, color: theme.subtext, marginBottom: 8 }}>Data</div>
      <input type="date" style={{ ...inputStyle(theme), marginBottom: 18 }} value={date} onChange={(e) => setDate(e.target.value)} />

      {type === 'loanGiven' && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.subtext, marginBottom: 8 }}>Promemoria riscossione (opzionale)</div>
          <input type="date" style={{ ...inputStyle(theme), marginBottom: reminderDate || !remindersEnabled ? 8 : 18 }} value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} />
          {reminderDate && remindersEnabled && (
            <div style={{ fontSize: 11, color: theme.subtext, marginBottom: 18 }}>Riceverai la notifica alle {reminderTime} del giorno scelto.</div>
          )}
          {!remindersEnabled && (
            <div style={{ fontSize: 11, color: theme.expense, marginBottom: 18 }}>Le notifiche di riscossione sono disattivate: attivale dal Profilo.</div>
          )}
        </>
      )}

      <input style={{ ...inputStyle(theme), marginBottom: 18 }} placeholder="Note (opzionale)" value={notes} onChange={(e) => setNotes(e.target.value)} />

      <div style={{ fontSize: 13, fontWeight: 600, color: theme.subtext, marginBottom: 8 }}>Prove (opzionale)</div>
      <div style={{ marginBottom: 22 }}>
        <AttachmentPicker theme={theme} attachments={attachments} onChange={setAttachments} />
      </div>

      <button onClick={save} style={{
        width: '100%', padding: 15, borderRadius: 14, border: 'none',
        background: theme.primary, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
      }}>
        Salva movimento
      </button>
    </Modal>
  )
}

function AddContactModal({ theme, onClose, onSave }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  return (
    <Modal theme={theme} title="Nuovo contatto" onClose={onClose}>
      <div style={{ fontSize: 12, color: theme.subtext, marginBottom: 14 }}>
        In versione web/APK il contatto va inserito manualmente (nessun accesso alla rubrica del telefono).
      </div>
      <input style={{ ...inputStyle(theme), marginBottom: 12 }} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
      <input style={{ ...inputStyle(theme), marginBottom: 22 }} placeholder="Telefono (opzionale)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <button
        onClick={() => { if (!name.trim()) { alert('Inserisci un nome'); return } onSave({ id: uuid(), name: name.trim(), phone: phone.trim() }); onClose() }}
        style={{ width: '100%', padding: 15, borderRadius: 14, border: 'none', background: theme.primary, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
      >
        Aggiungi contatto
      </button>
    </Modal>
  )
}

/* ============================================================
   SCHERMATA: IMPOSTAZIONI
   ============================================================ */

function SettingsScreen({ theme, settings, setSettings, exportBackup, importBackup, exportCsv }) {
  const fileInputRef = React.useRef(null)
  const [bioAvailable, setBioAvailable] = useState(false)

  useEffect(() => { biometricCheck().then(r => setBioAvailable(!!r.isAvailable)) }, [])

  const toggleBiometric = async (on) => {
    if (on) {
      const r = await biometricCheck()
      if (!r.isAvailable) { alert('Nessun sensore di impronta/Face ID disponibile o configurato su questo dispositivo.'); return }
      const ok = await biometricAuthenticate()
      if (!ok) { alert('Autenticazione non riuscita, riprova.'); return }
      setSettings(s => ({ ...s, biometricEnabled: true }))
    } else {
      setSettings(s => ({ ...s, biometricEnabled: false }))
    }
  }

  return (
    <div style={{ padding: 16, paddingBottom: 90 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: theme.text, marginBottom: 20 }}>Impostazioni</div>

      <div style={{ fontSize: 13, fontWeight: 700, color: theme.subtext, marginBottom: 8 }}>ASPETTO</div>
      <div style={{ background: theme.card, borderRadius: 16, padding: 6, marginBottom: 22 }}>
        {[
          { key: 'system', label: 'Automatico (sistema)', icon: Monitor },
          { key: 'light', label: 'Chiaro', icon: Sun },
          { key: 'dark', label: 'Scuro', icon: Moon },
        ].map(opt => (
          <div key={opt.key} onClick={() => setSettings(s => ({ ...s, theme: opt.key }))}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, cursor: 'pointer' }}>
            <opt.icon size={18} color={theme.subtext} />
            <div style={{ flex: 1, color: theme.text, fontSize: 14 }}>{opt.label}</div>
            {settings.theme === opt.key && <Check size={18} color={theme.primary} />}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: theme.subtext, marginBottom: 8 }}>SICUREZZA</div>
      <div style={{ background: theme.card, borderRadius: 16, padding: 16, marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Lock size={18} color={theme.subtext} />
          <div style={{ flex: 1 }}>
            <div style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>Blocco app (PIN)</div>
            <div style={{ color: theme.subtext, fontSize: 12 }}>Richiedi un PIN all'apertura</div>
          </div>
          <input type="checkbox" checked={settings.lockEnabled} onChange={(e) => {
            if (e.target.checked) {
              const pin = prompt('Imposta un PIN (min 4 cifre):')
              if (pin && pin.length >= 4) setSettings(s => ({ ...s, lockEnabled: true, pin }))
            } else {
              setSettings(s => ({ ...s, lockEnabled: false }))
            }
          }} style={{ width: 20, height: 20 }} />
        </div>

        {settings.lockEnabled && isNative && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${theme.border}` }}>
            <Fingerprint size={18} color={theme.subtext} />
            <div style={{ flex: 1 }}>
              <div style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>Impronta digitale / Face ID</div>
              <div style={{ color: theme.subtext, fontSize: 12 }}>
                {bioAvailable ? 'Sblocca l\'app senza inserire il PIN' : 'Non disponibile su questo dispositivo'}
              </div>
            </div>
            <input
              type="checkbox" checked={!!settings.biometricEnabled} disabled={!bioAvailable}
              onChange={(e) => toggleBiometric(e.target.checked)} style={{ width: 20, height: 20 }}
            />
          </div>
        )}
        {settings.lockEnabled && !isNative && (
          <div style={{ fontSize: 11, color: theme.subtext, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${theme.border}`, lineHeight: 1.4 }}>
            L'impronta digitale/Face ID è disponibile solo nell'app Android/iOS, non in questa anteprima web.
          </div>
        )}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: theme.subtext, marginBottom: 8 }}>BACKUP DATI</div>
      <div style={{ background: theme.card, borderRadius: 16, padding: 6, marginBottom: 22 }}>
        <div onClick={exportBackup} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, cursor: 'pointer' }}>
          <Upload size={18} color={theme.subtext} />
          <div style={{ color: theme.text, fontSize: 14 }}>Esporta backup completo (JSON)</div>
        </div>
        <div onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, cursor: 'pointer' }}>
          <FileText size={18} color={theme.subtext} />
          <div style={{ color: theme.text, fontSize: 14 }}>Esporta transazioni (CSV)</div>
        </div>
        <div onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, cursor: 'pointer' }}>
          <Download size={18} color={theme.subtext} />
          <div>
            <div style={{ color: theme.text, fontSize: 14 }}>Importa backup (JSON)</div>
            <div style={{ color: theme.subtext, fontSize: 11 }}>Sovrascrive tutti i dati attuali</div>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = '' }} />
      </div>

      <div style={{ textAlign: 'center', color: theme.subtext, fontSize: 11, marginTop: 30, lineHeight: 1.6 }}>
        Tutti i dati restano esclusivamente su questo dispositivo.<br />Nessun server, nessun cloud.
      </div>
    </div>
  )
}

/* ============================================================
   WELCOME PAGE (ONBOARDING)
   ============================================================ */

function ProgressDots({ theme, step, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: total }, (_, i) => i + 1).map(i => (
        <span key={i} style={{
          width: i === step ? 18 : 6, height: 6, borderRadius: 999,
          background: i === step ? theme.primary : theme.border, transition: 'all .2s',
        }} />
      ))}
    </div>
  )
}

function Onboarding({ theme, onFinish }) {
  const [step, setStep] = useState(1)

  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [netWorth, setNetWorth] = useState('')
  const [salary, setSalary] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')

  const [cats, setCats] = useState(() => DEFAULT_CATEGORIES.map(c => ({ ...c })))

  const [onboardContacts, setOnboardContacts] = useState([])
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  useEffect(() => { window.scrollTo(0, 0) }, [step])

  const goStep2 = () => {
    if (!name.trim()) { setError('Inserisci il tuo nome'); return }
    if (!accepted) { setError("Devi accettare l'informativa per continuare"); return }
    setError('')
    setStep(2)
  }

  const addOnboardContact = () => {
    if (!contactName.trim()) return
    setOnboardContacts(prev => [...prev, { id: uuid(), name: contactName.trim(), phone: contactPhone.trim() }])
    setContactName('')
    setContactPhone('')
  }
  const removeOnboardContact = (id) => setOnboardContacts(prev => prev.filter(c => c.id !== id))

  const finish = () => {
    onFinish({
      profile: {
        name: name.trim(),
        birthYear: birthYear ? parseInt(birthYear, 10) : null,
        netWorth: netWorth ? parseFloat(netWorth.replace(',', '.')) : 0,
        salary: salary ? parseFloat(salary.replace(',', '.')) : 0,
      },
      categories: cats,
      contacts: onboardContacts,
    })
  }

  return (
    <div style={{ height: '100%', background: theme.bg, display: 'flex', flexDirection: 'column', padding: '32px 20px 20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0 }}>
        <div style={{ width: 40 }} />
        <ProgressDots theme={theme} step={step} total={3} />
        {step > 1 ? (
          <button
            onClick={() => step < 3 ? setStep(step + 1) : finish()}
            style={{ background: 'none', border: 'none', color: theme.subtext, fontSize: 13, cursor: 'pointer' }}
          >
            Salta
          </button>
        ) : <div style={{ width: 40 }} />}
      </div>

      <div style={{ flex: 1 }}>
        {step === 1 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20, background: theme.primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <Wallet size={30} color="#fff" />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: theme.text }}>Benvenuto in Money Tracker</div>
              <div style={{ fontSize: 13, color: theme.subtext, marginTop: 8, lineHeight: 1.5 }}>
                Qualche informazione per iniziare — puoi modificare tutto in qualsiasi momento dal Profilo.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.subtext, marginBottom: 6 }}>Nome</div>
                <input style={inputStyle(theme)} value={name} onChange={(e) => setName(e.target.value)} placeholder="Il tuo nome" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.subtext, marginBottom: 6 }}>Anno di nascita (opzionale)</div>
                <input type="number" inputMode="numeric" style={inputStyle(theme)} value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="es. 1994" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.subtext, marginBottom: 6 }}>Patrimonio attuale € (opzionale)</div>
                <input inputMode="decimal" style={inputStyle(theme)} value={netWorth} onChange={(e) => setNetWorth(e.target.value)} placeholder="es. 5000" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.subtext, marginBottom: 6 }}>Stipendio mensile € (opzionale)</div>
                <input inputMode="decimal" style={inputStyle(theme)} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="es. 1500" />
              </div>

              <div style={{ background: theme.card, borderRadius: 16, padding: 16, marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Lock size={16} color={theme.text} />
                  <div style={{ color: theme.text, fontSize: 13, fontWeight: 700 }}>Privacy e utilizzo dei dati</div>
                </div>
                <div style={{ maxHeight: 160, overflowY: 'auto', color: theme.subtext, fontSize: 12, lineHeight: 1.6, paddingRight: 4 }}>
                  <p style={{ margin: '0 0 8px' }}>
                    Money Tracker funziona interamente offline: nessun server, nessun account, nessuna connessione a internet richiesta per usarla.
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <b style={{ color: theme.text }}>Cosa raccogliamo:</b> nome, anno di nascita, patrimonio e stipendio (solo se li inserisci — tutti opzionali tranne il nome), le transazioni, i contatti e i movimenti di credito/debito che registri.
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <b style={{ color: theme.text }}>Dove vengono salvati:</b> esclusivamente nella memoria locale del tuo telefono. Nessun dato viene mai inviato, sincronizzato o condiviso con server esterni o terze parti.
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <b style={{ color: theme.text }}>Cookie e tracciamento:</b> nessuno. Nessuna pubblicità, nessuna analisi statistica del comportamento.
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <b style={{ color: theme.text }}>Notifiche:</b> i promemoria di riscossione crediti restano sul dispositivo e richiedono il permesso di notifica del sistema, revocabile in qualsiasi momento dalle impostazioni del telefono.
                  </p>
                  <p style={{ margin: 0 }}>
                    <b style={{ color: theme.text }}>Cancellazione:</b> puoi eliminare tutti i dati in ogni momento disinstallando l'app o da Impostazioni Android → App → Money Tracker → Cancella dati.
                  </p>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
                    style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
                  />
                  <span style={{ color: theme.text, fontSize: 12, lineHeight: 1.4 }}>Ho letto e accetto questa informativa</span>
                </label>
              </div>

              {error && <div style={{ color: theme.expense, fontSize: 12 }}>{error}</div>}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>Categorie di spesa</div>
              <div style={{ fontSize: 13, color: theme.subtext, marginTop: 6, lineHeight: 1.5 }}>
                Sono già pronte con nome e colore: modificale, eliminale o aggiungine di nuove — potrai sempre cambiarle dopo dal Profilo.
              </div>
            </div>

            <CategoryEditor theme={theme} cats={cats} onChange={setCats} onRemove={(id) => setCats(prev => prev.filter(c => c.id !== id))} />
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>Contatti</div>
              <div style={{ fontSize: 13, color: theme.subtext, marginTop: 6, lineHeight: 1.5 }}>
                Aggiungi le persone con cui hai crediti o debiti in sospeso — puoi aggiungerne altri in qualsiasi momento.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input style={{ ...inputStyle(theme), flex: 1 }} placeholder="Nome" value={contactName} onChange={(e) => setContactName(e.target.value)} />
              <input style={{ ...inputStyle(theme), width: 110 }} placeholder="Telefono" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              <button onClick={addOnboardContact} style={{ ...iconBtnStyle(theme), width: 46, background: theme.primary }}>
                <Plus size={18} color="#fff" />
              </button>
            </div>

            {onboardContacts.length === 0 && (
              <div style={{ color: theme.subtext, fontSize: 13, padding: '12px 0' }}>Nessun contatto ancora — puoi anche saltare questo passaggio.</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {onboardContacts.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: theme.card, borderRadius: 14, padding: 10 }}>
                  <div style={{ flex: 1, color: theme.text, fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                  {c.phone && <div style={{ color: theme.subtext, fontSize: 12 }}>{c.phone}</div>}
                  <button onClick={() => removeOnboardContact(c.id)} style={iconBtnStyle(theme)}><Trash2 size={15} color={theme.expense} /></button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, flexShrink: 0 }}>
        {step > 1 ? (
          <button
            onClick={() => setStep(step - 1)}
            style={{ padding: '12px 22px', borderRadius: 14, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text, fontWeight: 700, cursor: 'pointer' }}
          >
            Indietro
          </button>
        ) : <span />}
        {step === 1 && (
          <button onClick={goStep2} style={{ padding: '12px 28px', borderRadius: 14, border: 'none', background: theme.primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Avanti
          </button>
        )}
        {step === 2 && (
          <button onClick={() => setStep(3)} style={{ padding: '12px 28px', borderRadius: 14, border: 'none', background: theme.primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Avanti
          </button>
        )}
        {step === 3 && (
          <button onClick={finish} style={{ padding: '12px 28px', borderRadius: 14, border: 'none', background: theme.primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Fine
          </button>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   SCHERMATA: PROFILO
   ============================================================ */

function ProfileScreen({
  theme, profile, onSaveProfile, categories, onCategoriesChange, onRemoveCategory,
  remindersEnabled, onToggleReminders, reminderTime, onChangeReminderTime,
}) {
  const [name, setName] = useState(profile.name || '')
  const [birthYear, setBirthYear] = useState(profile.birthYear ? String(profile.birthYear) : '')
  const [netWorth, setNetWorth] = useState(profile.netWorth ? String(profile.netWorth) : '')
  const [salary, setSalary] = useState(profile.salary ? String(profile.salary) : '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [perm, setPerm] = useState('unknown')

  useEffect(() => { checkNotificationPermission().then(setPerm) }, [])

  const num = (v) => {
    const n = parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  const save = () => {
    if (!name.trim()) { setError('Il nome è obbligatorio'); setSaved(false); return }
    const y = birthYear ? parseInt(birthYear, 10) : null
    if (y !== null && (y < 1900 || y > new Date().getFullYear())) { setError('Anno di nascita non valido'); setSaved(false); return }
    setError('')
    onSaveProfile({ name: name.trim(), birthYear: y, netWorth: num(netWorth), salary: num(salary) })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggle = async (on) => {
    if (on) setPerm(await requestNotificationPermission())
    onToggleReminders(on)
  }

  const askPermission = async () => setPerm(await requestNotificationPermission())

  const fieldLabel = { fontSize: 12, fontWeight: 600, color: theme.subtext, marginBottom: 6 }
  const sectionTitle = { fontSize: 13, fontWeight: 700, color: theme.subtext, margin: '22px 0 8px' }

  return (
    <div style={{ padding: 16, paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 18, background: theme.primary, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800,
        }}>
          {(profile.name || '?').trim().charAt(0).toUpperCase() || '?'}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: theme.text }}>Profilo</div>
      </div>

      <div style={sectionTitle}>DATI PERSONALI</div>
      <div style={{ background: theme.card, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={fieldLabel}>Nome</div>
          <input style={inputStyle(theme)} value={name} onChange={(e) => setName(e.target.value)} placeholder="Il tuo nome" />
        </div>
        <div>
          <div style={fieldLabel}>Anno di nascita</div>
          <input type="number" inputMode="numeric" style={inputStyle(theme)} value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="es. 1994" />
        </div>
        <div>
          <div style={fieldLabel}>Patrimonio iniziale €</div>
          <input inputMode="decimal" style={inputStyle(theme)} value={netWorth} onChange={(e) => setNetWorth(e.target.value)} placeholder="es. 5000" />
        </div>
        <div>
          <div style={fieldLabel}>Stipendio mensile €</div>
          <input inputMode="decimal" style={inputStyle(theme)} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="es. 1500" />
        </div>

        {error && <div style={{ color: theme.expense, fontSize: 12 }}>{error}</div>}
        {saved && <div style={{ color: theme.income, fontSize: 12 }}>Profilo salvato!</div>}

        <button onClick={save} style={{
          width: '100%', padding: 13, borderRadius: 12, border: 'none',
          background: theme.primary, color: '#fff', fontWeight: 700, cursor: 'pointer', marginTop: 4,
        }}>
          Salva modifiche
        </button>
      </div>

      <div style={sectionTitle}>CATEGORIE</div>
      <div style={{ background: theme.card, borderRadius: 16, padding: 16 }}>
        <CategoryEditor theme={theme} cats={categories} onChange={onCategoriesChange} onRemove={onRemoveCategory} includeIncome />
      </div>

      <div style={sectionTitle}>NOTIFICHE PROMEMORIA</div>
      <div style={{ background: theme.card, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bell size={18} color={theme.subtext} />
          <div style={{ flex: 1 }}>
            <div style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>Notifiche riscossione</div>
            <div style={{ color: theme.subtext, fontSize: 12 }}>Promemoria per i prestiti erogati</div>
          </div>
          <input type="checkbox" checked={remindersEnabled} onChange={(e) => toggle(e.target.checked)} style={{ width: 20, height: 20 }} />
        </div>

        {remindersEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${theme.border}` }}>
            <div style={{ color: theme.text, fontSize: 13 }}>Orario di notifica predefinito</div>
            <input type="time" style={{ ...inputStyle(theme), width: 'auto', padding: '6px 10px' }} value={reminderTime} onChange={(e) => onChangeReminderTime(e.target.value)} />
          </div>
        )}

        {perm === 'denied' && (
          <div style={{ color: theme.expense, fontSize: 11, lineHeight: 1.4 }}>
            Le notifiche sono bloccate dal sistema operativo. Per attivarle, vai nelle impostazioni del telefono → Notifiche → Money Tracker.
          </div>
        )}
        {perm === 'prompt' && (
          <button onClick={askPermission} style={{ background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 10, padding: 8, color: theme.primary, fontSize: 12, cursor: 'pointer' }}>
            Richiedi permesso notifiche
          </button>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   SCHERMATA BLOCCO PIN
   ============================================================ */

function PinLockScreen({ theme, expectedPin, onUnlock, biometricEnabled }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const tryBiometric = useCallback(async () => {
    if (!biometricEnabled) return
    const ok = await biometricAuthenticate()
    if (ok) onUnlock()
  }, [biometricEnabled, onUnlock])

  useEffect(() => {
    tryBiometric()
  }, [tryBiometric])

  const press = (digit) => {
    if (pin.length >= 8) return
    const next = pin + digit
    setPin(next)
    setError(false)
    if (next === expectedPin) {
      onUnlock()
    } else if (next.length >= expectedPin.length && next !== expectedPin) {
      setError(true)
      setTimeout(() => { setPin(''); setError(false) }, 600)
    }
  }

  const del = () => setPin(p => p.slice(0, -1))

  return (
    <div style={{
      position: 'fixed', inset: 0, background: theme.bg, zIndex: 200,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: 56, height: 56, borderRadius: 18, background: `${theme.primary}26`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Lock size={26} color={theme.primary} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 8 }}>Money Tracker</div>
      <div style={{ fontSize: 13, color: error ? theme.expense : theme.subtext, marginBottom: 24 }}>
        {error ? 'PIN errato, riprova' : 'Inserisci il PIN per sbloccare'}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
        {Array.from({ length: Math.max(4, expectedPin.length) }).map((_, i) => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%',
            background: i < pin.length ? (error ? theme.expense : theme.primary) : theme.border,
            transition: 'all .2s',
          }} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, width: '100%', maxWidth: 280 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button key={d} onClick={() => press(d)} style={{
            height: 60, borderRadius: 18, border: 'none', background: theme.card, color: theme.text,
            fontSize: 22, fontWeight: 700, cursor: 'pointer',
          }}>
            {d}
          </button>
        ))}
        {biometricEnabled && isNative ? (
          <button onClick={tryBiometric} style={{
            height: 60, borderRadius: 18, border: 'none', background: theme.card, color: theme.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <Fingerprint size={24} />
          </button>
        ) : <span />}
        <button onClick={() => press('0')} style={{
          height: 60, borderRadius: 18, border: 'none', background: theme.card, color: theme.text,
          fontSize: 22, fontWeight: 700, cursor: 'pointer',
        }}>
          0
        </button>
        <button onClick={del} style={{
          height: 60, borderRadius: 18, border: 'none', background: theme.card, color: theme.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <X size={20} />
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   APP PRINCIPALE
   ============================================================ */

export default function App() {
  const [profile, setProfile] = useLocalStorageState('mt_profile', null)
  const [categories, setCategories] = useLocalStorageState('mt_categories', DEFAULT_CATEGORIES)
  const [accounts, setAccounts] = useLocalStorageState('mt_accounts', DEFAULT_ACCOUNTS)
  const [transactions, setTransactions] = useLocalStorageState('mt_transactions', [])
  const [contacts, setContacts] = useLocalStorageState('mt_contacts', [])
  const [debtEntries, setDebtEntries] = useLocalStorageState('mt_debt_entries', [])
  const [goals, setGoals] = useLocalStorageState('mt_goals', [])
  const [settings, setSettings] = useLocalStorageState('mt_settings', {
    theme: 'system', lockEnabled: false, pin: '', biometricEnabled: false,
    remindersEnabled: true, reminderTime: '09:00',
  })

  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedContactId, setSelectedContactId] = useState(null)
  const [showAddTx, setShowAddTx] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [locked, setLocked] = useState(() => settings.lockEnabled && !!settings.pin)

  const theme = useTheme(settings.theme)

  useEffect(() => {
    debtEntries.forEach(e => {
      if (e.reminderDate && e.type === 'loanGiven' && settings.remindersEnabled) {
        const c = contacts.find(x => x.id === e.contactId)
        if (c) scheduleDebtReminder(e, c.name)
      }
    })
  }, [debtEntries, contacts, settings.remindersEnabled])

  const finishOnboarding = ({ profile: p, categories: c, contacts: cnt }) => {
    setProfile(p)
    if (c?.length) setCategories(c)
    if (cnt?.length) setContacts(cnt)
    if (p.netWorth) {
      setAccounts(prev => prev.map(a => a.id === 'bank' ? { ...a, initialBalance: p.netWorth } : a))
    }
  }

  const handleAddTx = (tx) => setTransactions(prev => [tx, ...prev])
  const handleDeleteTx = (id) => setTransactions(prev => prev.filter(t => t.id !== id))

  const handleAddContact = (c) => setContacts(prev => [...prev, c])
  const handleDeleteContact = (contactId) => {
    debtEntries.filter(e => e.contactId === contactId).forEach(e => cancelDebtReminder(e.id))
    setContacts(prev => prev.filter(c => c.id !== contactId))
    setDebtEntries(prev => prev.filter(e => e.contactId !== contactId))
    setSelectedContactId(null)
  }

  const handleAddDebtEntry = (entry) => {
    const full = { ...entry, contactId: selectedContactId }
    setDebtEntries(prev => [full, ...prev])
    if (full.type === 'loanGiven' && settings.remindersEnabled && full.reminderDate) {
      const c = contacts.find(x => x.id === selectedContactId)
      if (c) scheduleDebtReminder(full, c.name)
    }
  }

  const handleDeleteDebtEntry = (id) => {
    cancelDebtReminder(id)
    setDebtEntries(prev => prev.filter(e => e.id !== id))
  }

  const handleUpdateAttachments = (entryId, attachments) => {
    setDebtEntries(prev => prev.map(e => e.id === entryId ? { ...e, attachments } : e))
  }

  const handleAddGoal = (g) => setGoals(prev => [g, ...prev])
  const handleDeleteGoal = (id) => setGoals(prev => prev.filter(g => g.id !== id))

  const exportBackup = () => {
    const data = { profile, categories, accounts, transactions, contacts, debtEntries, goals, settings, version: 1 }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `money-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCsv = () => {
    const headers = ['ID', 'Data', 'Tipo', 'Importo', 'Categoria', 'Conto', 'Note']
    const rows = transactions.map(t => {
      const cat = catView(t, categories)
      const acc = accounts.find(a => a.id === t.accountId)
      return [
        t.id,
        t.date,
        t.isExpense ? 'Uscita' : 'Entrata',
        t.amount,
        `"${cat.name.replace(/"/g, '""')}"`,
        `"${(acc?.name || '').replace(/"/g, '""')}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transazioni-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (data.profile !== undefined) setProfile(data.profile)
        if (data.categories) setCategories(data.categories)
        if (data.accounts) setAccounts(data.accounts)
        if (data.transactions) setTransactions(data.transactions)
        if (data.contacts) setContacts(data.contacts)
        if (data.debtEntries) setDebtEntries(data.debtEntries)
        if (data.goals) setGoals(data.goals)
        if (data.settings) setSettings(data.settings)
        alert('Backup importato con successo!')
      } catch {
        alert('File di backup non valido')
      }
    }
    reader.readAsText(file)
  }

  if (locked && settings.lockEnabled && settings.pin) {
    return <PinLockScreen theme={theme} expectedPin={settings.pin} biometricEnabled={settings.biometricEnabled} onUnlock={() => setLocked(false)} />
  }

  if (!profile) {
    return <Onboarding theme={theme} onFinish={finishOnboarding} />
  }

  const selectedContact = contacts.find(c => c.id === selectedContactId)

  return (
    <div style={{
      background: theme.bg, minHeight: '100vh', color: theme.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', position: 'relative' }}>
        {activeTab === 'dashboard' && (
          <DashboardScreen
            theme={theme} transactions={transactions} accounts={accounts} categories={categories}
            contacts={contacts} debtEntries={debtEntries} profile={profile} goals={goals}
            onAddGoal={handleAddGoal} onDeleteGoal={handleDeleteGoal}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsScreen
            theme={theme} transactions={transactions} categories={categories}
            accounts={accounts} onDelete={handleDeleteTx}
          />
        )}

        {activeTab === 'analysis' && (
          <AnalysisScreen theme={theme} transactions={transactions} categories={categories} />
        )}

        {activeTab === 'debts' && !selectedContactId && (
          <DebtsScreen
            theme={theme} contacts={contacts} debtEntries={debtEntries}
            onOpenContact={setSelectedContactId}
          />
        )}

        {activeTab === 'debts' && selectedContactId && selectedContact && (
          <ContactDetailScreen
            theme={theme} contact={selectedContact}
            entries={debtEntries.filter(e => e.contactId === selectedContactId)}
            onBack={() => setSelectedContactId(null)}
            onAdd={handleAddDebtEntry}
            onDelete={handleDeleteDebtEntry}
            onDeleteContact={() => handleDeleteContact(selectedContactId)}
            onUpdateAttachments={handleUpdateAttachments}
            reminderTime={settings.reminderTime}
            remindersEnabled={settings.remindersEnabled}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            theme={theme} profile={profile} onSaveProfile={setProfile}
            categories={categories} onCategoriesChange={setCategories}
            onRemoveCategory={(id) => setCategories(prev => prev.filter(c => c.id !== id))}
            remindersEnabled={settings.remindersEnabled}
            onToggleReminders={(on) => setSettings(s => ({ ...s, remindersEnabled: on }))}
            reminderTime={settings.reminderTime}
            onChangeReminderTime={(t) => setSettings(s => ({ ...s, reminderTime: t }))}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsScreen
            theme={theme} settings={settings} setSettings={setSettings}
            exportBackup={exportBackup} importBackup={importBackup} exportCsv={exportCsv}
          />
        )}

        {/* BARRA DI NAVIGAZIONE IN BASSO */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card,
          borderTop: `1px solid ${theme.border}`, zIndex: 40,
        }}>
          <div style={{
            maxWidth: 480, margin: '0 auto', height: 64, display: 'flex',
            alignItems: 'center', justifyContent: 'space-around', padding: '0 8px',
          }}>
            <button
              onClick={() => { setActiveTab('dashboard'); setSelectedContactId(null) }}
              style={{ background: 'none', border: 'none', color: activeTab === 'dashboard' ? theme.primary : theme.subtext, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', flex: 1 }}
            >
              <LayoutDashboard size={20} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>Home</span>
            </button>

            <button
              onClick={() => { setActiveTab('transactions'); setSelectedContactId(null) }}
              style={{ background: 'none', border: 'none', color: activeTab === 'transactions' ? theme.primary : theme.subtext, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', flex: 1 }}
            >
              <Receipt size={20} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>Movimenti</span>
            </button>

            <button
              onClick={() => { setActiveTab('analysis'); setSelectedContactId(null) }}
              style={{ background: 'none', border: 'none', color: activeTab === 'analysis' ? theme.primary : theme.subtext, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', flex: 1 }}
            >
              <BarChart3 size={20} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>Analisi</span>
            </button>

            {/* BOTTONE AZIONE CENTRALE (+) */}
            <button
              onClick={() => {
                if (activeTab === 'debts') setShowAddContact(true)
                else setShowAddTx(true)
              }}
              style={{
                width: 48, height: 48, borderRadius: '50%', background: theme.primary,
                border: 'none', color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
                transform: 'translateY(-12px)', flexShrink: 0,
              }}
            >
              <Plus size={24} />
            </button>

            <button
              onClick={() => setActiveTab('debts')}
              style={{ background: 'none', border: 'none', color: activeTab === 'debts' ? theme.primary : theme.subtext, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', flex: 1 }}
            >
              <Users size={20} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>Debiti</span>
            </button>

            <button
              onClick={() => { setActiveTab('profile'); setSelectedContactId(null) }}
              style={{ background: 'none', border: 'none', color: activeTab === 'profile' ? theme.primary : theme.subtext, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', flex: 1 }}
            >
              <User size={20} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>Profilo</span>
            </button>

            <button
              onClick={() => { setActiveTab('settings'); setSelectedContactId(null) }}
              style={{ background: 'none', border: 'none', color: activeTab === 'settings' ? theme.primary : theme.subtext, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', flex: 1 }}
            >
              <SettingsIcon size={20} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>Opzioni</span>
            </button>
          </div>
        </div>

        {/* MODALI */}
        {showAddTx && (
          <AddTransactionModal
            theme={theme} categories={categories} accounts={accounts}
            onClose={() => setShowAddTx(false)} onSave={handleAddTx}
          />
        )}

        {showAddContact && (
          <AddContactModal
            theme={theme} onClose={() => setShowAddContact(false)} onSave={handleAddContact}
          />
        )}
      </div>
    </div>
  )
}