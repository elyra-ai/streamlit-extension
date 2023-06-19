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

import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  Dialog,
  IFrame,
  MainAreaWidget,
  showDialog,
  WidgetTracker
} from '@jupyterlab/apputils';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { IEditorTracker } from '@jupyterlab/fileeditor';
import { find } from '@lumino/algorithm';

import path from 'path';
import { StreamlitButtonExtension } from './button';

import { requestAPI } from './handler';
import { CommandIDs, getCookie, streamlitIcon } from './utils';

const NAMESPACE = '@elyra/streamlit-extension';

const serverErrorMessage =
  'There was an issue with the streamlit_extension server extension.';

export const syncXsrfCookie = (): void => {
  const xsrf = getCookie('_xsrf');
  const jupyterlab_xsrf = getCookie('jupyterlab_xsrf');
  // Initialize or update jupyterlab_xsrf to duplicate _xsrf
  if (xsrf && (!jupyterlab_xsrf || xsrf !== jupyterlab_xsrf)) {
    document.cookie = 'jupyterlab_xsrf=' + xsrf;
  }
  // Restore _xsrf if deleted
  if (jupyterlab_xsrf && !xsrf) {
    document.cookie = '_xsrf=' + jupyterlab_xsrf;
  }
};

export const checkCookie = (function () {
  syncXsrfCookie();
  let previousCookie = document.cookie;
  return () => {
    const currentCookie = document.cookie;
    if (currentCookie !== previousCookie) {
      syncXsrfCookie();
      previousCookie = currentCookie;
    }
  };
})();

const getStreamlitApp = async (file: string): Promise<string> => {
  return await requestAPI<any>('app', {
    method: 'POST',
    body: JSON.stringify({ file })
  })
    .then(data => {
      return data.url;
    })
    .catch(reason => {
      console.error(`${serverErrorMessage}\n${reason}`);
    });
};

const stopStreamlitApp = async (file: string): Promise<string> => {
  return await requestAPI<any>('app', {
    method: 'DELETE',
    body: JSON.stringify({ file })
  }).catch(reason => {
    console.error(`${serverErrorMessage}\n${reason}`);
  });
};

/**
 * Initialization data for the streamlit-extension extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: NAMESPACE,
  autoStart: true,
  requires: [IEditorTracker, IFileBrowserFactory],
  optional: [ILayoutRestorer],
  activate: (
    app: JupyterFrontEnd,
    editorTracker: IEditorTracker,
    factory: IFileBrowserFactory,
    restorer: ILayoutRestorer | null
  ) => {
    console.log('JupyterLab extension streamlit-extension is activated!');

    requestAPI<any>('app')
      .then(data => {
        console.log(
          'streamlit_extension server extension successfully started'
        );
      })
      .catch(reason => {
        console.error(`${serverErrorMessage}\n${reason}`);
      });

    const tracker = new WidgetTracker<MainAreaWidget<IFrame>>({
      namespace: NAMESPACE
    });

    // Handle state restoration
    if (restorer) {
      void restorer.restore(tracker, {
        command: CommandIDs.open,
        args: widget => ({
          file: widget.id.split(':')[1]
        }),
        name: widget => widget.id
      });
    }

    app.commands.addCommand(CommandIDs.open, {
      label: 'Streamlit',
      icon: streamlitIcon,
      execute: async (args: any) => {
        const widgetId = `${NAMESPACE}:${args.file}`;
        const openWidget = find(app.shell.widgets('main'), (widget, index) => {
          return widget.id === widgetId;
        });
        if (openWidget) {
          app.shell.activateById(widgetId);
          return;
        }

        const urlPromise = getStreamlitApp(args.file);

        const widget = new IFrame({
          sandbox: [
            'allow-same-origin',
            'allow-scripts',
            'allow-popups',
            'allow-forms'
          ]
        });
        const main = new MainAreaWidget({ content: widget });
        main.title.label = path.basename(args.file);
        main.title.icon = streamlitIcon;
        main.title.caption = widget.title.label;
        main.id = widgetId;
        main.disposed.connect(() => {
          stopStreamlitApp(args.file);
        });

        await tracker.add(main);
        app.shell.add(main, 'main');

        // Set iframe url last to not block widget creation on webapp startup
        const url = await urlPromise;
        // When iframe src=undefined the lab instance is shown instead
        // In this case we want to close the widget rather than set the url
        if (url === undefined) {
          main.dispose();
          void showDialog({
            title: 'Streamlit application failed to start',
            body: 'Check the logs for more information.',
            buttons: [Dialog.okButton()]
          });
        } else {
          widget.url = url;
        }
      }
    });

    app.commands.addCommand(CommandIDs.openFromBrowser, {
      label: 'Run in Streamlit',
      icon: streamlitIcon,
      isVisible: () =>
        !!factory.tracker.currentWidget &&
        factory.tracker.currentWidget.selectedItems().next !== undefined,
      execute: async () => {
        const currentWidget = factory.tracker.currentWidget;
        if (!currentWidget) {
          return;
        }
        const item = currentWidget.selectedItems().next();
        if (!item) {
          return;
        }

        await app.commands.execute(CommandIDs.open, {
          file: item.path
        });
      }
    });

    app.commands.addCommand(CommandIDs.openFromEditor, {
      execute: () => {
        const widget = editorTracker.currentWidget;
        if (!widget) {
          return;
        }
        const path = widget.context.path;
        return app.commands.execute(CommandIDs.open, { file: path });
      },
      isVisible: () => {
        const widget = editorTracker.currentWidget;
        return (widget && path.extname(widget.context.path) === '.py') || false;
      },
      icon: streamlitIcon,
      label: 'Run in Streamlit'
    });

    app.docRegistry.addWidgetExtension(
      'Editor',
      new StreamlitButtonExtension(app.commands)
    );

    // Add button to Elyra Python Editor if installed
    app.docRegistry.addWidgetExtension(
      'Python Editor',
      new StreamlitButtonExtension(app.commands)
    );

    app.contextMenu.addItem({
      selector: '[data-file-type="python"]',
      command: CommandIDs.openFromBrowser,
      rank: 999
    });

    app.contextMenu.addItem({
      selector: '.jp-FileEditor',
      command: CommandIDs.openFromEditor,
      rank: 999
    });

    // Poll changes to cookies and prevent the deletion of _xsrf by Streamlit
    // _xsrf deletion issue: https://github.com/streamlit/streamlit/issues/2517
    window.setInterval(checkCookie, 100); // run every 100 ms
  }
};

export default plugin;
