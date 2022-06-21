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
import { CommandIDs, streamlitIcon } from './utils';

const NAMESPACE = 'streamlit-extension';

const serverErrorMessage =
  'There was an issue with the streamlit_extension server extension.';

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
  }
};

export default plugin;
