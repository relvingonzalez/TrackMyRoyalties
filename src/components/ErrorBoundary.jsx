import {Component} from 'react';
import {Center} from '@astryxdesign/core/Center';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {ExclamationTriangleIcon} from '@heroicons/react/24/outline';
import {brand} from '../core/ledger';
import {downloadVault} from '../core/files';
import {getLedgerSnapshot} from '../store/ledgerStore';

/** A lazily loaded page whose file is gone, usually because a new version was deployed. */
function isMissingCodeError(error) {
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(error?.message || '');
}

function CrashScreen({error}) {
  const isMissingCode = isMissingCodeError(error);
  return (
    <Center height="100%" padding={6}>
      <EmptyState
        icon={<Icon icon={ExclamationTriangleIcon} size="lg" />}
        headingLevel={1}
        title={isMissingCode ? 'A newer version is available' : 'Something went wrong showing this page'}
        description={
          isMissingCode
            ? 'Reload to get it. Your data is safe on this device.'
            : `Your data is still saved on this device. Reload to try again, or save a backup first. (${error?.message || 'Unknown error'})`
        }
        actions={
          <>
            <Button label="Reload" variant="primary" onClick={() => window.location.reload()} />
            {!isMissingCode && getLedgerSnapshot() && <Button label="Download a vault backup" onClick={() => downloadVault(getLedgerSnapshot(), brand)} />}
          </>
        }
      />
    </Center>
  );
}

/**
 * Shows a recovery screen instead of a blank app when rendering throws (or a lazy page's
 * file fails to load). Error boundaries must be class components. Pass `resetKey` (e.g.
 * the page id) so moving elsewhere clears the error.
 */
export class ErrorBoundary extends Component {
  state = {error: null, resetKey: this.props.resetKey};

  static getDerivedStateFromError(error) {
    return {error};
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? {error: null, resetKey: props.resetKey} : null;
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info.componentStack);
  }

  render() {
    return this.state.error ? <CrashScreen error={this.state.error} /> : this.props.children;
  }
}
