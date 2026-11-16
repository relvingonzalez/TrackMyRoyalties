import {useState} from 'react';
import {DateInput} from '@astryxdesign/core/DateInput';
import {TextInput} from '@astryxdesign/core/TextInput';
import {FormDialog} from './FormDialog';
import {addAnnotation} from '../store/ledgerStore';
import {toIsoDate} from '../options';

const MAX_LABEL_LENGTH = 40;

/** Pin a labeled marker (a promo, a launch…) on the royalties chart. */
export default function AnnotationDialog({onClose}) {
  const [date, setDate] = useState(toIsoDate());
  const [label, setLabel] = useState('');
  const canSave = Boolean(date && label.trim());

  function save() {
    if (!canSave) return;
    addAnnotation({date, label: label.trim()});
    onClose();
  }

  return (
    <FormDialog title="Add chart annotation" onClose={onClose} onSave={save} canSave={canSave}>
      <DateInput label="Date" value={date} onChange={value => setDate(value || '')} isRequired />
      <TextInput
        label="Label"
        value={label}
        onChange={value => setLabel(value.slice(0, MAX_LABEL_LENGTH))}
        placeholder="e.g. BookBub feature"
        isRequired
        onEnter={save}
      />
    </FormDialog>
  );
}
