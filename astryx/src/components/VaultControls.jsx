import {useState} from 'react';
import {HStack} from '@astryxdesign/core/HStack';
import {Button} from '@astryxdesign/core/Button';
import {FileInput} from '@astryxdesign/core/FileInput';
import {Icon} from '@astryxdesign/core/Icon';
import {ArrowDownTrayIcon} from '@heroicons/react/24/outline';
import {brand} from '../core/ledger';
import {downloadVault} from '../core/files';
import {restoreVault, useLedger} from '../store/ledgerStore';
import {useApp} from '../appContext';

/** Export everything to one JSON "vault" file, or restore one (replacing this device's data). */
export function VaultControls() {
  const ledger = useLedger();
  const {toast, confirm} = useApp();
  const [vaultFile, setVaultFile] = useState(null);

  function exportVault() {
    downloadVault(ledger, brand);
    toast('Vault exported. Keep it private: it holds your sales data.');
  }

  async function chooseVaultFile(file) {
    setVaultFile(file);
    if (!file) return;
    let vault;
    try {
      vault = JSON.parse(await file.text());
    } catch {
      vault = null;
    }
    if (!vault || (vault.royalties == null && vault.books == null)) {
      setVaultFile(null);
      toast(`That file isn't a ${brand.name} vault.`, 'error');
      return;
    }
    confirm({
      title: 'Replace all data on this device?',
      description: `Everything here is replaced with the contents of ${file.name}.`,
      actionLabel: 'Replace with vault',
      onConfirm: () => {
        restoreVault(vault);
        setVaultFile(null);
        toast('Vault restored');
      },
      onCancel: () => setVaultFile(null),
    });
  }

  return (
    <HStack gap={3} wrap="wrap" vAlign="end">
      <Button label="Export vault (.json)" variant="primary" icon={<Icon icon={ArrowDownTrayIcon} />} onClick={exportVault} />
      <FileInput label="Restore a vault" value={vaultFile} onChange={chooseVaultFile} accept="application/json,.json" placeholder="Choose vault file" />
    </HStack>
  );
}
