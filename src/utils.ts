/*
 * Copyright 2017-2023 Elyra Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

export const getCookie = (key: string): string =>
  document.cookie.match('(^|;)\\s*' + key + '\\s*=\\s*([^;]+)')?.pop() || '';
