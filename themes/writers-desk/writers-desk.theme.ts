// The writers-desk theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in writers-desk.settings.json and the generated writers-desk.settings.ts;
// change them with `astryx experimental theme editor set writers-desk ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {writersDeskSettings} from './writers-desk.settings';

export const writersDeskTheme = defineTheme({
  extends: writersDeskSettings,
  name: 'writers-desk',
});
