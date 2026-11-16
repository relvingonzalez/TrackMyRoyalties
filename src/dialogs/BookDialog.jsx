import {useState} from 'react';
import {TextInput} from '@astryxdesign/core/TextInput';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Selector} from '@astryxdesign/core/Selector';
import {FormDialog} from './FormDialog';
import {normalizeFormat} from '../core/ledger';
import {saveBook, useLedger} from '../store/ledgerStore';
import {useApp} from '../appContext';
import {BOOK_FORMAT_OPTIONS} from '../options';

/** "a, b, a ,, c" → ["a", "b", "c"] */
function parseCommaList(text) {
  return [...new Set(text.split(',').map(item => item.trim()).filter(Boolean))];
}

/** Add a title (no bookId) or edit an existing one. */
export default function BookDialog({bookId, onClose}) {
  const {books} = useLedger();
  const {toast} = useApp();
  const existing = books.find(book => book.id === bookId);
  const existingFormat = existing && normalizeFormat(existing.format);

  const [title, setTitle] = useState(existing?.title || '');
  const [series, setSeries] = useState(existing?.series || '');
  const [seriesNumber, setSeriesNumber] = useState(existing?.seriesNumber ?? null);
  const [penName, setPenName] = useState(existing?.penName || '');
  const [format, setFormat] = useState(existingFormat && existingFormat !== 'unknown' ? existingFormat : 'ebook');
  const [tags, setTags] = useState((existing?.tags || []).join(', '));
  const [aliases, setAliases] = useState((existing?.aliases || []).join(', '));
  const canSave = Boolean(title.trim());

  function save() {
    if (!canSave) return;
    saveBook(existing?.id, {
      title: title.trim(),
      series,
      seriesNumber: Number.isFinite(seriesNumber) ? Math.round(seriesNumber) : null,
      penName,
      format,
      tags: parseCommaList(tags),
      aliases: parseCommaList(aliases),
    });
    toast(existing ? 'Title updated' : 'Title added');
    onClose();
  }

  return (
    <FormDialog title={existing ? 'Edit title' : 'Add title'} onClose={onClose} onSave={save} canSave={canSave}>
      <TextInput label="Title" value={title} onChange={setTitle} isRequired />
      <TextInput label="Series" value={series} onChange={setSeries} isOptional />
      <NumberInput
        label="Book # in series"
        description="Sets the order for the series read-through."
        value={seriesNumber}
        onChange={setSeriesNumber}
        isOptional
      />
      <TextInput label="Pen name" value={penName} onChange={setPenName} isOptional />
      <Selector label="Format" options={BOOK_FORMAT_OPTIONS} value={format} onChange={setFormat} width="100%" />
      <TextInput
        label="Tags"
        description="Comma-separated"
        value={tags}
        onChange={setTags}
        placeholder="box-set, trilogy, 2024-release"
        isOptional
      />
      <TextInput
        label="Aliases"
        description="Other titles this book is reported under, comma-separated (e.g. a UK edition)"
        value={aliases}
        onChange={setAliases}
        isOptional
      />
    </FormDialog>
  );
}
