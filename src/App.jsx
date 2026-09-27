import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, ResponsiveContainer, Tooltip,
} from 'recharts'
import {
  LayoutDashboard, Receipt, Users, Settings as SettingsIcon, Plus, X,
  ArrowUpRight, ArrowDownRight, Utensils, Car, Home, HeartPulse, Film,
  ShoppingBag, FileText, MoreHorizontal, Briefcase, Gift, DollarSign,
  UserPlus, Trash2, Calendar, Bell, Lock, Upload, Download, Sun, Moon,
  Monitor, Check, ChevronLeft, Wallet,
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

const CATEGORY_PALETTE = [
  '#f97316', '#3b82f6', '#92400e', '#ef4444', '#a855f7', '#ec4899',
  '#14b8a6', '#6b7280', '#22c55e', '#f59e0b', '#84cc16', '#06b6d4', '#8b5cf6', '#ea580c',
]

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
   NOTIFICHE LOCALI (promemoria riscossione crediti)
   ============================================================ */

const isNative = Capacitor.isNativePlatform()

// Le notifiche locali richiedono un id numerico: lo deriviamo dall'id (stringa) del movimento
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

// Pianifica un promemoria per riscuotere un credito (solo per movimenti di tipo "loanGiven")
function scheduleDebtReminder(entry, contactName) {
  if (!entry.reminderDate) return
  const target = new Date(entry.reminderDate)
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

  // Fallback web: funziona solo mentre la pagina resta aperta (limite della Notification API)
  if (typeof Notification === 'undefined') return
  const ms = target.getTime() - Date.now()
  if (ms <= 0) return
  setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification('Promemoria credito', { body })
    }
  }, ms)
}

function cancelDebtReminder(entryId) {
  if (isNative) {
    LocalNotifications.cancel({ notifications: [{ id: reminderNumId(entryId) }] }).catch(() => {})
  }
  // Su web non è possibile annullare un setTimeout dopo un reload della pagina (limitazione nota)
}

/* ============================================================
   TEMA (chiaro / scuro / automatico)
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

/* ============================================================
   GRAFICI
   ============================================================ */

function ExpensePie({ theme, data }) {
  if (!data.length) {
    return <div style={{ padding: '30px 0', textAlign: 'center', color: theme.subtext, fontSize: 13 }}>Nessuna spesa questo mese</div>
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

function DashboardScreen({ theme, transactions, accounts, categories, contacts, debtEntries, profile }) {
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
      .forEach(t => { map[t.categoryId] = (map[t.categoryId] || 0) + t.amount })
    return Object.entries(map).map(([catId, value]) => {
      const cat = categories.find(c => c.id === catId)
      return { name: cat?.name || catId, value, color: cat?.color || '#6b7280' }
    })
  }, [transactions, categories])

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
    </div>
  )
}

/* ============================================================
   SCHERMATA: TRANSAZIONI
   ============================================================ */

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
            const cat = categories.find(c => c.id === t.categoryId)
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
                <IconBubble name={cat?.icon} color={cat?.color || '#6b7280'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: theme.text, fontSize: 14 }}>{cat?.name || 'Senza categoria'}</div>
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
    onSave({ id: uuid(), amount: val, isExpense, categoryId, accountId, date: new Date(date).toISOString(), notes })
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

function ContactDetailScreen({ theme, contact, entries, onBack, onAdd, onDelete, onDeleteContact }) {
  const balance = entries.reduce((s, e) => s + e.amount * DEBT_TYPES[e.type].sign, 0)
  const [showAdd, setShowAdd] = useState(false)

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
        return (
          <div key={e.id} onClick={() => { if (confirm('Eliminare questo movimento?')) onDelete(e.id) }} style={{
            display: 'flex', alignItems: 'center', gap: 12, background: theme.card,
            borderRadius: 16, padding: 12, marginBottom: 8, cursor: 'pointer',
          }}>
            <IconBubble name={positive ? 'income' : 'other'} color={positive ? theme.income : theme.expense} size={16} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>{DEBT_TYPES[e.type].label}</div>
              <div style={{ fontSize: 12, color: theme.subtext }}>{fmtDate(e.date)}{e.notes ? ` · ${e.notes}` : ''}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: positive ? theme.income : theme.expense }}>
              {positive ? '+' : '-'}{fmtCurrency(e.amount)}
            </div>
          </div>
        )
      })}

      {showAdd && (
        <AddDebtEntryModal theme={theme} onClose={() => setShowAdd(false)} onSave={(entry) => { onAdd(entry); setShowAdd(false) }} />
      )}
    </div>
  )
}

function AddDebtEntryModal({ theme, onClose, onSave }) {
  const [type, setType] = useState('loanGiven')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reminderDate, setReminderDate] = useState('')
  const [notes, setNotes] = useState('')

  const save = () => {
    const val = parseFloat(amount.replace(',', '.'))
    if (!val || val <= 0) { alert('Inserisci un importo valido'); return }
    onSave({
      id: uuid(), amount: val, type, date: new Date(date).toISOString(), notes,
      reminderDate: reminderDate ? new Date(reminderDate).toISOString() : null,
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
          <input type="date" style={{ ...inputStyle(theme), marginBottom: 18 }} value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} />
        </>
      )}

      <input style={{ ...inputStyle(theme), marginBottom: 22 }} placeholder="Note (opzionale)" value={notes} onChange={(e) => setNotes(e.target.value)} />

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
  const [notifPermission, setNotifPermission] = useState('unknown')

  useEffect(() => { checkNotificationPermission().then(setNotifPermission) }, [])

  const enableNotifications = async () => {
    const p = await requestNotificationPermission()
    setNotifPermission(p)
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
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: theme.subtext, marginBottom: 8 }}>NOTIFICHE</div>
      <div style={{ background: theme.card, borderRadius: 16, padding: 16, marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bell size={18} color={theme.subtext} />
          <div style={{ flex: 1 }}>
            <div style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>Promemoria crediti</div>
            <div style={{ color: theme.subtext, fontSize: 12 }}>
              {notifPermission === 'granted' ? 'Notifiche attive' : 'Attiva per ricevere i promemoria di riscossione'}
            </div>
          </div>
          {notifPermission === 'granted' ? (
            <Check size={18} color={theme.income} />
          ) : (
            <button onClick={enableNotifications} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: theme.primary, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Abilita
            </button>
          )}
        </div>
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

  // Step 1 — profilo e privacy
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [netWorth, setNetWorth] = useState('')
  const [salary, setSalary] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')

  // Step 2 — categorie di spesa preimpostate
  const [cats, setCats] = useState(() => DEFAULT_CATEGORIES.map(c => ({ ...c })))
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState(CATEGORY_PALETTE[0])
  const [editingColorId, setEditingColorId] = useState(null)

  // Step 3 — contatti crediti/debiti
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

  const renameCategory = (id, val) => setCats(prev => prev.map(c => c.id === id ? { ...c, name: val } : c))
  const recolorCategory = (id, color) => setCats(prev => prev.map(c => c.id === id ? { ...c, color } : c))
  const removeCategory = (id) => setCats(prev => prev.filter(c => c.id !== id))
  const addCategory = () => {
    if (!newCatName.trim()) return
    setCats(prev => [...prev, { id: uuid(), name: newCatName.trim(), icon: 'other', color: newCatColor, isExpense: true }])
    setNewCatName('')
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

  const expenseCats = cats.filter(c => c.isExpense)

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
                Qualche informazione per iniziare — puoi modificare tutto in qualsiasi momento dalle Impostazioni.
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
                Sono già pronte con nome e colore: modificale, eliminale o aggiungine di nuove — potrai sempre cambiarle dopo dalle Impostazioni.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {expenseCats.map(c => (
                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: theme.card, borderRadius: 14, padding: 10 }}>
                    <button
                      onClick={() => setEditingColorId(editingColorId === c.id ? null : c.id)}
                      style={{ width: 26, height: 26, borderRadius: '50%', background: c.color, border: 'none', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <input
                      value={c.name} onChange={(e) => renameCategory(c.id, e.target.value)}
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: theme.text, fontSize: 14, fontWeight: 600 }}
                    />
                    <button onClick={() => removeCategory(c.id)} style={iconBtnStyle(theme)}><Trash2 size={15} color={theme.expense} /></button>
                  </div>
                  {editingColorId === c.id && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 2px 4px' }}>
                      {CATEGORY_PALETTE.map(col => (
                        <button
                          key={col} onClick={() => { recolorCategory(c.id, col); setEditingColorId(null) }}
                          style={{ width: 24, height: 24, borderRadius: '50%', background: col, border: 'none', cursor: 'pointer' }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {expenseCats.length === 0 && (
                <div style={{ color: theme.subtext, fontSize: 13, padding: '8px 0' }}>Nessuna categoria di spesa attiva.</div>
              )}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: theme.subtext, marginBottom: 8 }}>Nuova categoria</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input style={{ ...inputStyle(theme), flex: 1 }} placeholder="es. Studio, Palestra..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
              <button onClick={addCategory} style={{ ...iconBtnStyle(theme), width: 46, background: theme.primary }}>
                <Plus size={18} color="#fff" />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CATEGORY_PALETTE.map(col => (
                <button
                  key={col} onClick={() => setNewCatColor(col)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', background: col, cursor: 'pointer',
                    border: newCatColor === col ? `2px solid ${theme.text}` : '2px solid transparent',
                  }}
                />
              ))}
            </div>
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
   LOCK SCREEN (PIN)
   ============================================================ */

function LockScreen({ theme, pin, onUnlock }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const check = () => {
    if (input === pin) onUnlock()
    else { setError(true); setInput('') }
  }

  return (
    <div style={{ height: '100%', background: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Lock size={56} color={theme.primary} />
      <div style={{ fontSize: 19, fontWeight: 700, color: theme.text, marginTop: 16 }}>App bloccata</div>
      <div style={{ fontSize: 13, color: theme.subtext, marginTop: 4, marginBottom: 24 }}>Inserisci il PIN per continuare</div>
      <input
        type="password" inputMode="numeric" maxLength={6} value={input}
        onChange={(e) => { setInput(e.target.value); setError(false) }}
        onKeyDown={(e) => e.key === 'Enter' && check()}
        style={{ ...inputStyle(theme), width: 160, textAlign: 'center', fontSize: 22, letterSpacing: 6, marginBottom: 8 }}
        placeholder="••••" autoFocus
      />
      {error && <div style={{ color: theme.expense, fontSize: 12, marginBottom: 12 }}>PIN errato</div>}
      <button onClick={check} style={{ marginTop: 16, padding: '12px 40px', borderRadius: 14, border: 'none', background: theme.primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
        Sblocca
      </button>
    </div>
  )
}

/* ============================================================
   BOTTOM NAVIGATION
   ============================================================ */

function BottomNav({ theme, tab, setTab }) {
  const items = [
    { key: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { key: 'transactions', label: 'Movimenti', icon: Receipt },
    { key: 'debts', label: 'Crediti', icon: Users },
    { key: 'settings', label: 'Impostazioni', icon: SettingsIcon },
  ]
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card,
      borderTop: `1px solid ${theme.border}`, display: 'flex', paddingBottom: 'env(safe-area-inset-bottom, 6px)',
    }}>
      {items.map(it => (
        <div key={it.key} onClick={() => setTab(it.key)} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '10px 0 6px', cursor: 'pointer',
        }}>
          <it.icon size={20} color={tab === it.key ? theme.primary : theme.subtext} />
          <div style={{ fontSize: 10, color: tab === it.key ? theme.primary : theme.subtext, fontWeight: tab === it.key ? 700 : 400 }}>
            {it.label}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ============================================================
   APP PRINCIPALE
   ============================================================ */

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [unlocked, setUnlocked] = useState(false)
  const [activeContactId, setActiveContactId] = useState(null)
  const [showAddTx, setShowAddTx] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)

  const [settings, setSettings] = useLocalStorageState('mt_settings', { theme: 'system', lockEnabled: false, pin: '' })
  const [categories, setCategories] = useLocalStorageState('mt_categories', DEFAULT_CATEGORIES)
  const [accounts, setAccounts] = useLocalStorageState('mt_accounts', DEFAULT_ACCOUNTS)
  const [transactions, setTransactions] = useLocalStorageState('mt_transactions', [])
  const [contacts, setContacts] = useLocalStorageState('mt_contacts', [])
  const [debtEntries, setDebtEntries] = useLocalStorageState('mt_debtEntries', [])
  const [profile, setProfile] = useLocalStorageState('mt_profile', { name: '', birthYear: null, netWorth: 0, salary: 0 })
  const [onboarding, setOnboarding] = useLocalStorageState('mt_onboarding', { onboarded: false })

  const theme = useTheme(settings.theme)

  useEffect(() => { if (!settings.lockEnabled) setUnlocked(true) }, [settings.lockEnabled])

  const addTransaction = (tx) => setTransactions(prev => [...prev, tx])
  const deleteTransaction = (id) => setTransactions(prev => prev.filter(t => t.id !== id))

  const addContact = (c) => setContacts(prev => [...prev, c])
  const deleteContact = (id) => {
    setContacts(prev => prev.filter(c => c.id !== id))
    setDebtEntries(prev => prev.filter(e => e.contactId !== id))
  }
  const addDebtEntry = (contactId, entry) => {
    setDebtEntries(prev => [...prev, { ...entry, contactId }])
    if (entry.reminderDate && entry.type === 'loanGiven') {
      const contact = contacts.find(c => c.id === contactId)
      scheduleDebtReminder(entry, contact?.name || 'Contatto')
    }
  }
  const deleteDebtEntry = (id) => {
    setDebtEntries(prev => prev.filter(e => e.id !== id))
    cancelDebtReminder(id)
  }

  const finishOnboarding = ({ profile: p, categories: cats, contacts: newContacts }) => {
    setProfile(p)
    setCategories(cats)
    if (newContacts.length) setContacts(prev => [...prev, ...newContacts])
    if (p.netWorth > 0) {
      setAccounts(prev => prev.map(a => a.id === 'bank' ? { ...a, initialBalance: p.netWorth } : a))
    }
    if (p.salary > 0) {
      addTransaction({
        id: uuid(), amount: p.salary, isExpense: false, categoryId: 'salary', accountId: 'bank',
        date: new Date().toISOString(), notes: 'Stipendio (impostato in onboarding)',
      })
    }
    setOnboarding({ onboarded: true })
    requestNotificationPermission().catch(() => {})
  }

  const exportBackup = () => {
    const data = { version: 1, exportedAt: new Date().toISOString(), categories, accounts, transactions, contacts, debtEntries }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `money-tracker-backup-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCsv = () => {
    const rows = [['data', 'tipo', 'importo', 'categoria', 'conto', 'note']]
    transactions.forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId)
      const acc = accounts.find(a => a.id === t.accountId)
      rows.push([t.date, t.isExpense ? 'Uscita' : 'Entrata', t.amount, cat?.name || '', acc?.name || '', t.notes || ''])
    })
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transazioni-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (data.transactions) setTransactions(data.transactions)
        if (data.contacts) setContacts(data.contacts)
        if (data.debtEntries) setDebtEntries(data.debtEntries)
        alert('Backup importato con successo')
      } catch {
        alert('File non valido')
      }
    }
    reader.readAsText(file)
  }

  if (!onboarding.onboarded) {
    return <Onboarding theme={theme} onFinish={finishOnboarding} />
  }

  if (settings.lockEnabled && !unlocked) {
    return <LockScreen theme={theme} pin={settings.pin} onUnlock={() => setUnlocked(true)} />
  }

  const activeContact = activeContactId ? contacts.find(c => c.id === activeContactId) : null

  return (
    <div style={{ height: '100%', background: theme.bg, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{`@keyframes slideUp { from { transform: translateY(30px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>

      {tab === 'dashboard' && (
        <DashboardScreen theme={theme} transactions={transactions} accounts={accounts} categories={categories} contacts={contacts} debtEntries={debtEntries} profile={profile} />
      )}

      {tab === 'transactions' && (
        <TransactionsScreen theme={theme} transactions={transactions} categories={categories} accounts={accounts} onDelete={deleteTransaction} />
      )}

      {tab === 'debts' && !activeContact && (
        <DebtsScreen theme={theme} contacts={contacts} debtEntries={debtEntries} onOpenContact={setActiveContactId} />
      )}

      {tab === 'debts' && activeContact && (
        <ContactDetailScreen
          theme={theme} contact={activeContact}
          entries={debtEntries.filter(e => e.contactId === activeContact.id)}
          onBack={() => setActiveContactId(null)}
          onAdd={(entry) => addDebtEntry(activeContact.id, entry)}
          onDelete={deleteDebtEntry}
          onDeleteContact={() => { deleteContact(activeContact.id); setActiveContactId(null) }}
        />
      )}

      {tab === 'settings' && (
        <SettingsScreen theme={theme} settings={settings} setSettings={setSettings} exportBackup={exportBackup} exportCsv={exportCsv} importBackup={importBackup} />
      )}

      {(tab === 'dashboard' || tab === 'transactions' || (tab === 'debts' && !activeContact)) && (
        <button
          onClick={() => tab === 'debts' ? setShowAddContact(true) : setShowAddTx(true)}
          style={{
            position: 'fixed', right: 18, bottom: 78, width: 56, height: 56, borderRadius: 18,
            background: theme.primary, border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 40,
          }}
        >
          {tab === 'debts' ? <UserPlus size={24} color="#fff" /> : <Plus size={24} color="#fff" />}
        </button>
      )}

      <BottomNav theme={theme} tab={tab} setTab={(t) => { setTab(t); setActiveContactId(null) }} />

      {showAddTx && <AddTransactionModal theme={theme} categories={categories} accounts={accounts} onClose={() => setShowAddTx(false)} onSave={addTransaction} />}
      {showAddContact && <AddContactModal theme={theme} onClose={() => setShowAddContact(false)} onSave={addContact} />}
    </div>
  )
}
