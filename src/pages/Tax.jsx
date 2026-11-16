import {useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Selector} from '@astryxdesign/core/Selector';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import {ArrowDownTrayIcon} from '@heroicons/react/24/outline';
import {brand} from '../core/ledger';
import {csvField, downloadFile} from '../core/files';
import {useLedger} from '../store/ledgerStore';
import {useApp} from '../appContext';
import {KpiCard, KpiGrid, Page, PanelCard} from '../components/layout';

/** Every year with any royalty or expense, newest first (the current year if there's no data). */
function yearsWithData(ledger) {
  const years = new Set([...ledger.royalties, ...ledger.expenses].map(row => row.date.slice(0, 4)));
  if (years.size === 0) years.add(String(new Date().getFullYear()));
  return [...years].sort().reverse();
}

function monthlyTotals(year, royalties, expenses) {
  const months = Array.from({length: 12}, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
  const totals = Object.fromEntries(months.map(month => [month, {id: month, month, royalty: 0, expense: 0}]));
  royalties.forEach(row => (totals[row.date.slice(0, 7)].royalty += row.royalty));
  expenses.forEach(expense => (totals[expense.date.slice(0, 7)].expense += expense.amount));
  return Object.values(totals);
}

function exportCsv(ledger) {
  const lines = ['date,platform,title,type,royalty,units,kenp'];
  ledger.royalties.forEach(row => lines.push([row.date, row.platformId, csvField(row.title), row.type, row.royalty, row.units, row.kenp].join(',')));
  lines.push('', 'date,category,amount,note');
  ledger.expenses.forEach(expense => lines.push([expense.date, expense.categoryId, expense.amount, csvField(expense.note || '')].join(',')));
  downloadFile(lines.join('\n'), `${brand.slug}-export-${Date.now()}.csv`, 'text/csv');
}

function exportJson(ledger) {
  downloadFile(JSON.stringify(ledger, null, 2), `${brand.slug}-backup-${Date.now()}.json`, 'application/json');
}

export default function Tax() {
  const ledger = useLedger();
  const {money, toast} = useApp();
  const years = yearsWithData(ledger);
  const [chosenYear, setChosenYear] = useState(null);
  const year = years.includes(chosenYear) ? chosenYear : years[0];

  const royalties = ledger.royalties.filter(row => row.date.startsWith(year));
  const expenses = ledger.expenses.filter(expense => expense.date.startsWith(year));
  const income = royalties.reduce((sum, row) => sum + row.royalty, 0);
  const spend = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const columns = [
    {key: 'month', header: 'Month', width: proportional(1, {minWidth: 100})},
    {key: 'royalty', header: 'Royalties', width: pixel(130), align: 'end', renderCell: month => money(month.royalty)},
    {key: 'expense', header: 'Expenses', width: pixel(130), align: 'end', renderCell: month => money(month.expense)},
    {key: 'net', header: 'Net', width: pixel(130), align: 'end', renderCell: month => money(month.royalty - month.expense)},
  ];

  return (
    <Page
      title="Tax & export"
      subtitle="Year totals for your accountant. Not tax advice."
      actions={
        <>
          <Selector label="Tax year" isLabelHidden options={years.map(y => ({value: y, label: y}))} value={year} onChange={setChosenYear} width={110} />
          <Button
            label="Export CSV"
            icon={<Icon icon={ArrowDownTrayIcon} />}
            onClick={() => {
              exportCsv(ledger);
              toast('CSV downloaded.');
            }}
          />
          <Button
            label="Export JSON"
            icon={<Icon icon={ArrowDownTrayIcon} />}
            onClick={() => {
              exportJson(ledger);
              toast('JSON backup downloaded.');
            }}
          />
        </>
      }>
      <KpiGrid>
        <KpiCard label={`${year} royalties`} value={money(income)} />
        <KpiCard label={`${year} expenses`} value={money(spend)} />
        <KpiCard label={`${year} net`} value={money(income - spend)} />
        <KpiCard label="Rows" value={`${royalties.length} / ${expenses.length}`} note="Royalty / expense rows" />
      </KpiGrid>
      <PanelCard title="Monthly breakdown">
        <Table data={monthlyTotals(year, royalties, expenses)} columns={columns} idKey="id" density="compact" isStriped />
      </PanelCard>
    </Page>
  );
}
