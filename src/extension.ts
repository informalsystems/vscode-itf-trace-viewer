import * as vscode from 'vscode';
import { TraceViewPanel } from './TraceViewPanel';

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(
		vscode.commands.registerCommand('itf-trace-viewer.viewFormattedTrace', () => {
			TraceViewPanel.create(context.extensionUri);
			TraceViewPanel.show();
		}));
}

export function deactivate() {}
