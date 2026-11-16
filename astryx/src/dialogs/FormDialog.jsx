import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Button} from '@astryxdesign/core/Button';

/**
 * Modal form with Cancel / Save. It's open while rendered: render it conditionally, and
 * onClose runs when it's dismissed.
 */
export function FormDialog({title, onClose, onSave, canSave = true, saveLabel = 'Save', width = 440, children}) {
  const handleOpenChange = isOpen => {
    if (!isOpen) onClose();
  };
  return (
    <Dialog isOpen onOpenChange={handleOpenChange} purpose="form" padding={4} width={width}>
      <VStack gap={4}>
        <DialogHeader title={title} onOpenChange={handleOpenChange} hasDivider={false} />
        {children}
        <HStack gap={2} hAlign="end">
          <Button label="Cancel" variant="ghost" onClick={onClose} />
          <Button label={saveLabel} variant="primary" onClick={onSave} isDisabled={!canSave} />
        </HStack>
      </VStack>
    </Dialog>
  );
}
