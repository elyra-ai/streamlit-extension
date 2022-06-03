import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IFrame, MainAreaWidget, WidgetTracker } from '@jupyterlab/apputils';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { ILauncher } from '@jupyterlab/launcher';
import { LabIcon } from '@jupyterlab/ui-components';

import { requestAPI } from './handler';

import iconSvg from '../style/streamlit-mark-color.svg';

const NAMESPACE = 'streamlit-extension';

/**
 * The command IDs used by the  plugin.
 */
const CommandIDs = {
  open: 'streamlit:open',
  openFromBrowser: 'streamlit:open-browser',
  openFromEditor: 'streamlit:open-file'
};

const getStreamlitApp = async (file?: string): Promise<string> => {
  let appUrl = "http://localhost:8501";

  if (file) {
    await requestAPI<any>('open', { method: 'POST', body: JSON.stringify({file}) })
    .then(data => {
      console.log(data);
    })
    .catch(reason => {
      console.error(
        `The streamlit_extension server extension appears to be missing.\n${reason}`
      );
    });
  }

  return appUrl;

}

/**
 * Initialization data for the streamlit-extension extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: NAMESPACE,
  autoStart: true,
  requires: [IFileBrowserFactory],
  optional: [ILayoutRestorer, ILauncher],
  activate: (
    app: JupyterFrontEnd,
    factory: IFileBrowserFactory,
    restorer: ILayoutRestorer | null,
    launcher: ILauncher | null
  ) => {
    console.log('JupyterLab extension streamlit-extension is activated!');

    requestAPI<any>('test')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The streamlit_extension server extension appears to be missing.\n${reason}`
        );
      });

    const streamlitIcon = new LabIcon({
      name: 'streamlit:icon',
      svgstr: iconSvg
    });

    const tracker = new WidgetTracker<MainAreaWidget<IFrame>>({
      namespace: NAMESPACE
    });

    // Handle state restoration
    if (restorer) {
      void restorer.restore(tracker, {
        command: CommandIDs.open,
        args: widget => ({
          widgetId: widget.id
        }),
        name: widget => widget.id
      });
    }

    app.commands.addCommand(CommandIDs.open, {
      label: 'Streamlit',
      icon: streamlitIcon,
      execute: async (args: any) => {
        const widget = new IFrame({
          sandbox: ["allow-scripts", "allow-same-origin"]
        });
        widget.url = await getStreamlitApp(args.file);

        const main = new MainAreaWidget({ content: widget });
        main.title.label = args.file || 'Streamlit';
        main.title.icon = streamlitIcon;
        main.title.caption = widget.title.label;
        if (args.widgetId) {
          main.id = args.widgetId;
        }

        await tracker.add(main);
        app.shell.add(main, 'main');
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

    if (launcher) {
      launcher.add({
        command: CommandIDs.open
      });
    }

    app.contextMenu.addItem({
      selector: '[data-file-type="python"]',
      command: CommandIDs.openFromBrowser
    });
  }
};

export default plugin;
