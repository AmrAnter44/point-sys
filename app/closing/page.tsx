'use client'

import { useEffect, useState } from 'react'
import ExcelJS from 'exceljs'
import { useLanguage } from '../../contexts/LanguageContext'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from 'recharts'

interface DailyData {
  date: string
  floor: number
  pt: number
  nutrition: number
  physiotherapy: number
  bar: number
  expenses: number
  expenseDetails: string
  visa: number
  instapay: number
  cash: number
  wallet: number
  staffLoans: { [key: string]: number }
  receipts: any[]
  expensesList: any[]
}

interface Staff {
  id: string
  name: string
}

interface MonthlyData {
  month: string
  monthLabel: string
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  floor: number
  pt: number
  nutrition: number
  physiotherapy: number
  bar: number
}

export default function ClosingPage() {
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'annual'>('monthly')
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

  // للتقفيل السنوي
  const currentDate = new Date()
  const [startMonth, setStartMonth] = useState(
    new Date(currentDate.getFullYear(), 0, 1).toISOString().slice(0, 7) // بداية السنة الحالية
  )
  const [endMonth, setEndMonth] = useState(
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().slice(0, 7) // الشهر الحالي
  )

  const [totals, setTotals] = useState({
    floor: 0,
    pt: 0,
    nutrition: 0,
    physiotherapy: 0,
    bar: 0,
    expenses: 0,
    visa: 0,
    instapay: 0,
    cash: 0,
    wallet: 0,
    totalPayments: 0,
    totalRevenue: 0,
    netProfit: 0
  })

  // Bar income form state
  const [showBarForm, setShowBarForm] = useState(false)
  const [barFormData, setBarFormData] = useState({ amount: '', note: '', date: new Date().toISOString().split('T')[0] })
  const [barFormLoading, setBarFormLoading] = useState(false)
  const [barFormMessage, setBarFormMessage] = useState('')

  const { t, direction } = useLanguage()

  const fetchData = async () => {
    try {
      setLoading(true)

      const staffRes = await fetch('/api/staff')
      const staff = await staffRes.json()
      setStaffList(staff)

      const receiptsRes = await fetch('/api/receipts')
      const receipts = await receiptsRes.json()

      const expensesRes = await fetch('/api/expenses')
      const expenses = await expensesRes.json()

      const now = new Date()
      const filterDate = (dateString: string) => {
        const d = new Date(dateString)

        if (viewMode === 'daily') {
          // في الوضع اليومي، نعرض اليوم المحدد فقط
          const selectedDate = new Date(selectedDay)
          return d.toDateString() === selectedDate.toDateString()
        } else {
          // في الوضع الشهري، نعرض الشهر المحدد
          const [year, month] = selectedMonth.split('-')
          return d.getFullYear() === parseInt(year) && d.getMonth() === parseInt(month) - 1
        }
      }

      const filteredReceipts = receipts.filter((r: any) => filterDate(r.createdAt))
      const filteredExpenses = expenses.filter((e: any) => filterDate(e.createdAt))

      const dailyMap: { [key: string]: DailyData } = {}

      filteredReceipts.forEach((receipt: any) => {
        // استخدام التاريخ المحلي بدلاً من UTC
        const receiptDate = new Date(receipt.createdAt)
        const year = receiptDate.getFullYear()
        const month = String(receiptDate.getMonth() + 1).padStart(2, '0')
        const day = String(receiptDate.getDate()).padStart(2, '0')
        const date = `${year}-${month}-${day}`

        if (!dailyMap[date]) {
          dailyMap[date] = {
            date,
            floor: 0,
            pt: 0,
            nutrition: 0,
            physiotherapy: 0,
            bar: 0,
            expenses: 0,
            expenseDetails: '',
            visa: 0,
            instapay: 0,
            cash: 0,
            wallet: 0,
            staffLoans: {},
            receipts: [],
            expensesList: []
          }
        }

        dailyMap[date].receipts.push(receipt)

        // ✅ لا نحسب الإيصالات الملغية في الإيرادات
        if (!receipt.isCancelled) {
          // تحديد نوع الإيصال
          if (receipt.type === 'PT' || receipt.type === 'اشتراك برايفت' || receipt.type === 'تجديد برايفت') {
            // PT sessions
            dailyMap[date].pt += receipt.amount
          } else if (receipt.type === 'Nutrition' || receipt.type === 'Nutrition Renewal') {
            // Nutrition sessions
            dailyMap[date].nutrition += receipt.amount
          } else if (receipt.type === 'Physiotherapy' || receipt.type === 'Physiotherapy Renewal') {
            // Physiotherapy sessions
            dailyMap[date].physiotherapy += receipt.amount
          } else if (receipt.type === 'Bar') {
            // Bar income
            dailyMap[date].bar += receipt.amount
          } else {
            // كل شيء آخر (عضويات، تجديدات، خدمات، الخ...)
            dailyMap[date].floor += receipt.amount
          }

          const paymentMethod = receipt.paymentMethod || 'cash'
          if (paymentMethod === 'visa') {
            dailyMap[date].visa += receipt.amount
          } else if (paymentMethod === 'instapay') {
            dailyMap[date].instapay += receipt.amount
          } else if (paymentMethod === 'wallet') {
            dailyMap[date].wallet += receipt.amount
          } else {
            dailyMap[date].cash += receipt.amount
          }
        }
      })

      filteredExpenses.forEach((expense: any) => {
        // استخدام التاريخ المحلي بدلاً من UTC
        const expenseDate = new Date(expense.createdAt)
        const year = expenseDate.getFullYear()
        const month = String(expenseDate.getMonth() + 1).padStart(2, '0')
        const day = String(expenseDate.getDate()).padStart(2, '0')
        const date = `${year}-${month}-${day}`

        if (!dailyMap[date]) {
          dailyMap[date] = {
            date,
            floor: 0,
            pt: 0,
            nutrition: 0,
            physiotherapy: 0,
            bar: 0,
            expenses: 0,
            expenseDetails: '',
            visa: 0,
            instapay: 0,
            cash: 0,
            wallet: 0,
            staffLoans: {},
            receipts: [],
            expensesList: []
          }
        }

        dailyMap[date].expensesList.push(expense)
        dailyMap[date].expenses += expense.amount

        if (expense.type === 'staff_loan' && expense.staff) {
          const staffName = expense.staff.name
          if (!dailyMap[date].staffLoans[staffName]) {
            dailyMap[date].staffLoans[staffName] = 0
          }
          dailyMap[date].staffLoans[staffName] += expense.amount
        }

        if (dailyMap[date].expenseDetails) {
          dailyMap[date].expenseDetails += ' + '
        }
        dailyMap[date].expenseDetails += `${expense.amount}${expense.description}`
      })

      const sortedData = Object.values(dailyMap).sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      setDailyData(sortedData)

      const newTotals = sortedData.reduce((acc, day) => {
        acc.floor += day.floor
        acc.pt += day.pt
        acc.nutrition += day.nutrition
        acc.physiotherapy += day.physiotherapy
        acc.bar += day.bar
        acc.expenses += day.expenses
        acc.visa += day.visa
        acc.instapay += day.instapay
        acc.cash += day.cash
        acc.wallet += day.wallet
        return acc
      }, {
        floor: 0,
        pt: 0,
        nutrition: 0,
        physiotherapy: 0,
        bar: 0,
        expenses: 0,
        visa: 0,
        instapay: 0,
        cash: 0,
        wallet: 0,
        totalPayments: 0,
        totalRevenue: 0,
        netProfit: 0
      })

      newTotals.totalPayments = newTotals.cash + newTotals.visa + newTotals.instapay + newTotals.wallet
      newTotals.totalRevenue = newTotals.floor + newTotals.pt + newTotals.nutrition + newTotals.physiotherapy + newTotals.bar
      newTotals.netProfit = newTotals.totalRevenue - newTotals.expenses

      setTotals(newTotals)

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAnnualData = async () => {
    try {
      setLoading(true)

      const receiptsRes = await fetch('/api/receipts')
      const receipts = await receiptsRes.json()

      const expensesRes = await fetch('/api/expenses')
      const expenses = await expensesRes.json()

      // تجميع البيانات حسب الشهر
      const monthlyMap: { [key: string]: MonthlyData } = {}

      // معالجة الإيصالات
      receipts.forEach((receipt: any) => {
        if (receipt.isCancelled) return // تجاهل الإيصالات الملغاة

        const receiptDate = new Date(receipt.createdAt)
        const year = receiptDate.getFullYear()
        const month = String(receiptDate.getMonth() + 1).padStart(2, '0')
        const monthKey = `${year}-${month}`

        // تصفية حسب النطاق الزمني المحدد
        if (monthKey < startMonth || monthKey > endMonth) return

        if (!monthlyMap[monthKey]) {
          const monthDate = new Date(year, receiptDate.getMonth(), 1)
          monthlyMap[monthKey] = {
            month: monthKey,
            monthLabel: monthDate.toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
              month: 'long',
              year: 'numeric'
            }),
            totalRevenue: 0,
            totalExpenses: 0,
            netProfit: 0,
            floor: 0,
            pt: 0,
            nutrition: 0,
            physiotherapy: 0,
            bar: 0
          }
        }

        // تحديد نوع الإيرادات
        if (receipt.type === 'PT' || receipt.type === 'اشتراك برايفت' || receipt.type === 'تجديد برايفت') {
          monthlyMap[monthKey].pt += receipt.amount
        } else if (receipt.type === 'Nutrition' || receipt.type === 'Nutrition Renewal') {
          monthlyMap[monthKey].nutrition += receipt.amount
        } else if (receipt.type === 'Physiotherapy' || receipt.type === 'Physiotherapy Renewal') {
          monthlyMap[monthKey].physiotherapy += receipt.amount
        } else if (receipt.type === 'Bar') {
          monthlyMap[monthKey].bar += receipt.amount
        } else {
          monthlyMap[monthKey].floor += receipt.amount
        }

        monthlyMap[monthKey].totalRevenue += receipt.amount
      })

      // معالجة المصاريف
      expenses.forEach((expense: any) => {
        const expenseDate = new Date(expense.createdAt)
        const year = expenseDate.getFullYear()
        const month = String(expenseDate.getMonth() + 1).padStart(2, '0')
        const monthKey = `${year}-${month}`

        // تصفية حسب النطاق الزمني المحدد
        if (monthKey < startMonth || monthKey > endMonth) return

        if (!monthlyMap[monthKey]) {
          const monthDate = new Date(year, expenseDate.getMonth(), 1)
          monthlyMap[monthKey] = {
            month: monthKey,
            monthLabel: monthDate.toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
              month: 'long',
              year: 'numeric'
            }),
            totalRevenue: 0,
            totalExpenses: 0,
            netProfit: 0,
            floor: 0,
            pt: 0,
            nutrition: 0,
            physiotherapy: 0,
            bar: 0
          }
        }

        monthlyMap[monthKey].totalExpenses += expense.amount
      })

      // حساب صافي الربح لكل شهر
      Object.values(monthlyMap).forEach(month => {
        month.netProfit = month.totalRevenue - month.totalExpenses
      })

      // ترتيب البيانات حسب التاريخ
      const sortedMonthlyData = Object.values(monthlyMap).sort((a, b) =>
        a.month.localeCompare(b.month)
      )

      setMonthlyData(sortedMonthlyData)

      // حساب الإجماليات
      const annualTotals = sortedMonthlyData.reduce((acc, month) => {
        acc.floor += month.floor
        acc.pt += month.pt
        acc.nutrition += month.nutrition
        acc.physiotherapy += month.physiotherapy
        acc.bar += month.bar
        acc.totalRevenue += month.totalRevenue
        acc.expenses += month.totalExpenses
        return acc
      }, {
        floor: 0,
        pt: 0,
        nutrition: 0,
        physiotherapy: 0,
        bar: 0,
        expenses: 0,
        visa: 0,
        instapay: 0,
        cash: 0,
        wallet: 0,
        totalPayments: 0,
        totalRevenue: 0,
        netProfit: 0
      })

      annualTotals.netProfit = annualTotals.totalRevenue - annualTotals.expenses
      setTotals(annualTotals)

    } catch (error) {
      console.error('Error fetching annual data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (viewMode === 'annual') {
      fetchAnnualData()
    } else {
      fetchData()
    }
  }, [viewMode, selectedDay, selectedMonth, startMonth, endMonth])

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'X-GYM'
      workbook.created = new Date()

      const mainSheet = workbook.addWorksheet(t('closing.excel.mainSheet'), {
        views: [{ rightToLeft: direction === 'rtl' }],
        properties: { defaultColWidth: 12 }
      })

      const headerRow = mainSheet.addRow([
        t('closing.table.date'),
        t('closing.table.floor'),
        t('closing.table.pt'),
        'Nutrition 🥗',
        'Physiotherapy 🏥',
        'Bar 🍵',
        t('closing.table.cash'),
        t('closing.table.visa'),
        t('closing.table.instapay'),
        t('closing.table.wallet'),
        t('closing.table.total'),
        t('closing.table.expenses'),
        t('closing.table.expenseDetails'),
        t('closing.table.totalLoans'),
        ...(staffList || []).map(staff => staff.name)
      ])

      headerRow.font = { bold: true, size: 12, name: 'Arial' }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25
      headerRow.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }

      dailyData.forEach((day, index) => {
        const totalStaffLoans = Object.values(day.staffLoans).reduce((a, b) => a + b, 0)
        const dayTotalPayments = day.cash + day.visa + day.instapay + day.wallet
        const row = mainSheet.addRow([
          new Date(day.date).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US'),
          day.floor > 0 ? day.floor : 0,
          day.pt > 0 ? day.pt : 0,
          day.nutrition > 0 ? day.nutrition : 0,
          day.physiotherapy > 0 ? day.physiotherapy : 0,
          day.bar > 0 ? day.bar : 0,
          day.cash > 0 ? day.cash : 0,
          day.visa > 0 ? day.visa : 0,
          day.instapay > 0 ? day.instapay : 0,
          day.wallet > 0 ? day.wallet : 0,
          dayTotalPayments,
          day.expenses > 0 ? day.expenses : 0,
          day.expenseDetails || '-',
          totalStaffLoans > 0 ? totalStaffLoans : 0,
          ...(staffList || []).map(staff => day.staffLoans[staff.name] || 0)
        ])

        if (index % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }
          }
        }

        row.alignment = { horizontal: direction === 'rtl' ? 'right' : 'left', vertical: 'middle' }
        row.font = { name: 'Arial', size: 11 }

        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        })
      })

      const totalStaffLoansAll = dailyData.reduce((sum, day) =>
        sum + Object.values(day.staffLoans).reduce((a, b) => a + b, 0), 0
      )
      const totalsRow = mainSheet.addRow([
        t('closing.table.totalLabel'),
        totals.floor,
        totals.pt,
        totals.nutrition,
        totals.physiotherapy,
        totals.bar,
        totals.cash,
        totals.visa,
        totals.instapay,
        totals.wallet,
        totals.totalPayments,
        totals.expenses,
        '',
        totalStaffLoansAll,
        ...(staffList || []).map(staff => {
          const total = dailyData.reduce((sum, day) =>
            sum + (day.staffLoans[staff.name] || 0), 0
          )
          return total
        })
      ])

      totalsRow.font = { bold: true, size: 13, name: 'Arial' }
      totalsRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFD700' }
      }
      totalsRow.alignment = { horizontal: direction === 'rtl' ? 'right' : 'left', vertical: 'middle' }
      totalsRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'medium' },
          left: { style: 'thin' },
          bottom: { style: 'medium' },
          right: { style: 'thin' }
        }
      })

      mainSheet.addRow([])
      const profitRow = mainSheet.addRow([t('closing.stats.netProfit'), totals.netProfit])
      profitRow.font = { bold: true, size: 14, name: 'Arial' }
      profitRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF90EE90' }
      }
      profitRow.alignment = { horizontal: direction === 'rtl' ? 'right' : 'left', vertical: 'middle' }

      mainSheet.addRow([])
      const summaryTitle = mainSheet.addRow([t('closing.excel.summaryTitle')])
      summaryTitle.font = { bold: true, size: 13, name: 'Arial' }
      summaryTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      }

      mainSheet.addRow([t('closing.stats.totalRevenue'), totals.totalRevenue])
      mainSheet.addRow([t('closing.stats.totalExpenses'), totals.expenses])
      mainSheet.addRow([t('closing.stats.netProfit'), totals.netProfit])
      mainSheet.addRow([t('closing.stats.numberOfDays'), dailyData.length])
      mainSheet.addRow([t('closing.stats.dailyAverage'), dailyData.length > 0 ? Math.round(totals.totalRevenue / dailyData.length) : 0])

      mainSheet.addRow([])
      const paymentTitle = mainSheet.addRow([t('closing.paymentMethods.title')])
      paymentTitle.font = { bold: true, size: 13, name: 'Arial' }
      paymentTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      }

      mainSheet.addRow([t('closing.paymentMethods.cash'), totals.cash])
      mainSheet.addRow([t('closing.paymentMethods.visa'), totals.visa])
      mainSheet.addRow([t('closing.paymentMethods.instapay'), totals.instapay])
      mainSheet.addRow([t('closing.paymentMethods.wallet'), totals.wallet])
      mainSheet.addRow([t('closing.stats.totalPayments'), totals.totalPayments])

      mainSheet.columns = [
        { width: 15 },  // التاريخ
        { width: 12 },  // Floor
        { width: 12 },  // PT
        { width: 14 },  // Nutrition
        { width: 14 },  // Physiotherapy
        { width: 12 },  // كاش
        { width: 12 },  // فيزا
        { width: 14 },  // إنستاباي
        { width: 12 },  // محفظة
        { width: 14 },  // Total
        { width: 12 },  // مصاريف
        { width: 45 },  // تفاصيل المصاريف
        { width: 14 },  // إجمالي السلف
        ...(staffList || []).map(() => ({ width: 14 }))
      ]

      if (dailyData.some(day => day.receipts.length > 0)) {
        const receiptsSheet = workbook.addWorksheet(t('closing.excel.receiptsSheet'), {
          views: [{ rightToLeft: direction === 'rtl' }]
        })

        const receiptsHeader = receiptsSheet.addRow([
          t('closing.receipts.date'), t('closing.receipts.time'), t('closing.receipts.receiptNumber'), t('closing.receipts.type'), 'الحالة', t('closing.receipts.amount'), t('closing.receipts.paymentMethod'), t('closing.receipts.details')
        ])
        receiptsHeader.font = { bold: true, size: 12, name: 'Arial' }
        receiptsHeader.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF87CEEB' }
        }
        receiptsHeader.alignment = { horizontal: 'center', vertical: 'middle' }
        receiptsHeader.height = 25

        dailyData.forEach(day => {
          day.receipts.forEach((receipt: any) => {
            const details = JSON.parse(receipt.itemDetails)
            const detailsText = details.memberName || details.clientName || details.name || '-'
            const row = receiptsSheet.addRow([
              new Date(receipt.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US'),
              new Date(receipt.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US'),
              receipt.receiptNumber,
              receipt.type === 'Member' ? t('closing.receiptTypes.member') : receipt.type === 'PT' ? t('closing.receiptTypes.pt') : receipt.type,
              receipt.isCancelled ? 'ملغي ❌' : 'نشط ✓',
              receipt.amount,
              receipt.paymentMethod === 'visa' ? t('closing.paymentMethods.visa') : receipt.paymentMethod === 'instapay' ? t('closing.paymentMethods.instapay') : receipt.paymentMethod === 'wallet' ? t('closing.paymentMethods.wallet') : t('closing.paymentMethods.cash'),
              detailsText
            ])
            row.alignment = { horizontal: direction === 'rtl' ? 'right' : 'left', vertical: 'middle' }
            row.font = { name: 'Arial', size: 10 }
          })
        })

        receiptsSheet.columns = [
          { width: 15 },  // التاريخ
          { width: 12 },  // الوقت
          { width: 15 },  // رقم الإيصال
          { width: 18 },  // النوع
          { width: 12 },  // الحالة
          { width: 12 },  // المبلغ
          { width: 15 },  // طريقة الدفع
          { width: 35 }   // التفاصيل
        ]
      }

      if (dailyData.some(day => day.expensesList.length > 0)) {
        const expensesSheet = workbook.addWorksheet(t('closing.excel.expensesSheet'), {
          views: [{ rightToLeft: direction === 'rtl' }]
        })

        const expensesHeader = expensesSheet.addRow([
          t('closing.expenses.date'), t('closing.expenses.time'), t('closing.expenses.type'), t('closing.expenses.description'), t('closing.expenses.staff'), t('closing.expenses.amount'), t('closing.expenses.status')
        ])
        expensesHeader.font = { bold: true, size: 12, name: 'Arial' }
        expensesHeader.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFA07A' }
        }
        expensesHeader.alignment = { horizontal: 'center', vertical: 'middle' }
        expensesHeader.height = 25

        dailyData.forEach(day => {
          day.expensesList.forEach((expense: any) => {
            const row = expensesSheet.addRow([
              new Date(expense.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US'),
              new Date(expense.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US'),
              expense.type === 'gym_expense' ? t('closing.expenses.gymExpense') : t('closing.expenses.staffLoan'),
              expense.description,
              expense.staff ? expense.staff.name : '-',
              expense.amount,
              expense.type === 'staff_loan' ? (expense.isPaid ? t('closing.expenses.paid') : t('closing.expenses.unpaid')) : '-'
            ])
            row.alignment = { horizontal: direction === 'rtl' ? 'right' : 'left', vertical: 'middle' }
            row.font = { name: 'Arial', size: 10 }
          })
        })

        expensesSheet.columns = [
          { width: 15 },
          { width: 12 },
          { width: 15 },
          { width: 35 },
          { width: 18 },
          { width: 12 },
          { width: 15 }
        ]
      }

      let fileName = 'تقفيل_مالي'
      if (viewMode === 'daily') {
        fileName += `_${selectedDay}`
      } else {
        fileName += `_${selectedMonth}`
      }
      fileName += '.xlsx'

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      window.URL.revokeObjectURL(url)

      console.log('✅', t('closing.excel.success'))

    } catch (error) {
      console.error('❌ خطأ في التصدير:', error)
      alert(t('closing.excel.error'))
    }
  }

  const toggleDayDetails = (date: string) => {
    setExpandedDay(expandedDay === date ? null : date)
  }

  const getTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'Member': t('closing.receiptTypes.member'),
      'PT': t('closing.receiptTypes.pt'),
      'DayUse': t('closing.receiptTypes.dayUse'),
      'InBody': t('closing.receiptTypes.inBody')
    }
    return types[type] || type
  }

  const getPaymentMethodLabel = (method: string) => {
    const methods: { [key: string]: string } = {
      'cash': `${t('closing.paymentMethods.cash')} 💵`,
      'visa': `${t('closing.paymentMethods.visa')} 💳`,
      'instapay': `${t('closing.paymentMethods.instapay')} 📱`,
      'wallet': `${t('closing.paymentMethods.wallet')} 💰`
    }
    return methods[method] || `${t('closing.paymentMethods.cash')} 💵`
  }

  return (
    <div className="container mx-auto p-6" dir={direction}>
      <div className="mb-6 no-print">
        <h1 className="text-3xl font-bold mb-2">💰 {t('closing.title')}</h1>
        <p className="text-gray-600">{t('closing.subtitle')}</p>

        {/* View Mode Tabs */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-6 py-3 rounded-lg font-bold transition ${
              viewMode === 'daily'
                ? 'bg-orange-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📅 {t('closing.viewMode.daily')}
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-6 py-3 rounded-lg font-bold transition ${
              viewMode === 'monthly'
                ? 'bg-orange-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📆 {t('closing.viewMode.monthly')}
          </button>
          <button
            onClick={() => setViewMode('annual')}
            className={`px-6 py-3 rounded-lg font-bold transition ${
              viewMode === 'annual'
                ? 'bg-orange-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📊 {t('closing.viewMode.annual')}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 bg-white p-6 rounded-lg shadow-md no-print">
        <div className="space-y-4">
          {viewMode === 'daily' ? (
            /* اختيار اليوم للعرض اليومي */
            <div>
              <label className="block text-sm font-medium mb-2">📅 {t('closing.controls.selectDay')}</label>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="px-4 py-2 border-2 rounded-lg font-mono text-lg"
              />
              <p className="text-sm text-gray-600 mt-2">
                {t('closing.controls.viewDayDetails', {
                  date: new Date(selectedDay).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                })}
              </p>
            </div>
          ) : viewMode === 'monthly' ? (
            /* اختيار الشهر للعرض الشهري */
            <div>
              <label className="block text-sm font-medium mb-2">📅 {t('closing.controls.selectMonth')}</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border-2 rounded-lg font-mono text-lg"
              />
              <p className="text-sm text-gray-600 mt-2">
                {t('closing.controls.viewMonthDetails', {
                  month: new Date(selectedMonth + '-01').toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })
                })}
              </p>
            </div>
          ) : (
            /* اختيار النطاق الزمني للعرض السنوي */
            <div>
              <label className="block text-sm font-medium mb-2">📊 {t('closing.controls.selectDateRange')}</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('closing.controls.startMonth')}</label>
                  <input
                    type="month"
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    className="w-full px-4 py-2 border-2 rounded-lg font-mono text-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('closing.controls.endMonth')}</label>
                  <input
                    type="month"
                    value={endMonth}
                    onChange={(e) => setEndMonth(e.target.value)}
                    className="w-full px-4 py-2 border-2 rounded-lg font-mono text-lg"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {t('closing.controls.viewAnnualDetails', {
                  start: new Date(startMonth + '-01').toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' }),
                  end: new Date(endMonth + '-01').toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })
                })}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              🖨️ {t('closing.buttons.print')}
            </button>
            <button
              onClick={handleExportExcel}
              className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition flex items-center gap-2"
            >
              📊 {t('closing.buttons.export')}
            </button>
            <button
              onClick={fetchData}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
            >
              🔄 {t('closing.buttons.refresh')}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin text-6xl mb-4">⏳</div>
          <p className="text-xl text-gray-600">{t('closing.loading')}</p>
        </div>
      ) : (
        <>
          {/* Header للطباعة */}
          <div className="text-center mb-6 print-only" style={{ display: 'none' }}>
            <h1 className="text-3xl font-bold mb-2">X - GYM</h1>
            <p className="text-lg text-gray-600">
              {viewMode === 'daily'
                ? `${t('closing.viewMode.daily')} - ${new Date(selectedDay).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
                : `${t('closing.viewMode.monthly')} - ${new Date(selectedMonth + '-01').toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })}`
              }
            </p>
          </div>

          {/* Bar Income Quick Entry */}
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 mb-4 no-print">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-yellow-900 flex items-center gap-2">
                <span>🍵</span>
                <span>إضافة إيراد البار</span>
              </h3>
              <button
                onClick={() => setShowBarForm(!showBarForm)}
                className="text-sm bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
              >
                {showBarForm ? 'إغلاق' : '+ إضافة'}
              </button>
            </div>
            {showBarForm && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium mb-1 text-yellow-800">التاريخ</label>
                  <input
                    type="date"
                    value={barFormData.date}
                    onChange={(e) => setBarFormData({ ...barFormData, date: e.target.value })}
                    className="w-full border-2 border-yellow-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-yellow-800">المبلغ (ج.م)</label>
                  <input
                    type="number"
                    value={barFormData.amount}
                    onChange={(e) => setBarFormData({ ...barFormData, amount: e.target.value })}
                    className="w-full border-2 border-yellow-300 rounded px-2 py-1 text-sm"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-yellow-800">ملاحظة (اختياري)</label>
                  <input
                    type="text"
                    value={barFormData.note}
                    onChange={(e) => setBarFormData({ ...barFormData, note: e.target.value })}
                    className="w-full border-2 border-yellow-300 rounded px-2 py-1 text-sm"
                    placeholder="مبيعات البار..."
                  />
                </div>
                <div>
                  <button
                    onClick={async () => {
                      if (!barFormData.amount || parseFloat(barFormData.amount) <= 0) return
                      setBarFormLoading(true)
                      try {
                        const res = await fetch('/api/bar-income', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            amount: parseFloat(barFormData.amount),
                            note: barFormData.note,
                            date: barFormData.date
                          })
                        })
                        if (res.ok) {
                          setBarFormMessage('✅ تم تسجيل إيراد البار')
                          setBarFormData({ amount: '', note: '', date: new Date().toISOString().split('T')[0] })
                          setShowBarForm(false)
                          fetchData()
                        } else {
                          const err = await res.json()
                          setBarFormMessage(`❌ ${err.error}`)
                        }
                      } catch {
                        setBarFormMessage('❌ حدث خطأ')
                      } finally {
                        setBarFormLoading(false)
                        setTimeout(() => setBarFormMessage(''), 3000)
                      }
                    }}
                    disabled={barFormLoading || !barFormData.amount}
                    className="w-full bg-yellow-500 text-white py-1.5 rounded hover:bg-yellow-600 disabled:bg-gray-400 text-sm font-bold"
                  >
                    {barFormLoading ? '...' : 'حفظ'}
                  </button>
                </div>
              </div>
            )}
            {barFormMessage && (
              <p className="text-sm mt-2 font-medium">{barFormMessage}</p>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 no-print">
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{t('closing.stats.totalRevenue')}</p>
              <p className="text-3xl font-bold">{totals.totalRevenue.toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{t('closing.stats.totalExpenses')}</p>
              <p className="text-3xl font-bold">{totals.expenses.toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{t('closing.stats.netProfit')}</p>
              <p className="text-3xl font-bold">{totals.netProfit.toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-4 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{t('closing.stats.totalPayments')}</p>
              <p className="text-3xl font-bold">{totals.totalPayments.toFixed(0)}</p>
            </div>
          </div>

          {/* Revenue Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6 no-print">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">Floor Revenue 🏋️</p>
              <p className="text-3xl font-bold">{totals.floor.toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">PT Revenue 💪</p>
              <p className="text-3xl font-bold">{totals.pt.toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white p-4 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">Nutrition 🥗</p>
              <p className="text-3xl font-bold">{totals.nutrition.toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">Physiotherapy 🏥</p>
              <p className="text-3xl font-bold">{totals.physiotherapy.toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500 to-amber-600 text-white p-4 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">Bar 🍵</p>
              <p className="text-3xl font-bold">{totals.bar.toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{t('closing.stats.numberOfDays')}</p>
              <p className="text-3xl font-bold">{dailyData.length}</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-4 rounded-lg shadow-lg">
              <p className="text-sm opacity-90">{t('closing.stats.dailyAverage')}</p>
              <p className="text-3xl font-bold">
                {dailyData.length > 0 ? (totals.totalRevenue / dailyData.length).toFixed(0) : 0}
              </p>
            </div>
          </div>

          {/* Payment Methods Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 no-print">
            <div className="bg-white border-2 border-green-300 p-4 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('closing.paymentMethods.cash')} 💵</p>
                  <p className="text-2xl font-bold text-green-600">{totals.cash.toFixed(0)}</p>
                </div>
                <span className="text-4xl">💵</span>
              </div>
            </div>
            <div className="bg-white border-2 border-orange-300 p-4 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('closing.paymentMethods.visa')} 💳</p>
                  <p className="text-2xl font-bold text-orange-600">{totals.visa.toFixed(0)}</p>
                </div>
                <span className="text-4xl">💳</span>
              </div>
            </div>
            <div className="bg-white border-2 border-purple-300 p-4 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('closing.paymentMethods.instapay')} 📱</p>
                  <p className="text-2xl font-bold text-purple-600">{totals.instapay.toFixed(0)}</p>
                </div>
                <span className="text-4xl">📱</span>
              </div>
            </div>
            <div className="bg-white border-2 border-orange-300 p-4 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('closing.paymentMethods.wallet')} 💰</p>
                  <p className="text-2xl font-bold text-orange-600">{totals.wallet.toFixed(0)}</p>
                </div>
                <span className="text-4xl">💰</span>
              </div>
            </div>
          </div>

          {/* Excel-like Table */}
          <div className="bg-white rounded-lg shadow-lg overflow-x-auto mb-6">
            {viewMode === 'daily' ? (
              /* عرض تفاصيل اليوم المحدد مباشرة */
              dailyData.length > 0 ? (
                <div className="p-6 space-y-6">
                  {dailyData.map((day) => (
                    <div key={day.date} className="space-y-4">
                      {/* معلومات اليوم */}
                      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold mb-2">
                          📅 {new Date(day.date).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
                          <div className="bg-white/20 p-3 rounded-lg">
                            <p className="text-sm opacity-90">{t('closing.table.floor')}</p>
                            <p className="text-xl font-bold">{day.floor > 0 ? day.floor.toFixed(0) : '0'} {t('closing.currency')}</p>
                          </div>
                          <div className="bg-white/20 p-3 rounded-lg">
                            <p className="text-sm opacity-90">{t('closing.table.pt')}</p>
                            <p className="text-xl font-bold">{day.pt > 0 ? day.pt.toFixed(0) : '0'} {t('closing.currency')}</p>
                          </div>
                          <div className="bg-white/20 p-3 rounded-lg">
                            <p className="text-sm opacity-90">Nutrition 🥗</p>
                            <p className="text-xl font-bold">{day.nutrition > 0 ? day.nutrition.toFixed(0) : '0'} {t('closing.currency')}</p>
                          </div>
                          <div className="bg-white/20 p-3 rounded-lg">
                            <p className="text-sm opacity-90">Physio 🏥</p>
                            <p className="text-xl font-bold">{day.physiotherapy > 0 ? day.physiotherapy.toFixed(0) : '0'} {t('closing.currency')}</p>
                          </div>
                          {day.bar > 0 && (
                            <div className="bg-white/20 p-3 rounded-lg">
                              <p className="text-sm opacity-90">Bar 🍵</p>
                              <p className="text-xl font-bold">{day.bar.toFixed(0)} {t('closing.currency')}</p>
                            </div>
                          )}
                          <div className="bg-white/20 p-3 rounded-lg">
                            <p className="text-sm opacity-90">{t('closing.table.expenses')}</p>
                            <p className="text-xl font-bold">{day.expenses > 0 ? day.expenses.toFixed(0) : '0'} {t('closing.currency')}</p>
                          </div>
                          <div className="bg-white/20 p-3 rounded-lg">
                            <p className="text-sm opacity-90">{t('closing.table.total')}</p>
                            <p className="text-xl font-bold">{((day.floor + day.pt + day.nutrition + day.physiotherapy + day.bar) - day.expenses).toFixed(0)} {t('closing.currency')}</p>
                          </div>
                        </div>
                      </div>

                      {/* طرق الدفع */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-bold text-lg mb-3">💳 {t('closing.paymentMethods.title')}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-white p-3 rounded-lg border-2 border-green-200">
                            <p className="text-sm text-gray-600">{t('closing.paymentMethods.cash')} 💵</p>
                            <p className="text-lg font-bold text-green-600">{day.cash > 0 ? day.cash.toFixed(0) : '0'}</p>
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-xs text-gray-500">{t('closing.paymentMethods.netCash')}</p>
                              <p className="text-sm font-bold text-orange-600">{(day.cash - day.expenses).toFixed(0)} {t('closing.currency')}</p>
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border-2 border-orange-200">
                            <p className="text-sm text-gray-600">{t('closing.paymentMethods.visa')} 💳</p>
                            <p className="text-lg font-bold text-orange-600">{day.visa > 0 ? day.visa.toFixed(0) : '0'}</p>
                          </div>
                          <div className="bg-white p-3 rounded-lg border-2 border-purple-200">
                            <p className="text-sm text-gray-600">{t('closing.paymentMethods.instapay')} 📱</p>
                            <p className="text-lg font-bold text-purple-600">{day.instapay > 0 ? day.instapay.toFixed(0) : '0'}</p>
                          </div>
                          <div className="bg-white p-3 rounded-lg border-2 border-orange-200">
                            <p className="text-sm text-gray-600">{t('closing.paymentMethods.wallet')} 💰</p>
                            <p className="text-lg font-bold text-orange-600">{day.wallet > 0 ? day.wallet.toFixed(0) : '0'}</p>
                          </div>
                        </div>
                      </div>

                      {/* السلف */}
                      {Object.keys(day.staffLoans).length > 0 && (
                        <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
                          <h3 className="font-bold text-lg mb-3">💰 {t('closing.staffLoans.title')}</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Object.entries(day.staffLoans).map(([staffName, amount]) => (
                              <div key={staffName} className="bg-white p-3 rounded-lg">
                                <p className="text-sm text-gray-600">{staffName}</p>
                                <p className="text-lg font-bold text-red-600">{amount.toFixed(0)} {t('closing.currency')}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* الإيصالات */}
                      {day.receipts.length > 0 ? (
                        <div>
                          <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                            <span>🧾</span>
                            <span>{t('closing.receipts.count', { count: day.receipts.length.toString() })}</span>
                          </h4>
                          <div className="bg-white rounded-lg overflow-hidden border-2 border-orange-200">
                            <table className="w-full text-sm">
                              <thead className="bg-orange-100">
                                <tr>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.receipts.time')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.receipts.receiptNumber')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.receipts.type')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.receipts.details')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.receipts.amount')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.receipts.paymentMethod')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {day.receipts.map((receipt: any) => {
                                  const details = JSON.parse(receipt.itemDetails)
                                  return (
                                    <tr key={receipt.id} className={`border-t ${receipt.isCancelled ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-orange-50'}`}>
                                      <td className="px-3 py-2 font-mono text-xs">
                                        {new Date(receipt.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <span className={`font-bold ${receipt.isCancelled ? 'text-red-600 line-through' : 'text-green-600'}`}>
                                            #{receipt.receiptNumber}
                                          </span>
                                          {receipt.isCancelled && (
                                            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">ملغي</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                                          {getTypeLabel(receipt.type)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2">
                                        {details.memberName && (
                                          <div>
                                            {details.memberName}
                                            {details.memberNumber && (
                                              <span className="text-xs text-gray-600"> (#{details.memberNumber})</span>
                                            )}
                                          </div>
                                        )}
                                        {details.clientName && <div>{details.clientName}</div>}
                                        {details.name && <div>{details.name}</div>}
                                      </td>
                                      <td className="px-3 py-2 font-bold text-green-600">
                                        {receipt.amount} {t('closing.currency')}
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className="text-xs">
                                          {getPaymentMethodLabel(receipt.paymentMethod)}
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-8 rounded-lg text-center">
                          <p className="text-gray-500 text-lg">📭 {t('closing.receipts.noReceipts')}</p>
                        </div>
                      )}

                      {/* المصروفات */}
                      {day.expensesList.length > 0 ? (
                        <div>
                          <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                            <span>💸</span>
                            <span>{t('closing.expenses.count', { count: day.expensesList.length.toString() })}</span>
                          </h4>
                          <div className="bg-white rounded-lg overflow-hidden border-2 border-red-200">
                            <table className="w-full text-sm">
                              <thead className="bg-red-100">
                                <tr>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.expenses.time')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.expenses.type')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.expenses.description')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.expenses.staff')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.expenses.amount')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.expenses.status')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {day.expensesList.map((expense: any) => (
                                  <tr key={expense.id} className="border-t hover:bg-red-50">
                                    <td className="px-3 py-2 font-mono text-xs">
                                      {new Date(expense.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-1 rounded text-xs ${
                                        expense.type === 'gym_expense'
                                          ? 'bg-orange-100 text-orange-800'
                                          : 'bg-purple-100 text-purple-800'
                                      }`}>
                                        {expense.type === 'gym_expense' ? t('closing.expenses.gymExpense') : t('closing.expenses.staffLoan')}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2">{expense.description}</td>
                                    <td className="px-3 py-2">
                                      {expense.staff ? expense.staff.name : '-'}
                                    </td>
                                    <td className="px-3 py-2 font-bold text-red-600">
                                      {expense.amount} {t('closing.currency')}
                                    </td>
                                    <td className="px-3 py-2">
                                      {expense.type === 'staff_loan' && (
                                        <span className={`px-2 py-1 rounded text-xs ${
                                          expense.isPaid
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                          {expense.isPaid ? `✅ ${t('closing.expenses.paid')}` : `❌ ${t('closing.expenses.unpaid')}`}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-8 rounded-lg text-center">
                          <p className="text-gray-500 text-lg">📭 {t('closing.expenses.noExpenses')}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500 text-lg">📭 {t('closing.noData')}</p>
                </div>
              )
            ) : viewMode === 'monthly' ? (
              /* الجدول العادي للعرض الشهري */
            <table className="w-full border-collapse text-sm excel-table">
              <thead>
                <tr className="bg-gray-200 border-2 border-gray-400">
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold">{t('closing.table.date')}</th>
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-orange-100">{t('closing.table.floor')}</th>
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-green-100">{t('closing.table.pt')}</th>
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-teal-100">Nutrition 🥗</th>
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-blue-100">Physio 🏥</th>
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-green-50">{t('closing.table.cash')} 💵</th>
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-orange-50">{t('closing.table.visa')} 💳</th>
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-purple-50">{t('closing.table.instapay')} 📱</th>
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-orange-50">{t('closing.table.wallet')} 💰</th>
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-yellow-100">{t('closing.table.total')} 💰</th>
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-orange-100">{t('closing.table.expenses')}</th>
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold min-w-[300px]">{t('closing.table.expenseDetails')}</th>
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-yellow-50">{t('closing.table.loans')}</th>
                  {(staffList || []).map(staff => (
                    <th key={staff.id} className="border border-gray-400 px-3 py-2 text-center font-bold bg-red-50 min-w-[80px]">
                      {staff.name}
                    </th>
                  ))}
                  <th className="border border-gray-400 px-3 py-2 text-center font-bold no-print">{t('closing.table.details')}</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.map((day, index) => (
                  <>
                    <tr
                      key={day.date}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} cursor-pointer hover:bg-orange-50`}
                      onClick={() => toggleDayDetails(day.date)}
                    >
                      <td className="border border-gray-300 px-3 py-2 text-center font-mono">
                        {new Date(day.date).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-orange-600`}>
                        {day.floor > 0 ? day.floor.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-green-600`}>
                        {day.pt > 0 ? day.pt.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-teal-600`}>
                        {day.nutrition > 0 ? day.nutrition.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-blue-600`}>
                        {day.physiotherapy > 0 ? day.physiotherapy.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-green-700`}>
                        {day.cash > 0 ? day.cash.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-orange-700`}>
                        {day.visa > 0 ? day.visa.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-purple-700`}>
                        {day.instapay > 0 ? day.instapay.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-orange-700`}>
                        {day.wallet > 0 ? day.wallet.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-yellow-700 bg-yellow-50`}>
                        {(day.cash + day.visa + day.instapay + day.wallet).toFixed(0)}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-red-600`}>
                        {day.expenses > 0 ? day.expenses.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} text-xs`}>
                        {day.expenseDetails || '-'}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-orange-600`}>
                        {Object.values(day.staffLoans).reduce((a, b) => a + b, 0).toFixed(0) || '-'}
                      </td>
                      {(staffList || []).map(staff => (
                        <td key={staff.id} className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} text-red-600`}>
                          {day.staffLoans[staff.name] ? day.staffLoans[staff.name].toFixed(0) : '-'}
                        </td>
                      ))}
                      <td className="border border-gray-300 px-3 py-2 text-center no-print">
                        <button className="text-orange-600 hover:text-orange-800 font-bold">
                          {expandedDay === day.date ? `▼ ${t('closing.buttons.hide')}` : `▶ ${t('closing.buttons.show')}`}
                        </button>
                      </td>
                    </tr>

                    {/* تفاصيل اليوم */}
                    {expandedDay === day.date && (
                      <tr className="bg-orange-50 no-print">
                        <td colSpan={(staffList?.length || 0) + 12} className="border border-gray-400 p-4">
                          <div className="space-y-4">
                            {/* الإيصالات */}
                            {day.receipts.length > 0 && (
                              <div>
                                <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                                  <span>🧾</span>
                                  <span>{t('closing.receipts.count', { count: day.receipts.length.toString() })}</span>
                                </h4>
                                <div className="bg-white rounded-lg overflow-hidden border-2 border-orange-200">
                                  <table className="w-full text-sm">
                                    <thead className="bg-orange-100">
                                      <tr>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.receipts.time')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.receipts.receiptNumber')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.receipts.type')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.receipts.details')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.receipts.amount')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.receipts.paymentMethod')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {day.receipts.map((receipt: any) => {
                                        const details = JSON.parse(receipt.itemDetails)
                                        return (
                                          <tr key={receipt.id} className={`border-t ${receipt.isCancelled ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-orange-50'}`}>
                                            <td className="px-3 py-2 font-mono text-xs">
                                              {new Date(receipt.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                            </td>
                                            <td className="px-3 py-2">
                                              <div className="flex items-center gap-2">
                                                <span className={`font-bold ${receipt.isCancelled ? 'text-red-600 line-through' : 'text-green-600'}`}>
                                                  #{receipt.receiptNumber}
                                                </span>
                                                {receipt.isCancelled && (
                                                  <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">ملغي</span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-3 py-2">
                                              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                                                {getTypeLabel(receipt.type)}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2">
                                              {details.memberName && (
                                                <div>
                                                  {details.memberName}
                                                  {details.memberNumber && (
                                                    <span className="text-xs text-gray-600"> (#{details.memberNumber})</span>
                                                  )}
                                                </div>
                                              )}
                                              {details.clientName && <div>{details.clientName}</div>}
                                              {details.name && <div>{details.name}</div>}
                                            </td>
                                            <td className="px-3 py-2 font-bold text-green-600">
                                              {receipt.amount} {t('closing.currency')}
                                            </td>
                                            <td className="px-3 py-2">
                                              <span className="text-xs">
                                                {getPaymentMethodLabel(receipt.paymentMethod)}
                                              </span>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* المصروفات */}
                            {day.expensesList.length > 0 && (
                              <div>
                                <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                                  <span>💸</span>
                                  <span>{t('closing.expenses.count', { count: day.expensesList.length.toString() })}</span>
                                </h4>
                                <div className="bg-white rounded-lg overflow-hidden border-2 border-red-200">
                                  <table className="w-full text-sm">
                                    <thead className="bg-red-100">
                                      <tr>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.expenses.time')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.expenses.type')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.expenses.description')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.expenses.staff')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.expenses.amount')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('closing.expenses.status')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {day.expensesList.map((expense: any) => (
                                        <tr key={expense.id} className="border-t hover:bg-red-50">
                                          <td className="px-3 py-2 font-mono text-xs">
                                            {new Date(expense.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                          </td>
                                          <td className="px-3 py-2">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                              expense.type === 'gym_expense'
                                                ? 'bg-orange-100 text-orange-800'
                                                : 'bg-purple-100 text-purple-800'
                                            }`}>
                                              {expense.type === 'gym_expense' ? t('closing.expenses.gymExpense') : t('closing.expenses.staffLoan')}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2">{expense.description}</td>
                                          <td className="px-3 py-2">
                                            {expense.staff ? expense.staff.name : '-'}
                                          </td>
                                          <td className="px-3 py-2 font-bold text-red-600">
                                            {expense.amount} {t('closing.currency')}
                                          </td>
                                          <td className="px-3 py-2">
                                            {expense.type === 'staff_loan' && (
                                              <span className={`px-2 py-1 rounded text-xs ${
                                                expense.isPaid
                                                  ? 'bg-green-100 text-green-800'
                                                  : 'bg-red-100 text-red-800'
                                              }`}>
                                                {expense.isPaid ? `✅ ${t('closing.expenses.paid')}` : `❌ ${t('closing.expenses.unpaid')}`}
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}

                {/* Totals Row */}
                <tr className="bg-yellow-100 border-t-4 border-yellow-600 font-bold">
                  <td className="border border-gray-400 px-3 py-3 text-center">{t('closing.table.totalLabel')}</td>
                  <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-orange-700 text-lg`}>
                    {totals.floor.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-green-700 text-lg`}>
                    {totals.pt.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-teal-700 text-lg`}>
                    {totals.nutrition.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-blue-700 text-lg`}>
                    {totals.physiotherapy.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-green-800 text-lg`}>
                    {totals.cash.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-orange-800 text-lg`}>
                    {totals.visa.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-purple-800 text-lg`}>
                    {totals.instapay.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-orange-800 text-lg`}>
                    {totals.wallet.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-yellow-800 text-lg bg-yellow-200`}>
                    {totals.totalPayments.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-red-700 text-lg`}>
                    {totals.expenses.toFixed(0)}
                  </td>
                  <td className="border border-gray-400 px-3 py-3"></td>
                  <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-orange-700 text-lg`}>
                    {dailyData.reduce((sum, day) =>
                      sum + Object.values(day.staffLoans).reduce((a, b) => a + b, 0), 0
                    ).toFixed(0)}
                  </td>
                  {(staffList || []).map(staff => {
                    const total = dailyData.reduce((sum, day) =>
                      sum + (day.staffLoans[staff.name] || 0), 0
                    )
                    return (
                      <td key={staff.id} className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-red-700`}>
                        {total > 0 ? total.toFixed(0) : '-'}
                      </td>
                    )
                  })}
                  <td className="border border-gray-400 px-3 py-3 no-print"></td>
                </tr>

                {/* Net Profit Row */}
                <tr className="bg-green-100 border-t-2 border-green-600 font-bold">
                  <td colSpan={3} className="border border-gray-400 px-3 py-3 text-center text-lg">
                    {t('closing.stats.netProfit')}
                  </td>
                  <td colSpan={(staffList?.length || 0) + 9} className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-2xl text-green-700`}>
                    {totals.netProfit.toFixed(0)} {t('closing.currency')}
                  </td>
                </tr>
              </tbody>
            </table>
            ) : viewMode === 'annual' ? (
              /* عرض التقفيل السنوي */
              <div className="space-y-6">
                {/* جراف الأرباح الشهرية */}
                <div className="bg-white p-6 rounded-lg shadow-lg">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span>📈</span>
                    <span>{t('closing.annual.profitChart')}</span>
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="monthLabel"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '2px solid #f97316',
                          borderRadius: '8px',
                          direction: direction
                        }}
                        formatter={(value: number) => `${value.toFixed(0)} ${t('closing.currency')}`}
                      />
                      <Legend />
                      <Bar dataKey="totalRevenue" fill="#10b981" name={t('closing.annual.revenue')} />
                      <Bar dataKey="totalExpenses" fill="#ef4444" name={t('closing.annual.expenses')} />
                      <Bar dataKey="netProfit" fill="#f97316" name={t('closing.annual.netProfit')} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* جراف تفصيلي للإيرادات */}
                <div className="bg-white p-6 rounded-lg shadow-lg">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span>💰</span>
                    <span>{t('closing.annual.revenueBreakdown')}</span>
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="monthLabel"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '2px solid #f97316',
                          borderRadius: '8px',
                          direction: direction
                        }}
                        formatter={(value: number) => `${value.toFixed(0)} ${t('closing.currency')}`}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="floor" stroke="#f97316" strokeWidth={2} name="Floor 🏋️" />
                      <Line type="monotone" dataKey="pt" stroke="#10b981" strokeWidth={2} name="PT 💪" />
                      <Line type="monotone" dataKey="nutrition" stroke="#14b8a6" strokeWidth={2} name="Nutrition 🥗" />
                      <Line type="monotone" dataKey="physiotherapy" stroke="#3b82f6" strokeWidth={2} name="Physiotherapy 🏥" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* جدول البيانات الشهرية */}
                <div className="bg-white rounded-lg shadow-lg overflow-x-auto">
                  <h3 className="text-xl font-bold p-6 pb-0 flex items-center gap-2">
                    <span>📊</span>
                    <span>{t('closing.annual.monthlyTable')}</span>
                  </h3>
                  <table className="w-full border-collapse text-sm excel-table mt-4">
                    <thead>
                      <tr className="bg-gray-200 border-2 border-gray-400">
                        <th className="border border-gray-400 px-3 py-2 text-center font-bold">{t('closing.annual.month')}</th>
                        <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-orange-100">Floor 🏋️</th>
                        <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-green-100">PT 💪</th>
                        <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-teal-100">Nutrition 🥗</th>
                        <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-blue-100">Physio 🏥</th>
                        <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-green-50">{t('closing.annual.totalRevenue')}</th>
                        <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-red-100">{t('closing.annual.totalExpenses')}</th>
                        <th className="border border-gray-400 px-3 py-2 text-center font-bold bg-yellow-100">{t('closing.annual.netProfit')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((month, index) => (
                        <tr key={month.month} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50`}>
                          <td className="border border-gray-300 px-3 py-2 text-center font-bold">
                            {month.monthLabel}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-orange-600`}>
                            {month.floor > 0 ? month.floor.toFixed(0) : '-'}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-green-600`}>
                            {month.pt > 0 ? month.pt.toFixed(0) : '-'}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-teal-600`}>
                            {month.nutrition > 0 ? month.nutrition.toFixed(0) : '-'}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-blue-600`}>
                            {month.physiotherapy > 0 ? month.physiotherapy.toFixed(0) : '-'}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-green-700`}>
                            {month.totalRevenue.toFixed(0)}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-red-600`}>
                            {month.totalExpenses.toFixed(0)}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold ${month.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {month.netProfit.toFixed(0)}
                          </td>
                        </tr>
                      ))}

                      {/* الإجماليات */}
                      <tr className="bg-yellow-100 border-t-4 border-yellow-600 font-bold">
                        <td className="border border-gray-400 px-3 py-3 text-center">{t('closing.table.totalLabel')}</td>
                        <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-orange-700 text-lg`}>
                          {totals.floor.toFixed(0)}
                        </td>
                        <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-green-700 text-lg`}>
                          {totals.pt.toFixed(0)}
                        </td>
                        <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-teal-700 text-lg`}>
                          {totals.nutrition.toFixed(0)}
                        </td>
                        <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-blue-700 text-lg`}>
                          {totals.physiotherapy.toFixed(0)}
                        </td>
                        <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-green-800 text-lg`}>
                          {totals.totalRevenue.toFixed(0)}
                        </td>
                        <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-red-700 text-lg`}>
                          {totals.expenses.toFixed(0)}
                        </td>
                        <td className={`border border-gray-400 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-yellow-800 text-lg bg-yellow-200`}>
                          {totals.netProfit.toFixed(0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* تحليل توزيع الإيرادات - Pie Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <span>🎯</span>
                      <span>{t('closing.annual.revenueDistribution')}</span>
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Floor 🏋️', value: totals.floor, color: '#f97316' },
                            { name: 'PT 💪', value: totals.pt, color: '#10b981' },
                            { name: 'Nutrition 🥗', value: totals.nutrition, color: '#14b8a6' },
                            { name: 'Physiotherapy 🏥', value: totals.physiotherapy, color: '#3b82f6' }
                          ].filter(item => item.value > 0)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${((entry.value / totals.totalRevenue) * 100).toFixed(1)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[
                            { name: 'Floor 🏋️', value: totals.floor, color: '#f97316' },
                            { name: 'PT 💪', value: totals.pt, color: '#10b981' },
                            { name: 'Nutrition 🥗', value: totals.nutrition, color: '#14b8a6' },
                            { name: 'Physiotherapy 🏥', value: totals.physiotherapy, color: '#3b82f6' }
                          ].filter(item => item.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${value.toFixed(0)} ${t('closing.currency')}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* نسبة المصاريف للإيرادات */}
                  <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <span>📊</span>
                      <span>{t('closing.annual.expenseAnalysis')}</span>
                    </h3>
                    <div className="space-y-4">
                      {(() => {
                        const expenseRatio = totals.totalRevenue > 0 ? (totals.expenses / totals.totalRevenue) * 100 : 0
                        const profitMargin = totals.totalRevenue > 0 ? (totals.netProfit / totals.totalRevenue) * 100 : 0
                        return (
                          <>
                            <div className="bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-lg border-2 border-red-200">
                              <p className="text-sm text-red-700 mb-1">{t('closing.annual.expenseRatio')}</p>
                              <p className={`text-3xl font-bold ${expenseRatio > 70 ? 'text-red-600' : expenseRatio > 50 ? 'text-orange-600' : 'text-green-600'}`}>
                                {expenseRatio.toFixed(1)}%
                              </p>
                              <div className="mt-2 w-full bg-gray-200 rounded-full h-3">
                                <div
                                  className={`h-3 rounded-full transition-all ${expenseRatio > 70 ? 'bg-red-600' : expenseRatio > 50 ? 'bg-orange-500' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min(expenseRatio, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border-2 border-green-200">
                              <p className="text-sm text-green-700 mb-1">{t('closing.annual.profitMargin')}</p>
                              <p className={`text-3xl font-bold ${profitMargin < 20 ? 'text-red-600' : profitMargin < 40 ? 'text-orange-600' : 'text-green-600'}`}>
                                {profitMargin.toFixed(1)}%
                              </p>
                              <div className="mt-2 w-full bg-gray-200 rounded-full h-3">
                                <div
                                  className={`h-3 rounded-full transition-all ${profitMargin < 20 ? 'bg-red-600' : profitMargin < 40 ? 'bg-orange-500' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min(profitMargin, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                </div>

                {/* تحليل النمو الشهري (Month-over-Month Growth) */}
                {monthlyData.length > 1 && (
                  <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <span>📈</span>
                      <span>{t('closing.annual.monthlyGrowth')}</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-gradient-to-r from-blue-100 to-blue-50 border-2 border-blue-300">
                            <th className="border border-gray-300 px-3 py-2 text-center font-bold">{t('closing.annual.month')}</th>
                            <th className="border border-gray-300 px-3 py-2 text-center font-bold">{t('closing.annual.revenue')}</th>
                            <th className="border border-gray-300 px-3 py-2 text-center font-bold bg-green-50">{t('closing.annual.revenueGrowth')}</th>
                            <th className="border border-gray-300 px-3 py-2 text-center font-bold">{t('closing.annual.expenses')}</th>
                            <th className="border border-gray-300 px-3 py-2 text-center font-bold bg-red-50">{t('closing.annual.expenseChange')}</th>
                            <th className="border border-gray-300 px-3 py-2 text-center font-bold">{t('closing.annual.netProfit')}</th>
                            <th className="border border-gray-300 px-3 py-2 text-center font-bold bg-yellow-50">{t('closing.annual.profitGrowth')}</th>
                            <th className="border border-gray-300 px-3 py-2 text-center font-bold">{t('closing.annual.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyData.map((month, index) => {
                            const prevMonth = index > 0 ? monthlyData[index - 1] : null
                            const revenueGrowth = prevMonth && prevMonth.totalRevenue > 0
                              ? ((month.totalRevenue - prevMonth.totalRevenue) / prevMonth.totalRevenue) * 100
                              : null
                            const expenseChange = prevMonth && prevMonth.totalExpenses > 0
                              ? ((month.totalExpenses - prevMonth.totalExpenses) / prevMonth.totalExpenses) * 100
                              : null
                            const profitGrowth = prevMonth && prevMonth.netProfit !== 0
                              ? ((month.netProfit - prevMonth.netProfit) / Math.abs(prevMonth.netProfit)) * 100
                              : null

                            return (
                              <tr key={month.month} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                                <td className="border border-gray-300 px-3 py-2 text-center font-bold">
                                  {month.monthLabel}
                                </td>
                                <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-blue-600`}>
                                  {month.totalRevenue.toFixed(0)}
                                </td>
                                <td className={`border border-gray-300 px-3 py-2 text-center font-bold ${
                                  revenueGrowth === null ? 'text-gray-400' :
                                  revenueGrowth > 0 ? 'text-green-600' :
                                  revenueGrowth < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {revenueGrowth === null ? '-' :
                                   `${revenueGrowth > 0 ? '↗' : revenueGrowth < 0 ? '↘' : '→'} ${Math.abs(revenueGrowth).toFixed(1)}%`}
                                </td>
                                <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-red-600`}>
                                  {month.totalExpenses.toFixed(0)}
                                </td>
                                <td className={`border border-gray-300 px-3 py-2 text-center font-bold ${
                                  expenseChange === null ? 'text-gray-400' :
                                  expenseChange > 0 ? 'text-red-600' :
                                  expenseChange < 0 ? 'text-green-600' : 'text-gray-600'
                                }`}>
                                  {expenseChange === null ? '-' :
                                   `${expenseChange > 0 ? '↗' : expenseChange < 0 ? '↘' : '→'} ${Math.abs(expenseChange).toFixed(1)}%`}
                                </td>
                                <td className={`border border-gray-300 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold ${
                                  month.netProfit >= 0 ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {month.netProfit.toFixed(0)}
                                </td>
                                <td className={`border border-gray-300 px-3 py-2 text-center font-bold ${
                                  profitGrowth === null ? 'text-gray-400' :
                                  profitGrowth > 0 ? 'text-green-600' :
                                  profitGrowth < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {profitGrowth === null ? '-' :
                                   `${profitGrowth > 0 ? '↗' : profitGrowth < 0 ? '↘' : '→'} ${Math.abs(profitGrowth).toFixed(1)}%`}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-center">
                                  {revenueGrowth !== null && revenueGrowth > 10 ? '🔥' :
                                   revenueGrowth !== null && revenueGrowth < -10 ? '⚠️' :
                                   profitGrowth !== null && profitGrowth > 15 ? '✅' :
                                   profitGrowth !== null && profitGrowth < -15 ? '❌' : '➖'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* تحليل الاتجاهات والتحذيرات */}
                {monthlyData.length >= 3 && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg shadow-lg border-2 border-purple-200">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <span>🔍</span>
                      <span>{t('closing.annual.trendsAnalysis')}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(() => {
                        const lastThreeMonths = monthlyData.slice(-3)
                        const avgRevenue = lastThreeMonths.reduce((sum, m) => sum + m.totalRevenue, 0) / 3
                        const avgExpenses = lastThreeMonths.reduce((sum, m) => sum + m.totalExpenses, 0) / 3
                        const avgProfit = lastThreeMonths.reduce((sum, m) => sum + m.netProfit, 0) / 3

                        const revenueIncreasing = lastThreeMonths.length >= 2 &&
                          lastThreeMonths[lastThreeMonths.length - 1].totalRevenue > lastThreeMonths[0].totalRevenue
                        const expensesIncreasing = lastThreeMonths.length >= 2 &&
                          lastThreeMonths[lastThreeMonths.length - 1].totalExpenses > lastThreeMonths[0].totalExpenses
                        const profitIncreasing = lastThreeMonths.length >= 2 &&
                          lastThreeMonths[lastThreeMonths.length - 1].netProfit > lastThreeMonths[0].netProfit

                        const alerts = []

                        // تحذيرات
                        if (!revenueIncreasing) {
                          alerts.push({ type: 'warning', icon: '⚠️', message: t('closing.annual.alerts.revenueDecreasing') })
                        }
                        if (expensesIncreasing && avgExpenses / avgRevenue > 0.6) {
                          alerts.push({ type: 'danger', icon: '🚨', message: t('closing.annual.alerts.expensesHigh') })
                        }
                        if (!profitIncreasing) {
                          alerts.push({ type: 'warning', icon: '📉', message: t('closing.annual.alerts.profitDecreasing') })
                        }
                        if (lastThreeMonths.some(m => m.netProfit < 0)) {
                          alerts.push({ type: 'danger', icon: '❌', message: t('closing.annual.alerts.hasLoss') })
                        }

                        // إيجابيات
                        if (revenueIncreasing && profitIncreasing) {
                          alerts.push({ type: 'success', icon: '✅', message: t('closing.annual.alerts.excellentPerformance') })
                        }
                        if (avgExpenses / avgRevenue < 0.4) {
                          alerts.push({ type: 'success', icon: '💎', message: t('closing.annual.alerts.excellentExpenseRatio') })
                        }

                        return (
                          <>
                            <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                              <p className="text-sm text-gray-600 mb-1">{t('closing.annual.revenueTrend')}</p>
                              <p className={`text-2xl font-bold flex items-center gap-2 ${revenueIncreasing ? 'text-green-600' : 'text-red-600'}`}>
                                {revenueIncreasing ? '↗️' : '↘️'}
                                {revenueIncreasing ? t('closing.annual.ascending') : t('closing.annual.descending')}
                              </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border-2 border-yellow-200">
                              <p className="text-sm text-gray-600 mb-1">{t('closing.annual.expenseTrend')}</p>
                              <p className={`text-2xl font-bold flex items-center gap-2 ${!expensesIncreasing ? 'text-green-600' : 'text-orange-600'}`}>
                                {expensesIncreasing ? '↗️' : '↘️'}
                                {expensesIncreasing ? t('closing.annual.increasing') : t('closing.annual.decreasing')}
                              </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border-2 border-green-200">
                              <p className="text-sm text-gray-600 mb-1">{t('closing.annual.profitTrend')}</p>
                              <p className={`text-2xl font-bold flex items-center gap-2 ${profitIncreasing ? 'text-green-600' : 'text-red-600'}`}>
                                {profitIncreasing ? '↗️' : '↘️'}
                                {profitIncreasing ? t('closing.annual.improving') : t('closing.annual.declining')}
                              </p>
                            </div>
                            {alerts.length > 0 && (
                              <div className="md:col-span-2 lg:col-span-3 space-y-2">
                                {alerts.map((alert, idx) => (
                                  <div
                                    key={idx}
                                    className={`p-3 rounded-lg border-2 flex items-center gap-3 ${
                                      alert.type === 'danger' ? 'bg-red-50 border-red-300 text-red-800' :
                                      alert.type === 'warning' ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                                      'bg-green-50 border-green-300 text-green-800'
                                    }`}
                                  >
                                    <span className="text-2xl">{alert.icon}</span>
                                    <span className="font-bold">{alert.message}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}

                {/* الإحصائيات السنوية */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
                    <p className="text-sm opacity-90">{t('closing.annual.stats.numberOfMonths')}</p>
                    <p className="text-3xl font-bold">{monthlyData.length}</p>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-lg shadow-lg">
                    <p className="text-sm opacity-90">{t('closing.annual.stats.monthlyAvgRevenue')}</p>
                    <p className="text-3xl font-bold">
                      {monthlyData.length > 0 ? (totals.totalRevenue / monthlyData.length).toFixed(0) : 0}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-pink-500 to-pink-600 text-white p-6 rounded-lg shadow-lg">
                    <p className="text-sm opacity-90">{t('closing.annual.stats.monthlyAvgExpenses')}</p>
                    <p className="text-3xl font-bold">
                      {monthlyData.length > 0 ? (totals.expenses / monthlyData.length).toFixed(0) : 0}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-6 rounded-lg shadow-lg">
                    <p className="text-sm opacity-90">{t('closing.annual.stats.monthlyAvgProfit')}</p>
                    <p className="text-3xl font-bold">
                      {monthlyData.length > 0 ? (totals.netProfit / monthlyData.length).toFixed(0) : 0}
                    </p>
                  </div>
                </div>

                {/* أفضل وأسوأ شهر */}
                {monthlyData.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg shadow-lg border-2 border-green-300">
                      <h4 className="text-lg font-bold text-green-800 mb-3 flex items-center gap-2">
                        <span>🏆</span>
                        <span>{t('closing.annual.stats.bestMonth')}</span>
                      </h4>
                      {(() => {
                        const bestMonth = monthlyData.reduce((max, month) =>
                          month.netProfit > max.netProfit ? month : max
                        , monthlyData[0])
                        return (
                          <div>
                            <p className="text-2xl font-bold text-green-700">{bestMonth.monthLabel}</p>
                            <p className="text-lg text-green-600 mt-2">
                              {t('closing.annual.netProfit')}: {bestMonth.netProfit.toFixed(0)} {t('closing.currency')}
                            </p>
                            <div className="mt-2 text-sm text-gray-700">
                              <p>{t('closing.annual.revenue')}: {bestMonth.totalRevenue.toFixed(0)} {t('closing.currency')}</p>
                              <p>{t('closing.annual.expenses')}: {bestMonth.totalExpenses.toFixed(0)} {t('closing.currency')}</p>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-lg shadow-lg border-2 border-orange-300">
                      <h4 className="text-lg font-bold text-orange-800 mb-3 flex items-center gap-2">
                        <span>📉</span>
                        <span>{t('closing.annual.stats.worstMonth')}</span>
                      </h4>
                      {(() => {
                        const worstMonth = monthlyData.reduce((min, month) =>
                          month.netProfit < min.netProfit ? month : min
                        , monthlyData[0])
                        return (
                          <div>
                            <p className="text-2xl font-bold text-orange-700">{worstMonth.monthLabel}</p>
                            <p className="text-lg text-orange-600 mt-2">
                              {t('closing.annual.netProfit')}: {worstMonth.netProfit.toFixed(0)} {t('closing.currency')}
                            </p>
                            <div className="mt-2 text-sm text-gray-700">
                              <p>{t('closing.annual.revenue')}: {worstMonth.totalRevenue.toFixed(0)} {t('closing.currency')}</p>
                              <p>{t('closing.annual.expenses')}: {worstMonth.totalExpenses.toFixed(0)} {t('closing.currency')}</p>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .excel-table {
            font-size: 10px;
          }
          .excel-table th,
          .excel-table td {
            padding: 4px 6px !important;
          }
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }

        .excel-table {
          font-family: 'Arial', sans-serif;
        }

        .excel-table th {
          background-color: #e5e7eb;
          font-weight: 700;
        }

        .excel-table td,
        .excel-table th {
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}
