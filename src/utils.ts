import { LabIcon } from '@jupyterlab/ui-components';

import iconSvg from '../style/streamlit-mark-color.svg';

export const CommandIDs = {
  open: 'streamlit:open',
  openFromBrowser: 'streamlit:open-browser',
  openFromEditor: 'streamlit:open-file'
};

export const streamlitIcon = new LabIcon({
  name: 'streamlit:icon',
  svgstr: iconSvg
});
