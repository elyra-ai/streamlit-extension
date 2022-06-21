import { CommandToolbarButton } from '@jupyterlab/apputils';
import { DocumentRegistry, DocumentWidget } from '@jupyterlab/docregistry';

import { CommandRegistry } from '@lumino/commands';
import { IDisposable, DisposableDelegate } from '@lumino/disposable';

import { CommandIDs } from './utils';

export class StreamlitButtonExtension
  implements
    DocumentRegistry.IWidgetExtension<DocumentWidget, DocumentRegistry.IModel>
{
  commands: CommandRegistry;
  constructor(commands: CommandRegistry) {
    this.commands = commands;
  }
  createNew(widget: DocumentWidget): IDisposable {
    const button = new CommandToolbarButton({
      commands: this.commands,
      id: CommandIDs.openFromEditor,
      label: ''
    });

    widget.toolbar.insertItem(99, 'streamlit', button);
    return new DisposableDelegate(() => {
      button.dispose();
    });
  }
}
