import {useState} from 'react';
import {Selector} from '@astryxdesign/core/Selector';
import {Text} from '@astryxdesign/core/Text';
import {FormDialog} from './FormDialog';
import {mergeBooks, useLedger} from '../store/ledgerStore';
import {useApp} from '../appContext';
import {plural} from '../options';

/**
 * Merge a title into another one that's the same book, for when stores report it under
 * slightly different names. `candidates` are the same-format titles it can merge into
 * (merging across formats would corrupt the format breakdown); the caller only opens
 * this when there's at least one.
 */
export default function MergeBookDialog({bookId, candidates, onClose}) {
  const {books} = useLedger();
  const {toast} = useApp();
  const source = books.find(book => book.id === bookId);
  const targetOptions = [...candidates]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(book => ({value: book.id, label: book.title, description: book.series || undefined}));
  const [targetId, setTargetId] = useState(targetOptions[0].value);

  function merge() {
    const target = books.find(book => book.id === targetId);
    const moved = mergeBooks(source.id, target.id);
    toast(`Merged "${source.title}" into "${target.title}". Moved ${plural(moved, 'sale row')}.`);
    onClose();
  }

  return (
    <FormDialog title={`Merge "${source.title}"`} onClose={onClose} onSave={merge} saveLabel="Merge">
      <Text color="secondary">
        All sales rows for "{source.title}" move to the title you pick, and "{source.title}" is removed. This can't be
        undone, so export a vault backup first if you're unsure.
      </Text>
      <Selector label="Merge into" options={targetOptions} value={targetId} onChange={setTargetId} hasSearch width="100%" />
    </FormDialog>
  );
}
