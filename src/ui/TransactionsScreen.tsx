import { useEffect, useRef, useState } from 'react'
import type { Category, Transaction } from '../core/types'
import { listCategories } from '../db/categories'
import { db } from '../db/db'
import { categorizeTransaction } from '../db/rules'
import {
  addManualTransaction,
  importTransactionsFromSpreadsheet,
  updateTransaction,
} from '../db/transactions'

// "Three screens of unstyled HTML tables: Transactions, Plan, Review. Wire
// them to the core." -- stage 05, the human gate. Plain tables, no styling.
export function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accountId, setAccountId] = useState('checking')
  const [importMessage, setImportMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [manualDate, setManualDate] = useState('')
  const [manualDescription, setManualDescription] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const [manualCategoryId, setManualCategoryId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    const [allTransactions, allCategories] = await Promise.all([
      db.transactions.orderBy('date').reverse().toArray(),
      listCategories(),
    ])
    setTransactions(allTransactions)
    setCategories(allCategories)
  }

  async function handleFileChange() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    try {
      const inserted = await importTransactionsFromSpreadsheet(file, accountId)
      setImportMessage(`Imported ${inserted.length} new transaction(s). Matching merchants use saved categories when available.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await refresh()
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Could not import this file.')
    }
  }

  async function handleManualSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormMessage('')
    try {
      const input = {
        date: manualDate,
        description: manualDescription,
        amount: Number(manualAmount),
        accountId,
        categoryId: manualCategoryId || undefined,
      }
      if (editingId) {
        await updateTransaction(editingId, input)
        if (manualCategoryId) await categorizeTransaction(editingId, manualCategoryId)
      } else {
        const transaction = await addManualTransaction(input)
        if (manualCategoryId) await categorizeTransaction(transaction.id, manualCategoryId)
      }
      clearForm()
      await refresh()
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : 'Could not save this transaction.')
    }
  }

  function clearForm() {
    setEditingId(null)
    setManualDate('')
    setManualDescription('')
    setManualAmount('')
    setManualCategoryId('')
    setFormMessage('')
  }

  function beginEdit(transaction: Transaction) {
    setEditingId(transaction.id)
    setManualDate(transaction.date)
    setManualDescription(transaction.description)
    setManualAmount(String(transaction.amount))
    setAccountId(transaction.accountId)
    setManualCategoryId(transaction.categoryId ?? '')
    setFormMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(transaction: Transaction) {
    if (!window.confirm(`Delete “${transaction.description}”? This cannot be undone.`)) return
    await db.transactions.delete(transaction.id)
    if (editingId === transaction.id) clearForm()
    await refresh()
  }

  async function handleCategoryChange(transactionId: string, categoryId: string) {
    if (categoryId === '') {
      await db.transactions.update(transactionId, { categoryId: undefined })
      await refresh()
      return
    }
    await categorizeTransaction(transactionId, categoryId)
    await refresh()
  }

  const accountIds = [...new Set(transactions.map((transaction) => transaction.accountId))].sort()
  const filteredTransactions = transactions.filter((transaction) => accountFilter === 'all' || transaction.accountId === accountFilter)

  return (
    <div className="workspace-screen accounts-screen">
      <div className="screen-heading">
        <div><p className="eyebrow">Your money in and out</p><h1>All Accounts</h1>
          <p>Import a statement, check transactions, and assign categories.</p></div>
      </div>

      <section className="account-cards" aria-label="Accounts">
        {accountIds.length === 0 ? <div className="account-card muted">Your accounts will appear here after your first import.</div> : accountIds.map((id) => {
          const rows = transactions.filter((transaction) => transaction.accountId === id)
          const activity = rows.reduce((sum, transaction) => sum + transaction.amount, 0)
          return <button className={`account-card ${accountFilter === id ? 'selected' : ''}`} type="button" key={id}
            onClick={() => setAccountFilter(accountFilter === id ? 'all' : id)}>
            <span>{id}</span><strong>{rows.length} transactions</strong><small>Net activity {activity < 0 ? '−' : ''}${Math.abs(activity).toFixed(2)}</small>
          </button>
        })}
      </section>

      <section className="import-card">
        <div><p className="eyebrow">Bring in transactions</p><h2>Import a bank file</h2>
          <p>Choose an account name, then upload a CSV or Excel workbook. Imported merchants reuse categories you’ve assigned before.</p></div>
        <label>Account name<input list="known-accounts" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="e.g. Checking" />
          <datalist id="known-accounts">{accountIds.map((id) => <option key={id} value={id} />)}</datalist></label>
        <label className="file-picker">Choose bank file<input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={() => void handleFileChange()} /></label>
        {importMessage && <p className="import-message" role="status">{importMessage}</p>}
      </section>

      <details className="manual-entry">
        <summary>{editingId ? 'Edit transaction' : 'Add a transaction manually'}</summary>
        <form onSubmit={(e) => void handleManualSubmit(e)}>
          <input list="known-accounts" aria-label="Account" placeholder="Account name" value={accountId}
            onChange={(e) => setAccountId(e.target.value)} required />
          <input
            type="date"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
            required
          />
          <input
            placeholder="Description"
            value={manualDescription}
            onChange={(e) => setManualDescription(e.target.value)}
            required
          />
          <input
            type="number"
            step="0.01"
            placeholder="Amount (negative = money out)"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            required
          />
          <select
            aria-label="Category"
            value={manualCategoryId}
            onChange={(e) => setManualCategoryId(e.target.value)}
          >
            <option value="">Choose category (optional)</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <button type="submit">{editingId ? 'Save changes' : 'Add'}</button>
          {editingId && <button type="button" onClick={clearForm}>Cancel</button>}
        </form>
        {formMessage && <p role="alert">{formMessage}</p>}
      </details>

      <div className="transaction-toolbar">
        <div><p className="eyebrow">Activity</p><h2>Transactions</h2></div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Description, account, or category"
        />
      </div>

      <div className="table-wrap"><table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Account</th>
            <th>Category</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredTransactions.filter((transaction) => {
            const categoryName = categories.find((category) => category.id === transaction.categoryId)?.name ?? ''
            const haystack = `${transaction.description} ${transaction.accountId} ${categoryName}`.toLowerCase()
            return haystack.includes(search.trim().toLowerCase())
          }).map((transaction) => (
            <tr key={transaction.id}>
              <td>{transaction.date}</td>
              <td>{transaction.description}</td>
              <td>{transaction.amount.toFixed(2)}</td>
              <td>{transaction.accountId}</td>
              <td>
                <select
                  value={transaction.categoryId ?? ''}
                  onChange={(e) => void handleCategoryChange(transaction.id, e.target.value)}
                >
                  <option value="">(uncategorized)</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button type="button" onClick={() => beginEdit(transaction)}>Edit</button>{' '}
                <button type="button" onClick={() => void handleDelete(transaction)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
          {filteredTransactions.length === 0 && <tr><td colSpan={6} className="empty-cell">No transactions yet. Import your first statement above.</td></tr>}
      </table></div>
    </div>
  )
}
