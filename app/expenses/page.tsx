'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import PermissionDenied from '../../components/PermissionDenied'
import { useAdminDate } from '../../contexts/AdminDateContext'

interface Staff {
  id: string
  name: string
}

interface Expense {
  id: string
  type: string
  amount: number
  description: string
  notes?: string
  isPaid: boolean
  createdAt: string
  staff?: Staff
}

export default function ExpensesPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const { t, direction } = useLanguage()
  const { customCreatedAt } = useAdminDate()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'gym_expense' | 'staff_loan'>('all')
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; expenseId: string | null; expenseName: string }>({
    show: false,
    expenseId: null,
    expenseName: ''
  })
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [showLoansCalculator, setShowLoansCalculator] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const [formData, setFormData] = useState({
    type: 'gym_expense' as 'gym_expense' | 'staff_loan',
    amount: 0,
    description: '',
    notes: '',
    staffId: '',
    createdAt: '',
  })

  const fetchExpenses = async () => {
    try {
      const response = await fetch('/api/expenses')
      const data = await response.json()
      setExpenses(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff')
      const data = await response.json()
      setStaffList(data)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  useEffect(() => {
    fetchExpenses()
    fetchStaff()
  }, [])

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      type: expense.type as 'gym_expense' | 'staff_loan',
      amount: expense.amount,
      description: expense.description,
      notes: expense.notes || '',
      staffId: expense.staff?.id || '',
      createdAt: new Date(expense.createdAt).toISOString().split('T')[0],
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // إذا كان تعديل، استخدم handleUpdate
      if (editingExpense) {
        await handleUpdate()
        return
      }

      // إذا كانت سلفة موظف، ضع اسم الموظف في الوصف تلقائياً
      const dataToSend: any = { ...formData }
      if (formData.type === 'staff_loan' && formData.staffId) {
        const selectedStaff = staffList.find(s => s.id === formData.staffId)
        if (selectedStaff) {
          dataToSend.description = selectedStaff.name
        }
      }

      // ✅ إضافة التاريخ المخصص إذا كان مفعّل
      if (customCreatedAt) {
        dataToSend.customCreatedAt = customCreatedAt.toISOString()
      }

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      })

      if (response.ok) {
        setFormData({
          type: 'gym_expense',
          amount: 0,
          description: '',
          notes: '',
          staffId: '',
          createdAt: '',
        })

        setMessage(`✅ ${t('expenses.messages.addSuccess')}`)
        setTimeout(() => setMessage(''), 3000)
        fetchExpenses()
        setShowForm(false)
      } else {
        setMessage(`❌ ${t('expenses.messages.addError')}`)
      }
    } catch (error) {
      console.error(error)
      setMessage(`❌ ${t('expenses.messages.error')}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingExpense) return

    try {
      const dataToSend: any = {
        id: editingExpense.id,
        description: formData.description,
        createdAt: formData.createdAt,
      }

      const response = await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      })

      if (response.ok) {
        setFormData({
          type: 'gym_expense',
          amount: 0,
          description: '',
          notes: '',
          staffId: '',
          createdAt: '',
        })
        setEditingExpense(null)
        setMessage(`✅ ${t('expenses.messages.updateSuccess')}`)
        setTimeout(() => setMessage(''), 3000)
        fetchExpenses()
        setShowForm(false)
      } else {
        setMessage(`❌ ${t('expenses.messages.updateError')}`)
      }
    } catch (error) {
      console.error(error)
      setMessage(`❌ ${t('expenses.messages.error')}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (expense: Expense) => {
    setDeleteConfirm({
      show: true,
      expenseId: expense.id,
      expenseName: expense.description
    })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.expenseId) return

    try {
      await fetch(`/api/expenses?id=${deleteConfirm.expenseId}`, { method: 'DELETE' })
      fetchExpenses()
      setMessage(`✅ ${t('expenses.messages.deleteSuccess')}`)
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error:', error)
      setMessage(`❌ ${t('expenses.messages.deleteError')}`)
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setDeleteConfirm({ show: false, expenseId: null, expenseName: '' })
    }
  }

  const cancelDelete = () => {
    setDeleteConfirm({ show: false, expenseId: null, expenseName: '' })
  }

  const togglePaid = async (expense: Expense) => {
    try {
      await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expense.id, isPaid: !expense.isPaid }),
      })
      fetchExpenses()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const filteredExpenses = filterType === 'all'
    ? expenses
    : expenses.filter(e => e.type === filterType)

  // Get current month expenses
  const getCurrentMonthExpenses = () => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    return expenses.filter(e => {
      const expenseDate = new Date(e.createdAt)
      return expenseDate.getFullYear() === currentYear && expenseDate.getMonth() + 1 === currentMonth
    })
  }

  const getTotalExpenses = () => {
    const currentMonthExpenses = getCurrentMonthExpenses()
    return currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0)
  }

  const getTypeLabel = (type: string) => {
    return type === 'gym_expense' ? t('expenses.types.gymExpense') : t('expenses.types.staffLoan')
  }

  const getTypeColor = (type: string) => {
    return type === 'gym_expense'
      ? 'bg-orange-100 text-orange-800'
      : 'bg-purple-100 text-purple-800'
  }

  // Get loans for selected month grouped by staff
  const getMonthLoans = () => {
    const [year, month] = selectedMonth.split('-').map(Number)

    const monthLoans = expenses.filter(e => {
      if (e.type !== 'staff_loan') return false
      const expenseDate = new Date(e.createdAt)
      return expenseDate.getFullYear() === year && expenseDate.getMonth() + 1 === month
    })

    // Group by staff
    const groupedByStaff = monthLoans.reduce((acc, loan) => {
      const staffId = loan.staff?.id || 'unknown'
      const staffName = loan.staff?.name || t('expenses.loansCalculator.unknownStaff')

      if (!acc[staffId]) {
        acc[staffId] = {
          staffName,
          loans: [],
          total: 0,
          paid: 0,
          unpaid: 0
        }
      }

      acc[staffId].loans.push(loan)
      acc[staffId].total += loan.amount
      if (loan.isPaid) {
        acc[staffId].paid += loan.amount
      } else {
        acc[staffId].unpaid += loan.amount
      }

      return acc
    }, {} as Record<string, { staffName: string; loans: Expense[]; total: number; paid: number; unpaid: number }>)

    return groupedByStaff
  }

  // ✅ التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen" dir={direction}>
        <div className="text-xl">{t('expenses.loading')}</div>
      </div>
    )
  }

  if (!hasPermission('canViewFinancials')) {
    return <PermissionDenied message={t('expenses.noPermission')} />
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={direction}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">💸 {t('expenses.title')}</h1>
          <p className="text-gray-600">{t('expenses.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLoansCalculator(true)}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
          >
            🧮 {t('expenses.loansCalculator.button')}
          </button>
          <button
            onClick={() => {
              if (showForm) {
                setShowForm(false)
                setEditingExpense(null)
                setFormData({
                  type: 'gym_expense',
                  amount: 0,
                  description: '',
                  notes: '',
                  staffId: '',
                  createdAt: '',
                })
              } else {
                setShowForm(true)
              }
            }}
            className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700"
          >
            {showForm ? t('expenses.hideForm') : `➕ ${t('expenses.addExpense')}`}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">{t('expenses.stats.totalExpenses')}</p>
              <p className="text-3xl font-bold text-orange-600">{getTotalExpenses()} {t('members.egp')}</p>
            </div>
            <div className="text-4xl">💸</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">{t('expenses.stats.gymExpenses')}</p>
              <p className="text-3xl font-bold text-orange-600">
                {getCurrentMonthExpenses().filter(e => e.type === 'gym_expense').reduce((sum, e) => sum + e.amount, 0)} {t('members.egp')}
              </p>
            </div>
            <div className="text-4xl">🔧</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">{t('expenses.stats.staffLoans')}</p>
              <p className="text-3xl font-bold text-purple-600">
                {getCurrentMonthExpenses().filter(e => e.type === 'staff_loan').reduce((sum, e) => sum + e.amount, 0)} {t('members.egp')}
              </p>
            </div>
            <div className="text-4xl">💵</div>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingExpense ? `✏️ ${t('expenses.form.editTitle')}` : t('expenses.form.title')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* نوع المصروف - معطل في وضع التعديل */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('expenses.form.expenseType')}</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any, staffId: '' })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                  disabled={!!editingExpense}
                >
                  <option value="gym_expense">{t('expenses.types.gymExpense')}</option>
                  <option value="staff_loan">{t('expenses.types.staffLoan')}</option>
                </select>
              </div>

              {formData.type === 'staff_loan' && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t('expenses.form.staff')}</label>
                  <select
                    value={formData.staffId}
                    onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                    disabled={!!editingExpense}
                  >
                    <option value="">{t('expenses.form.selectStaff')}</option>
                    {(staffList || []).map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* المبلغ - معطل في وضع التعديل */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('expenses.form.amount')}</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder={t('expenses.form.amountPlaceholder')}
                  disabled={!!editingExpense}
                />
              </div>

              {/* الوصف - قابل للتعديل */}
              {formData.type === 'gym_expense' && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t('expenses.form.description')}</label>
                  <input
                    type="text"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder={t('expenses.form.descriptionPlaceholder')}
                  />
                </div>
              )}

              {/* التاريخ - يظهر فقط في وضع التعديل */}
              {editingExpense && (
                <div>
                  <label className="block text-sm font-medium mb-1">📅 {t('expenses.form.date')}</label>
                  <input
                    type="date"
                    required
                    value={formData.createdAt}
                    onChange={(e) => setFormData({ ...formData, createdAt: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* الملاحظات - معطل في وضع التعديل */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('expenses.form.notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                placeholder={t('expenses.form.notesPlaceholder')}
                disabled={!!editingExpense}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-400"
            >
              {loading
                ? t('expenses.form.saving')
                : editingExpense
                  ? `💾 ${t('expenses.form.update')}`
                  : t('expenses.form.submit')
              }
            </button>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">{t('expenses.filter.all')}</option>
          <option value="gym_expense">{t('expenses.filter.gymExpenses')}</option>
          <option value="staff_loan">{t('expenses.filter.staffLoans')}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12">{t('expenses.loading')}</div>
      ) : (
        <>
          {/* Cards للموبايل */}
          <div className="md:hidden space-y-4">
            {filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                className="bg-white rounded-lg shadow-md border-r-4 border-red-500 overflow-hidden"
              >
                {/* Actions في الأعلى */}
                <div className="bg-gray-50 px-4 py-2 flex justify-between items-center border-b">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(expense.type)}`}>
                    {getTypeLabel(expense.type)}
                  </span>
                  <div className="flex gap-2">
                    {hasPermission('canEditExpense') && (
                      <button
                        onClick={() => handleEdit(expense)}
                        className="text-blue-600 hover:text-blue-800 font-bold text-sm"
                      >
                        ✏️ {t('expenses.actions.edit')}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(expense)}
                      className="text-red-600 hover:text-red-800 font-bold text-sm"
                    >
                      🗑️ {t('expenses.actions.delete')}
                    </button>
                  </div>
                </div>

                {/* محتوى الكارت */}
                <div className="p-4 space-y-3">
                  {/* الوصف */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{expense.description}</h3>
                    {expense.staff && (
                      <p className="text-sm text-gray-600 mt-1">👤 {expense.staff.name}</p>
                    )}
                  </div>

                  {/* المبلغ */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">💰</span>
                    <span className="text-2xl font-bold text-orange-600">{expense.amount} {t('common.currency')}</span>
                  </div>

                  {/* التاريخ */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">📅</span>
                    <span className="text-gray-700">
                      {new Date(expense.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                    </span>
                  </div>

                  {/* الحالة للسلف */}
                  {expense.type === 'staff_loan' && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm">📊</span>
                      <button
                        onClick={() => togglePaid(expense)}
                        className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                          expense.isPaid
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {expense.isPaid ? `✅ ${t('expenses.status.paid')}` : `❌ ${t('expenses.status.unpaid')}`}
                      </button>
                    </div>
                  )}

                  {/* الملاحظات */}
                  {expense.notes && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">📝 ملاحظات:</span> {expense.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredExpenses.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">💸</div>
                <p className="text-xl">{t('expenses.empty')}</p>
              </div>
            )}
          </div>

          {/* الجدول للشاشات الكبيرة */}
          <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.type')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.staff')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.description')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.amount')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.status')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.date')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded text-sm ${getTypeColor(expense.type)}`}>
                        {getTypeLabel(expense.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {expense.staff ? expense.staff.name : '-'}
                    </td>
                    <td className="px-4 py-3">{expense.description}</td>
                    <td className="px-4 py-3 font-bold text-orange-600">{expense.amount} {t('common.currency')}</td>
                    <td className="px-4 py-3">
                      {expense.type === 'staff_loan' && (
                        <button
                          onClick={() => togglePaid(expense)}
                          className={`px-3 py-1 rounded text-sm ${
                            expense.isPaid
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {expense.isPaid ? `✅ ${t('expenses.status.paid')}` : `❌ ${t('expenses.status.unpaid')}`}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(expense.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {hasPermission('canEditExpense') && (
                          <button
                            onClick={() => handleEdit(expense)}
                            className="text-blue-600 hover:text-blue-800 font-bold"
                          >
                            ✏️ {t('expenses.actions.edit')}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(expense)}
                          className="text-red-600 hover:text-red-800 font-bold"
                        >
                          🗑️ {t('expenses.actions.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredExpenses.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">💸</div>
                <p className="text-xl">{t('expenses.empty')}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Popup */}
      {deleteConfirm.show && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-[9998] animate-fadeIn"
            onClick={cancelDelete}
          />

          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-md px-4 animate-scaleIn">
            <div className="bg-white rounded-2xl shadow-2xl p-6 border-4 border-red-500" dir={direction}>
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-5xl">🗑️</span>
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-center mb-3 text-red-600">
                {t('expenses.deleteModal.title')}
              </h2>

              {/* Message */}
              <p className="text-center text-gray-700 mb-2">
                {t('expenses.deleteModal.message')}
              </p>
              <p className="text-center text-lg font-bold text-gray-900 mb-6 bg-gray-100 p-3 rounded-lg">
                {deleteConfirm.expenseName}
              </p>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelDelete}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition font-bold"
                >
                  ✕ {t('expenses.deleteModal.cancel')}
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-bold"
                >
                  🗑️ {t('expenses.deleteModal.confirm')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Loans Calculator Modal */}
      {showLoansCalculator && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-[9998] animate-fadeIn"
            onClick={() => setShowLoansCalculator(false)}
          />

          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-4xl px-4 animate-scaleIn max-h-[90vh] overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-6 border-4 border-purple-500" dir={direction}>
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🧮</span>
                  </div>
                  <h2 className="text-2xl font-bold text-purple-600">
                    {t('expenses.loansCalculator.title')}
                  </h2>
                </div>
                <button
                  onClick={() => setShowLoansCalculator(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Month Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">📅 {t('expenses.loansCalculator.selectMonth')}</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Summary Stats */}
              {(() => {
                const loansData = getMonthLoans()
                const staffCount = Object.keys(loansData).length
                const totalLoans = Object.values(loansData).reduce((sum, staff) => sum + staff.total, 0)
                const totalPaid = Object.values(loansData).reduce((sum, staff) => sum + staff.paid, 0)
                const totalUnpaid = Object.values(loansData).reduce((sum, staff) => sum + staff.unpaid, 0)

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">{t('expenses.loansCalculator.staffCount')}</p>
                        <p className="text-2xl font-bold text-purple-600">{staffCount}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">{t('expenses.loansCalculator.totalLoans')}</p>
                        <p className="text-2xl font-bold text-purple-600">{totalLoans} {t('members.egp')}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">{t('expenses.loansCalculator.totalPaid')}</p>
                        <p className="text-2xl font-bold text-green-600">{totalPaid} {t('members.egp')}</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">{t('expenses.loansCalculator.totalUnpaid')}</p>
                        <p className="text-2xl font-bold text-red-600">{totalUnpaid} {t('members.egp')}</p>
                      </div>
                    </div>

                    {/* Staff Loans Details */}
                    {staffCount === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <div className="text-6xl mb-4">💵</div>
                        <p className="text-xl">{t('expenses.loansCalculator.noLoans')}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(loansData).map(([staffId, data]) => (
                          <div key={staffId} className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                            {/* Staff Header */}
                            <div className="flex justify-between items-center mb-3 pb-3 border-b-2 border-gray-300">
                              <h3 className="text-lg font-bold text-gray-800">👤 {data.staffName}</h3>
                              <div className="flex gap-4 text-sm">
                                <span className="text-purple-600 font-bold">
                                  {t('expenses.loansCalculator.total')}: {data.total} {t('members.egp')}
                                </span>
                                <span className="text-green-600 font-bold">
                                  {t('expenses.loansCalculator.paid')}: {data.paid} {t('members.egp')}
                                </span>
                                <span className="text-red-600 font-bold">
                                  {t('expenses.loansCalculator.unpaid')}: {data.unpaid} {t('members.egp')}
                                </span>
                              </div>
                            </div>

                            {/* Staff Loans List */}
                            <div className="space-y-2">
                              {data.loans.map((loan) => (
                                <div key={loan.id} className="flex justify-between items-center bg-white p-3 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                      loan.isPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {loan.isPaid ? `✅ ${t('expenses.status.paid')}` : `❌ ${t('expenses.status.unpaid')}`}
                                    </span>
                                    <span className="text-sm text-gray-600">
                                      📅 {new Date(loan.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                    </span>
                                  </div>
                                  <span className="text-lg font-bold text-purple-600">
                                    {loan.amount} {t('members.egp')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}

              {/* Close Button */}
              <div className="mt-6">
                <button
                  onClick={() => setShowLoansCalculator(false)}
                  className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-bold"
                >
                  ✕ {t('expenses.loansCalculator.close')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}