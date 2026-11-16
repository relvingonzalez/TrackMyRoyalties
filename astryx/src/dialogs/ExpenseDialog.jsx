import {useState} from 'react';
import {DateInput} from '@astryxdesign/core/DateInput';
import {TextInput} from '@astryxdesign/core/TextInput';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Selector} from '@astryxdesign/core/Selector';
import {FormDialog} from './FormDialog';
import {saveExpense, useLedger} from '../store/ledgerStore';
import {useApp} from '../appContext';
import {CATEGORY_OPTIONS, GENERAL_PLATFORM, GENERAL_PLATFORM_OPTIONS, toIsoDate} from '../options';

/** Add an expense (no expenseId) or edit an existing one. */
export default function ExpenseDialog({expenseId, onClose}) {
  const {expenses, currency} = useLedger();
  const {toast} = useApp();
  const existing = expenses.find(expense => expense.id === expenseId);

  const [date, setDate] = useState(existing?.date || toIsoDate());
  const [categoryId, setCategoryId] = useState(existing?.categoryId || 'ads_amazon');
  const [platformId, setPlatformId] = useState(existing?.platformId || GENERAL_PLATFORM);
  const [amount, setAmount] = useState(existing?.amount ?? null);
  const [note, setNote] = useState(existing?.note || '');
  const [isAmountMissing, setIsAmountMissing] = useState(false);
  // The amount isn't required to enable Save: a number field only commits when you leave
  // it, so Save would look disabled right after typing a valid amount.
  const canSave = Boolean(date);

  function save() {
    // Re-checked only on Save: clearing the message as soon as the field commits would
    // shift Save out from under a click that's already in progress.
    setIsAmountMissing(!(amount > 0));
    if (!(amount > 0)) return;
    saveExpense(existing?.id, {
      date,
      categoryId,
      platformId: platformId === GENERAL_PLATFORM ? null : platformId,
      amount,
      note,
    });
    toast(existing ? 'Expense updated' : 'Expense added');
    onClose();
  }

  return (
    <FormDialog title={existing ? 'Edit expense' : 'Add expense'} onClose={onClose} onSave={save} canSave={canSave}>
      <DateInput label="Date" value={date} onChange={value => setDate(value || '')} isRequired />
      <Selector label="Category" options={CATEGORY_OPTIONS} value={categoryId} onChange={setCategoryId} width="100%" />
      <Selector
        label="Platform"
        description="Set one to count this spend against that store's net."
        options={GENERAL_PLATFORM_OPTIONS}
        value={platformId}
        onChange={setPlatformId}
        width="100%"
      />
      <NumberInput
        label={`Amount (${currency})`}
        value={amount}
        onChange={setAmount}
        status={isAmountMissing ? {type: 'error', message: 'Enter an amount greater than 0.'} : undefined}
        isRequired
      />
      <TextInput label="Note" value={note} onChange={setNote} placeholder="e.g. AMS Ember Protocol" isOptional />
    </FormDialog>
  );
}
