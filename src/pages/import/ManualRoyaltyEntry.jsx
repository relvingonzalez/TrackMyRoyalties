import {useState} from 'react';
import {Grid} from '@astryxdesign/core/Grid';
import {HStack} from '@astryxdesign/core/HStack';
import {Button} from '@astryxdesign/core/Button';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Selector} from '@astryxdesign/core/Selector';
import {TextInput} from '@astryxdesign/core/TextInput';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {addManualRoyalty} from '../../store/ledgerStore';
import {useApp} from '../../appContext';
import {PLATFORM_OPTIONS, toIsoDate} from '../../options';
import {PanelCard} from '../../components/layout';

const EMPTY_ENTRY = {platformId: 'kdp', title: '', royalty: null, units: 0, kenp: 0};

/** One hand-entered royalty row, for stores that only show a monthly total. */
export function ManualRoyaltyEntry() {
  const {toast, navigate} = useApp();
  const [entry, setEntry] = useState({...EMPTY_ENTRY, date: toIsoDate()});
  const [isRoyaltyMissing, setIsRoyaltyMissing] = useState(false);
  const setField = (key, value) => setEntry(current => ({...current, [key]: value}));
  // Royalty isn't required to enable the button: a number field only commits when you leave
  // it, so the button would look disabled right after typing a valid amount.
  const canAdd = Boolean(entry.date);

  function add() {
    // Re-checked only on click: clearing the message as soon as the field commits would
    // shift the button out from under a click that's already in progress.
    setIsRoyaltyMissing(!Number.isFinite(entry.royalty));
    if (!Number.isFinite(entry.royalty)) return;
    addManualRoyalty({...entry, units: entry.units || 0, kenp: entry.kenp || 0});
    toast('Royalty entry added');
    setEntry({...EMPTY_ENTRY, date: toIsoDate()});
    navigate('dashboard');
  }

  return (
    <PanelCard title="Add a royalty by hand" hint="When a store only shows a monthly total">
      {/* One row of six on desktop (two per row on phones). Short labels and no
          required/optional markers, so every label fits on one line and the fields align. */}
      <Grid columns={{minWidth: 125, repeat: 'fit'}} gap={3}>
        <DateInput label="Date" value={entry.date} onChange={value => setField('date', value || '')} format="system_date" />
        <Selector label="Platform" options={PLATFORM_OPTIONS} value={entry.platformId} onChange={value => setField('platformId', value)} width="100%" />
        <TextInput label="Title" value={entry.title} onChange={value => setField('title', value)} placeholder="Optional" />
        <NumberInput
          label="Royalty (USD)"
          value={entry.royalty}
          onChange={value => setField('royalty', value)}
          status={isRoyaltyMissing ? {type: 'error', message: 'Enter the royalty amount.'} : undefined}
        />
        <NumberInput label="Units" value={entry.units} onChange={value => setField('units', value)} />
        <NumberInput label="KENP pages" value={entry.kenp} onChange={value => setField('kenp', value)} />
      </Grid>
      <HStack>
        <Button label="Add entry" onClick={add} isDisabled={!canAdd} />
      </HStack>
    </PanelCard>
  );
}
