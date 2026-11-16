import {Suspense, lazy, useState} from 'react';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import {ArrowUpTrayIcon, PlusIcon} from '@heroicons/react/24/outline';
import {EXPENSE_CATEGORIES, aggregate, findCategory} from '../core/ledger';
import {removeExpense, useLedger} from '../store/ledgerStore';
import {useApp} from '../appContext';
import {KpiCard, KpiGrid, Page, PanelCard} from '../components/layout';
import {PlatformName} from '../components/platformBranding';
import {ExpensesByCategoryChart} from '../components/charts';

const ExpenseDialog = lazy(() => import('../dialogs/ExpenseDialog'));

const PRODUCTION_CATEGORIES = new Set(['cover', 'editing', 'formatting', 'isbn', 'narration']);

function totalWhere(byCategory, isIncluded) {
  return Object.entries(byCategory)
    .filter(([categoryId]) => isIncluded(categoryId))
    .reduce((sum, [, amount]) => sum + amount, 0);
}

export default function Expenses() {
  const ledger = useLedger();
  const {money, toast, confirm, filters, navigate} = useApp();
  const [editingExpenseId, setEditingExpenseId] = useState(undefined); // undefined: closed, null: new expense

  const totals = aggregate(ledger, filters);
  const adSpend = totalWhere(totals.byCategory, categoryId => categoryId.startsWith('ads_'));
  const productionSpend = totalWhere(totals.byCategory, categoryId => PRODUCTION_CATEGORIES.has(categoryId));
  const expenses = [...totals.expenses].sort((a, b) => b.date.localeCompare(a.date));

  function confirmRemove(expense) {
    confirm({
      title: 'Remove this expense?',
      description: `${findCategory(expense.categoryId)?.name || expense.categoryId} · ${money(expense.amount)} on ${expense.date}. This can't be undone.`,
      actionLabel: 'Remove',
      onConfirm: () => {
        removeExpense(expense.id);
        toast('Expense removed');
      },
    });
  }

  const columns = [
    {key: 'date', header: 'Date', width: pixel(110)},
    {
      key: 'categoryId',
      header: 'Expense',
      width: proportional(1, {minWidth: 180}),
      renderCell: expense => (
        <VStack gap={0.5}>
          <Text>{findCategory(expense.categoryId)?.name || expense.categoryId}</Text>
          {expense.note && <Text type="supporting">{expense.note}</Text>}
        </VStack>
      ),
    },
    {
      key: 'platformId',
      header: 'Platform',
      width: pixel(170),
      renderCell: expense => (expense.platformId ? <PlatformName platformId={expense.platformId} /> : <Text type="supporting">General</Text>),
    },
    {key: 'amount', header: 'Amount', width: pixel(130), align: 'end', renderCell: expense => `−${money(expense.amount)}`},
    {
      key: 'actions',
      header: '',
      width: pixel(190),
      align: 'end',
      renderCell: expense => (
        <HStack gap={1} hAlign="end">
          <Button label="Edit" size="sm" variant="ghost" onClick={() => setEditingExpenseId(expense.id)} />
          <Button label="Remove" size="sm" variant="ghost" onClick={() => confirmRemove(expense)} />
        </HStack>
      ),
    },
  ];

  return (
    <Page
      title="Expenses & ads"
      subtitle="The missing half of every royalty dashboard: covers, editing, ISBNs, AMS, Meta, BookBub…"
      actions={
        <>
          <Button label="Import from file" icon={<Icon icon={ArrowUpTrayIcon} />} onClick={() => navigate('import', {focus: 'expense-import'})} />
          <Button label="Add expense" variant="primary" icon={<Icon icon={PlusIcon} />} onClick={() => setEditingExpenseId(null)} />
        </>
      }
      hasFilters>
      <KpiGrid>
        <KpiCard label="Total spend" value={money(totals.spend)} note="Selected range" />
        <KpiCard label="Ad spend" value={money(adSpend)} note="Selected range" />
        <KpiCard label="Production" value={money(productionSpend)} note="Covers, editing, formatting, ISBNs, narration" />
        <KpiCard label="Ad ROI (rough)" value={adSpend > 0 ? `${((totals.income / adSpend) * 100).toFixed(0)}%` : '—'} note="Royalties ÷ ad spend" />
      </KpiGrid>

      {expenses.length ? (
        <>
          <PanelCard title="By category">
            <ExpensesByCategoryChart byCategory={totals.byCategory} categories={EXPENSE_CATEGORIES} money={money} />
          </PanelCard>
          <PanelCard title="Expenses" hint={`${expenses.length} in range, newest first`}>
            <Table data={expenses} columns={columns} idKey="id" density="compact" hasHover />
          </PanelCard>
        </>
      ) : (
        <PanelCard>
          <Text type="supporting">No expenses in this range.</Text>
        </PanelCard>
      )}

      {editingExpenseId !== undefined && (
        <Suspense>
          <ExpenseDialog expenseId={editingExpenseId} onClose={() => setEditingExpenseId(undefined)} />
        </Suspense>
      )}
    </Page>
  );
}
