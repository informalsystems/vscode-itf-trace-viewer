import * as vscode from "vscode";
import { Trace, ViewMode, toHtml } from "./Trace";
import { getNonce } from "./util";

export class TraceViewPanel {
    // Track the currently panel. Only allow a single panel to exist at a time.
    public static currentPanel?: TraceViewPanel;

    public static readonly viewType = "itf-trace-view-panel";

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _trace?: Trace = undefined;
    private _viewMode: ViewMode = ViewMode.ChainedTables;
    private _selectedVariables: string[] = [];
    private _showInitialState: boolean = false;

    public static createOrShow(extensionUri: vscode.Uri) {
        if (TraceViewPanel.currentPanel) {
            this.show();
        } else {
            this.create(extensionUri);
        }
    }

    public static show() {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        TraceViewPanel.currentPanel!._panel.reveal(column);
        TraceViewPanel.currentPanel!._update();
        return;
    }

    public static create(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        var path = require('path');
        const filePath = vscode.window.activeTextEditor?.document.fileName;
        const baseName = path.parse(filePath).base;
        const title = `View ${baseName}`;

        const panel = vscode.window.createWebviewPanel(
            TraceViewPanel.viewType,
            title,
            column || vscode.ViewColumn.One,
            {
                // Enable javascript in the webview.
                enableScripts: true,

                // Restrict the webview to only load content from `media` directory.
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, "media"),
                    vscode.Uri.joinPath(extensionUri, "out/compiled"),
                ],

                retainContextWhenHidden: true
            }
        );

        TraceViewPanel.currentPanel = new TraceViewPanel(panel, extensionUri);
    }

    public static kill() {
        TraceViewPanel.currentPanel?.dispose();
        TraceViewPanel.currentPanel = undefined;
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        TraceViewPanel.currentPanel = new TraceViewPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view changes
        this._panel.onDidChangeViewState(
            () => {
                if (this._panel.visible) {
                    this._update();
                }
            },
            null,
            this._disposables
        );

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'switch-view':
                        this._viewMode = (this._viewMode === ViewMode.SingleTable) ? ViewMode.ChainedTables : ViewMode.SingleTable;
                        console.log("switched to mode " + this._viewMode);
                        this._update();
                        return;
                    case 'filter-variables':
                        this._selectedVariables = message.variables;
                        console.log("selected variables " + this._selectedVariables);
                        this._update();
                        return;
                    case 'show-initial-state':
                        this._showInitialState = !this._showInitialState;
                        console.log("show initial state: " + this._showInitialState);
                        this._update();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        TraceViewPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _readText() {
        const editor = vscode.window.activeTextEditor;
        if (editor) { // when focused on an itf.json file
            let text = editor.document.getText();
            this._trace = JSON.parse(text) as Trace;

            // Initially, all variables are selected
            this._selectedVariables = this._trace.vars;
        }
    }

    private async _update() {
        const webview = this._panel.webview;
        this._readText();
        this._panel.webview.html = this._makeHtmlForWebview(webview);
    }

    private _mkControlBarHtml(variables: string[], selectedVariables: string[]) {
        let cells = variables.sort().map(v => {
            let checked = selectedVariables.includes(v) ? 'checked' : '';
            return `<label><input type="checkbox" name="vars" value="${v}" ${checked}>${v}</label>`;
        });
        let vars = `<span>Variables: ${cells.join("\n")}</span>`;
        let showInitialState = `<label><input type="checkbox" name="init"
            ${this._showInitialState ? 'checked' : ''}>
            Show initial state
            </label>`;

        let switchButton = `<button class="button" id="switch-view-button">Switch view</button>`;
        return `<div id="control">
            ${vars}
            ${showInitialState}
            ${switchButton}
            </div>`;
    }

    private _makeBottomBar() {
        var content = "";
        const meta = this._trace!["#meta"];
        if (meta){
            const description = this._trace!["#meta"].description;
            if (description) {
                content = description.replace("Apalache", `<a href="https://apalache.informal.systems/">Apalache</a>`);
            }    
        }
        return `<div>${content}</div>`;
    }

    private _makeHtmlForWebview(webview: vscode.Webview) {
        let controlBar = this._mkControlBarHtml(this._trace!.vars, this._selectedVariables);
        let content = toHtml(this._trace!, this._selectedVariables, this._showInitialState, this._viewMode);
        let metaBar = this._makeBottomBar();

        // Uri to load styles into webview
        const stylesResetUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
        );

        const stylesMainUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
        );

        const stylesItfUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "itf.css")
        );

        const mainScriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
        );

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        // Use a content security policy to only allow loading images from https
        // or from our extension directory, and only allow scripts that have a
        // specific nonce.
        let contentPolicy = `<meta http-equiv="Content-Security-Policy" 
            content="img-src https: data:; 
            style-src 'unsafe-inline' ${webview.cspSource}; 
            script-src 'nonce-${nonce}';">`;

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
                ${contentPolicy}
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${stylesResetUri}" rel="stylesheet">
            <link href="${stylesMainUri}" rel="stylesheet">
            <link href="${stylesItfUri}" rel="stylesheet">
            <script nonce="${nonce}">
            </script>
			</head>
            <body>
            ${controlBar}
            <hr/>
            ${content}
            <hr/>
            ${metaBar}
            
            <script nonce="${nonce}" src="${mainScriptUri}"></script>
			</body>
			</html>`;
    }

}
